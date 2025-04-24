// components/content/TimelineContent.jsx
import React from 'react';

const TimelineOverview = () => (
  <p>
    The Timeline View organizes your analysis history into a visually intuitive chronological display:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Chronological organization of analyses by date</li>
      <li>Visual timeline indicators with status markers</li>
      <li>Grouping of related analyses for better context</li>
      <li>Filtering and search capabilities</li>
      <li>Interactive elements for quick access to analysis details</li>
      <li>Responsive design that works well on all device sizes</li>
    </ul>
  </p>
);

const TimelineNavigation = () => (
  <p>
    Navigate the timeline with intuitive controls:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Date Headers:</strong> Collapsible sections organized by date</li>
      <li><strong>Time Indicators:</strong> Precise timestamps for each analysis</li>
      <li><strong>Expand/Collapse:</strong> Controls for showing or hiding details</li>
      <li><strong>Jump to Date:</strong> Quickly navigate to specific time periods</li>
      <li><strong>Scrolling Timeline:</strong> Smooth scrolling through your history</li>
      <li><strong>Filter Controls:</strong> Focus on specific analysis types or models</li>
    </ul>
  </p>
);

const EntryDetails = () => (
  <p>
    Each timeline entry provides comprehensive information:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Filename:</strong> The name of the analyzed file</li>
      <li><strong>Timestamp:</strong> When the analysis was performed</li>
      <li><strong>Model Used:</strong> Which AI model performed the analysis</li>
      <li><strong>Analysis Type:</strong> The type of analysis that was run</li>
      <li><strong>Tags:</strong> Custom tags for categorization</li>
      <li><strong>Status Indicators:</strong> Visual indicators for severity and success</li>
      <li><strong>Quick Actions:</strong> View, delete, or compare analyses</li>
    </ul>
  </p>
);

const TimelineFiltering = () => (
  <p>
    Focus on specific aspects of your history with powerful filters:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Date Range:</strong> Focus on specific time periods</li>
      <li><strong>Model Type:</strong> Filter by AI model used</li>
      <li><strong>Analysis Type:</strong> Show only certain types of analyses</li>
      <li><strong>Tag Filters:</strong> Filter by custom tags</li>
      <li><strong>Search:</strong> Find analyses by filename or content</li>
      <li><strong>Success Rating:</strong> Filter by user-provided ratings</li>
      <li><strong>Combined Filters:</strong> Use multiple filters simultaneously</li>
    </ul>
  </p>
);

const TimelineStats = () => (
  <p>
    The timeline view includes statistical insights about your analysis history:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Analysis Frequency:</strong> How often you run analyses</li>
      <li><strong>Model Usage:</strong> Which models you use most frequently</li>
      <li><strong>Issue Trends:</strong> How issues have evolved over time</li>
      <li><strong>Success Metrics:</strong> Improvement in analysis quality</li>
      <li><strong>Time Distribution:</strong> Analysis patterns by time of day or day of week</li>
      <li><strong>Visual Graphs:</strong> Trend visualizations over selected time periods</li>
    </ul>
  </p>
);

const TimelineActions = () => (
  <p>
    Take action directly from the timeline view:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>View Analysis:</strong> Open the complete analysis results</li>
      <li><strong>Compare Analyses:</strong> Select multiple entries for side-by-side comparison</li>
      <li><strong>Edit Metadata:</strong> Update tags, notes, or ratings</li>
      <li><strong>Delete Entries:</strong> Remove individual analyses from history</li>
      <li><strong>Export Selection:</strong> Export selected analyses</li>
      <li><strong>Create Report:</strong> Generate a report from selected analyses</li>
      <li><strong>Share Timeline:</strong> Share a filtered view of your timeline</li>
    </ul>
  </p>
);

const TimelineContent = {
  TimelineOverview,
  TimelineNavigation,
  EntryDetails,
  TimelineFiltering,
  TimelineStats,
  TimelineActions
};

export default TimelineContent;