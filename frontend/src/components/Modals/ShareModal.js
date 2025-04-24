import React from 'react';

const ShareModal = ({ shareUrl, copySuccess, onCopy, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Share Analysis</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Use this URL to share your analysis with others:
        </p>
        
        <div className="flex">
          <input 
            type="text" 
            value={shareUrl} 
            className="flex-1 p-2 border rounded-l text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200"
            readOnly
          />
          <button
            onClick={() => onCopy(shareUrl, 'share')}
            className="px-3 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600"
          >
            {copySuccess === 'share' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;