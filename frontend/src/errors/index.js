// src/errors/index.js

/**
 * Base application error class with enhanced context
 */
export class ApplicationError extends Error {
    /**
     * Creates a new ApplicationError
     * 
     * @param {string} message - Error message
     * @param {Object} options - Error options
     * @param {Error} [options.cause] - Cause of this error
     * @param {number} [options.statusCode=500] - HTTP status code
     * @param {Object} [options.context] - Additional context data
     * @param {Error} [options.originalError] - Original error that was caught
     */
    constructor(message, { cause, statusCode, context, originalError } = {}) {
      super(message);
      this.name = this.constructor.name;
      this.cause = cause;
      this.statusCode = statusCode || 500;
      this.context = context;
      this.originalError = originalError;
      this.timestamp = new Date().toISOString();
      Error.captureStackTrace(this, this.constructor);
    }
  
    /**
     * Returns a plain object representation of the error
     * Useful for logging or serializing
     * 
     * @returns {Object} Object representation of error
     */
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        statusCode: this.statusCode,
        context: this.context,
        timestamp: this.timestamp,
        ...(this.cause ? { cause: this.cause instanceof Error ? this.cause.message : this.cause } : {})
      };
    }
  }
  
  /**
   * Error thrown when input validation fails
   */
  export class ValidationError extends ApplicationError {
    /**
     * Creates a new ValidationError
     * 
     * @param {string} message - Error message
     * @param {Object} options - Error options
     * @param {Array} [options.validationErrors] - Validation error details
     */
    constructor(message, { validationErrors } = {}) {
      super(message, { statusCode: 400 });
      this.validationErrors = validationErrors;
    }
  
    /**
     * Returns a plain object representation of the validation error
     * 
     * @returns {Object} Object representation of validation error
     */
    toJSON() {
      return {
        ...super.toJSON(),
        validationErrors: this.validationErrors
      };
    }
  }
  
  /**
   * Error thrown when authentication fails
   */
  export class AuthenticationError extends ApplicationError {
    constructor(message, options = {}) {
      super(message, { statusCode: 401, ...options });
    }
  }
  
  /**
   * Error thrown when the user doesn't have permission
   */
  export class AuthorizationError extends ApplicationError {
    constructor(message, options = {}) {
      super(message, { statusCode: 403, ...options });
    }
  }
  
  /**
   * Error thrown when a resource is not found
   */
  export class NotFoundError extends ApplicationError {
    constructor(message, options = {}) {
      super(message, { statusCode: 404, ...options });
    }
  }