// src/components/LLMSelector.js
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import axios from 'axios';
import _ from 'lodash';

// Use React.lazy for the modal to reduce initial bundle size
const ModelDetailsModal = lazy(() => import('./Modals/ModelDetailsModal/index'));

const API_URL = 'http://localhost:8000'; // Update with your actual API URL

// Pull pure functions outside the component to avoid recreation on every render
function determineSpecialization(name) {
  name = name.toLowerCase();
  if (name.includes('code') || name.includes('starcoder')) {
    return 'Code analysis';
  } else if (name.includes('mistral')) {
    return 'Fast analysis';
  } else if (name.includes('mixtral') || name.includes('moe')) {
    return 'Deep analysis';
  } else if ((name.includes('llama') || name.includes('llama2')) && 
            (name.includes('70b') || name.includes('13b'))) {
    return 'Technical depth';
  } else if (name.includes('gpt-4')) {
    return 'Premium insights';
  }
  return 'General purpose';
}

function determineDescription(name) {
  const specialization = determineSpecialization(name);
  
  if (specialization === 'Code analysis') {
    return 'Specialized for code and stack trace analysis';
  } else if (specialization === 'Fast analysis') {
    return 'Balanced speed and accuracy for quick analysis';
  } else if (specialization === 'Deep analysis') {
    return 'Comprehensive analysis with deeper insights';
  } else if (specialization === 'Technical depth') {
    return 'Detailed technical analysis for complex issues';
  } else if (specialization === 'Premium insights') {
    return 'Highest quality analysis with detailed explanations';
  }
  return 'General purpose model for log analysis';
}

/**
 * LLM Selector Component - Displays available models with status indicators
 * and allows selection for analysis with smart suggestions
 * 
 * @param {Object} props
 * @param {string} props.selectedModel - Currently selected model
 * @param {function} props.onModelSelect - Function to call when model is selected
 * @param {boolean} props.disabled - Whether the selector is disabled
 * @param {function} props.onUpdateModelSettings - Function to update model settings
 * @param {Object} props.suggestionProps - Props for model suggestion
 * @param {string} props.suggestionProps.logContent - Content being analyzed
 * @param {string} props.suggestionProps.logType - Type of log
 * @param {number} props.suggestionProps.contentLength - Length of content
 * @param {boolean} props.suggestionProps.includeStackTraces - Whether content has stack traces
 */
const LLMSelector = ({ 
  selectedModel, 
  onModelSelect, 
  disabled = false, 
  onUpdateModelSettings,
  suggestionProps = {} 
}) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [selectedModelDetails, setSelectedModelDetails] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // State for model suggestion
  const [suggestedModelId, setSuggestedModelId] = useState(null);
  const [suggestionReason, setSuggestionReason] = useState('');
  const [showSuggestionBanner, setShowSuggestionBanner] = useState(false);
  
  // New states for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [favoriteModels, setFavoriteModels] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('favoriteModels') || '[]');
    } catch (e) {
      console.warn('Failed to load favorite models:', e);
      return [];
    }
  });
  const [modelUsageHistory, setModelUsageHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('modelUsageHistory') || '{}');
    } catch (e) {
      console.warn('Failed to load model usage history:', e);
      return {};
    }
  });
  const [showUsageStats, setShowUsageStats] = useState(false);

  // Reference to track API calls to prevent race conditions
  const abortControllerRef = React.useRef(null);
  
  // Fetch models from API with enhanced error handling and retry logic
  const fetchModels = useCallback(async () => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      setLoading(true);
      setError(null);
      
      // Initialize empty array for all models
      let allModels = [];
      
      // Fetch models from the backend API
      try {
        // Use the enhanced service endpoint to get models
        const response = await axios.get(`${API_URL}/api/models/available`, { signal });
        
        if (response.data && response.data.models) {
          const availableModels = Object.entries(response.data.models).map(([modelId, modelData]) => ({
            id: modelId,
            name: modelData.name || modelId.replace(/^([a-z]+)(:[\w-]+)?/, (match, name) => 
              name.charAt(0).toUpperCase() + name.slice(1)),
            loaded: true,
            status: 'healthy',
            health: 'healthy',
            size: modelData.size || 'Unknown',
            specialization: determineSpecialization(modelId),
            description: modelData.description || determineDescription(modelId),
            provider: modelId.startsWith('gpt-') ? 'openai' : 'ollama',
            avgResponseTime: modelData.avgResponseTime || 1.5,
            throughput: modelData.throughput || 30.0,
            // Use settings from the API, with fallbacks for any missing properties
            settings: {
              temperature: modelData.settings?.temperature || 0.7,
              topP: modelData.settings?.top_p || 0.9,
              maxTokensPerChunk: modelData.settings?.max_tokens || modelData.context_window || 4000,
              maxOutputTokens: modelData.settings?.max_tokens || 2000,
              frequencyPenalty: modelData.settings?.frequency_penalty || 0,
              presencePenalty: modelData.settings?.presence_penalty || 0,
              timeout: modelData.settings?.timeout || 300
            }
          }));
          
          allModels = [...allModels, ...availableModels];
          console.log('Loaded models from API:', availableModels);
        }
      } catch (apiError) {
        console.error('Failed to fetch models from API:', apiError);
      }
      
      // IMPORTANT: Always include OpenAI models whether API succeeds or fails
      // This ensures OpenAI models are always visible
      const openAIModels = [
        {
          id: 'gpt-4',
          name: 'GPT-4 Turbo',
          loaded: true,
          status: 'healthy',
          health: 'healthy',
          size: '1.8T',
          specialization: 'Premium insights',
          description: 'Premium OpenAI model with highest accuracy and best explanations',
          provider: 'openai',
          avgResponseTime: 2.8,
          throughput: 45.2,
          lastError: null,
          settings: {
            temperature: 0.7,
            topP: 0.9,
            maxTokensPerChunk: 8000,
            maxOutputTokens: 2048,
            frequencyPenalty: 0,
            presencePenalty: 0,
            timeout: 300
          }
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          loaded: true,
          status: 'healthy',
          health: 'healthy',
          size: '175B',
          specialization: 'Fast analysis',
          description: 'Fast and efficient OpenAI model, good for general analysis',
          provider: 'openai',
          avgResponseTime: 1.1,
          throughput: 65.5,
          lastError: null,
          settings: {
            temperature: 0.7,
            topP: 0.9,
            maxTokensPerChunk: 4000,
            maxOutputTokens: 1024,
            frequencyPenalty: 0,
            presencePenalty: 0,
            timeout: 120
          }
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          loaded: true,
          status: 'healthy',
          health: 'healthy',
          size: '~1.7T',
          specialization: 'Balanced performance',
          description: 'Optimized GPT-4 model with better speed-quality tradeoff',
          provider: 'openai',
          avgResponseTime: 1.7,
          throughput: 55.0,
          lastError: null,
          settings: {
            temperature: 0.7,
            topP: 0.9,
            maxTokensPerChunk: 8000,
            maxOutputTokens: 4096,
            frequencyPenalty: 0,
            presencePenalty: 0,
            timeout: 180
          }
        }
      ];
      
      allModels = [...allModels, ...openAIModels];
      
      // Remove duplicates using lodash for better clarity
      const uniqueModels = _.uniqBy(allModels, 'id');
      
      // Try to load saved settings for each model
      try {
        const savedSettings = JSON.parse(localStorage.getItem('modelSettings') || '{}');
        
        // Update models with saved settings
        uniqueModels.forEach(model => {
          if (savedSettings[model.id]) {
            model.settings = {
              ...model.settings,
              ...savedSettings[model.id]
            };
          }
        });
      } catch (e) {
        console.warn('Failed to load saved model settings:', e);
      }
      
      setModels(uniqueModels);
      
      // Debug log to check loaded models
      console.log('Loaded models:', uniqueModels);
      console.log('Current selectedModel:', selectedModel);
      
      // Set default selected model if none is selected yet
      if (!selectedModel && uniqueModels.length > 0) {
        onModelSelect(uniqueModels[0].id);
      }
      
      setLoading(false);
      return uniqueModels;
    } catch (err) {
      // Only set error if not an abort error
      if (err.name !== 'AbortError') {
        console.error('Error fetching models:', err);
        setError(err.message || 'Failed to load models');
        setModels([]);
      }
      setLoading(false);
      return [];
    }
  }, [selectedModel, onModelSelect]);
  
  // Generate a simple local suggestion based on content characteristics
  const generateLocalSuggestion = useCallback(() => {
    if (models.length === 0 || !suggestionProps.logContent) return;
    
    const healthyModels = models.filter(m => m.loaded && m.status === 'healthy');
    if (healthyModels.length === 0) return;
    
    const { logContent, includeStackTraces } = suggestionProps;
    
    // Simple content analysis
    const hasCode = /```[\s\S]*?```/.test(logContent) || 
                    /(function|class|def|public|private|protected)/.test(logContent);
    const hasErrors = /(error|exception|failed|failure)/i.test(logContent);
    const isLong = logContent.length > 2000;
    
    // Find best matching model
    let bestModelId = null;
    
    if (hasCode) {
      // Look for code-specialized models
      const codeModel = healthyModels.find(m => m.specialization === 'Code analysis');
      if (codeModel) bestModelId = codeModel.id;
    } else if (hasErrors && includeStackTraces) {
      // Look for technical depth models
      const depthModel = healthyModels.find(m => m.specialization === 'Technical depth');
      if (depthModel) bestModelId = depthModel.id;
    } else if (isLong) {
      // Look for deep analysis models
      const deepModel = healthyModels.find(m => m.specialization === 'Deep analysis');
      if (deepModel) bestModelId = deepModel.id;
    } else {
      // Default to fast analysis for simpler logs
      const fastModel = healthyModels.find(m => m.specialization === 'Fast analysis');
      if (fastModel) bestModelId = fastModel.id;
    }
    
    // If nothing specific matches, use the first model
    if (!bestModelId && healthyModels.length > 0) {
      bestModelId = healthyModels[0].id;
    }
    
    // Only show suggestion if it's different from current selection
    if (bestModelId && bestModelId !== selectedModel) {
      const reason = hasCode ? 'Suggested for code analysis' : 
                    hasErrors ? 'Suggested for error analysis' :
                    isLong ? 'Suggested for handling longer content' :
                    'General recommendation based on content';
                    
      setSuggestedModelId(bestModelId);
      setSuggestionReason(reason);
      setShowSuggestionBanner(true);
    } else {
      setSuggestedModelId(null);
      setSuggestionReason('');
      setShowSuggestionBanner(false);
    }
  }, [suggestionProps, models, selectedModel]);

  // Enhanced fetch model suggestion with better error handling
  const fetchModelSuggestion = useCallback(() => {
    const { logContent, logType, contentLength, includeStackTraces } = suggestionProps;
    
    // Only fetch suggestion if we have log content and models
    if (!logContent || models.length === 0 || disabled) {
      return;
    }
    
    // Create a debounce-like effect with setTimeout
    const timer = setTimeout(async () => {
      try {
        // Call the suggestion API
        const response = await axios.post(`${API_URL}/api/suggestion/model`, {
          contentSample: logContent.substring(0, 1000), // First 1000 chars
          logType: logType || 'unknown',
          contentLength: contentLength || logContent.length,
          includeStackTraces: includeStackTraces || false,
          availableModelIds: models.filter(m => m.loaded && m.status === 'healthy').map(m => m.id)
        });
        
        if (response.data && response.data.suggestedModelId) {
          // Only show suggestion if it's different from current selection
          if (response.data.suggestedModelId !== selectedModel) {
            setSuggestedModelId(response.data.suggestedModelId);
            setSuggestionReason(response.data.reason || 'Suggested based on content analysis');
            setShowSuggestionBanner(true);
          } else {
            // Clear suggestion if it matches current selection
            setSuggestedModelId(null);
            setSuggestionReason('');
            setShowSuggestionBanner(false);
          }
        }
      } catch (err) {
        console.error('Error fetching model suggestion:', err);
        // Generate a simple local suggestion if API fails
        generateLocalSuggestion();
      }
    }, 750); // 750ms delay for debounce-like behavior
    
    // Return cleanup function to clear the timeout
    return () => clearTimeout(timer);
  }, [suggestionProps, models, selectedModel, disabled, generateLocalSuggestion]);
  
  // Effect to fetch models on mount and refresh periodically (every 2 hours)
  useEffect(() => {
    fetchModels();
    
    // Refresh model status periodically (every 2 hours instead of every minute)
    const intervalId = setInterval(fetchModels, 2 * 60 * 60 * 1000); 
    
    // Set up page visibility event to refresh on page focus after being hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchModels();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchModels]);
  
  // Effect to fetch model suggestion when log content changes
  useEffect(() => {
    if (Object.keys(suggestionProps).length > 0) {
      const cleanup = fetchModelSuggestion();
      return cleanup;
    }
  }, [suggestionProps, fetchModelSuggestion]);
  
  // Debug the current selected model
  useEffect(() => {
    console.log(`LLMSelector received selectedModel: ${selectedModel || 'none'}`);
    
    if (selectedModel && models.length > 0) {
      const foundModel = models.find(m => m.id === selectedModel);
      console.log('Found model for selected ID:', foundModel);
      
      // Check if the model is found but not showing as selected
      if (foundModel && selectedModel !== foundModel.id) {
        console.warn(`ID mismatch: ${selectedModel} vs ${foundModel.id}`);
      }
    }
  }, [selectedModel, models]);
  
  // Track model usage
  const trackModelUsage = useCallback((modelId) => {
    try {
      const updatedHistory = { ...modelUsageHistory };
      if (!updatedHistory[modelId]) {
        updatedHistory[modelId] = { count: 0, lastUsed: null };
      }
      
      updatedHistory[modelId].count += 1;
      updatedHistory[modelId].lastUsed = new Date().toISOString();
      
      setModelUsageHistory(updatedHistory);
      localStorage.setItem('modelUsageHistory', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to update model usage history:', e);
    }
  }, [modelUsageHistory]);
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const handleModelSelect = (modelId) => {
    if (disabled) return;
    
    console.log(`Attempting to select model: ${modelId}`);
    
    const selectedModel = models.find(m => m.id === modelId);
    console.log('Found model:', selectedModel);
    
    if (selectedModel && selectedModel.loaded) {
      console.log(`Selecting model: ${modelId}`);
      
      // Track model usage
      trackModelUsage(modelId);
      
      // Pass model settings to parent component
      if (onUpdateModelSettings && selectedModel.settings) {
        onUpdateModelSettings(modelId, selectedModel.settings);
      }
      
      // Notify parent of model selection
      onModelSelect(modelId);
      
      // Record feedback if a suggestion was active
      if (suggestedModelId) {
        recordSelectionFeedback(modelId, modelId === suggestedModelId);
        // Clear suggestion after selection
        setShowSuggestionBanner(false);
      }
    } else {
      console.log(`Model ${modelId} is not available or not loaded`);
    }
  };
  
  const recordSelectionFeedback = async (selectedModelId, wasSuggestionAccepted) => {
    try {
      await axios.post(`${API_URL}/api/suggestion/feedback`, {
        suggestedModelId,
        selectedModelId,
        contentLength: suggestionProps.contentLength || suggestionProps.logContent?.length || 0,
        logType: suggestionProps.logType || 'unknown',
        includeStackTraces: suggestionProps.includeStackTraces || false,
        wasSuggestionAccepted
      });
      console.log('Recorded selection feedback:', { wasSuggestionAccepted });
    } catch (err) {
      console.error('Failed to record selection feedback:', err);
    }
  };
  
  const showDetails = (model) => {
    setSelectedModelDetails(model);
    setShowModelDetails(true);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  const acceptSuggestion = () => {
    if (suggestedModelId) {
      handleModelSelect(suggestedModelId);
    }
  };
  
  const dismissSuggestion = () => {
    // Record that the suggestion was dismissed
    if (suggestedModelId) {
      recordSelectionFeedback(selectedModel, false);
    }
    setShowSuggestionBanner(false);
  };
  
  // Handle model settings update
  const handleUpdateModelSettings = (modelId, newSettings) => {
    // Update the models array with new settings
    const updatedModels = models.map(model => {
      if (model.id === modelId) {
        return {
          ...model,
          settings: {
            ...model.settings,
            ...newSettings
          }
        };
      }
      return model;
    });
    
    setModels(updatedModels);
    
    // Save settings to localStorage
    try {
      const currentSettings = JSON.parse(localStorage.getItem('modelSettings') || '{}');
      const updatedSettings = {
        ...currentSettings,
        [modelId]: {
          ...currentSettings[modelId],
          ...newSettings
        }
      };
      localStorage.setItem('modelSettings', JSON.stringify(updatedSettings));
    } catch (e) {
      console.error('Failed to save model settings:', e);
    }
    
    // Call the parent handler to update settings in analysis service
    if (onUpdateModelSettings) {
      onUpdateModelSettings(modelId, newSettings);
    }
  };
  
  // Toggle favorite status for a model
  const toggleFavorite = (modelId) => {
    try {
      const updatedFavorites = favoriteModels.includes(modelId)
        ? favoriteModels.filter(id => id !== modelId)
        : [...favoriteModels, modelId];
      
      setFavoriteModels(updatedFavorites);
      localStorage.setItem('favoriteModels', JSON.stringify(updatedFavorites));
    } catch (e) {
      console.error('Failed to update favorite models:', e);
    }
  };
  
  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery) return models;
    
    const query = searchQuery.toLowerCase();
    return models.filter(model => 
      model.name.toLowerCase().includes(query) ||
      model.specialization.toLowerCase().includes(query) ||
      model.description.toLowerCase().includes(query) ||
      (model.provider && model.provider.toLowerCase().includes(query))
    );
  }, [models, searchQuery]);
  
  // Sort models based on selected criterion
  const sortedModels = useMemo(() => {
    if (sortBy === 'default') return filteredModels;
    
    return [...filteredModels].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'speed':
          return a.avgResponseTime - b.avgResponseTime;
        case 'size':
          // Extract numeric part if possible
          const sizeA = parseFloat(a.size.replace(/[^0-9.]/g, '')) || 0;
          const sizeB = parseFloat(b.size.replace(/[^0-9.]/g, '')) || 0;
          return sizeB - sizeA; // Larger models first
        case 'favorites':
          const aIsFav = favoriteModels.includes(a.id);
          const bIsFav = favoriteModels.includes(b.id);
          return bIsFav - aIsFav; // Favorites first
        case 'usage':
          const usageA = modelUsageHistory[a.id]?.count || 0;
          const usageB = modelUsageHistory[b.id]?.count || 0;
          return usageB - usageA; // Most used first
        default:
          return 0;
      }
    });
  }, [filteredModels, sortBy, favoriteModels, modelUsageHistory]);
  
  // Model Card component extracted for better organization
  const ModelCard = ({ model, isSelected, isSuggested, disabled, onSelect, onShowDetails }) => {
    const isFavorite = favoriteModels.includes(model.id);
    const usageCount = modelUsageHistory[model.id]?.count || 0;
    
    return (
      <div 
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={isSelected}
        aria-disabled={!model.loaded || disabled}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && model.loaded && !disabled) {
            e.preventDefault();
            onSelect(model.id);
          }
        }}
        className={`border rounded-lg p-3 flex flex-col transition-all cursor-pointer transform hover:scale-[1.02] ${
          isSelected 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : isSuggested
              ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-gray-200 dark:border-gray-700'
        } ${!model.loaded || disabled ? 'opacity-60' : ''}`}
        onClick={() => model.loaded && !disabled && onSelect(model.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(model.status)} mr-2`}></div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{model.name}</h3>
            {!model.loaded && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 text-xs rounded-full">
                Offline
              </span>
            )}
            
            {/* Provider badge */}
            {model.provider && (
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs rounded-full">
                {model.provider === 'openai' ? 'OpenAI' : model.provider}
              </span>
            )}
          </div>
          
          {/* Favorite button */}
          <div className="flex items-center space-x-1">
            {/* Suggested tag */}
            {isSuggested && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-full">
                Suggested
              </span>
            )}
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(model.id);
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill={isFavorite ? "currentColor" : "none"}
                stroke="currentColor" 
                className="w-5 h-5"
                strokeWidth={isFavorite ? "0" : "2"}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Specialization badge */}
        <div className="flex items-center mb-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            model.specialization === 'General purpose' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
            model.specialization === 'Technical depth' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
            model.specialization === 'Deep analysis' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
            model.specialization === 'Premium insights' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' :
            model.specialization === 'Fast analysis' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
            model.specialization === 'Code analysis' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
            model.specialization === 'Balanced performance' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300' :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {model.specialization}
          </span>
        </div>
        
        <Suspense fallback={<div className="text-xs text-gray-600 dark:text-gray-400 mb-2 h-8 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>}>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2 h-8">
            {model.description}
          </div>
        </Suspense>
        
        <div className="mt-auto flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <span>{model.size}</span>
            {showUsageStats && usageCount > 0 && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {usageCount} use{usageCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {model.loaded && !disabled && (
              <button 
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails(model);
                }}
              >
                Details
              </button>
            )}
            {isSelected && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Selected
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Prepare the render content based on loading/error states
  let content;
  
  if (loading) {
    content = (
      <div className="flex justify-center items-center p-4 h-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading models...</span>
      </div>
    );
  } else if (error) {
    content = (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              Failed to load models: {error}
            </p>
            <button 
              className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 hover:underline"
              onClick={fetchModels}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <>
        {/* Model suggestion banner */}
        {showSuggestionBanner && suggestedModelId && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 mb-4 rounded shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Suggested model: </span>
                    {models.find(m => m.id === suggestedModelId)?.name || suggestedModelId}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {suggestionReason}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={acceptSuggestion} 
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-blue-200 px-3 py-1 rounded"
                >
                  Use Suggested
                </button>
                <button 
                  onClick={dismissSuggestion}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      
        {/* Selected model summary (always visible) */}
        {selectedModel && models.length > 0 && (
          <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 mb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {/* Find the model that matches the selected ID */}
                {(() => {
                  const model = models.find(m => m.id === selectedModel);
                  return model ? (
                    <>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(model.status)} mr-2`}></div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {model.name}
                      </h3>
                      {model.provider && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs rounded-full">
                          {model.provider === 'openai' ? 'OpenAI' : model.provider}
                        </span>
                      )}
                    </>
                  ) : (
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      No model selected
                    </h3>
                  );
                })()}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  {(() => {
                    const model = models.find(m => m.id === selectedModel);
                    return model ? model.specialization : 'Unknown';
                  })()}
                </span>
                {/* Configure settings button */}
                <button
                  onClick={() => {
                    const model = models.find(m => m.id === selectedModel);
                    if (model) {
                      setSelectedModelDetails(model);
                      setShowModelDetails(true);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Search and filter toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <div className="flex gap-2 items-center w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="p-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            >
              <option value="default">Sort by: Default</option>
              <option value="name">Name</option>
              <option value="speed">Response Time</option>
              <option value="size">Model Size</option>
              <option value="favorites">Favorites</option>
              <option value="usage">Usage Count</option>
            </select>
            
            <button
              className={`p-2 rounded-lg ${showUsageStats ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
              onClick={() => setShowUsageStats(!showUsageStats)}
              aria-label={showUsageStats ? "Hide usage statistics" : "Show usage statistics"}
              title={showUsageStats ? "Hide usage statistics" : "Show usage statistics"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </button>
            
            <button
              onClick={fetchModels}
              className="p-2 rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              aria-label="Refresh models"
              title="Refresh models"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Stats summary */}
        {showUsageStats && Object.keys(modelUsageHistory).length > 0 && (
          <div className="mb-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Usage Statistics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(modelUsageHistory)
                .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
                .slice(0, 3)
                .map(([modelId, stats]) => {
                  const model = models.find(m => m.id === modelId);
                  if (!model) return null;
                  
                  return (
                    <div key={modelId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(model.status)} mr-2`}></div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{model.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{stats.count} use{stats.count !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        
        {/* Collapsible grid of models */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {sortedModels.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={selectedModel === model.id}
                isSuggested={suggestedModelId === model.id}
                disabled={!model.loaded || disabled}
                onSelect={handleModelSelect}
                onShowDetails={showDetails}
              />
            ))}
          </div>
        </div>
      </>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Select LLM for Analysis</h2>
        <button 
          onClick={toggleCollapse}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand model selector" : "Collapse model selector"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {content}
      
      {/* Model details modal */}
      {showModelDetails && selectedModelDetails && (
        <Suspense fallback={<div className="animate-pulse">Loading details...</div>}>
          <ModelDetailsModal
            model={selectedModelDetails}
            isOpen={showModelDetails}
            onClose={() => setShowModelDetails(false)}
            onSelectModel={handleModelSelect}
            isSelected={selectedModel === selectedModelDetails.id}
            onUpdateSettings={handleUpdateModelSettings}
          />
        </Suspense>
      )}
    </div>
  );
};

export default LLMSelector;