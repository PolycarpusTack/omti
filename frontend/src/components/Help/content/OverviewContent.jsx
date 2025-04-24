// components/content/OverviewContent.jsx
import React from 'react';

const CoreFeatures = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li>AI-powered code and log analysis</li>
    <li>Multiple analysis modes and model options</li>
    <li>Smart model suggestion based on content type</li>
    <li>Pattern detection across multiple analyses</li>
    <li>Detailed issue categorization and filtering</li>
    <li>Advanced analytics dashboard with visualizations</li>
    <li>Timeline view of analysis history</li>
    <li>Troubleshooting wizard with guided steps</li>
    <li>Shareable analysis results</li>
    <li>Analysis history management</li>
    <li>Dark/light theme support</li>
  </ul>
);

const Workflow = () => (
  <ol className="list-decimal pl-5 space-y-1">
    <li>Upload a file (code or log) for analysis</li>
    <li>Use the auto-suggested model or select your preferred model</li>
    <li>Configure analysis settings (language, type)</li>
    <li>Run the analysis</li>
    <li>Review the analytics dashboard for high-level insights</li>
    <li>Examine categorized issues and detailed analysis</li>
    <li>Use filters to focus on specific issues</li>
    <li>Use the troubleshooting wizard for guided resolution</li>
    <li>Save to history for future reference and pattern detection</li>
    <li>Export or share results as needed</li>
  </ol>
);

const OverviewContent = {
  CoreFeatures,
  Workflow
};

export default OverviewContent;