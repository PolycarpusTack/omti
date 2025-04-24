import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#3498DB'];

const AdvancedChunkerMetrics = () => {
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
    
    // Then set up polling every 5 seconds
    const intervalId = setInterval(fetchMetrics, 5000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);

  if (loading && !metrics) return <div>Loading chunker metrics...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!metrics) return <div>No metrics available</div>;

  // Get data for the smart parallel chunker if available
  const smartChunker = metrics['smart_parallel'] || {};
  
  // Prepare data for strategy distribution chart
  const strategyDistribution = 
    Object.entries(smartChunker.decisions || {})
      .map(([name, value]) => ({ name, value }));
  
  // Prepare data for throughput chart if available
  const throughputData = 
    (smartChunker.throughput_trend || [])
      .map((value, index) => ({ time: index, throughput: value }));
  
  // Prepare data for memory usage chart
  const memoryData = [
    { name: 'Used', value: smartChunker.system?.memory_percent || 0 },
    { name: 'Free', value: 100 - (smartChunker.system?.memory_percent || 0) }
  ];

  return (
    <div className="advanced-chunker-metrics">
      <h2>EnterpriseChunker Advanced Monitoring</h2>
      
      <div className="metrics-grid">
        {/* Stats panel */}
        <div className="metric-panel">
          <h3>Processing Statistics</h3>
          <div className="stats-container">
            <div className="stat-item">
              <div className="stat-value">{smartChunker.total_chunks_processed || 0}</div>
              <div className="stat-label">Chunks Processed</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{(smartChunker.avg_throughput || 0).toFixed(2)}</div>
              <div className="stat-label">Chunks/Second</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{(smartChunker.avg_processing_time || 0).toFixed(3)}s</div>
              <div className="stat-label">Avg Process Time</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{smartChunker.error_count || 0}</div>
              <div className="stat-label">Errors</div>
            </div>
          </div>
        </div>
        
        {/* System health panel */}
        <div className="metric-panel">
          <h3>System Health</h3>
          <div className="health-indicator">
            <div className={`status-badge ${smartChunker.system?.health_status?.toLowerCase() || 'unknown'}`}>
              {smartChunker.system?.health_status || 'Unknown'}
            </div>
            <div className="system-details">
              <div>Memory: {smartChunker.system?.memory_percent?.toFixed(1) || 0}%</div>
              <div>System Load: {smartChunker.system?.system_load?.toFixed(2) || 'N/A'}</div>
              <div>Logical Cores: {smartChunker.system?.logical_cores || 'N/A'}</div>
            </div>
          </div>
        </div>
        
        {/* Strategy distribution chart */}
        {strategyDistribution.length > 0 && (
          <div className="metric-panel">
            <h3>Strategy Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={strategyDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {strategyDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Throughput trend chart */}
        {throughputData.length > 0 && (
          <div className="metric-panel">
            <h3>Throughput Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toFixed(2)} chunks/s`, 'Throughput']} />
                <Line type="monotone" dataKey="throughput" stroke="#0088FE" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Memory usage chart */}
        <div className="metric-panel">
          <h3>Memory Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={memoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#FF8042" />
                <Cell fill="#00C49F" />
              </Pie>
              <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdvancedChunkerMetrics;