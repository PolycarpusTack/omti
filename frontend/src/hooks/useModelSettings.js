// src/hooks/useModelSettings.js
import { useState, useEffect, useCallback } from 'react';

// Default model settings to use when model.settings is undefined
const defaultSettings = {
  temperature: 0.7,
  topP: 0.9,
  maxTokensPerChunk: 4000,
  maxOutputTokens: 2000,
  frequencyPenalty: 0,
  presencePenalty: 0,
  timeout: 300,
  contentFilter: "standard",
  cachingEnabled: false,
  streamingEnabled: true,
};

/**
 * Custom hook for managing model settings
 * @param {Object} model - Model object containing settings
 * @param {boolean} isSelected - Whether this model is currently selected
 * @param {Function} onUpdateSettings - Callback to update settings in parent component
 * @returns {Object} Settings management functions and state
 */
export const useModelSettings = (model, isSelected, onUpdateSettings) => {
  // State for model-specific settings
  const [settings, setSettings] = useState(defaultSettings);
  
  // Save original settings to enable comparison and reset
  const [originalSettings, setOriginalSettings] = useState({});
  
  // State for model versioning
  const [savedVersions, setSavedVersions] = useState([]);

  // Initialize settings when model changes
  useEffect(() => {
    if (model && model.settings) {
      const modelSettings = {
        temperature: model.settings.temperature ?? defaultSettings.temperature,
        topP: model.settings.topP ?? defaultSettings.topP,
        maxTokensPerChunk:
          model.settings.maxTokensPerChunk ?? defaultSettings.maxTokensPerChunk,
        maxOutputTokens:
          model.settings.maxOutputTokens ?? defaultSettings.maxOutputTokens,
        frequencyPenalty:
          model.settings.frequencyPenalty ?? defaultSettings.frequencyPenalty,
        presencePenalty:
          model.settings.presencePenalty ?? defaultSettings.presencePenalty,
        timeout: model.settings.timeout ?? defaultSettings.timeout,
        contentFilter:
          model.settings.contentFilter ?? defaultSettings.contentFilter,
        cachingEnabled:
          model.settings.cachingEnabled ?? defaultSettings.cachingEnabled,
        streamingEnabled:
          model.settings.streamingEnabled ?? defaultSettings.streamingEnabled,
      };
      setSettings(modelSettings);
      setOriginalSettings({ ...modelSettings });
    } else {
      setSettings({ ...defaultSettings });
      setOriginalSettings({ ...defaultSettings });
    }

    // Initialize saved versions if not already set
    if (model && savedVersions.length === 0) {
      // Create initial version based on model settings or defaults
      const initialSettingsForVersion = model?.settings ? 
        { ...model.settings } : 
        { ...defaultSettings };
        
      setSavedVersions([
        {
          id: "v1",
          name: "Initial Setup",
          timestamp: "2025-03-15T12:00:00Z",
          settings: { ...initialSettingsForVersion },
        },
        {
          id: "v2",
          name: "Optimized for Code",
          timestamp: "2025-04-01T09:30:00Z",
          settings: {
            ...initialSettingsForVersion,
            temperature: 0.3,
            topP: 0.8,
          },
        },
      ]);
    }
  }, [model, savedVersions.length]);

  // Handle settings changes
  const handleSettingChange = useCallback(
    (key, value) => {
      setSettings((prevSettings) => {
        const newSettings = { ...prevSettings, [key]: value };
        // Update settings in parent if this model is selected
        if (isSelected && model?.id) {
          onUpdateSettings(model.id, newSettings);
        }
        return newSettings;
      });
    },
    [isSelected, model?.id, onUpdateSettings]
  );

  // Reset settings to original state
  const resetToOriginal = useCallback(() => {
    setSettings({ ...originalSettings });
    // Update settings in parent if this model is selected
    if (isSelected && model?.id) {
      onUpdateSettings(model.id, originalSettings);
    }
  }, [originalSettings, isSelected, model?.id, onUpdateSettings]);

  // Save current settings as a named version
  const saveCurrentVersion = useCallback(
    (versionName) => {
      setSavedVersions((prev) => [
        ...prev,
        {
          id: `v${prev.length + 1}`,
          name: versionName,
          timestamp: new Date().toISOString(),
          settings: { ...settings },
        },
      ]);
    },
    [settings]
  );

  // Load a saved settings version
  const loadVersion = useCallback(
    (versionId) => {
      const version = savedVersions.find((v) => v.id === versionId);
      if (version) {
        setSettings({ ...version.settings });
        // Update settings in parent if this model is selected
        if (isSelected && model?.id) {
          onUpdateSettings(model.id, version.settings);
        }
      }
    },
    [savedVersions, isSelected, model?.id, onUpdateSettings]
  );

  // Export settings as JSON
  const exportSettings = useCallback(() => {
    if (!model?.id) return;
    
    const dataStr = JSON.stringify(
      {
        model: model.id,
        settings: settings,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      dataStr
    )}`;
    
    const exportFileDefaultName = `${model.id}-settings-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
      
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }, [settings, model?.id]);

  // Import settings from JSON file
  const importSettings = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        try {
          if (typeof text === "string") {
            const importedData = JSON.parse(text);
            if (importedData && importedData.settings) {
              setSettings({ ...importedData.settings });
              if (isSelected && model?.id) {
                onUpdateSettings(model.id, importedData.settings);
              }
            }
          } else {
            console.error(
              "Error importing settings: FileReader result is not a string."
            );
          }
        } catch (error) {
          console.error("Error importing settings:", error);
        }
      };
      reader.readAsText(file);
    },
    [isSelected, model?.id, onUpdateSettings]
  );

  return {
    settings,
    originalSettings,
    savedVersions,
    setSavedVersions,
    handleSettingChange,
    resetToOriginal,
    saveCurrentVersion, 
    loadVersion,
    exportSettings,
    importSettings
  };
};