import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ThemeProvider } from 'next-themes';
import 'react-tooltip/dist/react-tooltip.css';
import { Tooltip } from 'react-tooltip';

// Import components
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeToggle } from './components/ThemeToggle';
import LLMSelector from './components/LLMSelector';

// Constants for configuration
const API_URL = 'http://localhost:8000/analyze/';
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_CHECK_INTERVAL = 5000;
const REQUEST_TIMEOUT = 1200000; // 20 minutes in ms

function App() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('en');  // default to English
  const [streamMode, setStreamMode] = useState(true); // Default to stream mode
  const [analysisType, setAnalysisType] = useState('simple');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelSettings, setModelSettings] = useState({});
  
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
  
  // Handle analysis type change
  const handleAnalysisTypeChange = useCallback((e) => {
    const type = e.target.value;
    setAnalysisType(type);
    // Disable streaming for crash analysis if that's how your system is set up
    if (type === 'crash') {
      setStreamMode(false);
    }
  }, []);
  
  // Handle stream mode toggle
  const handleStreamModeToggle = useCallback(() => {
    setStreamMode(prev => !prev);
  }, []);

  // Download analysis as text file
  const downloadAnalysis = useCallback(() => {
    try {
      if (!analyses || analyses.length === 0) {
        setError('No analyses available to download');
        return;
      }

      const formattedText = analyses.map(analysis => {
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
  
      const element = document.createElement('a');
      const file = new Blob([formattedText], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `Kara-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
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
  }, [analyses]);
  
  // Handle model selection
  const handleModelSelect = useCallback((modelId) => {
    console.log(`Setting selected model to: ${modelId}`);
    setSelectedModel(modelId);
    
    // Load saved settings for this model if available
    try {
      const savedSettings = JSON.parse(localStorage.getItem('modelSettings') || '{}');
      if (savedSettings[modelId]) {
        setModelSettings(savedSettings[modelId]);
      }
    } catch (e) {
      console.error('Failed to load model settings:', e);
    }
  }, []);

  // Handle updating model settings
  const handleUpdateModelSettings = useCallback((modelId, newSettings) => {
    console.log(`Updating settings for model ${modelId}:`, newSettings);
    setModelSettings(newSettings);
  }, []);

  // Traditional non-streaming upload method
  const uploadFileTraditional = useCallback(async (file) => {
    if (!file) {
      setError('No file selected for upload');
      return;
    }

    if (!selectedModel) {
      setError('Please select a model for analysis');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setProgress(0);
      setAnalyses([]);
    
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      formData.append('analysisType', analysisType);
      formData.append('model', selectedModel);
      
      // Append model settings if available
      if (Object.keys(modelSettings).length > 0) {
        formData.append('modelSettings', JSON.stringify(modelSettings));
      }
    
      // For traditional mode, use a simulated progress interval
      const progressInterval = setInterval(() => {
        setProgress((oldProgress) => {
          if (oldProgress >= 90) {
            clearInterval(progressInterval);
            return oldProgress;
          }
          return oldProgress + 5;
        });
      }, 500);
    
      const res = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: REQUEST_TIMEOUT,
      });

      clearInterval(progressInterval);

      // Validate response data
      if (!res.data) {
        throw new Error('Empty response received from server');
      }

      // Format the response to match our expected structure
      if (res.data.full_analysis) {
        setAnalyses([{
          chunk: 1,
          total_chunks: 1,
          technical_analysis: res.data.full_analysis,
          simplified_analysis: res.data.full_analysis,
          suggested_solutions: 'Available in streaming mode only',
          timestamp: new Date().toISOString()
        }]);
      } else if (res.data.analysis) {
        // Handle the new format
        setAnalyses([{
          chunk: 1,
          total_chunks: 1,
          technical_analysis: res.data.analysis,
          simplified_analysis: res.data.analysis,
          suggested_solutions: res.data.analysis,
          timestamp: new Date().toISOString()
        }]);
      } else {
        throw new Error('Invalid response format from server');
      }
      
      setProgress(100);
    } catch (err) {
      console.error('Upload error (traditional):', err);
      const errorMessage = err.response 
        ? `Server error: ${err.response.status} - ${err.response.data?.message || err.message}`
        : `Error: ${err.message || 'An unknown error occurred during file analysis'}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, analysisType]);

  // Streaming upload method updated to use Fetch API for streaming
  const uploadFileStreaming = useCallback(async (file) => {
    if (!file) {
      setError('No file selected for upload');
      return;
    }
    
    if (!selectedModel) {
      setError('Please select a model for analysis');
      return;
    }

    let abortController = null;
    
    try {
      setLoading(true);
      setError('');
      setProgress(0);
      setAnalyses([]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      formData.append('analysisType', analysisType);
      formData.append('model', selectedModel);
      
      // Append model settings if available
      if (Object.keys(modelSettings).length > 0) {
        formData.append('modelSettings', JSON.stringify(modelSettings));
      }

      // Create an AbortController for the fetch request
      abortController = new AbortController();
      const signal = abortController.signal;

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details available');
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in this browser or empty response received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Set timeout for the entire request
      const createTimeoutHandler = (controller) => {
        return () => {
          if (controller) {
            controller.abort();
            setError('Request timed out after 20 minutes');
          }
        };
      };
      
      let timeout = setTimeout(createTimeoutHandler(abortController), REQUEST_TIMEOUT);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Reset timeout on each chunk received
        clearTimeout(timeout);
        timeout = setTimeout(createTimeoutHandler(abortController), REQUEST_TIMEOUT);
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line.trim());
              
              // Validate the parsed object has the expected structure
              if (!parsed.chunk || !parsed.total_chunks) {
                console.warn('Received JSON data missing required fields:', parsed);
                continue;
              }
              
              setAnalyses(prev => [...prev, parsed]);
              
              // Update progress based on chunks processed
              const progressValue = Math.round((parsed.chunk / parsed.total_chunks) * 90) + 10;
              setProgress(Math.min(progressValue, 99));
            } catch (parseErr) {
              console.error('Error parsing streamed JSON:', parseErr, line);
            }
          }
        }
      }
      
      clearTimeout(timeout);
      
      // Process any remaining data
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.chunk && parsed.total_chunks) {
            setAnalyses(prev => [...prev, parsed]);
          }
        } catch (parseErr) {
          console.error('Error parsing final JSON chunk:', parseErr);
        }
      }
      setProgress(100);
    } catch (err) {
      console.error('Upload error (streaming):', err);
      
      // Handle abort errors separately
      if (err.name === 'AbortError') {
        setError('Request was cancelled due to timeout or user action');
      } else {
        setError(err.message || 'An error occurred during file analysis');
      }
    } finally {
      setLoading(false);
      
      // Clear any remaining timeouts
      if (abortController) {
        abortController = null;
      }
    }
  }, [language, analysisType]);

  // Main upload handler that delegates to the appropriate method
  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }
    
    if (streamMode) {
      await uploadFileStreaming(selectedFile);
    } else {
      await uploadFileTraditional(selectedFile);
    }
  }, [selectedFile, streamMode, uploadFileStreaming, uploadFileTraditional]);

  // Handle file selection
  const handleFileSelect = useCallback((event) => {
    if (!event.target.files || event.target.files.length === 0) {
      setError('No file selected');
      return;
    }
    
    const file = event.target.files[0];
    setSelectedFile(file);
    setError('');
    
    // Reset file input
    event.target.value = '';
  }, []);

  // Clear selected file
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  // Clear error when changing modes
  useEffect(() => {
    setError('');
  }, [streamMode]);

  // Handle clear error
  const handleClearError = useCallback(() => {
    setError('');
  }, []);

  // Component to display file info
  const FileInfo = ({ file, onClear }) => {
    if (!file) return null;
    
    return (
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded mb-2">
        <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">
          {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </div>
        <button 
          onClick={onClear}
          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          title="Remove file"
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <ThemeProvider attribute="class">
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-6 relative">
        {/* Top bar for language selector and theme toggle */}
        <div className="absolute top-4 left-4 flex items-center gap-4">
          <LanguageSelector selectedLanguage={language} onChange={handleLanguageChange} />
          <ThemeToggle />
        </div>
        
        {/* Ollama status traffic light marker */}
        <div className="absolute top-4 right-4 flex items-center">
          <span className="mr-2 font-semibold dark:text-gray-200">Ollama:</span>
          <div
            className={`w-4 h-4 rounded-full ${
              ollamaStatus ? 'bg-green-500' : 'bg-red-500'
            }`}
            aria-label={ollamaStatus ? 'Ollama is running' : 'Ollama is not running'}
            title={ollamaStatus ? 'Ollama is running' : 'Ollama is not running'}
          />
        </div>

        <h1 className="text-4xl font-bold text-center mb-4 pt-16 dark:text-white">Kara Insights 🚀</h1>
        
        {/* LLM Selector */}
        <LLMSelector 
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          disabled={loading}
          onUpdateModelSettings={handleUpdateModelSettings}
        />
        
        <div className="flex flex-col items-center mb-4">
          <div className="mb-4 flex items-center gap-4">
            <label className="inline-flex items-center" htmlFor="stream-mode-toggle">
              <input
                id="stream-mode-toggle"
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600"
                checked={streamMode}
                onChange={handleStreamModeToggle}
                disabled={loading || analysisType === 'crash'}
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">Use streaming mode</span>
            </label>
            
            <div className="flex items-center">
              <span className="mr-2 text-gray-700 dark:text-gray-300">Analysis type:</span>
              <select
                value={analysisType}
                onChange={handleAnalysisTypeChange}
                disabled={loading}
                className="border border-gray-300 rounded-md shadow-sm p-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                <option value="simple">Simple</option>
                <option value="detailed">Detailed</option>
                <option value="crash">Crash Analysis</option>
              </select>
            </div>
          </div>
          
          {/* Display selected file info */}
          {selectedFile && (
            <FileInfo 
              file={selectedFile} 
              onClear={clearSelectedFile} 
            />
          )}
          
          <div className="relative flex gap-4">
            <label 
              data-tooltip-id="file-select-tip" 
              data-tooltip-content="Select a file to analyze" 
              className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105 disabled:opacity-50 disabled:pointer-events-none"
              htmlFor="file-upload"
            >
              Select File
              <input 
                id="file-upload"
                type="file" 
                onChange={handleFileSelect} 
                className="hidden"
                disabled={loading}
                aria-label="Upload file for analysis"
              />
            </label>
            <Tooltip id="file-select-tip" />
            
            {selectedFile && (
              <button 
                onClick={handleAnalyze}
                data-tooltip-id="analyze-tip" 
                data-tooltip-content={!selectedModel ? "Please select a model first" : "Start analysis"} 
                className={`px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105 ${(loading || !selectedModel) ? 'opacity-50 pointer-events-none' : ''}`}
                disabled={loading || !selectedModel}
                aria-label="Analyze file"
              >
                Analyze
              </button>
            )}
            <Tooltip id="analyze-tip" />
            
            {analyses.length > 0 && (
              <button 
                onClick={downloadAnalysis}
                className={`px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                disabled={loading}
                aria-label="Download analysis report"
              >
                Download Report
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="w-full max-w-2xl mx-auto bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {loading && <p className="text-center text-blue-500 animate-pulse dark:text-blue-400">Analyzing, please wait... {progress}%</p>}
        {loading && progress < 100 && (
          <p className="text-center text-gray-600 dark:text-gray-400 mt-2">
            Currently analyzing chunk {analyses.length + 1}...
          </p>
        )}
        
        {error && (
          <div className="text-center text-red-500 mb-4 p-2 bg-red-50 dark:bg-red-900/30 rounded" role="alert">
            {error}
            <button 
              onClick={handleClearError}
              className="ml-2 text-red-700 dark:text-red-300 font-bold"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
        
        {analyses.length === 0 && !loading && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 italic">Upload a file to get a detailed analysis</p>
        )}

        {analyses.length > 0 && (
          <div>
            {analyses.map(({ chunk, total_chunks, technical_analysis, simplified_analysis, suggested_solutions, error: analysisError, timestamp }) => (
              <div 
                key={`chunk-${chunk}`}
                className="bg-white dark:bg-gray-700 shadow-md rounded p-4 mb-4 max-w-4xl mx-auto"
              >
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Analysis Chunk {chunk}/{total_chunks}
                  </h2>
                  {timestamp && (
                    <small className="text-gray-400 dark:text-gray-500">Analysis generated at: {new Date(timestamp).toLocaleString()}</small>
                  )}
                </div>
                
                {analysisError && (
                  <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded mb-4" role="alert">
                    {analysisError}
                  </div>
                )}
                
                {/* Explanation Section */}
                <details open className="mb-4">
                  <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    📖 Simple Explanation
                  </summary>
                  <div className="mt-2 p-2 dark:text-gray-200">
                    {simplified_analysis || "Analysis not available"}
                  </div>
                </details>
                
                {/* Solutions Section */}
                <details className="mb-4">
                  <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    🛠️ Suggested Solutions
                  </summary>
                  <div className="mt-2 p-2 dark:text-gray-200">
                    {suggested_solutions || "No solutions available"}
                  </div>
                </details>
                
                {/* Technical Analysis Section */}
                <details>
                  <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    🔍 Technical Details
                  </summary>
                  <div className="mt-2 p-2 font-mono text-sm overflow-auto max-h-96 dark:text-gray-300">
                    {technical_analysis || "Technical analysis not available"}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;