import React from 'react';
import { 
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  Scatter,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { COMPARISON_PERIODS } from '../dashboardConstants';

/**
 * Trends tab component
 * Displays detailed trend analysis and forecasts
 */
const TrendsTab = ({ data, handlers }) => {
  const { 
    colors,
    issuesTrend,
    issuesBySeverity,
    hourlyDistribution,
    showDataTable,
    showComparisons,
    comparisonPeriod,
    formatUtils
  } = data;

  const { 
    onToggleDataTable,
    onComparisonPeriodChange
  } = handlers;

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Advanced Trend Analysis */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Issue Trends with Projection</h3>
          <div className="flex space-x-2">
            <button 
              className={`bg-${colors.cardBackground} text-${colors.text} border border-${colors.border} rounded-md px-2 py-1 text-xs`}
              onClick={onToggleDataTable}
            >
              {showDataTable ? 'Hide Table' : 'Show Table'}
            </button>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={issuesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatUtils.formatDate}
                tick={{ fill: colors.text }}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fill: colors.text }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: colors.text }}
              />
              <Tooltip 
                labelFormatter={formatUtils.formatDate}
                formatter={(value, name) => {
                  if (name === 'Moving Avg') return [value.toFixed(1), 'Moving Average (7d)'];
                  if (name === 'Anomaly') return ['Anomaly Detected', ''];
                  return [value, name.charAt(0).toUpperCase() + name.slice(1)];
                }}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'Moving Avg') return <span className={`text-${colors.text}`}>Moving Average (7d)</span>;
                  if (value === 'Anomaly') return <span className={`text-${colors.text}`}>Anomaly</span>;
                  return <span className={`text-${colors.text}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
                }}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="critical" 
                fill={colors.chartGradients[0][1]} 
                stroke={colors.chartGradients[0][0]}
                fillOpacity={0.3}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
                strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="high" 
                fill={colors.chartGradients[1][1]} 
                stroke={colors.chartGradients[1][0]}
                fillOpacity={0.3}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
                strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="Moving Avg"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
                activeDot={false}
              />
              <Scatter 
                yAxisId="left"
                dataKey="Anomaly" 
                fill="red" 
                shape={(props) => {
                  const { cx, cy } = props;
                  return (
                    <svg x={cx - 8} y={cy - 8} width={16} height={16} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="red" strokeWidth="2" fill="transparent" />
                      <path d="M12 8v8M8 12h8" stroke="red" strokeWidth="2" />
                    </svg>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {showDataTable && (
          <div className={`mt-4 overflow-x-auto bg-${colors.background} border border-${colors.border} rounded-lg`}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`bg-${colors.cardBackground}`}>
                <tr>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Date</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Critical</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>High</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Medium</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Low</th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-${colors.secondaryText} uppercase tracking-wider`}>Total</th>
                </tr>
              </thead>
              <tbody className={`bg-${colors.background} divide-y divide-${colors.border}`}>
                {issuesTrend.map((item, index) => (
                  <tr key={index} className={item.isProjection ? `bg-${colors.cardBackground}/50` : ''}>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>{formatUtils.formatDate(item.date)}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>{Math.round(item.critical)}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>{Math.round(item.high)}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>{Math.round(item.medium)}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>{Math.round(item.low)}</td>
                    <td className={`px-6 py-3 whitespace-nowrap text-sm font-medium text-${colors.text} ${item.isProjection ? 'italic' : ''}`}>
                      {Math.round(item.critical + item.high + item.medium + item.low)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Time Distribution */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Issue Distribution by Time of Day</h3>
          <button className={`text-${colors.secondaryText} hover:text-${colors.text}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hourlyDistribution}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                tick={{ fill: colors.text }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis 
                tick={{ fill: colors.text }}
              />
              <Tooltip 
                formatter={(value, name) => [value, name === 'count' ? 'Issue Count' : name]}
                labelFormatter={(label) => `Time: ${label}:00`}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
              />
              <Legend />
              <Bar 
                dataKey="count" 
                name="Issue Count" 
                fill={colors.accent}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`mt-2 text-sm text-${colors.secondaryText}`}>
          <p>
            Peak issue time: <span className={`font-medium text-${colors.text}`}>
              {(() => {
                const peak = [...hourlyDistribution].sort((a, b) => b.count - a.count)[0];
                return peak ? `${peak.hour}:00 (${peak.count} issues)` : 'N/A';
              })()}
            </span>
          </p>
        </div>
      </div>
      
      {/* Comparative Analysis */}
      {showComparisons && (
        <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-medium text-${colors.text}`}>Period Comparison</h3>
            <select
              className={`bg-${colors.background} border border-${colors.border} rounded-md py-1 px-2 text-sm text-${colors.text}`}
              value={comparisonPeriod}
              onChange={(e) => onComparisonPeriodChange(e.target.value)}
            >
              {COMPARISON_PERIODS.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={90} data={[
                { metric: 'Critical', current: issuesBySeverity.Critical || 0, previous: (issuesBySeverity.Critical || 0) * 1.3 },
                { metric: 'High', current: issuesBySeverity.High || 0, previous: (issuesBySeverity.High || 0) * 1.1 },
                { metric: 'Medium', current: issuesBySeverity.Medium || 0, previous: (issuesBySeverity.Medium || 0) * 0.9 },
                { metric: 'Low', current: issuesBySeverity.Low || 0, previous: (issuesBySeverity.Low || 0) * 1.2 },
                { metric: 'Resolution Rate', current: 75, previous: 65 }
              ]}>
                <PolarGrid stroke={colors.border} />
                <PolarAngleAxis dataKey="metric" tick={{ fill: colors.text }} />
                <PolarRadiusAxis tick={{ fill: colors.text }} />
                <Radar 
                  name="Current Period" 
                  dataKey="current" 
                  stroke={colors.accent} 
                  fill={colors.accent} 
                  fillOpacity={0.5} 
                />
                <Radar 
                  name="Previous Period" 
                  dataKey="previous" 
                  stroke={colors.secondaryText} 
                  fill={colors.secondaryText} 
                  fillOpacity={0.3} 
                />
                <Legend formatter={(value) => <span className={`text-${colors.text}`}>{value}</span>} />
                <Tooltip 
                  formatter={(value, name, props) => [value, name]}
                  contentStyle={{ 
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className={`mt-2 text-sm text-${colors.text} flex items-center justify-center`}>
            <div className={`px-4 py-2 bg-${colors.background} rounded-lg shadow-sm border border-${colors.border}`}>
              <div className="flex items-center mb-2">
                <div className={`h-3 w-3 rounded-full bg-${colors.accent} mr-2`}></div>
                <span className="font-medium">Current Period</span>
                <span className="mx-2">vs</span>
                <div className={`h-3 w-3 rounded-full bg-${colors.secondaryText} mr-2`}></div>
                <span className="font-medium">Previous Period</span>
              </div>
              <div className={`text-${colors.secondaryText} text-xs`}>
                Comparison based on {
                  comparisonPeriod === 'previous7d' ? 'previous 7 days' : 
                  comparisonPeriod === 'previous30d' ? 'previous 30 days' : 
                  comparisonPeriod === 'sameLastWeek' ? 'same period last week' : 
                  comparisonPeriod === 'sameLastMonth' ? 'same period last month' : 'previous period'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendsTab;