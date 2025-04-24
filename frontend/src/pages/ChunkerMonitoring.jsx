import React from 'react';
import AdvancedChunkerMetrics from '../components/Chunker/AdvancedChunkerMetrics';
import ChunkVisualizer from '../components/Chunker/ChunkVisualizer';
import './ChunkerMonitoring.css';

const ChunkerMonitoring = () => {
  return (
    <div className="chunker-monitoring-page">
      <div className="monitoring-header">
        <h1>Enterprise Chunker Monitoring</h1>
        <p>Monitor the performance and behavior of your document chunking system</p>
      </div>
      
      <AdvancedChunkerMetrics />
      <ChunkVisualizer />
    </div>
  );
};

export default ChunkerMonitoring;