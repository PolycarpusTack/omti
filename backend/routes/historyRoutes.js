// backend/routes/historyRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models'); // Assuming models are initialized here
const { Op, Sequelize } = require('sequelize');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

/**
 * @route GET /api/history/:userId
 * @description Get all history items for a user
 * @access Private
 */
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is authorized to access this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to access this history' 
      });
    }
    
    // Get history items sorted by timestamp (newest first)
    const historyItems = await db.AnalysisHistory.findAll({
      where: { userId },
      order: [['timestamp', 'DESC']]
    });
      
    return res.json({
      success: true,
      history: historyItems
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route GET /api/history/:userId/analysis/:timestamp
 * @description Get a specific analysis content by timestamp
 * @access Private
 */
router.get('/:userId/analysis/:timestamp', auth, async (req, res) => {
  try {
    const { userId, timestamp } = req.params;
    
    // Ensure user is authorized to access this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to access this analysis' 
      });
    }
    
    // Find the history item to confirm it belongs to the user
    const historyItem = await db.AnalysisHistory.findOne({ 
      where: { userId, timestamp }
    });
    
    if (!historyItem) {
      return res.status(404).json({ 
        success: false, 
        error: 'Analysis not found' 
      });
    }
    
    // Get the actual analysis content
    const analysisContent = await db.AnalysisContent.findOne({
      where: { timestamp }
    });
    
    if (!analysisContent) {
      return res.status(404).json({ 
        success: false, 
        error: 'Analysis content not found' 
      });
    }
    
    return res.json({
      success: true,
      content: analysisContent.getContent()
    });
  } catch (error) {
    console.error('Error fetching analysis content:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route POST /api/history/:userId
 * @description Save a new analysis to history
 * @access Private
 */
router.post('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { item, content } = req.body;
    
    // Ensure user is authorized to create this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to save to this history' 
      });
    }
    
    // Validate input
    if (!userId || !item || !item.timestamp) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID, item, and timestamp are required' 
      });
    }
    
    // Use a transaction for atomic operations
    const transaction = await db.sequelize.transaction();
    
    try {
      // Create history item with user ID
      const historyItem = await db.AnalysisHistory.create({
        ...item,
        userId
      }, { transaction });
      
      // Save the analysis content separately
      if (content) {
        await db.AnalysisContent.create({
          timestamp: item.timestamp,
          content
        }, { transaction });
      }
      
      // Also create or update an entry in analyses table to maintain compatibility
      // This assumes the content is structured in a way that can be extracted
      // This is optional and depends on your application's needs
      if (content && content.summary) {
        const analysisData = {
          id: item.timestamp, // Using timestamp as ID for simplicity
          userId,
          fileName: item.filename,
          fileSize: item.contentLength || 0,
          fileType: item.logType || 'log',
          modelId: item.modelId,
          modelProvider: item.modelId ? (item.modelId.includes('gpt') ? 'openai' : 'ollama') : 'unknown',
          analysisType: item.analysisType,
          status: 'completed',
          processingTime: content.processingTime || 0,
          metadata: {
            originalHistoryTimestamp: item.timestamp,
            successRating: item.successRating
          }
        };
        
        await db.Analysis.upsert(analysisData, { transaction });
      }
      
      // Commit the transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        item: historyItem
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error saving to history:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route PUT /api/history/:userId/item/:timestamp
 * @description Update a history item's metadata
 * @access Private
 */
router.put('/:userId/item/:timestamp', auth, async (req, res) => {
  try {
    const { userId, timestamp } = req.params;
    const { updates } = req.body;
    
    // Ensure user is authorized to update this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to update this history item' 
      });
    }
    
    // Validate input
    if (!userId || !timestamp || !updates) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID, timestamp, and updates are required' 
      });
    }
    
    // Find the history item to update
    const historyItem = await db.AnalysisHistory.findOne({ 
      where: { userId, timestamp }
    });
    
    if (!historyItem) {
      return res.status(404).json({ 
        success: false, 
        error: 'Analysis not found' 
      });
    }
    
    // Prevent updating critical fields
    const safeUpdates = { ...updates };
    delete safeUpdates.userId;
    delete safeUpdates.timestamp;
    delete safeUpdates.id;
    
    // Use a transaction for atomic operations if we need to update analysis as well
    const transaction = await db.sequelize.transaction();
    
    try {
      // Update the history item
      await historyItem.update(safeUpdates, { transaction });
      
      // Also update corresponding analysis if it exists
      const analysis = await db.Analysis.findOne({
        where: { id: timestamp },
        transaction
      });
      
      if (analysis) {
        // Map relevant fields from history to analysis
        const analysisUpdates = {};
        
        if (safeUpdates.filename) analysisUpdates.fileName = safeUpdates.filename;
        if (safeUpdates.modelId) analysisUpdates.modelId = safeUpdates.modelId;
        if (safeUpdates.analysisType) analysisUpdates.analysisType = safeUpdates.analysisType;
        if (safeUpdates.tags) {
          // Update tags relationship if needed
          // This would depend on your specific implementation
        }
        
        // Update the metadata field
        if (Object.keys(analysisUpdates).length > 0 || safeUpdates.successRating) {
          const metadata = analysis.metadata || {};
          if (safeUpdates.successRating) {
            metadata.successRating = safeUpdates.successRating;
          }
          analysisUpdates.metadata = metadata;
        }
        
        // Only update if we have changes
        if (Object.keys(analysisUpdates).length > 0) {
          await analysis.update(analysisUpdates, { transaction });
        }
      }
      
      // Commit the transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        item: await db.AnalysisHistory.findOne({ where: { userId, timestamp } })
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error updating history item:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route DELETE /api/history/:userId/item/:timestamp
 * @description Delete a history item and its content
 * @access Private
 */
router.delete('/:userId/item/:timestamp', auth, async (req, res) => {
  try {
    const { userId, timestamp } = req.params;
    
    // Ensure user is authorized to delete this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to delete this history item' 
      });
    }
    
    // Validate input
    if (!userId || !timestamp) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and timestamp are required' 
      });
    }
    
    // Use a transaction for atomic operations
    const transaction = await db.sequelize.transaction();
    
    try {
      // Delete the history item
      const deleteResult = await db.AnalysisHistory.destroy({ 
        where: { userId, timestamp },
        transaction
      });
      
      if (deleteResult === 0) {
        // If nothing was deleted, rollback transaction
        await transaction.rollback();
        
        return res.status(404).json({ 
          success: false, 
          error: 'Analysis not found' 
        });
      }
      
      // Delete the corresponding content
      await db.AnalysisContent.destroy({ 
        where: { timestamp },
        transaction
      });
      
      // Also delete corresponding analysis if it exists
      await db.Analysis.destroy({
        where: { id: timestamp },
        transaction
      });
      
      // Commit the transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        message: 'Analysis deleted successfully'
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error deleting history item:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route DELETE /api/history/:userId/all
 * @description Delete all history items for a user
 * @access Private
 */
router.delete('/:userId/all', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is authorized to delete all their data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to delete this history' 
      });
    }
    
    // Get all timestamps for the user's history items
    const historyItems = await db.AnalysisHistory.findAll({
      where: { userId },
      attributes: ['timestamp']
    });
    
    if (historyItems.length === 0) {
      return res.json({
        success: true,
        message: 'No history items to delete'
      });
    }
    
    const timestamps = historyItems.map(item => item.timestamp);
    
    // Use a transaction for atomic operations
    const transaction = await db.sequelize.transaction();
    
    try {
      // Delete all history items for the user
      await db.AnalysisHistory.destroy({ 
        where: { userId },
        transaction
      });
      
      // Delete all corresponding content
      await db.AnalysisContent.destroy({ 
        where: { timestamp: { [Op.in]: timestamps } },
        transaction
      });
      
      // Also delete corresponding analyses if they exist
      await db.Analysis.destroy({
        where: { id: { [Op.in]: timestamps } },
        transaction
      });
      
      // Commit the transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        message: `Deleted ${timestamps.length} history items`
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error deleting all history items:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route GET /api/history/:userId/timeline
 * @description Get history items grouped by date for timeline view
 * @access Private
 */
router.get('/:userId/timeline', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      from, // Start date (ISO string)
      to,   // End date (ISO string)
      limit = 50 // Max number of items
    } = req.query;
    
    // Ensure user is authorized to access this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to access this history' 
      });
    }
    
    // Build query based on date range
    const whereClause = { userId };
    
    if (from || to) {
      whereClause.timestamp = {};
      
      if (from) {
        whereClause.timestamp[Op.gte] = from;
      }
      
      if (to) {
        whereClause.timestamp[Op.lte] = to;
      }
    }
    
    // Get history items sorted by timestamp (newest first)
    const historyItems = await db.AnalysisHistory.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });
    
    // Group items by date
    const timelineGroups = {};
    
    historyItems.forEach(item => {
      const date = new Date(item.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!timelineGroups[dateKey]) {
        timelineGroups[dateKey] = {
          date: dateKey,
          formattedDate: date.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          items: []
        };
      }
      
      timelineGroups[dateKey].items.push(item);
    });
    
    // Convert to array and sort by date (most recent first)
    const groupsArray = Object.values(timelineGroups).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    return res.json({
      success: true,
      timeline: groupsArray
    });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route GET /api/history/:userId/stats
 * @description Get usage statistics for the user
 * @access Private
 */
router.get('/:userId/stats', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is authorized to access this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to access this data' 
      });
    }
    
    // Get total count
    const totalCount = await db.AnalysisHistory.count({
      where: { userId }
    });
    
    // Get count by model using raw SQL (more efficient for aggregation)
    const modelStats = await db.sequelize.query(`
      SELECT "modelId", COUNT(*) as count
      FROM analysis_history
      WHERE "userId" = :userId
      GROUP BY "modelId"
      ORDER BY count DESC
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    // Get count by analysis type
    const typeStats = await db.sequelize.query(`
      SELECT "analysisType", COUNT(*) as count
      FROM analysis_history
      WHERE "userId" = :userId
      GROUP BY "analysisType"
      ORDER BY count DESC
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    // Get average success rating
    const ratingStats = await db.sequelize.query(`
      SELECT AVG("successRating") as average, COUNT(*) as count
      FROM analysis_history
      WHERE "userId" = :userId AND "successRating" IS NOT NULL
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    // Get most used tags (PostgreSQL has JSON array functions)
    const tagStats = await db.sequelize.query(`
      SELECT tag, COUNT(*) as count
      FROM analysis_history, jsonb_array_elements_text(tags) as tag
      WHERE "userId" = :userId
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    // Get usage over time (by month)
    const timeStats = await db.sequelize.query(`
      SELECT TO_CHAR(TO_TIMESTAMP("timestamp", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'YYYY-MM') as yearMonth,
             COUNT(*) as count
      FROM analysis_history
      WHERE "userId" = :userId
      GROUP BY yearMonth
      ORDER BY yearMonth ASC
    `, {
      replacements: { userId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return res.json({
      success: true,
      stats: {
        totalCount,
        modelStats,
        typeStats,
        ratingStats: ratingStats.length > 0 ? ratingStats[0] : { average: 0, count: 0 },
        tagStats,
        timeStats
      }
    });
  } catch (error) {
    console.error('Error fetching history stats:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route PUT /api/history/:userId/sync
 * @description Sync merged history data
 * @access Private
 */
router.put('/:userId/sync', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { history } = req.body;
    
    // Ensure user is authorized to sync this data
    if (req.user.id !== userId && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to sync this history' 
      });
    }
    
    // Validate input
    if (!userId || !history || !Array.isArray(history)) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and history array are required' 
      });
    }
    
    // Use a transaction for atomic operations
    const transaction = await db.sequelize.transaction();
    
    try {
      // Process each history item
      const results = {
        created: 0,
        updated: 0,
        failed: 0
      };
      
      for (const item of history) {
        try {
          // Check if item already exists
          const existingItem = await db.AnalysisHistory.findOne({ 
            where: { userId, timestamp: item.timestamp },
            transaction
          });
          
          if (existingItem) {
            // Only update if remote is more recent
            const localUpdatedAt = new Date(existingItem.updatedAt);
            const remoteUpdatedAt = new Date(item.updatedAt || item.timestamp);
            
            if (remoteUpdatedAt > localUpdatedAt) {
              // Update item (exclude critical fields)
              const safeItem = { ...item };
              delete safeItem.id;
              delete safeItem.userId;
              safeItem.userId = userId; // Ensure correct userId
              
              await existingItem.update(safeItem, { transaction });
              results.updated++;
            }
          } else {
            // Create new item
            await db.AnalysisHistory.create({
              ...item,
              userId
            }, { transaction });
            results.created++;
          }
        } catch (itemError) {
          console.error(`Error processing item ${item.timestamp}:`, itemError);
          results.failed++;
        }
      }
      
      // Commit the transaction
      await transaction.commit();
      
      return res.json({
        success: true,
        results
      });
    } catch (transactionError) {
      // Rollback transaction on error
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Error syncing history:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

module.exports = router;