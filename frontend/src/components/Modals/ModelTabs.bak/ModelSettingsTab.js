// src/components/Modals/ModelTabs/ModelSettingsTab.js
import React from "react";

const ModelSettingsTab = ({ 
  settings, 
  handleSettingChange, 
  viewMode, 
  renderIfExpanded,
  resetToOriginal
}) => {
  return (
    <div className="space-y-6">
      {/* Basic Settings - Always shown */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium dark:text-gray-200">
            Basic Settings
          </h3>
          <button
            type="button"
            onClick={resetToOriginal}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
            aria-label="Reset to default settings"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temperature */}
          <div>
            <label
              htmlFor="temperature-slider"
              className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              Temperature
            </label>
            <div className="flex items-center gap-2">
              <input
                id="temperature-slider"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) =>
                  handleSettingChange(
                    "temperature",
                    parseFloat(e.target.value)
                  )
                }
                className="flex-grow"
                aria-label={`Temperature: ${settings.temperature}`}
              />
              <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                {settings.temperature}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Controls randomness: Lower is more deterministic, higher is more creative
            </p>
          </div>

          {/* Top P */}
          <div>
            <label
              htmlFor="topP-slider"
              className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              Top P
            </label>
            <div className="flex items-center gap-2">
              <input
                id="topP-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.topP}
                onChange={(e) =>
                  handleSettingChange(
                    "topP",
                    parseFloat(e.target.value)
                  )
                }
                className="flex-grow"
                aria-label={`Top P: ${settings.topP}`}
              />
              <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                {settings.topP}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Controls diversity via nucleus sampling
            </p>
          </div>

          {/* Only show max tokens settings in expanded view */}
          {renderIfExpanded(
            <>
              <div>
                <label
                  htmlFor="maxTokensPerChunk-input"
                  className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
                >
                  Max Tokens Per Chunk
                </label>
                <input
                  id="maxTokensPerChunk-input"
                  type="number"
                  value={settings.maxTokensPerChunk}
                  onChange={(e) =>
                    handleSettingChange(
                      "maxTokensPerChunk",
                      parseInt(e.target.value) || 4000
                    )
                  }
                  className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                  min="1000"
                  max="16000"
                  aria-label={`Max Tokens Per Chunk: ${settings.maxTokensPerChunk}`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Smaller values process faster but may miss context
                </p>
              </div>

              <div>
                <label
                  htmlFor="maxOutputTokens-input"
                  className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
                >
                  Max Output Tokens
                </label>
                <input
                  id="maxOutputTokens-input"
                  type="number"
                  value={settings.maxOutputTokens}
                  onChange={(e) =>
                    handleSettingChange(
                      "maxOutputTokens",
                      parseInt(e.target.value) || 2000
                    )
                  }
                  className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                  min="500"
                  max="4000"
                  aria-label={`Max Output Tokens: ${settings.maxOutputTokens}`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum length of model's response
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Advanced Settings - Only in expanded view */}
      {renderIfExpanded(
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
            Advanced Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Frequency Penalty */}
            <div>
              <label
                htmlFor="frequencyPenalty-slider"
                className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Frequency Penalty
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="frequencyPenalty-slider"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={settings.frequencyPenalty}
                  onChange={(e) =>
                    handleSettingChange(
                      "frequencyPenalty",
                      parseFloat(e.target.value)
                    )
                  }
                  className="flex-grow"
                  aria-label={`Frequency Penalty: ${settings.frequencyPenalty}`}
                />
                <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                  {settings.frequencyPenalty}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Reduces repetition of token sequences
              </p>
            </div>

            {/* Presence Penalty */}
            <div>
              <label
                htmlFor="presencePenalty-slider"
                className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Presence Penalty
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="presencePenalty-slider"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={settings.presencePenalty}
                  onChange={(e) =>
                    handleSettingChange(
                      "presencePenalty",
                      parseFloat(e.target.value)
                    )
                  }
                  className="flex-grow"
                  aria-label={`Presence Penalty: ${settings.presencePenalty}`}
                />
                <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                  {settings.presencePenalty}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Increases likelihood of discussing new topics
              </p>
            </div>

            {/* Content Filter */}
            <div>
              <label
                htmlFor="contentFilter-select"
                className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Content Filter
              </label>
              <select
                id="contentFilter-select"
                value={settings.contentFilter}
                onChange={(e) =>
                  handleSettingChange("contentFilter", e.target.value)
                }
                className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                aria-label="Content filter setting"
              >
                <option value="standard">Standard</option>
                <option value="strict">Strict</option>
                <option value="relaxed">Relaxed</option>
                <option value="disabled">Disabled</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Controls level of content filtering applied
              </p>
            </div>

            {/* Timeout */}
            <div>
              <label
                htmlFor="timeout-input"
                className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Request Timeout (seconds)
              </label>
              <input
                id="timeout-input"
                type="number"
                value={settings.timeout}
                onChange={(e) =>
                  handleSettingChange(
                    "timeout",
                    parseInt(e.target.value) || 300
                  )
                }
                className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                min="60"
                max="3600"
                aria-label="Request timeout in seconds"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum time to wait for analysis
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feature Toggles section */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Feature Toggles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Response Streaming */}
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="streaming-toggle"
                className="block text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Response Streaming
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Stream tokens as they're generated
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-2">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={settings.streamingEnabled}
                onChange={(e) =>
                  handleSettingChange(
                    "streamingEnabled",
                    e.target.checked
                  )
                }
                id="streaming-toggle"
                aria-label="Toggle response streaming"
              />
              <label
                htmlFor="streaming-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  settings.streamingEnabled
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    settings.streamingEnabled ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>

          {/* Only show Response Caching in expanded view */}
          {renderIfExpanded(
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="caching-toggle"
                  className="block text-sm font-medium text-gray-600 dark:text-gray-400"
                >
                  Response Caching
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Cache identical requests for faster responses
                </p>
              </div>
              <div className="relative inline-block w-12 h-6 ml-2">
                <input
                  type="checkbox"
                  className="opacity-0 w-0 h-0"
                  checked={settings.cachingEnabled}
                  onChange={(e) =>
                    handleSettingChange(
                      "cachingEnabled",
                      e.target.checked
                    )
                  }
                  id="caching-toggle"
                  aria-label="Toggle response caching"
                />
                <label
                  htmlFor="caching-toggle"
                  className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                    settings.cachingEnabled
                      ? "bg-blue-500"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                      settings.cachingEnabled ? "left-7" : "left-1"
                    } top-1`}
                  ></span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Optimization */}
      {viewMode === "concise" && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
            Task Optimization
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => {
                handleSettingChange("temperature", 0.2);
                handleSettingChange("topP", 0.9);
              }}
            >
              <div className="font-medium mb-1">Factual</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Best for knowledge retrieval
              </div>
            </button>
            <button
              type="button"
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => {
                handleSettingChange("temperature", 0.1);
                handleSettingChange("topP", 0.95);
              }}
            >
              <div className="font-medium mb-1">Code</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Best for programming tasks
              </div>
            </button>
            <button
              type="button"
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => {
                handleSettingChange("temperature", 0.7);
                handleSettingChange("topP", 0.9);
              }}
            >
              <div className="font-medium mb-1">Creative</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Best for writing and ideation
              </div>
            </button>
            <button
              type="button"
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
              onClick={() => {
                handleSettingChange("temperature", 0.5);
                handleSettingChange("topP", 0.95);
              }}
            >
              <div className="font-medium mb-1">Balanced</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Good for general use
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSettingsTab;