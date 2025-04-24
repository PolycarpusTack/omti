import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { OLLAMA_URL, OLLAMA_CHECK_INTERVAL, DEFAULT_SETTINGS } from '../constants';

const useModelSelection = () => {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_SETTINGS.model);
  const [ollamaStatus, setOllamaStatus] = useState(false);
  const [modelProviders, setModelProviders] = useState({
    ollama: { available: false, models: [] },
    openai: { available: false, models: [] }
  });

  // Update settings when model changes
  const handleModelSelect = useCallback((modelId) => {
    if (!modelId) {
      modelId = DEFAULT_SETTINGS.model; // Use default if empty
    }
    setSelectedModel(modelId);
    // Console log for debugging purposes
    console.log(`Selected model: ${modelId}`);
  }, []);

  // Check Ollama status periodically
  useEffect(() => {
    const checkOllama = async () => {
      try {
        await axios.get(OLLAMA_URL);
        setOllamaStatus(true);
        
        // If we could get a response, try to fetch available models
        try {
          const modelsResponse = await axios.get(`${OLLAMA_URL}/api/tags`);
          if (modelsResponse.data && modelsResponse.data.models) {
            setModelProviders(prev => ({
              ...prev,
              ollama: {
                available: true,
                models: modelsResponse.data.models.map(model => ({
                  id: model.name,
                  name: model.name,
                  provider: 'ollama'
                }))
              }
            }));
          }
        } catch (modelErr) {
          console.warn('Could not fetch Ollama models:', modelErr.message);
        }
      } catch (err) {
        setOllamaStatus(false);
        setModelProviders(prev => ({
          ...prev,
          ollama: { available: false, models: [] }
        }));
        console.warn('Ollama service not available:', err.message);
      }
    };

    checkOllama();
    const interval = setInterval(checkOllama, OLLAMA_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return {
    selectedModel,
    ollamaStatus,
    modelProviders,
    handleModelSelect
  };
};

export default useModelSelection;