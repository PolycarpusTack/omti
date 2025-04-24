import React from 'react';
import { 
  ScatterChart,
  Scatter,
  XAxis, 
  YAxis, 
  ZAxis,
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

/**
 * Patterns tab component
 * Displays error pattern analysis and clustering
 */
const PatternsTab = ({ data, handlers }) => {
  const { 
    colors,
    topErrorPatterns
  } = data;

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Error Patterns */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Top Error Patterns</h3>
          <button className={`text-sm px-3 py-1 bg-${colors.background} border border-${colors.border} rounded-md text-${colors.text}`}>
            Export Patterns
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y divide-${colors.border}`}>
            <thead className={`bg-${colors.background}`}>
              <tr>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Error Pattern</th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Frequency</th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Last Occurred</th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Trend</th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Impact</th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Status</th>
              </tr>
            </thead>
            <tbody className={`bg-${colors.cardBackground} divide-y divide-${colors.border}`}>
              {topErrorPatterns.map((pattern, index) => (
                <tr key={index} className={`hover:bg-${colors.background} transition-colors duration-150`}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-${colors.text}`}>
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-md mr-3 ${
                        pattern.trend === 'increasing' 
                          ? `bg-${colors.error}/10 text-${colors.error}` 
                          : pattern.trend === 'decreasing'
                            ? `bg-${colors.success}/10 text-${colors.success}`
                            : `bg-${colors.warning}/10 text-${colors.warning}`
                      }`}>
                        {pattern.trend === 'increasing' ? '↑' : pattern.trend === 'decreasing' ? '↓' : '→'}
                      </div>
                      <span>{pattern.pattern}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-${colors.text}`}>
                    {pattern.frequency}
                    <span className={`ml-1 text-xs ${
                      pattern.trend === 'increasing' 
                        ? `text-${colors.error}` 
                        : pattern.trend === 'decreasing'
                          ? `text-${colors.success}`
                          : `text-${colors.secondaryText}`
                    }`}>
                      {pattern.trend === 'increasing' 
                        ? `(+${Math.floor(pattern.frequency * 0.2)})` 
                        : pattern.trend === 'decreasing' 
                          ? `(-${Math.floor(pattern.frequency * 0.1)})` 
                          : ''}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-${colors.text}`}>
                    {typeof pattern.lastOccurred === 'string' ? pattern.lastOccurred : '2 hours ago'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm`}>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${pattern.trend === 'increasing' 
                        ? `bg-${colors.error}/10 text-${colors.error}` 
                        : pattern.trend === 'decreasing'
                          ? `bg-${colors.success}/10 text-${colors.success}`
                          : `bg-${colors.warning}/10 text-${colors.warning}`
                      }`}>
                      {pattern.trend === 'increasing' ? '↑ Increasing' : 
                       pattern.trend === 'decreasing' ? '↓ Decreasing' : '→ Stable'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-${colors.text}`}>
                    <div className="flex items-center">
                      {(() => {
                        // Generate impact rating (high/medium/low) based on pattern frequency and trend
                        const impact = pattern.trend === 'increasing' && pattern.frequency > 5 ? 'High'
                                      : pattern.trend === 'increasing' || pattern.frequency > 7 ? 'Medium'
                                      : 'Low';
                        
                        const impactColors = {
                          High: 'text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200',
                          Medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200',
                          Low: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200'
                        };
                        
                        return (
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${impactColors[impact]}`}>
                            {impact}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-${colors.text}`}>
                    {index % 3 === 0 ? (
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${colors.error}/10 text-${colors.error}`}>
                        Open
                      </span>
                    ) : index % 3 === 1 ? (
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${colors.warning}/10 text-${colors.warning}`}>
                        In Progress
                      </span>
                    ) : (
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${colors.success}/10 text-${colors.success}`}>
                        Resolved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern Detection Model */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Pattern Detection & Clustering</h3>
          <div className="space-x-2">
            <button className={`text-sm px-3 py-1 bg-${colors.background} border border-${colors.border} rounded-md text-${colors.text}`}>
              Cluster Analysis
            </button>
            <button className={`text-sm px-3 py-1 bg-${colors.accent} text-white rounded-md`}>
              Run Detection
            </button>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="frequency" 
                tick={{ fill: colors.text }}
                label={{ value: 'Occurrence Frequency', position: 'insideBottom', fill: colors.text }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="severity" 
                tick={{ fill: colors.text }}
                label={{ value: 'Severity Weight', angle: -90, position: 'insideLeft', fill: colors.text }}
              />
              <ZAxis 
                type="number" 
                dataKey="z" 
                range={[60, 400]} 
                name="impact" 
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name, props) => {
                  if (name === 'frequency') return [value, 'Frequency'];
                  if (name === 'severity') return [value, 'Severity Weight'];
                  if (name === 'impact') return [value, 'Impact Score'];
                  return [value, name];
                }}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
                labelFormatter={(_, dataPoint) => `Pattern: ${dataPoint?.payload?.name || 'Unknown'}`}
              />
              <Legend 
                formatter={(value) => <span className={`text-${colors.text}`}>{value}</span>}
              />
              <Scatter 
                name="Error Patterns" 
                data={[
                  // Transformed from topErrorPatterns into x,y,z coordinates
                  ...topErrorPatterns.map((pattern, index) => ({
                    x: pattern.frequency,
                    y: pattern.trend === 'increasing' ? 8 : pattern.trend === 'decreasing' ? 3 : 5,
                    z: pattern.trend === 'increasing' ? pattern.frequency * 8 : pattern.frequency * 4,
                    name: pattern.pattern,
                    cluster: index % 3
                  })),
                  // Additional patterns for visualization
                  { x: 12, y: 9, z: 120, name: "Memory allocation failure", cluster: 0 },
                  { x: 8, y: 7, z: 90, name: "Timeout in API requests", cluster: 0 },
                  { x: 15, y: 5, z: 80, name: "Uncaught exception in handler", cluster: 1 },
                  { x: 5, y: 8, z: 60, name: "Config parsing error", cluster: 2 }
                ]}
                fill={colors.accent}
              />
              <Scatter 
                name="Cluster 1 (Critical)" 
                data={[
                  { x: 9, y: 9, z: 130, name: "Out of memory error", cluster: 0 },
                  { x: 12, y: 9, z: 120, name: "Memory allocation failure", cluster: 0 },
                  { x: 8, y: 7, z: 90, name: "Timeout in API requests", cluster: 0 }
                ]}
                fill={colors.error}
              />
              <Scatter 
                name="Cluster 2 (Processing)" 
                data={[
                  { x: 15, y: 5, z: 80, name: "Uncaught exception in handler", cluster: 1 },
                  { x: 10, y: 6, z: 70, name: "Query execution error", cluster: 1 },
                  { x: 7, y: 5, z: 50, name: "Invalid data format", cluster: 1 }
                ]}
                fill={colors.warning}
              />
              <Scatter 
                name="Cluster 3 (Configuration)" 
                data={[
                  { x: 5, y: 8, z: 60, name: "Config parsing error", cluster: 2 },
                  { x: 4, y: 3, z: 40, name: "Missing configuration key", cluster: 2 },
                  { x: 3, y: 4, z: 30, name: "Invalid environment setting", cluster: 2 }
                ]}
                fill={colors.success}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className={`mt-2 text-sm text-${colors.secondaryText}`}>
          <p>Pattern clusters identify related error types. Bubble size indicates impact severity.</p>
        </div>
      </div>
    </div>
  );
};

export default PatternsTab;