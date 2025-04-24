// src/services/analysisService.js
import { ApiClient } from '../utils/apiClient';
import { validateAnalysisRequest } from '../validators/analysisValidator';
import { ApplicationError, ValidationError } from '../errors';

/**
 * @typedef {Object} AnalysisResult
 * @property {string} id - Unique analysis ID
 * @property {string} status - Analysis status (e.g., 'completed', 'failed')
 * @property {Object} insights - Generated insights from analysis
 * @property {Date} createdAt - Analysis creation timestamp
 */

/**
 * @typedef {Object} AnalysisRequest
 * @property {string} content - Content to analyze (1-5000 characters)
 * @property {string} modelId - UUID of model to use
 * @property {Object} [modelSettings] - Optional model-specific parameters
 */

const ANALYSIS_ENDPOINTS = {
  MODELS: '/api/v1/models',
  ANALYZE: '/api/v1/analyze',
};

// Environment-driven configuration
const CACHE_TTL_MS = parseInt(process.env.REACT_APP_MODELS_CACHE_TTL_MS, 10) || 60 * 1000; // 1 minute cache default
const ANALYZE_TIMEOUT_MS = parseInt(process.env.REACT_APP_ANALYSIS_TIMEOUT_MS, 10) || 10000; // 10s default

let modelsCache = null;
let lastFetchTime = 0;
let lastModelVersion = null;

/**
 * Fetches available analysis models with caching
 * 
 * @param {Object} [options] - Optional parameters
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and force fresh fetch
 * @param {Object} [options.filters={}] - Optional filters to apply (e.g. provider, type)
 * @returns {Promise<Array<Model>>} Promise resolving to available models
 * @throws {ApplicationError} On API failure
 */
export async function getAvailableModels(options = {}) {
  const { forceRefresh = false, filters = {} } = options;
  const now = Date.now();
  
  // Return cache if still valid and not forcing refresh
  if (!forceRefresh && 
      modelsCache && 
      (now - lastFetchTime) < CACHE_TTL_MS) {
    return modelsCache;
  }

  try {
    // Build query params from filters
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const endpoint = `${ANALYSIS_ENDPOINTS.MODELS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await ApiClient.get(endpoint);
    
    // Check for version change to invalidate cache even before TTL expires
    const modelVersion = response.data.version || response.headers['etag'];
    if (modelVersion && modelVersion !== lastModelVersion) {
      lastModelVersion = modelVersion;
    }
    
    modelsCache = response.data.models?.map(model => ({
      id: model.id,
      name: model.name,
      version: model.version,
      supportedFeatures: model.capabilities,
      requiredSettings: model.configSchema,
      defaultSettings: model.defaultConfig || {},
    })) || [];
    
    lastFetchTime = now;
    return modelsCache;
  } catch (error) {
    throw new ApplicationError(
      'Failed to fetch available models',
      {
        originalError: error,
        context: { 
          endpoint: ANALYSIS_ENDPOINTS.MODELS,
          filters 
        }
      }
    );
  }
}

/**
 * Finds a model by ID in the cache or fetches it if needed
 * 
 * @param {string} modelId - UUID of the model to find
 * @returns {Promise<Object|null>} The model object or null if not found
 */
export async function getModelById(modelId) {
  try {
    const models = await getAvailableModels();
    return models.find(model => model.id === modelId) || null;
  } catch (error) {
    console.error('Error fetching model:', error);
    return null;
  }
}

/**
 * Submit content for analysis with validation and error handling
 * 
 * @param {AnalysisRequest} request - Analysis request parameters
 * @returns {Promise<AnalysisResult>} Analysis results
 * @throws {ValidationError} On invalid input
 * @throws {ApplicationError} On API failure
 */
export async function analyzeContent(request) {
  const validationError = validateAnalysisRequest(request);
  if (validationError) {
    throw new ValidationError('Invalid analysis request', {
      validationErrors: validationError.details
    });
  }

  try {
    // Try to get default settings for the selected model
    let modelDefaults = {};
    try {
      const model = await getModelById(request.modelId);
      modelDefaults = model?.defaultSettings || {};
    } catch (e) {
      // If we can't get defaults, proceed without them
      console.warn('Could not fetch model defaults:', e);
    }

    // Merge user settings with defaults (user settings take precedence)
    const modelSettings = {
      ...modelDefaults,
      ...(request.modelSettings || {})
    };
    
    const payload = {
      content: request.content,
      model_id: request.modelId,
      model_settings: modelSettings,
    };
    
    const response = await ApiClient.post(
      ANALYSIS_ENDPOINTS.ANALYZE, 
      payload,
      { timeout: ANALYZE_TIMEOUT_MS }
    );

    return {
      id: response.data.analysisId,
      status: response.data.status,
      insights: response.data.results,
      createdAt: new Date(response.data.created_at),
    };
  } catch (error) {
    // Log the full error with stack trace to monitoring system
    // This would typically call your logging/monitoring service
    logErrorToMonitoring(error);
    
    throw new ApplicationError(
      'Analysis request failed',
      {
        originalError: error,
        context: { 
          modelId: request.modelId,
          contentLength: request.content?.length
        }
      }
    );
  }
}

/**
 * Invalidates the models cache, forcing a fresh fetch on next request
 */
export function invalidateModelsCache() {
  modelsCache = null;
  lastFetchTime = 0;
}

/**
 * Helper function to log errors to your monitoring system
 * Replace with actual implementation (Sentry, Datadog, etc.)
 *
 * @param {Error} error - The error to log
 */
function logErrorToMonitoring(error) {
  // Example implementation - replace with actual monitoring code
  console.error('[Monitoring]', error);
  
  // If using Sentry, would be something like:
  // Sentry.captureException(error);
}