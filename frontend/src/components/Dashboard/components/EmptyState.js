import React from 'react';

/**
 * Empty state component
 * Displayed when no analytics data is available
 */
const EmptyState = ({ colors }) => {
  return (
    <div className={`bg-${colors.background} rounded-lg shadow-md p-6`}>
      <h2 className={`text-2xl font-bold mb-4 text-${colors.text}`}>Analytics Dashboard</h2>
      <div className="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-20 w-20 mx-auto text-${colors.secondaryText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className={`mt-4 text-lg font-medium text-${colors.text}`}>No Analytics Data Available</p>
        <p className={`mt-2 text-${colors.secondaryText}`}>Run analyses to see detailed insights and trends.</p>
      </div>
    </div>
  );
};

export default EmptyState;