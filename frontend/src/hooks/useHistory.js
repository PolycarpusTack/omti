// src/hooks/useHistory.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Enhanced history hook for managing analysis history with
 * timeline view and cloud synchronization support
 * 
 * @param {Object} options Configuration options
 * @param {boolean} options.useCloud Whether to use cloud storage
 * @param {string} options.userId User ID for cloud storage
 * @returns {Object} History data and functions
 */
const useHistory = ({ useCloud = false, userId = null } = {}) => {
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timelineGroups, setTimelineGroups] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSync: null });
  
  const API_URL = 'http://localhost:8000'; // Update with your actual API URL
  
  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let historyData = [];
        
        // Try to load from cloud if enabled
        if (useCloud && userId) {
          try {
            const response = await axios.get(`${API_URL}/api/history/${userId}`);
            if (response.data && response.data.success && response.data.history) {
              historyData = response.data.history;
              console.log('Loaded history from cloud:', historyData);
              setSyncStatus({
                syncing: false,
                lastSync: new Date(),
                source: 'cloud'
              });
            }
          } catch (cloudError) {
            console.warn('Failed to load from cloud, falling back to local:', cloudError);
            // Fall back to local storage
            const savedHistory = localStorage.getItem('analysisHistory');
            if (savedHistory) {
              historyData = JSON.parse(savedHistory);
              setSyncStatus({
                syncing: false,
                lastSync: null,
                source: 'local'
              });
            }
          }
        } else {
          // Load from local storage
          const savedHistory = localStorage.getItem('analysisHistory');
          if (savedHistory) {
            historyData = JSON.parse(savedHistory);
            setSyncStatus({
              syncing: false,
              lastSync: null,
              source: 'local'
            });
          }
        }
        
        setAnalysisHistory(historyData);
        
        // Generate timeline groups after loading history
        generateTimelineGroups(historyData);
      } catch (err) {
        console.error('Failed to load history:', err);
        setError(err.message || 'Failed to load analysis history');
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [useCloud, userId]);
  
  // Generate timeline groups from history items
  const generateTimelineGroups = useCallback((items) => {
    if (!items || items.length === 0) {
      setTimelineGroups([]);
      return;
    }
    
    // Group items by date
    const groups = items.reduce((acc, item) => {
      const date = new Date(item.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          formattedDate: new Date(dateKey).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          items: []
        };
      }
      
      acc[dateKey].items.push(item);
      return acc;
    }, {});
    
    // Convert to array and sort by date (most recent first)
    const groupsArray = Object.values(groups).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    // For each group, sort items by timestamp (most recent first)
    groupsArray.forEach(group => {
      group.items.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    });
    
    setTimelineGroups(groupsArray);
  }, []);
  
  // Save analysis to history with enhanced metadata
  const saveToHistory = useCallback(async (analysis, options = {}) => {
    try {
      const {
        filename = 'Analysis Result',
        analysisType = 'original',
        tags = [],
        modelId = null,
        successRating = null,
        logType = 'unknown',
        contentLength = 0
      } = options;
      
      const timestamp = new Date().toISOString();
      const historyItem = {
        timestamp,
        filename,
        analysisType,
        tags,
        modelId,
        successRating,
        logType,
        contentLength
      };
      
      // Save full analysis content
      localStorage.setItem(`analysis_${timestamp}`, JSON.stringify(analysis));
      
      // Update history list
      const updatedHistory = [
        historyItem,
        ...analysisHistory
      ].slice(0, 50); // Keep the 50 most recent entries
      
      localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      setAnalysisHistory(updatedHistory);
      
      // Generate updated timeline groups
      generateTimelineGroups(updatedHistory);
      
      // Sync to cloud if enabled
      if (useCloud && userId) {
        try {
          setSyncStatus({ syncing: true, lastSync: syncStatus.lastSync });
          
          await axios.post(`${API_URL}/api/history/${userId}`, {
            item: historyItem,
            content: analysis
          });
          
          setSyncStatus({
            syncing: false,
            lastSync: new Date(),
            source: 'cloud'
          });
          
          console.log('Synced history item to cloud');
        } catch (cloudError) {
          console.error('Failed to sync with cloud:', cloudError);
          setSyncStatus({
            syncing: false,
            lastSync: syncStatus.lastSync,
            error: cloudError.message,
            source: 'local'
          });
        }
      }
      
      return timestamp;
    } catch (err) {
      console.error('Failed to save to history:', err);
      return null;
    }
  }, [analysisHistory, generateTimelineGroups, syncStatus, useCloud, userId]);
  
  // Load analysis from history
  const loadFromHistory = useCallback(async (historyItem) => {
    try {
      // Try local storage first
      const savedAnalysis = localStorage.getItem(`analysis_${historyItem.timestamp}`);
      
      if (savedAnalysis) {
        return JSON.parse(savedAnalysis);
      }
      
      // If not in local storage and cloud is enabled, try to fetch from cloud
      if (useCloud && userId) {
        try {
          const response = await axios.get(
            `${API_URL}/api/history/${userId}/analysis/${historyItem.timestamp}`
          );
          
          if (response.data && response.data.success && response.data.content) {
            // Cache the result in local storage
            localStorage.setItem(
              `analysis_${historyItem.timestamp}`, 
              JSON.stringify(response.data.content)
            );
            
            return response.data.content;
          }
        } catch (cloudError) {
          console.error('Failed to load from cloud:', cloudError);
        }
      }
      
      return null;
    } catch (err) {
      console.error('Failed to load from history:', err);
      return null;
    }
  }, [useCloud, userId]);
  
  // Update a history item's metadata
  const updateHistoryItem = useCallback(async (timestamp, updates) => {
    try {
      // Find the item
      const itemIndex = analysisHistory.findIndex(item => item.timestamp === timestamp);
      
      if (itemIndex === -1) {
        return false;
      }
      
      // Update the item
      const updatedHistory = [...analysisHistory];
      updatedHistory[itemIndex] = {
        ...updatedHistory[itemIndex],
        ...updates,
        // These fields should not be modified
        timestamp: updatedHistory[itemIndex].timestamp
      };
      
      localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      setAnalysisHistory(updatedHistory);
      
      // Update timeline groups
      generateTimelineGroups(updatedHistory);
      
      // Sync changes to cloud if enabled
      if (useCloud && userId) {
        try {
          setSyncStatus({ syncing: true, lastSync: syncStatus.lastSync });
          
          await axios.put(`${API_URL}/api/history/${userId}/item/${timestamp}`, {
            updates
          });
          
          setSyncStatus({
            syncing: false,
            lastSync: new Date(),
            source: 'cloud'
          });
        } catch (cloudError) {
          console.error('Failed to sync update with cloud:', cloudError);
          setSyncStatus({
            syncing: false,
            lastSync: syncStatus.lastSync,
            error: cloudError.message,
            source: 'local'
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Failed to update history item:', err);
      return false;
    }
  }, [analysisHistory, generateTimelineGroups, syncStatus, useCloud, userId]);
  
  // Delete a history item
  const deleteHistoryItem = useCallback(async (timestamp) => {
    try {
      // Remove the item from the history
      const updatedHistory = analysisHistory.filter(item => item.timestamp !== timestamp);
      
      localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
      localStorage.removeItem(`analysis_${timestamp}`);
      
      setAnalysisHistory(updatedHistory);
      
      // Update timeline groups
      generateTimelineGroups(updatedHistory);
      
      // Sync deletion to cloud if enabled
      if (useCloud && userId) {
        try {
          setSyncStatus({ syncing: true, lastSync: syncStatus.lastSync });
          
          await axios.delete(`${API_URL}/api/history/${userId}/item/${timestamp}`);
          
          setSyncStatus({
            syncing: false,
            lastSync: new Date(),
            source: 'cloud'
          });
        } catch (cloudError) {
          console.error('Failed to sync deletion with cloud:', cloudError);
          setSyncStatus({
            syncing: false,
            lastSync: syncStatus.lastSync,
            error: cloudError.message,
            source: 'local'
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Failed to delete history item:', err);
      return false;
    }
  }, [analysisHistory, generateTimelineGroups, syncStatus, useCloud, userId]);
  
  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      // Get all history items first
      const historyItems = [...analysisHistory];
      
      // Remove all saved analyses
      historyItems.forEach(item => {
        localStorage.removeItem(`analysis_${item.timestamp}`);
      });
      
      // Remove history list
      localStorage.removeItem('analysisHistory');
      setAnalysisHistory([]);
      setTimelineGroups([]);
      
      // Sync clear to cloud if enabled
      if (useCloud && userId) {
        try {
          setSyncStatus({ syncing: true, lastSync: syncStatus.lastSync });
          
          await axios.delete(`${API_URL}/api/history/${userId}/all`);
          
          setSyncStatus({
            syncing: false,
            lastSync: new Date(),
            source: 'cloud'
          });
        } catch (cloudError) {
          console.error('Failed to sync clear with cloud:', cloudError);
          setSyncStatus({
            syncing: false,
            lastSync: syncStatus.lastSync,
            error: cloudError.message,
            source: 'local'
          });
        }
      }
      
      return true;
    } catch (err) {
      console.error('Failed to clear history:', err);
      return false;
    }
  }, [analysisHistory, syncStatus, useCloud, userId]);
  
  // Force a sync with the cloud
  const syncWithCloud = useCallback(async () => {
    if (!useCloud || !userId) {
      return { success: false, message: 'Cloud sync is not enabled' };
    }
    
    try {
      setSyncStatus({ syncing: true, lastSync: syncStatus.lastSync });
      
      // Get cloud history first
      const response = await axios.get(`${API_URL}/api/history/${userId}`);
      
      if (!response.data || !response.data.success) {
        throw new Error('Failed to fetch cloud history');
      }
      
      const cloudHistory = response.data.history || [];
      const localHistory = [...analysisHistory];
      
      // Merge histories, preferring the most recent version of each item
      const mergedHistory = {};
      
      // Add all cloud items to merged history
      cloudHistory.forEach(item => {
        mergedHistory[item.timestamp] = item;
      });
      
      // Add local items, overwriting cloud items if local is more recent
      localHistory.forEach(item => {
        if (!mergedHistory[item.timestamp] || 
            new Date(item.updatedAt || item.timestamp) > 
            new Date(mergedHistory[item.timestamp].updatedAt || mergedHistory[item.timestamp].timestamp)) {
          mergedHistory[item.timestamp] = item;
        }
      });
      
      // Convert to array and sort by timestamp (most recent first)
      const sortedHistory = Object.values(mergedHistory).sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Update local storage
      localStorage.setItem('analysisHistory', JSON.stringify(sortedHistory));
      setAnalysisHistory(sortedHistory);
      
      // Update timeline groups
      generateTimelineGroups(sortedHistory);
      
      // Push merged history back to cloud
      await axios.put(`${API_URL}/api/history/${userId}/sync`, {
        history: sortedHistory
      });
      
      setSyncStatus({
        syncing: false,
        lastSync: new Date(),
        source: 'both'
      });
      
      return { success: true, message: 'Synchronized successfully' };
    } catch (err) {
      console.error('Failed to sync with cloud:', err);
      
      setSyncStatus({
        syncing: false,
        lastSync: syncStatus.lastSync,
        error: err.message,
        source: 'local'
      });
      
      return { success: false, message: err.message };
    }
  }, [analysisHistory, generateTimelineGroups, syncStatus, useCloud, userId]);
  
  // Filter history by various criteria
  const filterHistory = useCallback((filters = {}) => {
    const {
      searchTerm = '',
      dateRange = null,
      modelIds = [],
      analysisTypes = [],
      tags = [],
      successRatingMin = null
    } = filters;
    
    return analysisHistory.filter(item => {
      // Search term filter (filename or tags)
      if (searchTerm && 
         !(item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))))) {
        return false;
      }
      
      // Date range filter
      if (dateRange && dateRange.start && dateRange.end) {
        const itemDate = new Date(item.timestamp);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        
        if (itemDate < startDate || itemDate > endDate) {
          return false;
        }
      }
      
      // Model filter
      if (modelIds && modelIds.length > 0 && item.modelId) {
        if (!modelIds.includes(item.modelId)) {
          return false;
        }
      }
      
      // Analysis type filter
      if (analysisTypes && analysisTypes.length > 0) {
        if (!analysisTypes.includes(item.analysisType)) {
          return false;
        }
      }
      
      // Tags filter
      if (tags && tags.length > 0 && item.tags) {
        if (!tags.some(tag => item.tags.includes(tag))) {
          return false;
        }
      }
      
      // Success rating filter
      if (successRatingMin !== null && item.successRating !== null) {
        if (item.successRating < successRatingMin) {
          return false;
        }
      }
      
      return true;
    });
  }, [analysisHistory]);
  
  // Generate filtered timeline groups
  const getFilteredTimelineGroups = useCallback((filters = {}) => {
    const filteredItems = filterHistory(filters);
    
    // Use the same grouping logic as generateTimelineGroups
    if (!filteredItems || filteredItems.length === 0) {
      return [];
    }
    
    // Group items by date
    const groups = filteredItems.reduce((acc, item) => {
      const date = new Date(item.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          formattedDate: new Date(dateKey).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          items: []
        };
      }
      
      acc[dateKey].items.push(item);
      return acc;
    }, {});
    
    // Convert to array and sort by date (most recent first)
    const groupsArray = Object.values(groups).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    // For each group, sort items by timestamp (most recent first)
    groupsArray.forEach(group => {
      group.items.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
    });
    
    return groupsArray;
  }, [filterHistory]);
  
  return {
    analysisHistory,
    saveToHistory,
    loadFromHistory,
    updateHistoryItem,
    deleteHistoryItem,
    clearHistory,
    syncWithCloud,
    filterHistory,
    timelineGroups,
    getFilteredTimelineGroups,
    loading,
    error,
    syncStatus
  };
};