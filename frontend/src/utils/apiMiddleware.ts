// src/utils/apiMiddleware.ts
import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ApiClientMiddleware } from './apiClient';
import { metrics } from '../services/metrics';
import { logger } from '../services/logger';

/**
 * Timing middleware that records API request durations
 */
export const timingMiddleware: ApiClientMiddleware = {
  id: 'timing',
  
  request: (config: AxiosRequestConfig) => {
    // Add timing metadata if not already present
    config.metadata = {
      ...config.metadata,
      startTime: Date.now()
    };
    return config;
  },
  
  response: (response: AxiosResponse) => {
    const startTime = response.config.metadata?.startTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      
      // Record timing metric
      metrics.record('api.request.timing', duration, {
        endpoint: response.config.url,
        method: response.config.method,
        status: response.status
      });
      
      // Add timing header for debugging
      response.headers['X-Response-Time'] = `${duration}ms`;
    }
    return response;
  }
};

/**
 * User activity tracking middleware
 */
export const activityMiddleware: ApiClientMiddleware = {
  id: 'activity',
  
  request: (config: AxiosRequestConfig) => {
    // Add last activity timestamp to global state
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('last_activity', Date.now().toString());
    }
    return config;
  }
};

/**
 * API version check middleware
 */
export const versionCheckMiddleware: ApiClientMiddleware = {
  id: 'versionCheck',
  
  response: (response: AxiosResponse) => {
    // Check for API version header
    const apiVersion = response.headers['x-api-version'];
    const minVersion = process.env.REACT_APP_MIN_API_VERSION;
    
    if (apiVersion && minVersion && apiVersion < minVersion) {
      logger.warn('API version outdated', {
        current: apiVersion,
        minimum: minVersion
      });
      
      // Could trigger an app update notification here
    }
    
    return response;
  }
};

/**
 * Idempotency middleware for safe retries
 */
export const idempotencyMiddleware: ApiClientMiddleware = {
  id: 'idempotency',
  
  request: (config: AxiosRequestConfig) => {
    // Only add idempotency keys to mutation operations
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '') && 
        !config.headers?.['Idempotency-Key']) {
      
      // Generate a unique key for this request
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Add to headers
      config.headers = {
        ...config.headers,
        'Idempotency-Key': idempotencyKey
      };
      
      // Store in session to potentially recover
      try {
        const requestKey = `${method}_${config.url}`;
        const idempotencyStore = JSON.parse(sessionStorage.getItem('idempotency_keys') || '{}');
        idempotencyStore[requestKey] = idempotencyKey;
        sessionStorage.setItem('idempotency_keys', JSON.stringify(idempotencyStore));
      } catch (e) {
        // Ignore storage errors
      }
    }
    
    return config;
  }
};

/**
 * Feature flag check middleware
 */
export const featureFlagMiddleware: ApiClientMiddleware = {
  id: 'featureFlags',
  
  response: (response: AxiosResponse) => {
    // Look for feature flags in headers
    const flagsHeader = response.headers['x-feature-flags'];
    
    if (flagsHeader) {
      try {
        const flags = JSON.parse(flagsHeader);
        
        // Update feature flags in application state
        if (typeof window !== 'undefined' && window.appState) {
          window.appState.featureFlags = {
            ...window.appState.featureFlags,
            ...flags
          };
        }
      } catch (e) {
        logger.warn('Failed to parse feature flags header', { error: e });
      }
    }
    
    return response;
  }
};

/**
 * Error normalization middleware
 */
export const errorNormalizationMiddleware: ApiClientMiddleware = {
  id: 'errorNormalization',
  
  error: (error: AxiosError) => {
    // Normalize common error patterns
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle common API error formats
      if (status === 400 && data) {
        // Parse JSON:API format
        if (data.errors && Array.isArray(data.errors)) {
          error.response.data = {
            message: data.errors[0]?.detail || 'Validation error',
            validationErrors: data.errors.map((err: any) => ({
              field: err.source?.pointer?.replace(/^\/data\/attributes\//, '') || '',
              message: err.detail || 'Invalid value',
              code: err.code || 'invalid'
            }))
          };
        }
        
        // Parse Rails-style errors
        else if (data.error && data.error.details) {
          error.response.data = {
            message: data.error.message || 'Validation error',
            validationErrors: Object.entries(data.error.details).map(
              ([field, messages]) => ({
                field,
                message: Array.isArray(messages) ? messages[0] : String(messages),
                code: 'invalid'
              })
            )
          };
        }
      }
    }
    
    return error;
  }
};

/**
 * Offline detection middleware
 */
export const offlineDetectionMiddleware: ApiClientMiddleware = {
  id: 'offlineDetection',
  
  error: (error: AxiosError) => {
    // Check if error is due to network connectivity
    if (!error.response && error.message === 'Network Error') {
      // Update application online state
      if (typeof window !== 'undefined') {
        const wasOffline = !navigator.onLine;
        
        if (!wasOffline) {
          // We were online but the request failed - might be offline now
          // Could trigger a connectivity check here
          logger.warn('Network request failed while browser reports online status');
          metrics.increment('api.connectivity.failure');
        }
      }
      
      // Enhance the error for better UX
      error.message = 'You appear to be offline. Please check your connection and try again.';
    }
    
    return error;
  }
};

/**
 * CSRF token middleware
 */
export const csrfMiddleware: ApiClientMiddleware = {
  id: 'csrf',
  
  request: (config: AxiosRequestConfig) => {
    // Only add CSRF token to mutation operations
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '')) {
      // Get CSRF token from meta tag or cookie
      let csrfToken = '';
      
      if (typeof document !== 'undefined') {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
          csrfToken = metaTag.getAttribute('content') || '';
        }
      }
      
      if (csrfToken) {
        config.headers = {
          ...config.headers,
          'X-CSRF-Token': csrfToken
        };
      }
    }
    
    return config;
  }
};

/**
 * Custom middleware factory for domain-specific logic
 */
export function createBusinessLogicMiddleware(options: {
  entityType: string;
  transformResponse?: (data: any) => any;
  validateRequest?: (data: any) => boolean | Promise<boolean>;
}): ApiClientMiddleware {
  return {
    id: `businessLogic_${options.entityType}`,
    
    request: async (config: AxiosRequestConfig) => {
      // Extract entity type from URL
      const url = config.url || '';
      if (url.includes(`/${options.entityType}/`) && options.validateRequest) {
        // Validate the request data
        const isValid = await options.validateRequest(config.data);
        if (!isValid) {
          throw new Error(`Invalid ${options.entityType} data`);
        }
      }
      
      return config;
    },
    
    response: (response: AxiosResponse) => {
      // Apply transformations to specific entity types
      const url = response.config.url || '';
      if (url.includes(`/${options.entityType}/`) && options.transformResponse) {
        // Apply transformation to response data
        if (Array.isArray(response.data)) {
          response.data = response.data.map(options.transformResponse);
        } else {
          response.data = options.transformResponse(response.data);
        }
      }
      
      return response;
    }
  };
}