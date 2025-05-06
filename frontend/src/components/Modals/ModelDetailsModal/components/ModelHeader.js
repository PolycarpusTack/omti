// src/components/Modals/ModelDetailsModal/components/ModelHeader.js
import React from "react";

const ModelHeader = ({ model, viewMode, toggleViewMode, handleClose, hasUnsavedChanges }) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center min-w-0">
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            model.status === "healthy"
              ? "bg-green-500"
              : model.status === "degraded"
              ? "bg-yellow-500"
              : "bg-red-500"
          } mr-2`}
        ></div>
        <h2 className="text-xl font-bold dark:text-gray-100 truncate">
          {model.name}
          {hasUnsavedChanges && (
            <span className="ml-2 text-sm text-amber-500 dark:text-amber-400">
              (unsaved changes)
            </span>
          )}
        </h2>
        {model.provider && (
          <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs rounded-full flex-shrink-0">
            {model.provider === "openai"
              ? "OpenAI"
              : model.provider === "anthropic"
              ? "Anthropic"
              : model.provider === "cohere"
              ? "Cohere"
              : model.provider}
          </span>
        )}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center mr-2 sm:mr-6 flex-shrink-0">
        <span className="text-xs mr-2 text-gray-500 dark:text-gray-400 hidden sm:inline">
          {viewMode === "concise" ? "Concise" : "Expanded"}
        </span>
        <div className="relative inline-block w-10 h-5">
          <input
            type="checkbox"
            id="view-toggle"
            className="opacity-0 w-0 h-0"
            checked={viewMode === "expanded"}
            onChange={toggleViewMode}
            aria-label={`Switch to ${
              viewMode === "expanded" ? "concise" : "expanded"
            } view`}
          />
          <label
            htmlFor="view-toggle"
            className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
              viewMode === "expanded"
                ? "bg-blue-500"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`absolute h-3 w-3 bg-white rounded-full transition-all duration-300 ${
                viewMode === "expanded" ? "left-6" : "left-1"
              } top-1`}
            ></span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
        aria-label="Close modal"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

export default ModelHeader;