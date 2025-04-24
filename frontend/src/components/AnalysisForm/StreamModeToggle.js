import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * StreamModeToggle Component
 * 
 * A toggle switch for enabling/disabling streaming mode with enhanced
 * accessibility, error handling, and customization options.
 */
const StreamModeToggle = ({ 
  streamMode = false, 
  onChange, 
  disabled = false,
  id = 'stream-mode-toggle',
  className = '',
  ariaLabel = 'Toggle streaming mode',
  label = 'Streaming mode',
  tooltipText = 'Enable to see results in real-time as they are generated',
  disabledTooltip = 'Streaming mode is not available for this analysis type',
  onEvent,
  darkMode = null
}) => {
  // Internal state tracking
  const [hasFocus, setHasFocus] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const toggleRef = useRef(null);
  
  // Detect dark mode if not explicitly set
  useEffect(() => {
    if (darkMode !== null) {
      setIsDarkMode(darkMode);
    } else {
      // Auto-detect dark mode
      const prefersDarkMode = window.matchMedia && 
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = document.documentElement.classList.contains('dark');
      setIsDarkMode(prefersDarkMode || hasDarkClass);
      
      // Listen for changes in dark mode preference
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleDarkModeChange = (e) => setIsDarkMode(e.matches);
      
      if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
      } else if (darkModeMediaQuery.addListener) { // For older browsers
        darkModeMediaQuery.addListener(handleDarkModeChange);
      }
      
      return () => {
        if (darkModeMediaQuery.removeEventListener) {
          darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
        } else if (darkModeMediaQuery.removeListener) { // For older browsers
          darkModeMediaQuery.removeListener(handleDarkModeChange);
        }
      };
    }
  }, [darkMode]);

  // Report event to telemetry
  const reportEvent = useCallback((eventName, data = {}) => {
    if (typeof onEvent === 'function') {
      onEvent(eventName, {
        component: 'StreamModeToggle',
        timestamp: new Date().toISOString(),
        streamMode,
        disabled,
        ...data
      });
    }
  }, [onEvent, streamMode, disabled]);

  // Handle toggle change with error handling
  const handleChange = useCallback(() => {
    try {
      if (disabled) return;
      
      // Track the event
      reportEvent('STREAM_MODE_TOGGLED', { newValue: !streamMode });
      
      // Call the provided onChange handler
      onChange(!streamMode);
    } catch (error) {
      console.error('Error toggling stream mode:', error);
      reportEvent('TOGGLE_ERROR', { error: error.message });
    }
  }, [onChange, streamMode, disabled, reportEvent]);

  // Handle keyboard accessibility
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChange();
      reportEvent('KEYBOARD_TOGGLE', { key: e.key });
    }
  }, [handleChange, disabled, reportEvent]);

  // Enhanced focus handling
  const handleFocus = useCallback(() => {
    setHasFocus(true);
    reportEvent('TOGGLE_FOCUS');
  }, [reportEvent]);

  const handleBlur = useCallback(() => {
    setHasFocus(false);
    reportEvent('TOGGLE_BLUR');
  }, [reportEvent]);

  // Calculate classes based on state
  const checkboxClasses = `
    form-checkbox h-4 w-4 
    ${disabled 
      ? 'text-gray-400 cursor-not-allowed' 
      : 'text-blue-600 cursor-pointer'
    }
    ${hasFocus && !disabled ? 'ring-2 ring-blue-300' : ''}
    transition duration-150 ease-in-out
  `;

  const labelClasses = `
    ml-2 
    ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}
    ${disabled ? 'opacity-60' : ''}
    text-sm
  `;

  return (
    <div 
      className={`stream-mode-toggle flex items-center space-x-2 ${className}`}
      role="region"
      aria-labelledby={`${id}-label`}
    >
      <label 
        htmlFor={id}
        id={`${id}-label`}
        className="inline-flex items-center" 
      >
        <input
          ref={toggleRef}
          id={id}
          type="checkbox"
          className={checkboxClasses}
          checked={streamMode}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-checked={streamMode}
          aria-disabled={disabled}
          title={disabled ? disabledTooltip : tooltipText}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-testid="stream-mode-checkbox"
        />
        <span className={labelClasses}>
          {label}
        </span>
      </label>
      
      {/* Tooltip shown on hover - visible to screen readers */}
      <span 
        className="sr-only" 
        aria-live="polite"
      >
        {disabled ? disabledTooltip : tooltipText}
      </span>
    </div>
  );
};

// PropTypes for documentation and better development experience
StreamModeToggle.propTypes = {
  /** Current state of the streaming mode */
  streamMode: PropTypes.bool,
  
  /** Handler function called when toggle changes */
  onChange: PropTypes.func.isRequired,
  
  /** Whether the toggle is disabled */
  disabled: PropTypes.bool,
  
  /** Unique ID for the toggle (for accessibility) */
  id: PropTypes.string,
  
  /** Additional CSS classes to apply */
  className: PropTypes.string,
  
  /** Accessible label for screen readers */
  ariaLabel: PropTypes.string,
  
  /** Text label displayed next to toggle */
  label: PropTypes.string,
  
  /** Tooltip text explaining the toggle's purpose */
  tooltipText: PropTypes.string,
  
  /** Tooltip text shown when toggle is disabled */
  disabledTooltip: PropTypes.string,
  
  /** Event callback for telemetry/analytics */
  onEvent: PropTypes.func,
  
  /** Explicitly set dark mode (null for auto-detect) */
  darkMode: PropTypes.bool
};

// Remove defaultProps and use only parameter defaults
// StreamModeToggle.defaultProps = {...}

export default StreamModeToggle;