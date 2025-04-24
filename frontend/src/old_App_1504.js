import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import LanguageSelector from './components/LanguageSelector';
import { Tooltip } from 'react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import ThemeToggle from './components/ThemeToggle';
import 'react-tooltip/dist/react-tooltip.css';
import RootCauseTree from './components/RootCauseTree';
import TroubleshootingWizard from './components/TroubleshootingWizard';

// Constants for configuration
const API_URL = 'http://localhost:8000/analyze/';
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_CHECK_INTERVAL = 5000;
const REQUEST_TIMEOUT = 1200000; // 20 minutes in ms

function App() {
  // Original state variables
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('en');  // default to English
  const [streamMode, setStreamMode] = useState(true); // Default to stream mode

  // Enhanced UI state variables
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    model: 'mistral',
    maxTokensPerChunk: 8000,
    timeout: 1200 // seconds
  });
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  const [exportFormat, setExportFormat] = useState('txt');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    showErrors: true,
    showWarnings: true,
    showInfo: true
  });
  const [expandedSections, setExpandedSections] = useState({});
  const [shareUrl, setShareUrl] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  // Analysis type selection: original or crash-focused
  const [analysisType, setAnalysisType] = useState('original');

  // New state variables for enhanced features
  const [patternInsights, setPatternInsights] = useState([]);
  const [showPatternInsights, setShowPatternInsights] = useState(false);
  const [categorizedIssues, setCategorizedIssues] = useState({
    critical: [],
    high: [],
    medium: [],
    low: []
  });
  const [filterCriteria, setFilterCriteria] = useState({
    severity: {
      critical: true,
      high: true,
      medium: true,
      low: true
    },
    type: {
      crash: true,
      memory: true,
      performance: true,
      security: true,
      other: true
    },
    timeRange: {
      start: null,
      end: null
    }
  });
  const [showTroubleshootingWizard, setShowTroubleshootingWizard] = useState(false);
  const [activeAnalysisForWizard, setActiveAnalysisForWizard] = useState(null);

  // ADD STATE VARIABLES for enhanced UX
  const [dragActive, setDragActive] = useState(false);
  const [progressStatus, setProgressStatus] = useState('Initializing...');
  const [showExportOptions, setShowExportOptions] = useState(false);

  const fileInputRef = useRef(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('analysisHistory');
      if (savedHistory) {
        setAnalysisHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    
    // Check for shared URL parameters
    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('shared');
      if (shared) {
        const decompressedData = JSON.parse(atob(shared));
        // Convert the minimal data back to a format compatible with your app
        const reconstructedAnalyses = decompressedData.map(d => ({
          chunk: d.c,
          total_chunks: d.tc,
          simplified_analysis: d.s,
          technical_analysis: d.t || 'Not available in shared view',
          suggested_solutions: d.sol || 'Not available in shared view',
          timestamp: new Date().toISOString()
        }));
        setAnalyses(reconstructedAnalyses);
      }
    } catch (e) {
      console.error('Error parsing shared URL:', e);
    }
  }, []);

  // Categorize issues after analysis is updated
  useEffect(() => {
    if (analyses.length > 0) {
      categorizeIssues(analyses);
    }
  }, [analyses]);

  // Filter analyses based on search term and filter options
  const filteredAnalyses = useMemo(() => {
    if (!analyses.length) return [];
    
    // Skip filtering if all options are enabled and no search term
    if (!searchTerm && 
        Object.values(filterCriteria.severity).every(v => v) && 
        Object.values(filterCriteria.type).every(v => v) &&
        !filterCriteria.timeRange.start && 
        !filterCriteria.timeRange.end) {
      return analyses;
    }
    
    return analyses.filter(analysis => {
      // Content to search through
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''} ${analysis.suggested_solutions || ''}`.toLowerCase();
      
      // Search term matching
      const matchesSearch = !searchTerm || content.includes(searchTerm.toLowerCase());
      
      // Severity filtering
      const matchesSeverity = 
        (filterCriteria.severity.critical && /(critical|crash|fatal|exception)/i.test(content)) ||
        (filterCriteria.severity.high && /(high|error|severe)/i.test(content)) ||
        (filterCriteria.severity.medium && /(medium|warning|issue)/i.test(content)) ||
        (filterCriteria.severity.low && /(low|info|note)/i.test(content));
      
      // Type filtering
      const matchesType = 
        (filterCriteria.type.crash && /(crash|exception|stack trace)/i.test(content)) ||
        (filterCriteria.type.memory && /(memory|leak|allocation|heap)/i.test(content)) ||
        (filterCriteria.type.performance && /(performance|slow|latency|timeout)/i.test(content)) ||
        (filterCriteria.type.security && /(security|vulnerability|exploit|access)/i.test(content)) ||
        (filterCriteria.type.other);
      
      // Time range filtering
      let withinTimeRange = true;
      if (analysis.timestamp && (filterCriteria.timeRange.start || filterCriteria.timeRange.end)) {
        const timestamp = new Date(analysis.timestamp).getTime();
        if (filterCriteria.timeRange.start && timestamp < filterCriteria.timeRange.start.getTime()) {
          withinTimeRange = false;
        }
        if (filterCriteria.timeRange.end && timestamp > filterCriteria.timeRange.end.getTime()) {
          withinTimeRange = false;
        }
      }
      
      return matchesSearch && matchesSeverity && matchesType && withinTimeRange;
    });
  }, [analyses, searchTerm, filterCriteria]);

  // Explicitly check Ollama status
  useEffect(() => {
    const checkOllama = async () => {
      try {
        await axios.get(OLLAMA_URL);
        setOllamaStatus(true);
      } catch (err) {
        setOllamaStatus(false);
        console.warn('Ollama service not available:', err.message);
      }
    };

    checkOllama();
    const interval = setInterval(checkOllama, OLLAMA_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleLanguageChange = useCallback((selectedOption) => {
    if (!selectedOption || !selectedOption.value) {
      console.error('Invalid language option selected');
      return;
    }
    setLanguage(selectedOption.value);
  }, []);

  // Function to categorize issues from analysis results
  const categorizeIssues = useCallback((analyses) => {
    const categorized = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    analyses.forEach(analysis => {
      // Content to analyze
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''}`;
      
      // Process crash-focused analysis
      if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
        const crashContent = `${analysis.crash_resolution_report} ${analysis.diagnostic_overview_report}`;
        
        if (/crash|exception|fatal|failure|deadlock/i.test(crashContent)) {
          categorized.critical.push({
            id: `crash-critical-${new Date().getTime()}`,
            description: extractIssueDescription(crashContent, 'critical'),
            source: analysis
          });
        }
        return;
      }
      
      // Process original analysis mode
      if (/crash|exception|fatal|failure|deadlock/i.test(content)) {
        categorized.critical.push({
          id: `${analysis.chunk}-critical`,
          description: extractIssueDescription(content, 'critical'),
          source: analysis
        });
      }
      
      if (/error|warning|leak|overflow/i.test(content) && !/crash|exception|fatal/i.test(content)) {
        categorized.high.push({
          id: `${analysis.chunk}-high`,
          description: extractIssueDescription(content, 'high'),
          source: analysis
        });
      }
      
      if (/warning|potential issue|consider|might/i.test(content) && !/error|crash|exception/i.test(content)) {
        categorized.medium.push({
          id: `${analysis.chunk}-medium`,
          description: extractIssueDescription(content, 'medium'),
          source: analysis
        });
      }
      
      if (/info|note|reminder|suggestion/i.test(content) && !/warning|error|crash|exception/i.test(content)) {
        categorized.low.push({
          id: `${analysis.chunk}-low`,
          description: extractIssueDescription(content, 'low'),
          source: analysis
        });
      }
    });
    
    setCategorizedIssues(categorized);
  }, []);

  // Missing function added from missing-functions.js
  function extractIssueDescription(content, severity) {
    const patterns = {
      critical: /(.*?(?:crash|exception|fatal|failure|deadlock).*?\.)/i,
      high: /(.*?(?:error|warning|leak|overflow).*?\.)/i,
      medium: /(.*?(?:warning|potential issue|consider|might).*?\.)/i,
      low: /(.*?(?:info|note|reminder|suggestion).*?\.)/i
    };
    
    const match = content.match(patterns[severity]);
    return match ? match[1] : 'Issue detected';
  }

  // Analyze patterns across multiple analyses
  const detectPatterns = useCallback(() => {
    if (analysisHistory.length < 2) return;
    
    const insights = [];
    const allAnalyses = analysisHistory.flatMap(h => 
      JSON.parse(localStorage.getItem(`analysis_${h.timestamp}`) || '[]')
    );
    
    // Error message frequency counter
    const errorMessages = {};
    const errorPatterns = [
      /([A-Z][a-z]+ (error|exception|failure):[^.]+)/g,
      /(failed to [^.]+)/gi,
      /(could not [^.]+)/gi
    ];
    
    allAnalyses.forEach(analysis => {
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''}`;
      
      errorPatterns.forEach(pattern => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
          const error = match[0].trim();
          errorMessages[error] = (errorMessages[error] || 0) + 1;
        });
      });
    });
    
    // Find recurring errors
    Object.entries(errorMessages)
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .slice(0, 5)  // Top 5 recurring issues
      .forEach(([error, count]) => {
        insights.push({
          type: 'recurring_error',
          message: error,
          frequency: count,
          suggestion: generateSuggestionForPattern(error)
        });
      });
    
    // Detect time-based patterns
    if (analysisHistory.length >= 3) {
      const timestamps = analysisHistory.map(h => new Date(h.timestamp));
      const timeDiffs = [];
      
      for (let i = 1; i < timestamps.length; i++) {
        timeDiffs.push(timestamps[i].getTime() - timestamps[i-1].getTime());
      }
      
      const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      const hoursDiff = avgTimeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        insights.push({
          type: 'time_pattern',
          message: `Issues occur approximately every ${hoursDiff.toFixed(1)} hours`,
          suggestion: "Consider investigating cyclical processes or scheduled tasks that run at this interval."
        });
      }
    }
    
    setPatternInsights(insights);
    setShowPatternInsights(insights.length > 0);
  }, [analysisHistory]);

  // Generate suggestions based on detected patterns
  function generateSuggestionForPattern(error) {
    if (/memory|allocation|heap/i.test(error)) {
      return "Check for memory leaks in resource handling code. Consider implementing better cleanup procedures.";
    }
    
    if (/timeout|exceeded|slow/i.test(error)) {
      return "Review performance bottlenecks in related operations. Consider optimization or increasing timeout thresholds.";
    }
    
    if (/permission|access|denied/i.test(error)) {
      return "Verify access control settings and permissions for the affected resources.";
    }
    
    if (/network|connection|socket/i.test(error)) {
      return "Check network connectivity and firewall settings. Ensure all required services are accessible.";
    }
    
    return "Review related code sections for potential improvements or error handling.";
  }

  // ADD DRAG AND DROP HANDLERS
  // Handle drag and drop events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setError('');
      
      // Create a preview of the file content
      const reader = new FileReader();
      reader.onload = (evt) => {
        // Only show first 500 characters for preview
        setFilePreview(evt.target.result.slice(0, 500) + '...');
      };
      reader.onerror = () => {
        setError('Failed to read file for preview');
      };
      reader.readAsText(file);
    }
  }, []);

  // Handle file selection with preview
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    setError('');
    
    // Create a preview of the file content
    const reader = new FileReader();
    reader.onload = (e) => {
      // Only show first 500 characters for preview
      setFilePreview(e.target.result.slice(0, 500) + '...');
    };
    reader.onerror = () => {
      setError('Failed to read file for preview');
    };
    reader.readAsText(file);
  }, []);

  // Clear the selected file
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((chunkId, section) => {
    const key = `${chunkId}-${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // ENHANCED DOWNLOAD FUNCTION WITH FORMAT OPTIONS
  // Download analysis with support for different export formats
  const downloadAnalysis = useCallback(() => {
    try {
      if (!analyses || analyses.length === 0) {
        setError('No analyses available to download');
        return;
      }

      const formattedText = analyses.map(analysis => {
        // For crash-focused analysis mode
        if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
          return `
=== CRASH RESOLUTION REPORT ===
Generated at: ${analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'N/A'}

${analysis.crash_resolution_report}

=== DIAGNOSTIC OVERVIEW REPORT ===
Generated at: ${analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'N/A'}

${analysis.diagnostic_overview_report}
          `;
        }
        
        // For original analysis mode
        const { chunk, total_chunks, simplified_analysis, technical_analysis, suggested_solutions, timestamp } = analysis;
        return `
=== ANALYSIS CHUNK ${chunk}/${total_chunks} ===
Generated at: ${timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}

--- EXPLANATION ---
${simplified_analysis || "Analysis not available"}

--- SUGGESTED SOLUTIONS ---
${suggested_solutions || "No solutions available"}

--- TECHNICAL DETAILS ---
${technical_analysis || "Technical analysis not available"}
        `;
      }).join('\n\n');

      // Choose export format
      let blob;
      let fileExtension;
      let mimeType;
      
      if (exportFormat === 'json') {
        // Create JSON format
        const jsonData = analyses.map(analysis => {
          if (analysis.crash_resolution_report && analysis.diagnostic_overview_report) {
            return {
              type: 'crash_analysis',
              timestamp: analysis.timestamp,
              crash_resolution_report: analysis.crash_resolution_report,
              diagnostic_overview_report: analysis.diagnostic_overview_report
            };
          }
          
          return {
            type: 'chunk_analysis',
            chunk: analysis.chunk,
            total_chunks: analysis.total_chunks,
            timestamp: analysis.timestamp,
            simplified_analysis: analysis.simplified_analysis,
            technical_analysis: analysis.technical_analysis,
            suggested_solutions: analysis.suggested_solutions
          };
        });
        
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        fileExtension = 'json';
        mimeType = 'application/json';
      } else {
        // Default to text format
        blob = new Blob([formattedText], { type: 'text/plain' });
        fileExtension = 'txt';
        mimeType = 'text/plain';
      }

      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = `WCR-analysis-${new Date().toISOString().slice(0, 10)}.${fileExtension}`;
      document.body.appendChild(element);
      element.click();

      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(element.href);
        document.body.removeChild(element);
      }, 100);
    } catch (err) {
      console.error('Download error:', err);
      setError(`Failed to download analysis: ${err.message || 'Unknown error'}`);
    }
  }, [analyses, exportFormat]);

  // Generate share URL
  const generateShareUrl = useCallback(() => {
    try {
      // Create a compressed version of the analysis for URL sharing
      const minimalData = analyses.map(a => ({
        c: a.chunk,
        tc: a.total_chunks,
        s: a.simplified_analysis?.substring(0, 200) + '...',
        t: a.technical_analysis?.substring(0, 100) + '...',
        sol: a.suggested_solutions?.substring(0, 100) + '...'
      }));
      const compressedData = btoa(JSON.stringify(minimalData));
      const url = `${window.location.origin}${window.location.pathname}?shared=${compressedData}`;
      setShareUrl(url);
      setShowShareDialog(true);
    } catch (e) {
      console.error('Error generating share URL:', e);
      setError('Could not generate share URL');
    }
  }, [analyses]);

  // Copy to clipboard function
  const copyToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(section);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError('Failed to copy to clipboard');
    }
  };

  // Highlight errors in text
  const highlightErrors = useCallback((text) => {
    if (!text) return '';
    
    // Replace error patterns with highlighted spans
    const withHighlights = text
      .replace(/ERROR|Exception|failed|failure/gi, match => 
        `<span class="text-red-500 font-semibold">${match}</span>`)
      .replace(/WARNING|WARN/gi, match => 
        `<span class="text-yellow-500 font-semibold">${match}</span>`)
      .replace(/INFO|INFORMATION/gi, match => 
        `<span class="text-blue-500 font-semibold">${match}</span>`);
    
    return { __html: withHighlights };
  }, []);

  // Load from history
  const loadFromHistory = useCallback((historyItem) => {
    try {
      const savedAnalysis = localStorage.getItem(`analysis_${historyItem.timestamp}`);
      if (savedAnalysis) {
        setAnalyses(JSON.parse(savedAnalysis));
        setShowHistory(false);
      } else {
        setError('Could not find the saved analysis');
      }
    } catch (err) {
      console.error('Failed to load analysis from history:', err);
      setError('Failed to load analysis from history');
    }
  }, []);

  // ENHANCED UPLOAD FUNCTION WITH PROGRESS FEEDBACK
  // Enhanced uploadFile function with support for different methods and better progress feedback
  const uploadFile = useCallback(async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }
    
    setLoading(true);
    setError('');
    setProgress(0);
    setProgressStatus('Initializing analysis...');
    setAnalyses([]);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('language', language);
      formData.append('model', settings.model);
      formData.append('max_tokens_per_chunk', settings.maxTokensPerChunk);
      formData.append('timeout', settings.timeout);
      
      setProgressStatus('Preparing file for analysis...');
      setProgress(5);
      
      let response;
      
      if (analysisType === 'crash') {
        // Use crash-focused endpoint
        setProgressStatus('Analyzing crash data...');
        setProgress(10);
        
        response = await axios.post(`${API_URL}full`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: settings.timeout * 1000 || REQUEST_TIMEOUT
        });
        
        if (response.data) {
          setProgressStatus('Processing crash analysis results...');
          setProgress(90);
          
          setAnalyses([{
            crash_resolution_report: response.data.crash_resolution_report,
            diagnostic_overview_report: response.data.diagnostic_overview_report,
            timestamp: response.data.timestamp || new Date().toISOString()
          }]);
        }
      } else if (streamMode) {
        // Streaming mode using fetch API for real-time updates
        setProgressStatus('Starting streaming analysis...');
        setProgress(10);
        
        const fetchResponse = await fetch(API_URL, {
          method: 'POST',
          body: formData
        });
        
        if (!fetchResponse.ok) {
          throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
        }
        
        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        
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
                setAnalyses(prev => [...prev, parsed]);
                
                const progressValue = Math.round((parsed.chunk / parsed.total_chunks) * 90) + 10;
                setProgress(Math.min(progressValue, 99));
                setProgressStatus(`Analyzing chunk ${parsed.chunk} of ${parsed.total_chunks}...`);
              } catch (parseErr) {
                console.error('Error parsing streamed JSON:', parseErr);
              }
            }
          }
        }
        
        // Process any remaining data
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            setAnalyses(prev => [...prev, parsed]);
          } catch (parseErr) {
            console.error('Error parsing final JSON chunk:', parseErr);
          }
        }
      } else {
        // Traditional non-streaming mode
        setProgressStatus('Processing file...');
        setProgress(30);
        
        response = await axios.post(API_URL, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: settings.timeout * 1000 || REQUEST_TIMEOUT
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
        }
      }
      
      setProgressStatus('Completing analysis...');
      setProgress(100);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during file analysis');
      setProgressStatus('Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [selectedFile, language, settings, analysisType, streamMode]);

  // ADD CLICK OUTSIDE HANDLER
  // Close any dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportOptions && !event.target.closest('.dropdown-container')) {
        setShowExportOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportOptions]);

  return (
    <ThemeProvider attribute="class">
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-6 relative">
        {/* Accessibility skip link */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white dark:bg-gray-800 p-2 z-50"
        >
          Skip to main content
        </a>
        
        {/* Top bar for language selector, analysis type, and theme toggle */}
        <div className="absolute top-4 left-4 flex items-center gap-4">
          <LanguageSelector selectedLanguage={language} onChange={handleLanguageChange} />
          
          {/* TOOLTIPS FOR TOP BAR BUTTONS (Analysis Type selector and buttons) */}
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            data-tooltip-id="analysis-type-tooltip"
            data-tooltip-content="Select the type of analysis to perform"
          >
            <option value="original">Original Analysis</option>
            <option value="crash">Crash Focused Analysis</option>
          </select>
          <Tooltip id="analysis-type-tooltip" place="bottom" />
          <ThemeToggle />

          {/* Add a settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="Settings"
            data-tooltip-id="settings-tooltip"
            data-tooltip-content="Adjust analysis settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <Tooltip id="settings-tooltip" place="bottom" />

          {/* Add a history button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="View History"
            data-tooltip-id="history-tooltip"
            data-tooltip-content="View previous analysis history"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </button>
          <Tooltip id="history-tooltip" place="bottom" />
        </div>
        
        {/* TOOLTIP FOR OLLAMA STATUS */}
        <div className="absolute top-4 right-4 flex items-center">
          <span className="mr-2 font-semibold dark:text-gray-200">Ollama:</span>
          <div
            className={`w-4 h-4 rounded-full ${ollamaStatus ? 'bg-green-500' : 'bg-red-500'}`}
            aria-label={ollamaStatus ? 'Ollama is running' : 'Ollama is not running'}
            data-tooltip-id="ollama-status-tooltip"
            data-tooltip-content={ollamaStatus ? 'Ollama service is running' : 'Ollama service is not running. Analysis may be limited.'}
          />
          <Tooltip id="ollama-status-tooltip" place="left" />
        </div>

        <h1 className="text-4xl font-bold text-center mb-4 pt-16 dark:text-white">One More Thing Insights 🚀</h1>
        
        {/* Main controls section */}
        <div id="main-content" className="mt-6 max-w-4xl mx-auto">
          {/* File selection and configuration */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold dark:text-gray-200">Analysis Configuration</h2>
                <div className="flex items-center space-x-2">
                  <label className="inline-flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-blue-600"
                      checked={streamMode}
                      onChange={() => setStreamMode(!streamMode)}
                      disabled={loading || analysisType === 'crash'}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Streaming mode</span>
                  </label>
                </div>
              </div>
              
              {/* ENHANCED FILE UPLOAD AREA WITH DRAG & DROP */}
              {selectedFile ? (
                <div className="border rounded p-3 bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium dark:text-gray-200">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(selectedFile.size / 1024).toFixed(2)} KB • {selectedFile.type || 'Unknown type'}
                      </p>
                    </div>
                    <button 
                      onClick={clearSelectedFile}
                      className="text-red-500 hover:text-red-700"
                      disabled={loading}
                      data-tooltip-id="clear-file-tooltip"
                      data-tooltip-content="Remove selected file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <Tooltip id="clear-file-tooltip" place="left" />
                  </div>
                  {filePreview && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview:</p>
                      <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-20 dark:text-gray-300">{filePreview}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className={`border-2 border-dashed ${dragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} rounded-lg p-6 text-center transition-colors duration-200`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`mx-auto h-12 w-12 ${dragActive ? 'text-blue-500' : 'text-gray-400'} transition-colors duration-200`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className={`mt-1 text-sm ${dragActive ? 'text-blue-500 font-medium' : 'text-gray-500 dark:text-gray-400'} transition-colors duration-200`}>
                      {dragActive ? 'Drop file to upload' : 'Click to select or drag a file here'}
                    </p>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                </div>
              )}
            </div>
            
            {/* ENHANCED BUTTON ACTIONS WITH TOOLTIPS AND EXPORT OPTIONS */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={uploadFile}
                  className={`px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-transform hover:scale-105 ${(!selectedFile || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!selectedFile || loading}
                  data-tooltip-id="analyze-tooltip"
                  data-tooltip-content="Begin analysis of the selected file"
                >
                  {loading ? 'Analyzing...' : 'Analyze'}
                </button>
                <Tooltip id="analyze-tooltip" place="top" />
                
                {analyses.length > 0 && !loading && (
                  <>
                    <div className="relative dropdown-container">
                      <button
                        onClick={() => setShowExportOptions(!showExportOptions)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-transform hover:scale-105 flex items-center"
                        data-tooltip-id="download-tooltip"
                        data-tooltip-content="Download analysis results"
                      >
                        <span>Download</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <Tooltip id="download-tooltip" place="top" />
                      
                      {/* Export format dropdown */}
                      {showExportOptions && (
                        <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-700 shadow-lg rounded-md overflow-hidden z-10">
                          <button 
                            className="w-full px-4 py-2 text-left text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => {
                              setExportFormat('txt');
                              setShowExportOptions(false);
                              downloadAnalysis();
                            }}
                          >
                            Text (.txt)
                          </button>
                          <button 
                            className="w-full px-4 py-2 text-left text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => {
                              setExportFormat('json');
                              setShowExportOptions(false);
                              downloadAnalysis();
                            }}
                          >
                            JSON (.json)
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={generateShareUrl}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition-transform hover:scale-105"
                      data-tooltip-id="share-tooltip"
                      data-tooltip-content="Generate a shareable link"
                    >
                      Share
                    </button>
                    <Tooltip id="share-tooltip" place="top" />
                  </>
                )}
              </div>
              
              {patternInsights.length > 0 && (
                <button
                  onClick={() => setShowPatternInsights(true)}
                  className="flex items-center text-amber-500 hover:text-amber-600"
                  data-tooltip-id="insights-tooltip"
                  data-tooltip-content="View detected patterns across analyses"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  <span>Pattern Insights ({patternInsights.length})</span>
                </button>
              )}
              <Tooltip id="insights-tooltip" place="left" />
            </div>
          </div>
          
          {/* ENHANCED PROGRESS INDICATOR */}
          {loading && (
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysis Progress</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                  role="progressbar" 
                  aria-valuenow={progress} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                />
              </div>
              <div className="mt-2 flex flex-col items-center">
                <p className="text-center text-blue-500 dark:text-blue-400 font-medium">
                  {progressStatus}
                </p>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                  {analysisType === 'crash' 
                    ? 'Examining crash data for root causes...' 
                    : `Processing ${analyses.length} of ${analyses.length > 0 ? analyses[0].total_chunks : '?'} chunks...`}
                </p>
              </div>
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-4 rounded" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Issue Summary (if categorized issues exist) */}
          {!loading && Object.values(categorizedIssues).some(list => list.length > 0) && (
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
              <h2 className="text-lg font-semibold mb-3 dark:text-gray-200">Issue Summary</h2>
              
              {categorizedIssues.critical.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-red-600 dark:text-red-400 font-medium mb-2">
                    Critical Issues ({categorizedIssues.critical.length})
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {categorizedIssues.critical.map((issue, idx) => (
                      <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {categorizedIssues.high.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-orange-600 dark:text-orange-400 font-medium mb-2">
                    High Priority Issues ({categorizedIssues.high.length})
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {categorizedIssues.high.map((issue, idx) => (
                      <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {categorizedIssues.medium.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-yellow-600 dark:text-yellow-400 font-medium mb-2">
                    Medium Priority Issues ({categorizedIssues.medium.length})
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {categorizedIssues.medium.map((issue, idx) => (
                      <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {categorizedIssues.low.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-blue-600 dark:text-blue-400 font-medium mb-2">
                    Low Priority Issues ({categorizedIssues.low.length})
                  </h3>
                  <ul className="list-disc list-inside space-y-1">
                    {categorizedIssues.low.map((issue, idx) => (
                      <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Search and filter bar (only when there are analysis results) */}
          {analyses.length > 0 && !loading && (
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in analysis results..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="dark:text-gray-300">Filter:</span>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filterCriteria.severity.critical}
                      onChange={() => setFilterCriteria({
                        ...filterCriteria,
                        severity: {
                          ...filterCriteria.severity, 
                          critical: !filterCriteria.severity.critical
                        }
                      })}
                      className="form-checkbox h-4 w-4 text-red-500"
                    />
                    <span className="ml-1 text-gray-700 dark:text-gray-300">Critical</span>
                  </label>
                  
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filterCriteria.severity.high}
                      onChange={() => setFilterCriteria({
                        ...filterCriteria,
                        severity: {
                          ...filterCriteria.severity, 
                          high: !filterCriteria.severity.high
                        }
                      })}
                      className="form-checkbox h-4 w-4 text-orange-500"
                    />
                    <span className="ml-1 text-gray-700 dark:text-gray-300">High</span>
                  </label>
                  
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filterCriteria.severity.medium}
                      onChange={() => setFilterCriteria({
                        ...filterCriteria,
                        severity: {
                          ...filterCriteria.severity, 
                          medium: !filterCriteria.severity.medium
                        }
                      })}
                      className="form-checkbox h-4 w-4 text-yellow-500"
                    />
                    <span className="ml-1 text-gray-700 dark:text-gray-300">Medium</span>
                  </label>
                  
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={filterCriteria.severity.low}
                      onChange={() => setFilterCriteria({
                        ...filterCriteria,
                        severity: {
                          ...filterCriteria.severity, 
                          low: !filterCriteria.severity.low
                        }
                      })}
                      className="form-checkbox h-4 w-4 text-blue-500"
                    />
                    <span className="ml-1 text-gray-700 dark:text-gray-300">Low</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {/* Empty state */}
          {analyses.length === 0 && !loading && !error && (
            <div className="text-center py-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                Upload a WCR file to get a detailed analysis
              </p>
            </div>
          )}
          
          {/* Filtered results count */}
          {filteredAnalyses.length > 0 && analyses.length > 0 && !loading && (
            <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredAnalyses.length} of {analyses.length} analysis results
            </div>
          )}

          {/* Analysis output display */}
          <AnimatePresence>
            {filteredAnalyses.map((analysis, idx) => (
              <motion.div 
                key={`analysis-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.4 }}
                className="bg-white dark:bg-gray-700 shadow-md rounded-lg p-4 mb-4"
              >
                {/* Check if this is a full (crash-focused) analysis */}
                {analysis.crash_resolution_report && analysis.diagnostic_overview_report ? (
                  <>
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Full Crash Analysis Report</h2>
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            setActiveAnalysisForWizard(analysis);
                            setShowTroubleshootingWizard(true);
                          }}
                          className="ml-2 text-blue-500 hover:text-blue-600 text-sm"
                        >
                          Start Guided Troubleshooting
                        </button>
                      </div>
                    </div>
                    
                    {analysis.timestamp && (
                      <small className="text-gray-400 dark:text-gray-500 block mb-3">
                        Generated at: {new Date(analysis.timestamp).toLocaleString()}
                      </small>
                    )}
                    
                    <RootCauseTree analysis={analysis} />
                    
                    <details open className="mt-4 mb-4">
                      <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        🔧 Crash Resolution Report
                      </summary>
                      <div className="mt-2 p-2 dark:text-gray-200">
                        {analysis.crash_resolution_report}
                      </div>
                    </details>
                    <details className="mb-4">
                      <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        🔍 Diagnostic Overview Report
                      </summary>
                      <div className="mt-2 p-2 dark:text-gray-200">
                        {analysis.diagnostic_overview_report}
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                        Analysis Chunk {analysis.chunk}/{analysis.total_chunks}
                      </h2>
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            copyToClipboard(
                              `${analysis.simplified_analysis}\n\n${analysis.suggested_solutions}`, 
                              `chunk-${analysis.chunk}`
                            );
                          }}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          aria-label="Copy analysis"
                        >
                          {copySuccess === `chunk-${analysis.chunk}` ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setActiveAnalysisForWizard(analysis);
                            setShowTroubleshootingWizard(true);
                          }}
                          className="ml-2 text-blue-500 hover:text-blue-600 text-sm"
                        >
                          Start Guided Troubleshooting
                        </button>
                      </div>
                    </div>
                    
                    {analysis.timestamp && (
                      <small className="text-gray-400 dark:text-gray-500">
                        Generated at: {new Date(analysis.timestamp).toLocaleString()}
                      </small>
                    )}
                    
                    {analysis.error && (
                      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded mb-4" role="alert">
                        {analysis.error}
                      </div>
                    )}
                    
                    <RootCauseTree analysis={analysis} />
                    
                    <details open className="mb-4 mt-3">
                      <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        📖 Simple Explanation
                      </summary>
                      <div className="mt-2 p-2 dark:text-gray-200">
                        {analysis.simplified_analysis || "Analysis not available"}
                      </div>
                    </details>
                    <details className="mb-4">
                      <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        🛠️ Suggested Solutions
                      </summary>
                      <div className="mt-2 p-2 dark:text-gray-200">
                        {analysis.suggested_solutions || "No solutions available"}
                      </div>
                    </details>
                    <details>
                      <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        🔍 Technical Details
                      </summary>
                      <div 
                        className="mt-2 p-2 font-mono text-sm overflow-auto max-h-96 dark:text-gray-300"
                        dangerouslySetInnerHTML={highlightErrors(analysis.technical_analysis || "Technical analysis not available")}
                      />
                    </details>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Pattern Insights Dialog */}
        {showPatternInsights && patternInsights.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Pattern Insights</h3>
                <button 
                  onClick={() => setShowPatternInsights(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {patternInsights.map((insight, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
                    <div className="font-medium mb-1">
                      {insight.type === 'recurring_error' 
                        ? `Recurring Issue (${insight.frequency} occurrences)`
                        : 'Time Pattern Detected'}
                    </div>
                    <div className="mb-2 text-sm dark:text-gray-200">{insight.message}</div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Suggestion: {insight.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* ENHANCED TROUBLESHOOTING WIZARD WITH BACK BUTTON */}
        {showTroubleshootingWizard && activeAnalysisForWizard && (
          <TroubleshootingWizard 
            analysis={activeAnalysisForWizard} 
            onClose={() => {
              setShowTroubleshootingWizard(false);
              setActiveAnalysisForWizard(null);
            }}
            onBack={() => {
              // This will be implemented in the TroubleshootingWizard component
              // to enable navigating back to previous steps
            }}
          />
        )}
        
        {/* Share Dialog */}
        {showShareDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Share Analysis</h3>
                <button 
                  onClick={() => setShowShareDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                Use this URL to share your analysis with others:
              </p>
              
              <div className="flex">
                <input 
                  type="text" 
                  value={shareUrl} 
                  className="flex-1 p-2 border rounded-l text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200"
                  readOnly
                />
                <button
                  onClick={() => copyToClipboard(shareUrl, 'share')}
                  className="px-3 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600"
                >
                  {copySuccess === 'share' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Settings Dialog */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Settings</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Model</label>
                  <select 
                    value={settings.model}
                    onChange={(e) => setSettings({...settings, model: e.target.value})}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="mistral">Mistral</option>
                    <option value="llama2">Llama 2</option>
                    <option value="mixtral">Mixtral</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 font-medium">Maximum Tokens Per Chunk</label>
                  <input 
                    type="number" 
                    value={settings.maxTokensPerChunk}
                    onChange={(e) => setSettings({...settings, maxTokensPerChunk: parseInt(e.target.value) || 4000})}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    min="1000"
                    max="16000"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Smaller values process faster but may miss context (1000-16000)
                  </p>
                </div>
                
                <div>
                  <label className="block mb-1 font-medium">Request Timeout (seconds)</label>
                  <input 
                    type="number" 
                    value={settings.timeout}
                    onChange={(e) => setSettings({...settings, timeout: parseInt(e.target.value) || 300})}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    min="60"
                    max="3600"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Maximum time to wait for analysis (60-3600 seconds)
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* History Dialog */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Analysis History</h3>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {analysisHistory.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No analysis history available
                </p>
              ) : (
                <div className="space-y-2">
                  {analysisHistory.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="font-medium">{item.filename}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span>
                          Analysis Type: {item.analysisType || 'original'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear all history?")) {
                      localStorage.removeItem('analysisHistory');
                      setAnalysisHistory([]);
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  disabled={analysisHistory.length === 0}
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;