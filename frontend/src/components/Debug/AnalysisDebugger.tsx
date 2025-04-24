import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tab, Severity } from './debugTypes';
import { List } from 'react-virtualized';
import { ErrorTrackingService } from '../../services/ErrorTracking';

// Define the enhanced tabs for our debugger
const TABS = [
  Tab.Dashboard,
  Tab.FileSystem,
  Tab.Analysis,
  Tab.State,
  Tab.Events,
  Tab.Network,
  Tab.Performance,
  Tab.Errors,
  Tab.Fixes,
  Tab.Analytics
];

/**
 * Enhanced Enterprise Analysis Debugger with comprehensive debugging capabilities
 */
const EnterpriseAnalysisDebugger = ({
  selectedFile,
  isButtonEnabled,
  loading,
  analyzeButtonRef,
  analyses = [],
  applicationState = {},
  networkRequests = [],
  modelConfig = {},
  appDispatch = () => {},
}) => {
  // State management
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(Tab.Dashboard);
  const [darkMode, setDarkMode] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterSeverity, setFilterSeverity] = useState();
  const [logs, setLogs] = useState([]);
  const [fixes, setFixes] = useState([]);
  const [renderCount, setRenderCount] = useState(0);
  const [appState, setAppState] = useState({
    reactVersion: React.version,
    domNodeCount: 0,
    eventListeners: 0,
    memoryUsage: null,
    lastRenderTimestamp: Date.now()
  });
  
  // Refs
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const logger = useRef(null);
  
  // Initialize logger if not created
  if (!logger.current) {
    logger.current = DebugLogger.getInstance();
  }

  // Performance monitoring - count renders
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);
  
  // Measure DOM metrics periodically
  useEffect(() => {
    const updateDOMMetrics = () => {
      setAppState(prev => ({
        ...prev,
        domNodeCount: document.querySelectorAll('*').length,
        eventListeners: calculateTotalEventListeners(),
        memoryUsage: window.performance?.memory?.usedJSHeapSize || null,
        lastRenderTimestamp: Date.now()
      }));
    };
    
    updateDOMMetrics();
    const intervalId = setInterval(updateDOMMetrics, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Subscribe to logger updates
  useEffect(() => {
    const updateLogsFromLogger = () => {
      const updatedLogs = logger.current.getLogs();
      setLogs(updatedLogs);
      
      // Update fixes as well
      setFixes(logger.current.getFixes());
    };
    
    // Initial update
    updateLogsFromLogger();
    
    // Subscribe to log changes
    const unsubscribe = logger.current.subscribe(updateLogsFromLogger);
    
    return unsubscribe;
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt + [1-9] for tab switching
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const tabIndex = parseInt(e.key, 10) - 1;
        if (tabIndex < TABS.length) {
          setActiveTab(TABS[tabIndex]);
        }
      }
      
      // Ctrl+Shift+D to toggle expanded state
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsExpanded(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Focus search input on certain key presses when debugger is active
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isExpanded && e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
        }
      }
    };
    
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [isExpanded]);
  
  // Filter logs based on filter settings
  const filteredLogs = logs.filter(log => {
    // Filter by severity if set
    if (filterSeverity && log.severity !== filterSeverity) {
      return false;
    }
    
    // Filter by search term
    if (filterText) {
      const searchLower = filterText.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        log.tab.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data).toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });
  
  // Helper to calculate total event listeners
  const calculateTotalEventListeners = () => {
    // This is a simplified approximation - actual tracking would need browser devtools integration
    // or more sophisticated monitoring
    let count = 0;
    const allElements = document.querySelectorAll('*');
    
    // Sample a subset of elements to estimate
    const sampleSize = Math.min(100, allElements.length);
    let totalEventTypes = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const element = allElements[Math.floor(Math.random() * allElements.length)];
      if (element && element.__reactEvents) {
        totalEventTypes += Object.keys(element.__reactEvents).length;
      }
    }
    
    // Rough estimate: average events per sampled element * total elements
    count = Math.round((totalEventTypes / sampleSize) * allElements.length);
    return count || 0;
  };
  
  // Utility function to format bytes
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0 || bytes === null || bytes === undefined) return 'N/A';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  // Utility to create a short ID
  const shortId = () => Math.random().toString(36).substring(2, 10);
  
  // Data export
  const handleDownloadJSON = () => {
    const dataToExport = {
      logs,
      fixes,
      appState,
      exportTime: new Date().toISOString(),
      renderCount
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };
  
  const handleDownloadCSV = () => {
    // Convert logs to CSV format
    const headers = ['Timestamp', 'Tab', 'Severity', 'Message', 'Data'];
    
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.tab,
      log.severity,
      `"${log.message.replace(/"/g, '""')}"`,
      `"${JSON.stringify(log.data).replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };
  
  // Clear logs
  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      logger.current.clearLogs();
    }
  };
  
  // Handler for dismissing a fix
  const handleDismissFix = (fixId) => {
    logger.current.dismissFix(fixId);
  };
  
  // Handler for applying a fix
  const handleApplyFix = (fixId, fixFunction) => {
    try {
      if (typeof fixFunction === 'function') {
        fixFunction();
        logger.current.log(Tab.Fixes, `Applied fix: ${fixId}`, {}, Severity.Info);
        handleDismissFix(fixId);
      } else {
        // Execute the fix script if it's a string
        if (typeof fixFunction === 'string') {
          // eslint-disable-next-line no-new-func
          const fixFn = new Function(fixFunction);
          fixFn();
          logger.current.log(Tab.Fixes, `Applied fix script: ${fixId}`, {}, Severity.Info);
          handleDismissFix(fixId);
        }
      }
    } catch (error) {
      logger.current.log(Tab.Fixes, `Error applying fix: ${error.message}`, { stack: error.stack }, Severity.Error);
    }
  };
  
  // Handler for testing a button
  const handleTestButton = () => {
    logger.current.log(Tab.Events, 'Button test initiated', {}, Severity.Info);
    
    if (analyzeButtonRef?.current) {
      try {
        // Attempt to simulate a click
        analyzeButtonRef.current.click();
        logger.current.log(Tab.Events, 'Button click simulated successfully', {}, Severity.Info);
      } catch (error) {
        logger.current.log(Tab.Events, 'Error simulating button click', { error: error.message }, Severity.Error);
        
        // Add a potential fix
        setFixes(prev => [
          ...prev,
          {
            id: shortId(),
            issue: 'Button click simulation failed',
            description: 'The button could not be clicked programmatically. The event handler might be missing or misconfigured.',
            suggestion: 'Verify the button has an onClick handler correctly attached.',
            severity: Severity.Warn,
            timestamp: Date.now()
          }
        ]);
      }
    } else {
      logger.current.log(Tab.Events, 'Button reference is not available', {}, Severity.Warn);
    }
  };
  
  // Handler for fixing a button
  const handleFixButton = () => {
    logger.current.log(Tab.Fixes, 'Adding direct click handler to button', {}, Severity.Info);
    
    if (analyzeButtonRef?.current) {
      try {
        // Try to find the existing click handler
        const existingHandler = analyzeButtonRef.current.onclick;
        
        if (existingHandler) {
          logger.current.log(Tab.Fixes, 'Button already has a click handler', {}, Severity.Info);
        } else {
          // Add a dummy handler for testing
          analyzeButtonRef.current.onclick = () => {
            logger.current.log(Tab.Events, 'Direct click handler fired', {}, Severity.Info);
          };
          logger.current.log(Tab.Fixes, 'Added direct click handler to button', {}, Severity.Success);
        }
      } catch (error) {
        logger.current.log(Tab.Fixes, 'Error adding click handler', { error: error.message }, Severity.Error);
      }
    } else {
      logger.current.log(Tab.Fixes, 'Button reference is not available', {}, Severity.Warn);
    }
  };
  
  // Render a fix suggestion
  const renderFixSuggestion = (fix) => (
    <div key={fix.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{fix.issue}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">{fix.description}</p>
        </div>
        <button
          onClick={() => handleDismissFix(fix.id)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
      
      <p className="text-sm mt-2">{fix.suggestion}</p>
      
      <div className="mt-3 flex justify-end space-x-2">
        {fix.fixFunction && (
          <button
            onClick={() => handleApplyFix(fix.id, fix.fixFunction)}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Apply Fix
          </button>
        )}
        <button
          onClick={() => handleDismissFix(fix.id)}
          className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
  
  // Render a log row in the list
  const renderLogRow = ({ index, style }) => {
    const log = filteredLogs[index];
    if (!log) return null;
    
    const severityColors = {
      [Severity.Debug]: 'text-gray-500 dark:text-gray-400',
      [Severity.Info]: 'text-blue-600 dark:text-blue-400',
      [Severity.Warn]: 'text-yellow-600 dark:text-yellow-400',
      [Severity.Error]: 'text-red-600 dark:text-red-400',
      [Severity.Critical]: 'text-red-700 dark:text-red-300 font-bold',
      [Severity.Success]: 'text-green-600 dark:text-green-400'
    };
    
    return (
      <div
        style={style}
        className={`px-4 py-1 text-xs border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 ${
          index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-750'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 dark:text-gray-500">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`px-2 rounded ${severityColors[log.severity] || 'text-gray-500'}`}>
              {log.severity}
            </span>
            <span className="font-medium">{log.message}</span>
          </div>
          <span className="text-gray-400 dark:text-gray-500">{log.tab}</span>
        </div>
      </div>
    );
  };
  
  // Render analytics chart
  const renderAnalyticsChart = (data, index) => (
    <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-4">
      <h5 className="font-medium mb-2">{data.title}</h5>
      
      <div className="flex items-center space-x-2">
        {Object.entries(data.data).map(([key, value], i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 flex-1"
          >
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-1">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${(value / data.total) * 100}%` }}
              ></div>
            </div>
            <div className="text-xs font-semibold">{key}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {value} ({Math.round((value / data.total) * 100)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ENHANCED: File System tab content
  const renderFileSystemTab = () => {
    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-3">File System Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">Current File</h3>
            {selectedFile ? (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-medium">{formatBytes(selectedFile.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-medium">{selectedFile.type || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Modified:</span>
                  <span className="font-medium">
                    {new Date(selectedFile.lastModified).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No file selected
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">File Operations</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Upload Operations:</span>
                <span className="font-medium">
                  {logs.filter(log => log.message.includes('file') && log.message.includes('upload')).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Read Operations:</span>
                <span className="font-medium">
                  {logs.filter(log => log.message.includes('file') && log.message.includes('read')).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>File Size Check:</span>
                <span className={`font-medium ${selectedFile && selectedFile.size > 5 * 1024 * 1024 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                  {selectedFile ? (selectedFile.size > 5 * 1024 * 1024 ? 'Warning: Large File' : 'OK') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-white dark:bg-gray-800 p-3 rounded shadow">
          <h3 className="text-lg font-medium mb-2 border-b pb-1">Recent File Operations</h3>
          <div className="max-h-40 overflow-auto">
            {logs
              .filter(log => 
                log.message.toLowerCase().includes('file') || 
                (log.data && JSON.stringify(log.data).toLowerCase().includes('file'))
              )
              .slice(-10)
              .reverse()
              .map((log, index) => (
                <div key={index} className="text-xs border-b pb-1 last:border-b-0 last:pb-0 py-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.message}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <pre className="text-gray-600 dark:text-gray-400 overflow-x-auto mt-1">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ENHANCED: Analysis tab content
  const renderAnalysisTab = () => {
    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-3">Analysis Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">Analysis Configuration</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Selected Model:</span>
                <span className="font-medium">{modelConfig.selectedModel || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Stream Mode:</span>
                <span className="font-medium">{modelConfig.streamMode ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between">
                <span>Analysis Type:</span>
                <span className="font-medium">{modelConfig.analysisType || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Tokens:</span>
                <span className="font-medium">{modelConfig.maxTokens || 'Default'}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">Analysis Statistics</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Total Analyses:</span>
                <span className="font-medium">{analyses.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Request:</span>
                <span className={`font-medium ${loading ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                  {loading ? 'In Progress' : 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average Analysis Time:</span>
                <span className="font-medium">
                  {analyses.length > 0 
                    ? `${((analyses.reduce((sum, a) => sum + (a.processingTime || 0), 0)) / analyses.length).toFixed(2)}ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Processing Status:</span>
                <span className="font-medium">
                  {loading ? modelConfig.progressStatus || 'Processing...' : 'Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 bg-white dark:bg-gray-800 p-3 rounded shadow">
          <h3 className="text-lg font-medium mb-2 border-b pb-1">Analysis Request History</h3>
          <div className="max-h-40 overflow-auto">
            {logs
              .filter(log => 
                (log.tab === Tab.Analysis || log.message.toLowerCase().includes('analy'))
              )
              .slice(-10)
              .reverse()
              .map((log, index) => (
                <div key={index} className="text-xs border-b pb-1 last:border-b-0 last:pb-0 py-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.message}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <pre className="text-gray-600 dark:text-gray-400 overflow-x-auto mt-1">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ENHANCED: Network tab content
  const renderNetworkTab = () => {
    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-3">Network Activity</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">Request Summary</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Total Requests:</span>
                <span className="font-medium">{networkRequests.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Requests:</span>
                <span className="font-medium">
                  {networkRequests.filter(r => r.status === 'pending').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Successful:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {networkRequests.filter(r => r.status === 'success').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {networkRequests.filter(r => r.status === 'error').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average Response Time:</span>
                <span className="font-medium">
                  {networkRequests.length > 0 
                    ? `${((networkRequests
                        .filter(r => r.responseTime)
                        .reduce((sum, r) => sum + r.responseTime, 0)) / 
                        networkRequests.filter(r => r.responseTime).length).toFixed(2)}ms`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <h3 className="text-lg font-medium mb-2 border-b pb-1">Recent Network Activity</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="py-2 px-3 text-left">Time</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-left">URL</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Size</th>
                    <th className="py-2 px-3 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {networkRequests.slice(-10).map((request, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-gray-200 dark:border-gray-700 ${
                        request.status === 'error' 
                          ? 'bg-red-50 dark:bg-red-900/20' 
                          : request.status === 'pending'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20'
                            : ''
                      }`}
                    >
                      <td className="py-2 px-3">{new Date(request.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3">{request.method}</td>
                      <td className="py-2 px-3 max-w-xs truncate">{request.url}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          request.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : request.status === 'error'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {request.status === 'success' 
                            ? request.statusCode 
                            : request.status === 'error'
                              ? 'Error'
                              : 'Pending'}
                        </span>
                      </td>
                      <td className="py-2 px-3">{formatBytes(request.size || 0)}</td>
                      <td className="py-2 px-3">{request.responseTime ? `${request.responseTime}ms` : 'N/A'}</td>
                    </tr>
                  ))}
                  {networkRequests.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-4 text-center text-gray-500 dark:text-gray-400">
                        No network requests recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case Tab.Dashboard:
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-3">Debug Dashboard</h3>
            
            {/* Quick status cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className={`p-3 rounded shadow ${
                logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length > 0
                  ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              }`}>
                <div className="text-lg font-medium">Errors</div>
                <div className="text-3xl font-bold">
                  {logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length}
                </div>
              </div>
              
              <div className={`p-3 rounded shadow ${
                logs.filter(log => log.severity === Severity.Warn).length > 0
                  ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
                  : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              }`}>
                <div className="text-lg font-medium">Warnings</div>
                <div className="text-3xl font-bold">
                  {logs.filter(log => log.severity === Severity.Warn).length}
                </div>
              </div>
              
              <div className="p-3 rounded shadow bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                <div className="text-lg font-medium">Log Entries</div>
                <div className="text-3xl font-bold">{logs.length}</div>
              </div>
            </div>
            
            {/* File and button status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
                <h3 className="text-lg font-medium mb-2 border-b pb-1">File Status</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Selected File:</span>
                    <span className="font-medium">{selectedFile ? selectedFile.name : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="font-medium">{selectedFile ? formatBytes(selectedFile.size) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Button Enabled:</span>
                    <span className={`font-medium ${isButtonEnabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isButtonEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loading:</span>
                    <span className={`font-medium ${loading ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                      {loading ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Button Ref:</span>
                    <span className={`font-medium ${analyzeButtonRef?.current ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {analyzeButtonRef?.current ? 'Available' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Click Handler:</span>
                    <span className={`font-medium ${analyzeButtonRef?.current?.onclick ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {analyzeButtonRef?.current?.onclick ? 'Attached' : 'Missing'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
                <h3 className="text-lg font-medium mb-2 border-b pb-1">System Status</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>React Version:</span>
                    <span className="font-medium">{appState.reactVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DOM Nodes:</span>
                    <span className={`font-medium ${appState.domNodeCount > 1000 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                      {appState.domNodeCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Event Listeners:</span>
                    <span className={`font-medium ${appState.eventListeners > 100 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                      {appState.eventListeners}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Usage:</span>
                    <span className="font-medium">
                      {appState.memoryUsage ? formatBytes(appState.memoryUsage) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Component Renders:</span>
                    <span className="font-medium">{renderCount}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
              <h3 className="text-lg font-medium mb-2 border-b pb-1">Button Analysis Tools</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleTestButton}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  Test Button Click
                </button>
                <button
                  onClick={handleFixButton}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                >
                  Add Direct Handler
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `// Paste this in your browser console to fix button click issues:
const button = document.querySelector('[data-test-id="analyze-button"]');
if (button) {
  button.addEventListener('click', () => {
    console.log('Direct click handler fired');
    // This will attempt to run your analysis logic
  });
  console.log('Added direct click handler to analyze button');
}`
                    );
                    logger.current.log(Tab.Fixes, 'Copied fix script to clipboard', {}, Severity.Info);
                  }}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
                >
                  Copy Fix Script
                </button>
              </div>
              
              <div className="mt-3 text-sm">
                <div className="font-medium">Debug Summary:</div>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Total Log Entries: {logs.length}</li>
                  <li>Errors: {logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length}</li>
                  <li>Warnings: {logs.filter(log => log.severity === Severity.Warn).length}</li>
                  <li>Available Fixes: {fixes.length}</li>
                </ul>
              </div>
            </div>
            
            {/* Recent errors and fixes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
                <h3 className="text-lg font-medium mb-2 border-b pb-1">Recent Errors</h3>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {logs
                    .filter(log => log.severity === Severity.Error || log.severity === Severity.Critical)
                    .slice(-5)
                    .reverse()
                    .map((log, index) => (
                      <div key={index} className="text-xs border-b pb-1 last:border-b-0 last:pb-0">
                        <div className="font-medium text-red-600 dark:text-red-400">{log.message}</div>
                        <div className="text-gray-500 dark:text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  {logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No errors logged</div>
                  )}
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
                <h3 className="text-lg font-medium mb-2 border-b pb-1">Suggested Fixes</h3>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {fixes.slice(0, 3).map((fix, index) => (
                    <div key={index} className="text-xs border-b pb-1 last:border-b-0 last:pb-0">
                      <div className="font-medium">{fix.issue}</div>
                      <div className="text-gray-600 dark:text-gray-400">{fix.suggestion}</div>
                    </div>
                  ))}
                  {fixes.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No fixes available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
        
      case Tab.FileSystem:
        return renderFileSystemTab();
        
      case Tab.Analysis:
        return renderAnalysisTab();
      
      case Tab.Network:
        return renderNetworkTab();
        
      case Tab.Fixes:
        return (
          <div className="p-4">
            <div className="flex justify-between mb-3">
              <h3 className="text-lg font-medium">Suggested Fixes ({fixes.length})</h3>
              {fixes.length > 0 && (
                <button
                  onClick={() => fixes.forEach(fix => handleDismissFix(fix.id))}
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Dismiss All
                </button>
              )}
            </div>
            
            {fixes.length > 0 ? (
              <div className="space-y-3">
                {fixes.map(renderFixSuggestion)}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 p-4 rounded text-center text-gray-500 dark:text-gray-400">
                No fix suggestions available
              </div>
            )}
          </div>
        );
        
      case Tab.Analytics:
        const analytics = logger.current.getAnalytics();
        
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-3">Debug Analytics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tab usage chart */}
              <div>
                <h4 className="text-md font-medium mb-2">Tab Usage</h4>
                {analytics
                  .filter(item => item.category === 'tab_usage')
                  .map((data, index) => renderAnalyticsChart(data, index))}
              </div>
              
              {/* Severity distribution */}
              <div>
                <h4 className="text-md font-medium mb-2">Log Severity</h4>
                {analytics
                  .filter(item => item.category === 'severity')
                  .map((data, index) => renderAnalyticsChart(data, index))}
              </div>
            </div>
            
            {/* Performance metrics over time */}
            <div className="mt-4">
              <h4 className="text-md font-medium mb-2">Performance Metrics</h4>
              <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  {/* This would be where we'd show more detailed charts if we had a charting library */}
                  Performance metrics visualization would be shown here
                </div>
              </div>
            </div>
          </div>
        );
      
      case Tab.State:
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-3">Application State</h3>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
              <pre className="text-xs overflow-auto max-h-96 font-mono">
                {JSON.stringify(
                  {
                    fileState: {
                      selectedFile: selectedFile 
                        ? { 
                            name: selectedFile.name,
                            size: selectedFile.size,
                            type: selectedFile.type,
                            lastModified: new Date(selectedFile.lastModified).toISOString()
                          }
                        : null,
                      isButtonEnabled,
                      loading,
                      buttonRef: analyzeButtonRef?.current 
                        ? 'Available' 
                        : 'Missing'
                    },
                    systemState: {
                      ...appState,
                      currentTime: new Date().toISOString(),
                    },
                    modelState: {
                      ...modelConfig,
                    },
                    analysisState: {
                      analysesCount: analyses.length,
                      completedAnalyses: analyses.filter(a => a.status === 'completed').length,
                      lastAnalysisTimestamp: analyses.length > 0 ? analyses[analyses.length - 1].timestamp : null
                    },
                    debug: {
                      totalLogs: logs.length,
                      errorCount: logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length,
                      warningCount: logs.filter(log => log.severity === Severity.Warn).length,
                      fixCount: fixes.length,
                    }
                  }, 
                  null, 
                  2
                )}
              </pre>
            </div>
          </div>
        );
        
      // For all other tabs (Events, Performance, Errors)
      default:
        return (
          <div className="flex flex-col h-full">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter logs..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                
                <select
                  value={filterSeverity || ''}
                  onChange={(e) => setFilterSeverity(e.target.value ? e.target.value : undefined)}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Severities</option>
                  {Object.values(Severity).map(severity => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
                
                <button
                  onClick={() => {
                    setFilterText('');
                    setFilterSeverity(undefined);
                  }}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
                  title="Clear filters"
                >
                  Clear
                </button>
              </div>
              
              <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}</span>
                
                <div className="space-x-2">
                  <button
                    onClick={handleClearLogs}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Clear all logs"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => listRef.current?.scrollToItem(filteredLogs.length - 1)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Scroll to end"
                  >
                    Latest
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {filteredLogs.length > 0 ? (
                <List
                  ref={listRef}
                  height={400}
                  itemCount={filteredLogs.length}
                  itemSize={28}
                  width="100%"
                  className="scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
                >
                  {renderLogRow}
                </List>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No logs to display
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden`}>  
      <header className="flex items-center justify-between p-2 bg-gray-800 dark:bg-gray-700 text-white">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-bold">Enterprise Debug Console</h2>
          {isExpanded ? (
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-xs bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 px-2 py-1 rounded"
              title="Collapse console"
            >
              Collapse
            </button>
          ) : (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-xs bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 px-2 py-1 rounded"
              title="Expand console"
            >
              Expand
            </button>
          )}
        </div>
        
        <div className="flex space-x-2">
          {isExpanded && (
            <>
              <button 
                onClick={handleDownloadJSON} 
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                title="Export logs as JSON"
              >
                JSON
              </button>
              <button 
                onClick={handleDownloadCSV} 
                className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                title="Export logs as CSV"
              >
                CSV
              </button>
            </>
          )}
          <button 
            onClick={() => setDarkMode(!darkMode)} 
            className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {isExpanded && (
        <>
          <nav className="flex overflow-x-auto border-b bg-gray-200 dark:bg-gray-800 text-sm">
            {TABS.map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={activeTab === tab}
                className={`px-3 py-2 whitespace-nowrap font-medium ${
                  activeTab === tab
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={`Alt+${index + 1}`}
              >
                {tab}
                {tab === Tab.Errors && logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 w-4 text-xs bg-red-600 text-white rounded-full">
                    {logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length}
                  </span>
                )}
                {tab === Tab.Fixes && fixes.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 w-4 text-xs bg-green-600 text-white rounded-full">
                    {fixes.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-850 h-[500px]">
            {renderTabContent()}
          </div>
        </>
      )}
      
      {!isExpanded && (
        <div className="p-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="font-medium">Status:</div>
            <div className={`font-medium ${
              logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length > 0
                ? 'text-red-600 dark:text-red-400'
                : logs.filter(log => log.severity === Severity.Warn).length > 0
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
            }`}>
              {logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length > 0
                ? `${logs.filter(log => log.severity === Severity.Error || log.severity === Severity.Critical).length} Errors`
                : logs.filter(log => log.severity === Severity.Warn).length > 0
                  ? `${logs.filter(log => log.severity === Severity.Warn).length} Warnings`
                  : 'All Good'}
            </div>
            
            {fixes.length > 0 && (
              <div className="text-blue-600 dark:text-blue-400">
                {fixes.length} fix suggestions available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Logger Implementation ====================
class DebugLogger {
  static instance = null;
  logs = [];
  fixes = [];
  subscribers = [];
  tabUsage = {};
  severityCounts = {};
  
  // Singleton pattern
  static getInstance() {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  constructor() {
    // Initialize tab usage tracking
    Object.values(Tab).forEach(tab => {
      this.tabUsage[tab] = 0;
    });
    
    // Initialize severity counts
    Object.values(Severity).forEach(severity => {
      this.severityCounts[severity] = 0;
    });
  }
  
  log(tab, message, data = {}, severity = Severity.Info) {
    const logEntry = {
      id: Math.random().toString(36).substring(2, 15),
      timestamp: Date.now(),
      tab,
      message,
      data,
      severity
    };
    
    this.logs.push(logEntry);
    
    // Update analytics
    this.tabUsage[tab] = (this.tabUsage[tab] || 0) + 1;
    this.severityCounts[severity] = (this.severityCounts[severity] || 0) + 1;
    
    // Notify subscribers
    this.notifySubscribers();
    
    return logEntry.id;
  }
  
  addFix(issue, description, suggestion, fixFunction = null, severity = Severity.Warn) {
    const fix = {
      id: Math.random().toString(36).substring(2, 15),
      issue,
      description,
      suggestion,
      fixFunction,
      severity,
      timestamp: Date.now()
    };
    
    this.fixes.push(fix);
    this.notifySubscribers();
    
    return fix.id;
  }
  
  dismissFix(fixId) {
    this.fixes = this.fixes.filter(fix => fix.id !== fixId);
    this.notifySubscribers();
  }
  
  clearLogs() {
    this.logs = [];
    this.notifySubscribers();
  }
  
  getLogs() {
    return [...this.logs];
  }
  
  getFixes() {
    return [...this.fixes];
  }
  
  getAnalytics() {
    return [
      {
        category: 'tab_usage',
        title: 'Tab Usage Distribution',
        data: { ...this.tabUsage },
        total: Object.values(this.tabUsage).reduce((sum, count) => sum + count, 0)
      },
      {
        category: 'severity',
        title: 'Log Severity Distribution',
        data: { ...this.severityCounts },
        total: Object.values(this.severityCounts).reduce((sum, count) => sum + count, 0)
      }
    ];
  }
  
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  notifySubscribers() {
    this.subscribers.forEach(callback => callback());
  }
}

// ==================== Error Boundary ====================
interface ErrorBoundaryState { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo; }
class DebugErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  
  static getDerivedStateFromError(error: Error) { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    ErrorTrackingService.captureException(error, { extra: info });
    DebugLogger.getInstance().log(Tab.Errors, 'Component Error', { stack: error.stack, componentStack: info.componentStack }, Severity.Error);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded m-4">
          <h3 className="text-red-600 dark:text-red-300 font-bold mb-2">Debug Console Error</h3>
          <pre className="text-sm whitespace-pre-wrap text-red-700 dark:text-red-400">{this.state.error?.toString()}</pre>
          {this.state.errorInfo && (
            <details className="mt-2 text-red-700 dark:text-red-400 text-sm">
              <summary>Component Stack</summary>
              <pre className="overflow-auto mt-1 p-2 bg-red-100 dark:bg-red-900/50 rounded">{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}