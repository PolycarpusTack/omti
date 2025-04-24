// src/services/logger.ts

/**
 * Logging level enumeration
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
  }
  
  /**
   * Configuration for the logger service
   */
  export interface LoggerConfig {
    /** Minimum level to log */
    minLevel: LogLevel;
    
    /** Whether to include timestamps */
    timestamps: boolean;
    
    /** Whether to log to console */
    console: boolean;
    
    /** Custom logging transport function */
    transport?: (level: LogLevel, message: string, meta?: any) => void;
    
    /** Whether to enrich logs with context */
    enrichLogs: boolean;
    
    /** Global context to include with all logs */
    globalContext?: Record<string, any>;
    
    /** Filter function to sanitize sensitive data */
    sanitizer?: (obj: any) => any;
  }
  
  /**
   * Standard logger interface
   */
  export interface LoggerService {
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    setLevel(level: LogLevel): void;
    withContext(context: Record<string, any>): LoggerService;
  }
  
  /**
   * Default logger implementation
   */
  export class Logger implements LoggerService {
    private config: LoggerConfig;
    private context: Record<string, any> = {};
    
    /**
     * Create a new logger instance
     * @param config - Logger configuration
     */
    constructor(config: Partial<LoggerConfig> = {}) {
      this.config = {
        minLevel: LogLevel.INFO,
        timestamps: true,
        console: true,
        enrichLogs: true,
        ...config
      };
    }
    
    /**
     * Log a message at DEBUG level
     * @param message - Message to log
     * @param meta - Additional metadata
     */
    debug(message: string, meta?: any): void {
      this.log(LogLevel.DEBUG, message, meta);
    }
    
    /**
     * Log a message at INFO level
     * @param message - Message to log
     * @param meta - Additional metadata
     */
    info(message: string, meta?: any): void {
      this.log(LogLevel.INFO, message, meta);
    }
    
    /**
     * Log a message at WARN level
     * @param message - Message to log
     * @param meta - Additional metadata
     */
    warn(message: string, meta?: any): void {
      this.log(LogLevel.WARN, message, meta);
    }
    
    /**
     * Log a message at ERROR level
     * @param message - Message to log
     * @param meta - Additional metadata
     */
    error(message: string, meta?: any): void {
      this.log(LogLevel.ERROR, message, meta);
    }
    
    /**
     * Set the minimum log level
     * @param level - Minimum level to log
     */
    setLevel(level: LogLevel): void {
      this.config.minLevel = level;
    }
    
    /**
     * Create a new logger with additional context
     * @param context - Context data to include with logs
     * @returns New logger instance with combined context
     */
    withContext(context: Record<string, any>): LoggerService {
      const childLogger = new Logger(this.config);
      childLogger.context = {
        ...this.context,
        ...context
      };
      return childLogger;
    }
    
    /**
     * Internal logging implementation
     * @param level - Log level
     * @param message - Message to log
     * @param meta - Additional metadata
     */
    private log(level: LogLevel, message: string, meta?: any): void {
      // Skip if below minimum level
      if (level < this.config.minLevel) {
        return;
      }
      
      // Format timestamp if enabled
      const timestamp = this.config.timestamps 
        ? new Date().toISOString() 
        : undefined;
      
      // Get level name
      const levelName = LogLevel[level];
      
      // Combine metadata and context
      const combinedMeta = this.config.enrichLogs 
        ? {
            ...(this.config.globalContext || {}),
            ...this.context,
            ...meta
          }
        : meta;
      
      // Sanitize if a sanitizer is provided
      const sanitizedMeta = this.config.sanitizer && combinedMeta
        ? this.config.sanitizer(combinedMeta)
        : combinedMeta;
      
      // Format the log entry
      const logEntry = {
        level: levelName,
        message,
        ...(timestamp ? { timestamp } : {}),
        ...(sanitizedMeta ? { meta: sanitizedMeta } : {})
      };
      
      // Send to transport if provided
      if (this.config.transport) {
        this.config.transport(level, message, sanitizedMeta);
      }
      
      // Log to console if enabled
      if (this.config.console) {
        switch (level) {
          case LogLevel.DEBUG:
            console.debug(message, sanitizedMeta);
            break;
          case LogLevel.INFO:
            console.info(message, sanitizedMeta);
            break;
          case LogLevel.WARN:
            console.warn(message, sanitizedMeta);
            break;
          case LogLevel.ERROR:
            console.error(message, sanitizedMeta);
            break;
        }
      }
    }
  }
  
  /**
   * Default logger instance with standard configuration
   */
  export const logger = new Logger({
    minLevel: process.env.NODE_ENV === 'development' 
      ? LogLevel.DEBUG 
      : LogLevel.INFO,
    timestamps: true,
    console: true,
    enrichLogs: true,
    globalContext: {
      appVersion: process.env.REACT_APP_VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    },
    // Default sanitizer to redact sensitive information
    sanitizer: (obj: any) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = { ...obj };
      const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
      
      Object.keys(result).forEach(key => {
        if (sensitiveKeys.some(pattern => key.toLowerCase().includes(pattern))) {
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = logger.config.sanitizer!(result[key]);
        }
      });
      
      return result;
    }
  });