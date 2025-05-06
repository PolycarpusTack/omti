// src/components/Modals/ModelDetailsModal/components/TabContent.js
import React from "react";
import ModelInfoTab from "../tabs/ModelInfoTab";
import ModelSettingsTab from "../tabs/ModelSettingsTab";
import ModelTestingTab from "../tabs/ModelTestingTab";
import ModelAnalyticsTab from "../tabs/ModelAnalyticsTab";
import ModelVersioningTab from "../tabs/ModelVersioningTab";
import ModelAccessTab from "../tabs/ModelAccessTab";

const TabContent = ({
  activeTab,
  model,
  settings,
  handleSettingChange,
  viewMode,
  renderIfExpanded,
  resetToOriginal,
  processedUsageHistory,
  savedVersions,
  saveCurrentVersion,
  loadVersion,
  exportSettings,
  importSettings
}) => {
  return (
    <div className="tab-content">
      {activeTab === "info" && (
        <ModelInfoTab 
          model={model} 
          viewMode={viewMode} 
          renderIfExpanded={renderIfExpanded} 
        />
      )}

      {activeTab === "settings" && (
        <ModelSettingsTab 
          settings={settings} 
          handleSettingChange={handleSettingChange} 
          viewMode={viewMode} 
          renderIfExpanded={renderIfExpanded}
          resetToOriginal={resetToOriginal}
        />
      )}

      {activeTab === "testing" && (
        <ModelTestingTab 
          settings={settings} 
          handleSettingChange={handleSettingChange} 
          viewMode={viewMode}
        />
      )}

      {activeTab === "analytics" && (
        <ModelAnalyticsTab 
          usageHistory={processedUsageHistory} 
          viewMode={viewMode}
        />
      )}

      {activeTab === "version" && viewMode === "expanded" && (
        <ModelVersioningTab 
          settings={settings}
          savedVersions={savedVersions}
          saveCurrentVersion={saveCurrentVersion}
          loadVersion={loadVersion}
          exportSettings={exportSettings}
          importSettings={importSettings}
          model={model}
        />
      )}

      {activeTab === "access" && viewMode === "expanded" && (
        <ModelAccessTab model={model} />
      )}
    </div>
  );
};

export default TabContent;