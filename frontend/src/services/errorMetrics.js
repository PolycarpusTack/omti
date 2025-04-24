// src/services/errorMetrics.js

/**
 * Error Metrics Collector Service
 * 
 * This service collects and aggregates error metrics from the ErrorBoundary system
 * and prepares them for display in the Error Monitoring Dashboard.
 */

// In-memory storage for metrics (in a real implementation, this would use 
// localStorage, IndexedDB, or preferably a backend API)
let errorMetrics = {
    // Errors by component
    componentErrors: {},
    
    // Errors by type
    typeErrors: {},
    
    // Errors by day
    dailyErrors: {},
    
    // Retry metrics
    retryMetrics: {
      attempts: [0, 0, 0], // First, second, third attempt counts
      successes: [0, 0, 0] // Success counts for each attempt
    },
    
    // User behavior after error
    userBehavior: {
      continued: 0,
      refreshed: 0,
      abandoned: 0
    },
    
    // Track recent errors for details view
    recentErrors: []
  };
  
  // Maximum number of recent errors to store
  const MAX_RECENT_ERRORS = 100;
  
  /**
   * Record a new error occurrence
   * 
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context information
   * @param {string} boundary - Name of the error boundary that caught the error
   */
  export function recordError(error, context, boundary) {
    const timestamp = new Date();
    const errorType = error.name || 'Unknown';
    const component = boundary || 'Unknown';
    
    // Record component error
    if (!errorMetrics.componentErrors[component]) {
      errorMetrics.componentErrors[component] = { 
        errors: 0, 
        recovered: 0 
      };
    }
    errorMetrics.componentErrors[component].errors++;
    
    // Record error type
    if (!errorMetrics.typeErrors[errorType]) {
      errorMetrics.typeErrors[errorType] = 0;
    }
    errorMetrics.typeErrors[errorType]++;
    
    // Record daily error
    const dateKey = timestamp.toISOString().split('T')[0];
    if (!errorMetrics.dailyErrors[dateKey]) {
      errorMetrics.dailyErrors[dateKey] = {
        errors: 0,
        recovered: 0
      };
    }
    errorMetrics.dailyErrors[dateKey].errors++;
    
    // Track detailed error info
    errorMetrics.recentErrors.unshift({
      timestamp,
      component,
      errorType,
      message: error.message || 'No message',
      status: 'New', // Will be updated if recovery happens
      stack: error.stack,
      context
    });
    
    // Limit recent errors array length
    if (errorMetrics.recentErrors.length > MAX_RECENT_ERRORS) {
      errorMetrics.recentErrors.pop();
    }
    
    // Persist metrics
    persistMetrics();
    
    return {
      errorId: errorMetrics.recentErrors[0].timestamp.getTime(),
      component,
      errorType
    };
  }
  
  /**
   * Record successful error recovery
   * 
   * @param {number} errorId - ID of the error that was recovered from
   * @param {number} retryCount - Which retry attempt was successful (0-indexed)
   */
  export function recordRecovery(errorId, retryCount) {
    // Find the error in recent errors
    const errorIndex = errorMetrics.recentErrors.findIndex(
      err => err.timestamp.getTime() === errorId
    );
    
    if (errorIndex >= 0) {
      const error = errorMetrics.recentErrors[errorIndex];
      error.status = 'Recovered';
      
      // Update component recovery count
      if (errorMetrics.componentErrors[error.component]) {
        errorMetrics.componentErrors[error.component].recovered++;
      }
      
      // Update daily recovery count
      const dateKey = error.timestamp.toISOString().split('T')[0];
      if (errorMetrics.dailyErrors[dateKey]) {
        errorMetrics.dailyErrors[dateKey].recovered++;
      }
      
      // Update retry metrics
      if (retryCount >= 0 && retryCount < 3) {
        errorMetrics.retryMetrics.attempts[retryCount]++;
        errorMetrics.retryMetrics.successes[retryCount]++;
      }
    }
    
    // Persist updated metrics
    persistMetrics();
  }
  
  /**
   * Record failed recovery attempt
   * 
   * @param {number} errorId - ID of the error that failed to recover
   * @param {number} retryCount - Which retry attempt failed (0-indexed)
   */
  export function recordFailedRecovery(errorId, retryCount) {
    // Find the error in recent errors
    const errorIndex = errorMetrics.recentErrors.findIndex(
      err => err.timestamp.getTime() === errorId
    );
    
    if (errorIndex >= 0) {
      const error = errorMetrics.recentErrors[errorIndex];
      
      if (retryCount >= errorMetrics.retryMetrics.attempts.length - 1) {
        error.status = 'Failed';
      } else {
        error.status = 'Retrying';
      }
      
      // Update retry metrics
      if (retryCount >= 0 && retryCount < 3) {
        errorMetrics.retryMetrics.attempts[retryCount]++;
        // Note: We don't increment successes here
      }
    }
    
    // Persist updated metrics
    persistMetrics();
  }
  
  /**
   * Record user behavior after error
   * 
   * @param {string} behavior - One of 'continued', 'refreshed', 'abandoned'
   */
  export function recordUserBehavior(behavior) {
    if (['continued', 'refreshed', 'abandoned'].includes(behavior)) {
      errorMetrics.userBehavior[behavior]++;
      persistMetrics();
    }
  }
  
  /**
   * Get formatted metrics data for the dashboard
   * 
   * @param {string} timeRange - Time range to filter by ('24h', '7d', '14d', '30d')
   * @returns {Object} Formatted metrics data
   */
  export function getMetricsData(timeRange = '14d') {
    const daysToInclude = timeRangeToDays(timeRange);
    
    // Filter data by time range
    const filteredData = filterDataByTimeRange(daysToInclude);
    
    // Format component errors for chart
    const componentErrors = Object.entries(filteredData.componentErrors).map(
      ([name, data]) => ({
        name,
        errors: data.errors,
        recovered: data.recovered
      })
    ).sort((a, b) => b.errors - a.errors);
    
    // Format error types for chart
    const typeErrors = Object.entries(filteredData.typeErrors).map(
      ([name, value]) => ({ name, value })
    ).sort((a, b) => b.value - a.value);
    
    // Format daily trend data
    const trendData = Object.entries(filteredData.dailyErrors)
      .map(([date, data]) => ({
        date,
        errors: data.errors,
        recovered: data.recovered
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Format user behavior data
    const userImpactData = [
      { name: 'Continued Session', value: filteredData.userBehavior.continued },
      { name: 'Refreshed Page', value: filteredData.userBehavior.refreshed },
      { name: 'Abandoned Session', value: filteredData.userBehavior.abandoned }
    ];
    
    // Calculate retry success rates
    const retrySuccessData = filteredData.retryMetrics.attempts.map((attempts, i) => {
      const successful = filteredData.retryMetrics.successes[i];
      const failed = attempts - successful;
      return {
        name: `${getAttemptName(i)}`,
        successful,
        failed
      };
    });
    
    // Recent errors
    const recentErrors = filteredData.recentErrors;
    
    return {
      componentErrors,
      typeErrors,
      trendData,
      userImpactData,
      retrySuccessData,
      recentErrors
    };
  }
  
  /**
   * Reset all metrics data
   * Used mainly for testing
   */
  export function resetMetrics() {
    errorMetrics = {
      componentErrors: {},
      typeErrors: {},
      dailyErrors: {},
      retryMetrics: {
        attempts: [0, 0, 0],
        successes: [0, 0, 0]
      },
      userBehavior: {
        continued: 0,
        refreshed: 0,
        abandoned: 0
      },
      recentErrors: []
    };
    persistMetrics();
  }
  
  // Helper functions
  
  /**
   * Convert time range string to number of days
   */
  function timeRangeToDays(timeRange) {
    switch (timeRange) {
      case '24h': return 1;
      case '7d': return 7;
      case '14d': return 14;
      case '30d': return 30;
      default: return 14;
    }
  }
  
  /**
   * Get formatted attempt name
   */
  function getAttemptName(index) {
    switch (index) {
      case 0: return 'First Attempt';
      case 1: return 'Second Attempt';
      case 2: return 'Third Attempt';
      default: return `Attempt ${index + 1}`;
    }
  }
  
  /**
   * Filter data by time range
   */
  function filterDataByTimeRange(days) {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(now.getDate() - days);
    
    // Filter daily errors
    const filteredDailyErrors = {};
    Object.entries(errorMetrics.dailyErrors).forEach(([date, data]) => {
      if (new Date(date) >= cutoffDate) {
        filteredDailyErrors[date] = data;
      }
    });
    
    // Filter recent errors
    const filteredRecentErrors = errorMetrics.recentErrors.filter(
      error => error.timestamp >= cutoffDate
    );
    
    // For demo purposes, we're not filtering component and type errors by date
    // In a real implementation, you would track timestamps with each component/type
    // and filter accordingly
    
    return {
      componentErrors: { ...errorMetrics.componentErrors },
      typeErrors: { ...errorMetrics.typeErrors },
      dailyErrors: filteredDailyErrors,
      retryMetrics: { ...errorMetrics.retryMetrics },
      userBehavior: { ...errorMetrics.userBehavior },
      recentErrors: filteredRecentErrors
    };
  }
  
  /**
   * Persist metrics to storage
   * In a real implementation, this would use localStorage, IndexedDB,
   * or call a backend API
   */
  function persistMetrics() {
    // For demo purposes, we only log to console
    // In a real app, you would use:
    // localStorage.setItem('errorMetrics', JSON.stringify(errorMetrics));
    
    // Or call your backend API:
    // fetch('/api/error-metrics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorMetrics)
    // });
    
    console.debug('Error metrics updated:', errorMetrics);
  }
  
  /**
   * Load metrics from storage
   * In a real implementation, this would use localStorage, IndexedDB,
   * or call a backend API
   */
  function loadMetrics() {
    // For demo purposes, we don't actually load anything
    // In a real app, you would use:
    // const stored = localStorage.getItem('errorMetrics');
    // if (stored) {
    //   try {
    //     errorMetrics = JSON.parse(stored);
    //   } catch (e) {
    //     console.error('Failed to parse stored metrics', e);
    //   }
    // }
    
    // Or call your backend API:
    // fetch('/api/error-metrics')
    //   .then(response => response.json())
    //   .then(data => {
    //     errorMetrics = data;
    //   });
  }
  
  // Initialize on load
  loadMetrics();
  
  // React hook for accessing metrics in components
  export function useErrorMetrics(timeRange = '14d') {
    const [metrics, setMetrics] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
      setIsLoading(true);
      
      // Simulate API call delay
      setTimeout(() => {
        const data = getMetricsData(timeRange);
        setMetrics(data);
        setIsLoading(false);
      }, 500);
      
      // Set up a refresh interval (every 30 seconds)
      const intervalId = setInterval(() => {
        const data = getMetricsData(timeRange);
        setMetrics(data);
      }, 30000);
      
      return () => clearInterval(intervalId);
    }, [timeRange]);
    
    return { metrics, isLoading };
  }