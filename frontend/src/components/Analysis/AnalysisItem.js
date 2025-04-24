import React from 'react';
import RootCauseTree from '../../components/RootCauseTree';

const AnalysisItem = ({ 
  analysis, 
  copySuccess, 
  onCopy, 
  onStartTroubleshooting,
  highlightErrors 
}) => {
  const isCrashAnalysis = analysis.crash_resolution_report && analysis.diagnostic_overview_report;
  
  return (
    <div className="bg-white dark:bg-gray-700 shadow-md rounded-lg p-4 mb-4">
      {/* Render crash analysis */}
      {isCrashAnalysis ? (
        <>
          <div className="flex justify-between items-start mb-3">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Full Crash Analysis Report</h2>
            <div className="flex items-center">
              <button
                onClick={() => onStartTroubleshooting(analysis)}
                className="ml-2 text-blue-500 hover:text-blue-600 text-sm"
              >
                Start Guided Troubleshooting
              </button>
            </div>
          </div>
          
          {analysis.timestamp && (
            <small className="text-gray-400 dark:text-gray-500 block mb-3">
              Generated at: {new Date(analysis.timestamp).toLocaleString()}
            </small>
          )}
          
          <RootCauseTree analysis={analysis} />
          
          <details open className="mt-4 mb-4">
            <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
              🔧 Crash Resolution Report
            </summary>
            <div className="mt-2 p-2 dark:text-gray-200">
              {analysis.crash_resolution_report}
            </div>
          </details>
          <details className="mb-4">
            <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
              🔍 Diagnostic Overview Report
            </summary>
            <div className="mt-2 p-2 dark:text-gray-200">
              {analysis.diagnostic_overview_report}
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Analysis Chunk {analysis.chunk}/{analysis.total_chunks}
            </h2>
            <div className="flex items-center">
              <button
                onClick={() => {
                  onCopy(
                    `${analysis.simplified_analysis}\n\n${analysis.suggested_solutions}`, 
                    `chunk-${analysis.chunk}`
                  );
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Copy analysis"
              >
                {copySuccess === `chunk-${analysis.chunk}` ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onStartTroubleshooting(analysis)}
                className="ml-2 text-blue-500 hover:text-blue-600 text-sm"
              >
                Start Guided Troubleshooting
              </button>
            </div>
          </div>
          
          {analysis.timestamp && (
            <small className="text-gray-400 dark:text-gray-500">
              Generated at: {new Date(analysis.timestamp).toLocaleString()}
            </small>
          )}
          
          {analysis.error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded mb-4" role="alert">
              {analysis.error}
            </div>
          )}
          
          <RootCauseTree analysis={analysis} />
          
          <details open className="mb-4 mt-3">
            <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
              📖 Simple Explanation
            </summary>
            <div className="mt-2 p-2 dark:text-gray-200">
              {analysis.simplified_analysis || "Analysis not available"}
            </div>
          </details>
          <details className="mb-4">
            <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
              🛠️ Suggested Solutions
            </summary>
            <div className="mt-2 p-2 dark:text-gray-200">
              {analysis.suggested_solutions || "No solutions available"}
            </div>
          </details>
          <details>
            <summary className="font-semibold cursor-pointer bg-gray-50 dark:bg-gray-800 p-2 rounded">
              🔍 Technical Details
            </summary>
            <div 
              className="mt-2 p-2 font-mono text-sm overflow-auto max-h-96 dark:text-gray-300"
              dangerouslySetInnerHTML={highlightErrors(analysis.technical_analysis || "Technical analysis not available")}
            />
          </details>
        </>
      )}
    </div>
  );
};

export default AnalysisItem;