import React from 'react';

const PatternInsightsModal = ({ insights, onClose }) => {
  if (!insights || insights.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Pattern Insights</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          {insights.map((insight, idx) => (
            <div key={idx} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-700">
              <div className="font-medium mb-1">
                {insight.type === 'recurring_error' 
                  ? `Recurring Issue (${insight.frequency} occurrences)`
                  : 'Time Pattern Detected'}
              </div>
              <div className="mb-2 text-sm dark:text-gray-200">{insight.message}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Suggestion: {insight.suggestion}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PatternInsightsModal;