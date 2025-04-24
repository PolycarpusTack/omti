import React from 'react';
import { TIME_RANGES } from '../dashboardConstants';

/**
 * Dashboard header component
 * Contains title, time range selector, and control buttons
 */
const DashboardHeader = ({
  colors,
  insights,
  timeRange,
  showProjections,
  showComparisons,
  onChange,
  onExport,
  onToggleProjections,
  onToggleComparison
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6">
      <div>
        <h2 className={`text-2xl font-bold text-${colors.text} mb-2`}>
          Analytics Dashboard
          {showProjections && <span className={`ml-2 text-sm font-normal text-${colors.info} bg-${colors.info}/10 px-2 py-1 rounded-full`}>Projections Enabled</span>}
        </h2>
        <p className={`text-${colors.secondaryText}`}>
          {insights?.summary}
        </p>
      </div>
      
      <div className="flex flex-wrap mt-4 md:mt-0 gap-2">
        {/* Time range selector */}
        <select 
          className={`bg-${colors.cardBackground} border border-${colors.border} rounded-md py-2 px-3 text-sm text-${colors.text}`}
          value={timeRange}
          onChange={(e) => onChange(e.target.value)}
        >
          {TIME_RANGES.map(range => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
        
        {/* Export button */}
        <div className="relative inline-block">
          <button 
            className={`bg-${colors.accent} hover:bg-${colors.accent}/90 text-white rounded-md py-2 px-3 text-sm flex items-center`}
            onClick={onExport}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          {/* Export dropdown menu would be rendered here when open */}
        </div>
        
        {/* Toggle projections */}
        <button 
          className={`${showProjections ? `bg-${colors.accent} text-white` : `bg-${colors.cardBackground} text-${colors.text}`} border border-${colors.border} rounded-md py-2 px-3 text-sm flex items-center`}
          onClick={onToggleProjections}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          {showProjections ? 'Hide Projections' : 'Show Projections'}
        </button>
        
        {/* Toggle comparison */}
        <button 
          className={`${showComparisons ? `bg-${colors.accent} text-white` : `bg-${colors.cardBackground} text-${colors.text}`} border border-${colors.border} rounded-md py-2 px-3 text-sm flex items-center`}
          onClick={onToggleComparison}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {showComparisons ? 'Hide Comparison' : 'Compare Periods'}
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;