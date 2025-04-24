import React, { useState, useEffect } from 'react';
import { Tab, Severity } from './debugTypes';
import { DebugLogger } from './DebugLogger';
import { ApiTracer, ApiCallData } from './ApiTracer';

/**
 * API Debug Panel for the EnterpriseAnalysisDebugger
 * Displays detailed API call information with origin tracing and call chains
 */
const ApiDebugPanel: React.FC = () => {
  // State
  const [apiCalls, setApiCalls] = useState<ApiCallData[]>([]);
  const [rootCalls, setRootCalls] = useState<ApiCallData[]>([]);
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  // Get service instances
  const apiTracer = ApiTracer.getInstance();
  const logger = DebugLogger.getInstance();

  // Load API calls on mount
  useEffect(() => {
    const loadApiCalls = () => {
      const rootCalls = apiTracer.getRootCalls();
      setRootCalls(rootCalls);
      
      // Get all calls
      const allCalls = apiTracer.getApiCalls({
        hasError: showOnlyErrors ? true : undefined,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
      });
      
      // Filter by search term if provided
      const filteredCalls = searchTerm 
        ? allCalls.filter(call => 
            call.url.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (call.originComponent && call.originComponent.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (call.originAction && call.originAction.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : allCalls;
        
      setApiCalls(filteredCalls);
    };
    
    loadApiCalls();
    
    // Set up a refresh interval
    const intervalId = setInterval(loadApiCalls, 1000);
    
    return () => clearInterval(intervalId);
  }, [searchTerm, statusFilter, methodFilter, showOnlyErrors]);

  // Toggle expanded state for a call
  const toggleExpandCall = (callId: string) => {
    setExpandedCalls(prev => ({
      ...prev,
      [callId]: !prev[callId]
    }));
  };

  // Select a call to view details
  const handleSelectCall = (callId: string) => {
    setSelectedCallId(callId === selectedCallId ? null : callId);
  };

  // Clear all API calls
  const handleClearApiCalls = () => {
    if (window.confirm('Are you sure you want to clear all API call logs?')) {
      apiTracer.clearApiCalls();
      setApiCalls([]);
      setRootCalls([]);
      setSelectedCallId(null);
    }
  };

  // Export API calls to HAR format
  const handleExportHAR = () => {
    const har = apiTracer.exportToHAR();
    
    const blob = new Blob([har], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-calls-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.har`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };

  // Format timestamp to local time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get path from URL
  const getPathFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch (e) {
      return url;
    }
  };

  // Format duration in ms
  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    return `${duration}ms`;
  };

  // Get status badge class based on status code
  const getStatusBadgeClass = (status?: number) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    
    if (status >= 200 && status < 300) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    } else if (status >= 400 && status < 500) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    } else if (status >= 500) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Get method badge class
  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'POST':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'PATCH':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Render an API call in the list
  const renderApiCall = (call: ApiCallData, depth: number = 0) => {
    const isExpanded = expandedCalls[call.callId] || false;
    const isSelected = selectedCallId === call.callId;
    const hasError = !!call.error;
    const childCalls = apiCalls.filter(c => c.parentCallId === call.callId);
    
    return (
      <React.Fragment key={call.callId}>
        <div 
          className={`flex items-center px-2 py-1 border-b border-gray-200 dark:border-gray-700 text-xs hover:bg-gray-50 dark:hover:bg-gray-750 ${
            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          } ${
            hasError ? 'bg-red-50 dark:bg-red-900/10' : ''
          }`}
          style={{ paddingLeft: `${8 + depth * 20}px` }}
        >
          {/* Expand/Collapse button for calls with children */}
          {childCalls.length > 0 && (
            <button
              onClick={() => toggleExpandCall(call.callId)}
              className="mr-1 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isExpanded ? '▼' : '►'}
            </button>
          )}
          
          {/* Spacer for calls without children */}
          {childCalls.length === 0 && depth > 0 && (
            <div className="mr-1 w-4 h-4"></div>
          )}
          
          {/* Call info - clickable row */}
          <div 
            className="flex-1 grid grid-cols-12 gap-1 cursor-pointer"
            onClick={() => handleSelectCall(call.callId)}
          >
            <div className="col-span-1 text-gray-500 dark:text-gray-400">
              {formatTime(call.timestamp)}
            </div>
            
            <div className="col-span-1">
              <span className={`px-2 py-0.5 rounded text-xs ${getMethodBadgeClass(call.method)}`}>
                {call.method}
              </span>
            </div>
            
            <div className="col-span-4 truncate">
              {getPathFromUrl(call.url)}
            </div>
            
            <div className="col-span-1">
              {call.status ? (
                <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(call.status)}`}>
                  {call.status}
                </span>
              ) : (
                hasError ? (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    Error
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    Pending
                  </span>
                )
              )}
            </div>
            
            <div className="col-span-1 text-right">
              {formatDuration(call.responseTime)}
            </div>
            
            <div className="col-span-2 truncate">
              {call.originComponent || '-'}
            </div>
            
            <div className="col-span-2 truncate">
              {call.originAction || '-'}
            </div>
          </div>
        </div>
        
        {/* Render child calls if expanded */}
        {isExpanded && childCalls.map(childCall => renderApiCall(childCall, depth + 1))}
      </React.Fragment>
    );
  };

  // Render detailed view of selected call
  const renderCallDetails = () => {
    const selectedCall = apiCalls.find(call => call.callId === selectedCallId);
    if (!selectedCall) return null;
    
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded shadow overflow-auto max-h-96">
        <h3 className="text-lg font-medium mb-2 pb-1 border-b">API Call Details</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="font-medium text-sm mb-1">Basic Information</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">Call ID:</span>
                <span>{selectedCall.callId}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Parent Call ID:</span>
                <span>{selectedCall.parentCallId || 'None'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Method:</span>
                <span className={`px-2 rounded text-xs ${getMethodBadgeClass(selectedCall.method)}`}>
                  {selectedCall.method}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">URL:</span>
                <span className="truncate max-w-[200px]">{selectedCall.url}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Status:</span>
                <span className={`px-2 rounded text-xs ${getStatusBadgeClass(selectedCall.status)}`}>
                  {selectedCall.status || 'N/A'} {selectedCall.statusText || ''}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Time:</span>
                <span>{formatTime(selectedCall.timestamp)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Duration:</span>
                <span>{formatDuration(selectedCall.responseTime)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-sm mb-1">Origin Information</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">Component:</span>
                <span>{selectedCall.originComponent || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Action:</span>
                <span>{selectedCall.originAction || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="font-medium">Route:</span>
                <span>{selectedCall.routePath || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 space-y-3">
          {/* Request Headers */}
          <div>
            <h4 className="font-medium text-sm mb-1">Request Headers</h4>
            {selectedCall.requestHeaders && Object.keys(selectedCall.requestHeaders).length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-750 p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                {Object.entries(selectedCall.requestHeaders).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <div className="font-medium text-blue-600 dark:text-blue-400">{key}:</div>
                    <div className="col-span-2">{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No request headers</div>
            )}
          </div>
          
          {/* Request Body */}
          <div>
            <h4 className="font-medium text-sm mb-1">Request Body</h4>
            {selectedCall.requestBody ? (
              <div className="bg-gray-50 dark:bg-gray-750 p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                <pre>{JSON.stringify(selectedCall.requestBody, null, 2)}</pre>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No request body</div>
            )}
          </div>
          
          {/* Response Headers */}
          <div>
            <h4 className="font-medium text-sm mb-1">Response Headers</h4>
            {selectedCall.responseHeaders && Object.keys(selectedCall.responseHeaders).length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-750 p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                {Object.entries(selectedCall.responseHeaders).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <div className="font-medium text-blue-600 dark:text-blue-400">{key}:</div>
                    <div className="col-span-2">{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No response headers</div>
            )}
          </div>
          
          {/* Response Body */}
          <div>
            <h4 className="font-medium text-sm mb-1">Response Body</h4>
            {selectedCall.responseBody ? (
              <div className="bg-gray-50 dark:bg-gray-750 p-2 rounded text-xs font-mono max-h-48 overflow-auto">
                <pre>{JSON.stringify(selectedCall.responseBody, null, 2)}</pre>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">No response body</div>
            )}
          </div>
          
          {/* Error Information */}
          {selectedCall.error && (
            <div>
              <h4 className="font-medium text-sm mb-1 text-red-600 dark:text-red-400">Error</h4>
              <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                <div className="font-medium">{selectedCall.error.message || String(selectedCall.error)}</div>
                {selectedCall.error.stack && (
                  <pre className="mt-1 text-gray-600 dark:text-gray-400">{selectedCall.error.stack}</pre>
                )}
              </div>
            </div>
          )}
          
          {/* Origin Stack Trace */}
          {selectedCall.originStack && (
            <div>
              <h4 className="font-medium text-sm mb-1">Origin Stack Trace</h4>
              <div className="bg-gray-50 dark:bg-gray-750 p-2 rounded text-xs font-mono max-h-32 overflow-auto">
                <pre>{selectedCall.originStack}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">API Call Analyzer</h3>
        
        <div className="flex space-x-2">
          <button
            onClick={handleExportHAR}
            className="px-2 py-1 text-xs text-white rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            title="Export as HAR file"
          >
            Export HAR
          </button>
          
          <button
            onClick={handleClearApiCalls}
            className="px-2 py-1 text-xs text-white rounded bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            title="Clear all API calls"
          >
            Clear All
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-4 grid grid-cols-12 gap-2 bg-white dark:bg-gray-800 p-2 rounded shadow">
        <div className="col-span-5">
          <input
            type="text"
            placeholder="Search URL, component or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        
        <div className="col-span-2">
          <select
            value={methodFilter || ''}
            onChange={(e) => setMethodFilter(e.target.value || null)}
            className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
        
        <div className="col-span-3">
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="">All Status Codes</option>
            <option value="200">200 OK</option>
            <option value="201">201 Created</option>
            <option value="204">204 No Content</option>
            <option value="400">400 Bad Request</option>
            <option value="401">401 Unauthorized</option>
            <option value="403">403 Forbidden</option>
            <option value="404">404 Not Found</option>
            <option value="500">500 Server Error</option>
          </select>
        </div>
        
        <div className="col-span-2 flex items-center">
          <label className="flex items-center space-x-1 text-xs">
            <input
              type="checkbox"
              checked={showOnlyErrors}
              onChange={(e) => setShowOnlyErrors(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span>Show Errors Only</span>
          </label>
        </div>
      </div>
      
      {/* API Call Stats */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
          <div className="text-sm font-medium">Total Calls</div>
          <div className="text-2xl font-bold">{apiCalls.length}</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
          <div className="text-sm font-medium">Success Calls</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {apiCalls.filter(call => call.status && call.status >= 200 && call.status < 300).length}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
          <div className="text-sm font-medium">Client Errors</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {apiCalls.filter(call => call.status && call.status >= 400 && call.status < 500).length}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
          <div className="text-sm font-medium">Server Errors</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {apiCalls.filter(call => call.status && call.status >= 500).length}
          </div>
        </div>
      </div>
      
      {/* API Calls List */}
      <div className="bg-white dark:bg-gray-800 rounded shadow mb-4">
        <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 grid grid-cols-12 gap-1 text-xs font-medium">
          <div className="col-span-1">Time</div>
          <div className="col-span-1">Method</div>
          <div className="col-span-4">URL</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Duration</div>
          <div className="col-span-2">Component</div>
          <div className="col-span-2">Action</div>
        </div>
        
        <div className="max-h-96 overflow-auto">
          {apiCalls.length > 0 ? (
            rootCalls.map(rootCall => renderApiCall(rootCall))
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No API calls recorded yet
            </div>
          )}
        </div>
      </div>
      
      {/* Selected Call Details */}
      {selectedCallId && renderCallDetails()}
    </div>
  );
};

export default ApiDebugPanel;