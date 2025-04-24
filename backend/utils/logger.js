// utils/logger.js
/**
 * Enhanced logger with structured logging, severity levels, and optional
 * integration with external logging systems
 */
class Logger {
    constructor(options = {}) {
      this.env = process.env.NODE_ENV || 'development';
      this.level = options.level || (this.env === 'production' ? 'info' : 'debug');
      this.format = options.format || 'json';
      this.destination = options.destination || 'console';
      
      // Define log levels and their priority
      this.levels = {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4,
      };
    }
    
    /**
     * Log a message at the specified level
     * @param {string} level Log level
     * @param {string} message Log message
     * @param {Object} [meta] Additional metadata
     */
    log(level, message, meta = {}) {
      // Check if this level should be logged
      if (!this.levels[level] || this.levels[level] > this.levels[this.level]) {
        return;
      }
      
      const timestamp = new Date().toISOString();
      const logData = {
        level,
        message,
        timestamp,
        ...meta
      };
      
      if (this.format === 'json') {
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
          JSON.stringify(logData)
        );
      } else {
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
          `[${timestamp}] [${level.toUpperCase()}] ${message}`, 
          Object.keys(meta).length ? meta : ''
        );
      }
      
      // Here you would integrate with external logging systems
      // such as Winston, Bunyan, Pino, etc. in a real implementation
    }
    
    /**
     * Log an error message
     * @param {string} message Log message
     * @param {Error|Object} [errorOrMeta] Error object or metadata
     */
    error(message, errorOrMeta) {
      if (errorOrMeta instanceof Error) {
        this.log('error', message, {
          error: {
            name: errorOrMeta.name,
            message: errorOrMeta.message,
            stack: errorOrMeta.stack
          }
        });
      } else {
        this.log('error', message, errorOrMeta);
      }
    }
    
    /**
     * Log a warning message
     * @param {string} message Log message
     * @param {Object} [meta] Additional metadata
     */
    warn(message, meta) {
      this.log('warn', message, meta);
    }
    
    /**
     * Log an info message
     * @param {string} message Log message
     * @param {Object} [meta] Additional metadata
     */
    info(message, meta) {
      this.log('info', message, meta);
    }
    
    /**
     * Log an HTTP request
     * @param {Object} req Express request object
     * @param {Object} res Express response object
     * @param {Object} [meta] Additional metadata
     */
    http(req, res, meta = {}) {
      this.log('http', `${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: meta.responseTime,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        ...meta
      });
    }
    
    /**
     * Log a debug message
     * @param {string} message Log message
     * @param {Object} [meta] Additional metadata
     */
    debug(message, meta) {
      this.log('debug', message, meta);
    }
    
    /**
     * Set the log level
     * @param {string} level New log level
     */
    setLevel(level) {
      if (this.levels[level] !== undefined) {
        this.level = level;
      }
    }
  }
  
  // Export a singleton instance
  module.exports = new Logger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  });