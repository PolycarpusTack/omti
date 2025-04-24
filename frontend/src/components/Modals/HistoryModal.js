import React from 'react';

const HistoryModal = ({ 
  analysisHistory, 
  onLoadHistory, 
  onClearHistory, 
  onClose 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Analysis History</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {analysisHistory.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No analysis history available
          </p>
        ) : (
          <div className="space-y-2">
            {analysisHistory.map((item, idx) => (
              <div 
                key={idx} 
                className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onLoadHistory(item)}
              >
                <div className="font-medium">{item.filename}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between">
                  <span>
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                  <span>
                    Analysis Type: {item.analysisType || 'original'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all history?")) {
                onClearHistory();
              }
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            disabled={analysisHistory.length === 0}
          >
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;