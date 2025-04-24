import { 
  NetworkMonitor, 
  NetworkRequest, 
  Tab, 
  Severity, 
  ApiCallData,
  InterceptorOptions,
  NetworkMetrics,
  ApiTracingContext,
  SanitizationRules,
  RequestProcessor,
  ResponseProcessor,
  ApiCall,
  ApiCallChain
} from './debugTypes';
import { DebugLogger } from './DebugLogger';


/**
 * Enterprise Network Monitoring Configuration
 */
export interface NetworkMonitorConfig {
  /** Maximum number of requests to store (circular buffer) */
  maxRequests?: number;
  /** Sensitive data redaction rules */
  sanitization?: SanitizationRules;
  /** Performance monitoring thresholds */
  performanceThresholds?: {
    slowRequest?: number;
    largeResponse?: number;
    errorRate?: number;
    timeoutThreshold?: number;
  };
  /** Sampling rate for production monitoring (0-1) */
  samplingRate?: number;
  /** Enable API call chain tracing */
  enableCallChaining?: boolean;
  /** Retention policy for network requests (in milliseconds) */
  retentionPeriod?: number;
  /** Custom request/response processors */
  processors?: {
    request?: RequestProcessor[];
    response?: ResponseProcessor[];
  };
  /** Default timeout for requests (ms) */
  defaultTimeout?: number;
  /** Circuit breaker settings */
  circuitBreaker?: {
    /** Number of errors before breaking the circuit */
    errorThreshold?: number;
    /** Time window (ms) to calculate error rate */
    windowSize?: number; 
    /** Duration (ms) to keep circuit open before trying again */
    resetTimeout?: number;
  };
  /** Enable browser performance timing API integration */
  enablePerformanceTimingIntegration?: boolean;
  /** Enable OpenTelemetry integration */
  enableOpenTelemetry?: boolean;
  /** Enable browser compression detection */
  detectCompression?: boolean;
  /** Monitor memory usage of parsed responses */
  monitorResponseMemory?: boolean;
}

/**
 * Enhanced API Tracer for monitoring network calls with parent-child relationships
 */
export class ApiTracer {
  private apiCalls: Map<string, ApiCallData> = new Map();
  private activeContext: ApiTracingContext | null = null;
  private rootCalls: Set<string> = new Set();
  private callsByAction: Map<string, Set<string>> = new Map();
  private sanitizationRules: SanitizationRules;
  private pendingCalls: Set<string> = new Set();
  private contextStack: ApiTracingContext[] = [];

  constructor(sanitizationRules: SanitizationRules) {
    this.sanitizationRules = sanitizationRules;
  }

  /**
   * Start a new API call trace
   */
  startApiCall(url: string, method: string, payload?: unknown, headers?: Record<string, string>): string {
    const callId = crypto.randomUUID();
    const parentCallId = this.activeContext?.callId;
    const actionId = this.activeContext?.actionId || 'unknown';
    
    // If there's no parent, this is a root call
    if (!parentCallId) {
      this.rootCalls.add(callId);
    }
    
    // Add call to the action tracking
    if (!this.callsByAction.has(actionId)) {
      this.callsByAction.set(actionId, new Set());
    }
    this.callsByAction.get(actionId)?.add(callId);
    
    // Create the call data with sanitized inputs
    const callData: ApiCallData = {
      callId,
      parentCallId,
      actionId,
      url: this.sanitizeUrl(url),
      method,
      startTime: performance.now(),
      request: {
        headers: this.sanitizeHeaders(headers || {}),
        payload: this.sanitizePayload(payload)
      },
      status: 'pending',
      children: [],
      depth: parentCallId ? (this.apiCalls.get(parentCallId)?.depth || 0) + 1 : 0,
      performanceEntries: [],
      stackTrace: this.captureStackTrace()
    };
    
    // Store the call data
    this.apiCalls.set(callId, callData);
    this.pendingCalls.add(callId);
    
    // If this call has a parent, add this call as a child of the parent
    if (parentCallId && this.apiCalls.has(parentCallId)) {
      const parentCall = this.apiCalls.get(parentCallId);
      if (parentCall) {
        parentCall.children.push(callId);
      }
    }
    
    // Set up performance observer for this call if supported
    this.setupPerformanceObserver(callId, url);
    
    return callId;
  }

  /**
   * Push a new context onto the stack and make it active
   */
  pushContext(actionId: string, actionType?: string): ApiTracingContext {
    const context: ApiTracingContext = {
      callId: crypto.randomUUID(),
      actionId,
      actionType,
      startTime: performance.now()
    };
    
    this.contextStack.push(context);
    this.activeContext = context;
    
    return context;
  }

  /**
   * Pop the current context from the stack
   */
  popContext(): ApiTracingContext | null {
    const poppedContext = this.contextStack.pop() || null;
    this.activeContext = this.contextStack.length > 0 
      ? this.contextStack[this.contextStack.length - 1] 
      : null;
    
    return poppedContext;
  }

  /**
   * Complete an API call with response data
   */
  completeApiCall(callId: string, response: any, status: number, headers?: Record<string, string>): void {
    if (!this.apiCalls.has(callId)) return;
    
    const callData = this.apiCalls.get(callId)!;
    const endTime = performance.now();
    const duration = endTime - callData.startTime;
    
    // Update the call data
    callData.endTime = endTime;
    callData.duration = duration;
    callData.status = 'completed';
    callData.response = {
      status,
      headers: this.sanitizeHeaders(headers || {}),
      body: this.sanitizePayload(response),
      size: this.estimateResponseSize(response)
    };
    
    this.pendingCalls.delete(callId);
    this.apiCalls.set(callId, callData);
  }

  /**
   * Mark an API call as failed
   */
  failApiCall(callId: string, error: Error): void {
    if (!this.apiCalls.has(callId)) return;
    
    const callData = this.apiCalls.get(callId)!;
    const endTime = performance.now();
    const duration = endTime - callData.startTime;
    
    // Update the call data
    callData.endTime = endTime;
    callData.duration = duration;
    callData.status = 'failed';
    callData.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
    
    this.pendingCalls.delete(callId);
    this.apiCalls.set(callId, callData);
  }

  /**
   * Get all API calls
   */
  getApiCalls(): ApiCallData[] {
    return Array.from(this.apiCalls.values());
  }

  /**
   * Get root API calls (calls with no parent)
   */
  getRootCalls(): ApiCallData[] {
    return Array.from(this.rootCalls)
      .map(callId => this.apiCalls.get(callId))
      .filter(Boolean) as ApiCallData[];
  }

  /**
   * Get API calls grouped by user action
   */
  getCallsByAction(): Map<string, ApiCallData[]> {
    const result = new Map<string, ApiCallData[]>();
    
    for (const [actionId, callIds] of this.callsByAction.entries()) {
      const calls = Array.from(callIds)
        .map(callId => this.apiCalls.get(callId))
        .filter(Boolean) as ApiCallData[];
      
      result.set(actionId, calls);
    }
    
    return result;
  }

  /**
   * Get the complete call chain for a given API call
   */
  getCallChain(rootCallId: string): ApiCallChain {
    const rootCall = this.apiCalls.get(rootCallId);
    if (!rootCall) {
      return { call: null, children: [] };
    }
    
    return this.buildCallChainRecursive(rootCallId);
  }

  /**
   * Recursively build the call chain for a given call ID
   */
  private buildCallChainRecursive(callId: string): ApiCallChain {
    const call = this.apiCalls.get(callId);
    if (!call) {
      return { call: null, children: [] };
    }
    
    const children = call.children.map(childId => 
      this.buildCallChainRecursive(childId)
    );
    
    return {
      call,
      children
    };
  }

  /**
   * Export API call data to HAR format
   */
  exportToHAR(): string {
    const entries = Array.from(this.apiCalls.values()).map(call => {
      return {
        startedDateTime: new Date(Date.now() - (performance.now() - call.startTime)).toISOString(),
        time: call.duration || 0,
        request: {
          method: call.method,
          url: call.url,
          headers: Object.entries(call.request.headers || {}).map(([name, value]) => ({ name, value })),
          postData: call.request.payload ? {
            mimeType: "application/json",
            text: JSON.stringify(call.request.payload)
          } : undefined
        },
        response: call.response ? {
          status: call.response.status,
          headers: Object.entries(call.response.headers || {}).map(([name, value]) => ({ name, value })),
          content: {
            size: call.response.size || 0,
            mimeType: "application/json",
            text: JSON.stringify(call.response.body)
          }
        } : {
          status: 0,
          statusText: "Error",
          content: {
            size: 0,
            mimeType: "text/plain",
            text: call.error?.message || "Unknown error"
          }
        },
        cache: {},
        timings: {
          send: 0,
          wait: call.duration || 0,
          receive: 0
        },
        _resourceType: "xhr",
        _callId: call.callId,
        _parentCallId: call.parentCallId
      };
    });
    
    const har = {
      log: {
        version: "1.2",
        creator: {
          name: "EnterpriseNetworkMonitor",
          version: "2.0.0"
        },
        pages: [],
        entries
      }
    };
    
    return JSON.stringify(har, null, 2);
  }

  /**
   * Calculate and sanitize URL
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      
      // Sanitize query parameters
      this.sanitizationRules.urlParams?.forEach(param => {
        if (parsedUrl.searchParams.has(param)) {
          parsedUrl.searchParams.set(param, '[REDACTED]');
        }
      });
      
      return parsedUrl.toString();
    } catch (e) {
      // If URL parsing fails, return as is
      return url;
    }
  }

  /**
   * Sanitize request/response headers
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    this.sanitizationRules.headers?.forEach(header => {
      const headerLower = header.toLowerCase();
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase() === headerLower) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });
    
    return sanitized;
  }

  /**
   * Sanitize request/response payload
   */
  private sanitizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    
    // For FormData, create a sanitized version
    if (payload instanceof FormData) {
      const sanitizedFormData = new FormData();
      for (const [key, value] of (payload as FormData).entries()) {
        if (this.sanitizationRules.bodyFields?.includes(key)) {
          sanitizedFormData.append(key, '[REDACTED]');
        } else {
          sanitizedFormData.append(key, value);
        }
      }
      return sanitizedFormData;
    }
    
    // For regular objects
    try {
      // First convert to JSON to handle circular references
      const jsonStr = JSON.stringify(payload);
      const obj = JSON.parse(jsonStr);
      
      // Now sanitize the object
      return this.sanitizeObject(obj);
    } catch (e) {
      // If JSON conversion fails, return a placeholder
      return { _sanitized: true, _original: typeof payload };
    }
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.sanitizationRules.bodyFields?.some(field => 
        field === key || 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Estimate the size of a response in bytes
   */
  private estimateResponseSize(response: unknown): number {
    if (!response) return 0;
    
    try {
      const json = JSON.stringify(response);
      return new Blob([json]).size;
    } catch (e) {
      // If we can't stringify it, make a best guess
      return typeof response === 'string' 
        ? new Blob([response]).size 
        : 1024; // Arbitrary fallback size
    }
  }

  /**
   * Capture current stack trace
   */
  private captureStackTrace(): string {
    try {
      throw new Error('Trace capture');
    } catch (e) {
      return e.stack?.split('\n').slice(2).join('\n') || '';
    }
  }
  
  /**
   * Set up performance observer for a call
   */
  private setupPerformanceObserver(callId: string, url: string): void {
    try {
      // Only set up if the Performance API is available
      if (!window.PerformanceObserver) return;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries().filter(entry => {
          // Match the URL (simplified - in practice would need more robust matching)
          return entry.name.includes(new URL(url).pathname);
        });
        
        if (entries.length && this.apiCalls.has(callId)) {
          const call = this.apiCalls.get(callId)!;
          call.performanceEntries = entries.map(entry => ({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration
          }));
          this.apiCalls.set(callId, call);
        }
      });
      
      observer.observe({ entryTypes: ['resource'] });
      
      // Clean up observer after a reasonable timeout
      setTimeout(() => observer.disconnect(), 10000);
    } catch (e) {
      // Fail silently if Performance API is not available or errors
    }
  }
}

/**
 * Enterprise-grade network monitoring solution with advanced analytics,
 * security controls, and performance monitoring capabilities.
 */
export class EnterpriseNetworkMonitor implements NetworkMonitor {
  private requests: NetworkRequest[] = [];
  private logger: DebugLogger;
  private apiTracer: ApiTracer;
  private config: Required<NetworkMonitorConfig>;
  private metrics: NetworkMetrics = {
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    totalBytes: 0,
    errorRate: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Number.MAX_SAFE_INTEGER,
    p95ResponseTime: 0,
    requestsPerMinute: 0,
    bytesPerSecond: 0,
    activeRequests: 0
  };
  private interceptors: { remove: () => void }[] = [];
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private errorWindow: { timestamp: number, url: string }[] = [];
  private circuitResetTimeout: number | null = null;
  private requestTimestamps: number[] = [];
  private metricsListeners: ((metrics: NetworkMetrics) => void)[] = [];
  private metricsUpdateInterval: number | null = null;
  private retentionCheckInterval: number | null = null;
  private originalFetch: typeof fetch;
  private originalXHR: typeof XMLHttpRequest;
  private activeUserAction: string | null = null;

  private static readonly DEFAULT_CONFIG: Required<NetworkMonitorConfig> = {
    maxRequests: 1000,
    sanitization: {
      headers: ['authorization', 'cookie', 'x-api-key', 'api-key', 'token'],
      urlParams: ['token', 'password', 'apiKey', 'key', 'secret'],
      bodyFields: ['password', 'creditCard', 'ssn', 'secret', 'token', 'apiKey']
    },
    performanceThresholds: {
      slowRequest: 2000,
      largeResponse: 1024 * 1024, // 1MB
      errorRate: 0.1, // 10%
      timeoutThreshold: 10000 // 10s
    },
    samplingRate: 1.0,
    enableCallChaining: true,
    retentionPeriod: 30 * 60 * 1000, // 30 minutes
    processors: {
      request: [],
      response: []
    },
    defaultTimeout: 30000, // 30 seconds
    circuitBreaker: {
      errorThreshold: 5,
      windowSize: 60000, // 1 minute
      resetTimeout: 30000 // 30 seconds
    },
    enablePerformanceTimingIntegration: true,
    enableOpenTelemetry: false,
    detectCompression: true,
    monitorResponseMemory: true
  };

  constructor(config: NetworkMonitorConfig = {}) {
    this.config = this.mergeConfig(EnterpriseNetworkMonitor.DEFAULT_CONFIG, config);
    this.logger = DebugLogger.getInstance();
    this.apiTracer = new ApiTracer(this.config.sanitization);
    this.validateConfig();
    
    // Store original window functions for later restoration
    this.originalFetch = window.fetch;
    this.originalXHR = window.XMLHttpRequest;
    
    // Start metrics updates and retention checks
    this.startMetricsUpdates();
    this.startRetentionChecks();
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(defaultConfig: Required<NetworkMonitorConfig>, userConfig: NetworkMonitorConfig): Required<NetworkMonitorConfig> {
    const result = { ...defaultConfig };
    
    // Merge top-level properties
    for (const key of Object.keys(userConfig) as Array<keyof NetworkMonitorConfig>) {
      const value = userConfig[key];
      
      if (value === undefined) continue;
      
      if (key === 'sanitization' && value) {
        result.sanitization = {
          ...defaultConfig.sanitization,
          ...value
        };
      } else if (key === 'performanceThresholds' && value) {
        result.performanceThresholds = {
          ...defaultConfig.performanceThresholds,
          ...value
        };
      } else if (key === 'processors' && value) {
        result.processors = {
          request: [...(value.request || [])],
          response: [...(value.response || [])]
        };
      } else if (key === 'circuitBreaker' && value) {
        result.circuitBreaker = {
          ...defaultConfig.circuitBreaker,
          ...value
        };
      } else {
        (result as any)[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Validate configuration on initialization
   * @throws Error for invalid configuration
   */
  private validateConfig(): void {
    if (this.config.maxRequests < 100) {
      throw new Error('NetworkMonitor: maxRequests must be at least 100');
    }
    if (this.config.samplingRate <= 0 || this.config.samplingRate > 1) {
      throw new Error('NetworkMonitor: samplingRate must be between 0 and 1');
    }
    if (this.config.performanceThresholds.slowRequest <= 0) {
      throw new Error('NetworkMonitor: slowRequest threshold must be positive');
    }
    if (this.config.defaultTimeout <= 0) {
      throw new Error('NetworkMonitor: defaultTimeout must be positive');
    }
  }

  /**
   * Track a new network request with enhanced security and context
   */
  trackRequest(url: string, method: string, payload?: unknown, headers?: Record<string, string>): string {
    // Check if we should sample this request
    if (Math.random() > this.config.samplingRate) {
      // Return a fake ID for non-sampled requests to maintain API
      return crypto.randomUUID();
    }
    
    // Check circuit breaker status
    if (this.circuitState === 'open') {
      const parsedUrl = new URL(url, window.location.origin);
      const hostname = parsedUrl.hostname;
      
      // Check if this host has triggered the circuit breaker
      if (this.isHostInErrorWindow(hostname)) {
        this.logger.log(
          Tab.Network,
          `Request blocked by circuit breaker: ${method} ${url}`,
          { url, method, circuitState: this.circuitState },
          Severity.Warn
        );
        
        // Return an ID but don't actually track the request
        return uuidv4();
      }
    }
    
    const requestId = this.apiTracer.startApiCall(url, method, payload, headers);
    
    try {
      const requestObj: NetworkRequest = {
        id: requestId,
        url: this.sanitizeUrl(url),
        method: method.toUpperCase(),
        timestamp: Date.now(),
        status: 'pending',
        payload: this.sanitizePayload(payload),
        headers: this.sanitizeHeaders(headers || {}),
        context: {
          userAgent: navigator.userAgent,
          sessionId: this.getSessionId(),
          correlationId: this.getCorrelationId(),
          userAction: this.activeUserAction
        }
      };
      
      // Apply request processors
      const processedRequest = this.applyRequestProcessors(requestObj);
      
      this.storeRequest(processedRequest);
      this.logRequestStart(processedRequest);
      
      // Update metrics
      this.metrics.activeRequests++;
      this.requestTimestamps.push(Date.now());
      this.updateMetrics();
    } catch (error) {
      this.logger.log(
        Tab.Network,
        `Error tracking request: ${error.message}`,
        { url, method, error },
        Severity.Error
      );
    }
    
    return requestId;
  }

  /**
   * Update an existing request with partial data
   */
  updateRequest(requestId: string, updates: Partial<NetworkRequest>): void {
    const index = this.requests.findIndex(r => r.id === requestId);
    
    if (index !== -1) {
      this.requests[index] = {
        ...this.requests[index],
        ...updates
      };
      
      // Log significant updates
      if (updates.status) {
        this.logger.log(
          Tab.Network,
          `Request status updated: ${updates.status}`,
          { requestId, updates },
          updates.status === 'error' ? Severity.Error : Severity.Info
        );
      }
    }
  }

  /**
   * Mark a request as completed successfully
   */
  completeRequest(requestId: string, response: any, statusCode: number, responseTime: number, headers?: Record<string, string>): void {
    const index = this.requests.findIndex(r => r.id === requestId);
    
    if (index !== -1) {
      const request = this.requests[index];
      const url = request.url;
      const method = request.method;
      
      // Apply response processors
      const processedResponse = this.applyResponseProcessors(response, request);
      
      // Calculate compression ratio if enabled
      let compressionInfo = undefined;
      if (this.config.detectCompression && headers) {
        compressionInfo = this.calculateCompressionInfo(headers, processedResponse);
      }
      
      // Update the request with response data
      this.requests[index] = {
        ...request,
        status: 'success',
        statusCode,
        responseTime,
        response: processedResponse,
        responseHeaders: this.sanitizeHeaders(headers || {}),
        size: this.calculateResponseSize(processedResponse),
        compressionInfo
      };
      
      // Complete the API call
      this.apiTracer.completeApiCall(requestId, processedResponse, statusCode, headers);
      
      // Log the successful completion
      this.logSuccessfulCompletion(this.requests[index]);
      
      // Update metrics
      this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1);
      this.metrics.successCount++;
      this.metrics.totalRequests++;
      this.metrics.totalBytes += this.requests[index].size || 0;
      this.updateResponseTimeMetrics(responseTime);
      this.updateMetrics();
      
      // Check for performance concerns
      this.checkPerformanceConcerns(this.requests[index]);
    }
  }

  /**
   * Mark a request as failed
   */
  failRequest(requestId: string, error: any): void {
    const index = this.requests.findIndex(r => r.id === requestId);
    
    if (index !== -1) {
      const request = this.requests[index];
      const url = request.url;
      const method = request.method;
      
      // Update the request with error data
      this.requests[index] = {
        ...request,
        status: 'error',
        error: {
          message: error?.message || String(error),
          stack: error?.stack,
          name: error?.name
        }
      };
      
      // Complete the API call with error
      this.apiTracer.failApiCall(requestId, error instanceof Error ? error : new Error(String(error)));
      
      // Add to error window for circuit breaker
      this.addToErrorWindow(url);
      
      // Log the failure
      this.logFailure(this.requests[index]);
      
      // Update metrics
      this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1);
      this.metrics.errorCount++;
      this.metrics.totalRequests++;
      this.metrics.errorRate = this.metrics.errorCount / this.metrics.totalRequests;
      this.updateMetrics();
      
      // Check circuit breaker
      this.checkCircuitBreaker();
      
      // Add fix suggestions
      this.suggestErrorFixes(this.requests[index]);
    }
  }

  /**
   * Start tracking user actions
   */
  startUserAction(actionId: string, actionType?: string): void {
    this.activeUserAction = actionId;
    this.apiTracer.pushContext(actionId, actionType);
  }

  /**
   * End tracking user actions
   */
  endUserAction(): void {
    this.activeUserAction = null;
    this.apiTracer.popContext();
  }

  /**
   * Get all tracked requests
   */
  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  /**
   * Get a specific request by ID
   */
  getRequest(requestId: string): NetworkRequest | undefined {
    return this.requests.find(r => r.id === requestId);
  }

  /**
   * Clear all tracked requests
   */
  clearRequests(): void {
    this.requests = [];
    this.updateMetrics();
  }

  /**
   * Get requests filtered by status
   */
  getRequestsByStatus(status: 'pending' | 'success' | 'error'): NetworkRequest[] {
    return this.requests.filter(r => r.status === status);
  }

  /**
   * Calculate average response time for successful requests
   */
  getAverageResponseTime(): number {
    return this.metrics.avgResponseTime;
  }

  /**
   * Get API call chains
   */
  getApiCallChains() {
    return this.apiTracer.getRootCalls().map(rootCall => {
      return {
        rootCall,
        chain: this.apiTracer.getCallChain(rootCall.callId)
      };
    });
  }

  /**
   * Get API calls grouped by user action
   */
  getApiCallsByUserAction() {
    return this.apiTracer.getCallsByAction();
  }

  /**
   * Get basic network metrics
   */
  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(callback: (metrics: NetworkMetrics) => void): { unsubscribe: () => void } {
    this.metricsListeners.push(callback);
    
    return {
      unsubscribe: () => {
        const index = this.metricsListeners.indexOf(callback);
        if (index !== -1) {
          this.metricsListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Export network traffic to HAR format
   */
  exportToHAR(): string {
    return this.apiTracer.exportToHAR();
  }

  /**
   * Install network interceptors
   */
  installInterceptors(options: InterceptorOptions = {}): { remove: () => void } {
    // Install interceptors
    const fetchInterceptor = this.interceptFetch();
    const xhrInterceptor = this.interceptXHR();
    
    // Install axios interceptors if provided
    let axiosInterceptor = { remove: () => {} };
    if (options.axios) {
      axiosInterceptor = this.interceptAxios(options.axios);
    }
    
    // Store the interceptors
    this.interceptors.push(fetchInterceptor, xhrInterceptor, axiosInterceptor);
    
    this.logger.log(
      Tab.Network,
      'Enterprise network interceptors installed with call tracing',
      {},
      Severity.Info
    );
    
    // Return a function to remove the interceptors
    return {
      remove: () => {
        fetchInterceptor.remove();
        xhrInterceptor.remove();
        axiosInterceptor.remove();
      }
    };
  }

  /**
   * Create axios interceptors
   */
  interceptAxios(axios: any): { remove: () => void } {
    const self = this;
    
    const requestInterceptor = axios.interceptors.request.use(
      (config: any) => {
        const url = config.url;
        const method = config.method?.toUpperCase() || 'GET';
        const payload = config.data;
        const headers = config.headers || {};
        
        // Track the request
        const requestId = self.trackRequest(url, method, payload, headers);
        
        // Store request ID for later use
        config._requestId = requestId;
        config._startTime = Date.now();
        
        // Apply timeout if configured
        if (!config.timeout && self.config.defaultTimeout) {
          config.timeout = self.config.defaultTimeout;
        }
        
        return config;
      },
      (error: any) => {
        // Handle request errors
        self.logger.log(
          Tab.Network,
          `Axios request error: ${error.message}`,
          { error },
          Severity.Error
        );
        
        return Promise.reject(error);
      }
    );
    
    const responseInterceptor = axios.interceptors.response.use(
      (response: any) => {
        const config = response.config;
        const requestId = config._requestId;
        const startTime = config._startTime;
        
        if (requestId && startTime) {
          const responseTime = Date.now() - startTime;
          
          // Complete the request
          self.completeRequest(
            requestId,
            response.data,
            response.status,
            responseTime,
            response.headers
          );
        }
        
        return response;
      },
      (error: any) => {
        const config = error.config || {};
        const requestId = config._requestId;
        
        if (requestId) {
          // Get response data if available
          const response = error.response;
          
          if (response) {
            // This is a server error with a response
            const responseTime = Date.now() - (config._startTime || Date.now());
            
            // Complete request with error status
            self.completeRequest(
              requestId,
              response.data,
              response.status,
              responseTime,
              response.headers
            );
          } else {
            // This is a network error
            self.failRequest(requestId, error);
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    return {
      remove: () => {
        axios.interceptors.request.eject(requestInterceptor);
        axios.interceptors.response.eject(responseInterceptor);
      }
    };
  }

  /**
   * Intercept fetch API
   */
  private interceptFetch(): { remove: () => void } {
    const self = this;
    const originalFetch = window.fetch;
    
    // Replace the global fetch
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      // Skip if circuit is open
      if (self.isCircuitOpen()) {
        const url = typeof input === 'string' ? input : input.toString();
        const parsedUrl = new URL(url, window.location.origin);
        const hostname = parsedUrl.hostname;
        
        if (self.isHostInErrorWindow(hostname)) {
          self.logger.log(
            Tab.Network,
            `Fetch request blocked by circuit breaker: ${url}`,
            { url, circuitState: self.circuitState },
            Severity.Warn
          );
          
          return Promise.reject(new Error(`Request blocked by circuit breaker for host: ${hostname}`));
        }
      }
      
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const headers = init?.headers ? self.convertHeaders(init.headers) : {};
      const startTime = Date.now();
      
      // Track the request
      const requestId = self.trackRequest(url, method, init?.body, headers);
      
      // Set up timeout if none provided
      let timeoutId: number | null = null;
      const timeoutPromise = new Promise<Response>((_, reject) => {
        if (self.config.defaultTimeout) {
          timeoutId = window.setTimeout(() => {
            reject(new Error(`Request timeout after ${self.config.defaultTimeout}ms`));
          }, self.config.defaultTimeout);
        }
      });
      
      // Create the fetch promise
      const fetchPromise = originalFetch(input, init)
        .then(async response => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          
          const responseTime = Date.now() - startTime;
          const contentType = response.headers.get('content-type');
          const responseHeaders: Record<string, string> = {};
          
          // Extract headers
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          
          // Clone the response for handling
          const clonedResponse = response.clone();
          
          // Process the response body based on content type
          let responseBody: any;
          try {
            if (contentType?.includes('application/json')) {
              responseBody = await clonedResponse.json();
            } else if (contentType?.includes('text/')) {
              responseBody = await clonedResponse.text();
            } else {
              responseBody = { 
                _contentType: contentType, 
                _size: +(response.headers.get('content-length') || '0') 
              };
            }
          } catch (e) {
            responseBody = { 
              _error: 'Failed to parse response body',
              _contentType: contentType
            };
          }
          
          // Complete the request
          self.completeRequest(
            requestId,
            responseBody,
            response.status,
            responseTime,
            responseHeaders
          );
          
          return response;
        })
        .catch(error => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          
          // Mark request as failed
          self.failRequest(requestId, error);
          
          throw error;
        });
      
      // Race the fetch against the timeout
      return Promise.race([fetchPromise, timeoutPromise]);
    };
    
    return {
      remove: () => {
        window.fetch = originalFetch;
      }
    };
  }

  /**
   * Intercept XMLHttpRequest
   */
  private interceptXHR(): { remove: () => void } {
    const self = this;
    const originalXHR = window.XMLHttpRequest;
    
    // Replace global XMLHttpRequest
    window.XMLHttpRequest = function(this: XMLHttpRequest) {
      const xhr = new originalXHR();
      let requestId: string | null = null;
      let startTime: number | null = null;
      let url: string = '';
      let method: string = 'GET';
      let timeout: number | null = null;
      
      // Override open method
      const originalOpen = xhr.open;
      xhr.open = function(this: XMLHttpRequest, method: string, url: string, ...args: any[]) {
        // Save for later use
        (this as any)._method = method;
        (this as any)._url = url;
        
        // Store values for later
        method = method;
        url = url;
        
        return originalOpen.apply(this, [method, url, ...args] as any);
      };
      
      // Override send method
      const originalSend = xhr.send;
      xhr.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
        // Apply default timeout if none set
        if (!this.timeout && self.config.defaultTimeout) {
          this.timeout = self.config.defaultTimeout;
        }
        
        // Store timeout for later
        timeout = this.timeout;
        
        // Check circuit breaker
        if (self.isCircuitOpen()) {
          const parsedUrl = new URL((this as any)._url || url, window.location.origin);
          const hostname = parsedUrl.hostname;
          
          if (self.isHostInErrorWindow(hostname)) {
            self.logger.log(
              Tab.Network,
              `XHR request blocked by circuit breaker: ${url}`,
              { url, circuitState: self.circuitState },
              Severity.Warn
            );
            
            // Simulate XHR error event
            setTimeout(() => {
              const errorEvent = new ErrorEvent('error', { 
                message: `Request blocked by circuit breaker for host: ${hostname}` 
              });
              this.dispatchEvent(errorEvent);
            }, 0);
            
            return;
          }
        }
        
        startTime = Date.now();
        
        // Extract headers
        const headers: Record<string, string> = {};
        this.getAllResponseHeaders().split('\r\n').forEach(line => {
          const parts = line.split(': ');
          if (parts.length === 2) {
            headers[parts[0]] = parts[1];
          }
        });
        
        // Track the request
        const xhrMethod = (this as any)._method || method || 'GET';
        const xhrUrl = (this as any)._url || url || 'unknown';
        
        requestId = self.trackRequest(xhrUrl, xhrMethod, body, headers);
        
        return originalSend.apply(this, arguments);
      };
      
      // Add listeners for XHR events
      xhr.addEventListener('load', function(this: XMLHttpRequest) {
        if (!requestId || !startTime) return;
        
        const responseTime = Date.now() - startTime;
        let response;
        
        // Extract response headers
        const responseHeaders: Record<string, string> = {};
        this.getAllResponseHeaders().split('\r\n').forEach(line => {
          const parts = line.split(': ');
          if (parts.length === 2) {
            responseHeaders[parts[0]] = parts[1];
          }
        });
        
        // Extract response data
        try {
          if (this.responseType === 'json') {
            response = this.response;
          } else if (this.responseType === '' || this.responseType === 'text') {
            const contentType = this.getResponseHeader('content-type');
            if (contentType?.includes('application/json')) {
              response = JSON.parse(this.responseText);
            } else {
              response = this.responseText;
            }
          } else {
            response = { 
              _type: this.responseType, 
              _data: 'binary data',
              _size: this.response ? this.response.byteLength : 0
            };
          }
        } catch (e) {
          response = { 
            _raw: this.responseText?.substring(0, 500) || 'No response text',
            _error: 'Failed to parse response'
          };
        }
        
        self.completeRequest(requestId, response, this.status, responseTime, responseHeaders);
      });
      
      xhr.addEventListener('error', function() {
        if (!requestId) return;
        self.failRequest(requestId, new Error('XHR Request failed'));
      });
      
      xhr.addEventListener('timeout', function() {
        if (!requestId) return;
        self.failRequest(
          requestId, 
          new Error(`XHR Request timed out after ${timeout || 'unknown'}ms`)
        );
      });
      
      xhr.addEventListener('abort', function() {
        if (!requestId) return;
        self.updateRequest(requestId, { status: 'error', error: { message: 'Request aborted' } });
      });
      
      return xhr;
    } as any;
    
    return {
      remove: () => {
        window.XMLHttpRequest = originalXHR;
      }
    };
  }

  /**
   * Store request with circular buffer behavior
   */
  private storeRequest(request: NetworkRequest): void {
    // Apply circular buffer behavior
    if (this.requests.length >= this.config.maxRequests) {
      this.requests = this.requests.slice(-this.config.maxRequests + 1);
    }
    
    this.requests.push(request);
  }

  /**
   * Update metrics based on new data
   */
  private updateMetrics(): void {
    // Update error rate
    this.metrics.errorRate = this.metrics.totalRequests > 0 
      ? this.metrics.errorCount / this.metrics.totalRequests 
      : 0;
    
    // Calculate requests per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    this.metrics.requestsPerMinute = this.requestTimestamps.length;
    
    // Calculate bytes per second (rolling 10-second window)
    const tenSecondsAgo = now - 10000;
    const recentRequests = this.requests.filter(
      r => r.timestamp > tenSecondsAgo && r.status === 'success'
    );
    const recentBytes = recentRequests.reduce((sum, r) => sum + (r.size || 0), 0);
    this.metrics.bytesPerSecond = recentBytes / 10;
    
    // Notify listeners
    this.notifyMetricsListeners();
  }

  /**
   * Update response time metrics with a new data point
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    // Update min/max/avg
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, responseTime);
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, responseTime);
    
    // Update average (rolling)
    const successCount = this.metrics.successCount;
    this.metrics.avgResponseTime = (
      (this.metrics.avgResponseTime * (successCount - 1)) + responseTime
    ) / successCount;
    
    // Update p95 (requires sorted response times from last N requests)
    const recentSuccessfulRequests = this.requests
      .filter(r => r.status === 'success' && r.responseTime !== undefined)
      .sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
    
    if (recentSuccessfulRequests.length > 0) {
      const p95Index = Math.floor(recentSuccessfulRequests.length * 0.95);
      this.metrics.p95ResponseTime = recentSuccessfulRequests[p95Index]?.responseTime || 0;
    }
  }

  /**
   * Notify metrics listeners
   */
  private notifyMetricsListeners(): void {
    const metrics = { ...this.metrics };
    this.metricsListeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (e) {
        this.logger.log(
          Tab.Network,
          `Error in metrics listener: ${e.message}`,
          { error: e },
          Severity.Error
        );
      }
    });
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsUpdates(): void {
    if (this.metricsUpdateInterval !== null) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.metricsUpdateInterval = window.setInterval(() => {
      this.updateMetrics();
    }, 5000);
  }

  /**
   * Start periodic retention checks
   */
  private startRetentionChecks(): void {
    if (this.retentionCheckInterval !== null) {
      clearInterval(this.retentionCheckInterval);
    }
    
    this.retentionCheckInterval = window.setInterval(() => {
      this.applyRetentionPolicy();
    }, 60000); // Check every minute
  }

  /**
   * Apply retention policy to requests
   */
  private applyRetentionPolicy(): void {
    const now = Date.now();
    const cutoff = now - this.config.retentionPeriod;
    
    // Remove old requests
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    
    // Also clean up error window
    this.cleanupErrorWindow();
  }

  /**
   * Sanitize URL by redacting sensitive parameters
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      
      // Sanitize query parameters
      this.config.sanitization.urlParams.forEach(param => {
        if (parsedUrl.searchParams.has(param)) {
          parsedUrl.searchParams.set(param, '[REDACTED]');
        }
      });
      
      return parsedUrl.toString();
    } catch (e) {
      // If URL parsing fails, return as is
      return url;
    }
  }

  /**
   * Sanitize headers by redacting sensitive values
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    this.config.sanitization.headers.forEach(header => {
      const headerLower = header.toLowerCase();
      Object.keys(sanitized).forEach(key => {
        if (key.toLowerCase() === headerLower) {
          sanitized[key] = '[REDACTED]';
        }
      });
    });
    
    return sanitized;
  }

  /**
   * Sanitize payload by redacting sensitive fields
   */
  private sanitizePayload(payload: unknown): unknown {
    if (!payload) return payload;
    
    // Handle FormData
    if (payload instanceof FormData) {
      const sanitizedFormData = new FormData();
      for (const [key, value] of (payload as FormData).entries()) {
        if (this.config.sanitization.bodyFields.includes(key)) {
          sanitizedFormData.append(key, '[REDACTED]');
        } else {
          sanitizedFormData.append(key, value);
        }
      }
      return sanitizedFormData;
    }
    
    // Handle string payloads that might be JSON
    if (typeof payload === 'string') {
      try {
        const json = JSON.parse(payload);
        return this.sanitizeObject(json);
      } catch (e) {
        // Not JSON, return as is
        return payload;
      }
    }
    
    // Handle objects
    if (typeof payload === 'object' && payload !== null) {
      return this.sanitizeObject(payload);
    }
    
    return payload;
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.config.sanitization.bodyFields.some(field => 
        field === key || 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Apply request processors to a request
   */
  private applyRequestProcessors(request: NetworkRequest): NetworkRequest {
    let processed = { ...request };
    
    for (const processor of this.config.processors.request) {
      try {
        processed = processor(processed);
      } catch (e) {
        this.logger.log(
          Tab.Network,
          `Error in request processor: ${e.message}`,
          { error: e, request },
          Severity.Error
        );
      }
    }
    
    return processed;
  }

  /**
   * Apply response processors to a response
   */
  private applyResponseProcessors(response: any, request: NetworkRequest): any {
    let processed = response;
    
    for (const processor of this.config.processors.response) {
      try {
        processed = processor(processed, request);
      } catch (e) {
        this.logger.log(
          Tab.Network,
          `Error in response processor: ${e.message}`,
          { error: e, response, request },
          Severity.Error
        );
      }
    }
    
    return processed;
  }

  /**
   * Get session ID from storage or generate a new one
   */
  private getSessionId(): string {
    let sessionId = localStorage.getItem('network_monitor_session_id');
    
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('network_monitor_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Get correlation ID for the current context
   */
  private getCorrelationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Calculate response size in bytes
   */
  private calculateResponseSize(response: any): number {
    if (!response) return 0;
    
    try {
      // For strings, use length as approximation
      if (typeof response === 'string') {
        return response.length;
      }
      
      // For other types, stringify and measure
      const json = JSON.stringify(response);
      return new Blob([json]).size;
    } catch (e) {
      // Fallback
      return 0;
    }
  }

  /**
   * Check for performance concerns in a completed request
   */
  private checkPerformanceConcerns(request: NetworkRequest): void {
    const responseTime = request.responseTime || 0;
    const size = request.size || 0;
    
    // Check for slow requests
    if (responseTime > this.config.performanceThresholds.slowRequest) {
      this.logger.log(
        Tab.Performance,
        `Slow request: ${request.method} ${this.getPathFromUrl(request.url)} took ${responseTime}ms`,
        { requestId: request.id, url: request.url, responseTime },
        Severity.Warn
      );
      
      this.logger.addFix(
        'Slow Request',
        `The request to ${this.getPathFromUrl(request.url)} is slower than the threshold of ${this.config.performanceThresholds.slowRequest}ms.`,
        'Consider adding caching, optimizing the endpoint, or implementing a loading state in the UI.',
        null,
        Severity.Warn
      );
    }
    
    // Check for large responses
    if (size > this.config.performanceThresholds.largeResponse) {
      this.logger.log(
        Tab.Performance,
        `Large response: ${request.method} ${this.getPathFromUrl(request.url)} returned ${this.formatBytes(size)}`,
        { requestId: request.id, url: request.url, size },
        Severity.Warn
      );
      
      this.logger.addFix(
        'Large Response',
        `The response from ${this.getPathFromUrl(request.url)} is larger than the threshold of ${this.formatBytes(this.config.performanceThresholds.largeResponse)}.`,
        'Consider implementing pagination, filtering, or compression to reduce payload size.',
        null,
        Severity.Warn
      );
    }
  }

  /**
   * Calculate compression info from headers and response
   */
  private calculateCompressionInfo(headers: Record<string, string>, response: any): any {
    const contentEncoding = headers['content-encoding'] || '';
    const isCompressed = contentEncoding.includes('gzip') || 
                          contentEncoding.includes('deflate') ||
                          contentEncoding.includes('br');
    
    const transmittedSize = parseInt(headers['content-length'] || '0', 10);
    const decompressedSize = this.calculateResponseSize(response);
    
    let compressionRatio = 0;
    if (isCompressed && transmittedSize > 0 && decompressedSize > 0) {
      compressionRatio = decompressedSize / transmittedSize;
    }
    
    return {
      isCompressed,
      compressionType: isCompressed ? contentEncoding : 'none',
      transmittedSize,
      decompressedSize,
      compressionRatio,
      savings: isCompressed ? decompressedSize - transmittedSize : 0
    };
  }

  /**
   * Log request start
   */
  private logRequestStart(request: NetworkRequest): void {
    this.logger.log(
      Tab.Network,
      `${request.method} request to ${this.getPathFromUrl(request.url)}`,
      {
        url: request.url,
        method: request.method,
        payload: request.payload ? JSON.stringify(request.payload).substring(0, 500) : undefined,
        headers: request.headers,
        context: request.context
      },
      Severity.Info
    );
  }

  /**
   * Log successful request completion
   */
  private logSuccessfulCompletion(request: NetworkRequest): void {
    this.logger.log(
      Tab.Network,
      `${request.method} request to ${this.getPathFromUrl(request.url)} completed (${request.statusCode})`,
      {
        requestId: request.id,
        url: request.url,
        method: request.method,
        statusCode: request.statusCode,
        responseTime: `${request.responseTime}ms`,
        responseSize: this.formatBytes(request.size || 0),
        compression: request.compressionInfo
      },
      Severity.Success
    );
  }

  /**
   * Log request failure
   */
  private logFailure(request: NetworkRequest): void {
    this.logger.log(
      Tab.Network,
      `${request.method} request to ${this.getPathFromUrl(request.url)} failed`,
      {
        requestId: request.id,
        url: request.url,
        method: request.method,
        error: request.error?.message || 'Unknown error',
        stack: request.error?.stack
      },
      Severity.Error
    );
  }

  /**
   * Add error fixes based on error type
   */
  private suggestErrorFixes(request: NetworkRequest): void {
    const error = request.error?.message || '';
    
    if (error.includes('timeout') || error.includes('Timeout')) {
      this.logger.addFix(
        'Request Timeout',
        `The request to ${this.getPathFromUrl(request.url)} timed out.`,
        'Consider increasing the timeout setting, checking server performance, or implementing retry logic.',
        null,
        Severity.Warn
      );
    } else if (error.includes('NetworkError') || error.includes('Failed to fetch')) {
      this.logger.addFix(
        'Network Error',
        `Network error occurred when requesting ${this.getPathFromUrl(request.url)}.`,
        'Check your internet connection, verify the API endpoint is accessible, or implement offline support.',
        null,
        Severity.Warn
      );
    } else if (error.includes('CORS') || error.includes('blocked by CORS policy')) {
      this.logger.addFix(
        'CORS Error',
        `CORS error occurred when requesting ${this.getPathFromUrl(request.url)}.`,
        'Configure the server to allow cross-origin requests from this domain, or use a proxy.',
        null,
        Severity.Warn
      );
    } else if (error.includes('aborted')) {
      this.logger.addFix(
        'Request Aborted',
        `The request to ${this.getPathFromUrl(request.url)} was aborted.`,
        'Check if the request is being cancelled by user action or another script.',
        null,
        Severity.Info
      );
    }
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Extract path from URL
   */
  private getPathFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return parsedUrl.pathname;
    } catch (e) {
      return url;
    }
  }

  /**
   * Add error to the error window for circuit breaker
   */
  private addToErrorWindow(url: string): void {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const hostname = parsedUrl.hostname;
      
      this.errorWindow.push({
        timestamp: Date.now(),
        url: hostname
      });
      
      this.cleanupErrorWindow();
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  /**
   * Clean up old errors from the error window
   */
  private cleanupErrorWindow(): void {
    const windowSize = this.config.circuitBreaker.windowSize;
    const now = Date.now();
    
    this.errorWindow = this.errorWindow.filter(error => 
      now - error.timestamp < windowSize
    );
  }

  /**
   * Check if circuit breaker should trip
   */
  private checkCircuitBreaker(): void {
    if (!this.config.circuitBreaker) return;
    
    this.cleanupErrorWindow();
    
    // If circuit is already open, don't check again
    if (this.circuitState === 'open') return;
    
    // Group errors by hostname
    const errorsByHost = new Map<string, number>();
    
    for (const error of this.errorWindow) {
      const count = errorsByHost.get(error.url) || 0;
      errorsByHost.set(error.url, count + 1);
    }
    
    // Check if any host exceeds the threshold
    for (const [host, count] of errorsByHost.entries()) {
      if (count >= this.config.circuitBreaker.errorThreshold) {
        this.openCircuit(host);
        break;
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(host: string): void {
    this.circuitState = 'open';
    
    this.logger.log(
      Tab.Network,
      `Circuit breaker opened for host: ${host}`,
      { host, errorCount: this.errorWindow.filter(e => e.url === host).length },
      Severity.Error
    );
    
    // Schedule circuit reset
    if (this.circuitResetTimeout !== null) {
      clearTimeout(this.circuitResetTimeout);
    }
    
    this.circuitResetTimeout = window.setTimeout(() => {
      this.moveToHalfOpen();
    }, this.config.circuitBreaker.resetTimeout);
  }
  
  /**
   * Move circuit to half-open state
   */
  private moveToHalfOpen(): void {
    this.circuitState = 'half-open';
    
    this.logger.log(
      Tab.Network,
      'Circuit breaker moved to half-open state',
      {},
      Severity.Warn
    );
  }
  
  /**
   * Reset circuit breaker to closed state
   */
  private closeCircuit(): void {
    this.circuitState = 'closed';
    
    this.logger.log(
      Tab.Network,
      'Circuit breaker closed',
      {},
      Severity.Success
    );
  }
  
  /**
   * Check if circuit is currently open
   */
  private isCircuitOpen(): boolean {
    return this.circuitState === 'open';
  }
  
  /**
   * Check if a host is in the error window
   */
  private isHostInErrorWindow(hostname: string): boolean {
    return this.errorWindow.some(error => error.url === hostname);
  }
  
  /**
   * Convert RequestInit headers to a simple object
   */
  private convertHeaders(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    } else if (Array.isArray(headers)) {
      const obj: Record<string, string> = {};
      for (const [key, value] of headers) {
        obj[key] = value;
      }
      return obj;
    } else {
      return headers as Record<string, string>;
    }
  }
  
  /**
   * Dispose monitor and clean up resources
   */
  dispose(): void {
    // Remove interceptors
    this.interceptors.forEach(interceptor => interceptor.remove());
    this.interceptors = [];
    
    // Clear timers
    if (this.metricsUpdateInterval !== null) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
    
    if (this.retentionCheckInterval !== null) {
      clearInterval(this.retentionCheckInterval);
      this.retentionCheckInterval = null;
    }
    
    if (this.circuitResetTimeout !== null) {
      clearTimeout(this.circuitResetTimeout);
      this.circuitResetTimeout = null;
    }
    
    // Reset globals
    window.fetch = this.originalFetch;
    window.XMLHttpRequest = this.originalXHR;
    
    this.logger.log(
      Tab.Network,
      'Network monitor disposed',
      {},
      Severity.Info
    );
  }
  
  /**
   * Export metrics in OpenTelemetry format
   */
  exportOpenTelemetryMetrics(): any {
    if (!this.config.enableOpenTelemetry) {
      this.logger.log(
        Tab.Network,
        'OpenTelemetry export attempted but not enabled in config',
        {},
        Severity.Warn
      );
      return null;
    }
    
    return {
      metrics: this.metrics,
      resource: {
        service: 'network-monitor',
        version: '2.0',
        environment: process.env.NODE_ENV || 'unknown'
      },
      histograms: this.generateResponseTimeHistogram(),
      spans: this.getOpenTelemetrySpans()
    };
  }
  
  /**
   * Generate response time histogram for OpenTelemetry
   */
  private generateResponseTimeHistogram(): any {
    const successRequests = this.requests.filter(r => 
      r.status === 'success' && r.responseTime !== undefined
    );
    
    if (successRequests.length === 0) return null;
    
    // Create histogram buckets
    const buckets = [0, 100, 250, 500, 1000, 2000, 5000, 10000, 20000];
    const counts = new Array(buckets.length).fill(0);
    
    // Count requests in each bucket
    for (const request of successRequests) {
      const responseTime = request.responseTime || 0;
      for (let i = 0; i < buckets.length; i++) {
        if (responseTime <= buckets[i] || i === buckets.length - 1) {
          counts[i]++;
          break;
        }
      }
    }
    
    return {
      name: 'http.response.duration',
      unit: 'ms',
      buckets,
      counts
    };
  }
  
  /**
   * Get OpenTelemetry spans from API calls
   */
  private getOpenTelemetrySpans(): any[] {
    return this.apiTracer.getApiCalls().map(call => {
      return {
        traceId: call.callId,
        spanId: call.callId,
        parentSpanId: call.parentCallId,
        name: `${call.method} ${this.getPathFromUrl(call.url)}`,
        kind: 'CLIENT',
        start: call.startTime,
        end: call.endTime,
        attributes: {
          'http.method': call.method,
          'http.url': call.url,
          'http.status_code': call.response?.status,
          'http.response_content_length': call.response?.size
        },
        status: call.status === 'completed' ? 'OK' : 'ERROR',
        events: call.error ? [{
          name: 'exception',
          time: call.endTime,
          attributes: {
            'exception.type': call.error.name,
            'exception.message': call.error.message
          }
        }] : []
      };
    });
  }
  
  /**
   * Add a custom request processor
   */
  addRequestProcessor(processor: RequestProcessor): void {
    this.config.processors.request.push(processor);
  }
  
  /**
   * Add a custom response processor
   */
  addResponseProcessor(processor: ResponseProcessor): void {
    this.config.processors.response.push(processor);
  }
  
  /**
   * Create a developer-friendly report of network activity
   */
  generateReport(): string {
    const totalRequests = this.requests.length;
    const successCount = this.requests.filter(r => r.status === 'success').length;
    const errorCount = this.requests.filter(r => r.status === 'error').length;
    const pendingCount = this.requests.filter(r => r.status === 'pending').length;
    
    const totalBytes = this.requests.reduce((sum, r) => sum + (r.size || 0), 0);
    const avgResponseTime = this.getAverageResponseTime();
    
    const slowRequests = this.requests.filter(r => 
      r.status === 'success' && 
      r.responseTime !== undefined && 
      r.responseTime > this.config.performanceThresholds.slowRequest
    );
    
    const largeResponses = this.requests.filter(r => 
      r.status === 'success' && 
      r.size !== undefined && 
      r.size > this.config.performanceThresholds.largeResponse
    );
    
    const commonErrorPatterns = this.analyzeCommonErrors();
    const apiCallChains = this.apiTracer.getRootCalls().length;
    
    // Generate markdown report
    return `# Network Monitor Report
    
## Overview
- Total Requests: ${totalRequests}
- Success: ${successCount} (${Math.round(successCount / totalRequests * 100)}%)
- Errors: ${errorCount} (${Math.round(errorCount / totalRequests * 100)}%)
- Pending: ${pendingCount}
- Total Data Transferred: ${this.formatBytes(totalBytes)}
- Average Response Time: ${Math.round(avgResponseTime)}ms
- Circuit Breaker State: ${this.circuitState}

## Performance Concerns
- Slow Requests: ${slowRequests.length} requests exceeded the ${this.config.performanceThresholds.slowRequest}ms threshold
- Large Responses: ${largeResponses.length} responses exceeded the ${this.formatBytes(this.config.performanceThresholds.largeResponse)} threshold
- API Call Chains: ${apiCallChains} root calls with ${this.apiTracer.getApiCalls().length - apiCallChains} dependent calls

## Common Error Patterns
${commonErrorPatterns.map(pattern => `- ${pattern.count} errors: ${pattern.pattern}`).join('\n')}

## Recommendations
${this.generateRecommendations()}
`;
  }
  
  /**
   * Analyze common error patterns
   */
  private analyzeCommonErrors(): Array<{pattern: string, count: number}> {
    const errorMessages = this.requests
      .filter(r => r.status === 'error' && r.error?.message)
      .map(r => r.error?.message || '');
    
    if (errorMessages.length === 0) {
      return [];
    }
    
    // Group similar errors
    const patterns: Record<string, number> = {};
    
    for (const message of errorMessages) {
      // Simplify message to create pattern
      const pattern = message
        .replace(/[0-9]+/g, '{num}')
        .replace(/(https?:\/\/[^\s]+)/g, '{url}')
        .substring(0, 100);
      
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    }
    
    return Object.entries(patterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 patterns
  }
  
  /**
   * Generate recommendations based on observed patterns
   */
  private generateRecommendations(): string {
    const recommendations = [];
    
    // Check error rate
    if (this.metrics.errorRate > this.config.performanceThresholds.errorRate) {
      recommendations.push(
        `Error rate of ${Math.round(this.metrics.errorRate * 100)}% exceeds threshold. Consider implementing retry logic or fallback mechanisms.`
      );
    }
    
    // Check response times
    if (this.metrics.p95ResponseTime > this.config.performanceThresholds.slowRequest) {
      recommendations.push(
        `95th percentile response time (${Math.round(this.metrics.p95ResponseTime)}ms) exceeds threshold. Consider optimizing API endpoints or implementing caching.`
      );
    }
    
    // Check for long call chains
    const callChains = this.apiTracer.getRootCalls().map(call => 
      this.apiTracer.getCallChain(call.callId)
    );
    
    const deepChains = callChains.filter(chain => {
      const maxDepth = this.findMaxDepth(chain);
      return maxDepth > 3; // Chains deeper than 3 levels
    });
    
    if (deepChains.length > 0) {
      recommendations.push(
        `Detected ${deepChains.length} deep API call chains. Consider optimizing to reduce waterfall requests.`
      );
    }
    
    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push('No significant issues detected in the current network activity.');
    }
    
    return recommendations.join('\n\n');
  }
  
  /**
   * Find maximum depth in a call chain
   */
  private findMaxDepth(chain: ApiCallChain): number {
    if (!chain.call) return 0;
    
    if (chain.children.length === 0) {
      return 1;
    }
    
    const childDepths = chain.children.map(child => this.findMaxDepth(child));
    return 1 + Math.max(...childDepths);
  }
  
  /**
   * Find potentially redundant API calls
   */
  findRedundantCalls(timeWindow: number = 5000): NetworkRequest[][] {
    const groups: Record<string, NetworkRequest[]> = {};
    
    // Group requests by URL pattern (excluding query params)
    for (const request of this.requests) {
      try {
        const url = new URL(request.url, window.location.origin);
        const key = `${request.method} ${url.pathname}`;
        
        if (!groups[key]) {
          groups[key] = [];
        }
        
        groups[key].push(request);
      } catch (e) {
        // Skip invalid URLs
      }
    }
    
    // Find groups with potential redundancy
    return Object.values(groups)
      .filter(group => {
        if (group.length < 2) return false;
        
        // Sort by timestamp
        group.sort((a, b) => a.timestamp - b.timestamp);
        
        // Check for calls close to each other
        for (let i = 1; i < group.length; i++) {
          if (group[i].timestamp - group[i-1].timestamp < timeWindow) {
            return true;
          }
        }
        
        return false;
      });
  }
}