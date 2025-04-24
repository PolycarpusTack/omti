import React from 'react';

const ProgressIndicator = ({ progress, status, analysisType, analysesCount, totalChunks }) => {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
      <div className="mb-2 flex justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysis Progress</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
        <div 
          className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar" 
          aria-valuenow={progress} 
          aria-valuemin="0" 
          aria-valuemax="100"
        />
      </div>
      <div className="mt-2 flex flex-col items-center">
        <p className="text-center text-blue-500 dark:text-blue-400 font-medium">
          {status}
        </p>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          {analysisType === 'crash' 
            ? 'Examining crash data for root causes...' 
            : `Processing ${analysesCount} of ${totalChunks || '?'} chunks...`}
        </p>
      </div>
    </div>
  );
};

export default ProgressIndicator;