// components/content/BackendContent.jsx
import React from 'react';

const BackendOverview = () => (
  <p>
    When you upload a file and run an analysis, a complex series of operations happens invisibly to provide you with results:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Your file is processed, cleaned, and prepared for analysis</li>
      <li>The content is split into manageable chunks if needed</li>
      <li>Smart systems determine the best AI model for your specific content</li>
      <li>Secure connections transmit your data to AI processing systems</li>
      <li>Results are structured, enhanced, and prepared for display</li>
      <li>Analysis data is safely stored for future reference</li>
      <li>Patterns across analyses are identified and tracked</li>
    </ul>
  </p>
);

const DatabaseStorage = () => (
  <React.Fragment>
    <p>
      Your analysis data is stored in a PostgreSQL database with several specialized tables:
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Users:</strong> Stores your account information and preferences</li>
      <li><strong>Analyses:</strong> Basic metadata about each analysis you perform</li>
      <li><strong>Analysis Results:</strong> The detailed findings for each analysis</li>
      <li><strong>Analysis History:</strong> Comprehensive tracking of all analyses with timeline support</li>
      <li><strong>Analysis Content:</strong> The actual content of analysis results, possibly compressed for efficiency</li>
      <li><strong>Model Suggestions:</strong> Learning data that improves model recommendations over time</li>
      <li><strong>Tags:</strong> Custom categorization for organizing your analyses</li>
    </ul>
    <p className="mt-2">
      All database interactions use transactions to ensure data consistency and prevent partial updates.
    </p>
  </React.Fragment>
);

const ApiEndpoints = () => (
  <React.Fragment>
    <p>
      The application uses a RESTful API architecture with endpoints for different functions:
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>/api/analysis:</strong> Handles file processing and AI model interactions</li>
      <li><strong>/api/history:</strong> Manages your analysis history with timeline support</li>
      <li><strong>/api/suggestion:</strong> Provides intelligent model recommendations</li>
      <li><strong>/api/users:</strong> Manages user accounts and preferences</li>
      <li><strong>/api/tags:</strong> Handles custom tagging and categorization</li>
      <li><strong>/api/export:</strong> Creates shareable and exportable results</li>
    </ul>
    <p className="mt-2">
      All API routes include authentication to ensure only authorized users can access your data.
    </p>
  </React.Fragment>
);

const ModelSuggestionLogic = () => (
  <React.Fragment>
    <p>
      The model suggestion system uses several techniques to recommend the best model:
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Content Analysis:</strong> Scans your file for code patterns, error messages, complexity indicators</li>
      <li><strong>Historical Performance:</strong> Learns from which models performed well on similar content</li>
      <li><strong>User Preference Learning:</strong> Adapts to your personal model preferences over time</li>
      <li><strong>Feature Detection:</strong> Identifies special features like stack traces that benefit from specific models</li>
      <li><strong>Feedback Loop:</strong> Every time you accept or reject a suggestion, the system gets smarter</li>
    </ul>
    <p className="mt-2">
      This system combines rule-based logic with statistical learning to continuously improve its recommendations.
    </p>
  </React.Fragment>
);

const TimelineProcessing = () => (
  <p>
    The timeline view involves several backend processes:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Date Grouping:</strong> Automatically groups analyses by day for chronological display</li>
      <li><strong>Metadata Extraction:</strong> Pulls relevant fields for quick display in timeline items</li>
      <li><strong>Efficient Querying:</strong> Uses optimized database queries with pagination for performance</li>
      <li><strong>Filter Translation:</strong> Converts UI filter selections into database query parameters</li>
      <li><strong>Full-text Search:</strong> Employs PostgreSQL's text search capabilities for searching history</li>
      <li><strong>Cloud Synchronization:</strong> Handles merging locally stored analyses with cloud storage</li>
    </ul>
  </p>
);

const SecurityMeasures = () => (
  <p>
    Your data is protected by several security measures:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Authentication:</strong> All API requests require valid authentication</li>
      <li><strong>Authorization:</strong> Checks ensure you can only access your own data</li>
      <li><strong>Data Isolation:</strong> Each user's data is logically separated</li>
      <li><strong>Input Validation:</strong> All user inputs are validated to prevent injection attacks</li>
      <li><strong>Transaction Safety:</strong> Database operations use transactions for consistency</li>
      <li><strong>Error Handling:</strong> Robust error handling prevents information leakage</li>
      <li><strong>API Rate Limiting:</strong> Prevents abuse through excessive requests</li>
    </ul>
  </p>
);

const PerformanceOptimizations = () => (
  <p>
    Several techniques keep the application fast and responsive:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Database Indexing:</strong> Strategic indexes for fast data retrieval</li>
      <li><strong>Content Compression:</strong> Large analysis results are compressed for storage efficiency</li>
      <li><strong>Query Optimization:</strong> Carefully designed database queries</li>
      <li><strong>Pagination:</strong> Large result sets are retrieved in small batches</li>
      <li><strong>Caching:</strong> Frequently accessed data is cached for faster access</li>
      <li><strong>Asynchronous Processing:</strong> Long-running tasks happen in the background</li>
      <li><strong>Lazy Loading:</strong> Content is loaded only when needed</li>
    </ul>
  </p>
);

const BackendContent = {
  BackendOverview,
  DatabaseStorage,
  ApiEndpoints,
  ModelSuggestionLogic,
  TimelineProcessing,
  SecurityMeasures,
  PerformanceOptimizations
};

export default BackendContent;