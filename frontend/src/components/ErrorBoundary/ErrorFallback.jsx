// src/components/ErrorBoundary/ErrorFallback.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Default error fallback UI component
 * Features:
 * - Accessible error presentation
 * - Localized error messages
 * - Technical details expansion
 * - Contact support option
 * - Retry with visual feedback
 * 
 * @param {Object} props - Component props
 * @param {Object} props.error - The error that was caught
 * @param {Object} props.errorInfo - React error info object
 * @param {Object} props.errorDetails - Formatted error details for display
 * @param {number} props.retryCount - Current retry count
 * @param {number} props.retryLimit - Maximum allowed retries
 * @param {boolean} props.canRetry - Whether retry is possible
 * @param {Function} props.resetErrorBoundary - Function to reset the error boundary
 */
export const ErrorFallback = ({ 
  error,
  errorInfo,
  errorDetails,
  retryCount,
  retryLimit,
  canRetry,
  resetErrorBoundary
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const { t } = useTranslation();
  
  // Handle retry with visual feedback
  const handleRetry = () => {
    if (!canRetry) return;
    
    setIsRetrying(true);
    // Small delay to show loading state before reset
    setTimeout(() => {
      resetErrorBoundary();
      setIsRetrying(false);
    }, 500);
  };

  // Determine if we should show contact support instead of retry
  const showContactSupport = !canRetry || retryCount >= Math.floor(retryLimit / 2);
  
  // Get error severity level (for styling/messaging)
  const severityLevel = getSeverityLevel(error);
  
  return (
    <div 
      className={`error-boundary p-4 border rounded-md max-w-3xl mx-auto shadow-md ${getSeverityStyles(severityLevel)}`}
      data-testid="error-fallback"
      data-error-type={error?.name}
      data-retry-count={retryCount}
    >
      <div className="error-header flex items-center gap-2 mb-3">
        <span className="error-icon text-2xl" aria-hidden="true">
          {getSeverityIcon(severityLevel)}
        </span>
        <h2 className="text-xl font-semibold">
          {t('errorBoundary.title', 'Application Error')}
        </h2>
      </div>
      
      <div className="error-message mb-4">
        <p className="text-sm">
          {t('errorBoundary.message', 'An unexpected error occurred while displaying this content.')}
        </p>
        
        {!showContactSupport && (
          <p className="text-sm mt-2">
            {t('errorBoundary.retryMessage', 'You can try again or refresh the page to resolve this issue.')}
          </p>
        )}
        
        {showContactSupport && (
          <p className="text-sm mt-2">
            {t('errorBoundary.supportMessage', 'If this issue persists, please contact support.')}
          </p>
        )}
      </div>
      
      {/* Conditional technical details for developers/debugging */}
      {errorDetails && (
        <details 
          className="text-xs mt-4 p-2 bg-gray-50 rounded border border-gray-200"
          data-testid="error-details"
        >
          <summary className="cursor-pointer font-medium">
            {t('errorBoundary.technicalDetails', 'Technical Details')}
          </summary>
          <div className="mt-2 space-y-2 overflow-auto max-h-64">
            <div className="font-semibold">
              {t('errorBoundary.errorMessage', 'Error Message')}:
            </div>
            <p className="font-mono whitespace-pre-wrap break-words p-2 bg-gray-100 rounded">
              {errorDetails.message}
            </p>
            
            {errorDetails.stack && (
              <>
                <div className="font-semibold mt-3">
                  {t('errorBoundary.componentStack', 'Component Stack')}:
                </div>
                <pre className="text-xs p-2 bg-gray-100 rounded overflow-auto">
                  {errorDetails.stack}
                </pre>
              </>
            )}
            
            <div className="mt-3 flex flex-col text-xs space-y-1">
              <div>
                {t('errorBoundary.occurredAt', 'Occurred at')}: {formatDate(errorDetails.occurredAt)}
              </div>
              <div>
                {t('errorBoundary.retryStatus', 'Retry')} {errorDetails.retryCount} {t('errorBoundary.of', 'of')} {errorDetails.retryLimit}
              </div>
            </div>
          </div>
        </details>
      )}
      
      <div className="error-actions mt-5 flex flex-wrap gap-3">
        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className={`px-4 py-2 text-sm rounded transition-colors 
            ${canRetry 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          disabled={!canRetry || isRetrying}
          aria-busy={isRetrying}
          data-testid="retry-button"
        >
          {isRetrying ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="small" />
              {t('errorBoundary.retrying', 'Retrying...')}
            </span>
          ) : (
            canRetry 
              ? t('errorBoundary.tryAgain', 'Try Again') 
              : t('errorBoundary.maxRetries', 'Max Retries Reached')
          )}
        </button>
        
        {/* Reload Page Button */}
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm border border-gray-300 bg-white hover:bg-gray-50 rounded transition-colors"
          data-testid="reload-button"
        >
          {t('errorBoundary.refreshPage', 'Refresh Page')}
        </button>
        
        {/* Contact Support Button - conditional */}
        {showContactSupport && (
          <a
            href={getContactSupportUrl(error)}
            className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="contact-support-button"
          >
            {t('errorBoundary.contactSupport', 'Contact Support')}
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * Simple loading spinner component
 */
const LoadingSpinner = ({ size = 'medium' }) => {
  const sizeClass = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  }[size];
  
  return (
    <svg 
      className={`animate-spin ${sizeClass}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

/**
 * Generate contact support URL with error context
 */
function getContactSupportUrl(error) {
  const baseUrl = '/support'; // or 'mailto:support@yourcompany.com'
  const params = new URLSearchParams({
    subject: `Error: ${error?.name || 'Application Error'}`,
    errorCode: error?.code || 'UNKNOWN'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Format date string for display
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(navigator.language, {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

/**
 * Get error severity level for UI presentation
 */
function getSeverityLevel(error) {
  // Customize based on your error types
  if (!error) return 'warning';
  
  const errorName = error.name?.toLowerCase() || '';
  const message = error.message?.toLowerCase() || '';
  
  if (
    errorName.includes('fatal') || 
    message.includes('fatal') ||
    message.includes('crash') ||
    error.status >= 500
  ) {
    return 'critical';
  }
  
  if (
    errorName.includes('reference') ||
    errorName.includes('syntax') ||
    errorName.includes('type')
  ) {
    return 'error';
  }
  
  return 'warning';
}

/**
 * Get CSS classes based on severity level
 */
function getSeverityStyles(level) {
  switch (level) {
    case 'critical':
      return 'bg-red-50 border-red-300 text-red-800';
    case 'error':
      return 'bg-orange-50 border-orange-300 text-orange-800';
    case 'warning':
    default:
      return 'bg-amber-50 border-amber-300 text-amber-800';
  }
}

/**
 * Get icon based on severity level
 */
function getSeverityIcon(level) {
  switch (level) {
    case 'critical':
      return '⛔';
    case 'error':
      return '⚠️';
    case 'warning':
    default:
      return '⚠️';
  }
}

ErrorFallback.propTypes = {
  error: PropTypes.object,
  errorInfo: PropTypes.object,
  errorDetails: PropTypes.shape({
    message: PropTypes.string,
    stack: PropTypes.string,
    retryCount: PropTypes.number,
    retryLimit: PropTypes.number,
    occurredAt: PropTypes.string
  }),
  retryCount: PropTypes.number.isRequired,
  retryLimit: PropTypes.number.isRequired,
  canRetry: PropTypes.bool.isRequired,
  resetErrorBoundary: PropTypes.func.isRequired
};

export default ErrorFallback;