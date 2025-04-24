// src/hooks/useTranslation.js
import { useContext } from 'react';

/**
 * Simple translation hook for localizing error messages
 * In a real implementation, this would integrate with i18n frameworks
 * like react-i18next, react-intl, etc.
 */
export function useTranslation() {
  // In a real app, this would access the app's locale context
  // const { locale } = useContext(LocaleContext);
  
  /**
   * Translate a key to the current locale
   * @param {string} key - Translation key
   * @param {string} defaultValue - Default value if key not found
   * @param {Object} variables - Interpolation variables
   * @returns {string} Translated text
   */
  const t = (key, defaultValue, variables = {}) => {
    // This is a simplified implementation
    // In reality, you would load translations from language files or APIs
    
    // Return the default value with variables interpolated
    if (defaultValue) {
      return interpolateVariables(defaultValue, variables);
    }
    
    return key;
  };
  
  return { t };
}

/**
 * Interpolate variables into a string
 */
function interpolateVariables(text, variables) {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
    text
  );
}

// src/components/ErrorBoundary/index.js
import ErrorBoundary from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';
import { 
  ErrorContext, 
  useErrorBoundary, 
  withErrorBoundary,
  useErrorControl 
} from './ErrorContext';

/**
 * Creates a specialized error boundary for a specific part of the application
 * 
 * @param {string} name - Boundary name for identification
 * @param {Object} options - Additional configuration
 * @returns {React.ComponentType} Configured ErrorBoundary
 */
export function createBoundary(name, options = {}) {
  return (props) => (
    <ErrorBoundary 
      name={name}
      {...options}
      {...props}
    />
  );
}

// Pre-configured boundaries for common scenarios
export const GlobalErrorBoundary = createBoundary('GlobalBoundary', {
  // For app-level boundary, always report to server
  reportToServer: true,
  // Don't use remounting for the global boundary
  remountOnReset: false,
  // Show full details in development only
  showDetails: process.env.NODE_ENV === 'development',
  // Skip retries on critical errors
  shouldCaptureError: (error) => {
    // Let React internal errors pass through
    if (error.name === 'ChunkLoadError' || error.name === 'SyntaxError') {
      return false;
    }
    return true;
  }
});

export const FeatureErrorBoundary = createBoundary('FeatureBoundary', {
  // Feature boundaries should remount on reset
  remountOnReset: true,
  // No need to report all feature-level errors
  reportToServer: process.env.NODE_ENV === 'production',
  // More graceful recovery for features
  retryLimit: 2,
  // Less intrusive UI for feature failures
  FallbackComponent: ({ resetErrorBoundary }) => (
    <div className="p-4 border rounded bg-gray-50">
      <p className="text-sm text-gray-700">
        This feature is currently unavailable.
      </p>
      <button 
        onClick={resetErrorBoundary}
        className="mt-2 px-2 py-1 text-xs bg-gray-200 rounded"
      >
        Try Again
      </button>
    </div>
  )
});

export const WidgetErrorBoundary = createBoundary('WidgetBoundary', {
  // Widget failures are not critical
  reportToServer: false,
  // Widgets should always remount on reset
  remountOnReset: true,
  // Widgets can retry more often
  retryLimit: 5,
  // Quick exponential backoff 
  useBackoff: true,
  // Minimal UI footprint
  FallbackComponent: ({ resetErrorBoundary, canRetry }) => (
    <div className="p-2 text-xs text-gray-500 flex items-center justify-between">
      <span>Widget unavailable</span>
      {canRetry && (
        <button 
          onClick={resetErrorBoundary}
          className="text-blue-600 underline"
        >
          Reload
        </button>
      )}
    </div>
  )
});

/**
 * Higher-order component for lazy-loaded components with error handling
 * 
 * @param {Function} importFunc - Dynamic import function
 * @param {Object} options - Error boundary options
 * @returns {React.LazyExoticComponent} Lazy component with error boundary
 * 
 * @example
 * const Dashboard = safeLazy(() => import('./Dashboard'));
 */
export function safeLazy(importFunc, options = {}) {
  const LazyComponent = React.lazy(importFunc);
  
  const SafeComponent = (props) => (
    <ErrorBoundary
      name={`LazyBoundary(${options.name || 'Unknown'})`}
      retryLimit={1}
      {...options}
    >
      <React.Suspense fallback={options.fallback || <div>Loading...</div>}>
        <LazyComponent {...props} />
      </React.Suspense>
    </ErrorBoundary>
  );
  
  return SafeComponent;
}

/**
 * Utility function to test error boundaries
 * 
 * @param {string} message - Error message
 * @param {Object} options - Error options
 * @throws {Error} Controlled test error
 */
export function throwTestError(message = 'Test error', options = {}) {
  const error = new Error(message);
  error.name = options.name || 'TestError';
  error.__test = true;
  throw error;
}

export default {
  ErrorBoundary,
  ErrorFallback,
  GlobalErrorBoundary,
  FeatureErrorBoundary,
  WidgetErrorBoundary,
  useErrorBoundary,
  withErrorBoundary,
  useErrorControl,
  safeLazy,
  throwTestError,
};