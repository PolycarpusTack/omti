// src/components/Modals/ModelDetailsModal/ModelDetailsModal.js
import React, { useState, useEffect } from "react";
import ModelHeader from "./components/ModelHeader";
import TabNavigation from "./components/TabNavigation";
import TabContent from "./components/TabContent";
import { useModelSettings } from "../../../hooks/useModelSettings";
import { useViewMode } from "../../../hooks/useViewMode";

const ModelDetailsModal = ({
  model,
  isOpen,
  onClose,
  onSelectModel,
  isSelected,
  onUpdateSettings,
  usageHistory = [],
}) => {
  // Active tab state
  const [activeTab, setActiveTab] = useState("info");
  
  // Custom hooks for better state management
  const { viewMode, toggleViewMode, renderIfExpanded } = useViewMode();
  const { 
    settings, 
    originalSettings, // Used by resetToOriginal function internally
    savedVersions,
    setSavedVersions, // Used internally by saveCurrentVersion and loadVersion 
    handleSettingChange, 
    resetToOriginal,
    saveCurrentVersion,
    loadVersion,
    exportSettings,
    importSettings
  } = useModelSettings(model, isSelected, onUpdateSettings);
  
  // Track unsaved changes to show an indicator
  const hasUnsavedChanges = React.useMemo(() => {
    if (!originalSettings || !settings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);
  
  // Automatically save versions when tab changes if there are unsaved changes
  useEffect(() => {
    // Check if we need to create an autosave
    if (hasUnsavedChanges && model?.id) {
      const autoSaveName = `Autosave - ${model.name} - ${new Date().toLocaleString()}`;
      
      // Create a function to handle the autosave
      const handleAutoSave = () => {
        // Check if we already have too many autosaves (keep maximum 5)
        const existingAutosaves = savedVersions.filter(v => v.name.startsWith('Autosave'));
        if (existingAutosaves.length >= 5) {
          // Remove the oldest autosave
          const oldestAutosave = existingAutosaves.reduce((oldest, current) => 
            oldest.timestamp < current.timestamp ? oldest : current
          );
          
          // Create new versions array without the oldest autosave
          const updatedVersions = savedVersions.filter(v => v.id !== oldestAutosave.id);
          
          // Update versions and add the new autosave
          setSavedVersions([
            ...updatedVersions,
            {
              id: `autosave-${Date.now()}`,
              name: autoSaveName,
              timestamp: Date.now(),
              settings: {...settings}
            }
          ]);
        } else {
          // Just add the new autosave
          saveCurrentVersion(autoSaveName);
        }
      };
      
      // Only auto-save if moving away from settings tab
      if (activeTab !== "settings") {
        handleAutoSave();
      }
    }
  }, [activeTab, hasUnsavedChanges, model, saveCurrentVersion, savedVersions, setSavedVersions, settings]);

  // Save settings when closing the modal
  const handleClose = () => {
    if (model?.id) {
      onUpdateSettings(model.id, settings);
    }
    onClose();
  };

  // Early return if modal is not open
  if (!isOpen || !model) return null;

  // Process usageHistory to ensure data integrity
  const processedUsageHistory = usageHistory.map((entry) => ({
    date: entry.date || "Unknown Date",
    tokens: Number(entry.tokens) || 0,
    cost: Number(entry.cost) || 0,
    avgResponseTime: Number(entry.avgResponseTime) || 0,
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${
          viewMode === "concise" ? "max-w-2xl" : "max-w-6xl"
        } w-full max-h-[90vh] overflow-y-auto shadow-2xl`}
      >
        <ModelHeader 
          model={model} 
          viewMode={viewMode} 
          toggleViewMode={toggleViewMode} 
          handleClose={handleClose}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        <TabNavigation 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          viewMode={viewMode} 
          renderIfExpanded={renderIfExpanded} 
        />

        <TabContent 
          activeTab={activeTab}
          model={model}
          settings={settings}
          handleSettingChange={handleSettingChange}
          viewMode={viewMode}
          renderIfExpanded={renderIfExpanded}
          resetToOriginal={resetToOriginal}
          processedUsageHistory={processedUsageHistory}
          savedVersions={savedVersions}
          saveCurrentVersion={saveCurrentVersion}
          loadVersion={loadVersion}
          exportSettings={exportSettings}
          importSettings={importSettings}
        />
      </div>
    </div>
  );
};

export default ModelDetailsModal;