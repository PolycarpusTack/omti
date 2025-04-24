import React from 'react';
import { Tooltip } from 'react-tooltip';

const AnalysisTypeSelector = ({ analysisType, onChange, disabled = false }) => {
  const tooltipId = "analysis-type-tooltip";
  
  return (
    <div className="mb-4">
      <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        Analysis Type
      </label>
      <div className="flex space-x-2">
        <select
          value={analysisType}
          onChange={(e) => onChange(e.target.value)}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white w-full"
          data-tooltip-id={tooltipId}
          data-tooltip-content="Select the type of analysis to perform"
          disabled={disabled}
        >
          <option value="original">Original Analysis</option>
          <option value="crash">Crash Focused Analysis</option>
        </select>
        <Tooltip id={tooltipId} place="top" />
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {analysisType === 'original' 
          ? 'Standard analysis for general log files and errors' 
          : 'Specialized analysis focused on crash diagnostics and resolution'}
      </p>
    </div>
  );
};

export default AnalysisTypeSelector;