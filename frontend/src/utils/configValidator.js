// src/utils/configValidator.js
import Joi from 'joi';

/**
 * Schema for validating ApiClient configuration
 */
const configSchema = Joi.object({
  baseURL: Joi.string().uri().required()
    .description('Base URL for API requests'),
  
  timeout: Joi.number().integer().min(100).max(60000).required()
    .description('Request timeout in milliseconds'),
  
  retries: Joi.number().integer().min(0).max(10).default(3)
    .description('Number of retry attempts for failed requests'),
  
  retryDelay: Joi.number().integer().min(100).max(10000).default(1000)
    .description('Base delay between retries in milliseconds'),
  
  getAuthToken: Joi.function().required()
    .description('Function that returns the authentication token'),
  
  refreshToken: Joi.function().allow(null)
    .description('Function to refresh expired auth tokens'),
  
  enableCache: Joi.boolean().default(false)
    .description('Enable response caching for offline support'),
  
  cacheTTL: Joi.number().integer().min(1000).max(86400000).default(900000)
    .description('Cache time-to-live in milliseconds'),
  
  enableCircuitBreaker: Joi.boolean().default(false)
    .description('Enable circuit breaker for failing services'),
  
  maxConcurrent: Joi.number().integer().min(1).max(20).default(5)
    .description('Maximum concurrent requests'),
  
  requestRateLimit: Joi.number().integer().min(0).max(5000).default(100)
    .description('Minimum time between requests in milliseconds'),
  
  headers: Joi.object().pattern(
    Joi.string(),
    Joi.string().allow('').allow(null)
  ).default({})
    .description('Default headers to include with every request')
});

/**
 * Validates API client configuration against schema
 * @param {Object} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  const { error, value } = configSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const details = error.details.map(detail => detail.message).join('; ');
    throw new Error(`Invalid API client configuration: ${details}`);
  }
  
  return value; // Return validated and normalized config
}

/**
 * Creates a partial configuration validator for specific keys
 * @param {Array<string>} keys - Configuration keys to validate
 * @returns {Function} Validator function for partial config
 */
export function createPartialValidator(keys) {
  const partialSchema = Joi.object(
    keys.reduce((acc, key) => {
      if (configSchema.describe().keys[key]) {
        acc[key] = configSchema.extract(key);
      }
      return acc;
    }, {})
  );
  
  return function validatePartialConfig(config) {
    const { error, value } = partialSchema.validate(config, {
      abortEarly: false
    });
    
    if (error) {
      const details = error.details.map(detail => detail.message).join('; ');
      throw new Error(`Invalid configuration: ${details}`);
    }
    
    return value;
  };
}