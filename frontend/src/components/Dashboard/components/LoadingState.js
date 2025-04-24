import React from 'react';

/**
 * Loading state component
 * Displayed when analytics data is being loaded
 */
const LoadingState = ({ colors }) => {
  return (
    <div className={`bg-${colors.background} rounded-lg shadow-md p-4 mb-6 animate-pulse`}>
      <div className={`h-8 bg-${colors.border} rounded w-1/4 mb-4`}></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`h-64 bg-${colors.border} rounded`}></div>
        <div className={`h-64 bg-${colors.border} rounded`}></div>
        <div className={`h-64 bg-${colors.border} rounded`}></div>
      </div>
    </div>
  );
};

export default LoadingState;