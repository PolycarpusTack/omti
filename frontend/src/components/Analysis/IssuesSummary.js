import React from 'react';

const IssuesSummary = ({ issues }) => {
  const { critical, high, medium, low } = issues;
  
  if (Object.values(issues).every(list => !list.length)) {
    return null;
  }
  
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-3 dark:text-gray-200">Issue Summary</h2>
      
      {critical.length > 0 && (
        <div className="mb-3">
          <h3 className="text-red-600 dark:text-red-400 font-medium mb-2">
            Critical Issues ({critical.length})
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {critical.map((issue) => (
              <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                {issue.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {high.length > 0 && (
        <div className="mb-3">
          <h3 className="text-orange-600 dark:text-orange-400 font-medium mb-2">
            High Priority Issues ({high.length})
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {high.map((issue) => (
              <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                {issue.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {medium.length > 0 && (
        <div className="mb-3">
          <h3 className="text-yellow-600 dark:text-yellow-400 font-medium mb-2">
            Medium Priority Issues ({medium.length})
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {medium.map((issue) => (
              <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                {issue.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {low.length > 0 && (
        <div className="mb-3">
          <h3 className="text-blue-600 dark:text-blue-400 font-medium mb-2">
            Low Priority Issues ({low.length})
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {low.map((issue) => (
              <li key={issue.id} className="text-gray-800 dark:text-gray-200">
                {issue.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default IssuesSummary;