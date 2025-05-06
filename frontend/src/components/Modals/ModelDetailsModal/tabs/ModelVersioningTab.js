// src/components/Modals/ModelDetailsModal/tabs/ModelVersioningTab.js
import React, { useState, useRef } from "react";

const ModelVersioningTab = ({ 
  settings, 
  savedVersions, 
  saveCurrentVersion, 
  loadVersion,
  exportSettings,
  importSettings,
  model 
}) => {
  const [newVersionName, setNewVersionName] = useState("");
  const [versionNameError, setVersionNameError] = useState("");
  const fileInputRef = useRef(null);

  const handleSaveVersion = () => {
    if (!newVersionName.trim()) {
      setVersionNameError("Please enter a version name");
      return;
    }
    
    // Check if name already exists
    if (savedVersions.some(v => v.name === newVersionName.trim())) {
      setVersionNameError("A version with this name already exists");
      return;
    }
    
    saveCurrentVersion(newVersionName.trim());
    setNewVersionName("");
    setVersionNameError("");
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date instanceof Date && !isNaN(date) 
        ? date.toLocaleString(undefined, { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : "Unknown date";
    } catch (e) {
      return "Unknown date";
    }
  };

  return (
    <div className="space-y-6">
      {/* Version Management */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Version Management
        </h3>

        <div className="mb-4">
          <div className="flex items-end gap-2">
            <div className="flex-grow">
              <label htmlFor="version-name-input" className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                Save Current Settings As
              </label>
              <input
                id="version-name-input"
                type="text"
                value={newVersionName}
                onChange={(e) => {
                  setNewVersionName(e.target.value);
                  setVersionNameError("");
                }}
                className={`w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white ${
                  versionNameError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="Enter version name..."
              />
              {versionNameError && (
                <p className="mt-1 text-xs text-red-500">{versionNameError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveVersion}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              aria-label="Save current settings as a named version"
            >
              Save Version
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Saved Versions
          </h4>
          
          {savedVersions.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded">
              No saved versions yet
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-200 dark:border-gray-600 rounded-md">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Temperature
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  {savedVersions.map((version, index) => (
                    <tr key={version.id} className={index % 2 === 0 ? "bg-white dark:bg-gray-700" : "bg-gray-50 dark:bg-gray-800"}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                        {version.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(version.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {version.settings.temperature.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          type="button"
                          onClick={() => loadVersion(version.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-3"
                        >
                          Load
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import/Export */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Import/Export Settings
        </h3>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            type="button"
            onClick={exportSettings}
            className="flex-1 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
            aria-label="Export settings as JSON file"
          >
            <div className="flex items-center justify-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Settings
            </div>
          </button>
          
          <button
            type="button"
            onClick={handleImportClick}
            className="flex-1 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
            aria-label="Import settings from JSON file"
          >
            <div className="flex items-center justify-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Settings
            </div>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={importSettings}
            className="hidden"
            accept=".json"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>• Export settings to share with team members or for backup</p>
          <p>• Import settings from previously exported files</p>
          <p>• Files include all parameters and are specific to this model</p>
        </div>
      </div>
    </div>
  );
};

export default ModelVersioningTab;