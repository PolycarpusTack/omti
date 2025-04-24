import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LanguageSelector from './components/LanguageSelector';
import { Tooltip } from 'react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import ThemeToggle from './components/ThemeToggle';
import 'react-tooltip/dist/react-tooltip.css';

function App() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [language, setLanguage] = useState('en');  // default to English
  const [streamMode, setStreamMode] = useState(true); // Default to stream mode

  // Explicitly check Ollama status
  useEffect(() => {
    const checkOllama = async () => {
      try {
        await axios.get('http://localhost:11434');
        setOllamaStatus(true);
      } catch (err) {
        setOllamaStatus(false);
      }
    };

    checkOllama();
    const interval = setInterval(checkOllama, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLanguageChange = (selectedOption) => {
    setLanguage(selectedOption.value);
  };

  // Download analysis as text file
  const downloadAnalysis = () => {
    try {
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
      element.download = `WCR-analysis-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(element);
      element.click();
  
      window.URL.revokeObjectURL(element.href);
      document.body.removeChild(element);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download analysis: ' + (err.message || 'Unknown error'));
    }
  };
  

  // Traditional non-streaming upload method
  const uploadFileTraditional = async (file) => {
    try {
      setLoading(true);
      setError('');
      setProgress(0);
      setAnalyses([]);
    
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
    
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
    
      const res = await axios.post('http://localhost:8000/analyze/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 1200000, // 20 minutes timeout
      });

      // Format the response to match our expected structure
      if (res.data && res.data.full_analysis) {
        setAnalyses([{
          chunk: 1,
          total_chunks: 1,
          technical_analysis: res.data.full_analysis,
          simplified_analysis: res.data.full_analysis,
          suggested_solutions: 'Available in streaming mode only',
          timestamp: new Date().toISOString()
        }]);
      } else if (res.data && res.data.analysis) {
        // Handle the new format
        setAnalyses([{
          chunk: 1,
          total_chunks: 1,
          technical_analysis: res.data.analysis,
          simplified_analysis: res.data.analysis,
          suggested_solutions: res.data.analysis,
          timestamp: new Date().toISOString()
        }]);
      }
      
      clearInterval(progressInterval);
      setProgress(100);
    } catch (err) {
      console.error('Upload error (traditional):', err);
      setError(err.message || 'An error occurred during file analysis');
    } finally {
      setLoading(false);
    }
  };

  // Streaming upload method
  const uploadFileStreaming = async (file) => {
    try {
      setLoading(true);
      setError('');
      setProgress(0);
      setAnalyses([]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);

      // Use axios for better error handling and timeout configuration
      const response = await axios.post('http://localhost:8000/analyze/', formData, {
        responseType: 'stream',
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 1200000, // 20 minutes timeout
        onUploadProgress: (progressEvent) => {
          const uploadPercentage = Math.round((progressEvent.loaded * 10) / progressEvent.total);
          setProgress(uploadPercentage); // Set to max 10% for upload phase
        }
      });

      const reader = response.data.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let processedChunks = 0;

      // Process the stream
      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining data in buffer
              if (buffer.trim()) {
                try {
                  const parsed = JSON.parse(buffer.trim());
                  setAnalyses(prev => [...prev, parsed]);
                  processedChunks = parsed.chunk;
                } catch (parseErr) {
                  console.error('Error parsing final JSON chunk:', parseErr);
                }
              }
              break;
            }
            
            // Decode and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line for next iteration
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line.trim());
                  setAnalyses(prev => [...prev, parsed]);
                  
                  // Update progress based on chunks processed
                  processedChunks = parsed.chunk;
                  const totalChunks = parsed.total_chunks;
                  const analysisProgress = Math.round((processedChunks / totalChunks) * 90) + 10;
                  setProgress(Math.min(analysisProgress, 99)); // Cap at 99% until complete
                } catch (parseErr) {
                  console.error('Error parsing JSON from stream:', parseErr, line);
                  // Continue processing other lines even if one fails
                }
              }
            }
          }
          
          setProgress(100);
        } catch (streamErr) {
          throw new Error(`Error processing stream: ${streamErr.message}`);
        }
      };

      await readStream();
    } catch (err) {
      console.error('Upload error (streaming):', err);
      setError(err.message || 'An error occurred during file analysis');
    } finally {
      setLoading(false);
    }
  };

  // Main upload handler that delegates to the appropriate method
  const uploadFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (streamMode) {
      await uploadFileStreaming(file);
    } else {
      await uploadFileTraditional(file);
    }
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
          />
        </div>

        <h1 className="text-4xl font-bold text-center mb-4 pt-16 dark:text-white">One More Thing Insights 🚀</h1>
        
        <div className="flex flex-col items-center mb-4">
          <div className="mb-4 flex items-center">
            <label className="inline-flex items-center mr-4">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600"
                checked={streamMode}
                onChange={() => setStreamMode(!streamMode)}
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">Use streaming mode</span>
            </label>
          </div>
          
          <div className="relative flex gap-4">
            <label 
              data-tooltip-id="analysis-tip" 
              data-tooltip-content="Click to start analyzing!" 
              className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105"
            >
              Analyze
              <input 
                type="file" 
                onChange={uploadFile} 
                className="hidden"
                disabled={loading}
              />
            </label>
            <Tooltip id="analysis-tip" />
            
            {analyses.length > 0 && (
              <button 
                onClick={downloadAnalysis}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105"
                disabled={loading}
              >
                Download Report
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="w-full max-w-2xl mx-auto bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-4">
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
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        
        {analyses.length === 0 && !loading && !error && (
          <p className="text-center text-gray-500 dark:text-gray-400 italic">Upload a WCR file to get a detailed analysis</p>
        )}

        <AnimatePresence>
          {analyses.map(({ chunk, total_chunks, technical_analysis, simplified_analysis, suggested_solutions, error, timestamp }) => (
            <motion.div 
              key={`chunk-${chunk}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4 }}
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
              
              {error && (
                <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded mb-4">
                  {error}
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  );
}

export default App;