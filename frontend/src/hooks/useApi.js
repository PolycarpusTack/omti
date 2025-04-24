import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export function useApi() {
  const { state, actions } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const makeRequest = useCallback(async (endpoint, options = {}, retryCount = 0) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeRequest(endpoint, options, retryCount + 1);
      }
      
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeFile = useCallback(async (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.model) formData.append('model', options.model);
    if (options.language) formData.append('language', options.language);
    if (options.max_tokens_per_chunk) formData.append('max_tokens_per_chunk', options.max_tokens_per_chunk);
    if (options.timeout) formData.append('timeout', options.timeout);

    try {
      const endpoint = state.streamMode ? '/analyze/stream' : '/analyze';
      const response = await makeRequest(endpoint, {
        method: 'POST',
        body: formData,
      });

      return response;
    } catch (error) {
      actions.setError(error.message);
      throw error;
    }
  }, [state.streamMode, makeRequest, actions]);

  const getModels = useCallback(async () => {
    try {
      return await makeRequest('/models');
    } catch (error) {
      actions.setError(error.message);
      throw error;
    }
  }, [makeRequest, actions]);

  const checkHealth = useCallback(async () => {
    try {
      return await makeRequest('/health');
    } catch (error) {
      actions.setError(error.message);
      throw error;
    }
  }, [makeRequest, actions]);

  return {
    isLoading,
    error,
    analyzeFile,
    getModels,
    checkHealth,
    makeRequest,
  };
} 