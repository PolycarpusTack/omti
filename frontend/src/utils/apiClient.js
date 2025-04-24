// src/utils/apiClient.ts
import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  CancelTokenSource
} from 'axios';
import axiosRetry from 'axios-retry';
import { setupCache, buildMemoryStorage } from 'axios-cache-adapter';
import CircuitBreaker from 'opossum';
import Bottleneck from 'bottleneck';
import { v4 as uuid } from 'uuid';
import { validateConfig } from './configValidator';
import { ApplicationError } from '../errors';
import { metrics } from '../services/metrics';
import { LoggerService } from '../services/logger';

/**
 * API Client configuration options
 */
export interface ApiClientConfig {
  /** Base API URL */
  baseURL: string;
  
  /** Request timeout in milliseconds */
  timeout: number;
  
  /** Number of retry attempts */
  retries: number;
  
  /** Base delay between retries in ms */
  retryDelay: number;
  
  /** Function to retrieve auth token */
  getAuthToken: () => Promise<string | null> | string | null;
  
  /** Function to refresh expired auth token */
  refreshToken: (() => Promise<string | null>) | null;
  
  /** Enable response caching for offline support */
  enableCache: boolean;
  
  /** Cache time-to-live in milliseconds */
  cacheTTL: number;
  
  /** Cache storage strategy */
  cacheStrategy: 'memory' | 'localStorage' | 'custom';
  
  /** Custom cache storage implementation */
  cacheStorage?: any;
  
  /** Enable circuit breaker for failing services */
  enableCircuitBreaker: boolean;
  
  /** Maximum concurrent requests */
  maxConcurrent: number;
  
  /** Minimum time between requests in ms */
  requestRateLimit: number;
  
  /** Default headers */
  headers?: Record<string, string>;
  
  /** Enable compression for requests/responses */
  enableCompression: boolean;
  
  /** List of middleware functions */
  middleware: ApiClientMiddleware[];
  
  /** Logger service */
  logger: LoggerService;
  
  /** Enable request/response debug logging */
  debug: boolean;
  
  /** GraphQL endpoint path (if using GraphQL) */
  graphQLEndpoint?: string;
}

/** 
 * Response metadata with timing and context info 
 */
export interface ResponseMetadata {
  /** Request duration in milliseconds */
  duration: number;
  
  /** Request ID for tracing */
  requestId: string;
  
  /** Number of retries performed */
  retryCount: number;
  
  /** Cache hit status */
  cacheHit?: boolean;
  
  /** Response headers */
  headers: Record<string, string>;
}

/** 
 * Middleware interface for request/response processing 
 */
export interface ApiClientMiddleware {
  /** Unique identifier for this middleware */
  id: string;
  
  /** Process outgoing request */
  request?: (config: AxiosRequestConfig) => Promise<AxiosRequestConfig> | AxiosRequestConfig;
  
  /** Process successful response */
  response?: (response: AxiosResponse) => Promise<AxiosResponse> | AxiosResponse;
  
  /** Process response error */
  error?: (error: AxiosError) => Promise<AxiosResponse | AxiosError> | AxiosResponse | AxiosError;
}

/**
 * GraphQL operation types
 */
export enum GraphQLOperationType {
  Query = 'query',
  Mutation = 'mutation',
  Subscription = 'subscription'
}

/**
 * GraphQL request options
 */
export interface GraphQLRequest<V = Record<string, any>> {
  /** GraphQL operation name */
  operationName?: string;
  
  /** Query document */
  query: string;
  
  /** Variables for the operation */
  variables?: V;
  
  /** Operation type */
  type?: GraphQLOperationType;
  
  /** Context to be passed to middleware */
  context?: Record<string, any>;
}

/**
 * Generic API response 
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  
  /** Response metadata */
  meta: ResponseMetadata;
}

const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT_MS, 10) || 8000,
  retries: 3,
  retryDelay: 1000,
  getAuthToken: () => sessionStorage.getItem('auth_token'),
  refreshToken: null,
  enableCache: false,
  cacheTTL: 15 * 60 * 1000, // 15 minutes
  cacheStrategy: 'memory',
  enableCircuitBreaker: false,
  maxConcurrent: 5,
  requestRateLimit: 100,
  enableCompression: true,
  middleware: [],
  logger: console,
  debug: process.env.NODE_ENV !== 'production'
};

export class ApiClient {
  /** API client configuration */
  public readonly config: ApiClientConfig;
  
  /** Axios instance */
  protected instance: AxiosInstance;
  
  /** Rate limiter */
  protected limiter: Bottleneck;
  
  /** Circuit breaker (if enabled) */
  protected breaker?: CircuitBreaker;
  
  /** Active middleware stack */
  protected middlewareStack: ApiClientMiddleware[];
  
  /** Cache storage interface */
  protected cacheStorage?: any;
  
  /**
   * Create a new API client instance
   * @param userConfig - Custom configuration
   */
  constructor(userConfig: Partial<ApiClientConfig> = {}) {
    // Merge and validate configuration
    const config = this.#mergeConfigs(DEFAULT_CONFIG, userConfig);
    validateConfig(config);
    this.config = config;

    // Set up cache adapter if enabled
    let axiosConfig = this.configureAxios();
    if (this.config.enableCache) {
      // Create storage backend based on configuration
      let storage;
      switch (this.config.cacheStrategy) {
        case 'localStorage':
          storage = {
            getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
            setItem: (key: string, value: string) => {
              window.localStorage.setItem(key, value);
              return Promise.resolve();
            },
            removeItem: (key: string) => {
              window.localStorage.removeItem(key);
              return Promise.resolve();
            },
            clear: () => {
              const cacheKeys = Object.keys(window.localStorage)
                .filter(key => key.startsWith('apiCache_'));
              cacheKeys.forEach(key => window.localStorage.removeItem(key));
              return Promise.resolve();
            },
            length: () => Promise.resolve(
              Object.keys(window.localStorage)
                .filter(key => key.startsWith('apiCache_'))
                .length
            ),
            iterate: (fn: (value: string, key: string) => any) => {
              const cacheKeys = Object.keys(window.localStorage)
                .filter(key => key.startsWith('apiCache_'));
              cacheKeys.forEach(key => {
                const value = window.localStorage.getItem(key);
                if (value) fn(value, key);
              });
              return Promise.resolve();
            }
          };
          break;
        case 'custom':
          storage = this.config.cacheStorage;
          break;
        case 'memory':
        default:
          storage = buildMemoryStorage();
      }
      
      // Configure caching strategy
      const cache = setupCache({ 
        maxAge: this.config.cacheTTL,
        exclude: { 
          query: false,
          methods: ['POST', 'PUT', 'PATCH', 'DELETE']
        },
        clearOnError: true,
        readOnError: (error: AxiosError) => {
          // Return stale cache on network errors
          return error.code === 'ECONNABORTED' || !error.response;
        },
        // Override storage implementation
        storage,
        // Add cache control header support
        interpretHeader: true,
        // Use key generation that includes headers for auth-aware caching
        key: (req: any) => {
          const serializeHeaders = (headers: any) => {
            // Only include cache-relevant headers
            const relevantHeaders = ['accept', 'accept-language', 'authorization'];
            const filtered = Object.keys(headers || {})
              .filter(key => relevantHeaders.includes(key.toLowerCase()))
              .reduce((obj: any, key) => {
                obj[key.toLowerCase()] = headers[key];
                return obj;
              }, {});
            return JSON.stringify(filtered);
          };
          
          return `apiCache_${req.method}_${req.url}_${serializeHeaders(req.headers)}`;
        },
        debug: this.config.debug
      });
      
      // Store cache reference
      this.cacheStorage = cache;
      axiosConfig.adapter = cache.adapter;
    }

    // Create axios instance
    this.instance = axios.create(axiosConfig);
    
    // Set up request/response handling
    this.#configureRetries();
    this.#setupRateLimiting();
    this.#applyInterceptors();

    // Set up circuit breaker if enabled
    if (this.config.enableCircuitBreaker) {
      this.#configureCircuitBreaker();
    }
  }

  /**
   * Merge default and user configurations
   * @private
   */
  #mergeConfigs(defaults, custom) {
    return {
      ...defaults,
      ...custom,
      headers: {
        ...defaults.headers,
        ...custom.headers
      }
    };
  }

  /**
   * Create axios configuration object
   * @private
   */
  #axiosConfig() {
    return {
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.config.headers
      }
    };
  }

  /**
   * Configure request retry behavior
   * @private
   */
  /**
   * Configure request retry behavior
   * @private
   */
  protected configureRetries(): void {
    axiosRetry(this.instance, {
      retries: this.config.retries,
      retryDelay: (retryCount) => 
        this.config.retryDelay * Math.pow(2, retryCount),
      retryCondition: (error: AxiosError) => {
        // Don't retry on client errors (except 408 Request Timeout)
        if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408) {
          return false;
        }
        
        // Don't retry if explicitly marked as non-retryable
        if (error.config?.['retryable'] === false) {
          return false;
        }
        
        // Don't retry mutations unless explicitly marked as retryable
        const method = error.config?.method?.toUpperCase() || 'GET';
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && error.config?.['retryable'] !== true) {
          return false;
        }
        
        // Default retry condition for network errors and server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response && error.response.status >= 500);
      }
    });
  }

  /**
   * Set up rate limiting for outgoing requests
   * @private
   */
  #setupRateLimiting() {
    this.limiter = new Bottleneck({
      maxConcurrent: this.config.maxConcurrent,
      minTime: this.config.requestRateLimit
    });

    // Wrap axios request to use the limiter
    const originalRequest = this.instance.request.bind(this.instance);
    this.instance.request = (config) => {
      return this.limiter.schedule(() => originalRequest(config));
    };
  }

  /**
   * Configure circuit breaker for fault tolerance
   * @private
   */
  #configureCircuitBreaker() {
    this.breaker = new CircuitBreaker(
      (config) => this.instance.request(config),
      {
        timeout: this.config.timeout * 1.5, // Slightly longer than axios timeout
        errorThresholdPercentage: 50,       // Open after 50% failures
        resetTimeout: 30000,                // Try again after 30 seconds
        rollingCountTimeout: 60000,         // 1 minute window for failure rate
        name: 'apiClientCircuitBreaker'
      }
    );

    // Wrap the original request method with circuit breaker
    const originalRequest = this.instance.request.bind(this.instance);
    this.instance.request = (config) => {
      return this.breaker.fire(config);
    };

    // Log circuit state changes
    this.breaker.on('open', () => {
      console.warn('Circuit breaker opened: API service appears to be down');
      metrics.increment('api.circuit_breaker.open');
    });

    this.breaker.on('close', () => {
      console.info('Circuit breaker closed: API service restored');
      metrics.increment('api.circuit_breaker.close');
    });

    this.breaker.on('halfOpen', () => {
      console.info('Circuit breaker half-open: Trying to restore API service');
      metrics.increment('api.circuit_breaker.half_open');
    });
  }

  /**
   * Apply request and response interceptors
   * @private
   */
  /**
   * Apply request and response interceptors
   * @private
   */
  protected applyInterceptors(): void {
    // Initialize middleware stack
    this.middlewareStack = [...this.config.middleware];
    
    // Request interceptor
    this.instance.interceptors.request.use(
      async (config: AxiosRequestConfig) => {
        try {
          // First apply internal request interceptor
          let processedConfig = await this.requestInterceptor(config);
          
          // Then apply middleware stack
          for (const middleware of this.middlewareStack) {
            if (middleware.request) {
              processedConfig = await middleware.request(processedConfig);
            }
          }
          
          return processedConfig;
        } catch (error) {
          throw this.createApplicationError(error as Error);
        }
      },
      error => Promise.reject(this.createApplicationError(error))
    );

    // Response interceptors
    this.instance.interceptors.response.use(
      async (response: AxiosResponse) => {
        try {
          // First apply internal response interceptor
          let processedResponse = await this.responseInterceptor(response);
          
          // Then apply middleware stack in reverse
          for (const middleware of [...this.middlewareStack].reverse()) {
            if (middleware.response) {
              processedResponse = await middleware.response(processedResponse);
            }
          }
          
          return processedResponse;
        } catch (error) {
          throw this.createApplicationError(error as Error);
        }
      },
      async (error: AxiosError) => {
        try {
          // Apply middleware error handlers first
          let processedError = error;
          
          for (const middleware of [...this.middlewareStack].reverse()) {
            if (middleware.error) {
              const result = await middleware.error(processedError);
              
              // If middleware returned a response, short-circuit and return it
              if (result && 'data' in result) {
                return result;
              }
              
              // Otherwise continue with potentially modified error
              processedError = result as AxiosError;
            }
          }
          
          // Then apply internal error handler
          return this.responseErrorHandler(processedError);
        } catch (handlerError) {
          // If error handling itself failed, create application error
          throw this.createApplicationError(handlerError as Error);
        }
      }
    );
  }

  /**
   * Request interceptor to handle authentication and tracing
   * @private
   */
  async #requestInterceptor(config) {
    try {
      // Generate unique request ID for tracing
      const requestId = uuid();
      config.headers['X-Request-ID'] = requestId;
      
      // Store metadata for metrics
      config.metadata = { 
        requestId, 
        startTime: Date.now(),
        retryCount: config.axiosRetry?.retryCount || 0
      };

      // Add authentication token if endpoint is secure
      const token = await this.config.getAuthToken();
      if (token && this.#isSecureEndpoint(config.url)) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log outgoing request
      console.debug(`[${requestId}] ${config.method?.toUpperCase() || 'GET'} ${config.url}`);
      
      return config;
    } catch (error) {
      throw this.#createApplicationError('Request preparation failed', {
        originalError: error,
        context: { url: config.url }
      });
    }
  }

  /**
   * Response interceptor for successful responses
   * @private
   */
  #responseInterceptor(response) {
    const { requestId, startTime } = response.config.metadata || {};
    const duration = Date.now() - (startTime || Date.now());
    
    // Log successful response
    console.debug(`[${requestId}] ${response.config.method?.toUpperCase() || 'GET'} ${response.config.url} → ${response.status} in ${duration}ms`);
    
    // Record metrics
    metrics.record('api.request.duration', duration, {
      path: response.config.url,
      method: response.config.method,
      status: response.status
    });
    
    return response;
  }

  /**
   * Check if endpoint requires secure communication
   * @private
   */
  #isSecureEndpoint(url) {
    // Either HTTPS or not an absolute URL (relative to base which is presumably secure)
    try {
      return !url.startsWith('http') || 
        new URL(url, this.config.baseURL).protocol === 'https:';
    } catch (e) {
      // If URL parsing fails, default to secure
      return true;
    }
  }

  /**
   * Create standardized application error
   * @private
   */
  #createApplicationError(message, details = {}) {
    if (message instanceof Error) {
      details.originalError = message;
      message = message.message || 'Unknown error';
    }
    
    return new ApplicationError(message, {
      statusCode: details.statusCode,
      originalError: details.originalError,
      context: details.context,
      validationErrors: details.validationErrors,
      isRetryable: details.isRetryable !== false
    });
  }

  /**
   * Handle response errors with token refresh capability
   * @private
   */
  async #responseErrorHandler(error) {
    const { requestId, startTime, retryCount } = error.config?.metadata || {};
    const duration = Date.now() - (startTime || Date.now());
    
    // Handle authentication errors with token refresh
    if (error.response?.status === 401 && 
        this.config.refreshToken && 
        !error.config._tokenRefreshed) {
      try {
        // Attempt to refresh the token
        console.debug(`[${requestId}] Refreshing auth token after 401 response`);
        const newToken = await this.config.refreshToken();
        
        // Retry original request with new token
        error.config._tokenRefreshed = true;
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return this.instance.request(error.config);
      } catch (refreshError) {
        console.error(`[${requestId}] Token refresh failed`, refreshError);
        metrics.increment('api.auth.refresh_failed');
      }
    }
    
    // Log the error
    console.error(
      `[${requestId}] ${error.config?.method?.toUpperCase() || 'GET'} ${error.config?.url} → ${error.response?.status || 'NETWORK_ERROR'} in ${duration}ms`,
      error.response?.data
    );
    
    // Record metrics
    metrics.increment('api.request.error', { 
      path: error.config?.url,
      method: error.config?.method,
      status: error.response?.status || 'NETWORK_ERROR',
      retryCount
    });

    // Create standardized error
    const errorPayload = {
      message: error.response?.data?.message || 'API request failed',
      statusCode: error.response?.status,
      originalError: error,
      context: {
        url: error.config?.url,
        method: error.config?.method,
        requestId,
        duration,
        retryCount
      }
    };

    // Include validation errors if present
    if (error.response?.data?.validationErrors) {
      errorPayload.validationErrors = error.response.data.validationErrors;
    }

    return Promise.reject(this.#createApplicationError(errorPayload.message, errorPayload));
  }

  /**
   * Make a GET request with cancellation support
   * @param url - Endpoint URL
   * @param params - Query parameters
   * @param config - Axios request config
   * @returns Promise with cancel method and response data
   */
  get<T = any>(
    url: string, 
    params: Record<string, any> = {}, 
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    const controller = new AbortController();
    
    const promise = this.instance.get<T>(url, {
      ...config,
      params,
      signal: controller.signal
    }).then(response => this.formatResponse<T>(response));
    
    // Add cancel method to promise
    (promise as any).cancel = () => controller.abort();
    
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }
  
  /**
   * Format the raw axios response to our standard ApiResponse format
   * @param response - Axios response object
   * @returns Standardized API response with metadata
   */
  protected formatResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    const { requestId, startTime, retryCount } = response.config?.metadata || {};
    const duration = Date.now() - (startTime || Date.now());
    
    // Extract headers into a plain object
    const headers: Record<string, string> = {};
    Object.entries(response.headers || {}).forEach(([key, value]) => {
      headers[key] = String(value);
    });
    
    // Build response metadata
    const meta: ResponseMetadata = {
      duration,
      requestId: requestId || 'unknown',
      retryCount: retryCount || 0,
      cacheHit: response.request?.fromCache || false,
      headers
    };
    
    return {
      data: response.data,
      meta
    };
  }

  /**
   * Make a POST request with cancellation support
   * @param url - Endpoint URL
   * @param data - Request body
   * @param config - Axios request config
   * @returns Promise with cancel method and response data
   */
  post<T = any, D = any>(
    url: string, 
    data: D = {} as D, 
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    const controller = new AbortController();
    
    const promise = this.instance.post<T>(url, data, {
      ...config,
      signal: controller.signal
    }).then(response => this.formatResponse<T>(response));
    
    // Add cancel method to promise
    (promise as any).cancel = () => controller.abort();
    
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }
  
  /**
   * Execute a GraphQL query
   * @param request - GraphQL request configuration
   * @param config - Additional axios request config
   * @returns Promise with response data and metadata
   */
  graphql<T = any, V = Record<string, any>>(
    request: GraphQLRequest<V>,
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    if (!this.config.graphQLEndpoint) {
      throw new Error('GraphQL endpoint not configured. Set config.graphQLEndpoint');
    }
    
    const controller = new AbortController();
    
    // Default to query if not specified
    const type = request.type || GraphQLOperationType.Query;
    
    // Set up additional headers for GraphQL
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Operation-Type': type,
      ...(request.operationName ? { 'X-Operation-Name': request.operationName } : {})
    };
    
    // Prepare the request payload
    const gqlPayload = {
      query: request.query,
      variables: request.variables || {},
      operationName: request.operationName
    };
    
    // For GET requests (queries), encode as URL parameters
    if (type === GraphQLOperationType.Query && !config.method) {
      const queryParams = {
        query: gqlPayload.query,
        variables: JSON.stringify(gqlPayload.variables),
        operationName: gqlPayload.operationName
      };
      
      const promise = this.get<{ data: T; errors?: any[] }>(
        this.config.graphQLEndpoint,
        queryParams,
        {
          ...config,
          headers: { ...headers, ...config.headers }
        }
      ).then(response => {
        // Handle GraphQL errors
        if (response.data.errors && response.data.errors.length > 0) {
          const error = new Error(response.data.errors[0].message);
          (error as any).graphQLErrors = response.data.errors;
          throw error;
        }
        
        return {
          data: response.data.data,
          meta: response.meta
        };
      });
      
      (promise as any).cancel = () => controller.abort();
      return promise as Promise<ApiResponse<T>> & { cancel: () => void };
    }
    
    // For mutations and explicit POST requests, use POST
    const promise = this.post<{ data: T; errors?: any[] }>(
      this.config.graphQLEndpoint,
      gqlPayload,
      {
        ...config,
        method: 'POST',
        headers: { ...headers, ...config.headers },
        signal: controller.signal
      }
    ).then(response => {
      // Handle GraphQL errors
      if (response.data.errors && response.data.errors.length > 0) {
        const error = new Error(response.data.errors[0].message);
        (error as any).graphQLErrors = response.data.errors;
        throw error;
      }
      
      return {
        data: response.data.data,
        meta: response.meta
      };
    });
    
    (promise as any).cancel = () => controller.abort();
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }

  /**
   * Make a PUT request with cancellation support
   * @param url - Endpoint URL
   * @param data - Request body
   * @param config - Axios request config
   * @returns Promise with cancel method and response data
   */
  put<T = any, D = any>(
    url: string, 
    data: D = {} as D, 
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    const controller = new AbortController();
    
    const promise = this.instance.put<T>(url, data, {
      ...config,
      signal: controller.signal
    }).then(response => this.formatResponse<T>(response));
    
    (promise as any).cancel = () => controller.abort();
    
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }

  /**
   * Make a PATCH request with cancellation support
   * @param url - Endpoint URL
   * @param data - Request body
   * @param config - Axios request config
   * @returns Promise with cancel method and response data
   */
  patch<T = any, D = any>(
    url: string, 
    data: D = {} as D, 
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    const controller = new AbortController();
    
    const promise = this.instance.patch<T>(url, data, {
      ...config,
      signal: controller.signal
    }).then(response => this.formatResponse<T>(response));
    
    (promise as any).cancel = () => controller.abort();
    
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }

  /**
   * Make a DELETE request with cancellation support
   * @param url - Endpoint URL
   * @param config - Axios request config
   * @returns Promise with cancel method and response data
   */
  delete<T = any>(
    url: string, 
    config: AxiosRequestConfig = {}
  ): Promise<ApiResponse<T>> & { cancel: () => void } {
    const controller = new AbortController();
    
    const promise = this.instance.delete<T>(url, {
      ...config,
      signal: controller.signal
    }).then(response => this.formatResponse<T>(response));
    
    (promise as any).cancel = () => controller.abort();
    
    return promise as Promise<ApiResponse<T>> & { cancel: () => void };
  }
  
  /**
   * Execute multiple requests concurrently with automatic batching
   * @param requests - Array of request configurations
   * @param options - Batch options
   * @returns Array of responses or error objects in same order as requests
   */
  async batch<T extends any[]>(
    requests: Array<{
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      url: string;
      data?: any;
      params?: Record<string, any>;
      config?: AxiosRequestConfig;
    }>,
    options: {
      /** Continue on error for individual requests */
      continueOnError?: boolean;
      /** Number of concurrent requests to execute */
      concurrency?: number;
      /** Abort all requests if any fails */
      abortOnError?: boolean;
      /** Request timeout overriding the client default */
      timeout?: number;
    } = {}
  ): Promise<Array<ApiResponse<T[number]> | Error>> {
    const {
      continueOnError = true,
      concurrency = this.config.maxConcurrent,
      abortOnError = false,
      timeout = this.config.timeout
    } = options;

    // Create an abort controller to potentially cancel all requests
    const controller = new AbortController();
    
    // Function to execute a single request
    const executeRequest = async (
      request: typeof requests[number], 
      index: number
    ): Promise<{ index: number; result: ApiResponse<any> | Error }> => {
      try {
        // Add the controller signal to the request config
        const requestConfig = {
          ...request.config,
          signal: controller.signal,
          timeout
        };
        
        let result;
        switch (request.method) {
          case 'get':
            result = await this.get(request.url, request.params || {}, requestConfig);
            break;
          case 'post':
            result = await this.post(request.url, request.data || {}, requestConfig);
            break;
          case 'put':
            result = await this.put(request.url, request.data || {}, requestConfig);
            break;
          case 'patch':
            result = await this.patch(request.url, request.data || {}, requestConfig);
            break;
          case 'delete':
            result = await this.delete(request.url, requestConfig);
            break;
          default:
            throw new Error(`Unsupported method: ${request.method}`);
        }
        
        return { index, result };
      } catch (error) {
        // If abortOnError is true, cancel all pending requests
        if (abortOnError) {
          controller.abort();
        }
        
        // If continueOnError, return the error; otherwise throw
        if (continueOnError) {
          return { index, result: error as Error };
        }
        throw error;
      }
    };

    // Execute the requests with concurrency limit
    const results: Array<{ index: number; result: ApiResponse<any> | Error }> = [];
    const batchSize = Math.min(concurrency, requests.length);
    
    // Process in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests
        .slice(i, i + batchSize)
        .map((request, batchIndex) => executeRequest(request, i + batchIndex));
      
      results.push(...await Promise.all(batch));
    }
    
    // Sort the results back into the original order
    return results
      .sort((a, b) => a.index - b.index)
      .map(item => item.result);
  }
}

// Create singleton instance with default configuration
// Additional utility methods for client management

/**
 * Register a middleware with the client
 * @param middleware - Middleware implementation
 * @returns Function to unregister the middleware
 */
public registerMiddleware(middleware: ApiClientMiddleware): () => void {
  // Don't register duplicates
  if (this.middlewareStack.some(m => m.id === middleware.id)) {
    throw new Error(`Middleware with id '${middleware.id}' already registered`);
  }
  
  this.middlewareStack.push(middleware);
  this.config.logger.debug(`Middleware registered: ${middleware.id}`);
  
  // Return function to unregister
  return () => {
    this.middlewareStack = this.middlewareStack.filter(m => m.id !== middleware.id);
    this.config.logger.debug(`Middleware unregistered: ${middleware.id}`);
  };
}

/**
 * Invalidate cache entries matching the pattern
 * @param urlPattern - URL pattern to match for invalidation
 */
public invalidateCache(urlPattern: string | RegExp): Promise<void> {
  if (!this.config.enableCache || !this.cacheStorage) {
    return Promise.resolve();
  }
  
  return new Promise<void>((resolve) => {
    // If pattern is a string, convert to regex that matches anywhere in URL
    const pattern = typeof urlPattern === 'string' 
      ? new RegExp(urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\export const defaultApiClient = new ApiClient();'))
      : urlPattern;
    
    this.cacheStorage.store.iterate((value: any, key: string) => {
      // Extract URL from key (format: apiCache_METHOD_URL_HEADERS)
      const parts = key.split('_');
      if (parts.length >= 3) {
        const url = parts[2]; // URL is the third part
        if (pattern.test(url)) {
          this.cacheStorage.store.removeItem(key);
        }
      }
    });
    
    resolve();
  });
}

/**
 * Clear all cached responses
 */
public clearCache(): Promise<void> {
  if (!this.config.enableCache || !this.cacheStorage) {
    return Promise.resolve();
  }
  
  return this.cacheStorage.store.clear();
}

/**
 * Creates a derived client with specific configuration
 * Useful for creating service-specific clients
 * @param config - Configuration overrides
 */
public derive(config: Partial<ApiClientConfig>): ApiClient {
  return new ApiClient({
    ...this.config,
    ...config,
    // Merge headers instead of replacing
    headers: {
      ...this.config.headers,
      ...config.headers
    },
    // Combine middleware
    middleware: [
      ...this.middlewareStack,
      ...(config.middleware || [])
    ]
  });
}

/**
 * Get cache statistics
 */
public getCacheStats(): Promise<{ size: number; hits: number; misses: number }> {
  if (!this.config.enableCache || !this.cacheStorage) {
    return Promise.resolve({ size: 0, hits: 0, misses: 0 });
  }
  
  return this.cacheStorage.store.length().then((size: number) => {
    return {
      size,
      hits: (this.cacheStorage as any).stats?.hits || 0,
      misses: (this.cacheStorage as any).stats?.misses || 0
    };
  });
}

// Create singleton instance with default configuration
export const defaultApiClient = new ApiClient();