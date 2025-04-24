// src/components/ModelDetailsModal.js
import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const ModelDetailsModal = ({
  model,
  isOpen,
  onClose,
  onSelectModel,
  isSelected,
  onUpdateSettings,
  usageHistory = [], // Add this prop to receive usage history data
}) => {
  // Active tab state
  const [activeTab, setActiveTab] = useState("info");

  // Default model settings to use if model.settings is undefined
  const defaultSettings = {
    temperature: 0.7,
    topP: 0.9,
    maxTokensPerChunk: 4000,
    maxOutputTokens: 2000,
    frequencyPenalty: 0,
    presencePenalty: 0,
    timeout: 300,
    contentFilter: "standard",
    cachingEnabled: false,
    streamingEnabled: true,
  };

  // State for model-specific settings
  const [settings, setSettings] = useState(
    model && model.settings
      ? {
          temperature:
            model.settings.temperature ?? defaultSettings.temperature,
          topP: model.settings.topP ?? defaultSettings.topP,
          maxTokensPerChunk:
            model.settings.maxTokensPerChunk ??
            defaultSettings.maxTokensPerChunk,
          maxOutputTokens:
            model.settings.maxOutputTokens ?? defaultSettings.maxOutputTokens,
          frequencyPenalty:
            model.settings.frequencyPenalty ?? defaultSettings.frequencyPenalty,
          presencePenalty:
            model.settings.presencePenalty ?? defaultSettings.presencePenalty,
          timeout: model.settings.timeout ?? defaultSettings.timeout,
          contentFilter:
            model.settings.contentFilter ?? defaultSettings.contentFilter,
          cachingEnabled:
            model.settings.cachingEnabled ?? defaultSettings.cachingEnabled,
          streamingEnabled:
            model.settings.streamingEnabled ?? defaultSettings.streamingEnabled,
        }
      : defaultSettings
  );

  // Save original settings to enable comparison and reset
  const [originalSettings, setOriginalSettings] = useState({});

  // A/B testing state
  const [abTestingEnabled, setAbTestingEnabled] = useState(false);
  const [settingsB, setSettingsB] = useState({});
  const [testInput, setTestInput] = useState(
    "Explain the concept of recursion in programming."
  );
  const [testResponseA, setTestResponseA] = useState("");
  const [testResponseB, setTestResponseB] = useState("");
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);

  // State for model versioning - defer initialization to useEffect
  const [savedVersions, setSavedVersions] = useState([]);

  // Benchmark and analytics state
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState(null);
  const [benchmarkType, setBenchmarkType] = useState("quick");
  const [showAdvancedBenchmark, setShowAdvancedBenchmark] = useState(false);

  // State for real-time preview
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewInput, setPreviewInput] = useState(
    "Explain the importance of code optimization."
  );
  const [previewResponse, setPreviewResponse] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Access management state with safe default values
  const [accessSettings, setAccessSettings] = useState({
    canModifySettings: model?.accessSettings?.canModifySettings ?? true,
    canRunBenchmarks: model?.accessSettings?.canRunBenchmarks ?? true,
    canExportConfig: model?.accessSettings?.canExportConfig ?? true,
    visibleToTeams: model?.accessSettings?.visibleToTeams ?? [
      "Engineering",
      "Data Science",
    ],
  });

  // Notifications and alerts state with safe default values
  const [alerts, setAlerts] = useState({
    performanceThreshold: model?.alerts?.performanceThreshold ?? 5.0, // seconds
    errorRateThreshold: model?.alerts?.errorRateThreshold ?? 5, // percentage
    costAlertThreshold: model?.alerts?.costAlertThreshold ?? 100, // dollars
    notifyOnChange: model?.alerts?.notifyOnChange ?? true,
    recipients: model?.alerts?.recipients ?? [],
  });

  // Load original settings on initial render and initialize other state
  useEffect(() => {
    // Set original settings if model.settings exists
    if (model && model.settings) {
      setOriginalSettings({ ...model.settings });
    } else {
      // Otherwise use default settings
      setOriginalSettings({ ...settings });
    }

    // Initialize settings B for A/B testing
    setSettingsB({
      ...settings,
      temperature: Math.min(settings.temperature + 0.2, 1.0),
    });

    // Initialize saved versions with default examples
    if (savedVersions.length === 0) {
      setSavedVersions([
        {
          id: "v1",
          name: "Initial Setup",
          timestamp: "2025-03-15T12:00:00Z",
          settings: { ...settings },
        },
        {
          id: "v2",
          name: "Optimized for Code",
          timestamp: "2025-04-01T09:30:00Z",
          settings: { ...settings, temperature: 0.3, topP: 0.8 },
        },
      ]);
    }
  }, [model, settings]);

  // Simplified mock data for usage stats
  const usageStatsData = [
    { date: "2025-04-12", tokens: 125000, cost: 2.5, avgResponseTime: 2.1 },
    { date: "2025-04-13", tokens: 143000, cost: 2.86, avgResponseTime: 2.3 },
    { date: "2025-04-14", tokens: 168000, cost: 3.36, avgResponseTime: 2.2 },
    { date: "2025-04-15", tokens: 152000, cost: 3.04, avgResponseTime: 2.0 },
    { date: "2025-04-16", tokens: 187000, cost: 3.74, avgResponseTime: 2.4 },
    { date: "2025-04-17", tokens: 198000, cost: 3.96, avgResponseTime: 2.5 },
    { date: "2025-04-18", tokens: 176000, cost: 3.52, avgResponseTime: 2.3 },
  ];

  // Handle settings changes
  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Only apply changes if this is the currently selected model
    if (isSelected) {
      onUpdateSettings(model.id, newSettings);
    }

    // Generate real-time preview if enabled
    if (previewEnabled && !previewLoading) {
      generatePreview(newSettings);
    }
  };

  // Handle settings B changes for A/B testing
  const handleSettingBChange = (key, value) => {
    setSettingsB({ ...settingsB, [key]: value });
  };

  // Save current settings as a named version
  const saveCurrentVersion = (versionName) => {
    const newVersion = {
      id: `v${savedVersions.length + 1}`,
      name: versionName,
      timestamp: new Date().toISOString(),
      settings: { ...settings },
    };
    setSavedVersions([...savedVersions, newVersion]);
  };

  // Load a saved settings version
  const loadVersion = (versionId) => {
    const version = savedVersions.find((v) => v.id === versionId);
    if (version) {
      setSettings({ ...version.settings });
      if (isSelected) {
        onUpdateSettings(model.id, version.settings);
      }
    }
  };

  // Reset settings to original state
  const resetToOriginal = () => {
    setSettings({ ...originalSettings });
    if (isSelected) {
      onUpdateSettings(model.id, originalSettings);
    }
  };

  // Export settings as JSON
  const exportSettings = () => {
    const dataStr = JSON.stringify(
      {
        model: model.id,
        settings: settings,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      dataStr
    )}`;

    const exportFileDefaultName = `${model.id}-settings-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  // Import settings from JSON file
  const importSettings = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData && importedData.settings) {
          setSettings({ ...importedData.settings });
          if (isSelected) {
            onUpdateSettings(model.id, importedData.settings);
          }
        }
      } catch (error) {
        console.error("Error importing settings:", error);
      }
    };
    reader.readAsText(file);
  };

  // Save settings when closing the modal
  const handleClose = () => {
    // Update the model settings on close, even if not selected
    onUpdateSettings(model.id, settings);
    onClose();
  };

  // Run model benchmark
  const runBenchmark = () => {
    setBenchmarking(true);

    // This would actually connect to your backend to run a benchmark
    // For demo, we'll simulate it with different durations based on benchmark type
    setTimeout(
      () => {
        setBenchmarking(false);

        // Simulate different results based on benchmark type
        if (benchmarkType === "quick") {
          setBenchmarkResults({
            inferenceTime: (Math.random() * 2 + 0.5).toFixed(2),
            tokensPerSecond: Math.floor(Math.random() * 50 + 20),
            memoryUsage: `${(Math.random() * 5 + 2).toFixed(1)} GB`,
          });
        } else if (benchmarkType === "comprehensive") {
          setBenchmarkResults({
            inferenceTime: (Math.random() * 2 + 0.5).toFixed(2),
            tokensPerSecond: Math.floor(Math.random() * 50 + 20),
            memoryUsage: `${(Math.random() * 5 + 2).toFixed(1)} GB`,
            accuracyScore: (Math.random() * 10 + 85).toFixed(1) + "%",
            mmluScore: (Math.random() * 15 + 70).toFixed(1) + "%",
            humanEvalScore: (Math.random() * 20 + 60).toFixed(1) + "%",
            latencyP95: (Math.random() * 3 + 1).toFixed(2) + "s",
            costPer1MTokens: `$${(Math.random() * 2 + 0.5).toFixed(2)}`,
          });
        }
      },
      benchmarkType === "quick" ? 3000 : 8000
    );
  };

  // Generate real-time preview response
  const generatePreview = (settingsToUse = settings) => {
    setPreviewLoading(true);

    // Simulate API call to generate response based on current settings
    setTimeout(() => {
      const creativity = settingsToUse.temperature * 10; // simulate effect of temperature

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
  };

  // Generate A/B test responses
  const generateABTestResponses = () => {
    setIsGeneratingResponse(true);

    // This would be an actual API call to your backend
    // Simulating with setTimeout for demo purposes
    setTimeout(() => {
      // Generate response A (based on settings A)
      let responseA;
      if (settings.temperature < 0.5) {
        responseA =
          "Recursion in programming is a technique where a function calls itself to solve a problem. It requires a base case to prevent infinite loops. Example: calculating factorial where factorial(n) = n * factorial(n-1) and factorial(0) = 1.";
      } else {
        responseA =
          "Recursion is like a Russian nesting doll - a function that calls itself with a simpler version of the problem until it reaches a solution that's simple enough to solve directly. It's powerful for tasks like traversing trees, solving mathematical sequences, and breaking down complex problems into simpler pieces.";
      }

      // Generate response B (based on settings B)
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header with tabs */}
        <div className="flex flex-col mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  model.status === "healthy"
                    ? "bg-green-500"
                    : model.status === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                } mr-2`}
              ></div>
              <h2 className="text-xl font-bold dark:text-gray-100">
                {model.name}
              </h2>

              {model.provider && (
                <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs rounded-full">
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
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

          {/* Tab navigation */}
          <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("info")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "info"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Information
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "settings"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab("testing")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "testing"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Testing & Tuning
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "analytics"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("version")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "version"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Versioning
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "access"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Access & Alerts
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {/* Information Tab */}
          {activeTab === "info" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left column - Model information */}
              <div className="md:col-span-1 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
                    Model Information
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Size
                      </div>
                      <div className="font-medium dark:text-gray-200">
                        {model.size} parameters
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Specialization
                      </div>
                      <div className="font-medium dark:text-gray-200">
                        {model.specialization}
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
                          {model.status}
                        </span>
                      </div>
                    </div>

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
                  </div>
                </div>

                {/* Performance metrics */}
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
                        {model.avgResponseTime?.toFixed(1) || "-"} seconds
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Throughput
                      </div>
                      <div className="font-medium dark:text-gray-200">
                        {model.throughput?.toFixed(1) || "-"} tokens/sec
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

                {/* Description */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
                    Description
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {model.description ||
                      "A state-of-the-art language model optimized for natural language understanding and generation. Excels at creative writing, code analysis, and complex reasoning tasks."}
                  </p>
                </div>
              </div>

              {/* Right columns - Capabilities and benchmark */}
              <div className="md:col-span-2 space-y-6">
                {/* Capabilities */}
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
                </div>

                {/* Benchmark section */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium dark:text-gray-200">
                      Quick Benchmark
                    </h3>
                    <div className="flex items-center space-x-2">
                      <select
                        value={benchmarkType}
                        onChange={(e) => setBenchmarkType(e.target.value)}
                        className="text-sm p-1 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      >
                        <option value="quick">Quick Test</option>
                        <option value="comprehensive">Comprehensive</option>
                      </select>
                      <button
                        onClick={runBenchmark}
                        disabled={benchmarking}
                        className={`text-sm px-3 py-1 rounded ${
                          benchmarking
                            ? "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
                        }`}
                      >
                        {benchmarking ? "Running..." : "Run Benchmark"}
                      </button>
                    </div>
                  </div>

                  {benchmarking && (
                    <div className="flex flex-col items-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {benchmarkType === "quick"
                          ? "Running quick benchmark..."
                          : "Running comprehensive tests..."}
                      </div>
                    </div>
                  )}

                  {benchmarkResults && !benchmarking && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                      <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Inference Time
                        </div>
                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          {benchmarkResults.inferenceTime}s
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Tokens/Second
                        </div>
                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          {benchmarkResults.tokensPerSecond}
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Memory Usage
                        </div>
                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          {benchmarkResults.memoryUsage}
                        </div>
                      </div>

                      {benchmarkType === "comprehensive" && (
                        <>
                          <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Accuracy Score
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                              {benchmarkResults.accuracyScore}
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              MMLU Score
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                              {benchmarkResults.mmluScore}
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              HumanEval Score
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                              {benchmarkResults.humanEvalScore}
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Latency (P95)
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                              {benchmarkResults.latencyP95}
                            </div>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Cost/1M Tokens
                            </div>
                            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                              {benchmarkResults.costPer1MTokens}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!benchmarking && benchmarkType === "comprehensive" && (
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          setShowAdvancedBenchmark(!showAdvancedBenchmark)
                        }
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                      >
                        {showAdvancedBenchmark
                          ? "Hide Details"
                          : "Show Detailed Results"}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 ml-1 transition-transform ${
                            showAdvancedBenchmark ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {showAdvancedBenchmark && (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                          <h4 className="font-medium text-sm mb-2 dark:text-gray-200">
                            Benchmark Details
                          </h4>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p>
                              Test conducted with 150 standardized prompts
                              across multiple categories.
                            </p>
                            <p className="mt-1">
                              Hardware: 4x NVIDIA A100, 64 CPU cores, 256GB RAM
                            </p>
                            <div className="mt-2 text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <div>Technical questions: 91.2%</div>
                                <div>Creative writing: 87.6%</div>
                                <div>Reasoning tasks: 82.9%</div>
                                <div>Code generation: 78.4%</div>
                                <div>Factual recall: 94.1%</div>
                                <div>Instruction following: 96.3%</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recommended Use Cases */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3 dark:text-gray-200">
                    Recommended Use Cases
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {model.specialization === "Code analysis" && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Stack trace and exception analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Code-related error debugging
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Legacy code refactoring
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Security vulnerability detection
                        </div>
                      </>
                    )}

                    {(model.specialization === "Fast analysis" ||
                      model.specialization === "General purpose") && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Quick initial assessment of issues
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Standard log file analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Content generation and summarization
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Customer support automation
                        </div>
                      </>
                    )}

                    {model.specialization === "Technical depth" && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Complex technical issue analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Detailed root cause investigation
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          System architecture review
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Performance optimization guidance
                        </div>
                      </>
                    )}

                    {model.specialization === "Deep analysis" && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Comprehensive system-wide analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Multi-factor issue investigation
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Complex data analysis and visualization
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Scientific research assistance
                        </div>
                      </>
                    )}

                    {model.specialization === "Premium insights" && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          High-quality explanations for non-technical
                          stakeholders
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Mission-critical issue analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Executive-level reporting and analysis
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Strategic decision support
                        </div>
                      </>
                    )}

                    {!model.specialization && (
                      <>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          General conversational tasks
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Content generation and editing
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Data analysis and interpretation
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-600 rounded text-sm text-gray-800 dark:text-gray-200">
                          Code assistance and debugging
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Basic Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temperature */}
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Temperature
                    </label>
                    <div className="flex items-center gap-2">
                      <input
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
                      />
                      <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                        {settings.temperature}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Controls randomness: Lower is more deterministic, higher
                      is more creative
                    </p>
                  </div>

                  {/* Top P */}
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Top P
                    </label>
                    <div className="flex items-center gap-2">
                      <input
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
                      />
                      <span className="w-8 text-sm text-gray-700 dark:text-gray-300 text-right">
                        {settings.topP}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Controls diversity via nucleus sampling
                    </p>
                  </div>

                  {/* Max Tokens Per Chunk */}
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Max Tokens Per Chunk
                    </label>
                    <input
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
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Smaller values process faster but may miss context
                    </p>
                  </div>

                  {/* Max Output Tokens */}
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Max Output Tokens
                    </label>
                    <input
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
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Maximum length of model's response
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Advanced Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Frequency Penalty */}
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Frequency Penalty
                    </label>
                    <div className="flex items-center gap-2">
                      <input
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
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Presence Penalty
                    </label>
                    <div className="flex items-center gap-2">
                      <input
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
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Content Filter
                    </label>
                    <select
                      value={settings.contentFilter}
                      onChange={(e) =>
                        handleSettingChange("contentFilter", e.target.value)
                      }
                      className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
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
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Request Timeout (seconds)
                    </label>
                    <input
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
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Maximum time to wait for analysis
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Feature Toggles
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Response Streaming */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
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

                  {/* Response Caching */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
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
                </div>
              </div>
            </div>
          )}

          {/* Testing & Tuning Tab */}
          {activeTab === "testing" && (
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
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Sample Prompt
                    </label>
                    <textarea
                      value={previewInput}
                      onChange={(e) => setPreviewInput(e.target.value)}
                      className="w-full p-3 text-sm border rounded h-32 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      placeholder="Enter a sample prompt to test the model..."
                    ></textarea>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => generatePreview()}
                        disabled={previewLoading}
                        className={`px-3 py-1 text-sm rounded ${
                          previewLoading
                            ? "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
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
                      <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Test Prompt
                      </label>
                      <textarea
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        className="w-full p-3 text-sm border rounded h-24 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        placeholder="Enter a prompt to test different settings..."
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Configuration A (Current)
                        </h4>
                        <div className="space-y-3 p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Temperature
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                              />
                              <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                                {settings.temperature}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Top P
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                              />
                              <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                                {settings.topP}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Frequency Penalty
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Temperature
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                              />
                              <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                                {settingsB.temperature}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Top P
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                              />
                              <span className="w-8 text-xs text-gray-700 dark:text-gray-300 text-right">
                                {settingsB.topP}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Frequency Penalty
                            </div>
                            <div className="flex items-center gap-2">
                              <input
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
                        onClick={generateABTestResponses}
                        disabled={isGeneratingResponse}
                        className={`px-4 py-2 text-sm rounded ${
                          isGeneratingResponse
                            ? "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                      >
                        {isGeneratingResponse
                          ? "Generating..."
                          : "Compare Responses"}
                      </button>
                    </div>

                    {(testResponseA || testResponseB) &&
                      !isGeneratingResponse && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Response A (Current)
                            </h4>
                            <div className="p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 h-48 overflow-auto text-sm">
                              {testResponseA}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Response B (Test)
                            </h4>
                            <div className="p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 h-48 overflow-auto text-sm">
                              {testResponseB}
                            </div>
                          </div>
                        </div>
                      )}

                    {(testResponseA || testResponseB) &&
                      !isGeneratingResponse && (
                        <div className="mt-4 flex justify-end space-x-3">
                          <button
                            onClick={() => {
                              // Apply settings B to settings A
                              setSettings({ ...settingsB });
                              if (isSelected) {
                                onUpdateSettings(model.id, settingsB);
                              }
                            }}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Apply Configuration B
                          </button>
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* Usage Statistics */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Usage Statistics (Last 7 Days)
                </h3>

                <div className="mb-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={usageStatsData}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="tokens"
                        name="Tokens Used"
                        stroke="#3B82F6"
                        activeDot={{ r: 8 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgResponseTime"
                        name="Avg Response Time (s)"
                        stroke="#10B981"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Total Tokens
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {usageStatsData
                        .reduce((sum, day) => sum + day.tokens, 0)
                        .toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Total Cost
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      $
                      {usageStatsData
                        .reduce((sum, day) => sum + day.cost, 0)
                        .toFixed(2)}
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Avg Response Time
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {(
                        usageStatsData.reduce(
                          (sum, day) => sum + day.avgResponseTime,
                          0
                        ) / usageStatsData.length
                      ).toFixed(2)}
                      s
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Daily Avg
                    </div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {Math.round(
                        usageStatsData.reduce(
                          (sum, day) => sum + day.tokens,
                          0
                        ) / usageStatsData.length
                      ).toLocaleString()}{" "}
                      tokens
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-right">
                  <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline">
                    View Detailed Analytics
                  </button>
                </div>
              </div>

              {/* Performance Monitoring */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Performance Monitoring
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Response Time
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Good
                      </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                      2.3s
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      7-day average
                    </div>
                    <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ▼ 0.2s from last week
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Error Rate
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Good
                      </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                      0.8%
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      7-day average
                    </div>
                    <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ▼ 0.3% from last week
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Throughput
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        Average
                      </div>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                      32 tok/s
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      7-day average
                    </div>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                      ▲ 5 tok/s from last week
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                  <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Recent Events
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-yellow-400 mt-0.5 mr-2"></div>
                      <div>
                        <div className="text-gray-800 dark:text-gray-200">
                          Elevated response times detected
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          April 16, 2025 - 14:23 UTC
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-400 mt-0.5 mr-2"></div>
                      <div>
                        <div className="text-gray-800 dark:text-gray-200">
                          Performance returned to normal
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          April 16, 2025 - 16:45 UTC
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-400 mt-0.5 mr-2"></div>
                      <div>
                        <div className="text-gray-800 dark:text-gray-200">
                          Model settings updated
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          April 15, 2025 - 09:12 UTC
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Version Management Tab */}
          {activeTab === "version" && (
            <div className="space-y-6">
              {/* Version Management */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Settings Versions
                </h3>

                <div className="mb-4">
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      placeholder="Version name"
                      className="flex-grow p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      id="version-name"
                    />
                    <button
                      onClick={() => {
                        const nameInput =
                          document.getElementById("version-name");
                        if (nameInput.value.trim()) {
                          saveCurrentVersion(nameInput.value.trim());
                          nameInput.value = "";
                        }
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save Current
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Save the current configuration as a named version for future
                    use
                  </p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedVersions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {version.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(version.timestamp).toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            Temperature: {version.settings.temperature}
                          </span>
                          <span className="mx-1">•</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            Top P: {version.settings.topP}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => loadVersion(version.id)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import/Export */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Import/Export Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Export Settings
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Export your current model settings as a JSON file
                    </p>
                    <button
                      onClick={exportSettings}
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Download Settings
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Import Settings
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Import settings from a previously exported JSON file
                    </p>
                    <label className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm cursor-pointer inline-block">
                      <span>Upload Settings</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importSettings}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Reset Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Reset Settings
                </h3>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Reset all settings to their original values. This cannot be
                    undone.
                  </p>
                </div>

                <button
                  onClick={resetToOriginal}
                  className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          )}

          {/* Access & Alerts Tab */}
          {activeTab === "access" && (
            <div className="space-y-6">
              {/* Access Management */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Access Management
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Visible to Teams
                    </label>
                    <select
                      multiple
                      value={accessSettings.visibleToTeams}
                      onChange={(e) => {
                        const options = [...e.target.selectedOptions];
                        const selectedValues = options.map(
                          (option) => option.value
                        );
                        setAccessSettings({
                          ...accessSettings,
                          visibleToTeams: selectedValues,
                        });
                      }}
                      className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white h-32"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Data Science">Data Science</option>
                      <option value="Product">Product</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Support">Support</option>
                      <option value="Executive">Executive</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Control which teams can see and use this model
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                          Can Modify Settings
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Allow users to change model settings
                        </p>
                      </div>
                      <div className="relative inline-block w-12 h-6 ml-2">
                        <input
                          type="checkbox"
                          className="opacity-0 w-0 h-0"
                          checked={accessSettings.canModifySettings}
                          onChange={(e) =>
                            setAccessSettings({
                              ...accessSettings,
                              canModifySettings: e.target.checked,
                            })
                          }
                          id="modify-settings-toggle"
                        />
                        <label
                          htmlFor="modify-settings-toggle"
                          className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                            accessSettings.canModifySettings
                              ? "bg-blue-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                              accessSettings.canModifySettings
                                ? "left-7"
                                : "left-1"
                            } top-1`}
                          ></span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                          Can Run Benchmarks
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Allow users to benchmark the model
                        </p>
                      </div>
                      <div className="relative inline-block w-12 h-6 ml-2">
                        <input
                          type="checkbox"
                          className="opacity-0 w-0 h-0"
                          checked={accessSettings.canRunBenchmarks}
                          onChange={(e) =>
                            setAccessSettings({
                              ...accessSettings,
                              canRunBenchmarks: e.target.checked,
                            })
                          }
                          id="run-benchmarks-toggle"
                        />
                        <label
                          htmlFor="run-benchmarks-toggle"
                          className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                            accessSettings.canRunBenchmarks
                              ? "bg-blue-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                              accessSettings.canRunBenchmarks
                                ? "left-7"
                                : "left-1"
                            } top-1`}
                          ></span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                          Can Export Config
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Allow users to export settings
                        </p>
                      </div>
                      <div className="relative inline-block w-12 h-6 ml-2">
                        <input
                          type="checkbox"
                          className="opacity-0 w-0 h-0"
                          checked={accessSettings.canExportConfig}
                          onChange={(e) =>
                            setAccessSettings({
                              ...accessSettings,
                              canExportConfig: e.target.checked,
                            })
                          }
                          id="export-config-toggle"
                        />
                        <label
                          htmlFor="export-config-toggle"
                          className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                            accessSettings.canExportConfig
                              ? "bg-blue-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                              accessSettings.canExportConfig
                                ? "left-7"
                                : "left-1"
                            } top-1`}
                          ></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts & Notifications */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
                  Alerts & Notifications
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Alert Recipients
                    </label>
                    <textarea
                      placeholder="Enter email addresses separated by commas"
                      value={alerts.recipients.join(", ")}
                      onChange={(e) =>
                        setAlerts({
                          ...alerts,
                          recipients: e.target.value
                            .split(",")
                            .map((email) => email.trim()),
                        })
                      }
                      className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white h-20"
                    ></textarea>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Who should receive alert notifications
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Performance Threshold (seconds)
                      </label>
                      <input
                        type="number"
                        value={alerts.performanceThreshold}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            performanceThreshold:
                              parseFloat(e.target.value) || 5.0,
                          })
                        }
                        className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        min="0.1"
                        step="0.1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Alert when response time exceeds this threshold
                      </p>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Error Rate Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={alerts.errorRateThreshold}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            errorRateThreshold: parseFloat(e.target.value) || 5,
                          })
                        }
                        className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        min="0.1"
                        max="100"
                        step="0.1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Alert when error rate exceeds this percentage
                      </p>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Cost Alert Threshold ($)
                      </label>
                      <input
                        type="number"
                        value={alerts.costAlertThreshold}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            costAlertThreshold:
                              parseFloat(e.target.value) || 100,
                          })
                        }
                        className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        min="1"
                        step="1"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Alert when daily cost exceeds this amount
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                          Notify on Settings Change
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Send notification when settings are modified
                        </p>
                      </div>
                      <div className="relative inline-block w-12 h-6 ml-2">
                        <input
                          type="checkbox"
                          className="opacity-0 w-0 h-0"
                          checked={alerts.notifyOnChange}
                          onChange={(e) =>
                            setAlerts({
                              ...alerts,
                              notifyOnChange: e.target.checked,
                            })
                          }
                          id="notify-change-toggle"
                        />
                        <label
                          htmlFor="notify-change-toggle"
                          className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                            alerts.notifyOnChange
                              ? "bg-blue-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span
                            className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                              alerts.notifyOnChange ? "left-7" : "left-1"
                            } top-1`}
                          ></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-right">
                    <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                      Save Alert Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>

          {model.loaded && !isSelected && (
            <button
              onClick={() => {
                onSelectModel(model.id);
                onClose();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Select This Model
            </button>
          )}

          {isSelected && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Update Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelDetailsModal;
