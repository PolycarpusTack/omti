// components/content/HistoryContent.jsx
import React from 'react';

const HistoryStorage = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li>Complete analysis content and metadata stored for each analysis</li>
    <li>Options for local storage (browser) or cloud-based storage</li>
    <li>Automatic synchronization between devices (with cloud storage)</li>
    <li>Content compression for large analysis results</li>
    <li>Configurable retention policies to manage storage space</li>
  </ul>
);

const HistoryManagement = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li>View complete analysis history with sorting options</li>
    <li>Search and filter history by multiple criteria</li>
    <li>Add custom tags to analyses for better organization</li>
    <li>Rate analyses to mark high-value results</li>
    <li>Group related analyses together</li>
    <li>Delete individual history entries</li>
    <li>Clear entire history with confirmation</li>
    <li>Export history to backup file</li>
    <li>Import history from backup file</li>
  </ul>
);

const MetadataTracking = () => (
  <React.Fragment>
    <p>
      The history feature tracks comprehensive metadata:
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Timestamp:</strong> When the analysis was performed</li>
      <li><strong>Filename:</strong> The name of the analyzed file</li>
      <li><strong>File size:</strong> Size of the analyzed content</li>
      <li><strong>Model used:</strong> Which AI model performed the analysis</li>
      <li><strong>Analysis type:</strong> The type of analysis performed</li>
      <li><strong>Success rating:</strong> User-provided quality rating</li>
      <li><strong>Tags:</strong> User-defined categorization</li>
      <li><strong>Notes:</strong> User-added comments for future reference</li>
      <li><strong>Content characteristics:</strong> Technical metadata about the content</li>
    </ul>
  </React.Fragment>
);

const HistoryViewing = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li>Load any past analysis with complete results</li>
    <li>Compare current analysis with historical ones</li>
    <li>Track changes in specific issues over time</li>
    <li>Restore analysis state including filters and view settings</li>
    <li>Create follow-up analyses based on historical results</li>
  </ul>
);

const HistoryLimits = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li><strong>Default Limit:</strong> 20 most recent analyses</li>
    <li><strong>Configurable Limit:</strong> 5-50 entries based on user preference</li>
    <li><strong>Automatic Cleanup:</strong> Oldest entries automatically removed when limit reached</li>
    <li><strong>Storage Warning:</strong> Alert when approaching browser storage limits</li>
  </ul>
);

const CloudSync = () => (
  <React.Fragment>
    <p>
      With cloud synchronization enabled:
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Access your analysis history from multiple devices</li>
      <li>Automatic synchronization of new analyses</li>
      <li>Conflict resolution when changes are made on multiple devices</li>
      <li>Selective synchronization options (sync only selected analyses)</li>
      <li>Sync status indicators and manual sync control</li>
      <li>Encryption for sensitive data</li>
    </ul>
  </React.Fragment>
);

const HistoryContent = {
  HistoryStorage,
  HistoryManagement,
  MetadataTracking,
  HistoryViewing,
  HistoryLimits,
  CloudSync
};

export default HistoryContent;