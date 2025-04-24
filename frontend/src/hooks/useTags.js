// src/hooks/useTags.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Custom hook for managing tags with backend support
 * Falls back to localStorage if backend is unavailable
 * 
 * @param {string} analysisId - Optional analysis ID to manage tags for a specific analysis
 * @returns {Object} Tag management methods and state
 */
const useTags = (analysisId = null) => {
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // API endpoint
  const API_URL = process.env.REACT_APP_API_URL || '';
  const TAGS_ENDPOINT = `${API_URL}/api/tags`;
  
  // Check if we're in online mode with backend available
  const [isOnlineMode, setIsOnlineMode] = useState(true);
  
  // Helper to get auth token - implement based on your auth system
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);
  
  // Check if backend is available
  const checkBackendAvailability = useCallback(async () => {
    try {
      await axios.get(`${API_URL}/health`);
      setIsOnlineMode(true);
      return true;
    } catch (err) {
      console.warn('Backend unavailable, falling back to localStorage');
      setIsOnlineMode(false);
      return false;
    }
  }, [API_URL]);
  
  // Fetch all available tags
  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if backend is available
      const isBackendAvailable = await checkBackendAvailability();
      
      if (isBackendAvailable) {
        // Fetch from API
        const response = await axios.get(TAGS_ENDPOINT, { 
          headers: getAuthHeaders() 
        });
        
        setTags(response.data);
        
        // If analysisId is provided, fetch tags for this analysis
        if (analysisId) {
          const analysisTagsResponse = await axios.get(
            `${TAGS_ENDPOINT}/analysis/${analysisId}`,
            { headers: getAuthHeaders() }
          );
          
          // API returns full tag objects, so extract tag IDs
          const tagIds = analysisTagsResponse.data.map(tag => tag.id);
          setSelectedTags(tagIds);
        }
      } else {
        // Fallback to localStorage
        const storedTags = localStorage.getItem('tags');
        if (storedTags) {
          setTags(JSON.parse(storedTags));
        } else {
          // Initial default tags
          const defaultTags = [
            { id: 1, name: 'Bug', color: '#ef4444' },
            { id: 2, name: 'Performance', color: '#f59e0b' },
            { id: 3, name: 'Security', color: '#10b981' },
            { id: 4, name: 'High Priority', color: '#6366f1' },
            { id: 5, name: 'Resolved', color: '#1d4ed8' }
          ];
          setTags(defaultTags);
          localStorage.setItem('tags', JSON.stringify(defaultTags));
        }
        
        // If analysisId is provided, fetch tags for this analysis from localStorage
        if (analysisId) {
          const storedAnalysisTags = localStorage.getItem(`analysis_tags_${analysisId}`);
          if (storedAnalysisTags) {
            setSelectedTags(JSON.parse(storedAnalysisTags));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      setError('Failed to load tags');
      
      // Fall back to localStorage on error
      const storedTags = localStorage.getItem('tags');
      if (storedTags) {
        setTags(JSON.parse(storedTags));
      }
      
      if (analysisId) {
        const storedAnalysisTags = localStorage.getItem(`analysis_tags_${analysisId}`);
        if (storedAnalysisTags) {
          setSelectedTags(JSON.parse(storedAnalysisTags));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [analysisId, TAGS_ENDPOINT, getAuthHeaders, checkBackendAvailability]);
  
  // Add a new tag
  const addTag = useCallback(async (tagData) => {
    try {
      setError(null);
      
      if (isOnlineMode) {
        // Create tag via API
        const response = await axios.post(
          TAGS_ENDPOINT, 
          tagData,
          { headers: getAuthHeaders() }
        );
        
        const newTag = response.data;
        setTags(prevTags => [...prevTags, newTag]);
        
        return newTag;
      } else {
        // Create tag in localStorage
        const newTag = {
          id: Math.max(0, ...tags.map(t => t.id)) + 1, // Generate next ID
          name: tagData.name,
          color: tagData.color || '#3b82f6'
        };
        
        const updatedTags = [...tags, newTag];
        setTags(updatedTags);
        localStorage.setItem('tags', JSON.stringify(updatedTags));
        
        return newTag;
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
      setError('Failed to add tag');
      return null;
    }
  }, [isOnlineMode, TAGS_ENDPOINT, getAuthHeaders, tags]);
  
  // Delete a tag
  const deleteTag = useCallback(async (tagId) => {
    try {
      setError(null);
      
      if (isOnlineMode) {
        // Delete via API
        await axios.delete(
          `${TAGS_ENDPOINT}/${tagId}`,
          { headers: getAuthHeaders() }
        );
      } else {
        // Delete in localStorage
        // Remove from all analyses that use this tag
        const storedKeys = Object.keys(localStorage);
        for (const key of storedKeys) {
          if (key.startsWith('analysis_tags_')) {
            const analysisTags = JSON.parse(localStorage.getItem(key));
            const updatedAnalysisTags = analysisTags.filter(id => id !== tagId);
            localStorage.setItem(key, JSON.stringify(updatedAnalysisTags));
          }
        }
      }
      
      // Update tags list
      const updatedTags = tags.filter(tag => tag.id !== tagId);
      setTags(updatedTags);
      
      if (!isOnlineMode) {
        localStorage.setItem('tags', JSON.stringify(updatedTags));
      }
      
      // Update selected tags if necessary
      if (selectedTags.includes(tagId)) {
        const updatedSelectedTags = selectedTags.filter(id => id !== tagId);
        setSelectedTags(updatedSelectedTags);
        
        if (analysisId && !isOnlineMode) {
          localStorage.setItem(`analysis_tags_${analysisId}`, JSON.stringify(updatedSelectedTags));
        }
      }
      
      return true;
    } catch (err) {
      console.error('Failed to delete tag:', err);
      setError('Failed to delete tag');
      return false;
    }
  }, [isOnlineMode, TAGS_ENDPOINT, getAuthHeaders, tags, selectedTags, analysisId]);
  
  // Update a tag
  const updateTag = useCallback(async (tagId, tagData) => {
    try {
      setError(null);
      
      if (isOnlineMode) {
        // Update via API
        const response = await axios.put(
          `${TAGS_ENDPOINT}/${tagId}`,
          tagData,
          { headers: getAuthHeaders() }
        );
        
        const updatedTag = response.data;
        setTags(prevTags => 
          prevTags.map(tag => tag.id === tagId ? updatedTag : tag)
        );
      } else {
        // Update in localStorage
        const updatedTags = tags.map(tag => 
          tag.id === tagId 
            ? { ...tag, name: tagData.name || tag.name, color: tagData.color || tag.color }
            : tag
        );
        
        setTags(updatedTags);
        localStorage.setItem('tags', JSON.stringify(updatedTags));
      }
      
      return true;
    } catch (err) {
      console.error('Failed to update tag:', err);
      setError('Failed to update tag');
      return false;
    }
  }, [isOnlineMode, TAGS_ENDPOINT, getAuthHeaders, tags]);
  
  // Toggle a tag for the current analysis
  const toggleTag = useCallback(async (tagId) => {
    try {
      setError(null);
      
      if (!analysisId) {
        console.warn('No analysis ID provided for tag toggle');
        return false;
      }
      
      let updatedSelectedTags;
      
      if (selectedTags.includes(tagId)) {
        // Remove tag
        updatedSelectedTags = selectedTags.filter(id => id !== tagId);
        
        if (isOnlineMode) {
          // Remove via API
          await axios.delete(
            `${TAGS_ENDPOINT}/analysis/${analysisId}/${tagId}`,
            { headers: getAuthHeaders() }
          );
        }
      } else {
        // Add tag
        updatedSelectedTags = [...selectedTags, tagId];
        
        if (isOnlineMode) {
          // Add via API
          await axios.post(
            `${TAGS_ENDPOINT}/analysis/${analysisId}`,
            { tag_id: tagId },
            { headers: getAuthHeaders() }
          );
        }
      }
      
      setSelectedTags(updatedSelectedTags);
      
      if (!isOnlineMode) {
        localStorage.setItem(`analysis_tags_${analysisId}`, JSON.stringify(updatedSelectedTags));
      }
      
      return true;
    } catch (err) {
      console.error('Failed to toggle tag:', err);
      setError('Failed to toggle tag');
      return false;
    }
  }, [analysisId, selectedTags, isOnlineMode, TAGS_ENDPOINT, getAuthHeaders]);
  
  // Search analyses by tags
  const searchByTags = useCallback(async (tagIds) => {
    try {
      setError(null);
      
      if (isOnlineMode) {
        // Search via API
        const response = await axios.get(
          `${TAGS_ENDPOINT}/search?tag_ids=${tagIds.join(',')}`,
          { headers: getAuthHeaders() }
        );
        
        return response.data;
      } else {
        // Search in localStorage
        const analyses = [];
        const storedKeys = Object.keys(localStorage);
        
        for (const key of storedKeys) {
          if (key.startsWith('analysis_tags_')) {
            const analysisId = key.replace('analysis_tags_', '');
            const analysisTags = JSON.parse(localStorage.getItem(key));
            
            // Check if analysis has all the requested tags
            const hasAllTags = tagIds.every(id => analysisTags.includes(id));
            
            if (hasAllTags) {
              analyses.push(analysisId);
            }
          }
        }
        
        return analyses;
      }
    } catch (err) {
      console.error('Failed to search by tags:', err);
      setError('Failed to search by tags');
      return [];
    }
  }, [isOnlineMode, TAGS_ENDPOINT, getAuthHeaders]);
  
  // Load tags on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);
  
  // Get selected tag objects
  const getSelectedTagObjects = useCallback(() => {
    return tags.filter(tag => selectedTags.includes(tag.id));
  }, [tags, selectedTags]);
  
  return {
    tags,
    selectedTags,
    selectedTagObjects: getSelectedTagObjects(),
    loading,
    error,
    isOnlineMode,
    addTag,
    deleteTag,
    updateTag,
    toggleTag,
    searchByTags,
    fetchTags
  };
};

export default useTags;