import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * Impact tab component
 * Displays business impact analysis of issues
 */
const ImpactTab = ({ data, handlers }) => {
  const { colors, impactMetrics } = data;

  // Default impact data if metrics are not available
  const defaultImpactData = {
    estimatedCost: 12500,
    costIncrease: 18,
    affectedSystems: 8,
    estimatedResolutionHours: 42,
    hoursSaved: '15%'
  };

  // Use actual metrics or defaults
  const metrics = impactMetrics || defaultImpactData;

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Business Impact Metrics */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-lg font-medium text-${colors.text}`}>Business Impact Assessment</h3>
          <div className="flex items-center">
            <span className={`text-sm text-${colors.secondaryText} mr-2`}>Severity Weighting:</span>
            <select className={`bg-${colors.background} border border-${colors.border} rounded-md py-1 px-2 text-sm text-${colors.text}`}>
              <option value="standard">Standard</option>
              <option value="business">Business-focused</option>
              <option value="technical">Technical-focused</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Estimated Business Impact Card */}
          <div className={`bg-${colors.background} p-4 rounded-lg border border-${colors.border}`}>
            <h4 className={`text-sm font-medium text-${colors.secondaryText} uppercase`}>Estimated Business Impact</h4>
            <div className="mt-2 flex items-baseline">
              <p className={`text-3xl font-bold text-${colors.text}`}>
                {`$${metrics.estimatedCost.toLocaleString()}`}
              </p>
              <p className={`ml-2 text-sm text-${colors.error}`}>
                +{metrics.costIncrease}%
              </p>
            </div>
            <p className={`mt-1 text-xs text-${colors.secondaryText}`}>Based on error frequency and severity</p>
          </div>
          
          {/* Affected Systems Card */}
          <div className={`bg-${colors.background} p-4 rounded-lg border border-${colors.border}`}>
            <h4 className={`text-sm font-medium text-${colors.secondaryText} uppercase`}>Affected Systems</h4>
            <div className="mt-2 flex items-baseline">
              <p className={`text-3xl font-bold text-${colors.text}`}>
                {metrics.affectedSystems}
              </p>
              <p className={`ml-2 text-sm text-${colors.warning}`}>Critical: 3</p>
            </div>
            <p className={`mt-1 text-xs text-${colors.secondaryText}`}>Systems with reported issues</p>
          </div>
          
          {/* Estimated Resolution Hours Card */}
          <div className={`bg-${colors.background} p-4 rounded-lg border border-${colors.border}`}>
            <h4 className={`text-sm font-medium text-${colors.secondaryText} uppercase`}>Est. Resolution Hours</h4>
            <div className="mt-2 flex items-baseline">
              <p className={`text-3xl font-bold text-${colors.text}`}>
                {metrics.estimatedResolutionHours}
              </p>
              <p className={`ml-2 text-sm text-${colors.success}`}>
                -{metrics.hoursSaved}
              </p>
            </div>
            <p className={`mt-1 text-xs text-${colors.secondaryText}`}>Developer hours required</p>
          </div>
        </div>
        
        {/* Impact Breakdown Chart */}
        <div className={`bg-${colors.background} p-4 rounded-lg border border-${colors.border} mb-6`}>
          <h4 className={`text-sm font-medium text-${colors.secondaryText} uppercase mb-4`}>Impact Breakdown by Category</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Development', impact: 6800, previous: 5200 },
                  { name: 'Operations', impact: 3200, previous: 4100 },
                  { name: 'Customer Support', impact: 2500, previous: 1800 },
                  { name: 'Revenue Loss', impact: 5300, previous: 4700 },
                  { name: 'Reputation', impact: 1500, previous: 1200 }
                ]}
                margin={{ top: 20, right: 30, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: colors.text }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${value}`}
                  tick={{ fill: colors.text }}
                />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Impact Cost']}
                  contentStyle={{ 
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    color: colors.text
                  }}
                />
                <Legend formatter={(value) => <span className={`text-${colors.text}`}>{value}</span>} />
                <Bar dataKey="impact" name="Current Period" fill={colors.accent} />
                <Bar dataKey="previous" name="Previous Period" fill={colors.secondaryText} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Recommendations Section */}
        <div className={`bg-${colors.background} p-4 rounded-lg border border-${colors.border}`}>
          <h4 className={`text-sm font-medium text-${colors.secondaryText} uppercase mb-4`}>Recommendations</h4>
          <div className="space-y-4">
            <div className={`p-3 border-l-4 border-${colors.error} bg-${colors.error}/5 rounded-r-lg`}>
              <h5 className={`text-sm font-medium text-${colors.text}`}>Critical: Address Memory Management</h5>
              <p className={`mt-1 text-sm text-${colors.secondaryText}`}>
                Memory-related errors account for 35% of critical issues. Implement memory pooling and improve cleanup procedures.
              </p>
              <div className="mt-2 flex justify-between">
                <span className={`text-xs text-${colors.secondaryText}`}>Estimated impact reduction: 28%</span>
                <span className={`text-xs text-${colors.error} font-medium`}>High Priority</span>
              </div>
            </div>
            
            <div className={`p-3 border-l-4 border-${colors.warning} bg-${colors.warning}/5 rounded-r-lg`}>
              <h5 className={`text-sm font-medium text-${colors.text}`}>Important: Improve Timeout Handling</h5>
              <p className={`mt-1 text-sm text-${colors.secondaryText}`}>
                API timeout issues show increasing trend. Implement retry mechanisms with exponential backoff.
              </p>
              <div className="mt-2 flex justify-between">
                <span className={`text-xs text-${colors.secondaryText}`}>Estimated impact reduction: 15%</span>
                <span className={`text-xs text-${colors.warning} font-medium`}>Medium Priority</span>
              </div>
            </div>
            
            <div className={`p-3 border-l-4 border-${colors.info} bg-${colors.info}/5 rounded-r-lg`}>
              <h5 className={`text-sm font-medium text-${colors.text}`}>Suggestion: Refactor Configuration System</h5>
              <p className={`mt-1 text-sm text-${colors.secondaryText}`}>
                Configuration errors persist across versions. Consider implementing centralized configuration management.
              </p>
              <div className="mt-2 flex justify-between">
                <span className={`text-xs text-${colors.secondaryText}`}>Estimated impact reduction: 10%</span>
                <span className={`text-xs text-${colors.info} font-medium`}>Standard Priority</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpactTab;