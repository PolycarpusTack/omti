// src/components/AnalyticsDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
         BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const API_URL = 'http://localhost:8000'; // Update with your actual API URL

/**
 * Analytics Dashboard Component - Displays insights across multiple analyses
 */
const AnalyticsDashboard = ({ analysisHistory = [] }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const SEVERITY_COLORS = {
    critical: '#EF4444', // red
    high: '#F97316',     // orange
    medium: '#FBBF24',   // amber
    low: '#3B82F6'       // blue
  };
  
  // Mock data generator - replace with actual API call in production
  const generateMockAnalytics = useCallback(() => {
    const getRandomValue = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
    
    // Generate dates for the selected time range
    const dates = [];
    const now = new Date();
    let days = 7;
    
    if (timeRange === '30d') days = 30;
    if (timeRange === '90d') days = 90;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Issues by category over time
    const issuesByCategory = dates.map(date => ({
      date,
      critical: getRandomValue(0, 3),
      high: getRandomValue(1, 5),
      medium: getRandomValue(2, 8),
      low: getRandomValue(3, 10)
    }));
    
    // Root causes
    const rootCauses = [
      { name: 'Memory leak', value: getRandomValue(15, 30) },
      { name: 'Null pointer', value: getRandomValue(10, 25) },
      { name: 'Network timeout', value: getRandomValue(5, 20) },
      { name: 'Configuration error', value: getRandomValue(8, 22) },
      { name: 'Race condition', value: getRandomValue(3, 15) }
    ];
    
    // Resolution effectiveness
    const resolutionEffectiveness = [
      { name: 'First attempt', value: getRandomValue(50, 70) },
      { name: 'Second attempt', value: getRandomValue(15, 30) },
      { name: 'Multiple attempts', value: getRandomValue(5, 15) },
      { name: 'Unresolved', value: getRandomValue(0, 10) }
    ];
    
    // Model performance
    const modelPerformance = [
      { name: 'mistral', accuracy: getRandomValue(75, 95), speed: getRandomValue(80, 95) },
      { name: 'llama2', accuracy: getRandomValue(80, 98), speed: getRandomValue(70, 90) },
      { name: 'mixtral', accuracy: getRandomValue(85, 99), speed: getRandomValue(60, 80) },
      { name: 'gpt-4', accuracy: getRandomValue(90, 99), speed: getRandomValue(75, 90) },
      { name: 'gpt-3.5', accuracy: getRandomValue(85, 95), speed: getRandomValue(85, 95) }
    ];
    
    // Analysis volumes
    const analysisVolumes = dates.map(date => ({
      date,
      count: getRandomValue(5, 20)
    }));
    
    // Issue severity distribution - consider using analysis history here
    let totalIssues = { critical: 0, high: 0, medium: 0, low: 0 };
    issuesByCategory.forEach(day => {
      totalIssues.critical += day.critical;
      totalIssues.high += day.high;
      totalIssues.medium += day.medium;
      totalIssues.low += day.low;
    });
    
    const severityDistribution = [
      { name: 'Critical', value: totalIssues.critical },
      { name: 'High', value: totalIssues.high },
      { name: 'Medium', value: totalIssues.medium },
      { name: 'Low', value: totalIssues.low }
    ];
    
    return {
      issuesByCategory,
      rootCauses,
      resolutionEffectiveness,
      modelPerformance,
      analysisVolumes,
      severityDistribution,
      timeRange
    };
  }, [timeRange]);
  
  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In the future, replace this with actual API call:
      // const response = await axios.get(`${API_URL}/analytics/overview?timeRange=${timeRange}`);
      // setAnalyticsData(response.data);
      
      // For now, use mock data
      const mockData = generateMockAnalytics();
      setAnalyticsData(mockData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [timeRange, generateMockAnalytics]);
  
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-4 shadow-sm flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics data...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              Failed to load analytics data: {error}
            </p>
            <button 
              className="mt-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 hover:underline"
              onClick={fetchAnalytics}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!analyticsData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-4 shadow-sm">
        <p className="text-gray-500 dark:text-gray-400">No analytics data available</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleTimeRangeChange('7d')}
            className={`px-3 py-1 rounded text-sm ${
              timeRange === '7d' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => handleTimeRangeChange('30d')}
            className={`px-3 py-1 rounded text-sm ${
              timeRange === '30d' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => handleTimeRangeChange('90d')}
            className={`px-3 py-1 rounded text-sm ${
              timeRange === '90d' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Issues by Category Over Time */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Issues by Severity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analyticsData.issuesByCategory}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke={SEVERITY_COLORS.critical} name="Critical" />
                <Line type="monotone" dataKey="high" stroke={SEVERITY_COLORS.high} name="High" />
                <Line type="monotone" dataKey="medium" stroke={SEVERITY_COLORS.medium} name="Medium" />
                <Line type="monotone" dataKey="low" stroke={SEVERITY_COLORS.low} name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Severity Distribution */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Issue Severity Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.severityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.severityDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.name === 'Critical' ? SEVERITY_COLORS.critical :
                        entry.name === 'High' ? SEVERITY_COLORS.high :
                        entry.name === 'Medium' ? SEVERITY_COLORS.medium :
                        SEVERITY_COLORS.low
                      } 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Root Causes */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Common Root Causes</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData.rootCauses}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {analyticsData.rootCauses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Model Performance */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Model Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData.modelPerformance}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="accuracy" fill="#8884d8" name="Accuracy" />
                <Bar dataKey="speed" fill="#82ca9d" name="Speed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Analysis Volume Over Time */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm mb-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Analysis Volume</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analyticsData.analysisVolumes}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" name="Analyses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Key Insights */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Top Issue Types</h4>
            <ol className="list-decimal list-inside space-y-1">
              {analyticsData.rootCauses
                .sort((a, b) => b.value - a.value)
                .slice(0, 3)
                .map((cause, index) => (
                  <li key={index} className="text-gray-600 dark:text-gray-400">
                    {cause.name} ({cause.value} instances)
                  </li>
                ))
              }
            </ol>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Performance Trends</h4>
            <p className="text-gray-600 dark:text-gray-400">
              {analyticsData.modelPerformance
                .sort((a, b) => b.accuracy - a.accuracy)[0].name} model demonstrated the highest accuracy at {analyticsData.modelPerformance
                .sort((a, b) => b.accuracy - a.accuracy)[0].accuracy}%.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Resolution Statistics</h4>
            <p className="text-gray-600 dark:text-gray-400">
              {analyticsData.resolutionEffectiveness[0].value}% of issues were resolved on the first attempt.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded">
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Severity Breakdown</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Critical issues account for {(analyticsData.severityDistribution[0].value / analyticsData.severityDistribution.reduce((sum, item) => sum + item.value, 0) * 100).toFixed(1)}% of all reported issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;