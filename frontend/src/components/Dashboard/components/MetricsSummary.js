import React from 'react';

/**
 * Metrics summary component
 * Displays key metrics cards at the top of the dashboard
 */
const MetricsSummary = ({
  colors,
  issuesBySeverity,
  resolutionRate,
  averageResolutionTime,
  insights,
  formatDuration
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Issues Card */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-sm font-medium text-${colors.secondaryText}`}>Total Issues</p>
            <p className={`text-2xl font-bold text-${colors.text} mt-1`}>
              {Object.values(issuesBySeverity).reduce((a, b) => a + b, 0)}
            </p>
          </div>
          <div className={`p-2 rounded-full bg-${colors.accent}/10`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-${colors.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="mt-4">
          <div className={`flex ${insights.percentChange < 0 ? `text-${colors.success}` : insights.percentChange > 0 ? `text-${colors.error}` : `text-${colors.secondaryText}`} text-sm items-center`}>
            {insights.percentChange < 0 ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            ) : insights.percentChange > 0 ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
            <span>
              {insights.percentChange < 0 
                ? `${Math.abs(Math.round(insights.percentChange))}% decrease` 
                : insights.percentChange > 0 
                  ? `${Math.round(insights.percentChange)}% increase` 
                  : 'No change'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Resolution Rate Card */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-sm font-medium text-${colors.secondaryText}`}>Resolution Rate</p>
            <p className={`text-2xl font-bold text-${colors.text} mt-1`}>
              {resolutionRate}%
            </p>
          </div>
          <div className={`p-2 rounded-full bg-${colors.success}/10`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-${colors.success}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`bg-${colors.success} h-2.5 rounded-full`} style={{ width: `${resolutionRate}%` }}></div>
          </div>
        </div>
        <div className="mt-1">
          <span className={`text-sm text-${colors.secondaryText}`}>
            Target: 95%
          </span>
        </div>
      </div>
      
      {/* Avg Resolution Time Card */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-sm font-medium text-${colors.secondaryText}`}>Avg Resolution Time</p>
            <p className={`text-2xl font-bold text-${colors.text} mt-1`}>
              {formatDuration(averageResolutionTime)}
            </p>
          </div>
          <div className={`p-2 rounded-full bg-${colors.warning}/10`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-${colors.warning}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <span className={`text-sm text-${colors.secondaryText}`}>Previous: {formatDuration(averageResolutionTime * 1.2)}</span>
            <span className={`text-sm text-${colors.success}`}>↓ 20% faster</span>
          </div>
        </div>
      </div>
      
      {/* Risk Score Card */}
      <div className={`bg-${colors.cardBackground} border border-${colors.border} rounded-lg p-4 shadow-sm`}>
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-sm font-medium text-${colors.secondaryText}`}>Risk Score</p>
            <p className={`text-2xl font-bold text-${colors.text} mt-1`}>
              {insights.riskScore}/100
            </p>
          </div>
          <div className={`p-2 rounded-full ${
            insights.riskScore < 30 
              ? `bg-${colors.success}/10` 
              : insights.riskScore < 70 
                ? `bg-${colors.warning}/10` 
                : `bg-${colors.error}/10`
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${
              insights.riskScore < 30 
                ? `text-${colors.success}` 
                : insights.riskScore < 70 
                  ? `text-${colors.warning}` 
                  : `text-${colors.error}`
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`
              ${insights.riskScore < 30 
                ? `bg-${colors.success}` 
                : insights.riskScore < 70 
                  ? `bg-${colors.warning}` 
                  : `bg-${colors.error}`
              } h-2.5 rounded-full`} 
              style={{ width: `${insights.riskScore}%` }}>
            </div>
          </div>
        </div>
        <div className="mt-1">
          <span className={`text-sm ${
            insights.riskScore < 30 
              ? `text-${colors.success}` 
              : insights.riskScore < 70 
                ? `text-${colors.warning}` 
                : `text-${colors.error}`
          }`}>
            {insights.riskScore < 30 
              ? 'Low Risk' 
              : insights.riskScore < 70 
                ? 'Moderate Risk' 
                : 'High Risk'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MetricsSummary;