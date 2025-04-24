// src/components/ErrorBoundary/ErrorContext.jsx
import React, { createContext, useContext } from 'react';

/**
 * Context for providing error boundary state and controls to child components
 * 
 * This allows deep components to:
 * 1. Trigger resets of their parent error boundary
 * 2. Access error information
 * 3. Know if they're currently in a recovery cycle
 */
export const ErrorContext = createContext({
  resetBoundary: () => {},
  error: null,
  resetCount: 0
});

/**
 * Custom hook to access the nearest error boundary context
 * 
 * @returns {Object} Error context
 * @returns {Function} resetBoundary - Function to reset the parent error boundary
 * @returns {Error|null} error - Current error if any
 * @returns {number} resetCount - Number of times boundary has been reset
 */
export const useErrorBoundary = () => {
  return useContext(ErrorContext);
};

/**
 * HOC to wrap components with an error boundary
 * 
 * @param {React.ComponentType} Component - Component to wrap
 * @param {Object} options - Error boundary options
 * @returns {React.ComponentType} Wrapped component with error boundary
 * 
 * @example
 * const SafeWidget = withErrorBoundary(Widget, {
 *   FallbackComponent: CustomFallback,
 *   name: 'WidgetBoundary'
 * });
 */
export const withErrorBoundary = (Component, options = {}) => {
  // We'll import the ErrorBoundary dynamically to avoid circular dependencies
  const ErrorBoundary = require('./ErrorBoundary').default;
  
  const WithErrorBoundary = (props) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  // Copy displayName for better debugging
  const displayName = Component.displayName || Component.name || 'Component';
  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return WithErrorBoundary;
};

/**
 * A wrapper hook that provides error boundary functionality to function components
 * 
 * @returns {Object} Error boundary controls
 * @returns {Function} throwBoundaryError - Function to manually throw an error to the nearest boundary
 * @returns {Function} resetBoundary - Function to reset the nearest boundary
 * @returns {boolean} hasReset - Whether boundary has been reset at least once
 */
export const useErrorControl = () => {
  const { resetBoundary, resetCount } = useErrorBoundary();
  
  const throwBoundaryError = (error) => {
    // Create a properly structured error if string is passed
    if (typeof error === 'string') {
      throw new Error(error);
    }
    // Otherwise throw the error as-is
    throw error;
  };
  
  return {
    throwBoundaryError,
    resetBoundary,
    hasReset: resetCount > 0
  };
};