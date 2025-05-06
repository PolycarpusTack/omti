// src/components/Modals/ModelTabs/ModelAccessTab.js
import React, { useState } from "react";

const ModelAccessTab = ({ model }) => {
  // Initialize access settings with safe defaults from model or defaults
  const [accessSettings, setAccessSettings] = useState({
    canModifySettings: model?.accessSettings?.canModifySettings ?? true,
    canRunBenchmarks: model?.accessSettings?.canRunBenchmarks ?? true,
    canExportConfig: model?.accessSettings?.canExportConfig ?? true,
    visibleToTeams: model?.accessSettings?.visibleToTeams ?? [
      "Engineering",
      "Data Science",
    ],
  });

  // Initialize notifications and alerts with safe defaults
  const [alerts, setAlerts] = useState({
    performanceThreshold: model?.alerts?.performanceThreshold ?? 5.0, // seconds
    errorRateThreshold: model?.alerts?.errorRateThreshold ?? 5, // percentage
    costAlertThreshold: model?.alerts?.costAlertThreshold ?? 100, // dollars
    notifyOnChange: model?.alerts?.notifyOnChange ?? true,
    recipients: model?.alerts?.recipients ?? ["notifications@example.com"],
  });

  // Input for adding new team
  const [newTeam, setNewTeam] = useState("");
  const [newRecipient, setNewRecipient] = useState("");

  // Teams that could be added (for dropdown)
  const availableTeams = [
    "Marketing",
    "Sales",
    "Product",
    "Customer Support",
    "Finance",
    "Operations",
    "Executive",
    "Research"
  ].filter(team => !accessSettings.visibleToTeams.includes(team));

  // Handle access permission toggles
  const toggleAccessSetting = (setting) => {
    setAccessSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  // Add team to visibility list
  const addTeam = () => {
    if (newTeam && !accessSettings.visibleToTeams.includes(newTeam)) {
      setAccessSettings(prev => ({
        ...prev,
        visibleToTeams: [...prev.visibleToTeams, newTeam]
      }));
      setNewTeam("");
    }
  };

  // Remove team from visibility list
  const removeTeam = (team) => {
    setAccessSettings(prev => ({
      ...prev,
      visibleToTeams: prev.visibleToTeams.filter(t => t !== team)
    }));
  };

  // Add notification recipient
  const addRecipient = () => {
    if (newRecipient && !alerts.recipients.includes(newRecipient)) {
      setAlerts(prev => ({
        ...prev,
        recipients: [...prev.recipients, newRecipient]
      }));
      setNewRecipient("");
    }
  };

  // Remove notification recipient
  const removeRecipient = (email) => {
    setAlerts(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }));
  };

  // Handle numeric alert threshold changes
  const handleAlertChange = (setting, value) => {
    setAlerts(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  return (
    <div className="space-y-6">
      {/* Access Management */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Access Management
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="modify-settings-toggle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Allow Settings Modification
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Team members can change parameters and save versions
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-2">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={accessSettings.canModifySettings}
                onChange={() => toggleAccessSetting('canModifySettings')}
                id="modify-settings-toggle"
              />
              <label
                htmlFor="modify-settings-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  accessSettings.canModifySettings
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    accessSettings.canModifySettings ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="run-benchmarks-toggle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Allow Benchmark Execution
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Team members can run performance tests
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-2">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={accessSettings.canRunBenchmarks}
                onChange={() => toggleAccessSetting('canRunBenchmarks')}
                id="run-benchmarks-toggle"
              />
              <label
                htmlFor="run-benchmarks-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  accessSettings.canRunBenchmarks
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    accessSettings.canRunBenchmarks ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="export-config-toggle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Allow Configuration Export
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Team members can export settings to files
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-2">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={accessSettings.canExportConfig}
                onChange={() => toggleAccessSetting('canExportConfig')}
                id="export-config-toggle"
              />
              <label
                htmlFor="export-config-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  accessSettings.canExportConfig
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    accessSettings.canExportConfig ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Team Access
          </label>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {accessSettings.visibleToTeams.map(team => (
              <div 
                key={team} 
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs flex items-center"
              >
                {team}
                <button 
                  onClick={() => removeTeam(team)}
                  className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                  aria-label={`Remove ${team} team access`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex">
            <select
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              className="flex-grow p-2 text-sm border rounded-l dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              aria-label="Select team to add"
            >
              <option value="">Select a team...</option>
              {availableTeams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            <button
              onClick={addTeam}
              disabled={!newTeam}
              className={`px-3 text-sm rounded-r border-t border-r border-b ${
                newTeam
                  ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
              }`}
              aria-label="Add team to access list"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Notifications & Alerts */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Notifications & Alerts
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="performance-threshold" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Performance Alert Threshold (seconds)
            </label>
            <input
              id="performance-threshold"
              type="number"
              min="0.1"
              step="0.1"
              value={alerts.performanceThreshold}
              onChange={(e) => handleAlertChange('performanceThreshold', parseFloat(e.target.value) || 0)}
              className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Alert when average response time exceeds this threshold
            </p>
          </div>

          <div>
            <label htmlFor="error-rate-threshold" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Error Rate Alert Threshold (%)
            </label>
            <input
              id="error-rate-threshold"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={alerts.errorRateThreshold}
              onChange={(e) => handleAlertChange('errorRateThreshold', parseFloat(e.target.value) || 0)}
              className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Alert when error rate exceeds this percentage
            </p>
          </div>

          <div>
            <label htmlFor="cost-alert-threshold" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Cost Alert Threshold ($)
            </label>
            <input
              id="cost-alert-threshold"
              type="number"
              min="1"
              step="1"
              value={alerts.costAlertThreshold}
              onChange={(e) => handleAlertChange('costAlertThreshold', parseInt(e.target.value) || 0)}
              className="w-full p-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Alert when daily cost exceeds this amount
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="notify-on-change-toggle" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Notify on Settings Changes
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Send notifications when model settings are modified
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-2">
              <input
                type="checkbox"
                className="opacity-0 w-0 h-0"
                checked={alerts.notifyOnChange}
                onChange={() => handleAlertChange('notifyOnChange', !alerts.notifyOnChange)}
                id="notify-on-change-toggle"
              />
              <label
                htmlFor="notify-on-change-toggle"
                className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                  alerts.notifyOnChange
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 bg-white rounded-full transition-all duration-300 ${
                    alerts.notifyOnChange ? "left-7" : "left-1"
                  } top-1`}
                ></span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Notification Recipients
          </label>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {alerts.recipients.map(email => (
              <div 
                key={email} 
                className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-1 rounded text-xs flex items-center"
              >
                {email}
                <button 
                  onClick={() => removeRecipient(email)}
                  className="ml-1 text-purple-600 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-100"
                  aria-label={`Remove ${email} from notification recipients`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex">
            <input
              type="email"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder="Enter email address..."
              className="flex-grow p-2 text-sm border rounded-l dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              aria-label="Enter email address for notifications"
            />
            <button
              onClick={addRecipient}
              disabled={!newRecipient}
              className={`px-3 text-sm rounded-r border-t border-r border-b ${
                newRecipient
                  ? "bg-purple-500 text-white border-purple-500 hover:bg-purple-600"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
              }`}
              aria-label="Add email to notification recipients"
            >
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Recipients will receive alerts via email when thresholds are exceeded
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelAccessTab;