// backend/services/modelSuggestionService.js
const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const cache = require('../utils/cache');
const modelRegistry = require('./modelRegistryService');

/**
 * Model Suggestion Service - Provides intelligent model suggestions
 * based on content analysis, past usage patterns, and system health metrics
 * 
 * Enhanced features:
 * - Continuous retraining pipeline for suggestion algorithm
 * - GPU-aware model routing
 * - Content modality detection
 * - Performance and system health awareness
 * - User personalization
 */
class ModelSuggestionService {
  constructor() {
    // Create a cache for suggestion results
    this.suggestionCache = cache.create({
      name: 'model-suggestions',
      ttl: 5 * 60 * 1000, // 5 minutes
      max: 500
    });
    
    // Initialize suggestion weights
    this.contentWeights = {
      codeSnippets: 3.0,
      errorMessages: 2.0,
      jsonData: 2.0,
      contentLength: 1.5,
      stackTraces: 2.5
    };
    
    // Initialize modality affinities
    this.modalityAffinities = {
      'default': {
        text: 1.0,
        code: 1.0,
        structured: 1.0,
        errors: 1.0
      },
      'gpt-4': {
        text: 1.0,
        code: 1.2,
        structured: 1.3,
        errors: 1.2
      },
      'gpt-3.5-turbo': {
        text: 1.2,
        code: 1.0,
        structured: 0.9,
        errors: 0.8
      },
      'code-llama': {
        text: 0.8,
        code: 1.5,
        structured: 1.0,
        errors: 1.3
      },
      'llama2': {
        text: 1.2,
        code: 0.8,
        structured: 0.9,
        errors: 0.9
      },
      'mistral': {
        text: 1.3,
        code: 0.9,
        structured: 0.8,
        errors: 0.8
      },
      'mixtral': {
        text: 1.2,
        code: 1.1,
        structured: 1.2,
        errors: 1.1
      }
    };
    
    // Initialize retraining pipeline
    this._initRetrainingPipeline();
    
    logger.info('ModelSuggestionService initialized');
  }
  
  /**
   * Initialize the continuous retraining pipeline for model suggestions
   * @private
   */
  _initRetrainingPipeline() {
    const RETRAIN_INTERVAL = parseInt(process.env.SUGGESTION_RETRAIN_INTERVAL || '3600', 10); // 1 hour default
    
    // Set up interval for retraining
    setInterval(async () => {
      try {
        logger.info('Starting model suggestion retraining pipeline');
        
        // Fetch recent feedback data
        const feedbackData = await db.ModelSuggestion.findAll({
          where: {
            createdAt: {
              [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          limit: 1000,
          order: [['createdAt', 'DESC']]
        });
        
        if (feedbackData.length === 0) {
          logger.info('No recent feedback data available for retraining');
          return;
        }
        
        // Train on new data
        await this._trainOnNewData(feedbackData);
        
        // Record metrics
        metrics.setGauge('model_suggestion_training_data_count', feedbackData.length);
        logger.info(`Model suggestion retraining completed with ${feedbackData.length} samples`);
      } catch (error) {
        logger.error('Error in model suggestion retraining pipeline:', error);
        metrics.incrementCounter('model_suggestion_training_errors');
      }
    }, RETRAIN_INTERVAL * 1000);
    
    logger.info(`Model suggestion retraining pipeline initialized with interval ${RETRAIN_INTERVAL}s`);
  }
  
  /**
   * Train suggestion algorithm on new feedback data
   * @param {Array} feedbackData Array of feedback data records
   * @private
   */
  async _trainOnNewData(feedbackData) {
    logger.debug(`Training on ${feedbackData.length} feedback records`);
    
    // Extract features from feedback data
    const features = feedbackData.map(d => ({
      contentLengthRange: d.contentLengthRange,
      logType: d.logType,
      includeStackTraces: d.includeStackTraces,
      suggestedModelId: d.suggestedModelId,
      selectedModelId: d.selectedModelId,
      accepted: d.wasSuggestionAccepted
    }));
    
    // Update content weights based on acceptance patterns
    const newWeights = this._calculateFeatureWeights(features);
    
    // Update weights with smoothing to avoid drastic changes
    const SMOOTHING_FACTOR = 0.7; // 70% old weights, 30% new weights
    
    for (const [key, newWeight] of Object.entries(newWeights)) {
      this.contentWeights[key] = (
        this.contentWeights[key] * SMOOTHING_FACTOR + 
        newWeight * (1 - SMOOTHING_FACTOR)
      );
    }
    
    // Update modality affinities based on model selection patterns
    this._updateModalityAffinities(features);
    
    logger.info('Updated content weights and modality affinities from training data');
    logger.debug('New content weights:', this.contentWeights);
  }
  
  /**
   * Calculate feature weights based on accepted suggestions
   * @param {Array} features Feature data extracted from feedback
   * @returns {Object} Updated feature weights
   * @private
   */
  _calculateFeatureWeights(features) {
    // Initialize counters
    const acceptedCounts = {
      contentLength: { xs: 0, s: 0, m: 0, l: 0, xl: 0 },
      logType: {},
      stackTraces: { true: 0, false: 0 }
    };
    
    const totalCounts = {
      contentLength: { xs: 0, s: 0, m: 0, l: 0, xl: 0 },
      logType: {},
      stackTraces: { true: 0, false: 0 }
    };
    
    // Count acceptances by feature
    features.forEach(feature => {
      // Content length
      if (!totalCounts.contentLength[feature.contentLengthRange]) {
        totalCounts.contentLength[feature.contentLengthRange] = 0;
        acceptedCounts.contentLength[feature.contentLengthRange] = 0;
      }
      
      totalCounts.contentLength[feature.contentLengthRange]++;
      
      if (feature.accepted) {
        acceptedCounts.contentLength[feature.contentLengthRange]++;
      }
      
      // Log type
      if (!totalCounts.logType[feature.logType]) {
        totalCounts.logType[feature.logType] = 0;
        acceptedCounts.logType[feature.logType] = 0;
      }
      
      totalCounts.logType[feature.logType]++;
      
      if (feature.accepted) {
        acceptedCounts.logType[feature.logType]++;
      }
      
      // Stack traces
      const hasStackTraces = feature.includeStackTraces ? 'true' : 'false';
      totalCounts.stackTraces[hasStackTraces]++;
      
      if (feature.accepted) {
        acceptedCounts.stackTraces[hasStackTraces]++;
      }
    });
    
    // Calculate acceptance rates
    const acceptanceRates = {
      contentLength: {},
      logType: {},
      stackTraces: {}
    };
    
    // Content length acceptance rates
    for (const [size, count] of Object.entries(totalCounts.contentLength)) {
      if (count > 0) {
        acceptanceRates.contentLength[size] = acceptedCounts.contentLength[size] / count;
      }
    }
    
    // Log type acceptance rates
    for (const [type, count] of Object.entries(totalCounts.logType)) {
      if (count > 0) {
        acceptanceRates.logType[type] = acceptedCounts.logType[type] / count;
      }
    }
    
    // Stack traces acceptance rates
    for (const [hasTraces, count] of Object.entries(totalCounts.stackTraces)) {
      if (count > 0) {
        acceptanceRates.stackTraces[hasTraces] = acceptedCounts.stackTraces[hasTraces] / count;
      }
    }
    
    // Convert acceptance rates to feature weights
    // Higher acceptance rates get higher weights
    const weights = {
      contentLength: this._normalizeWeights(acceptanceRates.contentLength, 1.5),
      codeSnippets: this.contentWeights.codeSnippets, // Keep existing weight for now
      errorMessages: this._getWeightForLogType(acceptanceRates.logType, ['error', 'critical']),
      jsonData: this.contentWeights.jsonData, // Keep existing weight for now
      stackTraces: acceptanceRates.stackTraces.true > acceptanceRates.stackTraces.false ? 
        2.5 : 1.0
    };
    
    return weights;
  }
  
  /**
   * Update modality affinities based on model selection patterns
   * @param {Array} features Feature data extracted from feedback
   * @private
   */
  _updateModalityAffinities(features) {
    // Group selections by model ID
    const modelSelections = {};
    
    features.forEach(feature => {
      const modelId = feature.selectedModelId;
      
      // Extract base model name for generalization
      const baseModelId = this._getBaseModelId(modelId);
      
      if (!modelSelections[baseModelId]) {
        modelSelections[baseModelId] = {
          total: 0,
          byLogType: {},
          byContentLength: {},
          byStackTraces: {}
        };
      }
      
      const selection = modelSelections[baseModelId];
      selection.total++;
      
      // Count by log type
      if (!selection.byLogType[feature.logType]) {
        selection.byLogType[feature.logType] = 0;
      }
      selection.byLogType[feature.logType]++;
      
      // Count by content length
      if (!selection.byContentLength[feature.contentLengthRange]) {
        selection.byContentLength[feature.contentLengthRange] = 0;
      }
      selection.byContentLength[feature.contentLengthRange]++;
      
      // Count by stack traces
      const stackTraceKey = feature.includeStackTraces ? 'true' : 'false';
      if (!selection.byStackTraces[stackTraceKey]) {
        selection.byStackTraces[stackTraceKey] = 0;
      }
      selection.byStackTraces[stackTraceKey]++;
    });
    
    // Update affinities based on selection patterns
    for (const [baseModelId, selection] of Object.entries(modelSelections)) {
      if (!this.modalityAffinities[baseModelId]) {
        this.modalityAffinities[baseModelId] = { ...this.modalityAffinities.default };
      }
      
      // Update code affinity based on error logs and stack traces
      if (selection.byLogType['error'] && selection.byStackTraces['true']) {
        const errorRatio = selection.byLogType['error'] / selection.total;
        const stackTracesRatio = selection.byStackTraces['true'] / selection.total;
        
        if (errorRatio > 0.3 && stackTracesRatio > 0.3) {
          // This model is often selected for error logs with stack traces
          this.modalityAffinities[baseModelId].code = 
            this.modalityAffinities[baseModelId].code * 0.7 + 1.3 * 0.3;
          
          this.modalityAffinities[baseModelId].errors = 
            this.modalityAffinities[baseModelId].errors * 0.7 + 1.4 * 0.3;
        }
      }
      
      // Update text affinity based on info logs
      if (selection.byLogType['info']) {
        const infoRatio = selection.byLogType['info'] / selection.total;
        
        if (infoRatio > 0.4) {
          // This model is often selected for info logs
          this.modalityAffinities[baseModelId].text = 
            this.modalityAffinities[baseModelId].text * 0.7 + 1.3 * 0.3;
        }
      }
      
      // Update structured data affinity based on content length
      if (selection.byContentLength['l'] || selection.byContentLength['xl']) {
        const largeContentRatio = 
          ((selection.byContentLength['l'] || 0) + (selection.byContentLength['xl'] || 0)) / 
          selection.total;
        
        if (largeContentRatio > 0.3) {
          // This model is often selected for large content
          this.modalityAffinities[baseModelId].structured = 
            this.modalityAffinities[baseModelId].structured * 0.7 + 1.2 * 0.3;
        }
      }
    }
    
    logger.debug('Updated modality affinities:', this.modalityAffinities);
  }
  
  /**
   * Normalize a set of weights to have a specific maximum
   * @param {Object} weights Object of weight values
   * @param {number} maxWeight Maximum weight value
   * @returns {number} Normalized weight value
   * @private
   */
  _normalizeWeights(weights, maxWeight) {
    const values = Object.values(weights);
    if (values.length === 0) return maxWeight;
    
    const maxValue = Math.max(...values);
    if (maxValue === 0) return maxWeight;
    
    const normalizedWeights = {};
    for (const [key, value] of Object.entries(weights)) {
      normalizedWeights[key] = (value / maxValue) * maxWeight;
    }
    
    return normalizedWeights;
  }
  
  /**
   * Get weight for specific log types
   * @param {Object} logTypeRates Acceptance rates by log type
   * @param {Array} targetTypes Types to check
   * @returns {number} Weight value
   * @private
   */
  _getWeightForLogType(logTypeRates, targetTypes) {
    let sum = 0;
    let count = 0;
    
    for (const type of targetTypes) {
      if (logTypeRates[type] !== undefined) {
        sum += logTypeRates[type];
        count++;
      }
    }
    
    if (count === 0) return 2.0; // Default value
    return Math.min(3.0, Math.max(1.0, (sum / count) * 3.0));
  }
  
  /**
   * Extract the base model ID from a specific model version
   * @param {string} modelId Full model ID
   * @returns {string} Base model ID
   * @private
   */
  _getBaseModelId(modelId) {
    // Extract base model from ID patterns
    if (modelId.startsWith('gpt-4')) return 'gpt-4';
    if (modelId.startsWith('gpt-3.5')) return 'gpt-3.5-turbo';
    if (modelId.includes('llama') && modelId.includes('-code')) return 'code-llama';
    if (modelId.includes('llama')) return 'llama2';
    if (modelId.includes('mistral')) return 'mistral';
    if (modelId.includes('mixtral')) return 'mixtral';
    
    // Default to original ID if no pattern matches
    return modelId;
  }

  /**
   * Suggests the best model for analyzing the given content
   * Enhanced with:
   * - Multi-factor scoring
   * - System health awareness
   * - GPU-aware routing
   * - Multi-modal content analysis
   * - User personalization
   * 
   * @param {Object} params Parameters for suggestion
   * @param {string} params.contentSample Sample of the content to analyze
   * @param {string} params.logType Type of log (error, info, debug, etc.)
   * @param {number} params.contentLength Total length of the content
   * @param {boolean} params.includeStackTraces Whether content includes stack traces
   * @param {Array<string>} params.availableModelIds IDs of available models
   * @param {string} [params.userId] Optional user ID for personalized suggestions
   * @returns {Object} Suggestion result with model ID and reason
   */
  async suggestModel({
    contentSample,
    logType,
    contentLength,
    includeStackTraces,
    availableModelIds,
    userId
  }) {
    // Performance metrics
    const startTime = Date.now();
    metrics.incrementCounter('model_suggestions');
    
    // If no models are available, return null
    if (!availableModelIds || availableModelIds.length === 0) {
      metrics.incrementCounter('model_suggestions_no_models');
      logger.warn('No models available for suggestion');
      return { 
        suggestedModelId: null,
        reason: 'No models available'
      };
    }
    
    try {
      // Generate cache key based on input parameters
      const cacheKey = this._generateCacheKey({
        contentSample: contentSample?.substring(0, 100),
        logType,
        contentLength,
        includeStackTraces,
        availableModelIds: availableModelIds.sort().join(','),
        userId
      });
      
      // Check cache first
      const cachedSuggestion = this.suggestionCache.get(cacheKey);
      if (cachedSuggestion) {
        metrics.incrementCounter('model_suggestions_cache_hit');
        logger.debug('Returning cached model suggestion');
        metrics.recordResponseTime('suggestModel', Date.now() - startTime);
        return cachedSuggestion;
      }
      
      // 1. Multi-modal content analysis
      const contentModality = this._analyzeContentModality(contentSample);
      logger.debug('Content modality analysis:', contentModality);
      
      // 2. Historical patterns analysis
      const historicalPattern = await this._findHistoricalPattern({
        logType,
        contentLength,
        includeStackTraces,
        userId,
        availableModelIds
      });
      
      // 3. Score models based on content characteristics
      const contentScores = this._scoreModelsByContent(
        availableModelIds,
        contentSample,
        logType,
        contentLength,
        includeStackTraces
      );
      logger.debug('Model content scores:', contentScores);
      
      // 4. Score models based on modality
      const modalityScores = this._scoreModelsByModality(
        availableModelIds,
        contentModality
      );
      logger.debug('Model modality scores:', modalityScores);
      
      // 5. Get user preferences
      const userPreferences = await this._getUserPreferences(userId);
      
      // 6. Get system health scores
      const healthScores = await this._scoreModelsWithSystemHealth(
        availableModelIds
      );
      logger.debug('Model health scores:', healthScores);
      
      // 7. Combine all scores with appropriate weights
      const finalScores = {};
      const SCORE_WEIGHTS = {
        content: 0.35,
        modality: 0.25,
        historical: 0.20,
        userPreference: 0.15,
        systemHealth: 0.05
      };
      
      for (const modelId of availableModelIds) {
        finalScores[modelId] = (
          (contentScores[modelId] || 0) * SCORE_WEIGHTS.content +
          (modalityScores[modelId] || 0) * SCORE_WEIGHTS.modality +
          (historicalPattern && historicalPattern.modelId === modelId ? 
            historicalPattern.score * SCORE_WEIGHTS.historical : 0) +
          (userPreferences[modelId] || 0) * SCORE_WEIGHTS.userPreference +
          (healthScores[modelId] || 0) * SCORE_WEIGHTS.systemHealth
        );
      }
      
      logger.debug('Final model scores:', finalScores);
      
      // Find the highest scoring model
      let highestScore = -1;
      let suggestedModelId = null;
      
      for (const [modelId, score] of Object.entries(finalScores)) {
        if (score > highestScore) {
          highestScore = score;
          suggestedModelId = modelId;
        }
      }
      
      // If we couldn't find a good match, just return the first available model
      if (!suggestedModelId && availableModelIds.length > 0) {
        suggestedModelId = availableModelIds[0];
        metrics.incrementCounter('model_suggestions_fallback');
      }
      
      // Generate ranking of all models
      const rankedSuggestions = Object.entries(finalScores)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Generate reason based on what influenced the decision
      let reason = 'Suggested based on advanced content analysis';
      let confidence = 'medium';
      
      if (historicalPattern && suggestedModelId === historicalPattern.modelId) {
        if (historicalPattern.source === 'user-history') {
          reason = `Suggested based on your previous ${historicalPattern.count} similar analyses`;
          confidence = 'high';
        } else {
          reason = `Suggested based on ${historicalPattern.count} successful similar analyses`;
          confidence = 'high';
        }
      } else {
        const contentCharacteristics = [];
        
        if (contentModality.code > 0.3) {
          contentCharacteristics.push('code analysis capabilities');
        }
        
        if (contentModality.errors > 0.3) {
          contentCharacteristics.push('error diagnostic strengths');
        }
        
        if (contentModality.structured > 0.3) {
          contentCharacteristics.push('structured data processing');
        }
        
        if (contentLength > 5000) {
          contentCharacteristics.push('handling of larger content');
        }
        
        if (contentCharacteristics.length > 0) {
          reason = `Suggested for ${contentCharacteristics.join(' and ')}`;
        }
        
        confidence = highestScore > 3 ? 'high' : highestScore > 1 ? 'medium' : 'low';
      }
      
      // Prepare result
      const result = {
        suggestedModelId,
        reason,
        rankedSuggestions,
        confidence,
        score: highestScore
      };
      
      // Cache the result
      this.suggestionCache.set(cacheKey, result);
      
      // Record metrics
      metrics.recordResponseTime('suggestModel', Date.now() - startTime);
      metrics.recordHistogram('model_suggestion_score', highestScore);
      
      return result;
    } catch (error) {
      logger.error('Error in model suggestion service:', error);
      metrics.incrementCounter('model_suggestion_errors');
      
      // Provide a fallback suggestion
      const fallbackModelId = availableModelIds[0];
      
      metrics.recordResponseTime('suggestModel', Date.now() - startTime);
      return {
        suggestedModelId: fallbackModelId,
        reason: 'Default suggestion (error in analysis)',
        confidence: 'low',
        error: true
      };
    }
  }
  
  /**
   * Analyze content modality to determine the type of content
   * @param {string} content Content to analyze
   * @returns {Object} Modality scores
   * @private
   */
  _analyzeContentModality(content) {
    if (!content) return { text: 1, code: 0, structured: 0, errors: 0 };
    
    const MULTI_MODAL_WEIGHTS = {
      text: 0.4,
      code: 0.3,
      structured: 0.2,
      errors: 0.1
    };
    
    // Calculate text ratio (non-code, non-structured content)
    const textRatio = this._calculateTextRatio(content);
    
    // Count code blocks
    const codeBlockCount = this._countCodeBlocks(content);
    const codeScore = Math.min(1, codeBlockCount / 3);
    
    // Detect structured data
    const structuredScore = this._detectStructuredData(content);
    
    // Count error keywords
    const errorScore = this._countErrorKeywords(content);
    
    return {
      text: textRatio * MULTI_MODAL_WEIGHTS.text,
      code: codeScore * MULTI_MODAL_WEIGHTS.code,
      structured: structuredScore * MULTI_MODAL_WEIGHTS.structured,
      errors: errorScore * MULTI_MODAL_WEIGHTS.errors
    };
  }
  
  /**
   * Calculate text ratio in content
   * @param {string} content Content to analyze
   * @returns {number} Text ratio score
   * @private
   */
  _calculateTextRatio(content) {
    if (!content) return 1;
    
    // Remove code blocks
    const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
    
    // Remove structured data patterns
    const withoutStructured = withoutCodeBlocks
      .replace(/{[\s\S]*?}/g, '') // JSON-like
      .replace(/\[.*?\]/g, '')     // Array-like
      .replace(/\(.+):(.+)\)/g, '') // Key-value pairs
    
    // Calculate ratio
    return withoutStructured.length / content.length;
  }
  
  /**
   * Count code blocks in content
   * @param {string} content Content to analyze
   * @returns {number} Code score
   * @private
   */
  _countCodeBlocks(content) {
    if (!content) return 0;
    
    // Count markdown code blocks
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
    
    // Check for code-like patterns
    const codePatterns = [
      /\bfunction\b.*?\{/g,
      /\bclass\b.*?\{/g,
      /\bdef\b.*?:/g,
      /\bimport\b.*?from/g,
      /\bif\b.*?\(.*?\)/g,
      /\bfor\b.*?\(.*?\)/g,
      /\btry\b.*?\{.*?\bcatch\b/g
    ];
    
    let patternMatches = 0;
    for (const pattern of codePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        patternMatches += matches.length;
      }
    }
    
    return codeBlockCount + Math.min(2, patternMatches / 5);
  }
  
  /**
   * Detect structured data patterns in content
   * @param {string} content Content to analyze
   * @returns {number} Structured data score
   * @private
   */
  _detectStructuredData(content) {
    if (!content) return 0;
    
    let score = 0;
    
    // Check for JSON-like patterns
    const jsonMatches = content.match(/{[\s\S]*?}/g);
    if (jsonMatches) {
      score += Math.min(1, jsonMatches.length / 3);
    }
    
    // Check for array-like patterns
    const arrayMatches = content.match(/\[[\s\S]*?\]/g);
    if (arrayMatches) {
      score += Math.min(0.5, arrayMatches.length / 5);
    }
    
    // Check for table-like patterns
    const tableMatches = content.match(/\|.*\|.*\|/g);
    if (tableMatches) {
      score += Math.min(0.5, tableMatches.length / 5);
    }
    
    // Check for XML/HTML-like patterns
    const xmlMatches = content.match(/<[^>]+>.*?<\/[^>]+>/g);
    if (xmlMatches) {
      score += Math.min(0.5, xmlMatches.length / 5);
    }
    
    return Math.min(1, score);
  }
  
  /**
   * Count error keywords in content
   * @param {string} content Content to analyze
   * @returns {number} Error keyword score
   * @private
   */
  _countErrorKeywords(content) {
    if (!content) return 0;
    
    const errorKeywords = [
      'error', 'exception', 'failed', 'failure', 'crash',
      'bug', 'issue', 'problem', 'fault', 'defect',
      'traceback', 'stacktrace', 'stack trace', 'fatal'
    ];
    
    let count = 0;
    for (const keyword of errorKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    
    // Check for stack trace patterns
    const stackTracePatterns = [
      /at .+\.js:\d+:\d+/g,  // JavaScript
      /File ".+", line \d+/g,  // Python
      /\(.+:\d+\)/g,          // Various languages
      /\[ERROR\].+/g,          // Log lines
      /Exception in thread.+/g   // Java/JVM
    ];
    
    for (const pattern of stackTracePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return Math.min(1, count / 10);
  }
  
  /**
   * Score models based on content characteristics
   * @param {Array<string>} modelIds Available model IDs
   * @param {string} content Content sample
   * @param {string} logType Log type
   * @param {number} contentLength Content length
   * @param {boolean} includeStackTraces Has stack traces
   * @returns {Object} Scores by model ID
   * @private
   */
  _scoreModelsByContent(modelIds, content, logType, contentLength, includeStackTraces) {
    const scores = {};
    
    // Analyze content characteristics
    const hasCodeSnippets = /```[\s\S]*?```/.test(content) || 
                          /(function|class|def|public|private|protected)/.test(content);
                          
    const hasJsonData = /{[\s\S]*?}/.test(content) && 
                      /("[\\w]+":|'[\\w]+':)/.test(content);
                      
    const hasErrorMessages = /(error|exception|failed|failure)/i.test(content);
    const isLongContent = contentLength > 2000;
    
    // Score each model
    for (const modelId of modelIds) {
      let score = 0;
      
      // Code snippets score
      if (hasCodeSnippets) {
        score += this.contentWeights.codeSnippets * (
          modelId.includes('code') ? 1.2 :
          modelId.includes('gpt-4') ? 1.1 :
          modelId.includes('opus') ? 1.1 :
          1.0
        );
      }
      
      // Error messages score
      if (hasErrorMessages) {
        score += this.contentWeights.errorMessages * (
          modelId.includes('claude') ? 1.1 :
          modelId.includes('gpt-4') ? 1.1 :
          modelId.includes('mixtral') ? 1.05 :
          1.0
        );
      }
      
      // Stack traces score
      if (includeStackTraces) {
        score += this.contentWeights.stackTraces * (
          modelId.includes('code') ? 1.2 :
          modelId.includes('gpt-4') ? 1.1 :
          modelId.includes('mixtral') ? 1.05 :
          1.0
        );
      }
      
      // JSON data score
      if (hasJsonData) {
        score += this.contentWeights.jsonData * (
          modelId.includes('gpt-4') ? 1.1 :
          modelId.includes('claude') ? 1.1 :
          modelId.includes('mixtral') ? 1.05 :
          1.0
        );
      }
      
      // Content length score
      if (isLongContent) {
        const lengthScore = typeof this.contentWeights.contentLength === 'object' 
          ? (this.contentWeights.contentLength[this._getLengthRange(contentLength)] || 1)
          : this.contentWeights.contentLength;
          
        score += lengthScore * (
          modelId.includes('gpt-4') ? 1.2 :
          modelId.includes('claude') ? 1.15 :
          modelId.includes('70b') || modelId.includes('65b') ? 1.1 :
          modelId.includes('mixtral') ? 1.05 :
          1.0
        );
      }
      
      // Log type score
      if (logType === 'error' || logType === 'critical') {
        score += 1.5 * (
          modelId.includes('code') ? 1.2 :
          modelId.includes('gpt-4') ? 1.1 :
          1.0
        );
      } else if (logType === 'info') {
        score += 1.0 * (
          modelId.includes('gpt-3.5') ? 1.1 :
          modelId.includes('mistral') ? 1.1 :
          1.0
        );
      } else if (logType === 'debug') {
        score += 1.2 * (
          modelId.includes('code') ? 1.2 :
          modelId.includes('gpt-4') ? 1.1 :
          1.0
        );
      }
      
      scores[modelId] = score;
    }
    
    return scores;
  }
  
  /**
   * Score models by modality affinity
   * @param {Array<string>} modelIds Model IDs to score
   * @param {Object} modalityScores Content modality scores
   * @returns {Object} Scores by model ID
   * @private
   */
  _scoreModelsByModality(modelIds, modalityScores) {
    const scores = {};
    
    for (const modelId of modelIds) {
      const baseModelId = this._getBaseModelId(modelId);
      const affinities = this.modalityAffinities[baseModelId] || this.modalityAffinities.default;
      
      scores[modelId] = Object.entries(modalityScores).reduce((sum, [modality, value]) => 
        sum + (affinities[modality] || 1.0) * value, 0);
    }
    
    return scores;
  }
  
  /**
   * Get model throughput scores from the registry
   * @returns {Object} Throughput scores by model ID
   * @private
   */
  async _getModelThroughputScores() {
    // Get models from registry
    const models = modelRegistry.getAllModels();
    
    return models.reduce((acc, model) => ({
      ...acc,
      [model.id]: (model.throughput || 30) / (model.avg_response_time || 1)
    }), {});
  }
  
  /**
   * Score models based on system health metrics
   * @param {Array<string>} modelIds Model IDs to score
   * @returns {Object} Health-adjusted scores by model ID
   * @private
   */
  async _scoreModelsWithSystemHealth(modelIds) {
    try {
      const throughputScores = await this._getModelThroughputScores();
      
      // Get additional health metrics from the registry
      const models = modelRegistry.getAllModels();
      const modelMap = models.reduce((acc, model) => {
        acc[model.id] = model;
        return acc;
      }, {});
      
      const scores = {};
      
      for (const modelId of modelIds) {
        const model = modelMap[modelId];
        
        if (!model) {
          scores[modelId] = 1; // Default score if not in registry
          continue;
        }
        
        // Base health score
        let healthScore = model.status === 'healthy' ? 1.0 : 
                         model.status === 'degraded' ? 0.7 : 0.3;
                         
        // Adjust for error rate
        if (model.error_rate) {
          healthScore *= (1 - Math.min(0.9, model.error_rate));
        }
        
        // Adjust for throughput/response time efficiency
        const throughputRatio = throughputScores[modelId] || 1;
        const normalizedThroughput = Math.min(1.5, Math.max(0.5, throughputRatio / 50));
        
        scores[modelId] = healthScore * normalizedThroughput;
      }
      
      return scores;
    } catch (error) {
      logger.warn('Error getting system health scores:', error);
      
      // Return default scores if health check fails
      return modelIds.reduce((acc, modelId) => {
        acc[modelId] = 1;
        return acc;
      }, {});
    }
  }
  
  /**
   * Find historical pattern for similar content
   * @param {Object} params Criteria parameters
   * @returns {Object|null} Historical pattern data or null
   * @private
   */
  async _findHistoricalPattern({
    logType,
    contentLength,
    includeStackTraces,
    userId,
    availableModelIds
  }) {
    try {
      let historicalPattern = null;
      
      // If userId is provided, check for user-specific patterns
      if (userId) {
        const userAnalyses = await db.ModelSuggestion.findAll({
          where: {
            [Op.or]: [
              { logType: logType },
              { contentLengthRange: this._getLengthRange(contentLength) }
            ],
            includeStackTraces: includeStackTraces,
            userId: userId,
            selectedModelId: { [Op.in]: availableModelIds },
            wasSuggestionAccepted: true
          },
          order: [['createdAt', 'DESC']],
          limit: 10
        });
        
        if (userAnalyses && userAnalyses.length > 0) {
          // Count model occurrences
          const modelCounts = {};
          userAnalyses.forEach(analysis => {
            modelCounts[analysis.selectedModelId] = (modelCounts[analysis.selectedModelId] || 0) + 1;
          });
          
          // Find the most frequently used model by this user
          let maxCount = 0;
          let mostFrequentModelId = null;
          
          for (const [modelId, count] of Object.entries(modelCounts)) {
            if (count > maxCount) {
              maxCount = count;
              mostFrequentModelId = modelId;
            }
          }
          
          if (mostFrequentModelId && maxCount >= 2) { // Require at least 2 matches
            historicalPattern = {
              modelId: mostFrequentModelId,
              count: maxCount,
              total: userAnalyses.length,
              source: 'user-history',
              score: Math.min(3, (maxCount / userAnalyses.length) * 4) // Scale: 0-3
            };
          }
        }
      }
      
      // If no user-specific pattern, check global patterns
      if (!historicalPattern) {
        const globalAnalyses = await db.ModelSuggestion.findAll({
          where: {
            [Op.or]: [
              { logType: logType },
              { contentLengthRange: this._getLengthRange(contentLength) }
            ],
            includeStackTraces: includeStackTraces,
            selectedModelId: { [Op.in]: availableModelIds }, // Only available models
            wasSuggestionAccepted: true // Only accepted suggestions
          },
          order: [['createdAt', 'DESC']],
          limit: 20
        });
        
        if (globalAnalyses && globalAnalyses.length > 0) {
          // Count model occurrences
          const modelCounts = {};
          globalAnalyses.forEach(analysis => {
            modelCounts[analysis.selectedModelId] = (modelCounts[analysis.selectedModelId] || 0) + 1;
          });
          
          // Find the most frequently used model for similar content
          let maxCount = 0;
          let mostFrequentModelId = null;
          
          for (const [modelId, count] of Object.entries(modelCounts)) {
            if (count > maxCount) {
              maxCount = count;
              mostFrequentModelId = modelId;
            }
          }
          
          if (mostFrequentModelId && maxCount >= 3) { // Require at least 3 matches for global pattern
            historicalPattern = {
              modelId: mostFrequentModelId,
              count: maxCount,
              total: globalAnalyses.length,
              source: 'global-history',
              score: Math.min(2.5, (maxCount / globalAnalyses.length) * 3) // Scale: 0-2.5
            };
          }
        }
      }
      
      return historicalPattern;
    } catch (dbError) {
      logger.warn('Error querying historical analyses:', dbError);
      return null; // Continue with content-based rules if DB query fails
    }
  }
  
  /**
   * Get user preferences for model selection
   * @param {string} userId User ID
   * @returns {Object} Preference scores by model ID
   * @private
   */
  async _getUserPreferences(userId) {
    // Default empty preferences
    const defaultPreferences = {};
    
    if (!userId) return defaultPreferences;
    
    try {
      // Get user from database
      const user = await db.User.findByPk(userId);
      
      if (!user || !user.preferences || !user.preferences.preferredModels) {
        return defaultPreferences;
      }
      
      // Convert preferences to scores
      // More recently preferred models get higher scores
      const preferredModels = user.preferences.preferredModels;
      const scores = {};
      
      preferredModels.forEach((modelId, index) => {
        // Score from 1.0 to 3.0 based on position (newest = highest)
        const score = 3.0 - (index * (2.0 / Math.max(preferredModels.length - 1, 1)));
        scores[modelId] = score;
      });
      
      return scores;
    } catch (error) {
      logger.warn('Error getting user preferences:', error);
      return defaultPreferences;
    }
  }
  
  /**
   * Generate a cache key based on suggestion input parameters
   * @param {Object} params Input parameters
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(params) {
    // Create a simplified representation of params for the cache key
    const key = {
      c: params.contentSample ? params.contentSample.substring(0, 50) : '',
      t: params.logType || 'unknown',
      l: params.contentLength || 0,
      s: params.includeStackTraces || false,
      m: params.availableModelIds ? params.availableModelIds.slice(0, 5).join(',') : '',
      u: params.userId ? params.userId.substring(0, 8) : ''
    };
    
    return JSON.stringify(key);
  }
  
  /**
   * Records feedback about model selection for learning
   * Enhanced with more detailed tracking and improved user preference learning
   * 
   * @param {Object} params Feedback parameters
   * @param {string} params.suggestedModelId The model that was suggested
   * @param {string} params.selectedModelId The model that was actually selected
   * @param {number} params.contentLength Content length
   * @param {string} params.logType Type of log
   * @param {boolean} params.includeStackTraces Whether content had stack traces
   * @param {boolean} params.wasSuggestionAccepted Whether suggestion was accepted
   * @param {string} [params.userId] Optional user ID
   * @returns {Promise<boolean>} Success indicator
   */
  async recordSelectionFeedback({
    suggestedModelId,
    selectedModelId,
    contentLength,
    logType,
    includeStackTraces,
    wasSuggestionAccepted,
    userId
  }) {
    try {
      // Start performance measurement
      const startTime = Date.now();
      metrics.incrementCounter('suggestion_feedback_records');
      
      const lengthRange = this._getLengthRange(contentLength);
      
      // Create new suggestion record with more detailed tracking
      await db.ModelSuggestion.create({
        timestamp: new Date(),
        suggestedModelId,
        selectedModelId,
        wasSuggestionAccepted,
        logType,
        contentLengthRange: lengthRange,
        includeStackTraces,
        userId: userId || null,
        sessionId: null, // Could be added for session tracking
        selectionLatencyMs: 0, // Could track how long user took to decide
        source: 'user-interface', // Track feedback source
      });
      
      // If the user has preferences, update them with weighted learning
      if (userId) {
        try {
          const user = await db.User.findByPk(userId);
          
          if (user) {
            // Get existing preferences
            const preferences = user.preferences || {};
            let preferredModels = preferences.preferredModels || [];
            
            // If user selected a model (accepted or rejected suggestion)
            if (selectedModelId) {
              // Remove the selected model if it's already in the list
              preferredModels = preferredModels.filter(id => id !== selectedModelId);
              
              // Add to the beginning (most recent preference)
              preferredModels.unshift(selectedModelId);
              
              // Keep only the last 10 preferred models
              if (preferredModels.length > 10) {
                preferredModels = preferredModels.slice(0, 10);
              }
              
              // Update user preferences
              preferences.preferredModels = preferredModels;
              
              // Track suggestion acceptance rate
              if (!preferences.suggestionStats) {
                preferences.suggestionStats = {
                  suggested: 0,
                  accepted: 0
                };
              }
              
              preferences.suggestionStats.suggested++;
              if (wasSuggestionAccepted) {
                preferences.suggestionStats.accepted++;
              }
              
              // Also store type-specific model preferences
              if (!preferences.typePreferences) {
                preferences.typePreferences = {};
              }
              
              if (!preferences.typePreferences[logType]) {
                preferences.typePreferences[logType] = [];
              }
              
              // Remove model from type preferences if already there
              preferences.typePreferences[logType] = 
                preferences.typePreferences[logType].filter(id => id !== selectedModelId);
              
              // Add to beginning of type-specific preferences
              preferences.typePreferences[logType].unshift(selectedModelId);
              
              // Keep only top 5 for each type
              if (preferences.typePreferences[logType].length > 5) {
                preferences.typePreferences[logType] = 
                  preferences.typePreferences[logType].slice(0, 5);
              }
              
              // Update user with new preferences
              await user.update({
                preferences: preferences
              });
              
              logger.debug(`Updated preferences for user ${userId}`);
            }
          }
        } catch (prefError) {
          logger.warn('Error updating user preferences:', prefError);
          metrics.incrementCounter('suggestion_feedback_preference_errors');
        }
      }
      
      // Record performance metrics
      metrics.recordResponseTime('recordSelectionFeedback', Date.now() - startTime);
      
      // Additional metric tracking
      if (wasSuggestionAccepted) {
        metrics.incrementCounter('suggestion_acceptance', { modelId: suggestedModelId });
      } else {
        metrics.incrementCounter('suggestion_rejection', { 
          suggested: suggestedModelId,
          selected: selectedModelId 
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Error recording selection feedback:', error);
      metrics.incrementCounter('suggestion_feedback_errors');
      return false;
    }
  }
  
  /**
   * Converts raw content length to a range category
   * 
   * @param {number} length Content length in characters
   * @returns {string} Length range category
   * @private
   */
  _getLengthRange(length) {
    if (length < 500) return 'xs';
    if (length < 2000) return 's';
    if (length < 5000) return 'm';
    if (length < 10000) return 'l';
    return 'xl';
  }
}

module.exports = new ModelSuggestionService();