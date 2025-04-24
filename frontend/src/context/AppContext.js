// context/AppContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, useReducer, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

/**
 * Constant for logging namespace
 * @constant {string}
 */
const LOG_NAMESPACE = '[AppContext]';

/**
 * Debug mode flag - set to true to enable more verbose logging
 * Can be overridden by setting localStorage.debug_appcontext
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development';

/**
 * Check if we're running in a browser environment
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Configuration for AppContext behavior 
 */
const CONFIG = {
  enableDeepClone: true,           // Enable/disable expensive deep cloning
  persistStateToStorage: true,     // Enable/disable localStorage persistence
  storageKey: 'app_context_state', // Key for localStorage persistence
  autoSaveInterval: 30000,         // Auto-save interval (30 seconds)
  compressionThreshold: 10000,     // Compress storage if state is larger than this
};

/**
 * Default state values for the application context
 * @constant {Object}
 */
const DEFAULT_APP_STATE = {
  isAnalyzing: false,
  currentAnalysisId: null,
  userPreferences: {
    showStackTraces: true,
    showLineNumbers: true,
    expandedSections: [],
  }
};

// Freeze the default state in development for extra safety
if (process.env.NODE_ENV === 'development') {
  // Use recursiveFreeze in development only
  const recursiveFreeze = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        recursiveFreeze(value);
      }
    });
    
    return Object.freeze(obj);
  };
  
  recursiveFreeze(DEFAULT_APP_STATE);
}

/**
 * Action types for reducer
 * @constant {Object}
 */
const ACTION_TYPES = Object.freeze({
  UPDATE_STATE: 'UPDATE_STATE',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  TOGGLE_SECTION: 'TOGGLE_SECTION',
  RESET_STATE: 'RESET_STATE',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  HYDRATE_STATE: 'HYDRATE_STATE',
});

/**
 * Logger with namespace and conditional debug mode
 */
const logger = {
  debug: (...args) => {
    const debugMode = isBrowser && (localStorage.getItem('debug_appcontext') === 'true' || DEBUG_MODE);
    if (debugMode) {
      console.debug(LOG_NAMESPACE, ...args);
    }
  },
  info: (...args) => console.info(LOG_NAMESPACE, ...args),
  warn: (...args) => console.warn(LOG_NAMESPACE, ...args),
  error: (...args) => console.error(LOG_NAMESPACE, ...args),
};

/**
 * Safely perform deep cloning with optimizations
 * @param {*} obj - Object to clone
 * @param {Object} options - Cloning options
 * @param {boolean} options.shallow - If true, perform shallow clone 
 * @returns {*} Cloned object
 */
function safeClone(obj, options = {}) {
  // Skip cloning if disabled in config (unless explicitly requested)
  if (!CONFIG.enableDeepClone && !options.forceDeep) {
    return { ...obj };
  }
  
  // Fast path for primitives and null/undefined
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  // Fast path for shallow cloning when requested
  if (options.shallow) {
    if (Array.isArray(obj)) {
      return [...obj];
    } else if (obj instanceof Object) {
      return { ...obj };
    }
    return obj;
  }
  
  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  // Handle Array (with potential optimization for simple arrays)
  if (Array.isArray(obj)) {
    // Fast path for simple value arrays
    const allPrimitives = obj.every(item => 
      item === null || item === undefined || typeof item !== 'object'
    );
    
    if (allPrimitives) {
      return [...obj];
    }
    
    return obj.map(item => safeClone(item, options));
  }
  
  // Handle plain Objects (with instanceof check to avoid cloning class instances)
  if (obj.constructor === Object) {
    const copy = {};
    Object.keys(obj).forEach(key => {
      copy[key] = safeClone(obj[key], options);
    });
    return copy;
  }
  
  // Handle Set
  if (obj instanceof Set) {
    return new Set([...obj].map(item => safeClone(item, options)));
  }
  
  // Handle Map
  if (obj instanceof Map) {
    return new Map([...obj].map(([key, value]) => 
      [safeClone(key, options), safeClone(value, options)]
    ));
  }
  
  // For non-plain objects, return the original (like class instances)
  return obj;
}

/**
 * Attempt to persist state to localStorage with error handling
 * @param {Object} state - State to persist
 */
function persistToStorage(state) {
  if (!isBrowser || !CONFIG.persistStateToStorage) return;
  
  try {
    const serialized = JSON.stringify(state);
    
    // Use compression for large states
    if (serialized.length > CONFIG.compressionThreshold && isBrowser && window.btoa) {
      localStorage.setItem(`${CONFIG.storageKey}_compressed`, window.btoa(serialized));
      localStorage.removeItem(CONFIG.storageKey);
      logger.debug('State persisted with compression');
    } else {
      localStorage.setItem(CONFIG.storageKey, serialized);
      localStorage.removeItem(`${CONFIG.storageKey}_compressed`);
      logger.debug('State persisted');
    }
  } catch (error) {
    // Handle quota errors and other storage issues
    logger.warn('Failed to persist state to storage:', error);
    
    // Try to remove items if storage is full
    try {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(`${CONFIG.storageKey}_compressed`);
    } catch (e) {
      // Silent fail if can't even remove items
    }
  }
}

/**
 * Load persisted state from localStorage with error handling
 * @returns {Object|null} Loaded state or null
 */
function loadFromStorage() {
  if (!isBrowser || !CONFIG.persistStateToStorage) return null;
  
  try {
    // Check for compressed state first
    const compressedData = localStorage.getItem(`${CONFIG.storageKey}_compressed`);
    if (compressedData && window.atob) {
      const decompressed = window.atob(compressedData);
      return JSON.parse(decompressed);
    }
    
    // Otherwise try normal state
    const serialized = localStorage.getItem(CONFIG.storageKey);
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (error) {
    logger.warn('Failed to load state from storage:', error);
    
    // Clean up potentially corrupted data
    try {
      localStorage.removeItem(CONFIG.storageKey);
      localStorage.removeItem(`${CONFIG.storageKey}_compressed`);
    } catch (e) {
      // Silent fail if can't remove
    }
  }
  
  return null;
}

/**
 * State reducer function for app state
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
function appStateReducer(state, action) {
  let newState;
  
  switch (action.type) {
    case ACTION_TYPES.HYDRATE_STATE:
      newState = action.payload;
      break;
      
    case ACTION_TYPES.UPDATE_STATE:
      newState = {
        ...state,
        ...action.payload
      };
      break;
    
    case ACTION_TYPES.UPDATE_PREFERENCES:
      newState = {
        ...state,
        userPreferences: {
          ...(state.userPreferences || DEFAULT_APP_STATE.userPreferences),
          ...action.payload
        }
      };
      break;
    
    case ACTION_TYPES.TOGGLE_SECTION: {
      const currentSections = state.userPreferences?.expandedSections || [];
      const sectionId = action.payload;
      
      const updatedSections = currentSections.includes(sectionId)
        ? currentSections.filter(id => id !== sectionId)
        : [...currentSections, sectionId];
      
      newState = {
        ...state,
        userPreferences: {
          ...(state.userPreferences || DEFAULT_APP_STATE.userPreferences),
          expandedSections: updatedSections
        }
      };
      break;
    }
    
    case ACTION_TYPES.RESET_STATE:
      newState = safeClone(DEFAULT_APP_STATE);
      break;
    
    default:
      logger.warn(`Unknown action type: ${action.type}`);
      return state;
  }
  
  // Auto-persist state updates (if not in a batch)
  if (action.noPersist !== true && CONFIG.persistStateToStorage && isBrowser) {
    // Use requestIdleCallback to persist without blocking
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => persistToStorage(newState));
    } else {
      // Fallback to setTimeout
      setTimeout(() => persistToStorage(newState), 0);
    }
  }
  
  return newState;
}

/**
 * Error reducer function
 * @param {Object} state - Current error state
 * @param {Object} action - Action to perform
 * @returns {Object} New error state
 */
function errorReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.SET_ERROR:
      return {
        hasError: true,
        errorInfo: action.payload
      };
    
    case ACTION_TYPES.CLEAR_ERROR:
      return {
        hasError: false,
        errorInfo: null
      };
    
    default:
      return state;
  }
}

/**
 * Create the Application Context
 * Using Symbol for default value to ensure the context is unique
 */
const AppContext = createContext(Symbol('AppContext'));

// Set display name for DevTools
AppContext.displayName = 'AppContext';

/**
 * Custom error class for context-related errors
 * @extends Error
 */
class AppContextError extends Error {
  /**
   * Create a new AppContextError
   * @param {string} message - Error message
   * @param {*} [details=null] - Additional error details
   */
  constructor(message, details = null) {
    super(message);
    this.name = 'AppContextError';
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Safely capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppContextError);
    }
  }
  
  /**
   * Convert error to string
   * @returns {string} String representation of error
   */
  toString() {
    return `${this.name}: ${this.message} (${this.timestamp})`;
  }
  
  /**
   * Convert error to object for logging
   * @returns {Object} Object representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * Interface for the app state
 * @typedef {Object} AppState
 * @property {boolean} isAnalyzing - Whether analysis is in progress
 * @property {string|null} currentAnalysisId - ID of current analysis
 * @property {Object} userPreferences - User preferences
 * @property {boolean} userPreferences.showStackTraces - Whether to show stack traces
 * @property {boolean} userPreferences.showLineNumbers - Whether to show line numbers
 * @property {Array<string>} userPreferences.expandedSections - IDs of expanded sections
 */

/**
 * Interface for context value
 * @typedef {Object} AppContextValue
 * @property {boolean} isDarkMode - Whether dark mode is enabled
 * @property {AppState} appState - Application state
 * @property {Function} updateAppState - Update app state
 * @property {Function} updateUserPreferences - Update user preferences
 * @property {Function} toggleExpandedSection - Toggle expanded section
 * @property {Function} resetAppState - Reset app state
 * @property {boolean} hasError - Whether there is an error
 * @property {Error|null} errorInfo - Error information
 * @property {Function} clearError - Clear error
 * @property {Object} metrics - Performance metrics
 */

/**
 * Provider component for the application context
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement} Provider component
 */
export const AppProvider = ({ children }) => {
  // Try to load persisted state on initial render
  const persistedState = useRef(loadFromStorage());
  
  // Initialize state with reducer
  const [appState, dispatch] = useReducer(
    appStateReducer, 
    persistedState.current || safeClone(DEFAULT_APP_STATE)
  );
  
  const [errorState, errorDispatch] = useReducer(errorReducer, { 
    hasError: false, 
    errorInfo: null 
  });
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // References for cleanup and tracking
  const observerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const isInitializedRef = useRef(false);
  
  // Performance metrics
  const metricsRef = useRef({
    lastRender: Date.now(),
    updateCount: 0,
    errorCount: 0,
    initTimestamp: Date.now()
  });

  /**
   * Initialize the context on first mount
   */
  useEffect(() => {
    try {
      // Skip if already initialized
      if (isInitializedRef.current) {
        return;
      }
      
      isInitializedRef.current = true;
      metricsRef.current.initTimestamp = Date.now();
      
      // Set up auto-save if enabled
      if (CONFIG.persistStateToStorage && isBrowser && CONFIG.autoSaveInterval > 0) {
        autoSaveTimerRef.current = setInterval(() => {
          persistToStorage(appState);
        }, CONFIG.autoSaveInterval);
      }
      
      logger.debug('Context initialized successfully');
      
      // If we loaded persisted state, notify 
      if (persistedState.current) {
        logger.debug('Restored from persisted state');
      }
      
      // Cleanup on unmount
      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
        }
        
        // Final state persistence on unmount
        if (CONFIG.persistStateToStorage && isBrowser) {
          persistToStorage(appState);
        }
      };
    } catch (error) {
      logger.error('Initialization error:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('Context initialization failed', error)
      });
    }
  }, [appState]);

  /**
   * Check for dark mode on initial load and setup observer
   */
  useEffect(() => {
    try {
      // Only run in browser environment
      if (!isBrowser) return;
      
      // Initial check for dark mode
      const root = document.documentElement;
      if (!root) {
        logger.warn('Document root element not found for theme detection');
        return;
      }
      
      const isDark = root.classList.contains('dark');
      setIsDarkMode(isDark);
      
      // Also check for system preference if available
      if (window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (darkModeQuery.matches && !isDark) {
          logger.debug('System prefers dark mode but app uses light mode');
        }
        
        // Listen for system preference changes if browser supports it
        if (typeof darkModeQuery.addEventListener === 'function') {
          darkModeQuery.addEventListener('change', (e) => {
            logger.debug('System color scheme preference changed', e.matches ? 'dark' : 'light');
            // Note: We don't automatically change theme, just log it
          });
        }
      }
      
      // Setup mutation observer for theme changes
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'class') {
            const updatedIsDark = root.classList.contains('dark');
            if (updatedIsDark !== isDarkMode) {
              setIsDarkMode(updatedIsDark);
              logger.debug(`Theme changed to ${updatedIsDark ? 'dark' : 'light'} mode`);
            }
            break;
          }
        }
      });
      
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['class'],
      });
      
      // Store observer reference
      observerRef.current = observer;
      
      // Cleanup observer on unmount
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };
    } catch (error) {
      logger.error('Error setting up dark mode detection:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('Theme detection failed', error)
      });
    }
  }, [isDarkMode]);
  
  /**
   * Force a complete state hydration (for SSR or external updates)
   * @param {Object} newState - Complete new state to hydrate
   */
  const hydrateState = useCallback((newState) => {
    try {
      if (!newState || typeof newState !== 'object') {
        logger.warn('Invalid state hydration received', newState);
        return;
      }
      
      logger.debug('Hydrating state');
      metricsRef.current.lastHydration = Date.now();
      
      dispatch({
        type: ACTION_TYPES.HYDRATE_STATE,
        payload: safeClone(newState)
      });
    } catch (error) {
      logger.error('Error hydrating state:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('State hydration failed', { error })
      });
    }
  }, []);

  /**
   * Update a specific part of the app state
   * Memoized to prevent unnecessary re-renders
   * @param {Object} newState - New state to merge
   * @param {boolean} persist - Whether to persist this update
   */
  const updateAppState = useCallback((newState, persist = true) => {
    if (!newState || typeof newState !== 'object') {
      logger.warn('Invalid state update received', newState);
      return;
    }

    try {
      // Update metrics
      metricsRef.current.lastUpdate = Date.now();
      metricsRef.current.updateCount += 1;
      
      // Dispatch update action
      dispatch({
        type: ACTION_TYPES.UPDATE_STATE,
        payload: safeClone(newState),
        noPersist: !persist
      });
      
      logger.debug('State updated', newState);
    } catch (error) {
      logger.error('Error updating app state:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('State update failed', { newState, error })
      });
    }
  }, []);

  /**
   * Update user preferences
   * Memoized to prevent unnecessary re-renders
   * @param {Object} preferences - New preferences to merge
   * @param {boolean} persist - Whether to persist this update
   */
  const updateUserPreferences = useCallback((preferences, persist = true) => {
    if (!preferences || typeof preferences !== 'object') {
      logger.warn('Invalid preferences update received', preferences);
      return;
    }

    try {
      // Update metrics
      metricsRef.current.lastPrefsUpdate = Date.now();
      
      // Dispatch update action
      dispatch({
        type: ACTION_TYPES.UPDATE_PREFERENCES,
        payload: safeClone(preferences),
        noPersist: !persist
      });
      
      logger.debug('Preferences updated', preferences);
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('Preferences update failed', { preferences, error })
      });
    }
  }, []);

  /**
   * Toggle a section in expanded sections
   * Memoized to prevent unnecessary re-renders
   * @param {string} sectionId - ID of section to toggle
   * @param {boolean} persist - Whether to persist this update
   */
  const toggleExpandedSection = useCallback((sectionId, persist = true) => {
    if (!sectionId) {
      logger.warn('Toggle expanded section called with invalid sectionId');
      return;
    }

    try {
      // Dispatch toggle action
      dispatch({
        type: ACTION_TYPES.TOGGLE_SECTION,
        payload: sectionId,
        noPersist: !persist
      });
      
      logger.debug(`Section ${sectionId} toggled`);
    } catch (error) {
      logger.error('Error toggling expanded section:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('Section toggle failed', { sectionId, error })
      });
    }
  }, []);

  /**
   * Reset app state to defaults
   * Useful for error recovery or initialization
   * @param {boolean} clearStorage - Whether to also clear persisted state
   */
  const resetAppState = useCallback((clearStorage = false) => {
    try {
      // Reset app state
      dispatch({ type: ACTION_TYPES.RESET_STATE });
      
      // Clear error state
      errorDispatch({ type: ACTION_TYPES.CLEAR_ERROR });
      
      // Reset metrics
      metricsRef.current = {
        lastRender: Date.now(),
        updateCount: 0,
        errorCount: 0,
        resetTimestamp: Date.now()
      };
      
      // Optionally clear storage
      if (clearStorage && isBrowser && CONFIG.persistStateToStorage) {
        try {
          localStorage.removeItem(CONFIG.storageKey);
          localStorage.removeItem(`${CONFIG.storageKey}_compressed`);
          logger.debug('Storage cleared');
        } catch (e) {
          logger.warn('Failed to clear storage', e);
        }
      }
      
      logger.info('App state reset successfully');
    } catch (error) {
      logger.error('Error resetting app state:', error);
      errorDispatch({
        type: ACTION_TYPES.SET_ERROR,
        payload: new AppContextError('State reset failed', error)
      });
    }
  }, []);

  /**
   * Clear error state
   * Useful for error recovery
   */
  const clearError = useCallback(() => {
    errorDispatch({ type: ACTION_TYPES.CLEAR_ERROR });
    logger.debug('Errors cleared');
  }, []);

  /**
   * Force immediate persistence of current state
   */
  const saveState = useCallback(() => {
    if (isBrowser && CONFIG.persistStateToStorage) {
      persistToStorage(appState);
      logger.debug('State manually persisted');
      return true;
    }
    return false;
  }, [appState]);

  /**
   * Track error count in metrics
   */
  useEffect(() => {
    if (errorState.hasError) {
      metricsRef.current.errorCount += 1;
      metricsRef.current.lastError = Date.now();
      logger.debug(`Error count: ${metricsRef.current.errorCount}`);
    }
  }, [errorState.hasError]);

  /**
   * Get current metrics snapshot with calculated values
   */
  const getMetrics = useCallback(() => {
    const now = Date.now();
    const base = { ...metricsRef.current };
    
    // Add calculated metrics
    return {
      ...base,
      uptime: now - base.initTimestamp,
      timeSinceLastUpdate: base.lastUpdate ? now - base.lastUpdate : null,
      timeSinceLastError: base.lastError ? now - base.lastError : null,
      isDarkMode,
      stateSize: JSON.stringify(appState).length,
    };
  }, [appState, isDarkMode]);

  /**
   * Memoize context value to prevent unnecessary re-renders
   * @type {AppContextValue}
   */
  const contextValue = useMemo(() => ({
    // Core state
    isDarkMode,
    appState,
    
    // State management
    updateAppState,
    updateUserPreferences,
    toggleExpandedSection,
    resetAppState,
    hydrateState,
    saveState,
    
    // Error handling
    clearError,
    hasError: errorState.hasError,
    errorInfo: errorState.errorInfo,
    
    // Debug & metrics
    metrics: getMetrics(),
    debug: {
      getMetrics,
      persistenceEnabled: CONFIG.persistStateToStorage,
      deepCloneEnabled: CONFIG.enableDeepClone,
    }
  }), [
    // Only include values that should trigger re-renders when changed
    isDarkMode, 
    appState, 
    errorState.hasError,
    errorState.errorInfo,
    
    // Include function dependencies
    updateAppState, 
    updateUserPreferences, 
    toggleExpandedSection, 
    resetAppState,
    hydrateState,
    saveState,
    clearError,
    getMetrics
  ]);

  /**
   * Error boundary component to handle provider errors
   */
  if (errorState.hasError) {
    logger.error('Context error state:', errorState.errorInfo);
    
    // Create safe fallback context
    const fallbackContext = {
      isDarkMode: false,
      appState: safeClone(DEFAULT_APP_STATE),
      updateAppState: () => logger.warn('Context in error state'),
      updateUserPreferences: () => logger.warn('Context in error state'),
      toggleExpandedSection: () => logger.warn('Context in error state'),
      resetAppState,
      hydrateState: () => logger.warn('Context in error state'),
      saveState: () => false,
      clearError,
      hasError: true,
      errorInfo: errorState.errorInfo,
      metrics: getMetrics(),
      debug: {
        getMetrics,
        persistenceEnabled: CONFIG.persistStateToStorage,
        deepCloneEnabled: CONFIG.enableDeepClone,
      }
    };
    
    return (
      <AppContext.Provider value={fallbackContext}>
        {children}
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// PropTypes validation for AppProvider
AppProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Only include PropTypes in development
if (process.env.NODE_ENV === 'production') {
  AppProvider.propTypes = undefined;
}

/**
 * Custom hook for using the app context
 * @returns {AppContextValue} The app context value
 * @throws {AppContextError} If used outside of an AppProvider
 */
export const useAppContext = () => {
  const context = useContext(AppContext);
  
  // Ensure the hook is used within an AppProvider
  if (!context || context === Symbol('AppContext')) {
    throw new AppContextError('useAppContext must be used within an AppProvider');
  }
  
  return context;
};

/**
 * Selector hook for accessing only specific parts of the context
 * Optimizes re-renders by only triggering when selected values change
 * @param {Function} selector - Selector function that picks values from context
 * @returns {*} Selected context value
 * @throws {AppContextError} If used outside of an AppProvider
 */
export const useAppContextSelector = (selector) => {
  if (typeof selector !== 'function') {
    throw new AppContextError('useAppContextSelector requires a selector function');
  }
  
  const context = useContext(AppContext);
  
  // Ensure the hook is used within an AppProvider
  if (!context || context === Symbol('AppContext')) {
    throw new AppContextError('useAppContextSelector must be used within an AppProvider');
  }
  
  // Apply selector to get derived value
  // Using useMemo to prevent unnecessary recalculations
  return useMemo(() => selector(context), [context, selector]);
};

/**
 * Default context value used as fallback
 * @constant {Object}
 */
const DEFAULT_CONTEXT_VALUE = Object.freeze({
  isDarkMode: false,
  appState: DEFAULT_APP_STATE,
  updateAppState: () => logger.warn('Context not available'),
  updateUserPreferences: () => logger.warn('Context not available'),
  toggleExpandedSection: () => logger.warn('Context not available'),
  resetAppState: () => logger.warn('Context not available'),
  hydrateState: () => logger.warn('Context not available'),
  saveState: () => false,
  clearError: () => logger.warn('Context not available'),
  hasError: false,
  errorInfo: null,
  metrics: { unavailable: true },
  debug: { unavailable: true },
});

/**
 * Higher-order component to safely connect a component to the AppContext
 * Provides fallback behavior if context is not available
 * @param {React.Component} WrappedComponent - Component to wrap with context
 * @returns {React.Component} Wrapped component with safe context access
 */
export const withAppContext = (WrappedComponent) => {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const WithAppContext = React.forwardRef((props, ref) => {
    // Track if component is mounted
    const isMountedRef = useRef(false);
    
    // Set mounted flag on mount
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);
    
    try {
      return (
        <AppContext.Consumer>
          {context => {
            // If component unmounted during async operations, prevent updates
            if (!isMountedRef.current) {
              return null;
            }
            
            // If context is not available, provide default values
            const safeContext = (context && context !== Symbol('AppContext')) 
              ? context 
              : {
                  ...DEFAULT_CONTEXT_VALUE,
                  hasError: true,
                  errorInfo: new AppContextError('AppContext not available in withAppContext')
                };
            
            return <WrappedComponent ref={ref} {...props} appContext={safeContext} />;
          }}
        </AppContext.Consumer>
      );
    } catch (error) {
      logger.error(`Error in withAppContext for ${displayName}:`, error);
      
      // If component unmounted during async operations, prevent updates
      if (!isMountedRef.current) {
        return null;
      }
      
      // Provide component with error context
      return (
        <WrappedComponent 
          ref={ref}
          {...props} 
          appContext={{
            ...DEFAULT_CONTEXT_VALUE,
            hasError: true,
            errorInfo: new AppContextError(`Error in withAppContext for ${displayName}`, error)
          }} 
        />
      );
    }
  });
  
  WithAppContext.displayName = `WithAppContext(${displayName})`;
  return WithAppContext;
};

/**
 * Create a stable context consumer that only renders when specified props change
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Array<string>} contextProps - Context properties to watch
 * @returns {React.Component} Memoized component with context
 */
export const createStableContextConsumer = (WrappedComponent, contextProps = []) => {
  const StableComponent = React.memo(
    withAppContext(WrappedComponent),
    (prevProps, nextProps) => {
      // Always re-render if basic props change
      if (Object.keys(prevProps).some(key => key !== 'appContext' && prevProps[key] !== nextProps[key])) {
        return false;
      }
      
      // Don't re-render if appContext props we care about haven't changed
      const prevContext = prevProps.appContext || {};
      const nextContext = nextProps.appContext || {};
      
      return contextProps.every(prop => {
        // Handle nested props with dot notation
        if (prop.includes('.')) {
          const parts = prop.split('.');
          let prevValue = prevContext;
          let nextValue = nextContext;
          
          for (const part of parts) {
            prevValue = prevValue?.[part];
            nextValue = nextValue?.[part];
            
            if (prevValue === undefined && nextValue === undefined) {
              return true;
            }
          }
          
          return prevValue === nextValue;
        }
        
        return prevContext[prop] === nextContext[prop];
      });
    }
  );
  
  StableComponent.displayName = `StableContext(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return StableComponent;
};

/**
 * Creates a lazy-loaded component that uses AppContext
 * @param {Function} importFn - Import function (e.g., () => import('./MyComponent'))
 * @param {Object} options - Options
 * @param {boolean} options.withContext - Whether to wrap with withAppContext
 * @param {Array<string>} options.watchProps - Props to watch if creating stable consumer
 * @returns {React.LazyExoticComponent} Lazy loaded component
 */
export const createLazyComponent = (importFn, options = {}) => {
  const LazyComponent = lazy(async () => {
    const module = await importFn();
    const Component = module.default;
    
    if (options.withContext) {
      if (options.watchProps && options.watchProps.length > 0) {
        return { 
          default: createStableContextConsumer(Component, options.watchProps) 
        };
      }
      return { default: withAppContext(Component) };
    }
    
    return module;
  });
  
  // Create wrapper with Suspense
  const LazyWithFallback = (props) => (
    <Suspense fallback={options.fallback || <div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  );
  
  return LazyWithFallback;
};

/**
 * Utility function to create a selector function for useAppContextSelector
 * @param {...string} paths - Paths to select from context
 * @returns {Function} Selector function
 */
export const createContextSelector = (...paths) => {
  // Pre-compute path parts for performance
  const compiledPaths = paths.map(path => {
    return path.includes('.') ? path.split('.') : path;
  });
  
  // Return memoized selector
  return (context) => {
    const result = {};
    
    for (let i = 0; i < compiledPaths.length; i++) {
      const path = compiledPaths[i];
      
      if (Array.isArray(path)) {
        // Handle nested paths
        let value = context;
        const lastIndex = path.length - 1;
        
        for (let j = 0; j < path.length; j++) {
          const part = path[j];
          value = value?.[part];
          
          if (value === undefined) break;
          if (j === lastIndex) {
            result[part] = value;
          }
        }
      } else {
        // Handle direct properties
        result[path] = context[path];
      }
    }
    
    return result;
  };
};

// Export default context for advanced use cases
export default AppContext;