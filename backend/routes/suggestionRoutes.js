// backend/routes/suggestionRoutes.js
const express = require('express');
const router = express.Router();
const modelSuggestionService = require('../services/modelSuggestionService');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

/**
 * @route POST /api/suggestion/model
 * @description Get a model suggestion based on content analysis
 * @access Private
 */
router.post('/model', auth, async (req, res) => {
  try {
    const {
      contentSample,
      logType = 'unknown',
      contentLength = 0,
      includeStackTraces = false,
      availableModelIds = []
    } = req.body;
    
    // Validate required fields
    if (!contentSample) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content sample is required' 
      });
    }
    
    if (!availableModelIds || availableModelIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Available model IDs are required' 
      });
    }
    
    // Get user ID from authenticated user
    const userId = req.user ? req.user.id : undefined;
    
    // Get suggestion from service
    const suggestion = await modelSuggestionService.suggestModel({
      contentSample,
      logType,
      contentLength,
      includeStackTraces,
      availableModelIds,
      userId
    });
    
    return res.json({
      success: true,
      ...suggestion
    });
  } catch (error) {
    console.error('Error in model suggestion route:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route POST /api/suggestion/feedback
 * @description Record feedback about model selection
 * @access Private
 */
router.post('/feedback', auth, async (req, res) => {
  try {
    const {
      suggestedModelId,
      selectedModelId,
      contentLength,
      logType,
      includeStackTraces,
      wasSuggestionAccepted
    } = req.body;
    
    // Validate required fields
    if (!suggestedModelId || !selectedModelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both suggested and selected model IDs are required' 
      });
    }
    
    // Get user ID from authenticated user
    const userId = req.user ? req.user.id : undefined;
    
    // Record feedback
    const success = await modelSuggestionService.recordSelectionFeedback({
      suggestedModelId,
      selectedModelId,
      contentLength,
      logType,
      includeStackTraces,
      wasSuggestionAccepted,
      userId
    });
    
    return res.json({
      success
    });
  } catch (error) {
    console.error('Error in feedback route:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

/**
 * @route GET /api/suggestion/user-preferences
 * @description Get user model preferences
 * @access Private
 */
router.get('/user-preferences', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's preferences from database
    const user = await req.db.User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const preferences = user.preferences || {};
    const modelPreferences = preferences.preferredModels || [];
    
    return res.json({
      success: true,
      preferences: {
        preferredModels: modelPreferences
      }
    });
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route PUT /api/suggestion/user-preferences
 * @description Update user model preferences
 * @access Private
 */
router.put('/user-preferences', auth, async (req, res) => {
  try {
    const { preferredModels } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!Array.isArray(preferredModels)) {
      return res.status(400).json({
        success: false,
        error: 'Preferred models must be an array'
      });
    }
    
    // Get user from database
    const user = await req.db.User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update preferences
    const preferences = user.preferences || {};
    preferences.preferredModels = preferredModels;
    
    await user.update({ preferences });
    
    return res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/suggestion/stats
 * @description Get suggestion statistics
 * @access Private (Admin only)
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access suggestion statistics'
      });
    }
    
    const { db } = req;
    const { Op, Sequelize } = db.Sequelize;
    
    // Get overall acceptance rate
    const acceptanceStats = await db.ModelSuggestion.findAll({
      attributes: [
        'wasSuggestionAccepted',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['wasSuggestionAccepted']
    });
    
    // Convert to a more usable format
    const acceptanceCounts = {
      accepted: 0,
      rejected: 0
    };
    
    acceptanceStats.forEach(stat => {
      if (stat.wasSuggestionAccepted) {
        acceptanceCounts.accepted = parseInt(stat.get('count'));
      } else {
        acceptanceCounts.rejected = parseInt(stat.get('count'));
      }
    });
    
    const totalSuggestions = acceptanceCounts.accepted + acceptanceCounts.rejected;
    const acceptanceRate = totalSuggestions > 0 
      ? (acceptanceCounts.accepted / totalSuggestions) * 100 
      : 0;
    
    // Get top suggested models
    const topSuggestedModels = await db.ModelSuggestion.findAll({
      attributes: [
        'suggestedModelId',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['suggestedModelId'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 5
    });
    
    // Get top selected models
    const topSelectedModels = await db.ModelSuggestion.findAll({
      attributes: [
        'selectedModelId',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['selectedModelId'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 5
    });
    
    // Get acceptance rate by content type
    const contentTypeStats = await db.ModelSuggestion.findAll({
      attributes: [
        'logType',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [
          Sequelize.fn(
            'SUM', 
            Sequelize.literal('CASE WHEN "wasSuggestionAccepted" = true THEN 1 ELSE 0 END')
          ), 
          'accepted'
        ]
      ],
      group: ['logType'],
      having: Sequelize.literal('COUNT(id) > 5') // Only include types with enough data
    });
    
    // Calculate rates for each content type
    const contentTypeRates = contentTypeStats.map(stat => {
      const total = parseInt(stat.get('total'));
      const accepted = parseInt(stat.get('accepted'));
      return {
        logType: stat.logType,
        total,
        accepted,
        rate: (accepted / total) * 100
      };
    });
    
    return res.json({
      success: true,
      stats: {
        totalSuggestions,
        acceptanceRate,
        acceptanceCounts,
        topSuggestedModels,
        topSelectedModels,
        contentTypeRates
      }
    });
  } catch (error) {
    console.error('Error getting suggestion stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;