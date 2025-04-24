/**
 * Enhanced Analytics API Routes
 * Enterprise-grade API endpoints for analytics data
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const authMiddleware = require('../middleware/auth'); // Assumed auth middleware

/**
 * @route   GET /api/analytics
 * @desc    Get analytics data for dashboard
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { 
      timeRange = '7d',
      filterSeverity,
      filterType,
      includeProjections = false,
      projectionDays = 7
    } = req.query;
    
    const userId = req.user?.id; // From auth middleware
    
    // Validate time range
    const validTimeRanges = ['24h', '7d', '30d', '90d', 'all'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({ 
        error: 'Invalid time range parameter. Valid values: 24h, 7d, 30d, 90d, all' 
      });
    }
    
    // Get analytics data
    const options = {};
    if (filterSeverity) options.severity = filterSeverity;
    if (filterType) options.issueType = filterType;
    
    const analyticsData = await analyticsService.getAnalyticsData(timeRange, userId, options);
    
    // Add projections if requested
    if (includeProjections === 'true') {
      const projectionData = await analyticsService.getProjectedTrends(
        timeRange, 
        parseInt(projectionDays) || 7,
        userId
      );
      
      analyticsData.projections = projectionData;
    }
    
    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics data' });
  }
});

/**
 * @route   GET /api/analytics/trends
 * @desc    Get trend data for issues over time
 * @access  Private
 */
router.get('/trends', authMiddleware, async (req, res) => {
  try {
    const { 
      timeRange = '30d', 
      includeProjections = false,
      projectionDays = 7
    } = req.query;
    
    const userId = req.user?.id;
    
    // Get analytics data (just the trends portion)
    const { issuesTrend } = await analyticsService.getAnalyticsData(timeRange, userId);
    
    let responseData = { issuesTrend };
    
    // Add projections if requested
    if (includeProjections === 'true') {
      const projectionData = await analyticsService.getProjectedTrends(
        timeRange, 
        parseInt(projectionDays) || 7,
        userId
      );
      
      responseData.projections = projectionData;
    }
    
    res.json(responseData);
  } catch (error) {
    console.error('Analytics trends API error:', error);
    res.status(500).json({ error: 'Failed to retrieve trends data' });
  }
});

/**
 * @route   GET /api/analytics/patterns
 * @desc    Get error pattern analysis
 * @access  Private
 */
router.get('/patterns', authMiddleware, async (req, res) => {
  try {
    const { timeRange = 'all', limit = 10 } = req.query;
    const userId = req.user?.id;
    
    // Get analytics data (just the patterns portion)
    const { topErrorPatterns } = await analyticsService.getAnalyticsData(timeRange, userId);
    
    // Limit the number of patterns returned
    const limitedPatterns = topErrorPatterns.slice(0, parseInt(limit) || 10);
    
    res.json({ topErrorPatterns: limitedPatterns });
  } catch (error) {
    console.error('Analytics patterns API error:', error);
    res.status(500).json({ error: 'Failed to retrieve error patterns data' });
  }
});

/**
 * @route   GET /api/analytics/impact
 * @desc    Get business impact metrics
 * @access  Private
 */
router.get('/impact', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const userId = req.user?.id;
    
    // Get analytics data (just the impact metrics)
    const { impactMetrics } = await analyticsService.getAnalyticsData(timeRange, userId);
    
    res.json({ impactMetrics });
  } catch (error) {
    console.error('Analytics impact API error:', error);
    res.status(500).json({ error: 'Failed to retrieve impact metrics' });
  }
});

/**
 * @route   GET /api/analytics/distribution
 * @desc    Get hourly distribution data
 * @access  Private
 */
router.get('/distribution', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    const userId = req.user?.id;
    
    // Get analytics data (just the hourly distribution)
    const { hourlyDistribution } = await analyticsService.getAnalyticsData(timeRange, userId);
    
    res.json({ hourlyDistribution });
  } catch (error) {
    console.error('Analytics distribution API error:', error);
    res.status(500).json({ error: 'Failed to retrieve distribution data' });
  }
});

/**
 * @route   GET /api/analytics/models
 * @desc    Get model performance data
 * @access  Private
 */
router.get('/models', authMiddleware, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const userId = req.user?.id;
    
    // Get analytics data (just the model performance)
    const { modelPerformance } = await analyticsService.getAnalyticsData(timeRange, userId);
    
    res.json({ modelPerformance });
  } catch (error) {
    console.error('Analytics models API error:', error);
    res.status(500).json({ error: 'Failed to retrieve model performance data' });
  }
});

/**
 * @route   GET /api/analytics/summary
 * @desc    Get summary of analytics data (for quick overview)
 * @access  Private
 */
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Get data for last 7 days
    const analyticsData = await analyticsService.getAnalyticsData('7d', userId);
    
    // Create a summary object with key metrics
    const summary = {
      totalIssues: analyticsData.totalIssues || 0,
      resolvedIssues: analyticsData.resolvedIssues || 0,
      resolutionRate: analyticsData.resolutionRate || 0,
      criticalIssues: analyticsData.issuesBySeverity?.Critical || 0,
      averageResolutionTime: analyticsData.averageResolutionTime || 0,
      topErrorPattern: analyticsData.topErrorPatterns?.[0] || null
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Analytics summary API error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics summary' });
  }
});

/**
 * @route   POST /api/analytics/export
 * @desc    Export analytics data as CSV, JSON, or XLSX
 * @access  Private
 */
router.post('/export', authMiddleware, async (req, res) => {
  try {
    const { timeRange = 'all', format = 'json' } = req.body;
    const userId = req.user?.id;
    
    // Validate format
    const validFormats = ['json', 'csv', 'xlsx'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Valid values: json, csv, xlsx' 
      });
    }
    
    // Export the data
    const exportData = await analyticsService.exportAnalytics(timeRange, format, userId);
    
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportData.filename}`);
    return res.send(exportData.data);
  } catch (error) {
    console.error('Analytics export API error:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

/**
 * @route   POST /api/analytics/pattern
 * @desc    Save a new error pattern
 * @access  Private
 */
router.post('/pattern', authMiddleware, async (req, res) => {
  try {
    const { pattern, trend = 'new' } = req.body;
    const userId = req.user?.id;
    
    if (!pattern) {
      return res.status(400).json({ error: 'Pattern text is required' });
    }
    
    const patternData = {
      pattern,
      trend,
      userId,
      lastOccurred: new Date(),
      frequency: 1
    };
    
    // In a real implementation, this would save to the database
    res.status(201).json(patternData);
  } catch (error) {
    console.error('Save pattern API error:', error);
    res.status(500).json({ error: 'Failed to save error pattern' });
  }
});

/**
 * @route   PUT /api/analytics/pattern/:id
 * @desc    Update an error pattern (mark as resolved, etc.)
 * @access  Private
 */
router.put('/pattern/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, assignee } = req.body;
    const userId = req.user?.id;
    
    // Validate status
    const validStatuses = ['open', 'in-progress', 'resolved', 'ignored'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Valid values: open, in-progress, resolved, ignored'
      });
    }
    
    // In a real implementation, this would update in the database
    res.json({
      id,
      status: status || 'open',
      resolution,
      assignee,
      updatedBy: userId,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Update pattern API error:', error);
    res.status(500).json({ error: 'Failed to update error pattern' });
  }
});

/**
 * @route   POST /api/analytics/threshold
 * @desc    Set custom alert thresholds for analytics
 * @access  Private
 */
router.post('/threshold', authMiddleware, async (req, res) => {
  try {
    const { metric, value, notificationEnabled = true } = req.body;
    const userId = req.user?.id;
    
    if (!metric || value === undefined) {
      return res.status(400).json({ error: 'Metric and value are required' });
    }
    
    // Valid metrics
    const validMetrics = [
      'critical_count', 'high_count', 'resolution_rate',
      'resolution_time', 'pattern_occurrence'
    ];
    
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: `Invalid metric. Valid values: ${validMetrics.join(', ')}`
      });
    }
    
    // In a real implementation, this would save to the database
    res.status(201).json({
      id: `threshold-${Date.now()}`,
      metric,
      value,
      notificationEnabled,
      createdBy: userId,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Threshold API error:', error);
    res.status(500).json({ error: 'Failed to set threshold' });
  }
});

module.exports = router;