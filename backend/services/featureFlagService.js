// services/featureFlagsService.js
const logger = require('../utils/logger');

/**
 * Feature Flags Service provides dynamic control over feature availability
 * without changing core functionality
 * 
 * This enables:
 * - Gradual rollout of new features
 * - A/B testing
 * - Canary releases
 * - Emergency shutoff for problematic features
 */
class FeatureFlags {
  constructor() {
    // Load default configuration
    this.flags = {
      // LLMController features
      'model-fallback': { enabled: true, percentage: 100 },
      'response-streaming': { enabled: false, percentage: 0 },
      'model-benchmarking': { enabled: true, percentage: 100 },
      
      // ModelSuggestionService features
      'suggestion-retraining': { enabled: true, percentage: 100 },
      'multi-modal-analysis': { enabled: true, percentage: 100 },
      'user-personalization': { enabled: true, percentage: 100 },
      
      // Infrastructure features
      'circuit-breaker': { enabled: true, percentage: 100 },
      'rate-limiting': { enabled: true, percentage: 100 },
      'enhanced-telemetry': { enabled: true, percentage: 100 },
      
      // Placeholder for new features
      'contextual-awareness': { enabled: false, percentage: 0 },
      'a-b-testing': { enabled: false, percentage: 0 }
    };
    
    // Track feature usage
    this.usageCounts = new Map();
    
    // Initialize feature overrides
    this._loadOverrides();
    
    // Log initialization
    logger.info('Feature flags service initialized', { 
      enabledCount: Object.values(this.flags).filter(f => f.enabled).length,
      totalCount: Object.keys(this.flags).length
    });
  }
  
  /**
   * Check if a feature is enabled
   * @param {string} featureName Name of the feature
   * @param {Object} context Context for the feature check (user, request info, etc.)
   * @returns {boolean} Whether the feature is enabled
   */
  isEnabled(featureName, context = {}) {
    // Record usage of this check
    this._recordUsage(featureName);
    
    // Check if feature exists
    if (!this.flags[featureName]) {
      logger.warn(`Unknown feature flag checked: ${featureName}`);
      return false;
    }
    
    const feature = this.flags[featureName];
    
    // If feature is completely disabled, return false early
    if (!feature.enabled) {
      return false;
    }
    
    // If feature is 100% enabled, return true early
    if (feature.percentage === 100) {
      return true;
    }
    
    // Evaluate percentage rollout
    if (feature.percentage > 0) {
      // Get user ID or other stable identifier for consistent experience
      const identifier = context.userId || 
                         context.sessionId || 
                         context.ipAddress ||
                         'anonymous';
      
      // Deterministic randomization based on feature name and user ID
      const hash = this._hashString(`${featureName}:${identifier}`);
      const percentage = hash % 100;
      
      return percentage < feature.percentage;
    }
    
    return false;
  }
  
  /**
   * Enable a feature
   * @param {string} featureName Name of the feature
   * @param {number} [percentage=100] Percentage of traffic to enable
   * @returns {boolean} Whether the feature was enabled
   */
  enableFeature(featureName, percentage = 100) {
    if (!this.flags[featureName]) {
      // Create feature if it doesn't exist
      this.flags[featureName] = { enabled: true, percentage };
      logger.info(`Created and enabled new feature: ${featureName} (${percentage}%)`);
      return true;
    }
    
    this.flags[featureName].enabled = true;
    this.flags[featureName].percentage = percentage;
    
    logger.info(`Enabled feature: ${featureName} (${percentage}%)`);
    this._saveOverrides();
    return true;
  }
  
  /**
   * Disable a feature
   * @param {string} featureName Name of the feature
   * @returns {boolean} Whether the feature was disabled
   */
  disableFeature(featureName) {
    if (!this.flags[featureName]) {
      return false;
    }
    
    this.flags[featureName].enabled = false;
    this.flags[featureName].percentage = 0;
    
    logger.info(`Disabled feature: ${featureName}`);
    this._saveOverrides();
    return true;
  }
  
  /**
   * Get all feature flags and their status
   * @returns {Object} All feature flags
   */
  getAllFeatures() {
    // Add usage data to each feature
    return Object.entries(this.flags).reduce((result, [name, config]) => {
      result[name] = {
        ...config,
        usage: this.usageCounts.get(name) || 0
      };
      return result;
    }, {});
  }
  
  /**
   * Record feature flag check
   * @param {string} featureName Name of the feature
   * @private
   */
  _recordUsage(featureName) {
    const currentCount = this.usageCounts.get(featureName) || 0;
    this.usageCounts.set(featureName, currentCount + 1);
  }
  
  /**
   * Load feature flag overrides from environment or database
   * @private
   */
  _loadOverrides() {
    try {
      // First check environment variables for overrides
      // Format: FEATURE_FLAG_[NAME]=[true/false]:[percentage]
      const envVars = process.env;
      
      for (const key of Object.keys(envVars)) {
        if (key.startsWith('FEATURE_FLAG_')) {
          const featureName = key.replace('FEATURE_FLAG_', '').toLowerCase().replace(/_/g, '-');
          const value = envVars[key];
          
          if (value.includes(':')) {
            const [enabled, percentage] = value.split(':');
            
            this.flags[featureName] = {
              enabled: enabled.toLowerCase() === 'true',
              percentage: parseInt(percentage, 10) || 0
            };
          } else {
            // Simple boolean flag
            this.flags[featureName] = {
              enabled: value.toLowerCase() === 'true',
              percentage: value.toLowerCase() === 'true' ? 100 : 0
            };
          }
          
          logger.debug(`Loaded feature flag override from environment: ${featureName}`);
        }
      }
      
      // In a real implementation, you would also load overrides from a database or external service
      // This example keeps it simple with just environment variables
    } catch (error) {
      logger.error('Error loading feature flag overrides:', error);
    }
  }
  
  /**
   * Save feature flag overrides
   * @private
   */
  _saveOverrides() {
    // In a real implementation, this would save overrides to a database or external service
    // For this example, we just log that it would happen
    logger.debug('Feature flag overrides would be saved to persistent storage');
  }
  
  /**
   * Simple string hash function for deterministic percentage rollouts
   * @param {string} str String to hash
   * @returns {number} Hash value (0-99)
   * @private
   */
  _hashString(str) {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Ensure positive number and limit to 0-99 range
    return Math.abs(hash) % 100;
  }
}

// Export singleton instance
module.exports = new FeatureFlags();