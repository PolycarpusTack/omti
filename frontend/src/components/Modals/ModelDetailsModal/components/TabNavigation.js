// src/components/Modals/ModelDetailsModal/components/TabNavigation.js
import React from "react";

const TabNavigation = ({ activeTab, setActiveTab, viewMode, renderIfExpanded }) => {
  return (
    <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-px mb-6">
      <TabButton 
        label="Information" 
        tabId="info" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <TabButton 
        label="Settings" 
        tabId="settings" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <TabButton 
        label="Testing & Tuning" 
        tabId="testing" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <TabButton 
        label="Analytics" 
        tabId="analytics" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      {renderIfExpanded(
        <TabButton 
          label="Versioning" 
          tabId="version" 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
      )}
      {renderIfExpanded(
        <TabButton 
          label="Access & Alerts" 
          tabId="access" 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
      )}
    </div>
  );
};

const TabButton = ({ label, tabId, activeTab, setActiveTab }) => {
  return (
    <button
      type="button"
      onClick={() => setActiveTab(tabId)}
      className={`px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap ${
        activeTab === tabId
          ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      }`}
      aria-selected={activeTab === tabId}
      role="tab"
    >
      {label}
    </button>
  );
};

export default TabNavigation;