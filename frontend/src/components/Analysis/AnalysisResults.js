// src/components/Analysis/AnalysisResults.js
import React, { useState, useEffect, useMemo, useCallback, memo, Suspense, lazy, useRef } from 'react';
import PropTypes from 'prop-types';
import { withAppContext } from '../../context/AppContext';
import CollapsibleSection from '../UI/CollapsibleSection';
import CopyMenu from '../UI/CopyMenu';
import TagSelector from '../UI/TagSelector';
import { determineSeverity, getSeverityProperties, highlightAll } from '../../utils/highlighter';
import { copyFormatPreference } from '../../utils/copyUtils';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { EmptyState } from '../UI/EmptyState';

// Lazy load components for better performance
const AnalysisResultItem = lazy(() => import('./AnalysisResultItem').then(module => ({ 
  default: module.AnalysisResultItem 
})));

// Constants
const ITEM_HEIGHT = 200; // Adjust based on your content
const MIN_LIST_HEIGHT = 600;
const MIN_LIST_WIDTH = 800;
const COPY_FEEDBACK_DURATION = 3000; // 3 seconds
const VIRTUALIZATION_THRESHOLD = 5; // Only virtualize if more than 5 items
const DEBOUNCE_DELAY = 150; // ms for debouncing resize events
const ANALYTICS_ENABLED = process.env.NODE_ENV === 'production';

// Default highlight options
const DEFAULT_HIGHLIGHT_OPTIONS = {
  severity: true,
  stackTraces: true,
  technicalTerms: true,
  pathsAndUrls: true,
  dateTimes: true
};

// Theme colors for consistent styling
const THEME_COLORS = {
  light: {
    background: '#ffffff',
    border: '#e5e7eb',
    text: '#1f2937',
    muted: '#6b7280',
  },
  dark: {
    background: '#1a1a1a',
    border: '#374151',
    text: '#f3f4f6',
    muted: '#9ca3af',
  }
};

/**
 * Utility for debouncing function calls
 * @param {Function} fn - Function to debounce 
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Logs analytics event if enabled
 * @param {string} eventName - Name of the event
 * @param {Object} data - Event data
 */
function logAnalytics(eventName, data) {
  if (!ANALYTICS_ENABLED) return;
  
  try {
    if (window.analytics && typeof window.analytics.track === 'function') {
      window.analytics.track(`AnalysisResults:${eventName}`, data);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

/**
 * Fallback component for suspense
 */
const LoadingFallback = memo(() => (
  <div className="flex items-center justify-center h-48 w-full">
    <div className="animate-pulse flex space-x-4">
      <div className="flex-1 space-y-4 py-1">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
));

/**
 * Analysis error boundary component
 */
class AnalysisErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('AnalysisResults error:', error, errorInfo);
    
    // Log to analytics or error tracking service
    logAnalytics('error', { 
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md text-red-800 dark:text-red-300">
          <h3 className="text-lg font-semibold mb-2">Error displaying analysis results</h3>
          <p className="mb-2">An error occurred while rendering the analysis results.</p>
          <pre className="text-xs overflow-auto p-2 bg-red-100 dark:bg-red-900/30 rounded max-h-40">
            {this.state.error?.toString() || 'Unknown error'}
          </pre>
          
          {this.props.showComponentStack && this.state.errorInfo && (
            <details className="mt-2">
              <summary className="text-sm cursor-pointer">Technical Details</summary>
              <pre className="text-xs overflow-auto p-2 bg-red-100 dark:bg-red-900/30 rounded mt-2 max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <div className="mt-4 flex space-x-2">
            <button 
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md" 
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              Try Again
            </button>
            
            <button
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-md"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Set PropTypes for ErrorBoundary
AnalysisErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  showComponentStack: PropTypes.bool
};

AnalysisErrorBoundary.defaultProps = {
  showComponentStack: process.env.NODE_ENV === 'development'
};

/**
 * A hook to manage keyboard navigation through results
 * @param {Array} results - Array of results to navigate
 * @param {Function} onSelect - Callback when item is selected
 * @returns {Object} Navigation state and handlers
 */
function useKeyboardNavigation(results, onSelect) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const handleKeyDown = useCallback((e) => {
    if (!results || results.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prevIndex => 
          prevIndex < results.length - 1 ? prevIndex + 1 : prevIndex
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prevIndex => 
          prevIndex > 0 ? prevIndex - 1 : 0
        );
        break;
        
      case 'Enter':
        if (focusedIndex >= 0 && focusedIndex < results.length) {
          onSelect(results[focusedIndex]);
        }
        break;
        
      case 'Escape':
        setFocusedIndex(-1);
        break;
        
      default:
        break;
    }
  }, [results, focusedIndex, onSelect]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  return { focusedIndex, setFocusedIndex };
}

/**
 * A hook to track element visibility
 * @param {Object} options - IntersectionObserver options
 * @returns {Object} ref and isVisible state
 */
function useElementVisibility(options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, {
      root: null,
      threshold: 0.1,
      ...options
    });
    
    observer.observe(ref.current);
    
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [options]);
  
  return { ref, isVisible };
}

/**
 * A component to show unread indicators for results
 */
const UnreadIndicator = memo(({ isRead }) => {
  if (isRead) return null;
  
  return (
    <span 
      className="absolute top-2 right-2 h-3 w-3 bg-blue-500 rounded-full" 
      aria-label="New result" 
    />
  );
});

UnreadIndicator.propTypes = {
  isRead: PropTypes.bool
};

/**
 * Main AnalysisResults component
 */
const AnalysisResultsComponent = ({
  // Props with defaults
  analyses = [],
  filteredAnalyses = [],
  totalCount = 0,
  copySuccess = false,
  onCopy = () => {},
  onStartTroubleshooting = () => {},
  highlightErrors = false,
  highlightOptions = DEFAULT_HIGHLIGHT_OPTIONS,
  toggleHighlightOption = () => {},
  enableKeyboardNavigation = true,
  
  // Props from withAppContext HOC
  appContext = {}
}) => {
  // Local state
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [localHighlightOptions, setLocalHighlightOptions] = useState(DEFAULT_HIGHLIGHT_OPTIONS);
  const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });
  const [isClient, setIsClient] = useState(false);
  const [readResults, setReadResults] = useState(new Set());
  const listRef = useRef(null);
  const containerRef = useRef(null);
  
  // Track component mount status for async operations
  const isMountedRef = useRef(true);

  // Safely extract context state
  const { appState = {}, isDarkMode: contextDarkMode } = appContext || {};
  
  // Detect client-side rendering
  useEffect(() => {
    setIsClient(true);
    
    // Record initial view analytics
    logAnalytics('viewed', { 
      count: resultsToUse.length, 
      filtered: filteredAnalyses.length > 0 
    });
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Determine dark mode
  const isDarkMode = useMemo(() => {
    if (contextDarkMode !== undefined) return contextDarkMode;
    if (isClient) {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  }, [contextDarkMode, isClient]);

  // Determine which results to use, with fallbacks
  const resultsToUse = useMemo(() => {
    // Try context state first
    if (appState && Array.isArray(appState.analysisResults) && appState.analysisResults.length > 0) {
      return appState.analysisResults;
    }
    
    // Next try filtered analyses
    if (Array.isArray(filteredAnalyses) && filteredAnalyses.length > 0) {
      return filteredAnalyses;
    }
    
    // Finally fall back to all analyses
    return Array.isArray(analyses) ? analyses : [];
  }, [appState, filteredAnalyses, analyses]);

  // Determine effective highlight options
  const effectiveHighlightOptions = useMemo(() => {
    // Priority: appState > props > local state
    if (appState && appState.highlightOptions) {
      return appState.highlightOptions;
    }
    
    if (highlightOptions && Object.keys(highlightOptions).length > 0) {
      return highlightOptions;
    }
    
    return localHighlightOptions;
  }, [appState, highlightOptions, localHighlightOptions]);

  // Set up keyboard navigation if enabled
  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation(
    enableKeyboardNavigation ? resultsToUse : [],
    onStartTroubleshooting
  );
  
  // Use element visibility for container
  const { ref: visibilityRef, isVisible: isContainerVisible } = useElementVisibility();
  
  // Set up container ref with visibility tracking
  const setContainerRef = useCallback((node) => {
    containerRef.current = node;
    if (visibilityRef) {
      visibilityRef.current = node;
    }
  }, [visibilityRef]);

  // Handle window resize with debounce
  useEffect(() => {
    const handleResize = debounce(() => {
      if (!isMountedRef.current) return;
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setViewportDimensions({ width, height });
    }, DEBOUNCE_DELAY);
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle toggling highlight options
  const handleToggleHighlightOption = useCallback((option) => {
    if (typeof toggleHighlightOption === 'function') {
      toggleHighlightOption(option);
    } else {
      setLocalHighlightOptions(prev => ({
        ...prev,
        [option]: !prev[option]
      }));
    }
    
    // Log analytics
    logAnalytics('toggleHighlight', { 
      option, 
      enabled: !effectiveHighlightOptions[option] 
    });
  }, [toggleHighlightOption, effectiveHighlightOptions]);

  // Handle copy success feedback
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (copySuccess) {
      setCopyFeedback({
        message: 'Copied to clipboard!',
        type: 'success'
      });
      
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setCopyFeedback(null);
        }
      }, COPY_FEEDBACK_DURATION);
      
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);
  
  // Safe copy handler
  const handleCopy = useCallback((id) => {
    if (typeof onCopy === 'function') {
      onCopy(id);
      
      // Log analytics
      logAnalytics('copied', { id });
    }
  }, [onCopy]);
  
  // Safe troubleshooting handler
  const handleTroubleshooting = useCallback((analysis) => {
    if (typeof onStartTroubleshooting === 'function') {
      onStartTroubleshooting(analysis);
      
      // Log analytics
      logAnalytics('startedTroubleshooting', { 
        id: analysis.id,
        type: analysis.crash_resolution_report ? 'crash' : 'chunk'
      });
      
      // Mark as read
      setReadResults(prev => {
        const newSet = new Set(prev);
        if (analysis.id) {
          newSet.add(analysis.id);
        }
        return newSet;
      });
    }
  }, [onStartTroubleshooting]);
  
  // Scroll to focused index
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current && listRef.current.scrollToItem) {
      listRef.current.scrollToItem(focusedIndex, 'smart');
    }
  }, [focusedIndex]);
  
  // Virtualized row renderer
  const Row = useCallback(({ index, style }) => {
    if (!resultsToUse || index >= resultsToUse.length) {
      return null;
    }
    
    const result = resultsToUse[index];
    const isRead = result.id ? readResults.has(result.id) : false;
    const isFocused = index === focusedIndex;
    
    return (
      <div 
        style={{
          ...style,
          transition: 'background-color 0.2s ease',
          backgroundColor: isFocused ? 
            (isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)') : 
            'transparent',
          outline: isFocused ? '2px solid #3b82f6' : 'none',
          position: 'relative',
          padding: '8px'
        }}
        onClick={() => setFocusedIndex(index)}
        onMouseEnter={() => {
          // Only track read status for visible items
          if (!isRead && result.id) {
            setReadResults(prev => {
              const newSet = new Set(prev);
              newSet.add(result.id);
              return newSet;
            });
          }
        }}
        data-testid={`analysis-result-${index}`}
        role="listitem"
        aria-posinset={index + 1}
        aria-setsize={resultsToUse.length}
      >
        <UnreadIndicator isRead={isRead} />
        
        <Suspense fallback={<LoadingFallback />}>
          <AnalysisResultItem
            key={result.id || `result-${index}`}
            result={result}
            highlightOptions={effectiveHighlightOptions}
            language={appState.language || 'en'}
            onTroubleshoot={() => handleTroubleshooting(result)}
            isFocused={isFocused}
          />
        </Suspense>
      </div>
    );
  }, [
    resultsToUse, 
    effectiveHighlightOptions, 
    appState.language, 
    isDarkMode, 
    focusedIndex, 
    readResults,
    handleTroubleshooting,
    setFocusedIndex
  ]);

  // If no analyses, show placeholder
  if ((!resultsToUse || resultsToUse.length === 0)) {
    return (
      <EmptyState
        title="No Analysis Results"
        message="Upload a file to start analysis"
        actionText="Upload File"
        onAction={() => {
          // Trigger file upload dialog if available
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) fileInput.click();
          
          logAnalytics('clickedUpload', { from: 'emptyState' });
        }}
      />
    );
  }

  // Theme-aware styles
  const themeStyles = isDarkMode ? THEME_COLORS.dark : THEME_COLORS.light;

  // Render the results
  return (
    <AnalysisErrorBoundary>
      <div 
        className="analysis-results-container"
        ref={setContainerRef}
        data-testid="analysis-results-container"
      >
        {/* Performance optimization: only render when container is visible */}
        {(isContainerVisible || process.env.NODE_ENV === 'test') && (
          <>
            {/* Results count summary */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {totalCount > 0 ? (
                  <span>Showing {resultsToUse.length} of {totalCount} results</span>
                ) : (
                  <span>{resultsToUse.length} result{resultsToUse.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              
              {/* Additional controls could go here */}
            </div>
            
            {/* Virtualized or regular rendering based on count */}
            {resultsToUse.length > VIRTUALIZATION_THRESHOLD ? (
              <div className="h-full min-h-[400px]">
                <AutoSizer>
                  {({ height, width }) => {
                    // Update viewport dimensions for optimizations
                    if (height !== viewportDimensions.height || width !== viewportDimensions.width) {
                      if (isMountedRef.current) {
                        setViewportDimensions({ height, width });
                      }
                    }
                    
                    return (
                      <List
                        ref={listRef}
                        height={height || MIN_LIST_HEIGHT}
                        width={width || MIN_LIST_WIDTH}
                        itemCount={resultsToUse.length}
                        itemSize={ITEM_HEIGHT}
                        overscanCount={2} // Render 2 items above and below viewport
                        role="list"
                        aria-label="Analysis Results"
                      >
                        {Row}
                      </List>
                    );
                  }}
                </AutoSizer>
              </div>
            ) : (
              <div className="p-4 space-y-6" role="list" aria-label="Analysis Results">
                {resultsToUse.map((result, index) => (
                  <AnalysisErrorBoundary key={result.id || `item-${index}`}>
                    <div 
                      role="listitem"
                      className={`relative ${index === focusedIndex ? 
                        'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
                        ''}`}
                      onClick={() => setFocusedIndex(index)}
                    >
                      <UnreadIndicator 
                        isRead={result.id ? readResults.has(result.id) : false} 
                      />
                      
                      {result.crash_resolution_report ? (
                        <CrashAnalysisResult
                          analysis={result}
                          copySuccess={copySuccess}
                          onCopy={handleCopy}
                          onStartTroubleshooting={handleTroubleshooting}
                          highlightOptions={effectiveHighlightOptions}
                          isFocused={index === focusedIndex}
                        />
                      ) : (
                        <ChunkAnalysisResult
                          analysis={result}
                          copySuccess={copySuccess}
                          onCopy={handleCopy}
                          onStartTroubleshooting={handleTroubleshooting}
                          highlightOptions={effectiveHighlightOptions}
                          isFocused={index === focusedIndex}
                        />
                      )}
                    </div>
                  </AnalysisErrorBoundary>
                ))}
              </div>
            )}

            {/* Highlight Options Controls */}
            <div className="sticky bottom-0 mt-4 pt-3 pb-3 px-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90 z-10">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Highlight:</span>
                
                {Object.keys(effectiveHighlightOptions).map(option => (
                  <button
                    key={option}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      effectiveHighlightOptions[option]
                        ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700'
                        : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                    }`}
                    onClick={() => handleToggleHighlightOption(option)}
                    aria-pressed={effectiveHighlightOptions[option]}
                    title={`Toggle ${option.replace(/([A-Z])/g, ' $1').toLowerCase()} highlighting`}
                  >
                    {option.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </button>
                ))}
              </div>
              
              {enableKeyboardNavigation && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="hidden sm:inline">Keyboard shortcuts: </span>
                  <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded mr-1">↑</kbd>
                  <kbd className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded mr-1">↓</kbd>
                  to navigate, 
                  <kbd className="ml-1 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded">Enter</kbd> 
                  to troubleshoot
                </div>
              )}
            </div>
          </>
        )}

        {/* Copy feedback toast */}
        {copyFeedback && (
          <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in-up">
            {copyFeedback.message}
          </div>
        )}

        <style jsx>{`
          .analysis-results-container {
            height: 100%;
            min-height: 400px;
            width: 100%;
            background-color: ${themeStyles.background};
            border-radius: 8px;
            overflow: hidden;
            transition: background-color 0.2s ease;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-fade-in-up {
            animation: fadeInUp 0.3s ease-out;
          }
          
          /* Accessibility focus styles */
          :global(*:focus-visible) {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
          }
          
          /* Custom scrollbar for better visibility */
          :global(.analysis-results-container *::-webkit-scrollbar) {
            width: 8px;
            height: 8px;
          }
          
          :global(.analysis-results-container *::-webkit-scrollbar-track) {
            background: ${isDarkMode ? 'rgba(31, 41, 55, 0.2)' : 'rgba(243, 244, 246, 0.7)'};
          }
          
          :global(.analysis-results-container *::-webkit-scrollbar-thumb) {
            background-color: ${isDarkMode ? 'rgba(107, 114, 128, 0.5)' : 'rgba(156, 163, 175, 0.5)'};
            border-radius: 4px;
          }
          
          :global(.analysis-results-container *::-webkit-scrollbar-thumb:hover) {
            background-color: ${isDarkMode ? 'rgba(107, 114, 128, 0.8)' : 'rgba(156, 163, 175, 0.8)'};
          }
        `}</style>
      </div>
    </AnalysisErrorBoundary>
  );
};

/**
 * Component to display crash analysis results
 */
const CrashAnalysisResult = memo(({ 
  analysis, 
  copySuccess, 
  onCopy, 
  onStartTroubleshooting, 
  highlightOptions,
  isFocused = false
}) => {
  // Create a unique ID for the analysis
  const analysisId = useMemo(() => {
    return analysis.id || 
      (analysis.timestamp 
        ? `crash-${new Date(analysis.timestamp).getTime()}`
        : `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, [analysis]);
  
  // Determine severity from crash resolution report
  const overallSeverity = useMemo(() => {
    return analysis.crash_resolution_report
      ? determineSeverity(analysis.crash_resolution_report)
      : 'critical'; // Default to critical for crash analysis
  }, [analysis.crash_resolution_report]);
    
  // Determine severity from suggested solutions
  const solutionsSeverity = useMemo(() => {
    return analysis.suggested_solutions
      ? determineSeverity(analysis.suggested_solutions)
      : 'info';
  }, [analysis.suggested_solutions]);
  
  // Safe access to analysis properties with defaults
  const {
    crash_resolution_report = '',
    diagnostic_overview_report = '',
    suggested_solutions = '',
    timestamp
  } = analysis || {};
  
  // Format timestamp
  const formattedTimestamp = useMemo(() => {
    if (!timestamp) return null;
    
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Invalid timestamp format', error);
      return null;
    }
  }, [timestamp]);
  
  // Handle troubleshooting safely
  const handleTroubleshooting = useCallback(() => {
    if (typeof onStartTroubleshooting === 'function') {
      onStartTroubleshooting(analysis);
    }
  }, [analysis, onStartTroubleshooting]);
  
  // Use visibility tracking to optimize rendering
  const { ref, isVisible } = useElementVisibility();
  
  return (
    <div 
      ref={ref}
      className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-shadow ${
        isFocused ? 'ring-2 ring-blue-500' : ''
      }`}
      tabIndex={isFocused ? 0 : -1}
    >
      {/* Only render content when visible or during server rendering */}
      {(isVisible || typeof window === 'undefined') && (
        <>
          {/* Header */}
          <div className="p-4 flex justify-between items-start border-b border-gray-200 dark:border-gray-700">
            <div>
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Critical
                </span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Crash Analysis
                </h3>
              </div>
              {formattedTimestamp && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generated on {formattedTimestamp}
                </p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <TagSelector analysisId={analysisId} />
              
              <button
                onClick={handleTroubleshooting}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                aria-label="Troubleshoot this analysis"
              >
                Troubleshoot
              </button>
              
              {/* Full analysis copy button */}
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                highlightOptions={highlightOptions}
              />
            </div>
          </div>
          
          {/* Crash Resolution Report */}
          <CollapsibleSection
            title="Crash Resolution Report"
            defaultOpen={true}
            severity="critical"
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(crash_resolution_report, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="crash_resolution_report"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
          
          {/* Diagnostic Overview Report */}
          <CollapsibleSection
            title="Diagnostic Overview Report"
            defaultOpen={false}
            severity={overallSeverity}
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(diagnostic_overview_report, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="diagnostic_overview_report"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
          
          {/* Suggested Solutions */}
          <CollapsibleSection
            title="Suggested Solutions"
            defaultOpen={true}
            severity={solutionsSeverity}
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(suggested_solutions, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="suggested_solutions"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
});

/**
 * Component to display chunk analysis results
 */
const ChunkAnalysisResult = memo(({ 
  analysis, 
  copySuccess, 
  onCopy, 
  onStartTroubleshooting, 
  highlightOptions,
  isFocused = false
}) => {
  // Create a unique ID for the analysis
  const analysisId = useMemo(() => {
    return analysis.id || 
      (analysis.timestamp 
        ? `chunk-${analysis.chunk || 'unknown'}-${new Date(analysis.timestamp).getTime()}`
        : `chunk-${analysis.chunk || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, [analysis]);
  
  // Safe access to analysis properties with defaults
  const {
    chunk = '?',
    total_chunks = '?',
    technical_analysis = '',
    simplified_analysis = '',
    suggested_solutions = '',
    timestamp
  } = analysis || {};
  
  // Determine severity from technical analysis
  const technicalSeverity = useMemo(() => {
    return technical_analysis
      ? determineSeverity(technical_analysis)
      : 'info';
  }, [technical_analysis]);
  
  // Determine severity from simplified analysis
  const simplifiedSeverity = useMemo(() => {
    return simplified_analysis
      ? determineSeverity(simplified_analysis)
      : 'info';
  }, [simplified_analysis]);
  
  // Determine severity from suggested solutions
  const solutionsSeverity = useMemo(() => {
    return suggested_solutions
      ? determineSeverity(suggested_solutions)
      : 'info';
  }, [suggested_solutions]);
  
  // Determine overall severity
  const overallSeverity = useMemo(() => {
    if (technicalSeverity === 'critical' || simplifiedSeverity === 'critical') return 'critical';
    if (technicalSeverity === 'error' || simplifiedSeverity === 'error') return 'error';
    if (technicalSeverity === 'warning' || simplifiedSeverity === 'warning') return 'warning';
    return 'info';
  }, [technicalSeverity, simplifiedSeverity]);
  
  const severityProps = useMemo(() => {
    return getSeverityProperties(overallSeverity);
  }, [overallSeverity]);
  
  // Format timestamp
  const formattedTimestamp = useMemo(() => {
    if (!timestamp) return null;
    
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Invalid timestamp format', error);
      return null;
    }
  }, [timestamp]);
  
  // Handle troubleshooting safely
  const handleTroubleshooting = useCallback(() => {
    if (typeof onStartTroubleshooting === 'function') {
      onStartTroubleshooting(analysis);
    }
  }, [analysis, onStartTroubleshooting]);
  
  // Use visibility tracking to optimize rendering
  const { ref, isVisible } = useElementVisibility();
  
  return (
    <div 
      ref={ref}
      className={`bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border ${severityProps.border} transition-shadow ${
        isFocused ? 'ring-2 ring-blue-500' : ''
      }`}
      tabIndex={isFocused ? 0 : -1}
    >
      {/* Only render content when visible or during server rendering */}
      {(isVisible || typeof window === 'undefined') && (
        <>
          {/* Header */}
          <div className={`p-4 flex justify-between items-start border-b ${severityProps.border}`}>
            <div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${severityProps.background} ${severityProps.color}`}>
                  {severityProps.label}
                </span>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Chunk {chunk} of {total_chunks}
                </h3>
              </div>
              {formattedTimestamp && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generated on {formattedTimestamp}
                </p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <TagSelector analysisId={analysisId} />
              
              <button
                onClick={handleTroubleshooting}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                aria-label="Troubleshoot this analysis"
              >
                Troubleshoot
              </button>
              
              {/* Full analysis copy button */}
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                highlightOptions={highlightOptions}
              />
            </div>
          </div>
          
          {/* Technical Analysis */}
          <CollapsibleSection
            title="Technical Analysis"
            defaultOpen={false}
            severity={technicalSeverity}
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(technical_analysis, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="technical_analysis"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
          
          {/* Simplified Analysis */}
          <CollapsibleSection
            title="Simplified Explanation"
            defaultOpen={true}
            severity={simplifiedSeverity}
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(simplified_analysis, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="simplified_analysis"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
          
          {/* Suggested Solutions */}
          <CollapsibleSection
            title="Suggested Solutions"
            defaultOpen={true}
            severity={solutionsSeverity}
          >
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={
                highlightAll(suggested_solutions, highlightOptions)
              }
            />
            
            <div className="mt-4 flex justify-end">
              <CopyMenu
                analysis={analysis}
                onCopy={onCopy}
                section="suggested_solutions"
                highlightOptions={highlightOptions}
              />
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
});

// Set display names for debugging
CrashAnalysisResult.displayName = 'CrashAnalysisResult';
ChunkAnalysisResult.displayName = 'ChunkAnalysisResult';
AnalysisResultsComponent.displayName = 'AnalysisResults';
LoadingFallback.displayName = 'LoadingFallback';
UnreadIndicator.displayName = 'UnreadIndicator';

// PropTypes definitions
AnalysisResultsComponent.propTypes = {
  analyses: PropTypes.array,
  filteredAnalyses: PropTypes.array,
  totalCount: PropTypes.number,
  copySuccess: PropTypes.bool,
  onCopy: PropTypes.func,
  onStartTroubleshooting: PropTypes.func,
  highlightErrors: PropTypes.bool,
  highlightOptions: PropTypes.object,
  toggleHighlightOption: PropTypes.func,
  enableKeyboardNavigation: PropTypes.bool,
  appContext: PropTypes.object // From withAppContext HOC
};

CrashAnalysisResult.propTypes = {
  analysis: PropTypes.shape({
    id: PropTypes.string,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    crash_resolution_report: PropTypes.string,
    diagnostic_overview_report: PropTypes.string,
    suggested_solutions: PropTypes.string
  }).isRequired,
  copySuccess: PropTypes.bool,
  onCopy: PropTypes.func,
  onStartTroubleshooting: PropTypes.func,
  highlightOptions: PropTypes.object,
  isFocused: PropTypes.bool
};

ChunkAnalysisResult.propTypes = {
  analysis: PropTypes.shape({
    id: PropTypes.string,
    chunk: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    total_chunks: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    technical_analysis: PropTypes.string,
    simplified_analysis: PropTypes.string,
    suggested_solutions: PropTypes.string
  }).isRequired,
  copySuccess: PropTypes.bool,
  onCopy: PropTypes.func,
  onStartTroubleshooting: PropTypes.func,
  highlightOptions: PropTypes.object,
  isFocused: PropTypes.bool
};

// Export named component for easier imports and testing
export const AnalysisResults = AnalysisResultsComponent;

// Export wrapped component as default
export default withAppContext(AnalysisResultsComponent);