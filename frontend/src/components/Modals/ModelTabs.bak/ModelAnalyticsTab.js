// src/components/Modals/ModelTabs/ModelAnalyticsTab.js
import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

// Default demo data to use when no real data is available
const demoData = [
  {
    date: "2025-04-12",
    tokens: 125000,
    cost: 2.5,
    avgResponseTime: 2.1,
  },
  {
    date: "2025-04-13",
    tokens: 143000,
    cost: 2.86,
    avgResponseTime: 2.3,
  },
  {
    date: "2025-04-14",
    tokens: 168000,
    cost: 3.36,
    avgResponseTime: 2.2,
  },
  {
    date: "2025-04-15",
    tokens: 152000,
    cost: 3.04,
    avgResponseTime: 2.0,
  },
  {
    date: "2025-04-16",
    tokens: 187000,
    cost: 3.74,
    avgResponseTime: 2.4,
  },
  {
    date: "2025-04-17",
    tokens: 198000,
    cost: 3.96,
    avgResponseTime: 2.5,
  },
  {
    date: "2025-04-18",
    tokens: 176000,
    cost: 3.52,
    avgResponseTime: 2.3,
  },
];

// Format date for display in chart
const formatDate = (dateStr) => {
  // Handle various date formats or return the string if parsing fails
  try {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date) 
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : dateStr;
  } catch (e) {
    console.error("Error formatting date:", e);
    return dateStr;
  }
};

const ModelAnalyticsTab = ({ usageHistory = [], viewMode }) => {
  // Chart rendering state
  const [chartReady, setChartReady] = useState(false);
  const chartContainerRef = useRef(null);
  const [chartDimensions, setChartDimensions] = useState({
    width: 0,
    height: 0,
  });
  
  // Selected metric state for detailed analysis
  const [selectedMetric, setSelectedMetric] = useState("tokens");
  
  // Data validation and preparation
  const chartData = usageHistory.length > 0 
    ? usageHistory.map(entry => ({
        ...entry,
        formattedDate: formatDate(entry.date)
      }))
    : demoData.map(entry => ({
        ...entry,
        formattedDate: formatDate(entry.date)
      }));

  // Detect if we're using demo data
  const isUsingDemoData = usageHistory.length === 0;

  // Effect for chart rendering
  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Effect to handle chart container resizing
  useEffect(() => {
    if (!chartContainerRef.current || !chartReady) return;

    if (typeof ResizeObserver === "undefined") {
      console.warn(
        "ResizeObserver not available in this browser. Chart might not resize correctly."
      );
      // Fallback: Set initial dimensions based on parent
      const parentWidth = chartContainerRef.current.offsetWidth;
      const parentHeight = chartContainerRef.current.offsetHeight;
      if (parentWidth > 0 && parentHeight > 0) {
        setChartDimensions({ width: parentWidth, height: parentHeight });
      }
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && entries[0].contentRect) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          setChartDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(chartContainerRef.current);
    
    // Set initial dimensions
    const initialWidth = chartContainerRef.current.offsetWidth;
    const initialHeight = chartContainerRef.current.offsetHeight;
    if (initialWidth > 0 && initialHeight > 0) {
      setChartDimensions({ width: initialWidth, height: initialHeight });
    }

    return () => {
      if (chartContainerRef.current) {
        resizeObserver.disconnect();
      }
    };
  }, [chartReady]);

  // Calculate metrics
  const totalTokens = chartData.reduce((sum, day) => sum + day.tokens, 0);
  const totalCost = chartData.reduce((sum, day) => sum + day.cost, 0);
  const avgResponseTime = chartData.reduce((sum, day) => sum + day.avgResponseTime, 0) / chartData.length;

  // Get min/max values for the selected metric
  const getMetricMinMax = (metricName) => {
    const values = chartData.map(item => item[metricName]);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  // Line colors with CSS variable fallbacks for theme compatibility
  const lineColors = {
    tokens: "var(--chart-blue, #3B82F6)",
    cost: "var(--chart-purple, #8B5CF6)",
    avgResponseTime: "var(--chart-green, #10B981)"
  };

  return (
    <div className="space-y-6">
      {/* Usage summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Total Tokens (7d)
          </h4>
          <div className="text-2xl font-semibold dark:text-gray-200">
            {totalTokens.toLocaleString()}
          </div>
          {isUsingDemoData && (
            <div className="text-xs text-amber-500 mt-1">
              Demo data - Connect to API for real metrics
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Total Cost (7d)
          </h4>
          <div className="text-2xl font-semibold dark:text-gray-200">
            ${totalCost.toFixed(2)}
          </div>
          {isUsingDemoData && (
            <div className="text-xs text-amber-500 mt-1">
              Demo data - Connect to API for real metrics
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            Avg. Response Time
          </h4>
          <div className="text-2xl font-semibold dark:text-gray-200">
            {avgResponseTime.toFixed(2)}s
          </div>
          {isUsingDemoData && (
            <div className="text-xs text-amber-500 mt-1">
              Demo data - Connect to API for real metrics
            </div>
          )}
        </div>
      </div>

      {/* Primary chart */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium dark:text-gray-200">
            Usage Statistics (Last 7 Days)
          </h3>
          <div className="flex space-x-1">
            <button 
              onClick={() => setSelectedMetric("tokens")}
              className={`px-3 py-1 text-xs rounded ${
                selectedMetric === "tokens" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
              }`}
            >
              Tokens
            </button>
            <button 
              onClick={() => setSelectedMetric("cost")}
              className={`px-3 py-1 text-xs rounded ${
                selectedMetric === "cost" 
                  ? "bg-purple-500 text-white" 
                  : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
              }`}
            >
              Cost
            </button>
            <button 
              onClick={() => setSelectedMetric("avgResponseTime")}
              className={`px-3 py-1 text-xs rounded ${
                selectedMetric === "avgResponseTime" 
                  ? "bg-green-500 text-white" 
                  : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
              }`}
            >
              Response Time
            </button>
          </div>
        </div>

        <div className="mb-6 h-64 md:h-80" ref={chartContainerRef}>
          {chartReady &&
          chartDimensions.width > 0 &&
          chartDimensions.height > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-color, #4A5568)" />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="var(--axis-color, #A0AEC0)"
                  tick={{ fill: "var(--text-color, #A0AEC0)" }}
                />
                <YAxis 
                  stroke="var(--axis-color, #A0AEC0)"
                  tick={{ fill: "var(--text-color, #A0AEC0)" }}
                  domain={[
                    dataMin => Math.floor(dataMin * 0.9), // Start slightly below minimum
                    dataMax => Math.ceil(dataMax * 1.1)   // End slightly above maximum
                  ]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tooltip-bg, rgba(30, 41, 59, 0.9))",
                    borderColor: "var(--tooltip-border, #4A5568)",
                    color: "var(--tooltip-text, #E2E8F0)",
                  }}
                  itemStyle={{ color: "var(--tooltip-item, #E2E8F0)" }}
                  formatter={(value, name) => {
                    if (name === "tokens") return [value.toLocaleString(), "Tokens"];
                    if (name === "cost") return [`$${value.toFixed(2)}`, "Cost"];
                    if (name === "avgResponseTime") return [`${value.toFixed(2)}s`, "Avg. Response Time"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend 
                  wrapperStyle={{ color: "var(--legend-color, #A0AEC0)" }} 
                  formatter={(value) => {
                    if (value === "tokens") return "Tokens Used";
                    if (value === "cost") return "Cost ($)";
                    if (value === "avgResponseTime") return "Avg. Response Time (s)";
                    return value;
                  }}
                />
                
                {selectedMetric === "tokens" && (
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    stroke={lineColors.tokens}
                    activeDot={{
                      r: 8,
                      fill: "#3B82F6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    dot={{ r: 4, fill: "#3B82F6" }}
                    name="tokens"
                  />
                )}
                
                {selectedMetric === "cost" && (
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke={lineColors.cost}
                    activeDot={{
                      r: 8,
                      fill: "#8B5CF6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    dot={{ r: 4, fill: "#8B5CF6" }}
                    name="cost"
                  />
                )}
                
                {selectedMetric === "avgResponseTime" && (
                  <Line
                    type="monotone"
                    dataKey="avgResponseTime"
                    stroke={lineColors.avgResponseTime}
                    activeDot={{
                      r: 8,
                      fill: "#10B981",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    dot={{ r: 4, fill: "#10B981" }}
                    name="avgResponseTime"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              {chartReady ? "Adjusting chart..." : "Loading chart..."}
            </div>
          )}
        </div>
        
        {/* Chart legend and info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {isUsingDemoData ? (
            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded text-yellow-800 dark:text-yellow-200">
              Displaying demo data. Connect to the API endpoint to see actual usage statistics.
            </div>
          ) : (
            <div>
              Data represents actual usage from {formatDate(chartData[0]?.date)} to {formatDate(chartData[chartData.length - 1]?.date)}
            </div>
          )}
        </div>
      </div>

      {/* Data table for more detailed view */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg overflow-auto">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Detailed Usage Data
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tokens Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cost ($)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg. Response Time (s)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {chartData.map((day, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {day.formattedDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {day.tokens.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${day.cost.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {day.avgResponseTime.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total
                </td>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {totalTokens.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ${totalCost.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  {avgResponseTime.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModelAnalyticsTab;