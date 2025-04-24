/**
 * Dashboard constants
 * Defines theme colors, time ranges, and chart types
 */

// Theme colors with proper branding support
export const THEME_COLORS = {
    light: {
      background: '#ffffff',
      cardBackground: '#f9fafb',
      text: '#1f2937',
      secondaryText: '#6b7280',
      border: '#e5e7eb',
      accent: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#6366f1',
      chartColors: ['#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#6366f1', '#f43f5e', '#8b5cf6', '#14b8a6', '#0ea5e9'],
      chartGradients: [
        ['#3b82f6', '#93c5fd'], // blue
        ['#f59e0b', '#fcd34d'], // amber
        ['#10b981', '#6ee7b7'], // emerald
        ['#6366f1', '#a5b4fc'], // indigo
        ['#ec4899', '#f9a8d4']  // pink
      ]
    },
    dark: {
      background: '#1f2937',
      cardBackground: '#111827',
      text: '#f9fafb',
      secondaryText: '#d1d5db',
      border: '#374151',
      accent: '#60a5fa',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#818cf8',
      chartColors: ['#60a5fa', '#fbbf24', '#34d399', '#818cf8', '#f472b6', '#818cf8', '#fb7185', '#a78bfa', '#2dd4bf', '#38bdf8'],
      chartGradients: [
        ['#60a5fa', '#3b82f6'], // blue
        ['#fbbf24', '#f59e0b'], // amber
        ['#34d399', '#10b981'], // emerald
        ['#818cf8', '#6366f1'], // indigo
        ['#f472b6', '#ec4899']  // pink
      ]
    }
  };
  
  // Time range options for the selector
  export const TIME_RANGES = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' }
  ];
  
  // Chart types for the enterprise view
  export const CHART_TYPES = {
    ISSUE_SEVERITY: 'issueSeverity',
    ISSUE_TRENDS: 'issueTrends',
    ROOT_CAUSES: 'rootCauses',
    MODEL_PERFORMANCE: 'modelPerformance',
    RESOLUTION_TIME: 'resolutionTime',
    ISSUE_DISTRIBUTION: 'issueDistribution',
    PEAK_HOURS: 'peakHours',
    REGRESSION_ANALYSIS: 'regressionAnalysis',
    COMPARATIVE_ANALYSIS: 'comparativeAnalysis'
  };
  
  // Comparison period options
  export const COMPARISON_PERIODS = [
    { value: 'previous24h', label: 'Previous 24 Hours' },
    { value: 'previous7d', label: 'Previous 7 Days' },
    { value: 'previous30d', label: 'Previous 30 Days' },
    { value: 'previous90d', label: 'Previous 90 Days' },
    { value: 'sameLastWeek', label: 'Same Period Last Week' },
    { value: 'sameLastMonth', label: 'Same Period Last Month' }
  ];
  
  // Export formats
  export const EXPORT_FORMATS = [
    { value: 'png', label: 'PNG Image' },
    { value: 'pdf', label: 'PDF Document' },
    { value: 'csv', label: 'CSV Data' },
    { value: 'xlsx', label: 'Excel Spreadsheet' }
  ];