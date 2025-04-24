import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useAnalytics from '../../hooks/useAnalytics';
import { THEME_COLORS, TIME_RANGES, CHART_TYPES } from './dashboardConstants';
import DashboardHeader from './components/DashboardHeader';
import MetricsSummary from './components/MetricsSummary';
import DashboardTabs from './components/DashboardTabs';
import OverviewTab from './tabs/OverviewTab';
import TrendsTab from './tabs/TrendsTab';
import PatternsTab from './tabs/PatternsTab';
import ImpactTab from './tabs/ImpactTab';
import LoadingState from './components/LoadingState';
import EmptyState from './components/EmptyState';

/**
 * Enhanced Analytics Dashboard Component
 * Provides enterprise-grade analytics for log analysis and error tracking
 */
const AnalyticsDashboard = ({ 
  analyses = [], 
  timeRange = '7d', 
  onChange,
  isDarkMode = false
}) => {
  // Define theme colors based on dark/light mode
  const colors = isDarkMode ? THEME_COLORS.dark : THEME_COLORS.light;
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedChart, setSelectedChart] = useState(null);
  const [exportFormat, setExportFormat] = useState('png');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showComparisons, setShowComparisons] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState(null);
  const [selectedIssueType, setSelectedIssueType] = useState(null);
  const [showDataTable, setShowDataTable] = useState(false);
  const [showProjections, setShowProjections] = useState(false);
  
  // Custom hook for analytics data
  const { 
    loadingAnalytics,
    error,
    issuesByType,
    issuesBySeverity,
    issuesTrend, 
    resolutionRate,
    topErrorPatterns,
    averageResolutionTime,
    modelPerformance,
    impactMetrics,
    hourlyDistribution,
    fetchAnalytics,
    calculateStatistics
  } = useAnalytics();

  // Process analyses data for visualization
  useEffect(() => {
    if (analyses.length === 0) return;
    
    // Call the analytics hook with the analyses data
    fetchAnalytics(timeRange, analyses);
  }, [analyses, timeRange, fetchAnalytics]);
  
  // Utility formatting functions
  const formatUtils = {
    formatDate: (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    
    formatTime: (timeStr) => {
      const date = new Date(timeStr);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    },
    
    formatPercentage: (value) => `${Math.round(value * 100)}%`,
    
    formatDuration: (minutes) => {
      if (minutes < 60) return `${Math.round(minutes)}m`;
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
  };

  // Build trend data with projections when enabled
  const trendData = useMemo(() => {
    if (!issuesTrend || issuesTrend.length === 0) return [];
    
    if (!showProjections) return issuesTrend;
    
    // Create a copy to avoid mutating the original
    const data = [...issuesTrend];
    
    // Simple linear projection for the next 7 days
    const projection = [];
    const pointsToUse = Math.min(7, data.length);
    const lastPoints = data.slice(-pointsToUse);
    
    const getProjection = (severity) => {
      // Calculate average daily change
      let sum = 0;
      for (let i = 1; i < lastPoints.length; i++) {
        sum += lastPoints[i][severity] - lastPoints[i-1][severity];
      }
      const avgChange = sum / (lastPoints.length - 1);
      
      return avgChange;
    };
    
    const criticalProj = getProjection('critical');
    const highProj = getProjection('high');
    const mediumProj = getProjection('medium');
    const lowProj = getProjection('low');
    
    // Add 7 days of projections
    const lastDate = new Date(data[data.length - 1].date);
    
    for (let i = 1; i <= 7; i++) {
      const projDate = new Date(lastDate);
      projDate.setDate(projDate.getDate() + i);
      const dateStr = projDate.toISOString().split('T')[0];
      
      const lastValues = data[data.length - 1];
      projection.push({
        date: dateStr,
        critical: Math.max(0, lastValues.critical + criticalProj * i),
        high: Math.max(0, lastValues.high + highProj * i),
        medium: Math.max(0, lastValues.medium + mediumProj * i),
        low: Math.max(0, lastValues.low + lowProj * i),
        isProjection: true
      });
    }
    
    return [...data, ...projection];
  }, [issuesTrend, showProjections]);

  // Calculate statistical insights
  const insights = useMemo(() => {
    if (!issuesTrend || issuesTrend.length < 2) {
      return { trend: 'neutral', riskScore: 50, summary: 'Insufficient data for trend analysis' };
    }
    
    // Calculate first and last week averages for all severities
    const firstWeek = issuesTrend.slice(0, Math.min(7, Math.floor(issuesTrend.length / 2)));
    const lastWeek = issuesTrend.slice(-Math.min(7, Math.floor(issuesTrend.length / 2)));
    
    const firstWeekTotal = firstWeek.reduce((sum, day) => 
      sum + day.critical + day.high + day.medium + day.low, 0);
    
    const lastWeekTotal = lastWeek.reduce((sum, day) => 
      sum + day.critical + day.high + day.medium + day.low, 0);
    
    const firstWeekAvg = firstWeekTotal / firstWeek.length;
    const lastWeekAvg = lastWeekTotal / lastWeek.length;
    
    // Calculate percentage change
    const percentChange = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;
    
    // Calculate critical issue trend specifically
    const firstWeekCritical = firstWeek.reduce((sum, day) => sum + day.critical, 0) / firstWeek.length;
    const lastWeekCritical = lastWeek.reduce((sum, day) => sum + day.critical, 0) / lastWeek.length;
    const criticalChange = ((lastWeekCritical - firstWeekCritical) / (firstWeekCritical || 1)) * 100;
    
    // Calculate risk score (0-100)
    // Higher weight on critical and high severity issues
    const criticalWeight = 0.5;
    const highWeight = 0.3;
    const mediumWeight = 0.15;
    const lowWeight = 0.05;
    
    const lastDayIssues = issuesTrend[issuesTrend.length - 1];
    const maxExpectedIssues = {
      critical: 5,
      high: 10, 
      medium: 20,
      low: 30
    };
    
    const normalizedScore = (
      (Math.min(lastDayIssues.critical, maxExpectedIssues.critical) / maxExpectedIssues.critical) * criticalWeight +
      (Math.min(lastDayIssues.high, maxExpectedIssues.high) / maxExpectedIssues.high) * highWeight +
      (Math.min(lastDayIssues.medium, maxExpectedIssues.medium) / maxExpectedIssues.medium) * mediumWeight +
      (Math.min(lastDayIssues.low, maxExpectedIssues.low) / maxExpectedIssues.low) * lowWeight
    ) * 100;
    
    // Add trend momentum
    const trendMultiplier = percentChange > 0 ? 1 + (percentChange / 100) : 1 - (Math.abs(percentChange) / 200);
    const riskScore = Math.min(100, Math.max(0, Math.round(normalizedScore * trendMultiplier)));
    
    // Determine trend direction
    let trend = 'neutral';
    if (percentChange < -15) trend = 'significantly-improving';
    else if (percentChange < -5) trend = 'improving';
    else if (percentChange > 15) trend = 'significantly-worsening';
    else if (percentChange > 5) trend = 'worsening';
    
    // Create summary
    let summary = '';
    if (trend === 'significantly-improving') {
      summary = `Issues are down ${Math.abs(Math.round(percentChange))}% compared to earlier in the period. Critical issues ${criticalChange < 0 ? 'decreased' : 'increased'} by ${Math.abs(Math.round(criticalChange))}%.`;
    } else if (trend === 'improving') {
      summary = `Issues are gradually decreasing (${Math.abs(Math.round(percentChange))}% reduction). Maintain current practices.`;
    } else if (trend === 'neutral') {
      summary = `Issue rates remain relatively stable (${Math.round(Math.abs(percentChange))}% change). No significant trend detected.`;
    } else if (trend === 'worsening') {
      summary = `Issues are gradually increasing (${Math.round(percentChange)}% rise). Consider reviewing recent changes.`;
    } else {
      summary = `Issues have increased significantly (${Math.round(percentChange)}% rise). Critical errors ${criticalChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(criticalChange))}%. Immediate attention recommended.`;
    }
    
    return { trend, riskScore, summary, percentChange, criticalChange };
  }, [issuesTrend]);

  // Handle exporting dashboard data
  const handleExport = useCallback(() => {
    // This would be connected to a chart export library like html2canvas in a real implementation
    alert(`Dashboard would be exported as ${exportFormat.toUpperCase()}`);
  }, [exportFormat]);

  // Handle chart selection for detailed view
  const handleChartSelect = useCallback((chartType) => {
    setSelectedChart(selectedChart === chartType ? null : chartType);
  }, [selectedChart]);

  // Toggle comparison feature
  const handleToggleComparison = useCallback(() => {
    setShowComparisons(!showComparisons);
    if (!showComparisons) {
      // Set default comparison period
      if (timeRange === '7d') setComparisonPeriod('previous7d');
      else if (timeRange === '30d') setComparisonPeriod('previous30d');
      else if (timeRange === '90d') setComparisonPeriod('previous90d');
      else setComparisonPeriod('previous24h');
    }
  }, [showComparisons, timeRange]);

  // If loading, show loading state
  if (loadingAnalytics) {
    return <LoadingState colors={colors} />;
  }

  // If no data, show empty state
  if (!analyses || analyses.length === 0) {
    return <EmptyState colors={colors} />;
  }

  // Prepare dashboard data
  const dashboardData = {
    colors,
    timeRange,
    issuesByType,
    issuesBySeverity,
    issuesTrend: trendData,
    resolutionRate,
    topErrorPatterns,
    averageResolutionTime,
    modelPerformance,
    impactMetrics,
    hourlyDistribution,
    insights,
    formatUtils,
    selectedIssueType,
    showProjections,
    showDataTable,
    showComparisons,
    comparisonPeriod
  };
  
  // Dashboard event handlers
  const handlers = {
    onExport: handleExport,
    onToggleProjections: () => setShowProjections(!showProjections),
    onToggleComparison: handleToggleComparison,
    onSelectIssueType: (type) => setSelectedIssueType(type),
    onToggleDataTable: () => setShowDataTable(!showDataTable),
    onChartSelect: handleChartSelect,
    onComparisonPeriodChange: (period) => setComparisonPeriod(period),
    onTimeRangeChange: onChange
  };

  // Render full dashboard
  return (
    <div className={`bg-${colors.background} rounded-lg shadow-lg p-6 mb-6`}>
      {/* Dashboard Header */}
      <DashboardHeader
        colors={colors}
        insights={insights}
        timeRange={timeRange}
        showProjections={showProjections} 
        showComparisons={showComparisons}
        onChange={onChange}
        onExport={handleExport}
        onToggleProjections={() => setShowProjections(!showProjections)}
        onToggleComparison={handleToggleComparison}
      />

      {/* Key Metrics Summary Cards */}
      <MetricsSummary 
        colors={colors}
        issuesBySeverity={issuesBySeverity}
        resolutionRate={resolutionRate}
        averageResolutionTime={averageResolutionTime}
        insights={insights}
        formatDuration={formatUtils.formatDuration}
      />

      {/* Dashboard Tabs */}
      <DashboardTabs 
        colors={colors}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Dashboard Content based on active tab */}
      {activeTab === 'overview' && (
        <OverviewTab 
          data={dashboardData}
          handlers={handlers}
        />
      )}

      {activeTab === 'trends' && (
        <TrendsTab 
          data={dashboardData}
          handlers={handlers}
        />
      )}

      {activeTab === 'patterns' && (
        <PatternsTab 
          data={dashboardData}
          handlers={handlers}
        />
      )}

      {activeTab === 'impact' && (
        <ImpactTab 
          data={dashboardData}
          handlers={handlers}
        />
      )}
    </div>
  );
};

export default AnalyticsDashboard;