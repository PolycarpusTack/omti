// src/hooks/useModelSuggestion.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000'; // Update with your actual API URL

/**
 * Hook for suggesting the best LLM model based on log content and history
 * 
 * @param {Object} options Configuration options
 * @param {Array} options.availableModels List of available models
 * @param {string} options.logContent Current log content to analyze
 * @param {string} options.logType Type of log (error, info, debug, etc.)
 * @param {number} options.contentLength Length of the content
 * @param {boolean} options.includeStackTraces Whether the content includes stack traces
 * @param {Object} options.userPreferences User preferences for models
 * @returns {Object} Suggestion data and functions
 */
const useModelSuggestion = ({
  availableModels = [],
  logContent = '',
  logType = 'unknown',
  contentLength = 0,
  includeStackTraces = false,
  userPreferences = {}
}) => {
  const [suggestedModel, setSuggestedModel] = useState(null);
  const [suggestionReason, setSuggestionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedModels, setSuggestedModels] = useState([]);
  
  // Generate suggestion locally based on content characteristics
  const generateLocalSuggestion = useCallback(() => {
    if (!availableModels || availableModels.length === 0) {
      setSuggestedModel(null);
      setSuggestionReason('No models available');
      return;
    }

    // Get only healthy and loaded models
    const healthyModels = availableModels.filter(
      model => model.loaded && model.status === 'healthy'
    );
    
    if (healthyModels.length === 0) {
      setSuggestedModel(null);
      setSuggestionReason('No healthy models available');
      return;
    }
    
    let suggestion = null;
    let reason = '';
    let rankedModels = [...healthyModels];
    
    // Determine content complexity
    const hasCodeSnippets = /```[\s\S]*?```/.test(logContent) || 
                           /(function|class|def|public|private|protected)/.test(logContent);
    const hasJsonData = /{[\s\S]*?}/.test(logContent) && 
                       /("[\w]+":|'[\w]+':)/.test(logContent);
    const hasErrorMessages = /(error|exception|failed|failure)/i.test(logContent);
    const isLongContent = contentLength > 2000;
    
    // Rank models based on content characteristics
    rankedModels.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;
      
      // Code analysis specialization
      if (hasCodeSnippets && a.specialization === 'Code analysis') aScore += 3;
      if (hasCodeSnippets && b.specialization === 'Code analysis') bScore += 3;
      
      // Technical depth for complex errors
      if (hasErrorMessages && includeStackTraces && a.specialization === 'Technical depth') aScore += 2;
      if (hasErrorMessages && includeStackTraces && b.specialization === 'Technical depth') bScore += 2;
      
      // Deep analysis for complicated logs
      if ((isLongContent || hasJsonData) && a.specialization === 'Deep analysis') aScore += 2;
      if ((isLongContent || hasJsonData) && b.specialization === 'Deep analysis') bScore += 2;
      
      // Fast analysis for simpler logs
      if (!isLongContent && !includeStackTraces && a.specialization === 'Fast analysis') aScore += 1;
      if (!isLongContent && !includeStackTraces && b.specialization === 'Fast analysis') bScore += 1;
      
      // Premium insights as a tiebreaker for important analysis
      if (a.specialization === 'Premium insights') aScore += 0.5;
      if (b.specialization === 'Premium insights') bScore += 0.5;
      
      // Consider user preferences if available
      if (userPreferences && userPreferences.preferredModels) {
        if (userPreferences.preferredModels.includes(a.id)) aScore += 1;
        if (userPreferences.preferredModels.includes(b.id)) bScore += 1;
      }
      
      return bScore - aScore;
    });
    
    // Set the suggested model and provide the top 3 for alternatives
    suggestion = rankedModels[0];
    
    // Generate human-readable reason for the suggestion
    if (suggestion) {
      if (hasCodeSnippets && suggestion.specialization === 'Code analysis') {
        reason = 'Suggested for code snippet analysis';
      } else if (hasErrorMessages && includeStackTraces && suggestion.specialization === 'Technical depth') {
        reason = 'Suggested for detailed error analysis with stack traces';
      } else if (isLongContent && suggestion.specialization === 'Deep analysis') {
        reason = 'Suggested for processing longer content';
      } else if (!isLongContent && suggestion.specialization === 'Fast analysis') {
        reason = 'Suggested for quick analysis of shorter content';
      } else if (suggestion.specialization === 'Premium insights') {
        reason = 'Suggested for highest quality analysis';
      } else {
        reason = 'General recommendation based on content';
      }
    }
    
    setSuggestedModel(suggestion);
    setSuggestionReason(reason);
    setSuggestedModels(rankedModels.slice(0, 3)); // Top 3 suggestions
  }, [availableModels, logContent, contentLength, includeStackTraces, userPreferences]);
  
  // Request suggestion from the backend API
  const fetchSuggestionFromApi = useCallback(async () => {
    if (!logContent || !availableModels || availableModels.length === 0) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Prepare content sample (first 1000 chars to keep request light)
      const contentSample = logContent.substring(0, 1000);
      
      const response = await axios.post(`${API_URL}/api/suggestion/model`, {
        contentSample,
        logType,
        contentLength,
        includeStackTraces,
        availableModelIds: availableModels.map(m => m.id)
      });
      
      if (response.data && response.data.suggestedModelId) {
        const model = availableModels.find(m => m.id === response.data.suggestedModelId);
        if (model) {
          setSuggestedModel(model);
          setSuggestionReason(response.data.reason || 'Suggested by analysis history');
          
          // Set ordered suggestions if available
          if (response.data.rankedSuggestions && response.data.rankedSuggestions.length > 0) {
            const ranked = response.data.rankedSuggestions
              .map(id => availableModels.find(m => m.id === id))
              .filter(m => m != null);
            setSuggestedModels(ranked);
          }
        }
      } else {
        // Fallback to local suggestion if API doesn't return a valid model
        generateLocalSuggestion();
      }
    } catch (err) {
      console.error('Error fetching model suggestion:', err);
      setError(err.message || 'Failed to get model suggestion');
      // Fallback to local suggestion on API error
      generateLocalSuggestion();
    } finally {
      setIsLoading(false);
    }
  }, [availableModels, logContent, logType, contentLength, includeStackTraces, generateLocalSuggestion]);
  
  // Effect to generate suggestions when inputs change
  useEffect(() => {
    // Try the API suggestion first
    fetchSuggestionFromApi().catch(() => {
      // If that fails, fall back to local suggestion
      generateLocalSuggestion();
    });
  }, [fetchSuggestionFromApi, generateLocalSuggestion]);
  
  // Record selection feedback for learning
  const recordSelectionFeedback = useCallback(async (selectedModelId, wasSuggestionAccepted) => {
    try {
      await axios.post(`${API_URL}/api/suggestion/feedback`, {
        suggestedModelId: suggestedModel?.id,
        selectedModelId,
        contentLength,
        logType,
        includeStackTraces,
        wasSuggestionAccepted
      });
      console.log('Recorded model selection feedback');
    } catch (err) {
      console.error('Failed to record selection feedback:', err);
    }
  }, [suggestedModel, contentLength, logType, includeStackTraces]);
  
  return {
    suggestedModel,
    suggestionReason,
    isLoading,
    error,
    suggestedModels,
    generateLocalSuggestion,
    fetchSuggestionFromApi,
    recordSelectionFeedback
  };
};

export default useModelSuggestion;