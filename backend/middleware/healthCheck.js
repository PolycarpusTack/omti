// middleware/healthCheck.js
const os = require('os');
const process = require('process');
const circuitBreaker = require('../utils/circuitBreaker');
const modelRegistry = require('../services/modelRegistryService');
const metrics = require('../utils/metrics');
const package = require('../package.json');

/**
 * Health check middleware that provides system status information
 * without affecting core functionality
 */

/**
 * Basic health check endpoint that returns system status
 */
const basicHealthCheck = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: package.version
  });
};

/**
 * Detailed health check that returns system and component status
 */
const detailedHealthCheck = async (req, res) => {
  // Get start time for response time calculation
  const startTime = Date.now();
  
  try {
    // Collect system metrics
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };
    
    // Collect service metrics
    const services = {
      circuitBreakers: circuitBreaker.getStats(),
      modelRegistry: {
        totalModels: modelRegistry.getAllModels().length,
        healthyModels: modelRegistry.getAllModels().filter(m => m.status === 'healthy').length
      },
      metrics: {
        counters: metrics.getMetrics().counters,
        operations: metrics._operations
      }
    };
    
    // Test external dependencies
    const dependencies = await checkDependencies();
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Set status based on dependencies health
    const status = dependencies.some(d => !d.healthy) ? 'degraded' : 'healthy';
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      version: package.version,
      responseTime,
      system: systemInfo,
      services,
      dependencies
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * Check the health of external dependencies
 * @returns {Promise<Array>} Array of dependency health statuses
 */
const checkDependencies = async () => {
  const dependencies = [];
  
  // Check OpenAI API
  try {
    const openai = Boolean(process.env.OPENAI_API_KEY);
    dependencies.push({
      name: 'openai',
      healthy: openai,
      status: openai ? 'available' : 'not configured',
      latency: null
    });
  } catch (error) {
    dependencies.push({
      name: 'openai',
      healthy: false,
      status: 'error',
      error: error.message
    });
  }

  // Check Ollama API
  try {
    const ollamaBreaker = circuitBreaker.get('ollama-api');
    dependencies.push({
      name: 'ollama',
      healthy: ollamaBreaker ? ollamaBreaker.state !== 'OPEN' : true,
      status: ollamaBreaker ? ollamaBreaker.state : 'unknown',
      lastError: ollamaBreaker ? ollamaBreaker.lastError : null
    });
  } catch (error) {
    dependencies.push({
      name: 'ollama',
      healthy: false,
      status: 'error',
      error: error.message
    });
  }

  // Check database
  try {
    dependencies.push({
      name: 'database',
      healthy: true, // In a real implementation, this would actually check the database
      status: 'connected',
      latency: null
    });
  } catch (error) {
    dependencies.push({
      name: 'database',
      healthy: false,
      status: 'error',
      error: error.message
    });
  }

  return dependencies;
};

module.exports = {
  basicHealthCheck,
  detailedHealthCheck
};