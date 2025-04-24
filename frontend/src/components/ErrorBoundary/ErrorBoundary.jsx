// src/components/ErrorBoundary/ErrorBoundary.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { ErrorContext } from './ErrorContext';
import { ErrorFallback } from './ErrorFallback';
import { logErrorToService } from '../../services/errorLogging';

/**
 * @typedef {Object} ErrorBoundaryState
 * @property {boolean} hasError - Error detection flag
 * @property {Error|null} error - Captured error instance
 * @property {React.ErrorInfo|null} errorInfo - Additional error info
 * @property {number} retryCount - Number of retry attempts
 * @property {number|null} retryTimerId - ID of the current retry timer
 */

/**
 * Enterprise-grade React error boundary component with comprehensive error handling,
 * recovery features, observability, and accessibility support
 * 
 * @typedef {Object} ErrorBoundaryProps
 * @property {React.ReactNode} children - Child components to monitor
 * @property {React.ElementType} [FallbackComponent] - Custom fallback UI component
 * @property {boolean} [reportToServer=true] - Enable error reporting
 * @property {Function} [onError] - Error callback handler (error, errorInfo) => void
 * @property {Function} [onReset] - Reset callback handler () => void
 * @property {boolean} [showDetails] - Display error details in UI
 * @property {number} [retryLimit=3] - Max reset attempts
 * @property {boolean} [useBackoff=true] - Use exponential backoff for retries
 * @property {string} [name] - Identifier for this boundary (for logging)
 * @property {Object} [metadata] - Additional context to include in error reports
 * @property {Function} [resetBoundary] - Optional external reset function
 * @property {boolean} [remountOnReset=false] - Force component remount on reset
 * @property {boolean} [a11yFocus=true] - Auto-focus on error UI for screen readers
 * @property {Function} [shouldCaptureError] - Predicate to determine if an error should be captured
 */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    /** @type {ErrorBoundaryState} */
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      retryTimerId: null
    };
    
    this.fallbackRef = React.createRef();
  }

  static propTypes = {
    children: PropTypes.node.isRequired,
    FallbackComponent: PropTypes.elementType,
    reportToServer: PropTypes.bool,
    onError: PropTypes.func,
    onReset: PropTypes.func,
    showDetails: PropTypes.bool,
    retryLimit: PropTypes.number,
    useBackoff: PropTypes.bool,
    name: PropTypes.string,
    metadata: PropTypes.object,
    resetBoundary: PropTypes.func,
    remountOnReset: PropTypes.bool,
    a11yFocus: PropTypes.bool,
    shouldCaptureError: PropTypes.func
  };

  static defaultProps = {
    reportToServer: true,
    retryLimit: 3,
    useBackoff: true,
    showDetails: process.env.NODE_ENV === 'development',
    remountOnReset: false,
    a11yFocus: true,
    shouldCaptureError: () => true
  };

  /**
   * Static lifecycle method to capture errors synchronously before render
   * @param {Error} error - The error that was thrown
   * @returns {Partial<ErrorBoundaryState>} Updated state
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method called after an error is caught
   * @param {Error} error - The error that was thrown
   * @param {React.ErrorInfo} errorInfo - Additional error info from React
   */
  componentDidCatch(error, errorInfo) {
    const { reportToServer, onError, shouldCaptureError, name } = this.props;

    // Check if we should handle this error
    if (!shouldCaptureError(error, errorInfo)) {
      return;
    }

    // Set error info in state
    this.setState({ errorInfo });

    // Log to error monitoring service
    if (reportToServer) {
      const context = this.getErrorContext();
      logErrorToService(error, {
        componentStack: errorInfo.componentStack,
        context,
        boundary: name
      });
    }

    // Send telemetry data
    this.trackErrorOccurrence(error);

    // Notify parent components
    onError?.(error, errorInfo);
  }

  /**
   * Track error metrics for observability
   * @param {Error} error - The error that triggered the boundary
   */
  trackErrorOccurrence(error) {
    // Implementation depends on your analytics platform
    // Example with a generic tracker:
    if (window.analytics) {
      window.analytics.track('Error Boundary Triggered', {
        errorMessage: error.message,
        errorName: error.name,
        boundaryName: this.props.name,
        timestamp: new Date().toISOString(),
        retryCount: this.state.retryCount
      });
    }
  }

  /**
   * Collect contextual information about the error environment
   * @returns {Object} Error context information
   */
  getErrorContext() {
    const { metadata } = this.props;
    const userSession = this.getUserSessionInfo();
  
    return {
      location: window.location.href,
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
      sessionDuration: performance.now(),
      memoryUsage: performance.memory?.usedJSHeapSize,
      connectionType: navigator.connection?.effectiveType,
      ...userSession,
      ...metadata
    };
  }

  /**
   * Extract sanitized user session information for error context
   * @returns {Object} User session data
   */
  getUserSessionInfo() {
    // Safely extract user info from your app's auth system
    // without including PII or sensitive data
    const user = window.APP_USER || {};
    
    return {
      // Only include non-PII data
      userRole: user.role,
      isAuthenticated: !!user.id,
      userLocale: user.locale || navigator.language,
      // Include a hash instead of actual ID if needed for correlation
      userIdHash: user.id ? this.hashIdentifier(user.id) : null
    };
  }

  /**
   * Create a hash of an identifier to avoid storing PII directly
   * @param {string} identifier - The ID to hash
   * @returns {string} Hashed identifier
   */
  hashIdentifier(identifier) {
    // Simple hash function for demo purposes
    // In production, use a proper hashing algorithm
    return Array.from(identifier.toString())
      .reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0)
      .toString(36);
  }

  /**
   * Sanitize error stack to remove sensitive information
   * @param {string} stack - Raw error stack trace
   * @returns {string} Sanitized stack trace
   */
  sanitizeErrorStack(stack) {
    if (!stack) return '';
    
    // Remove file paths that might contain sensitive info
    let sanitized = stack.replace(/\(.*?\)/g, '');
    
    // Remove query params from URLs (may contain tokens/keys)
    sanitized = sanitized.replace(/\?[^:\s]+/g, '?[REDACTED]');
    
    // Redact potential PII or sensitive data patterns
    sanitized = sanitized.replace(/([A-Za-z0-9+/]{40,})/g, '[POTENTIAL_TOKEN_REDACTED]');
    
    return sanitized;
  }

  /**
   * Handle component state reset with optional backoff
   */
  handleReset = () => {
    const { retryCount, retryTimerId } = this.state;
    const { retryLimit, onReset, useBackoff } = this.props;

    // Clear any pending timers
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
    }

    // Check retry limits
    if (retryCount >= retryLimit) {
      this.setState({ hasError: true });
      return;
    }

    // Calculate backoff delay
    const delay = useBackoff 
      ? Math.min(Math.pow(2, retryCount) * 350, 30000) // Max 30s delay
      : 0;

    if (delay > 0) {
      const timerId = setTimeout(() => this.doReset(), delay);
      this.setState({ retryTimerId: timerId });
    } else {
      this.doReset();
    }
  };

  /**
   * Perform the actual reset operation
   */
  doReset = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      retryTimerId: null
    }));

    // Optional callback for parent notification
    this.props.onReset?.();
  };

  /**
   * Focus management for accessibility
   * @param {Object} prevProps - Previous props
   * @param {ErrorBoundaryState} prevState - Previous state
   */
  componentDidUpdate(prevProps, prevState) {
    // Focus management for screen readers
    if (this.props.a11yFocus && 
        this.state.hasError && 
        !prevState.hasError && 
        this.fallbackRef.current) {
      this.fallbackRef.current.focus();
    }
  }

  /**
   * Clean up any timers when unmounting
   */
  componentWillUnmount() {
    if (this.state.retryTimerId !== null) {
      clearTimeout(this.state.retryTimerId);
    }
  }

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { 
      children, 
      FallbackComponent, 
      showDetails, 
      retryLimit,
      remountOnReset
    } = this.props;

    // If no error, render children normally
    if (!hasError) {
      // Use resetKey for remounting when retrying if enabled
      const resetKey = remountOnReset ? retryCount : undefined;
      
      return (
        <ErrorContext.Provider value={{ 
          resetBoundary: this.handleReset, 
          error, 
          resetCount: retryCount 
        }}>
          <div key={resetKey}>
            {children}
          </div>
        </ErrorContext.Provider>
      );
    }

    // Prepare error details for the fallback
    const errorDetails = showDetails ? {
      message: error?.toString() || 'Unknown error',
      stack: this.sanitizeErrorStack(errorInfo?.componentStack),
      retryCount,
      retryLimit,
      occurredAt: new Date().toISOString()
    } : null;

    const canRetry = retryCount < retryLimit;

    // Render the fallback UI
    const fallbackProps = {
      error,
      errorInfo,
      errorDetails,
      retryCount,
      retryLimit,
      canRetry,
      resetErrorBoundary: this.handleReset
    };

    return (
      <div 
        className="error-boundary-container" 
        ref={this.fallbackRef} 
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
      >
        {FallbackComponent ? (
          <FallbackComponent {...fallbackProps} />
        ) : (
          <ErrorFallback {...fallbackProps} />
        )}
      </div>
    );
  }
}

export default ErrorBoundary;