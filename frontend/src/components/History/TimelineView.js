// src/components/History/TimelineView.js
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

/**
 * Timeline view component for displaying analysis history
 * Organizes analyses by date with filtering capabilities
 * 
 * @param {Object} props
 * @param {Array} props.timelineGroups - Groups of history items by date
 * @param {Function} props.onItemSelect - Function to call when an item is selected
 * @param {Function} props.onItemDelete - Function to call when an item is deleted
 * @param {Function} props.onFilter - Function to call when filters are applied
 * @param {Object} props.filters - Current active filters
 * @param {boolean} props.loading - Whether the timeline is loading
 * @param {Object} props.syncStatus - Synchronization status information
 */
const TimelineView = ({
  timelineGroups = [],
  onItemSelect,
  onItemDelete,
  onFilter,
  filters = {},
  loading = false,
  syncStatus = {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    modelIds: [],
    analysisTypes: [],
    tags: [],
    dateRange: {
      start: null,
      end: null
    },
    successRatingMin: null
  });
  
  // Initialize filter options from the current groups
  useEffect(() => {
    if (timelineGroups.length > 0) {
      const models = new Set();
      const types = new Set();
      const allTags = new Set();
      
      timelineGroups.forEach(group => {
        group.items.forEach(item => {
          if (item.modelId) models.add(item.modelId);
          if (item.analysisType) types.add(item.analysisType);
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => allTags.add(tag));
          }
        });
      });
      
      setFilterOptions(prev => ({
        ...prev,
        modelIds: Array.from(models),
        analysisTypes: Array.from(types),
        tags: Array.from(allTags)
      }));
    }
  }, [timelineGroups]);
  
  // Apply search filter
  const handleSearch = () => {
    if (onFilter) {
      onFilter({
        ...filters,
        searchTerm
      });
    }
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilterOptions({
      ...filterOptions,
      dateRange: {
        start: null,
        end: null
      },
      successRatingMin: null
    });
    
    if (onFilter) {
      onFilter({});
    }
  };
  
  // Apply all filters
  const applyFilters = () => {
    if (onFilter) {
      onFilter({
        searchTerm,
        ...filterOptions
      });
    }
    
    setIsFilterOpen(false);
  };
  
  // Handle date range selection
  const handleDateRangeChange = (type, value) => {
    setFilterOptions({
      ...filterOptions,
      dateRange: {
        ...filterOptions.dateRange,
        [type]: value
      }
    });
  };
  
  // Toggle selection of a filter option
  const toggleFilterOption = (type, value) => {
    const currentValues = [...filterOptions[type]];
    const index = currentValues.indexOf(value);
    
    if (index === -1) {
      // Add the value
      setFilterOptions({
        ...filterOptions,
        [type]: [...currentValues, value]
      });
    } else {
      // Remove the value
      currentValues.splice(index, 1);
      setFilterOptions({
        ...filterOptions,
        [type]: currentValues
      });
    }
  };
  
  // Get appropriate tag color based on analysis type
  const getTagColor = (analysisType) => {
    switch(analysisType) {
      case 'original':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'follow-up':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'comparison':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'summary':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'custom':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  // Get model provider badge color
  const getProviderColor = (modelId) => {
    if (!modelId) return '';
    
    const modelIdLower = modelId.toLowerCase();
    
    if (modelIdLower.includes('gpt')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (modelIdLower.includes('claude')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    } else if (modelIdLower.includes('llama') || modelIdLower.includes('mistral')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    } else {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  // Format model name for display
  const formatModelName = (modelId) => {
    if (!modelId) return 'Unknown Model';
    
    // Extract a readable name from the model ID
    const modelIdLower = modelId.toLowerCase();
    
    if (modelIdLower.includes('gpt-4')) {
      return 'GPT-4';
    } else if (modelIdLower.includes('gpt-3.5')) {
      return 'GPT-3.5';
    } else if (modelIdLower.includes('claude')) {
      return modelId.replace('claude-', 'Claude ').toUpperCase();
    } else if (modelIdLower.includes('llama')) {
      // Format like "Llama-2 7B" from "llama-2:7b"
      return modelId.split(':').join(' ').replace(/^(\w)/, m => m.toUpperCase());
    } else {
      // Generic formatting: capitalize first letter and replace hyphens with spaces
      return modelId.replace(/^(\w)/, m => m.toUpperCase()).replace(/-/g, ' ');
    }
  };
  
  // Format date for display
  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return format(date, 'h:mm a');
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading history...</span>
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!timelineGroups || timelineGroups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <svg 
            className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Analysis History
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your analysis history will appear here once you've performed some analyses.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      {/* Header with title and sync status */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Analysis History
        </h2>
        
        {/* Sync status indicator */}
        {syncStatus && (
          <div className="flex items-center text-sm">
            {syncStatus.syncing ? (
              <span className="flex items-center text-blue-600 dark:text-blue-400">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </span>
            ) : syncStatus.lastSync ? (
              <span className="text-green-600 dark:text-green-400 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                {`Synced: ${format(new Date(syncStatus.lastSync), 'MMM d, h:mm a')}`}
              </span>
            ) : syncStatus.error ? (
              <span className="text-red-600 dark:text-red-400 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                </svg>
                Sync Error
              </span>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Search and filter bar */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              placeholder="Search by filename or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={handleSearch}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
          </div>
          
          <div className="flex space-x-2">
            <button
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 hover:dark:bg-blue-800 flex items-center"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
              </svg>
              Filter
            </button>
            
            {(searchTerm || 
              filterOptions.modelIds.length > 0 || 
              filterOptions.analysisTypes.length > 0 || 
              filterOptions.tags.length > 0 || 
              filterOptions.dateRange.start || 
              filterOptions.dateRange.end || 
              filterOptions.successRatingMin) && (
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:dark:bg-gray-600"
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        
        {/* Filter panel (collapsible) */}
        {isFilterOpen && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date range filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</h3>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      value={filterOptions.dateRange.start || ''}
                      onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      value={filterOptions.dateRange.end || ''}
                      onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              {/* Model filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Models</h3>
                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {filterOptions.modelIds.map(modelId => (
                    <div key={modelId} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`model-${modelId}`}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                        checked={filterOptions.modelIds.includes(modelId)}
                        onChange={() => toggleFilterOption('modelIds', modelId)}
                      />
                      <label htmlFor={`model-${modelId}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {formatModelName(modelId)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Analysis type filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis Types</h3>
                <div className="space-y-1">
                  {filterOptions.analysisTypes.map(type => (
                    <div key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`type-${type}`}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                        checked={filterOptions.analysisTypes.includes(type)}
                        onChange={() => toggleFilterOption('analysisTypes', type)}
                      />
                      <label htmlFor={`type-${type}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Tags filter */}
            {filterOptions.tags.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.tags.map(tag => (
                    <button
                      key={tag}
                      className={`px-2 py-1 text-xs rounded-full ${
                        filters.tags && filters.tags.includes(tag)
                          ? 'bg-blue-500 text-white dark:bg-blue-600'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                      onClick={() => toggleFilterOption('tags', tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                onClick={applyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Timeline */}
      <div className="space-y-8">
        {timelineGroups.map((group) => (
          <div key={group.date} className="relative">
            {/* Date header */}
            <div className="flex items-center mb-4">
              <div className="h-px flex-grow bg-gray-200 dark:bg-gray-700"></div>
              <button
                className={`flex-shrink-0 px-4 py-1 rounded-full text-sm font-medium ${
                  selectedDate === group.date
                    ? 'bg-blue-500 text-white dark:bg-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
                onClick={() => setSelectedDate(selectedDate === group.date ? null : group.date)}
              >
                {group.formattedDate}
              </button>
              <div className="h-px flex-grow bg-gray-200 dark:bg-gray-700"></div>
            </div>
            
            {/* Timeline items */}
            <div className="ml-4 space-y-4">
              {group.items.map((item) => (
                <div
                  key={item.timestamp}
                  className="relative pl-6 pb-4 border-l-2 border-gray-200 dark:border-gray-700 last:border-transparent"
                >
                  {/* Time dot */}
                  <div className="absolute -left-2.5 mt-1.5 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                  </div>
                  
                  {/* Item card */}
                  <div className="bg-white dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-md font-medium text-gray-900 dark:text-gray-100">
                        {item.filename}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(item.timestamp)}
                      </span>
                    </div>
                    
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {/* Analysis type tag */}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTagColor(item.analysisType)}`}>
                        {item.analysisType.charAt(0).toUpperCase() + item.analysisType.slice(1)}
                      </span>
                      
                      {/* Model tag */}
                      {item.modelId && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getProviderColor(item.modelId)}`}>
                          {formatModelName(item.modelId)}
                        </span>
                      )}
                      
                      {/* User tags */}
                      {item.tags && item.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                          {tag}
                        </span>
                      ))}
                      
                      {/* Success rating */}
                      {item.successRating && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.successRating >= 4 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                            : item.successRating >= 3
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          Rating: {item.successRating}/5
                        </span>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex justify-end space-x-2">
                      <button
                        className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                        onClick={() => onItemSelect && onItemSelect(item)}
                      >
                        View
                      </button>
                      <button
                        className="text-xs px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        onClick={() => onItemDelete && onItemDelete(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimelineView;