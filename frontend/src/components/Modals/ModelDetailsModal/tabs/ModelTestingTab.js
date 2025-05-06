// src/components/Modals/ModelDetailsModal/tabs/ModelTestingTab.js
import React, { useState, useCallback } from "react";

const ModelTestingTab = ({ settings, handleSettingChange }) => {
  // State for real-time preview
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewInput, setPreviewInput] = useState(
    "Explain the importance of code optimization."
  );
  const [previewResponse, setPreviewResponse] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // A/B testing state
  const [abTestingEnabled, setAbTestingEnabled] = useState(false);
  const [settingsB, setSettingsB] = useState({
    ...settings,
    temperature: Math.min(settings.temperature + 0.2, 1.0),
  });
  const [testInput, setTestInput] = useState(
    "Explain the concept of recursion in programming."
  );
  const [testResponseA, setTestResponseA] = useState("");
  const [testResponseB, setTestResponseB] = useState("");
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

  // Update settings B when settings change
  React.useEffect(() => {
    setSettingsB(prev => ({
      ...prev,
      temperature: Math.min(settings.temperature + 0.2, 1.0),
    }));
  }, [settings.temperature]);

  // Generate real-time preview response
  const generatePreview = useCallback(() => {
    setPreviewLoading(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      const creativity = settings.temperature * 10;
      let response;
      
      if (creativity < 3) {
        response =
          "Code optimization improves application performance by reducing execution time and resource usage. This is achieved through algorithms with better time complexity, memory management improvements, and compiler optimization techniques.";
      } else if (creativity < 7) {
        response =
          "Code optimization is crucial for efficient software. It ensures your applications run faster, use less memory, and consume less power. Techniques include algorithmic improvements, cache utilization, and reducing unnecessary operations. Well-optimized code also tends to be more maintainable in the long run.";
      } else {
        response =
          "Think of code optimization as fine-tuning a race car! Just as mechanics might adjust the fuel mixture or aerodynamics to shave seconds off lap times, developers refine their code to run lightning-fast while sipping resources. This isn't just about speed—it's about crafting elegant solutions that respect hardware limitations and user experience alike. Great optimization feels like magic but comes from deep understanding of both the problem and computing environment.";
      }
      
      setPreviewResponse(response);
      setPreviewLoading(false);
    }, 1500);
  }, [settings.temperature]);

  // Handle settings B changes for A/B testing
  const handleSettingBChange = useCallback((key, value) => {
    setSettingsB((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Generate A/B test responses
  const generateABTestResponses = useCallback(() => {
    setIsGeneratingResponse(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      let responseA;
      if (settings.temperature < 0.5) {
        responseA =
          "Recursion in programming is a technique where a function calls itself to solve a problem. It requires a base case to prevent infinite loops. Example: calculating factorial where factorial(n) = n * factorial(n-1) and factorial(0) = 1.";
      } else {
        responseA =
          "Recursion is like a Russian nesting doll - a function that calls itself with a simpler version of the problem until it reaches a solution that's simple enough to solve directly. It's powerful for tasks like traversing trees, solving mathematical sequences, and breaking down complex problems into simpler pieces.";
      }
      
      let responseB;
      if (settingsB.temperature < 0.5) {
        responseB =
          "Recursion is a programming pattern where a function invokes itself to solve subproblems of the original problem. Essential components include: 1) Base case that stops recursion, 2) Recursive case that simplifies the problem. Common examples: factorial calculation, Fibonacci sequence, tree traversal.";
      } else {
        responseB =
          "Imagine you're standing between two mirrors, seeing endless reflections - that's recursion! In code, it's when a function looks in the mirror and calls itself. This elegant approach breaks complex problems into smaller, identical sub-problems. Think of it as the programming equivalent of inception - a dream within a dream, or in this case, a function within a function.";
      }
      
      setTestResponseA(responseA);
      setTestResponseB(responseB);
      setIsGeneratingResponse(false);
    }, 3000);
  }, [settings.temperature, settingsB.temperature]);

  return (
    <div className="space-y-6">
      {/* Real-time Preview */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium dark:text-gray-200">
            Real-time Preview
          </h3>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              Preview as you edit
            </span>
            <div className="relative inline-block w-12 h-6">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={previewEnabled}
                onChange={(e) => {
                  setPreviewEnabled(e.target.checked);
                  if (e.target.checked) {
                    generatePreview();
                  }
                }}
                id="preview-toggle"
                aria-label="Toggle real-time preview"
              />
              <label
                htmlFor="preview-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  previewEnabled
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    previewEnabled ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="preview-prompt-input"
              className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              Sample Prompt
            </label>
            <textarea
              id="preview-prompt-input"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              className="w-full p-3 text-sm border rounded h-32 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              placeholder="Enter a sample prompt to test the model..."
              aria-label="Sample prompt for preview"
            ></textarea>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={generatePreview}
                disabled={previewLoading}
                className={`px-3 py-1 text-sm rounded ${
                  previewLoading
                    ? "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
                aria-label="Generate preview response"
              >
                {previewLoading ? "Generating..." : "Generate Preview"}
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              Response Preview
            </label>
            <div
              className={`w-full p-3 border rounded h-32 overflow-auto text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white ${
                previewLoading
                  ? "bg-gray-50 dark:bg-gray-700"
                  : "bg-white dark:bg-gray-600"
              }`}
              aria-live="polite"
              aria-label="Model response preview"
            >
              {previewLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-2 bg-gray-300 dark:bg-gray-500 rounded"></div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-500 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-300 dark:bg-gray-500 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              ) : (
                previewResponse ||
                "Response will appear here after you generate a preview."
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This is an approximate preview based on current settings
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center">
          <div className="text-sm text-gray-700 dark:text-gray-300 mr-4">
            Current Temperature: {settings.temperature}
          </div>
          <div className="flex-grow bg-gray-200 dark:bg-gray-600 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{ width: `${settings.temperature * 100}%` }}
              aria-hidden="true"
            ></div>
          </div>
          <div className="ml-4 text-sm text-gray-700 dark:text-gray-300">
            {settings.temperature < 0.3
              ? "More deterministic"
              : settings.temperature < 0.7
              ? "Balanced"
              : "More creative"}
          </div>
        </div>
      </div>

      {/* A/B Testing */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium dark:text-gray-200">
            A/B Testing
          </h3>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              Enable A/B testing
            </span>
            <div className="relative inline-block w-12 h-6">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={abTestingEnabled}
                onChange={(e) => setAbTestingEnabled(e.target.checked)}
                id="ab-testing-toggle"
                aria-label="Toggle A/B testing"
              />
              <label
                htmlFor="ab-testing-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  abTestingEnabled
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    abTestingEnabled ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>
        </div>

        {abTestingEnabled && (
          <>
            <div className="mb-4">
              <label
                htmlFor="ab-test-prompt-input"
                className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                Test Prompt
              </label>
              <textarea
                id="ab-test-prompt-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full p-3 text-sm border rounded h-24 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                placeholder="Enter a prompt to test different settings..."
                aria-label="Test prompt for A/B testing"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Configuration A (Current)
                </h4>
                <div className="space-y-3 p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
                  <div>
                    <label
                      htmlFor="configA-temperature-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Temperature
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configA-temperature-slider"
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
                        aria-label="Configuration A temperature"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settings.temperature}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="configA-topP-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Top P
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configA-topP-slider"
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
                        aria-label="Configuration A top P"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settings.topP}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="configA-frequencyPenalty-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Frequency Penalty
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configA-frequencyPenalty-slider"
                        type="range"
                        min="-2"
                        max="2"
                        step="0.5"
                        value={settings.frequencyPenalty}
                        onChange={(e) =>
                          handleSettingChange(
                            "frequencyPenalty",
                            parseFloat(e.target.value)
                          )
                        }
                        className="flex-grow"
                        aria-label="Configuration A frequency penalty"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settings.frequencyPenalty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Configuration B (Test)
                </h4>
                <div className="space-y-3 p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
                  <div>
                    <label
                      htmlFor="configB-temperature-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Temperature
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configB-temperature-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settingsB.temperature}
                        onChange={(e) =>
                          handleSettingBChange(
                            "temperature",
                            parseFloat(e.target.value)
                          )
                        }
                        className="flex-grow"
                        aria-label="Configuration B temperature"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settingsB.temperature}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="configB-topP-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Top P
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configB-topP-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settingsB.topP}
                        onChange={(e) =>
                          handleSettingBChange(
                            "topP",
                            parseFloat(e.target.value)
                          )
                        }
                        className="flex-grow"
                        aria-label="Configuration B top P"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settingsB.topP}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="configB-frequencyPenalty-slider"
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      Frequency Penalty
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="configB-frequencyPenalty-slider"
                        type="range"
                        min="-2"
                        max="2"
                        step="0.5"
                        value={settingsB.frequencyPenalty}
                        onChange={(e) =>
                          handleSettingBChange(
                            "frequencyPenalty",
                            parseFloat(e.target.value)
                          )
                        }
                        className="flex-grow"
                        aria-label="Configuration B frequency penalty"
                      />
                      <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                        {settingsB.frequencyPenalty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={generateABTestResponses}
                disabled={isGeneratingResponse}
                className={`px-4 py-2 text-sm rounded ${
                  isGeneratingResponse
                    ? "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
                aria-label="Generate A/B test responses"
              >
                {isGeneratingResponse
                  ? "Generating..."
                  : "Compare Responses"}
              </button>
            </div>

            {(testResponseA || testResponseB) && !isGeneratingResponse && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Response A (Current)
                  </h4>
                  <div
                    className="p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 h-48 overflow-auto text-sm"
                    aria-label="Response from configuration A"
                  >
                    {testResponseA}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Response B (Test)
                  </h4>
                  <div
                    className="p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 h-48 overflow-auto text-sm"
                    aria-label="Response from configuration B"
                  >
                    {testResponseB}
                  </div>
                </div>
              </div>
            )}

            {(testResponseA || testResponseB) && !isGeneratingResponse && (
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    // Apply settings B to settings A
                    for (const key in settingsB) {
                      handleSettingChange(key, settingsB[key]);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  aria-label="Apply configuration B settings"
                >
                  Apply Configuration B
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Benchmarking Tool (simplified for this refactor) */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Benchmarking Tool
        </h3>
        <div className="text-sm text-center text-gray-600 dark:text-gray-400 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded">
          Benchmarking functionality coming soon!<br />
          This feature will allow you to test model performance across various metrics.
        </div>
      </div>
    </div>
  );
};

export default ModelTestingTab;