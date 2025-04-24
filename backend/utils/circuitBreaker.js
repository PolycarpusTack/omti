// utils/circuitBreaker.js
const EventEmitter = require('events');
const logger = require('./logger');

/**
 * Circuit Breaker pattern implementation for handling external service failures
 * with configurable thresholds and automatic recovery
 */
class CircuitBreaker extends EventEmitter {
  /**
   * Create a new circuit breaker
   * @param {Object} options Circuit breaker configuration
   * @param {string} options.name Name of the circuit for identification
   * @param {number} options.timeout Request timeout in milliseconds
   * @param {number} options.errorThreshold Percentage of failures before opening circuit
   * @param {number} options.resetTimeout Time in ms before trying to close the circuit again
   * @param {Function} options.errorHandler Custom error handler function
   */
  constructor(options) {
    super();
    this.name = options.name;
    this.timeout = options.timeout || 10000;
    this.errorThreshold = options.errorThreshold || 50;
    this.resetTimeout = options.resetTimeout || 30000;
    this.errorHandler = options.errorHandler;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCount = 0;
    this.lastError = null;
    this.nextAttempt = Date.now();
    
    // Log creation of the circuit breaker
    logger.info(`Circuit Breaker created for ${this.name}`);
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn The function to execute
   * @param {...any} args Arguments to pass to the function
   * @returns {Promise<any>} Result of the function execution
   * @throws {Error} When circuit is open or function execution fails
   */
  async fire(fn, ...args) {
    if (this.state === 'OPEN') {
      // Check if we should try to half-close the circuit
      if (this.nextAttempt <= Date.now()) {
        this.state = 'HALF-OPEN';
        logger.info(`Circuit ${this.name} state changed to HALF-OPEN`);
        this.emit('half-open');
      } else {
        const err = new Error(`Circuit for ${this.name} is OPEN until ${new Date(this.nextAttempt).toISOString()}`);
        err.circuitBreaker = true;
        err.nextAttempt = this.nextAttempt;
        throw err;
      }
    }
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error(`Request to ${this.name} timed out after ${this.timeout}ms`);
        err.timeout = true;
        reject(err);
      }, this.timeout);
    });
    
    try {
      // Execute with timeout race condition
      const result = await Promise.race([
        fn(...args),
        timeoutPromise
      ]);
      
      // If we get here, the call succeeded
      this._handleSuccess();
      return result;
    } catch (error) {
      return this._handleError(error);
    }
  }
  
  /**
   * Handle successful execution
   * @private
   */
  _handleSuccess() {
    this.successCount++;
    this.totalCount++;
    
    // If we were in HALF-OPEN, we can close the circuit again
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
      this.failureCount = 0;
      this.successCount = 0;
      this.totalCount = 0;
      logger.info(`Circuit ${this.name} state changed to CLOSED`);
      this.emit('close');
    }
  }
  
  /**
   * Handle execution error
   * @param {Error} error The error that occurred
   * @private
   * @throws {Error} The original error or a custom error from the handler
   */
  _handleError(error) {
    this.failureCount++;
    this.totalCount++;
    this.lastError = error;
    
    // Calculate error rate
    const errorRate = (this.failureCount / this.totalCount) * 100;
    
    // Check if error rate is above threshold and we have enough samples
    if (this.state === 'CLOSED' && errorRate >= this.errorThreshold && this.totalCount >= 5) {
      this._openCircuit();
    }
    
    // If we're in HALF-OPEN state and an error occurs, open the circuit again
    if (this.state === 'HALF-OPEN') {
      this._openCircuit();
    }
    
    // If we have a custom error handler, use it
    if (this.errorHandler) {
      return this.errorHandler(error, this);
    }
    
    // Otherwise just throw the error
    throw error;
  }
  
  /**
   * Open the circuit
   * @private
   */
  _openCircuit() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    
    logger.warn(`Circuit ${this.name} state changed to OPEN until ${new Date(this.nextAttempt).toISOString()}`);
    logger.warn(`Circuit ${this.name} tripped with error rate ${(this.failureCount / this.totalCount).toFixed(2) * 100}%`);
    
    if (this.lastError) {
      logger.warn(`Last error: ${this.lastError.message}`);
    }
    
    this.emit('open', {
      failureCount: this.failureCount,
      totalCount: this.totalCount,
      errorRate: (this.failureCount / this.totalCount) * 100,
      lastError: this.lastError
    });
  }
  
  /**
   * Reset the circuit breaker stats
   */
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCount = 0;
    this.lastError = null;
    
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      logger.info(`Circuit ${this.name} manually reset to CLOSED`);
      this.emit('close');
    }
  }
  
  /**
   * Get circuit breaker stats
   * @returns {Object} Current stats for the circuit breaker
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCount: this.totalCount,
      errorRate: this.totalCount === 0 ? 0 : (this.failureCount / this.totalCount) * 100,
      lastError: this.lastError ? this.lastError.message : null,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
    };
  }
}

/**
 * Circuit breaker factory
 */
const circuitBreakers = new Map();

module.exports = {
  /**
   * Create a new circuit breaker or return an existing one
   * @param {Object} options Circuit breaker options
   * @returns {CircuitBreaker} A circuit breaker instance
   */
  create(options) {
    if (!options.name) {
      throw new Error('Circuit breaker name is required');
    }
    
    // Return existing circuit breaker if one exists with this name
    if (circuitBreakers.has(options.name)) {
      return circuitBreakers.get(options.name);
    }
    
    // Create new circuit breaker
    const breaker = new CircuitBreaker(options);
    circuitBreakers.set(options.name, breaker);
    return breaker;
  },
  
  /**
   * Get an existing circuit breaker by name
   * @param {string} name Circuit breaker name
   * @returns {CircuitBreaker|null} The circuit breaker instance or null
   */
  get(name) {
    return circuitBreakers.get(name) || null;
  },
  
  /**
   * Get stats for all circuit breakers
   * @returns {Array} Array of circuit breaker stats
   */
  getStats() {
    const stats = [];
    for (const breaker of circuitBreakers.values()) {
      stats.push(breaker.getStats());
    }
    return stats;
  }
};