import React from 'react';

const SearchFilters = ({ 
  searchTerm, 
  onSearchChange,
  filterCriteria,
  toggleSeverityFilter,
  toggleTypeFilter
}) => {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Search in analysis results..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <span className="dark:text-gray-300">Filter:</span>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={filterCriteria.severity.critical}
              onChange={() => toggleSeverityFilter('critical')}
              className="form-checkbox h-4 w-4 text-red-500"
            />
            <span className="ml-1 text-gray-700 dark:text-gray-300">Critical</span>
          </label>
          
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={filterCriteria.severity.high}
              onChange={() => toggleSeverityFilter('high')}
              className="form-checkbox h-4 w-4 text-orange-500"
            />
            <span className="ml-1 text-gray-700 dark:text-gray-300">High</span>
          </label>
          
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={filterCriteria.severity.medium}
              onChange={() => toggleSeverityFilter('medium')}
              className="form-checkbox h-4 w-4 text-yellow-500"
            />
            <span className="ml-1 text-gray-700 dark:text-gray-300">Medium</span>
          </label>
          
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={filterCriteria.severity.low}
              onChange={() => toggleSeverityFilter('low')}
              className="form-checkbox h-4 w-4 text-blue-500"
            />
            <span className="ml-1 text-gray-700 dark:text-gray-300">Low</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;