// @ts-check
/**
 * @fileoverview Enterprise-grade error handling and management system
 * @module @company/errors
 * @version 2.0.0
 * @license Proprietary
 */

/**
 * Error severity levels for classification
 * @readonly
 * @enum {string}
 */
export const ErrorSeverity = {
    /** Fatal errors requiring immediate attention */
    CRITICAL: 'critical',
    /** Serious errors requiring prompt resolution */
    ERROR: 'error',
    /** Potential problems that should be investigated */
    WARNING: 'warning',
    /** Informational issues */
    INFO: 'info'
  };
  
  /**
   * Error categories for classification
   * @readonly
   * @enum {string}
   */
  export const ErrorCategory = {
    /** Infrastructure-related errors */
    INFRASTRUCTURE: 'infrastructure',
    /** Security-related errors */
    SECURITY: 'security',
    /** Data handling errors */
    DATA: 'data',
    /** User input errors */
    INPUT: 'input',
    /** Business logic errors */
    BUSINESS: 'business',
    /** Integration errors with external systems */
    INTEGRATION: 'integration',
    /** Configuration errors */
    CONFIGURATION: 'configuration'
  };
  
  /**
   * Base application error with comprehensive diagnostics and security enhancements
   * @extends Error
   */
  export class ApplicationError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {Object} [options] - Error configuration
     * @param {number} [options.statusCode] - HTTP status code
     * @param {Error} [options.cause] - Original causing error (following Error cause standard)
     * @param {Object} [options.context] - Diagnostic context data
     * @param {Array<Object>} [options.validationErrors] - Field validation details
     * @param {boolean} [options.isRetryable=true] - Whether operation is safe to retry
     * @param {string} [options.errorCode] - Machine-readable error code
     * @param {string} [options.severity=ErrorSeverity.ERROR] - Error severity level
     * @param {string} [options.category=ErrorCategory.BUSINESS] - Error category
     * @param {string} [options.transactionId] - Related transaction ID
     * @param {string} [options.requestId] - Related request ID
     * @param {string} [options.instanceId] - Server/service instance ID
     * @param {number} [options.retryAfter] - Suggested retry delay in ms
     * @param {string} [options.source] - Component/module that originated error
     * @param {Object} [options.resourceInfo] - Resource that experienced error
     * @param {string} [options.documentationUrl] - URL to error documentation
     */
    constructor(message, {
      statusCode,
      cause,
      context,
      validationErrors,
      isRetryable = true,
      errorCode,
      severity = ErrorSeverity.ERROR,
      category = ErrorCategory.BUSINESS,
      transactionId,
      requestId,
      instanceId,
      retryAfter,
      source,
      resourceInfo,
      documentationUrl
    } = {}) {
      super(message);
      
      // Standard properties
      this.name = this.constructor.name;
      this.timestamp = new Date().toISOString();
      
      // Error metadata
      this.statusCode = statusCode || cause?.statusCode || 500;
      this.cause = cause;
      this.context = this.#sanitizeContext(context || {});
      this.validationErrors = validationErrors;
      this.isRetryable = isRetryable;
      this.errorCode = errorCode || this.#generateErrorCode();
      this.severity = severity;
      this.category = category;
      this.transactionId = transactionId;
      this.requestId = requestId;
      this.instanceId = instanceId;
      this.retryAfter = retryAfter;
      this.source = source || this.#determineSource();
      this.resourceInfo = resourceInfo;
      this.documentationUrl = documentationUrl || this.#getDocumentationUrl();
      
      // Performance metrics
      this.performanceData = this.#capturePerformanceData();
  
      // Stack trace management
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
      
      // Add causal chain for enhanced debugging
      if (cause?.stack) {
        this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
      }
  
      // Observer pattern for error monitoring
      this.#notifyErrorMonitors();
    }
  
    /**
     * Redacts sensitive fields from error context
     * @private
     * @param {Object} context - Raw context object
     * @returns {Object} Sanitized context object
     */
    #sanitizeContext(context) {
      const sensitiveKeys = [
        'password', 'token', 'secret', 'auth', 'key', 'credential', 
        'apiKey', 'jwt', 'private', 'ssn', 'credit', 'cvv', 'authorization'
      ];
      
      return Object.entries(context).reduce((acc, [key, value]) => {
        // Deep sanitization for nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          acc[key] = this.#sanitizeContext(value);
        } else if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          acc[key] = '[REDACTED]';
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
    }
  
    /**
     * Generates a unique error code using name and timestamp
     * @private
     * @returns {string} Unique error code
     */
    #generateErrorCode() {
      const errorPrefix = this.constructor.name.replace(/Error$/, '').toUpperCase();
      const timestamp = Date.now().toString(36);
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${errorPrefix}_${timestamp}_${randomSuffix}`;
    }
  
    /**
     * Determines source component from stack trace
     * @private
     * @returns {string} Source component or module
     */
    #determineSource() {
      try {
        const stackLines = (new Error().stack || '').split('\n');
        // Skip the first 3 lines (Error, this method, and constructor)
        const relevantLine = stackLines[3] || '';
        const match = relevantLine.match(/at\s+(?:\w+\.)*(\w+)\s+\(([^)]+)\)/);
        return match ? `${match[1]}@${match[2].split('/').pop()}` : 'unknown';
      } catch (e) {
        return 'unknown';
      }
    }
  
    /**
     * Gets documentation URL for this error type
     * @private
     * @returns {string|undefined} Documentation URL if available
     */
    #getDocumentationUrl() {
      // Could be configured based on error type or error code
      if (this.errorCode) {
        return `https://errors.company.com/docs/${this.errorCode.toLowerCase()}`;
      }
      return undefined;
    }
  
    /**
     * Captures performance metrics when error occurred
     * @private
     * @returns {Object} Performance data
     */
    #capturePerformanceData() {
      // In browser
      if (typeof window !== 'undefined' && window.performance) {
        const perfData = {
          timing: {},
          memory: {}
        };
        
        // Capture navigation timing if available
        if (window.performance.timing) {
          const timing = window.performance.timing;
          perfData.timing = {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domComplete - timing.domLoading,
            networkLatency: timing.responseEnd - timing.fetchStart
          };
        }
        
        // Capture memory info if available
        if (window.performance.memory) {
          perfData.memory = {
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            usedJSHeapSize: window.performance.memory.usedJSHeapSize
          };
        }
        
        return perfData;
      }
      
      // Node.js
      if (typeof process !== 'undefined') {
        return {
          memory: process.memoryUsage(),
          uptime: process.uptime()
        };
      }
      
      return {};
    }
  
    /**
     * Notifies error monitors of error occurrence
     * @private
     */
    #notifyErrorMonitors() {
      // Call registered error monitors
      if (typeof window !== 'undefined' && window.__ERROR_MONITORS__) {
        window.__ERROR_MONITORS__.forEach(monitor => {
          try {
            monitor(this);
          } catch (e) {
            // Swallow monitoring errors
            console.warn('Error in error monitor:', e);
          }
        });
      }
    }
  
    /**
     * Safe serialization for logging/transmission
     * @returns {Object} Serialized error object
     */
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        statusCode: this.statusCode,
        errorCode: this.errorCode,
        context: this.context,
        validationErrors: this.validationErrors,
        severity: this.severity,
        category: this.category,
        isRetryable: this.isRetryable,
        retryAfter: this.retryAfter,
        timestamp: this.timestamp,
        transactionId: this.transactionId,
        requestId: this.requestId,
        instanceId: this.instanceId,
        source: this.source,
        resourceInfo: this.resourceInfo,
        documentationUrl: this.documentationUrl,
        // Include condensed performance data
        performance: this.performanceData
      };
    }
  
    /**
     * Returns a formatted error message with context
     * @returns {string} Formatted error message
     */
    toString() {
      let result = `${this.name}[${this.errorCode}]: ${this.message}`;
      
      if (this.statusCode) {
        result += ` (${this.statusCode})`;
      }
      
      if (this.transactionId) {
        result += ` [txn:${this.transactionId}]`;
      }
      
      if (Object.keys(this.context || {}).length > 0) {
        result += ` - Context: ${JSON.stringify(this.context)}`;
      }
      
      return result;
    }
  
    /**
     * Create from API response error
     * @param {Object} error - API error response
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static fromApiError(error, options = {}) {
      const response = error.response || {};
      const headers = response.headers || {};
      const data = response.data || {};
      
      return new ApplicationError(
        data.message || error.message || 'API request failed',
        {
          statusCode: response.status,
          cause: error,
          context: {
            url: error.config?.url,
            method: error.config?.method,
            requestId: headers['x-request-id'] || headers['request-id'],
            responseTime: headers['x-response-time'],
            rateLimitRemaining: headers['x-rate-limit-remaining']
          },
          validationErrors: data.validationErrors || data.errors,
          isRetryable: response.status >= 500 || response.status === 429,
          retryAfter: headers['retry-after'] ? parseInt(headers['retry-after']) * 1000 : undefined,
          severity: response.status >= 500 ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
          category: ErrorCategory.INTEGRATION,
          errorCode: data.errorCode || data.code,
          transactionId: headers['x-transaction-id'],
          ...options
        }
      );
    }
  
    /**
     * Create network connectivity error
     * @param {Error} error - Original network error
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static networkError(error, options = {}) {
      return new ApplicationError('Network connectivity failure', {
        statusCode: 0,
        cause: error,
        context: {
          url: error.config?.url,
          online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
          connectionType: typeof navigator !== 'undefined' && navigator.connection ? 
            navigator.connection.effectiveType : undefined
        },
        isRetryable: true,
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.INFRASTRUCTURE,
        ...options
      });
    }
  
    /**
     * Create request timeout error 
     * @param {Error} error - Original timeout error
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static timeoutError(error, options = {}) {
      return new ApplicationError('Request timed out', {
        statusCode: 0,
        cause: error,
        context: {
          url: error.config?.url,
          timeout: error.config?.timeout,
          method: error.config?.method
        },
        isRetryable: true,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.INTEGRATION,
        ...options
      });
    }
  
    /**
     * Create database error
     * @param {Error} error - Original database error
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static databaseError(error, options = {}) {
      return new ApplicationError('Database operation failed', {
        statusCode: 500,
        cause: error,
        context: {
          operation: options.operation,
          entity: options.entity,
          constraint: error.constraint
        },
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATA,
        ...options
      });
    }
  
    /**
     * Create cache error
     * @param {Error} error - Original cache error
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static cacheError(error, options = {}) {
      return new ApplicationError('Cache operation failed', {
        statusCode: 500,
        cause: error,
        context: {
          operation: options.operation,
          key: options.key
        },
        isRetryable: true,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.INFRASTRUCTURE,
        ...options
      });
    }
  
    /**
     * Create service unavailable error
     * @param {string} serviceName - Name of unavailable service
     * @param {Object} [options] - Additional error options
     * @returns {ApplicationError} Structured error object
     */
    static serviceUnavailableError(serviceName, options = {}) {
      return new ApplicationError(`Service ${serviceName} is unavailable`, {
        statusCode: 503,
        context: {
          service: serviceName
        },
        isRetryable: true,
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.INFRASTRUCTURE,
        retryAfter: 60000, // Default 1 minute
        ...options
      });
    }
    
    /**
     * Register a global error monitor function
     * @param {Function} monitorFn - Error monitoring function
     */
    static registerErrorMonitor(monitorFn) {
      if (typeof window !== 'undefined') {
        window.__ERROR_MONITORS__ = window.__ERROR_MONITORS__ || [];
        window.__ERROR_MONITORS__.push(monitorFn);
      }
    }
  }
  
  // =============================================================================
  // Domain-specific error types
  // =============================================================================
  
  /**
   * Input validation failure
   * @extends ApplicationError
   */
  export class ValidationError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     * @param {Array<Object>} [options.validationErrors] - Validation error details
     */
    constructor(message = 'Validation failed', options = {}) {
      super(message, {
        statusCode: 400,
        validationErrors: options.validationErrors || [],
        isRetryable: false,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.INPUT,
        ...options
      });
    }
  
    /**
     * Create validation error from field errors
     * @param {Array<Object>} fieldErrors - Array of field validation errors
     * @returns {ValidationError} Structured validation error
     */
    static fromFieldErrors(fieldErrors) {
      const message = fieldErrors.length === 1
        ? `Invalid value for field: ${fieldErrors[0].field}`
        : `Invalid values for ${fieldErrors.length} fields`;
        
      return new ValidationError(message, {
        validationErrors: fieldErrors
      });
    }
  }
  
  /**
   * Authentication failure
   * @extends ApplicationError
   */
  export class AuthenticationError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message = 'Authentication failed', options = {}) {
      super(message, { 
        statusCode: 401,
        isRetryable: false,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.SECURITY,
        ...options
      });
    }
  }
  
  /**
   * Authorization failure 
   * @extends ApplicationError
   */
  export class AuthorizationError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message = 'Authorization failed', options = {}) {
      super(message, {
        statusCode: 403,
        isRetryable: false,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.SECURITY,
        ...options
      });
    }
  }
  
  /**
   * Resource not found
   * @extends ApplicationError
   */
  export class NotFoundError extends ApplicationError {
    /**
     * @param {string} resourceType - Type of resource not found
     * @param {string|number} identifier - Resource identifier
     * @param {Object} [options] - Error options
     */
    constructor(resourceType, identifier, options = {}) {
      super(`${resourceType} not found: ${identifier}`, {
        statusCode: 404,
        isRetryable: false,
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.BUSINESS,
        context: {
          resourceType,
          resourceId: identifier
        },
        resourceInfo: {
          type: resourceType,
          id: identifier
        },
        ...options
      });
    }
  }
  
  /**
   * Conflict/duplication error
   * @extends ApplicationError
   */
  export class ConflictError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message = 'Resource conflict', options = {}) {
      super(message, {
        statusCode: 409,
        isRetryable: false,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.DATA,
        ...options
      });
    }
  }
  
  /**
   * Rate limiting/throttling error
   * @extends ApplicationError
   */
  export class RateLimitError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     * @param {number} [options.retryAfter] - Retry after milliseconds
     */
    constructor(message = 'Rate limit exceeded', options = {}) {
      super(message, {
        statusCode: 429,
        isRetryable: true,
        retryAfter: options.retryAfter || 60000, // Default 1 minute
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.INFRASTRUCTURE,
        ...options
      });
    }
  }
  
  /**
   * Business logic error
   * @extends ApplicationError
   */
  export class BusinessError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message, options = {}) {
      super(message, {
        statusCode: 422,
        isRetryable: false,
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.BUSINESS,
        ...options
      });
    }
  }
  
  /**
   * System error
   * @extends ApplicationError
   */
  export class SystemError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message = 'System error occurred', options = {}) {
      super(message, {
        statusCode: 500,
        isRetryable: true,
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.INFRASTRUCTURE,
        ...options
      });
    }
  }
  
  /**
   * Configuration error
   * @extends ApplicationError
   */
  export class ConfigurationError extends ApplicationError {
    /**
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(message, options = {}) {
      super(message, {
        statusCode: 500,
        isRetryable: false, // Configuration errors typically can't be retried without changes
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.CONFIGURATION,
        ...options
      });
    }
  }
  
  /**
   * Integration error with third party services
   * @extends ApplicationError
   */
  export class IntegrationError extends ApplicationError {
    /**
     * @param {string} serviceName - Name of service with integration issues
     * @param {string} message - Error message
     * @param {Object} [options] - Error options
     */
    constructor(serviceName, message, options = {}) {
      super(`${serviceName} integration error: ${message}`, {
        statusCode: options.statusCode || 502,
        isRetryable: options.isRetryable !== undefined ? options.isRetryable : true,
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.INTEGRATION,
        context: {
          service: serviceName,
          ...options.context
        },
        ...options
      });
    }
  }
  
  // =============================================================================
  // Error boundary components
  // =============================================================================
  
  /**
   * Error boundary utility for React components
   * 
   * Usage:
   * ```jsx
   * <ErrorBoundary 
   *   fallback={<ErrorDisplay />}
   *   onError={(error) => logErrorToService(error)}
   * >
   *   <YourComponent />
   * </ErrorBoundary>
   * ```
   */
  export const createErrorBoundary = (React) => {
    return class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
  
      static getDerivedStateFromError(error) {
        return { error };
      }
  
      componentDidCatch(error, errorInfo) {
        // Convert to ApplicationError if it's not already
        const appError = error instanceof ApplicationError 
          ? error 
          : new ApplicationError(error.message, {
              cause: error,
              context: { componentStack: errorInfo.componentStack }
            });
            
        if (this.props.onError) {
          this.props.onError(appError);
        }
      }
  
      render() {
        if (this.state.error) {
          return this.props.fallback 
            ? React.createElement(this.props.fallback, { error: this.state.error })
            : null;
        }
  
        return this.props.children;
      }
    };
  };
  
  // =============================================================================
  // Error middleware for API frameworks
  // =============================================================================
  
  /**
   * Express error middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next function
   */
  export const expressErrorHandler = (err, req, res, next) => {
    // Convert to ApplicationError if it's not already
    const appError = err instanceof ApplicationError 
      ? err 
      : new ApplicationError(err.message, {
          cause: err,
          context: {
            url: req.url,
            method: req.method,
            params: req.params,
            query: req.query,
            headers: req.headers
          }
        });
  
    // Log the error (could be replaced with custom logger)
    console.error('API Error:', appError);
  
    // Send response
    res.status(appError.statusCode || 500).json({
      error: appError.name,
      message: appError.message,
      errorCode: appError.errorCode,
      validationErrors: appError.validationErrors,
      timestamp: appError.timestamp,
      requestId: req.headers['x-request-id'] || appError.requestId
    });
  };
  
  // =============================================================================
  // Error monitoring utilities
  // =============================================================================
  
  /**
   * Initialize error monitoring
   * @param {Object} options - Monitoring options
   */
  export const initErrorMonitoring = ({ 
    captureGlobalErrors = true,
    captureRejections = true, 
    captureConsoleErrors = true,
    errorReporter
  }) => {
    if (typeof window !== 'undefined') {
      // Register reporter function
      if (errorReporter) {
        ApplicationError.registerErrorMonitor(errorReporter);
      }
      
      // Global error handling
      if (captureGlobalErrors) {
        window.addEventListener('error', (event) => {
          const appError = new ApplicationError(event.message, {
            cause: event.error,
            context: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            },
            severity: ErrorSeverity.ERROR,
            category: ErrorCategory.INFRASTRUCTURE
          });
          
          // Notify registered monitors
          if (window.__ERROR_MONITORS__) {
            window.__ERROR_MONITORS__.forEach(monitor => monitor(appError));
          }
        });
      }
      
      // Unhandled promise rejections
      if (captureRejections) {
        window.addEventListener('unhandledrejection', (event) => {
          const appError = new ApplicationError(
            event.reason?.message || 'Unhandled Promise Rejection', 
            {
              cause: event.reason,
              severity: ErrorSeverity.ERROR,
              category: ErrorCategory.INFRASTRUCTURE
            }
          );
          
          // Notify registered monitors
          if (window.__ERROR_MONITORS__) {
            window.__ERROR_MONITORS__.forEach(monitor => monitor(appError));
          }
        });
      }
      
      // Console error capturing
      if (captureConsoleErrors) {
        const originalConsoleError = console.error;
        console.error = (...args) => {
          // Call original first
          originalConsoleError.apply(console, args);
          
          // Create an error from the first argument if it's a string
          if (typeof args[0] === 'string') {
            const appError = new ApplicationError(args[0], {
              context: {
                consoleArgs: args.slice(1)
              },
              severity: ErrorSeverity.ERROR
            });
            
            // Notify registered monitors
            if (window.__ERROR_MONITORS__) {
              window.__ERROR_MONITORS__.forEach(monitor => monitor(appError));
            }
          }
        };
      }
    }
  };