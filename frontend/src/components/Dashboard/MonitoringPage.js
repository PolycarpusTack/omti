import React from 'react';
import ChunkerMetrics from '../components/ChunkerMetrics';

const MonitoringPage = () => {
  return (
    <div className="monitoring-page">
      <h1>System Monitoring</h1>
      <ChunkerMetrics />
      {/* Add other monitoring components here */}
    </div>
  );
};

export default MonitoringPage;