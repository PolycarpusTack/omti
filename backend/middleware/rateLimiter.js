// middleware/rateLimiter.js
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

/**
 * Simple in-memory rate limiter to prevent API abuse
 * This adds protection without changing core functionality
 */
class RateLimiter {
  constructor() {
    this.requestCounts = new Map();
    this.blockList = new Map();
    
    // Clean up old entries periodically
    setInterval(() => this._cleanup(), 60000); // Every minute
  }
  
  /**
   * Generate a key for rate limiting
   * @param {Object} req Express request
   * @param {string} type Type of limit (e.g., 'global', 'model', 'user')
   * @returns {string} Rate limiting key
   * @private
   */
  _getKey(req, type) {
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id || 'anonymous';
    
    switch (type) {
      case 'user':
        return `user:${userId}`;
      case 'ip':
        return `ip:${ip}`;
      case 'model':
        const modelId = req.body?.modelId || req.params?.modelId || 'unknown';
        return `model:${modelId}:${userId}`;
      case 'endpoint':
        return `endpoint:${req.method}:${req.path}:${userId}`;
      default:
        return `global:${userId}`;
    }
  }
  
  /**
   * Check if a request should be rate limited
   * @param {Object} req Express request
   * @param {Object} limits Rate limits configuration
   * @returns {Object} Limit status
   */
  check(req, limits = {}) {
    const now = Date.now();
    const results = {};
    
    // Apply each type of limit
    for (const [type, limit] of Object.entries(limits)) {
      const key = this._getKey(req, type);
      
      // Check if already in block list
      if (this.blockList.has(key)) {
        const blockData = this.blockList.get(key);
        if (now < blockData.expires) {
          // Still blocked
          results[type] = {
            limited: true,
            remaining: 0,
            resetAt: new Date(blockData.expires),
            blocked: true
          };
          continue;
        } else {
          // Block expired, remove from list
          this.blockList.delete(key);
        }
      }
      
      // Get current request count data
      let countData = this.requestCounts.get(key);
      
      // Initialize if not exists
      if (!countData) {
        countData = {
          count: 0,
          window: now,
          burstCount: 0,
          burstWindow: now
        };
        this.requestCounts.set(key, countData);
      }
      
      // Reset window if needed
      if (now - countData.window > limit.windowMs) {
        countData.count = 0;
        countData.window = now;
      }
      
      // Reset burst window if needed
      if (now - countData.burstWindow > limit.burstWindowMs) {
        countData.burstCount = 0;
        countData.burstWindow = now;
      }
      
      // Update counts
      countData.count++;
      countData.burstCount++;
      
      // Check if limits exceeded
      const windowLimitExceeded = countData.count > limit.max;
      const burstLimitExceeded = limit.burstMax && countData.burstCount > limit.burstMax;
      
      if (windowLimitExceeded || burstLimitExceeded) {
        // Rate limit exceeded - add to block list if configured
        if (limit.blockMs > 0) {
          this.blockList.set(key, {
            expires: now + limit.blockMs,
            reason: windowLimitExceeded ? 'window' : 'burst'
          });
          
          metrics.incrementCounter('rate_limit_blocks', { type });
          logger.warn(`Rate limit block added for ${key}`, {
            type,
            reason: windowLimitExceeded ? 'window' : 'burst',
            expires: new Date(now + limit.blockMs)
          });
        }
        
        results[type] = {
          limited: true,
          remaining: 0,
          resetAt: new Date(countData.window + limit.windowMs),
          blocked: limit.blockMs > 0
        };
        
        metrics.incrementCounter('rate_limit_exceeded', { type });
      } else {
        results[type] = {
          limited: false,
          remaining: limit.max - countData.count,
          resetAt: new Date(countData.window + limit.windowMs)
        };
      }
    }
    
    // Check if any limits were exceeded
    const isLimited = Object.values(results).some(r => r.limited);
    
    return {
      isLimited,
      details: results
    };
  }
  
  /**
   * Clean up old entries to prevent memory leaks
   * @private
   */
  _cleanup() {
    const now = Date.now();
    
    // Clean up request counts (anything older than 1 hour)
    for (const [key, data] of this.requestCounts.entries()) {
      if (now - data.window > 3600000) {
        this.requestCounts.delete(key);
      }
    }
    
    // Clean up expired blocks
    for (const [key, data] of this.blockList.entries()) {
      if (now > data.expires) {
        this.blockList.delete(key);
      }
    }
  }
  
  /**
   * Get statistics about rate limiting
   * @returns {Object} Rate limiting stats
   */
  getStats() {
    return {
      activeLimits: this.requestCounts.size,
      activeBlocks: this.blockList.size,
      blockList: Array.from(this.blockList.entries()).map(([key, data]) => ({
        key,
        expires: new Date(data.expires),
        reason: data.reason
      }))
    };
  }
}

// Create singleton instance
const limiter = new RateLimiter();

/**
 * Express middleware for rate limiting
 * @param {Object} limits Rate limits configuration
 */
const createRateLimiter = (limits = {}) => {
  // Set default limits if not provided
  const defaultLimits = {
    global: {
      windowMs: 60000, // 1 minute
      max: 100, // 100 requests per minute globally
      burstWindowMs: 1000, // 1 second
      burstMax: 20, // 20 requests per second burst
      blockMs: 0 // Don't block by default
    }
  };
  
  const finalLimits = { ...defaultLimits, ...limits };
  
  // Return middleware function
  return (req, res, next) => {
    // Skip health checks and options requests
    if (req.path === '/health' || req.method === 'OPTIONS') {
      return next();
    }
    
    // Check rate limits
    const result = limiter.check(req, finalLimits);
    
    // Add headers
    res.set('X-RateLimit-Limit', Object.keys(finalLimits).map(type => 
      `${type}=${finalLimits[type].max}`).join(';'));
    
    if (result.details.global) {
      res.set('X-RateLimit-Remaining', result.details.global.remaining);
      res.set('X-RateLimit-Reset', Math.floor(result.details.global.resetAt.getTime() / 1000));
    }
    
    // If limited, return 429 response
    if (result.isLimited) {
      metrics.incrementCounter('rate_limited_requests');
      
      const blockedType = Object.entries(result.details)
        .find(([_, data]) => data.blocked)?.[0];
      
      // Get the longest reset time
      const resetAt = Object.values(result.details)
        .reduce((latest, data) => 
          data.resetAt > latest ? data.resetAt : latest, 
          new Date());
      
      const retryAfterSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      
      res.set('Retry-After', retryAfterSeconds);
      
      return res.status(429).json({
        error: 'Too many requests',
        details: result.details,
        retryAfter: retryAfterSeconds,
        message: blockedType 
          ? `Rate limit exceeded for ${blockedType}. You have been temporarily blocked.`
          : `Rate limit exceeded. Please try again later.`
      });
    }
    
    // Continue to next middleware if not limited
    next();
  };
};

// Export the middleware creator and limiter instance
module.exports = {
  createRateLimiter,
  limiter
};