import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChunkerMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/chunker/metrics');
        setMetrics(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load metrics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchMetrics();
    
    // Then set up polling every 10 seconds
    const intervalId = setInterval(fetchMetrics, 10000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);

  if (loading && !metrics) return <div>Loading chunker metrics...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!metrics) return <div>No metrics available</div>;

  return (
    <div className="chunker-metrics">
      <h2>Enterprise Chunker Metrics</h2>
      
      {Object.entries(metrics).map(([chunkerName, chunkerMetrics]) => (
        <div key={chunkerName} className="chunker-card">
          <h3>{chunkerName}</h3>
          
          {/* Show system health if available */}
          {chunkerMetrics.system && (
            <div className="metric-item">
              <strong>System Health:</strong> {chunkerMetrics.system.health_status}
            </div>
          )}
          
          {/* Show processing stats if available */}
          {chunkerMetrics.total_chunks_processed !== undefined && (
            <div className="metric-item">
              <strong>Chunks Processed:</strong> {chunkerMetrics.total_chunks_processed}
            </div>
          )}
          
          {/* Show options if available */}
          {chunkerMetrics.options && (
            <div className="metric-item">
              <strong>Chunking Strategy:</strong> {chunkerMetrics.options.chunking_strategy}
              <br />
              <strong>Max Tokens:</strong> {chunkerMetrics.options.max_tokens_per_chunk}
              <br />
              <strong>Overlap Tokens:</strong> {chunkerMetrics.options.overlap_tokens}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChunkerMetrics;