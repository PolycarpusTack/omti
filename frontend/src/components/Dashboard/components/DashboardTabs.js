import React from 'react';

/**
 * Dashboard tabs component
 * Provides navigation between different dashboard views
 */
const DashboardTabs = ({ colors, activeTab, setActiveTab }) => {
  // Tab definitions
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends & Forecasts' },
    { id: 'patterns', label: 'Error Patterns' },
    { id: 'impact', label: 'Business Impact' }
  ];

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex flex-wrap -mb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`mr-4 py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === tab.id
                ? `border-${colors.accent} text-${colors.accent}`
                : `border-transparent text-${colors.secondaryText} hover:text-${colors.text} hover:border-${colors.border}`
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default DashboardTabs;