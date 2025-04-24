import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LanguageSelector from './components/LanguageSelector';

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

  // Traditional non-streaming upload method
  const uploadFileTraditional = async (file) => {
    try {
      setLoading(true);
      setError('');
      setProgress(0);
      setAnalyses([]);
    
      const formData = new FormData();
      formData.append('file', file);
    
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
    <div className="min-h-screen bg-gray-100 p-6 relative">
      {/* Top bar for language selector */}
      <div className="absolute top-4 left-4">
        <LanguageSelector selectedLanguage={language} onChange={handleLanguageChange} />
      </div>
      
      {/* Ollama status traffic light marker */}
      <div className="absolute top-4 right-4 flex items-center">
        <span className="mr-2 font-semibold">Ollama:</span>
        <div
          className={`w-4 h-4 rounded-full ${
            ollamaStatus ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>

      <h1 className="text-4xl font-bold text-center mb-4">One More Thing Insights 🚀</h1>
      
      <div className="flex flex-col items-center mb-4">
        <div className="mb-4 flex items-center">
          <label className="inline-flex items-center mr-4">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600"
              checked={streamMode}
              onChange={() => setStreamMode(!streamMode)}
            />
            <span className="ml-2 text-gray-700">Use streaming mode</span>
          </label>
        </div>
        
        <div className="relative">
          <label className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded cursor-pointer transition-colors duration-300">
            Upload File
            <input 
              type="file" 
              onChange={uploadFile} 
              className="hidden"
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {loading && (
        <div className="w-full max-w-2xl mx-auto bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {loading && <p className="text-center text-blue-500 animate-pulse">Analyzing, please wait... {progress}%</p>}
      {loading && progress < 100 && (
        <p className="text-center text-gray-600 mt-2">
          Currently analyzing chunk {analyses.length + 1}...
        </p>
      )}
      {error && <p className="text-center text-red-500 mb-4">Error: {error}</p>}
      
      {analyses.length === 0 && !loading && !error && (
        <p className="text-center text-gray-500 italic">Upload a WCR file to get a detailed analysis</p>
      )}

      {analyses.map(({ chunk, total_chunks, technical_analysis, simplified_analysis, suggested_solutions, error, timestamp }) => (
        <div key={chunk} className="bg-white shadow-md rounded p-4 mb-4 max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-semibold text-gray-700">
              Analysis Chunk {chunk}/{total_chunks}
            </h2>
            {timestamp && (
              <small className="text-gray-400">Analysis generated at: {new Date(timestamp).toLocaleString()}</small>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {/* Explanation Section */}
          <details open className="mb-4">
            <summary className="font-semibold cursor-pointer bg-gray-50 p-2 rounded">
              📖 Simple Explanation
            </summary>
            <div className="mt-2 p-2">
              {simplified_analysis || "Analysis not available"}
            </div>
          </details>
          
          {/* Solutions Section */}
          <details className="mb-4">
            <summary className="font-semibold cursor-pointer bg-gray-50 p-2 rounded">
              🛠️ Suggested Solutions
            </summary>
            <div className="mt-2 p-2">
              {suggested_solutions || "No solutions available"}
            </div>
          </details>
          
          {/* Technical Analysis Section */}
          <details>
            <summary className="font-semibold cursor-pointer bg-gray-50 p-2 rounded">
              🔍 Technical Details
            </summary>
            <div className="mt-2 p-2 font-mono text-sm overflow-auto max-h-96">
              {technical_analysis || "Technical analysis not available"}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

export default App;