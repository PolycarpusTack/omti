// src/components/AnalysisComponent.jsx
import React, { useState, useEffect } from 'react';
import { getAvailableModels, analyzeContent } from '../services/analysisService';
import LLMSelector from './LLMSelector';
import ErrorBoundary from './ErrorBoundary'; // Assuming you have an error boundary component

const AnalysisComponent = () => {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelSettings, setModelSettings] = useState({});
  const [content, setContent] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setError('');
        const modelData = await getAvailableModels();
        setModels(modelData);
        
        // Select first model by default if available
        if (modelData && modelData.length > 0 && !selectedModel) {
          setSelectedModel(modelData[0].id);
        }
      } catch (e) {
        setError(`Failed to load models: ${e.message || 'Unknown error'}`);
        console.error('Error fetching models:', e);
      }
    };

    fetchModels();
  }, [selectedModel]); // Re-fetch if selectedModel changes to null

  // Update model settings when a model is selected
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    
    // If we don't have settings for this model yet, initialize them
    if (!modelSettings[modelId]) {
      const selectedModelData = models.find(m => m.id === modelId);
      if (selectedModelData && selectedModelData.settings) {
        setModelSettings(prev => ({
          ...prev,
          [modelId]: selectedModelData.settings
        }));
      }
    }
  };

  // Update settings for a specific model
  const handleUpdateModelSettings = (modelId, newSettings) => {
    setModelSettings(prev => ({
      ...prev,
      [modelId]: newSettings
    }));
  };

  // Handle the analyze action
  const handleAnalyze = async () => {
    if (!selectedModel) {
      setError('Please select a model first');
      return;
    }

    if (!content.trim()) {
      setError('Please enter content to analyze');
      return;
    }

    try {
      setError('');
      setIsAnalyzing(true);
      
      // Set a timeout for server responsiveness
      const timeout = setTimeout(() => {
        setError('Server not responding. The analysis may still complete, please wait...');
      }, 30000); // 30 seconds timeout for UI feedback
      
      setTimeoutId(timeout);
      
      const settings = modelSettings[selectedModel];
      const res = await analyzeContent(content, selectedModel, settings);
      
      clearTimeout(timeout);
      setResult(res.result);
    } catch (e) {
      setError(`Analysis error: ${e.message || 'Unknown error'}`);
      console.error('Analysis error:', e);
    } finally {
      setIsAnalyzing(false);
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  return (
    <ErrorBoundary fallback={<div className="error-boundary">Something went wrong with the analysis component</div>}>
      <div className="analysis-container">
        <h1 className="text-xl font-bold mb-4">Content Analysis</h1>
        
        {/* Model selector */}
        <LLMSelector
          models={models}
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          onUpdateModelSettings={handleUpdateModelSettings}
          disabled={isAnalyzing}
        />
        
        {/* Content input */}
        <div className="mb-4">
          <label htmlFor="content" className="block text-sm font-medium mb-2">
            Content to Analyze
          </label>
          <textarea
            id="content"
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={isAnalyzing}
            placeholder="Paste log content, code, or text to analyze..."
            className="w-full h-48 p-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-between mb-4">
          <button
            onClick={() => setContent('')}
            disabled={!content || isAnalyzing}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            Clear
          </button>
          
          <button
            onClick={handleAnalyze}
            disabled={!selectedModel || !content.trim() || isAnalyzing}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {/* Results display */}
        {result && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Analysis Result</h2>
            <div className="bg-gray-50 p-4 rounded border">
              <pre className="whitespace-pre-wrap">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AnalysisComponent;