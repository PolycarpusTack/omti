// src/services/errorLogging.js

/**
 * Enhanced error logging service with intelligent routing, batching,
 * and integration with multiple monitoring platforms
 */

// Configuration - typically load from environment
const ERROR_CONFIG = {
    // Main error service provider
    primary: {
      service: 'sentry', // sentry, datadog, newrelic, etc.
      dsn: process.env.REACT_APP_ERROR_MONITORING_DSN,
      environment: process.env.REACT_APP_ENVIRONMENT || 'development',
      release: process.env.REACT_APP_VERSION || '0.0.0',
      sampleRate: parseFloat(process.env.REACT_APP_ERROR_SAMPLE_RATE || '1.0'),
    },
    // Optional secondary logging for critical errors
    secondary: process.env.REACT_APP_SECONDARY_ERROR_SERVICE,
    // Local logging options
    console: {
      enabled: process.env.NODE_ENV !== 'production',
      level: process.env.REACT_APP_LOG_LEVEL || 'error',
    },
    // Error filtering
    ignorePatterns: [
      // Common non-actionable errors
      'ResizeObserver loop', 
      'Network request failed',
      'Failed to fetch',
      'Load failed',
    ],
    // Critical errors always reported at 100% sample rate
    criticalPatterns: [
      'FATAL',
      'Out of memory',
      'SecurityError',
      'Authentication failed',
      'Permission denied'
    ],
    // Rate limiting to prevent reporting storms
    rateLimit: {
      maxErrorsPerMinute: 10,
      ttlSeconds: 60,
    }
  };
  
  // Error queue for batching
  let errorQueue = [];
  let isProcessing = false;
  let errorCount = 0;
  let lastResetTime = Date.now();
  
  // Error service instances
  let primaryService = null;
  let secondaryService = null;
  
  /**
   * Initialize error logging services
   */
  export function initErrorLogging() {
    // Reset counters periodically
    setInterval(() => {
      errorCount = 0;
      lastResetTime = Date.now();
    }, ERROR_CONFIG.rateLimit.ttlSeconds * 1000);
    
    // Initialize primary service
    if (ERROR_CONFIG.primary.service === 'sentry' && window.Sentry) {
      window.Sentry.init({
        dsn: ERROR_CONFIG.primary.dsn,
        environment: ERROR_CONFIG.primary.environment,
        release: ERROR_CONFIG.primary.release,
        tracesSampleRate: ERROR_CONFIG.primary.sampleRate,
        beforeSend: (event) => processSentryEvent(event),
        integrations: [
          new window.Sentry.Integrations.BrowserTracing(),
          new window.Sentry.Integrations.Breadcrumbs({
            console: true,
            dom: true,
            fetch: true,
            history: true,
            xhr: true,
          }),
        ],
      });
      primaryService = window.Sentry;
    }
    
    // Initialize secondary service if configured
    if (ERROR_CONFIG.secondary === 'datadog' && window.DD_RUM) {
      window.DD_RUM.init({
        applicationId: process.env.REACT_APP_DATADOG_APP_ID,
        clientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN,
        site: process.env.REACT_APP_DATADOG_SITE || 'us1.datadoghq.com',
        service: process.env.REACT_APP_SERVICE_NAME,
        env: ERROR_CONFIG.primary.environment,
        version: ERROR_CONFIG.primary.release,
        sessionSampleRate: ERROR_CONFIG.primary.sampleRate,
        trackInteractions: true,
      });
      secondaryService = window.DD_RUM;
    }
    
    // Set up global error handler as a fallback
    setupGlobalErrorHandler();
  }
  
  /**
   * Setup global error handler for uncaught errors
   */
  function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      // Only handle errors not already caught by error boundaries
      if (!event.error.__boundary_handled) {
        logErrorToService(event.error, {
          source: 'window.onerror',
          context: {
            location: window.location.href,
            timestamp: new Date().toISOString(),
          }
        });
      }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      logErrorToService(event.reason, {
        source: 'unhandledrejection',
        context: {
          location: window.location.href,
          timestamp: new Date().toISOString(),
        }
      });
    });
  }
  
  /**
   * Main error logging function
   * 
   * @param {Error} error - The error object
   * @param {Object} options - Additional context and metadata
   * @param {string} options.componentStack - React component stack
   * @param {Object} options.context - Error context information
   * @param {string} options.boundary - Name of the error boundary
   * @param {boolean} options.critical - Flag for critical errors
   */
  export function logErrorToService(error, options = {}) {
    // Mark error as handled by boundary to prevent double-reporting
    error.__boundary_handled = true;
    
    // Check if we should ignore this error based on patterns
    if (shouldIgnoreError(error)) {
      consoleLog('info', 'Ignoring error based on pattern:', error.message);
      return;
    }
    
    // Check for rate limiting unless critical
    if (!options.critical && shouldRateLimit()) {
      consoleLog('warn', 'Rate limiting applied, error not reported:', error.message);
      return;
    }
    
    // Determine if this is a critical error
    const isCritical = options.critical || isCriticalError(error);
    
    // Add to processing queue
    errorQueue.push({
      error,
      options: {
        ...options,
        critical: isCritical,
        timestamp: new Date().toISOString(),
      }
    });
    
    // Start processing if not already in progress
    if (!isProcessing) {
      processErrorQueue();
    }
  }
  
  /**
   * Process the error queue with batching
   */
  async function processErrorQueue() {
    if (isProcessing || errorQueue.length === 0) {
      return;
    }
    
    isProcessing = true;
    const batchSize = 5;
    
    try {
      // Process in small batches
      while (errorQueue.length > 0) {
        const batch = errorQueue.splice(0, batchSize);
        
        // Process each error in the batch
        const promises = batch.map(({ error, options }) => 
          processError(error, options)
        );
        
        await Promise.all(promises);
        
        // Short delay between batches to prevent blocking the main thread
        if (errorQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (err) {
      // Fallback error handling if our error processor itself fails
      consoleLog('error', 'Error in error processing:', err);
    } finally {
      isProcessing = false;
    }
  }
  
  /**
   * Process a single error
   * 
   * @param {Error} error - The error object
   * @param {Object} options - Error options and context
   */
  async function processError(error, options) {
    // Sanitize and enrich error data
    const enrichedError = enrichErrorData(error, options);
    
    // Log to console in development
    if (ERROR_CONFIG.console.enabled) {
      const level = options.critical ? 'error' : 'warn';
      consoleLog(level, 'Error captured:', enrichedError.message);
      consoleLog(level, 'Context:', options.context);
      if (options.componentStack) {
        consoleLog(level, 'Component stack:', options.componentStack);
      }
    }
    
    // Always track error count for rate limiting
    errorCount++;
    
    // Report to primary service
    if (primaryService) {
      try {
        if (ERROR_CONFIG.primary.service === 'sentry') {
          primaryService.withScope((scope) => {
            // Add all context as tags and extras
            if (options.context) {
              Object.entries(options.context).forEach(([key, value]) => {
                // Use tags for important categorical data
                if (['environment', 'release', 'boundary', 'route'].includes(key)) {
                  scope.setTag(key, value);
                } else {
                  // Use extras for detailed context
                  scope.setExtra(key, value);
                }
              });
            }
            
            // Set user context if available
            if (options.context?.userId) {
              scope.setUser({ id: options.context.userId });
            }
            
            // Add component stack if available
            if (options.componentStack) {
              scope.setExtra('componentStack', options.componentStack);
            }
            
            // Set error level based on criticality
            scope.setLevel(options.critical ? 'fatal' : 'error');
            
            // Capture the error
            primaryService.captureException(enrichedError);
          });
        }
      } catch (err) {
        consoleLog('error', 'Failed to report to primary service:', err);
      }
    }
    
    // Report critical errors to secondary service if available
    if (secondaryService && options.critical) {
      try {
        if (ERROR_CONFIG.secondary === 'datadog') {
          secondaryService.addError(enrichedError, {
            source: options.boundary || 'react',
            ...options.context
          });
        }
      } catch (err) {
        consoleLog('error', 'Failed to report to secondary service:', err);
      }
    }
  }
  
  /**
   * Enrich error data with additional context and standardization
   * 
   * @param {Error} error - Original error
   * @param {Object} options - Error options
   * @returns {Error} Enriched error
   */
  function enrichErrorData(error, options) {
    // Create a new error to avoid modifying the original
    const enriched = new Error(error.message);
    
    // Copy all properties from the original error
    Object.getOwnPropertyNames(error).forEach(prop => {
      enriched[prop] = error[prop];
    });
    
    // Add standardized properties for consistent reporting
    enriched.originalStack = error.stack;
    enriched.name = error.name || 'Error';
    enriched.source = options.boundary || 'unknown';
    enriched.timestamp = options.timestamp;
    enriched.critical = options.critical;
    
    // Add component stack if available
    if (options.componentStack) {
      enriched.componentStack = options.componentStack;
    }
    
    return enriched;
  }
  
  /**
   * Sentry-specific event processor
   * 
   * @param {Object} event - Sentry event
   * @returns {Object|null} Processed event or null to drop
   */
  function processSentryEvent(event) {
    // Check sampling for non-critical errors
    if (!event.tags?.critical && Math.random() > ERROR_CONFIG.primary.sampleRate) {
      return null; // Drop based on sample rate
    }
    
    // Filter out PII
    if (event.request && event.request.cookies) {
      event.request.cookies = '[Filtered]';
    }
    
    // Sanitize stack trace
    if (event.exception && event.exception.values) {
      event.exception.values.forEach(ex => {
        if (ex.stacktrace && ex.stacktrace.frames) {
          ex.stacktrace.frames.forEach(frame => {
            // Redact potential tokens or secrets in URLs
            if (frame.filename && frame.filename.includes('?')) {
              frame.filename = frame.filename.split('?')[0] + '?[REDACTED]';
            }
          });
        }
      });
    }
    
    return event;
  }
  
  /**
   * Check if an error should be ignored based on patterns
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} True if error should be ignored
   */
  function shouldIgnoreError(error) {
    const message = error.message || '';
    return ERROR_CONFIG.ignorePatterns.some(pattern => 
      message.includes(pattern)
    );
  }
  
  /**
   * Check if this is a critical error that bypasses sampling
   * 
   * @param {Error} error - The error to check
   * @returns {boolean} True if critical error
   */
  function isCriticalError(error) {
    const message = error.message || '';
    const name = error.name || '';
    
    return ERROR_CONFIG.criticalPatterns.some(pattern => 
      message.includes(pattern) || name.includes(pattern)
    );
  }
  
  /**
   * Check if we should rate limit error reporting
   * 
   * @returns {boolean} True if should rate limit
   */
  function shouldRateLimit() {
    const timeWindow = (Date.now() - lastResetTime) / 1000;
    const errorsPerMinute = (errorCount / timeWindow) * 60;
    
    return errorsPerMinute > ERROR_CONFIG.rateLimit.maxErrorsPerMinute;
  }
  
  /**
   * Consistent console logging based on config
   * 
   * @param {string} level - Log level
   * @param {...any} args - Console arguments
   */
  function consoleLog(level, ...args) {
    const levels = ['error', 'warn', 'info', 'debug'];
    const configLevel = ERROR_CONFIG.console.level || 'error';
    
    // Only log if this level is enabled in config
    if (ERROR_CONFIG.console.enabled && 
        levels.indexOf(level) <= levels.indexOf(configLevel)) {
      console[level](...args);
    }
  }
  
  /**
   * Manually report an error from anywhere in the application
   * 
   * @param {Error|string} error - Error or error message 
   * @param {Object} context - Additional context
   * @param {boolean} critical - Mark as critical
   */
  export function reportError(error, context = {}, critical = false) {
    // Convert string to Error if needed
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    logErrorToService(errorObj, {
      context,
      critical,
      source: 'manual',
    });
  }
  
  /**
   * Create an error monitoring hook for components
   * 
   * @returns {Object} Error reporting utilities
   */
  export function useErrorReporting() {
    return {
      reportError,
      captureException: (error, context) => reportError(error, context, false),
      captureMessage: (message, context) => reportError(message, context, false),
      captureCritical: (error, context) => reportError(error, context, true),
    };
  }
  
  // Auto-initialize if in browser environment
  if (typeof window !== 'undefined') {
    // Initialize lazily to avoid blocking the main thread
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(initErrorLogging, 0);
    });
  }