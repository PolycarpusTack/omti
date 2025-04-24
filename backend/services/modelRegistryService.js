// services/modelRegistryService.js
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

/**
 * Model Registry Service provides centralized management of available models
 * with health tracking and intelligent routing capabilities.
 */
class ModelRegistry {
  constructor() {
    this._models = new Map();
    this._healthCheckers = new Map();
    this._benchmarks = new Map();
    this._lastRoutingDecision = new Map();
  }
  
  /**
   * Register a model with the registry
   * @param {Object} modelInfo Model information
   * @param {string} modelInfo.id Unique model identifier
   * @param {string} modelInfo.provider Provider name (e.g., 'openai', 'ollama')
   * @param {string} [modelInfo.endpoint] API endpoint for the model
   * @param {string} [modelInfo.status='unknown'] Initial health status
   * @returns {string} The registered model ID
   */
  registerModel(modelInfo) {
    if (!modelInfo.id) {
      throw new Error('Model ID is required');
    }
    
    // Check if model is already registered
    if (this._models.has(modelInfo.id)) {
      // Update existing model information
      const existingModel = this._models.get(modelInfo.id);
      this._models.set(modelInfo.id, {
        ...existingModel,
        ...modelInfo,
        lastUpdated: new Date()
      });
      
      logger.debug(`Updated model in registry: ${modelInfo.id}`);
      return modelInfo.id;
    }
    
    // Register new model
    const model = {
      id: modelInfo.id,
      provider: modelInfo.provider || 'unknown',
      endpoint: modelInfo.endpoint || null,
      status: modelInfo.status || 'unknown',
      health: modelInfo.status || 'unknown',
      throughput: 0,
      avg_response_time: 0,
      error_rate: 0,
      lastError: null,
      lastUpdated: new Date(),
      registeredAt: new Date()
    };
    
    this._models.set(modelInfo.id, model);
    logger.info(`Registered model: ${model.id} (${model.provider})`);
    
    // Start health checking if enabled
    this._setupHealthCheck(model.id);
    
    metrics.incrementCounter('model_registry_operations', { operation: 'register' });
    return model.id;
  }
  
  /**
   * Get a model by ID
   * @param {string} modelId Model ID
   * @returns {Object|null} Model information or null if not found
   */
  getModel(modelId) {
    return this._models.get(modelId) || null;
  }
  
  /**
   * Get all registered models
   * @returns {Array<Object>} Array of model information
   */
  getAllModels() {
    return Array.from(this._models.values());
  }
  
  /**
   * Update model health metrics
   * @param {string} modelId Model ID
   * @param {Object} health Health metrics
   */
  updateModelHealth(modelId, health) {
    const model = this._models.get(modelId);
    if (!model) {
      logger.warn(`Attempted to update health for unknown model: ${modelId}`);
      return;
    }
    
    // Update model health information
    this._models.set(modelId, {
      ...model,
      ...health,
      lastUpdated: new Date()
    });
    
    // Record metrics
    if (health.status) {
      metrics.setGauge('model_health_status', health.status === 'healthy' ? 1 : 0, { modelId });
    }
    
    if (health.error_rate !== undefined) {
      metrics.setGauge('model_error_rate', health.error_rate, { modelId });
    }
    
    if (health.avg_response_time !== undefined) {
      metrics.setGauge('model_avg_response_time', health.avg_response_time, { modelId });
    }
    
    if (health.throughput !== undefined) {
      metrics.setGauge('model_throughput', health.throughput, { modelId });
    }
  }
  
  /**
   * Update model benchmark results
   * @param {string} modelId Model ID
   * @param {Object} benchmark Benchmark results
   */
  updateModelBenchmark(modelId, benchmark) {
    if (!this._models.has(modelId)) {
      logger.warn(`Attempted to update benchmark for unknown model: ${modelId}`);
      return;
    }
    
    this._benchmarks.set(modelId, {
      ...benchmark,
      timestamp: new Date()
    });
    
    // Record metrics from benchmark
    if (benchmark.inferenceTime) {
      metrics.setGauge('model_inference_time', parseFloat(benchmark.inferenceTime), { modelId });
    }
    
    if (benchmark.tokensPerSecond) {
      metrics.setGauge('model_tokens_per_second', benchmark.tokensPerSecond, { modelId });
    }
  }
  
  /**
   * Get the best model for a specific request based on requirements
   * @param {Object} requirements Request requirements
   * @param {string} [requirements.provider] Preferred provider
   * @param {Array<string>} [requirements.modelIds] Acceptable model IDs
   * @param {boolean} [requirements.preferFastest=false] Prefer fastest model
   * @param {boolean} [requirements.preferMostAccurate=false] Prefer most accurate model
   * @param {number} [requirements.minThroughput] Minimum throughput required
   * @param {number} [requirements.maxResponseTime] Maximum acceptable response time
   * @param {number} [requirements.maxErrorRate] Maximum acceptable error rate
   * @returns {string|null} Best matching model ID or null if none found
   */
  getBestModelForRequest(requirements = {}) {
    // Filter models by requirements
    let eligibleModels = Array.from(this._models.values()).filter(model => {
      // Filter by health status
      if (model.status !== 'healthy' && model.status !== 'degraded') {
        return false;
      }
      
      // Filter by provider if specified
      if (requirements.provider && model.provider !== requirements.provider) {
        return false;
      }
      
      // Filter by allowed model IDs if specified
      if (requirements.modelIds && requirements.modelIds.length > 0) {
        if (!requirements.modelIds.includes(model.id)) {
          return false;
        }
      }
      
      // Filter by minimum throughput if specified
      if (requirements.minThroughput && model.throughput < requirements.minThroughput) {
        return false;
      }
      
      // Filter by maximum response time if specified
      if (requirements.maxResponseTime && model.avg_response_time > requirements.maxResponseTime) {
        return false;
      }
      
      // Filter by maximum error rate if specified
      if (requirements.maxErrorRate && model.error_rate > requirements.maxErrorRate) {
        return false;
      }
      
      return true;
    });
    
    // Return early if no eligible models
    if (eligibleModels.length === 0) {
      logger.warn('No eligible models found for request requirements');
      return null;
    }
    
    // Return early if only one eligible model
    if (eligibleModels.length === 1) {
      return eligibleModels[0].id;
    }
    
    // Sort by requirements
    if (requirements.preferFastest) {
      // Sort by response time (ascending)
      eligibleModels.sort((a, b) => a.avg_response_time - b.avg_response_time);
    } else if (requirements.preferMostAccurate) {
      // For accuracy, we'll use a synthetic score based on model size and error rate
      // Lower error rates and larger models (implied by name) are prioritized
      eligibleModels.sort((a, b) => {
        const aScore = (1 - a.error_rate) * this._getModelSizeScore(a.id);
        const bScore = (1 - b.error_rate) * this._getModelSizeScore(b.id);
        return bScore - aScore; // Descending order
      });
    } else {
      // Use a balanced score that considers throughput, response time, and error rate
      eligibleModels.sort((a, b) => {
        const aScore = (a.throughput / (a.avg_response_time + 0.1)) * (1 - a.error_rate);
        const bScore = (b.throughput / (b.avg_response_time + 0.1)) * (1 - b.error_rate);
        return bScore - aScore; // Descending order
      });
    }
    
    // Get the best model
    const selectedModel = eligibleModels[0];
    
    // Record the routing decision
    this._lastRoutingDecision.set(selectedModel.id, {
      timestamp: new Date(),
      requirements,
      eligibleCount: eligibleModels.length
    });
    
    logger.debug(`Selected model ${selectedModel.id} from ${eligibleModels.length} eligible models`);
    return selectedModel.id;
  }
  
  /**
   * Set up periodic health checks for a model
   * @param {string} modelId Model ID
   * @private
   */
  _setupHealthCheck(modelId) {
    // In a real implementation, this would set up periodic health checks
    // For now, we'll just log that it would do so
    logger.debug(`Would set up health checks for model ${modelId}`);
  }
  
  /**
   * Get a score representing the relative size/capability of a model
   * based on its ID/name
   * @param {string} modelId Model ID/name
   * @returns {number} Size score (higher is larger/more capable)
   * @private
   */
  _getModelSizeScore(modelId) {
    const id = modelId.toLowerCase();
    
    // Look for size indicators in the name
    if (id.includes('70b') || id.includes('65b')) return 7.0;
    if (id.includes('34b') || id.includes('35b')) return 3.5;
    if (id.includes('13b') || id.includes('14b')) return 1.3;
    if (id.includes('7b') || id.includes('8b')) return 0.7;
    
    // Special cases for known models
    if (id.includes('gpt-4')) return 8.0;
    if (id.includes('gpt-3.5')) return 3.5;
    if (id.includes('claude-3')) return 7.5;
    if (id.includes('claude-2')) return 6.0;
    if (id.includes('mixtral')) return 4.5;
    
    // Default score if unknown
    return 1.0;
  }
}

// Export a singleton instance
module.exports = new ModelRegistry();