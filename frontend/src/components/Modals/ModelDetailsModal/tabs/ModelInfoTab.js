// src/components/Modals/ModelDetailsModal/tabs/ModelInfoTab.js
import React from "react";

const ModelInfoTab = ({ model, viewMode, renderIfExpanded }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left column - Model information */}
      <div
        className={`${
          viewMode === "concise" ? "md:col-span-3" : "md:col-span-1"
        } space-y-6`}
      >
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
            Model Information
          </h3>

          <div
            className={`${
              viewMode === "concise"
                ? "grid grid-cols-2 md:grid-cols-3 gap-4"
                : "space-y-4"
            }`}
          >
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Size
              </div>
              <div className="font-medium dark:text-gray-200">
                {model.size || "Unknown"} parameters
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Specialization
              </div>
              <div className="font-medium dark:text-gray-200">
                {model.specialization || "General purpose"}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Status
              </div>
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full ${
                    model.status === "healthy"
                      ? "bg-green-500"
                      : model.status === "degraded"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  } mr-1`}
                ></div>
                <span className="font-medium dark:text-gray-200 capitalize">
                  {model.status || "Unknown"}
                </span>
              </div>
            </div>

            {renderIfExpanded(
              <>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Version
                  </div>
                  <div className="font-medium dark:text-gray-200">
                    {model.version || "1.0"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Release Date
                  </div>
                  <div className="font-medium dark:text-gray-200">
                    {model.releaseDate || "January 2025"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Last Updated
                  </div>
                  <div className="font-medium dark:text-gray-200">
                    {model.lastUpdated || "April 10, 2025"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Conditional rendering for performance metrics based on view mode */}
        {renderIfExpanded(
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
              Performance Metrics
            </h3>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Avg Response Time
                </div>
                <div className="font-medium dark:text-gray-200">
                  {model.avgResponseTime?.toFixed(1) || "2.5"} seconds
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Throughput
                </div>
                <div className="font-medium dark:text-gray-200">
                  {model.throughput?.toFixed(1) || "35.0"} tokens/sec
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Cost per 1M Tokens
                </div>
                <div className="font-medium dark:text-gray-200">
                  ${model.costPer1MTokens || "2.00"}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Error Rate (24h)
                </div>
                <div className="font-medium dark:text-gray-200">
                  {model.errorRate || "0.8"}%
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Context Window
                </div>
                <div className="font-medium dark:text-gray-200">
                  {model.contextWindow || "16K"} tokens
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Only show description in expanded view */}
        {renderIfExpanded(
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
              Description
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              {model.description ||
                "A state-of-the-art language model optimized for natural language understanding and generation. Excels at creative writing, code analysis, and complex reasoning tasks."}
            </p>
          </div>
        )}
      </div>

      {/* Only render right columns in expanded view or when in concise view and info tab */}
      {(viewMode === "expanded" || viewMode === "concise") && (
        <div
          className={`${
            viewMode === "concise" ? "md:col-span-3" : "md:col-span-2"
          } space-y-6`}
        >
          {/* Show only key capabilities in concise mode */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
              Capabilities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">
                  Strengths
                </h4>
                <ul className="space-y-1">
                  {model.strengths?.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {strength}
                      </span>
                    </li>
                  )) || (
                    <>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Natural language understanding
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Code generation and analysis
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Reasoning and problem-solving
                        </span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">
                  Limitations
                </h4>
                <ul className="space-y-1">
                  {model.limitations?.map((limitation, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-red-500 mr-2">✗</span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {limitation}
                      </span>
                    </li>
                  )) || (
                    <>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2">✗</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          May hallucinate facts
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2">✗</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Limited knowledge cutoff
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2">✗</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          No real-time data access
                        </span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* Only show benchmark performance in expanded view */}
            {renderIfExpanded(
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Benchmark Performance
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      MMLU
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {model.benchmarks?.mmlu || "78.2%"}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      HumanEval
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {model.benchmarks?.humanEval || "65.7%"}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      GSM8K
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {model.benchmarks?.gsm8k || "81.3%"}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      HellaSwag
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {model.benchmarks?.hellaswag || "87.9%"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recommended Use Cases - Only in expanded view */}
          {renderIfExpanded(
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
                Recommended Use Cases
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {model.specialization === "Code analysis" && (
                  <>
                    <div
                      key="code1"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Stack trace and exception analysis
                    </div>
                    <div
                      key="code2"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Code-related error debugging
                    </div>
                    <div
                      key="code3"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Legacy code refactoring
                    </div>
                    <div
                      key="code4"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Security vulnerability detection
                    </div>
                  </>
                )}

                {(model.specialization === "Fast analysis" ||
                  model.specialization === "General purpose" ||
                  !model.specialization) && (
                  <>
                    <div
                      key="fast1"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Quick initial assessment of issues
                    </div>
                    <div
                      key="fast2"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Standard log file analysis
                    </div>
                    <div
                      key="fast3"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Content generation and summarization
                    </div>
                    <div
                      key="fast4"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Customer support automation
                    </div>
                  </>
                )}

                {model.specialization === "Technical depth" && (
                  <>
                    <div
                      key="tech1"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Complex technical issue analysis
                    </div>
                    <div
                      key="tech2"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Detailed root cause investigation
                    </div>
                    <div
                      key="tech3"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      System architecture review
                    </div>
                    <div
                      key="tech4"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Performance optimization guidance
                    </div>
                  </>
                )}

                {model.specialization === "Deep analysis" && (
                  <>
                    <div
                      key="deep1"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Comprehensive system-wide analysis
                    </div>
                    <div
                      key="deep2"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Multi-factor issue investigation
                    </div>
                    <div
                      key="deep3"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Complex data analysis and visualization
                    </div>
                    <div
                      key="deep4"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Scientific research assistance
                    </div>
                  </>
                )}

                {model.specialization === "Premium insights" && (
                  <>
                    <div
                      key="premium1"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      High-quality explanations for non-technical
                      stakeholders
                    </div>
                    <div
                      key="premium2"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Mission-critical issue analysis
                    </div>
                    <div
                      key="premium3"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Executive-level reporting and analysis
                    </div>
                    <div
                      key="premium4"
                      className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200"
                    >
                      Strategic decision support
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelInfoTab;