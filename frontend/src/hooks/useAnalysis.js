import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  API_URL, 
  REQUEST_TIMEOUT, 
  SUPPORTED_EXTENSIONS, 
  MAX_FILE_SIZE,
  ISSUE_PATTERNS 
} from '../constants';

/**
 * Enterprise-grade custom hook for file analysis with robust error handling,
 * performance optimizations, and comprehensive state management.
 * 
 * @returns {Object} Analysis state and methods
 */
const useAnalysis = () => {
  // State management with meaningful defaults
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [categorizedIssues, setCategorizedIssues] = useState({
    critical: [],
    high: [],
    medium: [],
    low: []
  });

  // Debug mode for development environments
  const isDebugMode = process.env.NODE_ENV === 'development';
  
  // Enhanced logging with environment awareness
  const logDebug = useCallback((message, data) => {
    if (isDebugMode) {
      console.debug(`[useAnalysis] ${message}`, data);
    }
  }, [isDebugMode]);
  
  const logError = useCallback((message, error) => {
    console.error(`[useAnalysis] ${message}`, error);
  }, []);

  // Reference to track and manage in-flight requests
  const abortControllerRef = useRef(null);
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      logDebug('Component unmounting, cleaning up resources');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounted');
      }
    };
  }, [logDebug]);

  /**
   * Extract issue description from content based on severity level
   * @param {string} content - Text content to analyze
   * @param {string} severity - Severity level (critical, high, medium, low)
   * @returns {string} Extracted description or default message
   */
  const extractIssueDescription = useCallback((content, severity) => {
    if (!content) return 'Issue detected';
    
    // Use patterns from constants
    const pattern = ISSUE_PATTERNS[severity];
    if (!pattern) return 'Issue detected';
    
    const match = content.match(pattern);
    return match ? match[1] : 'Issue detected';
  }, []);

  /**
   * Categorize issues from analysis results
   * @param {Array} analysisData - Analysis results to categorize
   */
  const categorizeIssues = useCallback((analysisData) => {
    if (!analysisData || analysisData.length === 0) return;
    
    const categorized = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    analysisData.forEach(analysis => {
      if (!analysis) return;
      
      // Generate unique IDs with timestamps to avoid duplicates
      const idBase = `${analysis.chunk || 'item'}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      // Content to analyze
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''}`;
      
      // Process crash-focused analysis
      if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
        const crashContent = `${analysis.crash_resolution_report} ${analysis.diagnostic_overview_report}`;
        
        if (/crash|exception|fatal|failure|deadlock/i.test(crashContent)) {
          categorized.critical.push({
            id: `crash-critical-${idBase}`,
            description: extractIssueDescription(crashContent, 'critical'),
            source: analysis
          });
        }
        return;
      }
      
      // Process original analysis mode
      if (/crash|exception|fatal|failure|deadlock/i.test(content)) {
        categorized.critical.push({
          id: `${idBase}-critical`,
          description: extractIssueDescription(content, 'critical'),
          source: analysis
        });
      }
      
      if (/error|warning|leak|overflow/i.test(content) && !/crash|exception|fatal/i.test(content)) {
        categorized.high.push({
          id: `${idBase}-high`,
          description: extractIssueDescription(content, 'high'),
          source: analysis
        });
      }
      
      if (/warning|potential issue|consider|might/i.test(content) && !/error|crash|exception/i.test(content)) {
        categorized.medium.push({
          id: `${idBase}-medium`,
          description: extractIssueDescription(content, 'medium'),
          source: analysis
        });
      }
      
      if (/info|note|reminder|suggestion/i.test(content) && !/warning|error|crash|exception/i.test(content)) {
        categorized.low.push({
          id: `${idBase}-low`,
          description: extractIssueDescription(content, 'low'),
          source: analysis
        });
      }
    });
    
    setCategorizedIssues(categorized);
  }, [extractIssueDescription]);

  /**
   * Save analysis results to local storage with error handling
   * @param {Array} analysisData - Analysis results to save
   */
  const saveAnalysisToHistory = useCallback((analysisData) => {
    if (!analysisData || analysisData.length === 0) return;
    
    try {
      const timestamp = new Date().toISOString();
      
      // Handle storage quota issues with try-catch and fallback
      try {
        localStorage.setItem(`analysis_${timestamp}`, JSON.stringify(analysisData));
      } catch (storageError) {
        logDebug('Storage quota exceeded, clearing old entries to make space');
        
        // Clear older items if quota is exceeded
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('analysis_')) {
            keys.push(key);
          }
        }
        
        // Sort by timestamp (oldest first) and remove the oldest 50%
        keys.sort();
        const keysToRemove = keys.slice(0, Math.max(1, Math.floor(keys.length / 2)));
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Try again with reduced storage
        localStorage.setItem(`analysis_${timestamp}`, JSON.stringify(analysisData));
      }
      
      // Update history
      try {
        const savedHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
        const newHistory = [
          {
            timestamp,
            filename: 'Analysis Result',
            analysisType: analysisData[0]?.crash_resolution_report ? 'crash' : 'original'
          },
          ...savedHistory
        ].slice(0, 10); // Keep only the 10 most recent
        
        localStorage.setItem('analysisHistory', JSON.stringify(newHistory));
      } catch (historyError) {
        logError('Failed to update analysis history:', historyError);
        // Continue execution - this is non-critical
      }
      
      return true;
    } catch (err) {
      logError('Failed to save to history:', err);
      return false;
    }
  }, [logDebug, logError]);

  // Watch for analyses changes to categorize issues and save to history
  useEffect(() => {
    if (analyses.length > 0) {
      categorizeIssues(analyses);
      saveAnalysisToHistory(analyses);
    }
  }, [analyses, categorizeIssues, saveAnalysisToHistory]);

  /**
   * Handle API error responses with detailed logging and user feedback
   * @param {Error} err - The error object
   * @returns {string} User-friendly error message
   */
  const handleApiError = useCallback((err) => {
    // Create a structured error log
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: err.message || 'Unknown error',
      stack: err.stack,
      type: err.name
    };
    
    // Process based on error type
    if (err.response) {
      // Server returned an error response
      errorLog.status = err.response.status;
      errorLog.data = err.response.data;
      errorLog.headers = err.response.headers;
      
      logError('API Error:', errorLog);
      
      // Handle specific error codes
      switch (err.response.status) {
        case 400:
          // Could be a validation error or invalid parameters
          const serverMessage = err.response.data?.detail || 
                               err.response.data?.message || 
                               'Invalid request parameters';
          return `The server couldn't process your request: ${serverMessage}`;
        
        case 401:
          return 'Authentication required. Please log in and try again.';
          
        case 403:
          return 'You don\'t have permission to access this resource.';
          
        case 404:
          return 'The requested resource was not found.';
          
        case 413:
          return 'The file is too large to process.';
          
        case 415:
          return 'The file format is not supported.';
          
        case 422:
          return 'The server couldn\'t process your input. Please check your file format.';
          
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
          
        case 500:
        case 502:
        case 503:
        case 504:
          return 'The server encountered an error. Please try again later.';
          
        default:
          return `Server error (${err.response.status}): ${serverMessage || 'Unknown error'}`;
      }
    } else if (err.request) {
      // Request was made but no response received
      errorLog.request = err.request;
      logError('Network Error:', errorLog);
      
      if (err.code === 'ECONNABORTED') {
        return 'The request timed out. Please try again or use a smaller file.';
      }
      
      return 'No response from server. Please check your internet connection and try again.';
    } else {
      // Error during request setup
      logError('Request Error:', errorLog);
      return err.message || 'An unexpected error occurred.';
    }
  }, [logError]);

  /**
   * Reset analysis state for a new analysis
   */
  const resetAnalysisState = useCallback(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New analysis started');
    }
    
    // Create a new abort controller
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError('');
    setProgress(0);
    setProgressStatus('Initializing analysis...');
    setAnalyses([]);
  }, []);

  /**
   * Validate analysis settings and file before proceeding
   * @param {File} file - File to analyze
   * @param {Object} settings - Analysis settings
   * @returns {boolean|string} True if valid, or error message
   */
  const validateAnalysisRequest = useCallback((file, settings = {}) => {
    // Only validate file properties if file exists
    if (file) {
      // Use MAX_FILE_SIZE from constants
      if (file.size > MAX_FILE_SIZE) {
        return `File too large (max ${Math.floor(MAX_FILE_SIZE / (1024 * 1024))}MB)`;
      }
      
      // Check for supported file types using constants
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
        return `File type .${fileExtension} is not supported. Please use: ${SUPPORTED_EXTENSIONS.join(', ')}`;
      }
    }
    
    // Improved timeout validation
    if (settings.timeout !== undefined) {
      // First check if it's a valid number
      const timeout = parseInt(settings.timeout, 10);
      if (isNaN(timeout)) {
        return 'Timeout must be a valid number';
      }
      
      // Then check the range separately (using a reasonable range)
      if (timeout < 10 || timeout > 3600) {
        return 'Timeout must be between 10 and 3600 seconds';
      }
    }
    
    return true;
  }, []);

  /**
   * Prepare form data with validation of all parameters
   * @param {File} file - File to analyze
   * @param {Object} settings - Analysis settings
   * @returns {FormData} FormData object with all parameters
   */
  const prepareFormData = useCallback((file, settings = {}) => {
    const formData = new FormData();
    
    // Essential parameters
    formData.append('file', file);
    
    // Validate and append language with fallback
    const language = settings.language || 'generic';
    formData.append('language', language);
    
    // Validate and append model with fallback
    const model = settings.model || 'mistral';
    formData.append('model', model);
    
    // Validate and append max tokens
    const maxTokensPerChunk = parseInt(settings.maxTokensPerChunk, 10);
    formData.append('max_tokens_per_chunk', 
      !isNaN(maxTokensPerChunk) && maxTokensPerChunk > 0 ? maxTokensPerChunk : 2048);
    
    // Validate and append timeout
    const timeout = parseInt(settings.timeout, 10);
    formData.append('timeout', 
      !isNaN(timeout) && timeout > 0 ? timeout : 120);
    
    // Append analysis type if present
    if (settings.analysisType) {
      formData.append('analysis_type', settings.analysisType);
    }
    
    // Append stream mode flag if present
    if (settings.streamMode !== undefined) {
      formData.append('stream_mode', settings.streamMode ? 'true' : 'false');
    }
    
    return formData;
  }, []);

  /**
   * Process streaming analysis response
   * @param {Response} fetchResponse - Fetch API response
   * @returns {Promise<Array>} Processed analysis results
   */
  const processStreamingResponse = useCallback(async (fetchResponse) => {
    if (!fetchResponse.ok) {
      throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
    }
    
    const reader = fetchResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const collectedResults = [];
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line.trim());
              collectedResults.push(parsed);
              
              // Update progress
              const progressValue = Math.round((parsed.chunk / parsed.total_chunks) * 90) + 10;
              setProgress(Math.min(progressValue, 99));
              setProgressStatus(`Analyzing chunk ${parsed.chunk} of ${parsed.total_chunks}...`);
            } catch (parseErr) {
              logError('Error parsing streamed JSON:', parseErr);
            }
          }
        }
      }
      
      // Process any remaining data
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          collectedResults.push(parsed);
        } catch (parseErr) {
          logError('Error parsing final JSON chunk:', parseErr);
        }
      }
      
      return collectedResults;
    } catch (streamErr) {
      logError('Error processing stream:', streamErr);
      throw new Error('Error processing analysis stream: ' + streamErr.message);
    }
  }, [logError]);

  /**
   * Analyze file with robust error handling and progress tracking
   * @param {File} file - File to analyze
   * @param {Object} settings - Analysis settings
   * @returns {Promise<boolean>} Success status
   */
  const analyzeFile = useCallback(async (file, settings = {}) => {
    // Enhanced debugging for troubleshooting
    logDebug('Starting analysis with settings:', {
      file: file ? { name: file.name, size: file.size, type: file.type } : 'none',
      settings,
      apiEndpoint: API_URL || 'API_URL is undefined!'
    });
    
    // Validate request - with improved handling for missing parameters
    const validationResult = validateAnalysisRequest(file, settings);
    if (validationResult !== true) {
      setError(validationResult);
      return false;
    }
    
    // Reset state for new analysis
    resetAnalysisState();
    
    try {
      // Prepare request data
      const formData = prepareFormData(file, settings);
      
      // Set initial progress
      setProgressStatus('Preparing file for analysis...');
      setProgress(5);
      
      // Determine analysis type and endpoint
      const analysisType = settings.analysisType || 'standard';
      const endpoint = analysisType === 'crash' ? `${API_URL}full` : API_URL;
      const timeout = parseInt(settings.timeout, 10) * 1000 || REQUEST_TIMEOUT;
      
      // Process based on analysis type and mode
      if (analysisType === 'crash') {
        // Crash analysis mode
        setProgressStatus('Analyzing crash data...');
        setProgress(10);
        
        // Use AbortController signal
        const signal = abortControllerRef.current.signal;
        
        const response = await axios.post(endpoint, formData, {
          timeout: timeout,
          signal // Use AbortController signal instead of cancelToken
        });
        
        if (response.data) {
          setProgressStatus('Processing crash analysis results...');
          setProgress(90);
          
          setAnalyses([{
            crash_resolution_report: response.data.crash_resolution_report,
            diagnostic_overview_report: response.data.diagnostic_overview_report,
            timestamp: response.data.timestamp || new Date().toISOString()
          }]);
        } else {
          throw new Error('No data returned from crash analysis');
        }
      } else if (settings.streamMode) {
        // Streaming mode
        setProgressStatus('Starting streaming analysis...');
        setProgress(10);
        
        // Use fetch API with AbortController for streaming
        const controller = abortControllerRef.current;
        const timeoutId = setTimeout(() => controller.abort('Timeout exceeded'), timeout);
        
        try {
          const fetchResponse = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          
          const results = await processStreamingResponse(fetchResponse);
          setAnalyses(results);
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        // Standard mode
        setProgressStatus('Processing file...');
        setProgress(30);
        
        const response = await axios.post(endpoint, formData, {
          timeout: timeout,
          signal: abortControllerRef.current.signal, // Use AbortController signal
          onUploadProgress: (progressEvent) => {
            const uploadPercentage = Math.round(
              (progressEvent.loaded * 20) / progressEvent.total
            );
            setProgress(30 + uploadPercentage);
          }
        });
        
        setProgressStatus('Analyzing content...');
        setProgress(70);
        
        if (response.data.full_analysis) {
          setAnalyses([{
            chunk: 1,
            total_chunks: 1,
            technical_analysis: response.data.full_analysis,
            simplified_analysis: response.data.full_analysis,
            suggested_solutions: 'Available in streaming mode only',
            timestamp: new Date().toISOString()
          }]);
        } else if (response.data.analysis) {
          setAnalyses([{
            chunk: 1,
            total_chunks: 1,
            technical_analysis: response.data.analysis,
            simplified_analysis: response.data.analysis,
            suggested_solutions: response.data.analysis,
            timestamp: new Date().toISOString()
          }]);
        } else {
          throw new Error('No analysis data returned from server');
        }
      }
      
      setProgressStatus('Analysis complete');
      setProgress(100);
      return true;
    } catch (err) {
      // Handle abortion separately
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        setProgressStatus('Analysis cancelled');
        setError('Analysis was cancelled');
      } else {
        // Use detailed error handler
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        setProgressStatus('Analysis failed');
        logError('Analysis error:', err);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    logDebug,
    validateAnalysisRequest, 
    resetAnalysisState, 
    prepareFormData, 
    processStreamingResponse, 
    handleApiError,
    logError
  ]);

  /**
   * Load analysis from history
   * @param {Object} historyItem - History item to load
   * @returns {boolean} Success status
   */
  const loadAnalysis = useCallback((historyItem) => {
    if (!historyItem || !historyItem.timestamp) {
      setError('Invalid history item');
      return false;
    }
    
    try {
      const savedAnalysis = localStorage.getItem(`analysis_${historyItem.timestamp}`);
      if (!savedAnalysis) {
        setError('Could not find the saved analysis');
        return false;
      }
      
      const parsedAnalysis = JSON.parse(savedAnalysis);
      if (!Array.isArray(parsedAnalysis) || parsedAnalysis.length === 0) {
        setError('Invalid analysis data in history');
        return false;
      }
      
      setAnalyses(parsedAnalysis);
      setProgressStatus('Analysis loaded from history');
      setProgress(100);
      return true;
    } catch (err) {
      logError('Failed to load analysis from history:', err);
      setError('Failed to load analysis from history');
      return false;
    }
  }, [logError]);

  /**
   * Load analysis from shared URL parameter
   * @param {string} sharedParam - Base64 encoded shared data
   * @returns {boolean} Success status
   */
  const loadFromSharedUrl = useCallback((sharedParam) => {
    if (!sharedParam) {
      return false;
    }
    
    try {
      // Safely decode and parse the shared data
      let decodedData;
      try {
        decodedData = atob(sharedParam);
      } catch (decodeErr) {
        setError('Invalid shared URL format');
        return false;
      }
      
      let parsedData;
      try {
        parsedData = JSON.parse(decodedData);
        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          throw new Error('Invalid data format');
        }
      } catch (parseErr) {
        setError('Could not parse shared analysis data');
        return false;
      }
      
      // Convert the minimal data back to full format
      const reconstructedAnalyses = parsedData.map(d => ({
        chunk: d.c || 1,
        total_chunks: d.tc || 1,
        simplified_analysis: d.s || 'Not available in shared view',
        technical_analysis: d.t || 'Not available in shared view',
        suggested_solutions: d.sol || 'Not available in shared view',
        timestamp: new Date().toISOString()
      }));
      
      setAnalyses(reconstructedAnalyses);
      setProgressStatus('Analysis loaded from shared URL');
      setProgress(100);
      return true;
    } catch (e) {
      logError('Error parsing shared URL:', e);
      setError('Failed to load shared analysis');
      return false;
    }
  }, [logError]);

  /**
   * Generate a shareable URL for the current analysis
   * @returns {string|null} Shareable URL or null if error
   */
  const generateShareUrl = useCallback(() => {
    if (!analyses || analyses.length === 0) {
      setError('No analysis available to share');
      return null;
    }
    
    try {
      // Create a compressed version of the analysis for URL sharing
      const minimalData = analyses.map(a => ({
        c: a.chunk || 1,
        tc: a.total_chunks || 1,
        s: a.simplified_analysis ? 
           (a.simplified_analysis.length > 200 ? 
            a.simplified_analysis.substring(0, 200) + '...' : 
            a.simplified_analysis) : 
           'Not available',
        t: a.technical_analysis ? 
           (a.technical_analysis.length > 100 ? 
            a.technical_analysis.substring(0, 100) + '...' : 
            a.technical_analysis) : 
           null,
        sol: a.suggested_solutions ? 
             (a.suggested_solutions.length > 100 ? 
              a.suggested_solutions.substring(0, 100) + '...' : 
              a.suggested_solutions) : 
             null
      }));
      
      // Check the total size to avoid excessively long URLs
      const jsonString = JSON.stringify(minimalData);
      if (jsonString.length > 2000) {
        // If too large, further reduce content size
        const reducedData = minimalData.map(item => ({
          ...item,
          s: item.s ? item.s.substring(0, 100) + '...' : 'Not available',
          t: null,
          sol: null
        }));
        
        const reducedJsonString = JSON.stringify(reducedData);
        if (reducedJsonString.length > 2000) {
          // If still too large, use only essential data
          const essentialData = [{
            s: 'This analysis is too large to share via URL. Please export and share as a file instead.'
          }];
          return `${window.location.origin}${window.location.pathname}?shared=${btoa(JSON.stringify(essentialData))}`;
        }
        
        return `${window.location.origin}${window.location.pathname}?shared=${btoa(reducedJsonString)}`;
      }
      
      return `${window.location.origin}${window.location.pathname}?shared=${btoa(jsonString)}`;
    } catch (e) {
      logError('Error generating share URL:', e);
      setError('Could not generate share URL');
      return null;
    }
  }, [analyses, logError]);

  /**
   * Format analysis for download in different formats
   * @param {string} format - Output format ('txt' or 'json')
   * @returns {Object|null} Formatted data with type and extension
   */
  const formatAnalysisForDownload = useCallback((format = 'txt') => {
    if (!analyses || analyses.length === 0) {
      setError('No analyses available to download');
      return null;
    }

    try {
      if (format === 'json') {
        // Create JSON format with proper metadata
        const jsonData = {
          metadata: {
            generated_at: new Date().toISOString(),
            format_version: '1.0',
            item_count: analyses.length
          },
          analyses: analyses.map(analysis => {
            if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
              return {
                type: 'crash_analysis',
                timestamp: analysis.timestamp || new Date().toISOString(),
                crash_resolution_report: analysis.crash_resolution_report,
                diagnostic_overview_report: analysis.diagnostic_overview_report
              };
            }
            
            return {
              type: 'chunk_analysis',
              chunk: analysis.chunk || 1,
              total_chunks: analysis.total_chunks || 1,
              timestamp: analysis.timestamp || new Date().toISOString(),
              simplified_analysis: analysis.simplified_analysis || null,
              technical_analysis: analysis.technical_analysis || null,
              suggested_solutions: analysis.suggested_solutions || null
            };
          })
        };
        
        return {
          data: JSON.stringify(jsonData, null, 2),
          type: 'application/json',
          extension: 'json'
        };
      } else {
        // Default to text format
        const formattedText = [
          `= ANALYSIS REPORT =`,
          `Generated: ${new Date().toLocaleString()}`,
          `Number of analyses: ${analyses.length}`,
          `\n`,
          ...analyses.map(analysis => {
            // For crash-focused analysis mode
            if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
              return `
=== CRASH RESOLUTION REPORT ===
Generated at: ${analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'N/A'}

${analysis.crash_resolution_report}

=== DIAGNOSTIC OVERVIEW REPORT ===

${analysis.diagnostic_overview_report}
              `;
            }
            
            // For original analysis mode
            const { chunk, total_chunks, simplified_analysis, technical_analysis, suggested_solutions, timestamp } = analysis;
            return `
=== ANALYSIS CHUNK ${chunk || 1}/${total_chunks || 1} ===
Generated at: ${timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}

--- EXPLANATION ---
${simplified_analysis || "Analysis not available"}

--- SUGGESTED SOLUTIONS ---
${suggested_solutions || "No solutions available"}

--- TECHNICAL DETAILS ---
${technical_analysis || "Technical analysis not available"}
            `;
          })
        ].join('\n');
        
        return {
          data: formattedText,
          type: 'text/plain',
          extension: 'txt'
        };
      }
    } catch (err) {
      logError('Error formatting analysis for download:', err);
      setError('Error preparing download');
      return null;
    }
  }, [analyses, logError]);

  /**
   * Create HTML with highlighted error patterns for display
   * @param {string} text - Text to highlight
   * @returns {Object} Object with __html property for dangerouslySetInnerHTML
   */
  const highlightErrors = useCallback((text) => {
    if (!text) return { __html: '' };
    
    try {
      // Escape HTML to prevent XSS vulnerabilities
      const escapeHtml = (str) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      
      const escapedText = escapeHtml(text);
      
      // Replace error patterns with highlighted spans
      const withHighlights = escapedText
        .replace(/\b(ERROR|Exception|failed|failure)\b/gi, match => 
          `<span class="text-red-500 font-semibold">${match}</span>`)
        .replace(/\b(WARNING|WARN)\b/gi, match => 
          `<span class="text-yellow-500 font-semibold">${match}</span>`)
        .replace(/\b(INFO|INFORMATION)\b/gi, match => 
          `<span class="text-blue-500 font-semibold">${match}</span>`)
        // Add line breaks for readability
        .replace(/\n/g, '<br />');
      
      return { __html: withHighlights };
    } catch (err) {
      logError('Error highlighting text:', err);
      // Return the original text if there's an error
      return { __html: text };
    }
  }, [logError]);

  /**
   * Cancel the current analysis operation
   */
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('Operation cancelled by user');
      
      // Ensure proper state cleanup on cancellation
      setProgressStatus('Analysis cancelled by user');
      setProgress(0);
      setLoading(false);
      setError(''); // Clear any existing errors
      
      logDebug('Analysis cancelled by user');
    }
  }, [logDebug]);

  /**
   * Clear all analysis data and reset to initial state
   */
  const clearAnalysis = useCallback(() => {
    setAnalyses([]);
    setCategorizedIssues({
      critical: [],
      high: [],
      medium: [],
      low: []
    });
    setProgress(0);
    setProgressStatus('');
    setError('');
  }, []);

  return {
    // State
    analyses,
    loading,
    error,
    progress,
    progressStatus,
    categorizedIssues,
    
    // Actions
    setError,
    analyzeFile,
    loadAnalysis,
    loadFromSharedUrl,
    generateShareUrl,
    formatAnalysisForDownload,
    highlightErrors,
    cancelAnalysis,
    clearAnalysis
  };
};

export default useAnalysis;