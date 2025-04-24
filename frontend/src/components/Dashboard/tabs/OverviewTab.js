import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { CHART_TYPES } from '../dashboardConstants';

/**
 * Overview tab component
 * Displays high-level summary of analytics data
 */
const OverviewTab = ({ data, handlers }) => {
  const { 
    colors,
    issuesByType,
    issuesBySeverity,
    issuesTrend,
    showProjections,
    selectedIssueType,
    formatUtils
  } = data;

  const { 
    onChartSelect,
    onSelectIssueType
  } = handlers;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Issues by Severity */}
      <div 
        className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}
        onClick={() => onChartSelect(CHART_TYPES.ISSUE_SEVERITY)}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Issues by Severity</h3>
          <button className={`text-${colors.secondaryText} hover:text-${colors.text}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={Object.entries(issuesBySeverity).map(([name, value]) => ({ name, value }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {Object.entries(issuesBySeverity).map(([name], index) => {
                  let color;
                  switch(name.toLowerCase()) {
                    case 'critical': color = colors.error; break;
                    case 'high': color = colors.warning; break;
                    case 'medium': color = colors.info; break;
                    case 'low': color = colors.success; break;
                    default: color = colors.chartColors[index % colors.chartColors.length];
                  }
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [`${value} issues`, name]}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
              />
              <Legend 
                formatter={(value) => <span className={`text-${colors.text}`}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Root Causes */}
      <div 
        className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}
        onClick={() => onChartSelect(CHART_TYPES.ROOT_CAUSES)}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Common Root Causes</h3>
          <button className={`text-${colors.secondaryText} hover:text-${colors.text}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={Object.entries(issuesByType)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fill: colors.text }}
                width={90}
              />
              <Tooltip 
                formatter={(value) => [`${value} issues`, 'Count']}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
              />
              <Bar 
                dataKey="value" 
                fill={colors.accent}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Issue Trends */}
      <div 
        className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm lg:col-span-2`}
        onClick={() => onChartSelect(CHART_TYPES.ISSUE_TRENDS)}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Issue Trends</h3>
          <div className="flex space-x-2">
            <button 
              className={`text-xs py-1 px-2 rounded ${selectedIssueType === null ? `bg-${colors.accent} text-white` : `bg-${colors.cardBackground} text-${colors.text} border border-${colors.border}`}`}
              onClick={(e) => { e.stopPropagation(); onSelectIssueType(null); }}
            >
              All
            </button>
            <button 
              className={`text-xs py-1 px-2 rounded ${selectedIssueType === 'critical' ? `bg-${colors.error} text-white` : `bg-${colors.cardBackground} text-${colors.text} border border-${colors.border}`}`}
              onClick={(e) => { e.stopPropagation(); onSelectIssueType('critical'); }}
            >
              Critical
            </button>
            <button 
              className={`text-xs py-1 px-2 rounded ${selectedIssueType === 'high' ? `bg-${colors.warning} text-white` : `bg-${colors.cardBackground} text-${colors.text} border border-${colors.border}`}`}
              onClick={(e) => { e.stopPropagation(); onSelectIssueType('high'); }}
            >
              High
            </button>
            <button 
              className={`text-xs py-1 px-2 rounded ${selectedIssueType === 'medium' ? `bg-${colors.info} text-white` : `bg-${colors.cardBackground} text-${colors.text} border border-${colors.border}`}`}
              onClick={(e) => { e.stopPropagation(); onSelectIssueType('medium'); }}
            >
              Medium
            </button>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={issuesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatUtils.formatDate}
                tick={{ fill: colors.text }}
              />
              <YAxis tick={{ fill: colors.text }} />
              <Tooltip 
                labelFormatter={formatUtils.formatDate}
                formatter={(value, name) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                contentStyle={{ 
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                  color: colors.text
                }}
              />
              <Legend 
                formatter={(value) => <span className={`text-${colors.text}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>}
              />
              {(!selectedIssueType || selectedIssueType === 'critical') && (
                <Line 
                  type="monotone" 
                  dataKey="critical" 
                  stroke={colors.error} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
                />
              )}
              {(!selectedIssueType || selectedIssueType === 'high') && (
                <Line 
                  type="monotone" 
                  dataKey="high" 
                  stroke={colors.warning} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
                />
              )}
              {(!selectedIssueType || selectedIssueType === 'medium') && (
                <Line 
                  type="monotone" 
                  dataKey="medium" 
                  stroke={colors.info} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
                />
              )}
              {!selectedIssueType && (
                <Line 
                  type="monotone" 
                  dataKey="low" 
                  stroke={colors.success} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  strokeDasharray={(d) => d.isProjection ? "3 3" : ""}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {showProjections && (
          <div className={`mt-2 text-xs text-${colors.secondaryText} italic`}>
            Dotted lines represent projected trends based on historical data
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;