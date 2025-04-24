import React from 'react';
import { MODEL_OPTIONS } from '../../constants';

const SettingsModal = ({ 
  settings = {
    model: MODEL_OPTIONS[0]?.value || '',
    maxTokensPerChunk: 4000,
    timeout: 300
  }, 
  onSettingsChange, 
  onClose 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Settings</h3>
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
          <div>
            <label className="block mb-1 font-medium">Model</label>
            <select 
              value={settings.model}
              onChange={(e) => onSettingsChange({...settings, model: e.target.value})}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              {MODEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Maximum Tokens Per Chunk</label>
            <input 
              type="number" 
              value={settings.maxTokensPerChunk}
              onChange={(e) => onSettingsChange({...settings, maxTokensPerChunk: parseInt(e.target.value) || 4000})}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
              min="1000"
              max="16000"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Smaller values process faster but may miss context (1000-16000)
            </p>
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Request Timeout (seconds)</label>
            <input 
              type="number" 
              value={settings.timeout}
              onChange={(e) => onSettingsChange({...settings, timeout: parseInt(e.target.value) || 300})}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
              min="60"
              max="3600"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Maximum time to wait for analysis (60-3600 seconds)
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;