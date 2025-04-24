/**
 * Advanced Debugging System Architecture
 * 
 * A modular, scalable logging system with pluggable components
 * Enhanced with enterprise-grade features
 * 
 * @category Logging
 * @description Core logging system for enterprise applications
 * 
 * @example
 * const logger = DebugLogger.getInstance();
 * logger.log(Tab.API, 'Request initiated', { url }, Severity.Info);
 */

// Core interfaces for dependency injection
interface Scheduler {
  setTimeout(callback: () => void, ms: number): any;
  clearTimeout(id: any): void;
  setInterval(callback: () => void, ms: number): any;
  clearInterval(id: any): void;
  requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): any;
  cancelIdleCallback(id: any): void;
}

interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

interface MetricsCollector {
  recordCounter(name: string, value: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordTimer(name: string, valueMs: number, tags?: Record<string, string>): void;
}

// Enhanced serializer interface with type safety
interface Serializer {
  stringify<T>(value: T, space?: number): string;
  parse<T = unknown>(text: string): T;
  canSerialize(value: unknown): boolean;
}

// Interface for proper resource cleanup
interface Disposable {
  dispose(): Promise<void>;
}

// Enhanced Type Safety with generics
type StrictLogEntry<T extends object = object> = {
  id: string;
  timestamp: number;
  tab: Tab;
  message: string;
  data: T;
  severity: Severity;
  context?: LogContext;
  tags?: string[];
};

// Advanced Search Options
interface AdvancedSearchOptions {
  operators?: ('AND' | 'OR' | 'NOT')[];
  regex?: boolean;
  fuzzy?: boolean;
  caseSensitive?: boolean;
}

// Compression Strategy interface
interface CompressionStrategy {
  compress(logs: LogEntry[]): Promise<LogEntry[]>;
  decompress(logs: LogEntry[]): Promise<LogEntry[]>;
}

// Specialized modules for different aspects of logging

/**
 * Error Handler for structured error processing
 */
class ErrorHandler {
  private static readonly MAX_ERROR_STACK_LENGTH = 2000;
  
  /**
   * Sanitize an error object for safe logging
   * @param error - The error to sanitize
   * @returns A safe object representation of the error
   */
  static sanitizeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.slice(0, this.MAX_ERROR_STACK_LENGTH),
        cause: error.cause ? this.sanitizeError(error.cause) : undefined
      };
    }
    return { unknownError: String(error) };
  }

  /**
   * Create structured error metadata
   * @param error - The error object
   * @param context - Contextual information about where the error occurred
   * @returns Enhanced error metadata
   */
  static createErrorMetadata(error: unknown, context: string): object {
    return {
      _errorContext: context,
      ...this.sanitizeError(error),
      timestamp: Date.now(),
      environment: typeof process !== 'undefined' ? process.env.NODE_ENV : 'browser'
    };
  }
}

/**
 * Configuration Validator to ensure settings are valid
 */
class ConfigValidator {
  /**
   * Validate batch processor configuration
   * @param config - The configuration to validate
   * @throws {Error} If the configuration is invalid
   */
  static validateBatchConfig(config: Required<BatchProcessorConfig>): void {
    if (config.flushInterval <= 0) {
      throw new Error('flushInterval must be positive');
    }
    if (config.minFlushInterval > config.maxFlushInterval) {
      throw new Error('minFlushInterval cannot exceed maxFlushInterval');
    }
    if (config.maxBatchSize <= 0) {
      throw new Error('maxBatchSize must be positive');
    }
  }

  /**
   * Validate rotation manager configuration
   * @param config - The configuration to validate
   * @throws {Error} If the configuration is invalid
   */
  static validateRotationConfig(config: Required<RotationManagerConfig>): void {
    if (config.rotationPercentage <= 0 || config.rotationPercentage > 1) {
      throw new Error('rotationPercentage must be between 0 and 1');
    }
    if (config.rotationThreshold <= 0) {
      throw new Error('rotationThreshold must be positive');
    }
    if (config.maxRotations <= 0) {
      throw new Error('maxRotations must be positive');
    }
  }

  /**
   * Validate core logger configuration
   * @param config - The configuration to validate
   * @throws {Error} If the configuration is invalid
   */
  static validateCoreConfig(config: Required<CoreLoggerConfig>): void {
    if (config.maxLogs <= 0) {
      throw new Error('maxLogs must be positive');
    }
    if (config.maxLogDataSize <= 0) {
      throw new Error('maxLogDataSize must be positive');
    }
    if (config.notifyDebounceInterval < 0) {
      throw new Error('notifyDebounceInterval cannot be negative');
    }
  }
}

/**
 * Security-focused data sanitizer
 */
class DataSanitizer {
  private static SENSITIVE_KEYS = [/password/i, /token/i, /credit.?card/i, /secret/i, /key/i, /auth/i];
  
  /**
   * Sanitize object data by redacting sensitive fields
   * @param data - The data to sanitize
   * @returns Sanitized data with sensitive fields redacted
   */
  static sanitize<T extends object>(data: T): T {
    if (!data) return data;
    try {
      return this.redactSensitiveData(JSON.parse(JSON.stringify(data)));
    } catch (e) {
      // If we can't stringify, return original but with warning
      return { _sanitizationFailed: true, _original: data } as unknown as T;
    }
  }

  /**
   * Recursively redact sensitive data from an object
   * @param obj - The object to redact
   * @returns Redacted object
   */
  private static redactSensitiveData(obj: object): object {
    if (!obj) return obj;
    
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (this.isSensitiveKey(key)) {
        acc[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        acc[key] = this.redactSensitiveData(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /**
   * Check if a key is sensitive and should be redacted
   * @param key - The key to check
   * @returns True if sensitive, false otherwise
   */
  private static isSensitiveKey(key: string): boolean {
    return this.SENSITIVE_KEYS.some(regex => regex.test(key));
  }
}

/**
 * Default compression strategy using basic serialization
 */
class BasicCompression implements CompressionStrategy {
  /**
   * Compress logs by removing non-essential fields
   * @param logs - The logs to compress
   * @returns Compressed logs
   */
  async compress(logs: LogEntry[]): Promise<LogEntry[]> {
    return logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      tab: log.tab,
      message: log.message,
      severity: log.severity,
      // Minimize data fields to save space
      data: { _compressed: true, _summary: this.summarizeData(log.data) },
      // Only keep essential context info
      context: log.context ? {
        path: log.context.path,
        correlationId: log.context.correlationId
      } : undefined
    }));
  }

  /**
   * Decompress logs (not truly possible with this basic strategy)
   * @param logs - The compressed logs
   * @returns Original logs (with compressed data still)
   */
  async decompress(logs: LogEntry[]): Promise<LogEntry[]> {
    // Basic implementation just passes through since we can't recover the original data
    return logs;
  }

  /**
   * Create a summary of log data for compressed storage
   * @param data - The data to summarize
   * @returns A string summary
   */
  private summarizeData(data: any): string {
    try {
      if (data === null || data === undefined) {
        return 'null';
      }
      
      if (typeof data !== 'object') {
        return String(data).substring(0, 50);
      }
      
      if (Array.isArray(data)) {
        return `Array(${data.length})`;
      }
      
      const keys = Object.keys(data);
      return `Object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    } catch (e) {
      return 'Error summarizing data';
    }
  }
}

/**
 * GZIP based compression strategy (browser-compatible)
 */
class GzipCompression implements CompressionStrategy {
  /**
   * Compress logs using Compression Streams API
   * @param logs - The logs to compress
   * @returns Compressed logs
   */
  async compress(logs: LogEntry[]): Promise<LogEntry[]> {
    try {
      if (typeof CompressionStream === 'undefined') {
        // Fall back to basic if Compression Streams not available
        return new BasicCompression().compress(logs);
      }
      
      const serialized = JSON.stringify(logs);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(serialized);
      
      const compressedStream = new Blob([bytes]).stream().pipeThrough(
        new CompressionStream('gzip')
      );
      
      const compressedBlob = await new Response(compressedStream).blob();
      
      return [{
        id: `compressed_${Date.now()}`,
        timestamp: Date.now(),
        tab: 'System' as any,
        message: 'Compressed logs',
        severity: 'Info' as any,
        data: {
          _type: 'compressed_logs',
          _format: 'gzip',
          _originalCount: logs.length,
          _compressedSize: compressedBlob.size,
          _blob: compressedBlob
        }
      }] as any;
    } catch (e) {
      // Fall back to basic compression if GZIP fails
      return new BasicCompression().compress(logs);
    }
  }

  /**
   * Decompress logs using Decompression Streams API
   * @param logs - The compressed logs
   * @returns Decompressed logs
   */
  async decompress(logs: LogEntry[]): Promise<LogEntry[]> {
    try {
      if (logs.length !== 1 || !logs[0].data._type || logs[0].data._type !== 'compressed_logs') {
        return logs; // Not compressed with this method
      }
      
      const compressedBlob = logs[0].data._blob;
      
      const decompressedStream = compressedBlob.stream().pipeThrough(
        new DecompressionStream('gzip')
      );
      
      const decompressedBlob = await new Response(decompressedStream).blob();
      const text = await decompressedBlob.text();
      
      return JSON.parse(text);
    } catch (e) {
      // If decompression fails, return original
      return logs;
    }
  }
}

/**
 * Simple event bus for cross-cutting concerns
 */
class LogEventBus {
  private static listeners: Record<string, Array<(payload: any) => void>> = {
    'log': [],
    'error': [],
    'flush': [],
    'fix': [],
    'rotation': []
  };

  /**
   * Register a listener for an event
   * @param event - The event to listen for
   * @param listener - The callback function
   * @returns Unsubscribe function
   */
  static on(event: 'log' | 'error' | 'flush' | 'fix' | 'rotation', listener: (payload: any) => void): () => void {
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    };
  }

  /**
   * Emit an event to all registered listeners
   * @param event - The event to emit
   * @param payload - The data to send
   */
  static emit(event: 'log' | 'error' | 'flush' | 'fix' | 'rotation', payload: any): void {
    this.listeners[event].forEach(listener => {
      try {
        listener(payload);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    });
  }

  /**
   * Remove all event listeners
   */
  static clear(): void {
    Object.keys(this.listeners).forEach(key => {
      this.listeners[key as keyof typeof this.listeners] = [];
    });
  }
}

/**
 * System monitoring integration
 */
class MonitoringIntegration {
  private static intervalId: any = null;
  
  /**
   * Begin collecting and reporting system metrics
   * @param metrics - The metrics collector to use
   * @param scheduler - The scheduler for timing
   * @param intervalMs - How often to collect metrics (ms)
   */
  static integrate(metrics: MetricsCollector, scheduler: Scheduler, intervalMs = 5000): void {
    if (this.intervalId) {
      return; // Already running
    }
    
    const reportMetrics = () => {
      try {
        // Browser memory metrics
        if (typeof performance !== 'undefined' && performance.memory) {
          const mem = performance.memory as any;
          metrics.recordGauge('system.memory.usage', mem.usedJSHeapSize);
          metrics.recordGauge('system.memory.total', mem.totalJSHeapSize);
        }
        
        // Basic timing metrics
        metrics.recordGauge('system.time.now', Date.now());
        
        // Log health metrics
        const eventCount = LogEventBus.listeners['log'].length;
        metrics.recordGauge('system.events.listeners', eventCount);
      } catch (e) {
        // Silently fail - metrics are non-critical
      }
    };
    
    this.intervalId = scheduler.setInterval(reportMetrics, intervalMs);
  }
  
  /**
   * Stop collecting metrics
   * @param scheduler - The scheduler used for timing
   */
  static stopIntegration(scheduler: Scheduler): void {
    if (this.intervalId) {
      scheduler.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Fuzzy search implementation for enhanced log searching
 */
class FuzzySearchEngine {
  /**
   * Perform a fuzzy search on text
   * @param haystack - The text to search in
   * @param needle - The search term
   * @returns Match score (0-1) where 1 is perfect match
   */
  static search(haystack: string, needle: string): number {
    if (!needle) return 1;
    if (!haystack) return 0;
    
    const haystackLower = haystack.toLowerCase();
    const needleLower = needle.toLowerCase();
    
    // Perfect match
    if (haystackLower.includes(needleLower)) {
      return 1;
    }
    
    // Individual character matching
    let score = 0;
    let position = 0;
    
    // Find how many characters match in sequence
    for (const char of needleLower) {
      const found = haystackLower.indexOf(char, position);
      if (found !== -1) {
        score += 1;
        position = found + 1;
      }
    }
    
    // Normalize score to 0-1 range
    return score / needleLower.length;
  }
  
  /**
   * Check if a log entry matches a search query using fuzzy matching
   * @param log - The log entry to check
   * @param query - The search query
   * @param threshold - Minimum score to consider a match (0-1)
   * @returns True if matches, false otherwise
   */
  static matchLog(log: LogEntry, query: string, threshold = 0.7): boolean {
    // Check message
    const messageScore = this.search(log.message, query);
    if (messageScore >= threshold) return true;
    
    // Check data (simplified)
    try {
      const dataString = JSON.stringify(log.data);
      const dataScore = this.search(dataString, query);
      if (dataScore >= threshold) return true;
    } catch (e) {
      // Ignore errors in data stringification
    }
    
    // Check context path
    if (log.context && log.context.path) {
      const pathString = log.context.path.join('.');
      const pathScore = this.search(pathString, query);
      if (pathScore >= threshold) return true;
    }
    
    return false;
  }
}

/**
 * BatchProcessor - Responsible for batching logs and processing them efficiently
 */
class BatchProcessor implements Disposable {
  private pendingBatch: LogEntry[] = [];
  private intervalId: any = null;
  private idleCallbackId: any = null;
  private metrics: MetricsCollector;
  private scheduler: Scheduler;
  private config: Required<BatchProcessorConfig>;
  
  constructor(
    private logger: CoreLogger,
    private indexManager: IndexManager,
    metrics: MetricsCollector | null,
    scheduler: Scheduler | null,
    config: BatchProcessorConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    this.scheduler = scheduler || new BrowserScheduler();
    
    // Default configuration
    this.config = {
      enabled: config.enabled ?? true,
      flushInterval: config.flushInterval ?? 1000,
      maxBatchSize: config.maxBatchSize ?? 100,
      useIdleCallback: config.useIdleCallback ?? true,
      prioritySeverities: config.prioritySeverities ?? [Severity.Critical, Severity.Error],
      adaptiveInterval: config.adaptiveInterval ?? false,
      minFlushInterval: config.minFlushInterval ?? 100,
      maxFlushInterval: config.maxFlushInterval ?? 5000
    };
    
    // Validate configuration
    ConfigValidator.validateBatchConfig(this.config);
    
    if (this.config.enabled) {
      this.start();
    }
  }
  
  /**
   * Add a log entry to the batch
   */
  addLog(log: LogEntry): void {
    if (!this.config.enabled) {
      // Process immediately if batching disabled
      this.logger.processLogEntry(log);
      return;
    }
    
    this.pendingBatch.push(log);
    
    // Process immediately for priority severities
    if (this.config.prioritySeverities.includes(log.severity as Severity)) {
      this.flush();
      return;
    }
    
    // Process if batch exceeds max size
    if (this.pendingBatch.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }
  
  /**
   * Start batch processing
   */
  start(): void {
    if (this.intervalId || this.idleCallbackId) return;
    
    if (this.config.useIdleCallback && 'requestIdleCallback' in this.scheduler) {
      const scheduleIdle = () => {
        this.idleCallbackId = this.scheduler.requestIdleCallback(() => {
          this.flush();
          scheduleIdle();
        }, { timeout: this.config.flushInterval });
      };
      
      scheduleIdle();
    } else {
      this.intervalId = this.scheduler.setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
    
    this.metrics.recordCounter('debug_logger.batch_processor.start', 1);
  }
  
  /**
   * Stop batch processing
   */
  stop(): void {
    if (this.intervalId) {
      this.scheduler.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.idleCallbackId) {
      this.scheduler.cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    
    this.metrics.recordCounter('debug_logger.batch_processor.stop', 1);
  }
  
  /**
   * Flush pending batch of logs
   */
  flush(): void {
    if (this.pendingBatch.length === 0) return;
    
    const startTime = performance.now();
    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    
    // Emit event for monitoring
    LogEventBus.emit('flush', { 
      batchSize: batch.length, 
      timestamp: Date.now()
    });
    
    // Process each log
    for (const log of batch) {
      this.logger.processLogEntry(log);
    }
    
    const processingTime = performance.now() - startTime;
    
    // Record metrics
    this.metrics.recordHistogram('debug_logger.batch_size', batch.length);
    this.metrics.recordTimer('debug_logger.batch_processing_time', processingTime);
    
    // Adjust interval if adaptive mode is enabled
    if (this.config.adaptiveInterval) {
      this.adaptFlushInterval(processingTime, batch.length);
    }
  }
  
  /**
   * Dynamically adjust flush interval based on processing time
   */
  private adaptFlushInterval(processingTime: number, batchSize: number): void {
    if (batchSize === 0) return;
    
    // Calculate time per log entry
    const timePerLog = processingTime / batchSize;
    
    // Logic for adaptive interval:
    // - If processing is fast (< 1ms per log), reduce interval to process more frequently
    // - If processing is slow (> 5ms per log), increase interval to reduce CPU impact
    let newInterval = this.config.flushInterval;
    
    if (timePerLog < 1) {
      // Processing is fast, reduce interval (but not below min)
      newInterval = Math.max(this.config.flushInterval * 0.8, this.config.minFlushInterval);
    } else if (timePerLog > 5) {
      // Processing is slow, increase interval (but not above max)
      newInterval = Math.min(this.config.flushInterval * 1.2, this.config.maxFlushInterval);
    }
    
    // Update interval if it changed
    if (newInterval !== this.config.flushInterval) {
      this.config.flushInterval = newInterval;
      
      // Restart scheduling with new interval
      if (this.intervalId) {
        this.stop();
        this.start();
      }
      
      this.metrics.recordGauge('debug_logger.adaptive_flush_interval', newInterval);
    }
  }
  
  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.stop();
    this.pendingBatch = [];
    return Promise.resolve();
  }
}

/**
 * IndexManager - Manages search indexing and efficient lookup
 */
class IndexManager implements Disposable {
  private searchIndex: Map<string, Set<string>> = new Map();
  private logIdMap: Map<string, LogEntry> = new Map();
  private indexingWorkerActive: boolean = false;
  private indexingQueue: LogEntry[] = [];
  private metrics: MetricsCollector;
  private scheduler: Scheduler;
  private config: Required<IndexManagerConfig>;
  
  constructor(
    metrics: MetricsCollector | null,
    scheduler: Scheduler | null,
    config: IndexManagerConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    this.scheduler = scheduler || new BrowserScheduler();
    
    this.config = {
      maxIndexedTokenLength: config.maxIndexedTokenLength ?? 50,
      minTokenLength: config.minTokenLength ?? 3,
      maxSearchDepth: config.maxSearchDepth ?? 3,
      useWorkers: config.useWorkers ?? false,
      maxIndexingBatchSize: config.maxIndexingBatchSize ?? 50,
      useIdleProcessing: config.useIdleProcessing ?? true
    };
    
    // Initialize web worker if enabled and available
    if (this.config.useWorkers) {
      this.setupIndexingWorker();
    }
  }
  
  /**
   * Set up a web worker for indexing (when supported)
   */
  private setupIndexingWorker(): void {
    // Implementation would create a web worker for offloading indexing
    // Not implemented in this example as it would require file creation
    this.config.useWorkers = false;
  }
  
  /**
   * Index a log entry for efficient searching
   */
  indexLog(log: LogEntry): void {
    // Add to ID map first (immediate access)
    this.logIdMap.set(log.id, log);
    
    // If workers enabled, add to queue and process
    if (this.config.useWorkers) {
      this.indexingQueue.push(log);
      this.processIndexingQueue();
      return;
    }
    
    // If idle processing enabled, schedule for idle time
    if (this.config.useIdleProcessing && 'requestIdleCallback' in this.scheduler) {
      this.indexingQueue.push(log);
      this.scheduleIdleIndexing();
      return;
    }
    
    // Otherwise index immediately
    this.performIndexing(log);
  }
  
  /**
   * Process indexing queue using web worker
   */
  private processIndexingQueue(): void {
    // Would send data to worker - simplified implementation
    if (this.indexingWorkerActive || this.indexingQueue.length === 0) {
      return;
    }
    
    this.indexingWorkerActive = true;
    const batch = this.indexingQueue.splice(0, this.config.maxIndexingBatchSize);
    
    // Process batch synchronously since we're not using a real worker
    for (const log of batch) {
      this.performIndexing(log);
    }
    
    this.indexingWorkerActive = false;
    
    // Process more if queue not empty
    if (this.indexingQueue.length > 0) {
      this.scheduler.setTimeout(() => {
        this.processIndexingQueue();
      }, 0);
    }
  }
  
  /**
   * Schedule indexing during idle browser time
   */
  private scheduleIdleIndexing(): void {
    if (this.indexingQueue.length === 0) return;
    
    this.scheduler.requestIdleCallback((deadline) => {
      while (this.indexingQueue.length > 0 && deadline.timeRemaining() > 5) {
        const log = this.indexingQueue.shift();
        if (log) {
          this.performIndexing(log);
        }
      }
      
      // If more logs, schedule another idle callback
      if (this.indexingQueue.length > 0) {
        this.scheduleIdleIndexing();
      }
    });
  }
  
  /**
   * Perform actual indexing of a log entry
   */
  private performIndexing(log: LogEntry): void {
    const startTime = performance.now();
    
    try {
      // Create tokens from message
      const tokens = this.tokenize(log.message);
      
      // Extract searchable tokens from data
      const dataTokens = this.extractDataTokens(log.data);
      
      // Combine all tokens
      const allTokens = [...tokens, ...dataTokens];
      
      // Add to search index
      let indexedTokenCount = 0;
      for (const token of allTokens) {
        // Skip tokens that are too short
        if (token.length < this.config.minTokenLength) continue;
        
        // Skip after max tokens reached
        if (indexedTokenCount >= this.config.maxIndexedTokenLength) break;
        
        if (!this.searchIndex.has(token)) {
          this.searchIndex.set(token, new Set());
        }
        
        this.searchIndex.get(token)!.add(log.id);
        indexedTokenCount++;
      }
      
      const indexingTime = performance.now() - startTime;
      this.metrics.recordTimer('debug_logger.indexing_time', indexingTime);
    } catch (error) {
      // Silently fail indexing - not critical
      this.metrics.recordCounter('debug_logger.indexing_errors', 1);
    }
  }
  
  /**
   * Extract tokens from data object for indexing
   */
  private extractDataTokens(data: any, depth: number = 0): string[] {
    if (data === null || data === undefined) return [];
    if (depth >= this.config.maxSearchDepth) return [];
    
    try {
      const tokens: string[] = [];
      
      if (typeof data === 'string') {
        tokens.push(...this.tokenize(data));
      } else if (typeof data === 'number' || typeof data === 'boolean') {
        tokens.push(String(data));
      } else if (typeof data === 'object') {
        // Handle arrays
        if (Array.isArray(data)) {
          // Only index first few items for large arrays
          const itemsToIndex = data.slice(0, 10);
          for (const item of itemsToIndex) {
            tokens.push(...this.extractDataTokens(item, depth + 1));
          }
        } else {
          // Handle objects
          for (const key of Object.keys(data)) {
            // Add the key itself
            tokens.push(...this.tokenize(key));
            
            // Add value tokens if not too deep
            if (depth < this.config.maxSearchDepth - 1) {
              const value = data[key];
              tokens.push(...this.extractDataTokens(value, depth + 1));
            }
          }
        }
      }
      
      return tokens;
    } catch (e) {
      return [];
    }
  }
  
  /**
   * Tokenize text into searchable tokens
   */
  private tokenize(text: string): string[] {
    try {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length >= this.config.minTokenLength);
    } catch (e) {
      return [];
    }
  }
  
  /**
   * Search logs by text with index acceleration
   */
  search(query: string, options?: AdvancedSearchOptions): Set<string> {
    const startTime = performance.now();
    
    try {
      if (!query || query.length < this.config.minTokenLength) {
        return new Set();
      }
      
      // Handle regex search if enabled
      if (options?.regex) {
        return this.regexSearch(query);
      }
      
      // Handle fuzzy search if enabled
      if (options?.fuzzy) {
        return this.fuzzySearch(query);
      }
      
      // Basic tokenized search
      const queryTokens = this.tokenize(
        options?.caseSensitive ? query : query.toLowerCase()
      );
      
      // Find matching log IDs from index
      const matchingLogIds = new Set<string>();
      
      if (queryTokens.length > 0) {
        // Get matching sets for each token
        const tokenMatches: Set<string>[] = [];
        
        for (const token of queryTokens) {
          const matches = this.searchIndex.get(token);
          if (matches && matches.size > 0) {
            tokenMatches.push(matches);
          }
        }
        
        // Apply different operators if specified
        if (tokenMatches.length > 0) {
          if (options?.operators && options.operators.includes('OR')) {
            // OR operator: Union of all matches
            tokenMatches.forEach(set => {
              set.forEach(id => matchingLogIds.add(id));
            });
          } else {
            // Default is AND operator: Intersection of all matches
            if (tokenMatches.length === 1) {
              // Only one token, use its matches directly
              tokenMatches[0].forEach(id => matchingLogIds.add(id));
            } else {
              // Find logs that match all tokens (set intersection)
              tokenMatches[0].forEach(id => {
                // Check if this ID exists in all other token match sets
                const matchesAllTokens = tokenMatches.slice(1).every(set => set.has(id));
                if (matchesAllTokens) {
                  matchingLogIds.add(id);
                }
              });
            }
          }
        }
      }
      
      // Apply NOT operator if specified
      if (options?.operators && options.operators.includes('NOT') && query.includes('NOT ')) {
        const notTokens = query
          .split(' ')
          .filter(t => t.startsWith('NOT '))
          .map(t => t.replace('NOT ', ''));
        
        if (notTokens.length > 0) {
          for (const notToken of notTokens) {
            const notMatches = this.searchIndex.get(notToken);
            if (notMatches) {
              notMatches.forEach(id => {
                matchingLogIds.delete(id);
              });
            }
          }
        }
      }
      
      const searchTime = performance.now() - startTime;
      this.metrics.recordTimer('debug_logger.search_time', searchTime);
      this.metrics.recordHistogram('debug_logger.search_result_count', matchingLogIds.size);
      
      return matchingLogIds;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.search_errors', 1);
      return new Set();
    }
  }
  
  /**
   * Perform a regex-based search
   */
  private regexSearch(pattern: string): Set<string> {
    const result = new Set<string>();
    
    try {
      const regex = new RegExp(pattern, 'i');
      
      // Need to scan all logs since we can't use the index for regex
      this.logIdMap.forEach((log, id) => {
        if (regex.test(log.message)) {
          result.add(id);
          return;
        }
        
        // Also check log data (simplified)
        try {
          const dataString = JSON.stringify(log.data);
          if (regex.test(dataString)) {
            result.add(id);
          }
        } catch (e) {
          // Ignore stringification errors
        }
      });
      
      return result;
    } catch (e) {
      // Invalid regex pattern
      return result;
    }
  }
  
  /**
   * Perform a fuzzy search using the FuzzySearchEngine
   */
  private fuzzySearch(query: string): Set<string> {
    const result = new Set<string>();
    const threshold = 0.7; // Minimum score to consider a match
    
    this.logIdMap.forEach((log, id) => {
      if (FuzzySearchEngine.matchLog(log, query, threshold)) {
        result.add(id);
      }
    });
    
    return result;
  }
  
  /**
   * Get a log entry by ID
   */
  getLogById(id: string): LogEntry | undefined {
    return this.logIdMap.get(id);
  }
  
  /**
   * Clear all indices
   */
  clear(): void {
    this.searchIndex.clear();
    this.logIdMap.clear();
    this.indexingQueue = [];
    this.metrics.recordCounter('debug_logger.index_cleared', 1);
  }
  
  /**
   * Get statistics about the index
   */
  getStats(): IndexStats {
    return {
      totalIndexedTokens: this.searchIndex.size,
      totalIndexedLogs: this.logIdMap.size,
      pendingIndexingTasks: this.indexingQueue.length,
      memoryUsageEstimate: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Estimate memory usage of the index
   */
  private estimateMemoryUsage(): number {
    try {
      let size = 0;
      
      // Estimate search index size
      for (const [token, ids] of this.searchIndex.entries()) {
        size += token.length * 2; // Token itself
        size += ids.size * 40; // Approx size per ID entry including overhead
      }
      
      // Estimate ID map size
      size += this.logIdMap.size * 60; // Keys + overhead
      
      return size;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.clear();
    return Promise.resolve();
  }
}

/**
 * RotationManager - Handles log rotation and storage management
 */
class RotationManager implements Disposable {
  private rotatedLogs: LogEntry[][] = [];
  private metrics: MetricsCollector;
  private config: Required<RotationManagerConfig>;
  private compressionStrategy: CompressionStrategy;
  
  constructor(
    private indexManager: IndexManager,
    metrics: MetricsCollector | null,
    config: RotationManagerConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    
    this.config = {
      enabled: config.enabled ?? true,
      rotationThreshold: config.rotationThreshold ?? 5000,
      maxRotations: config.maxRotations ?? 5,
      rotationPercentage: config.rotationPercentage ?? 0.5,
      compressRotatedLogs: config.compressRotatedLogs ?? false
    };
    
    // Validate configuration
    ConfigValidator.validateRotationConfig(this.config);
    
    // Select compression strategy
    this.compressionStrategy = typeof CompressionStream !== 'undefined' 
      ? new GzipCompression() 
      : new BasicCompression();
  }
  
  /**
   * Check if rotation is needed and perform if necessary
   */
  async checkRotation(logs: LogEntry[]): Promise<LogEntry[]> {
    if (!this.config.enabled || logs.length <= this.config.rotationThreshold) {
      return logs;
    }
    
    const rotationTime = performance.now();
    
    // Calculate how many logs to rotate out
    const logsToRotate = Math.ceil(this.config.rotationThreshold * this.config.rotationPercentage);
    
    // Get oldest logs
    const oldestLogs = logs.splice(0, logsToRotate);
    
    // Emit rotation event
    LogEventBus.emit('rotation', { count: oldestLogs.length, timestamp: Date.now() });
    
    // Compress rotated logs if enabled
    const rotatedSet = this.config.compressRotatedLogs
      ? await this.compressionStrategy.compress(oldestLogs)
      : oldestLogs;
    
    // Add to rotation archive
    this.rotatedLogs.push(rotatedSet);
    
    // Respect max rotations setting
    while (this.rotatedLogs.length > this.config.maxRotations) {
      this.rotatedLogs.shift();
    }
    
    const rotationDuration = performance.now() - rotationTime;
    
    // Log metrics
    this.metrics.recordCounter('debug_logger.logs_rotated', logsToRotate);
    this.metrics.recordGauge('debug_logger.rotation_sets', this.rotatedLogs.length);
    this.metrics.recordTimer('debug_logger.rotation_duration', rotationDuration);
    
    return logs;
  }
  
  /**
   * Get all logs including rotated ones
   */
  async getAllLogs(currentLogs: LogEntry[]): Promise<LogEntry[]> {
    let allLogs: LogEntry[] = [];
    
    // Add all rotated logs, decompressing if needed
    for (const rotationSet of this.rotatedLogs) {
      if (this.config.compressRotatedLogs) {
        const decompressed = await this.compressionStrategy.decompress(rotationSet);
        allLogs = [...allLogs, ...decompressed];
      } else {
        allLogs = [...allLogs, ...rotationSet];
      }
    }
    
    // Add current logs
    return [...allLogs, ...currentLogs];
  }
  
  /**
   * Get stats about rotated logs
   */
  getStats(): RotationStats {
    const rotatedCount = this.rotatedLogs.reduce((sum, set) => sum + set.length, 0);
    
    return {
      rotationSets: this.rotatedLogs.length,
      totalRotatedLogs: rotatedCount,
      oldestLogTimestamp: this.getOldestTimestamp(),
      estimatedMemoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Get timestamp of oldest log
   */
  private getOldestTimestamp(): number | null {
    if (this.rotatedLogs.length === 0 || this.rotatedLogs[0].length === 0) {
      return null;
    }
    
    return this.rotatedLogs[0][0].timestamp;
  }
  
  /**
   * Estimate memory usage of rotated logs
   */
  private estimateMemoryUsage(): number {
    try {
      let size = 0;
      
      for (const set of this.rotatedLogs) {
        // Rough estimate: each log takes about 250 bytes in compressed form
        size += set.length * 250;
      }
      
      return size;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Clear all rotated logs
   */
  clear(): void {
    const rotatedCount = this.rotatedLogs.reduce((sum, set) => sum + set.length, 0);
    this.rotatedLogs = [];
    this.metrics.recordCounter('debug_logger.rotated_logs_cleared', rotatedCount);
  }
  
  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.clear();
    return Promise.resolve();
  }
}

/**
 * FixSuggestionManager - Manages fix suggestions and auto-fixes
 */
class FixSuggestionManager implements Disposable {
  private fixes: FixSuggestion[] = [];
  private fixIdMap: Map<string, FixSuggestion> = new Map();
  private fixRules: FixRule[] = [];
  private metrics: MetricsCollector;
  private config: Required<FixSuggestionManagerConfig>;
  
  constructor(
    metrics: MetricsCollector | null,
    config: FixSuggestionManagerConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    
    this.config = {
      maxFixes: config.maxFixes ?? 1000,
      enableAutoFixes: config.enableAutoFixes ?? true,
      groupSimilarFixes: config.groupSimilarFixes ?? true,
      similarityThreshold: config.similarityThreshold ?? 0.8
    };
    
    // Initialize built-in fix rules
    this.initializeDefaultRules();
  }
  
  /**
   * Add a fix suggestion
   */
  addFix(
    issue: string, 
    description: string, 
    suggestion: string, 
    fixFunction: Function | string | null = null, 
    severity: Severity = Severity.Warn
  ): string {
    try {
      // Validate inputs
      if (!issue) issue = 'Unknown issue';
      if (!description) description = 'No description provided';
      if (!suggestion) suggestion = 'No suggestion provided';
      
      // Generate ID
      const id = `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // If grouping is enabled, check for similar fixes
      if (this.config.groupSimilarFixes) {
        const similarFix = this.findSimilarFix(issue, description);
        if (similarFix) {
          // Update occurrence count on existing fix
          similarFix.occurrences = (similarFix.occurrences || 1) + 1;
          this.metrics.recordCounter('debug_logger.fix_grouped', 1);
          return similarFix.id;
        }
      }
      
      // Prune fixes if exceeding maximum
      if (this.fixes.length >= this.config.maxFixes) {
        // Remove oldest fix
        const removed = this.fixes.shift();
        if (removed) {
          this.fixIdMap.delete(removed.id);
        }
      }
      
      // Create fix suggestion
      const fix: FixSuggestion = {
        id,
        issue,
        description,
        suggestion,
        fixFunction: fixFunction as any,
        severity,
        timestamp: Date.now(),
        occurrences: 1
      };
      
      // Add fix
      this.fixes.push(fix);
      this.fixIdMap.set(id, fix);
      
      // Emit event
      LogEventBus.emit('fix', { 
        action: 'add', 
        fix, 
        timestamp: Date.now()
      });
      
      this.metrics.recordCounter('debug_logger.fix_added', 1, { severity: String(severity) });
      
      return id;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.fix_error', 1);
      return '';
    }
  }
  
  /**
   * Find a similar fix if one exists
   */
  private findSimilarFix(issue: string, description: string): FixSuggestion | null {
    try {
      for (const fix of this.fixes) {
        const issueSimilarity = this.calculateStringSimilarity(fix.issue, issue);
        const descriptionSimilarity = this.calculateStringSimilarity(fix.description, description);
        
        // Use average similarity
        const avgSimilarity = (issueSimilarity + descriptionSimilarity) / 2;
        
        if (avgSimilarity >= this.config.similarityThreshold) {
          return fix;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Calculate string similarity (Jaccard index based on word tokens)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    try {
      // Convert to lowercase and split into words
      const words1 = new Set(str1.toLowerCase().split(/\s+/));
      const words2 = new Set(str2.toLowerCase().split(/\s+/));
      
      // Calculate intersection size
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      
      // Calculate union size
      const union = new Set([...words1, ...words2]);
      
      // Jaccard index
      return intersection.size / union.size;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Dismiss a fix suggestion
   */
  dismissFix(fixId: string): void {
    try {
      // Find fix by ID
      const fixIndex = this.fixes.findIndex(fix => fix.id === fixId);
      
      if (fixIndex !== -1) {
        // Remove fix
        const removed = this.fixes.splice(fixIndex, 1)[0];
        this.fixIdMap.delete(removed.id);
        
        // Emit event
        LogEventBus.emit('fix', { 
          action: 'dismiss', 
          fix: removed, 
          timestamp: Date.now()
        });
        
        this.metrics.recordCounter('debug_logger.fix_dismissed', 1);
      }
    } catch (error) {
      this.metrics.recordCounter('debug_logger.fix_dismiss_error', 1);
    }
  }
  
  /**
   * Apply a fix
   */
  async applyFix(fixId: string): Promise<boolean> {
    try {
      // Find fix by ID
      const fix = this.fixIdMap.get(fixId);
      
      if (!fix) {
        this.metrics.recordCounter('debug_logger.fix_apply_error', 1, { reason: 'not_found' });
        return false;
      }
      
      // Check if fix function is available
      if (!fix.fixFunction) {
        this.metrics.recordCounter('debug_logger.fix_apply_error', 1, { reason: 'no_function' });
        return false;
      }
      
      // Apply the fix
      if (typeof fix.fixFunction === 'function') {
        try {
          // Handle async functions
          const result = fix.fixFunction();
          
          // Emit event
          LogEventBus.emit('fix', { 
            action: 'apply', 
            fix, 
            timestamp: Date.now()
          });
          
          if (result instanceof Promise) {
            const success = await result;
            this.metrics.recordCounter('debug_logger.fix_applied', 1, { success: String(!!success) });
            return !!success;
          } else {
            // Assume success for synchronous functions unless explicitly false
            this.metrics.recordCounter('debug_logger.fix_applied', 1, { success: String(result !== false) });
            return result !== false;
          }
        } catch (e) {
          this.metrics.recordCounter('debug_logger.fix_apply_error', 1, { reason: 'execution_error' });
          return false;
        }
      } else if (typeof fix.fixFunction === 'string') {
        // String represents a command or instruction
        this.metrics.recordCounter('debug_logger.fix_instruction_shown', 1);
        return true;
      }
      
      // Dismiss the fix after application (optional)
      this.dismissFix(fixId);
      
      return true;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.fix_apply_error', 1, { reason: 'unknown' });
      return false;
    }
  }
  
  /**
   * Get all fix suggestions
   */
  getFixes(): FixSuggestion[] {
    return [...this.fixes];
  }
  
  /**
   * Get a fix by ID
   */
  getFixById(id: string): FixSuggestion | null {
    return this.fixIdMap.get(id) || null;
  }
  
  /**
   * Clear all fixes
   */
  clear(): void {
    const fixCount = this.fixes.length;
    this.fixes = [];
    this.fixIdMap.clear();
    this.metrics.recordCounter('debug_logger.fixes_cleared', fixCount);
  }
  
  /**
   * Register a custom fix rule
   */
  registerFixRule(rule: FixRule): void {
    this.fixRules.push(rule);
    this.metrics.recordCounter('debug_logger.fix_rule_registered', 1);
  }
  
  /**
   * Initialize default fix rules
   */
  private initializeDefaultRules(): void {
    // Network error rule
    this.registerFixRule({
      id: 'network-error',
      name: 'Network Error Detection',
      predicate: (log) => {
        const message = log.message.toLowerCase();
        return (
          message.includes('api') || 
          message.includes('network') || 
          message.includes('fetch') || 
          message.includes('request')
        );
      },
      createFix: (log) => ({
        issue: 'Network Request Issue',
        description: 'There was a problem with a network request.',
        suggestion: 'Check your network connection and that the API endpoint is correct and accessible.',
        severity: Severity.Warn
      })
    });
    
    // File handling rule
    this.registerFixRule({
      id: 'file-error',
      name: 'File Handling Error',
      predicate: (log) => {
        const message = log.message.toLowerCase();
        return (
          message.includes('file') && 
          (message.includes('upload') || message.includes('read'))
        );
      },
      createFix: (log) => ({
        issue: 'File Handling Issue',
        description: 'There was a problem processing a file.',
        suggestion: 'Verify the file format is supported and that it is not corrupted or too large.',
        severity: Severity.Warn
      })
    });
    
    // State management rule
    this.registerFixRule({
      id: 'state-error',
      name: 'State Management Error',
      predicate: (log) => {
        const message = log.message.toLowerCase();
        return (
          message.includes('state') || 
          message.includes('undefined') || 
          message.includes('null')
        );
      },
      createFix: (log) => ({
        issue: 'State Management Issue',
        description: 'There may be an issue with application state management.',
        suggestion: 'Check that all state variables are properly initialized and that component dependencies are correct.',
        severity: Severity.Warn
      })
    });
  }
  
  /**
   * Generate fix suggestions for a log
   */
  generateFixesForLog(log: LogEntry): string[] {
    if (!this.config.enableAutoFixes) return [];
    
    const fixIds: string[] = [];
    
    try {
      // Apply all matching rules
      for (const rule of this.fixRules) {
        if (rule.predicate(log)) {
          const fixTemplate = rule.createFix(log);
          
          const fixId = this.addFix(
            fixTemplate.issue,
            fixTemplate.description,
            fixTemplate.suggestion,
            fixTemplate.fixFunction,
            fixTemplate.severity
          );
          
          if (fixId) {
            fixIds.push(fixId);
          }
          
          // Record rule usage
          this.metrics.recordCounter('debug_logger.fix_rule_triggered', 1, { rule: rule.id });
        }
      }
    } catch (error) {
      this.metrics.recordCounter('debug_logger.fix_generation_error', 1);
    }
    
    return fixIds;
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.clear();
    return Promise.resolve();
  }
}

/**
 * ContextManager - Manages context hierarchy tracking
 */
class ContextManager implements Disposable {
  private contextStack: LogContext[] = [];
  private contextCounts: Record<string, number> = {};
  private metrics: MetricsCollector;
  private config: Required<ContextManagerConfig>;
  
  constructor(
    metrics: MetricsCollector | null,
    config: ContextManagerConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    
    this.config = {
      enabled: config.enabled ?? true,
      maxContextDepth: config.maxContextDepth ?? 10,
      trackDuration: config.trackDuration ?? true,
      trackMetrics: config.trackMetrics ?? true
    };
  }
  
  /**
   * Start a new context for grouping related logs
   */
  pushContext(name: string, data: Record<string, any> = {}): string {
    if (!this.config.enabled) return '';
    
    try {
      // Generate context ID
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create path
      const parentPath = this.contextStack.length > 0 
        ? [...this.contextStack[this.contextStack.length - 1].path]
        : [];
      
      // Limit path depth
      if (parentPath.length >= this.config.maxContextDepth) {
        parentPath.pop(); // Remove oldest to make room
      }
      
      // Create context
      const context: LogContext = {
        path: [...parentPath, name],
        correlationId: contextId,
        startTime: Date.now(),
        data: DataSanitizer.sanitize(data),
        parentId: this.contextStack.length > 0 
          ? this.contextStack[this.contextStack.length - 1].correlationId
          : undefined
      };
      
      // Push to stack
      this.contextStack.push(context);
      
      // Track context usage
      const pathString = context.path.join('.');
      this.contextCounts[pathString] = (this.contextCounts[pathString] || 0) + 1;
      
      // Record metrics
      this.metrics.recordCounter('debug_logger.context_pushed', 1);
      this.metrics.recordGauge('debug_logger.context_depth', this.contextStack.length);
      
      return contextId;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.context_error', 1);
      return '';
    }
  }
  
  /**
   * End the current context
   */
  popContext(): LogContext | null {
    if (!this.config.enabled || this.contextStack.length === 0) return null;
    
    try {
      const context = this.contextStack.pop()!;
      const duration = Date.now() - context.startTime;
      
      // Record metrics
      this.metrics.recordCounter('debug_logger.context_popped', 1);
      this.metrics.recordGauge('debug_logger.context_depth', this.contextStack.length);
      
      if (this.config.trackDuration) {
        this.metrics.recordTimer('debug_logger.context_duration', duration, {
          context: context.path.join('.')
        });
      }
      
      return { ...context, duration };
    } catch (error) {
      this.metrics.recordCounter('debug_logger.context_error', 1);
      return null;
    }
  }
  
  /**
   * Get the current context
   */
  getCurrentContext(): LogContext | null {
    if (!this.config.enabled || this.contextStack.length === 0) return null;
    return { ...this.contextStack[this.contextStack.length - 1] };
  }
  
  /**
   * Get context usage statistics
   */
  getContextStats(): ContextStats {
    return {
      activeContexts: this.contextStack.length,
      contextCounts: { ...this.contextCounts },
      deepestContext: this.getDeepestContext(),
      currentPath: this.contextStack.length > 0
        ? this.contextStack[this.contextStack.length - 1].path.join('.')
        : ''
    };
  }
  
  /**
   * Get the deepest context path
   */
  private getDeepestContext(): string {
    let deepestPath = '';
    let maxDepth = 0;
    
    Object.keys(this.contextCounts).forEach(path => {
      const depth = path.split('.').length;
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestPath = path;
      }
    });
    
    return deepestPath;
  }
  
  /**
   * Clear context data
   */
  clear(): void {
    this.contextStack = [];
    this.contextCounts = {};
    this.metrics.recordCounter('debug_logger.context_cleared', 1);
  }
  
  /**
   * Get context for a log entry
   */
  getContextForLog(): LogContext | null {
    if (!this.config.enabled || this.contextStack.length === 0) return null;
    
    const context = this.contextStack[this.contextStack.length - 1];
    return {
      path: [...context.path],
      correlationId: context.correlationId,
      startTime: context.startTime,
      data: { ...context.data },
      parentId: context.parentId
    };
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.clear();
    return Promise.resolve();
  }
}

/**
 * PersistenceManager - Handles saving and loading logs
 */
class PersistenceManager implements Disposable {
  private storage: StorageProvider;
  private serializer: Serializer;
  private metrics: MetricsCollector;
  private config: Required<PersistenceManagerConfig>;
  private saveIntervalId: any = null;
  private exportCursor: number = 0;
  
  constructor(
    storageProvider: StorageProvider | null,
    serializer: Serializer | null,
    metrics: MetricsCollector | null,
    private scheduler: Scheduler,
    config: PersistenceManagerConfig = {}
  ) {
    this.storage = storageProvider || new InMemoryStorage();
    this.serializer = serializer || new DefaultSerializer();
    this.metrics = metrics || new NoopMetricsCollector();
    
    this.config = {
      enabled: config.enabled ?? false,
      autoSave: config.autoSave ?? false,
      saveInterval: config.saveInterval ?? 60000, // 1 minute
      keyPrefix: config.keyPrefix ?? 'debug_logger_',
      maxLogsToSave: config.maxLogsToSave ?? 1000,
      persistAnalytics: config.persistAnalytics ?? true,
      compressionEnabled: config.compressionEnabled ?? false,
      exportCursorEnabled: config.exportCursorEnabled ?? false
    };
    
    if (this.config.enabled && this.config.autoSave) {
      this.startAutoSave();
    }
  }
  
  /**
   * Start automatic saving
   */
  startAutoSave(): void {
    if (this.saveIntervalId) return;
    
    this.saveIntervalId = this.scheduler.setInterval(() => {
      this.save();
    }, this.config.saveInterval);
  }
  
  /**
   * Stop automatic saving
   */
  stopAutoSave(): void {
    if (this.saveIntervalId) {
      this.scheduler.clearInterval(this.saveIntervalId);
      this.saveIntervalId = null;
    }
  }
  
  /**
   * Save logs to storage
   */
  async save(logs?: LogEntry[], analytics?: any): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    try {
      // Save logs if provided
      if (logs) {
        // Limit the number of logs to save
        const logsToSave = logs.slice(-Math.min(logs.length, this.config.maxLogsToSave));
        
        try {
          const serialized = this.serializer.stringify(logsToSave);
          this.storage.setItem(`${this.config.keyPrefix}logs`, serialized);
          this.metrics.recordCounter('debug_logger.logs_saved', logsToSave.length);
        } catch (e) {
          // Handle quota exceeded or other storage errors
          if ((e as any).name === 'QuotaExceededError' || (e as any).code === 22) {
            // Try with fewer logs
            const halfLogs = logs.slice(-Math.floor(this.config.maxLogsToSave / 2));
            try {
              const reducedSerialized = this.serializer.stringify(halfLogs);
              this.storage.setItem(`${this.config.keyPrefix}logs`, reducedSerialized);
              this.metrics.recordCounter('debug_logger.logs_saved_reduced', halfLogs.length);
            } catch (innerError) {
              // If still fails, disable persistence to avoid repeated errors
              this.config.enabled = false;
              this.stopAutoSave();
              this.metrics.recordCounter('debug_logger.persistence_disabled', 1);
              return false;
            }
          } else {
            // Other errors
            this.metrics.recordCounter('debug_logger.save_error', 1);
            return false;
          }
        }
      }
      
      // Save analytics if provided and enabled
      if (analytics && this.config.persistAnalytics) {
        try {
          const serialized = this.serializer.stringify(analytics);
          this.storage.setItem(`${this.config.keyPrefix}analytics`, serialized);
          this.metrics.recordCounter('debug_logger.analytics_saved', 1);
        } catch (e) {
          // Analytics saving is non-critical, just log the error
          this.metrics.recordCounter('debug_logger.analytics_save_error', 1);
        }
      }
      
      // Update export cursor if enabled
      if (this.config.exportCursorEnabled && logs) {
        this.exportCursor = Date.now();
        this.storage.setItem(`${this.config.keyPrefix}export_cursor`, String(this.exportCursor));
      }
      
      return true;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.save_error', 1);
      return false;
    }
  }
  
  /**
   * Load logs from storage
   */
  async load(): Promise<{
    logs: LogEntry[],
    analytics: any,
    success: boolean
  }> {
    if (!this.config.enabled) {
      return { logs: [], analytics: null, success: false };
    }
    
    try {
      // Load logs
      let logs: LogEntry[] = [];
      try {
        const logsJson = this.storage.getItem(`${this.config.keyPrefix}logs`);
        if (logsJson) {
          logs = this.serializer.parse(logsJson);
          this.metrics.recordCounter('debug_logger.logs_loaded', logs.length);
        }
      } catch (e) {
        this.metrics.recordCounter('debug_logger.logs_load_error', 1);
      }
      
      // Load analytics
      let analytics = null;
      if (this.config.persistAnalytics) {
        try {
          const analyticsJson = this.storage.getItem(`${this.config.keyPrefix}analytics`);
          if (analyticsJson) {
            analytics = this.serializer.parse(analyticsJson);
            this.metrics.recordCounter('debug_logger.analytics_loaded', 1);
          }
        } catch (e) {
          this.metrics.recordCounter('debug_logger.analytics_load_error', 1);
        }
      }
      
      // Load export cursor if enabled
      if (this.config.exportCursorEnabled) {
        const cursorStr = this.storage.getItem(`${this.config.keyPrefix}export_cursor`);
        if (cursorStr) {
          this.exportCursor = parseInt(cursorStr, 10);
        }
      }
      
      return {
        logs,
        analytics,
        success: true
      };
    } catch (error) {
      this.metrics.recordCounter('debug_logger.load_error', 1);
      return {
        logs: [],
        analytics: null,
        success: false
      };
    }
  }
  
  /**
   * Clear stored data
   */
  clear(): boolean {
    if (!this.config.enabled) return false;
    
    try {
      this.storage.removeItem(`${this.config.keyPrefix}logs`);
      this.storage.removeItem(`${this.config.keyPrefix}analytics`);
      this.storage.removeItem(`${this.config.keyPrefix}export_cursor`);
      this.metrics.recordCounter('debug_logger.storage_cleared', 1);
      return true;
    } catch (error) {
      this.metrics.recordCounter('debug_logger.clear_error', 1);
      return false;
    }
  }
  
  /**
   * Get logs since last export
   */
  getLogsSinceLastExport(logs: LogEntry[]): LogEntry[] {
    if (!this.config.exportCursorEnabled || this.exportCursor === 0) {
      return logs;
    }
    
    return logs.filter(log => log.timestamp > this.exportCursor);
  }
  
  /**
   * Update export cursor
   */
  updateExportCursor(): void {
    if (!this.config.exportCursorEnabled) return;
    
    this.exportCursor = Date.now();
    
    if (this.config.enabled) {
      try {
        this.storage.setItem(`${this.config.keyPrefix}export_cursor`, String(this.exportCursor));
      } catch (e) {
        // Non-critical, just log the error
        this.metrics.recordCounter('debug_logger.export_cursor_error', 1);
      }
    }
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.stopAutoSave();
    return Promise.resolve();
  }
}

/**
 * AnalyticsManager - Tracks usage statistics and insights
 */
class AnalyticsManager implements Disposable {
  private tabUsage: Record<string, number> = {};
  private severityCounts: Record<string, number> = {};
  private errorHistogram: Record<string, number> = {};
  private errorCount: number = 0;
  private successCount: number = 0;
  private metrics: MetricsCollector;
  private config: Required<AnalyticsManagerConfig>;
  
  constructor(
    metrics: MetricsCollector | null,
    config: AnalyticsManagerConfig = {}
  ) {
    this.metrics = metrics || new NoopMetricsCollector();
    
    this.config = {
      enabled: config.enabled ?? true,
      trackErrorTypes: config.trackErrorTypes ?? true,
      maxTrackedErrorTypes: config.maxTrackedErrorTypes ?? 100,
      trackUserMetrics: config.trackUserMetrics ?? false
    };
    
    // Initialize tab usage tracking
    this.initializeTracking();
  }
  
  /**
   * Initialize tracking counters
   */
  private initializeTracking(): void {
    // Initialize tab usage tracking
    Object.values(Tab).forEach(tab => {
      this.tabUsage[tab] = 0;
    });
    
    // Initialize severity counts
    Object.values(Severity).forEach(severity => {
      this.severityCounts[severity] = 0;
    });
  }
  
  /**
   * Track a log entry
   */
  trackLog(log: LogEntry): void {
    if (!this.config.enabled) return;
    
    try {
      // Update tab usage
      this.tabUsage[log.tab] = (this.tabUsage[log.tab] || 0) + 1;
      
      // Update severity counts
      this.severityCounts[log.severity] = (this.severityCounts[log.severity] || 0) + 1;
      
      // Track error/success counts
      if (log.severity === Severity.Error || log.severity === Severity.Critical) {
        this.errorCount++;
        
        // Track error types if enabled
        if (this.config.trackErrorTypes) {
          const errorType = this.extractErrorType(log);
          
          // Limit number of tracked error types to prevent memory issues
          if (Object.keys(this.errorHistogram).length < this.config.maxTrackedErrorTypes || 
              errorType in this.errorHistogram) {
            this.errorHistogram[errorType] = (this.errorHistogram[errorType] || 0) + 1;
          }
        }
      } else if (log.severity === Severity.Success) {
        this.successCount++;
      }
      
      // Send metrics
      this.metrics.recordCounter('debug_logger.log_tracked', 1, {
        tab: String(log.tab),
        severity: String(log.severity)
      });
    } catch (error) {
      // Silently fail - analytics are non-critical
    }
  }
  
  /**
   * Extract error type from log entry for histogram
   */
  private extractErrorType(log: LogEntry): string {
    try {
      // Check if data contains error object
      if (log.data && typeof log.data === 'object') {
        if (log.data.error instanceof Error) {
          return log.data.error.name || 'Error';
        }
        
        if (log.data.error && typeof log.data.error === 'object' && log.data.error.name) {
          return log.data.error.name;
        }
        
        if (log.data.errorType) {
          return log.data.errorType;
        }
      }
      
      // Try to extract from message
      const errorMatch = log.message.match(/(\w+Error):|^(\w+Error)/);
      if (errorMatch) {
        return errorMatch[1] || errorMatch[2];
      }
      
      return 'UnknownError';
    } catch (e) {
      return 'ParseError';
    }
  }
  
  /**
   * Get analytics data
   */
  getAnalytics(): AnalyticItem[] {
    if (!this.config.enabled) return [];
    
    try {
      const analytics: AnalyticItem[] = [
        {
          category: 'tab_usage',
          title: 'Tab Usage Distribution',
          data: { ...this.tabUsage },
          total: Object.values(this.tabUsage).reduce((sum, count) => sum + count, 0)
        },
        {
          category: 'severity',
          title: 'Log Severity Distribution',
          data: { ...this.severityCounts },
          total: Object.values(this.severityCounts).reduce((sum, count) => sum + count, 0)
        }
      ];
      
      // Add error histogram if tracking is enabled
      if (this.config.trackErrorTypes && Object.keys(this.errorHistogram).length > 0) {
        analytics.push({
          category: 'errors',
          title: 'Error Type Distribution',
          data: { ...this.errorHistogram },
          total: Object.values(this.errorHistogram).reduce((sum, count) => sum + count, 0)
        });
      }
      
      // Add success/error ratio
      const totalOutcomes = this.errorCount + this.successCount;
      if (totalOutcomes > 0) {
        analytics.push({
          category: 'outcomes',
          title: 'Success vs Error Ratio',
          data: {
            success: this.successCount,
            error: this.errorCount,
            ratio: this.successCount / (totalOutcomes)
          },
          total: totalOutcomes
        });
      }
      
      return analytics;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Reset analytics data
   */
  reset(): void {
    this.initializeTracking();
    this.errorHistogram = {};
    this.errorCount = 0;
    this.successCount = 0;
    this.metrics.recordCounter('debug_logger.analytics_reset', 1);
  }
  
  /**
   * Get data for import
   */
  getDataForExport(): any {
    return {
      tabUsage: this.tabUsage,
      severityCounts: this.severityCounts,
      errorHistogram: this.errorHistogram,
      errorCount: this.errorCount,
      successCount: this.successCount
    };
  }
  
  /**
   * Import analytics data
   */
  importData(data: any): void {
    if (!data) return;
    
    try {
      if (data.tabUsage) this.tabUsage = data.tabUsage;
      if (data.severityCounts) this.severityCounts = data.severityCounts;
      if (data.errorHistogram) this.errorHistogram = data.errorHistogram;
      if (data.errorCount) this.errorCount = data.errorCount;
      if (data.successCount) this.successCount = data.successCount;
      
      this.metrics.recordCounter('debug_logger.analytics_imported', 1);
    } catch (e) {
      // Silently fail - analytics are non-critical
    }
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.reset();
    return Promise.resolve();
  }
}

/**
 * CoreLogger - The main logger class that orchestrates all components
 * 
 * @category Logging
 * @description Core logging system for enterprise applications
 */
class CoreLogger implements DebugLoggerInterface, Disposable {
  private logs: LogEntry[] = [];
  private subscribers: Map<string, () => void> = new Map();
  private debounceTimerId: any = null;
  
  // Component managers
  private indexManager: IndexManager;
  private batchProcessor: BatchProcessor;
  private rotationManager: RotationManager;
  private fixManager: FixSuggestionManager;
  private contextManager: ContextManager;
  private persistenceManager: PersistenceManager;
  private analyticsManager: AnalyticsManager;
  
  // Infrastructure
  private metrics: MetricsCollector;
  private scheduler: Scheduler;
  private serializer: Serializer;
  
  // Configuration
  private config: Required<CoreLoggerConfig>;
  
  /**
   * Create a new CoreLogger instance
   * @param config - Configuration options
   * @throws {Error} If the configuration is invalid
   */
  constructor(config: CoreLoggerConfig = {}) {
    // Set up infrastructure
    this.scheduler = config.scheduler || new BrowserScheduler();
    this.metrics = config.metrics || new NoopMetricsCollector();
    this.serializer = config.serializer || new DefaultSerializer();
    
    // Default configuration
    this.config = {
      maxLogs: config.maxLogs ?? 10000,
      minimumSeverity: config.minimumSeverity ?? Severity.Debug,
      notifyDebounceInterval: config.notifyDebounceInterval ?? 100,
      errorHandler: config.errorHandler ?? ((error: Error) => {
        console.error('DebugLogger internal error:', error);
      }),
      maxLogDataSize: config.maxLogDataSize ?? 100000,
      defaultTags: config.defaultTags ?? []
    };
    
    // Validate configuration
    ConfigValidator.validateCoreConfig(this.config);
    
    // Initialize components
    this.indexManager = new IndexManager(
      this.metrics,
      this.scheduler,
      config.indexConfig
    );
    
    this.fixManager = new FixSuggestionManager(
      this.metrics,
      config.fixConfig
    );
    
    this.contextManager = new ContextManager(
      this.metrics,
      config.contextConfig
    );
    
    this.rotationManager = new RotationManager(
      this.indexManager,
      this.metrics,
      config.rotationConfig
    );
    
    // Storage provider setup
    let storageProvider: StorageProvider | null = null;
    if (config.persistenceConfig?.enabled) {
      storageProvider = this.getStorageProvider(config.persistenceConfig.type);
    }
    
    this.persistenceManager = new PersistenceManager(
      storageProvider,
      this.serializer,
      this.metrics,
      this.scheduler,
      config.persistenceConfig
    );
    
    this.analyticsManager = new AnalyticsManager(
      this.metrics,
      config.analyticsConfig
    );
    
    this.batchProcessor = new BatchProcessor(
      this,
      this.indexManager,
      this.metrics,
      this.scheduler,
      config.batchConfig
    );
    
    // Initialize system monitoring
    MonitoringIntegration.integrate(this.metrics, this.scheduler);
    
    // Load data if persistence is enabled
    if (config.persistenceConfig?.enabled) {
      this.loadFromStorage();
    }
    
    // Log initialization
    this.logInternal(
      Tab.System,
      'DebugLogger initialized',
      { config: this.sanitizeConfig(config) },
      Severity.Info
    );
  }
  
  /**
   * Get appropriate storage provider
   */
  private getStorageProvider(type?: string): StorageProvider | null {
    if (typeof window === 'undefined') {
      return new InMemoryStorage();
    }
    
    if (type === 'localStorage' && window.localStorage) {
      return window.localStorage;
    }
    
    if (type === 'sessionStorage' && window.sessionStorage) {
      return window.sessionStorage;
    }
    
    return new InMemoryStorage();
  }
  
  /**
   * Sanitize configuration for logging
   */
  private sanitizeConfig(config: any): any {
    try {
      // Create a copy to avoid modifying original
      const sanitized = { ...config };
      
      // Remove functions (can't be serialized well)
      if (sanitized.errorHandler) {
        sanitized.errorHandler = '[Function]';
      }
      
      // Sanitize sensitive data
      return DataSanitizer.sanitize(sanitized);
    } catch (error) {
      return { sanitizationError: true };
    }
  }
  
  /**
   * Process a log entry directly
   * Used by batch processor
   */
  processLogEntry(log: LogEntry): void {
    // Add to main logs array
    this.logs.push(log);
    
    // Index the log
    this.indexManager.indexLog(log);
    
    // Track analytics
    this.analyticsManager.trackLog(log);
    
    // Emit log event
    LogEventBus.emit('log', log);
    
    // Auto-generate fixes for errors
    if (log.severity === Severity.Error || log.severity === Severity.Critical) {
      this.fixManager.generateFixesForLog(log);
    }
    
    // Check for rotation
    if (this.logs.length > this.config.maxLogs * 0.9) {
      this.rotationManager.checkRotation(this.logs)
        .then(newLogs => {
          this.logs = newLogs;
        })
        .catch(err => {
          this.handleError(err as Error, 'Error during log rotation');
        });
    }
  }
  
  /**
   * Internal log method (bypasses batching and other processing)
   */
  private logInternal(
    tab: Tab, 
    message: string, 
    data: any = {}, 
    severity: Severity = Severity.Info
  ): string {
    try {
      // Generate a unique ID
      const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the log entry
      const logEntry: LogEntry = {
        id,
        timestamp: Date.now(),
        tab,
        message,
        data,
        severity
      };
      
      // Process directly
      this.processLogEntry(logEntry);
      
      // Notify subscribers
      this.notifySubscribers();
      
      return id;
    } catch (error) {
      // Only use console as absolute last resort for internal logging
      console.error('Critical error in internal logger:', error);
      return '';
    }
  }
  
  /**
   * Public logging method
   */
  log(tab: Tab | string, message: string, data: any = {}, severity: Severity | string = Severity.Info): string {
    try {
      // Input validation
      if (!message) {
        message = 'No message provided';
      }
      
      // Validate tab
      let validTab: Tab;
      if (typeof tab === 'string' && !(tab in Tab)) {
        // Use an "unknown" tab category
        validTab = Tab.Unknown;
      } else {
        validTab = tab as Tab;
      }
      
      // Validate severity
      let validSeverity: Severity;
      if (typeof severity === 'string' && !(severity in Severity)) {
        validSeverity = Severity.Info;
      } else {
        validSeverity = severity as Severity;
      }
      
      // Check minimum severity threshold
      if (validSeverity < this.config.minimumSeverity) {
        return ''; // Skip logs below minimum severity
      }
      
      // Sanitize any sensitive data
      const sanitizedData = DataSanitizer.sanitize(data);
      
      // Limit data size if needed
      let processedData = sanitizedData;
      if (sanitizedData && typeof sanitizedData === 'object') {
        try {
          const dataString = this.serializer.stringify(sanitizedData);
          if (dataString.length > this.config.maxLogDataSize) {
            // Truncate data
            processedData = {
              _truncated: true,
              _originalSize: dataString.length,
              _sample: '(Data too large, truncated)',
              _timestamp: Date.now()
            };
          }
        } catch (e) {
          // If stringify fails, replace with error info
          processedData = {
            _error: 'Failed to process data object',
            _errorMessage: ErrorHandler.sanitizeError(e)
          };
        }
      }
      
      // Generate a unique ID
      const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add context info if tracking enabled
      let context = this.contextManager.getContextForLog();
      
      // Add default tags if configured
      let tags = [...this.config.defaultTags];
      
      // Create the log entry
      const logEntry: LogEntry = {
        id,
        timestamp: Date.now(),
        tab: validTab,
        message,
        data: processedData,
        severity: validSeverity,
        context,
        tags
      };
      
      // Add to batch processor
      this.batchProcessor.addLog(logEntry);
      
      return id;
    } catch (error) {
      this.handleError(error as Error, 'Error logging message');
      return '';
    }
  }
  
  /**
   * Handle errors in the logger itself
   */
  private handleError(error: Error, context: string): void {
    try {
      // Avoid recursive error handling
      if (context === 'Error in error handler') {
        console.error('Critical error in DebugLogger:', error);
        return;
      }
      
      // Emit error event
      LogEventBus.emit('error', ErrorHandler.createErrorMetadata(error, context));
      
      // Call custom error handler if provided
      if (this.config.errorHandler) {
        try {
          this.config.errorHandler(error);
        } catch (handlerError) {
          console.error('Error in DebugLogger error handler:', handlerError);
        }
      }
      
      // Log the error internally
      this.logInternal(
        Tab.System,
        `Internal error: ${context}`,
        ErrorHandler.createErrorMetadata(error, context),
        Severity.Error
      );
      
      // Send metric
      this.metrics.recordCounter('debug_logger.internal_error', 1, {
        context: context.replace(/\s+/g, '_').toLowerCase()
      });
    } catch (e) {
      // Last resort - if everything fails, just log to console
      console.error('Critical error in DebugLogger error handler:', e);
      console.error('Original error:', error);
    }
  }
  
  /**
   * Add a fix suggestion
   */
  addFix(
    issue: string, 
    description: string, 
    suggestion: string, 
    fixFunction: Function | string | null = null, 
    severity: Severity | string = Severity.Warn
  ): string {
    try {
      // Validate severity
      let validSeverity: Severity;
      if (typeof severity === 'string' && !(severity in Severity)) {
        validSeverity = Severity.Warn;
      } else {
        validSeverity = severity as Severity;
      }
      
      return this.fixManager.addFix(issue, description, suggestion, fixFunction, validSeverity);
    } catch (error) {
      this.handleError(error as Error, 'Error adding fix suggestion');
      return '';
    }
  }
  
  /**
   * Dismiss a fix suggestion
   */
  dismissFix(fixId: string): void {
    try {
      this.fixManager.dismissFix(fixId);
      this.notifySubscribers();
    } catch (error) {
      this.handleError(error as Error, 'Error dismissing fix');
    }
  }
  
  /**
   * Apply a fix
   */
  async applyFix(fixId: string): Promise<boolean> {
    try {
      const result = await this.fixManager.applyFix(fixId);
      this.notifySubscribers();
      return result;
    } catch (error) {
      this.handleError(error as Error, 'Error applying fix');
      return false;
    }
  }
  
  /**
   * Register a custom fix rule
   */
  registerFixRule(rule: FixRule): void {
    try {
      this.fixManager.registerFixRule(rule);
    } catch (error) {
      this.handleError(error as Error, 'Error registering fix rule');
    }
  }
  
  /**
   * Clear all logs
   */
  clearLogs(): void {
    try {
      // Store count for logging
      const logCount = this.logs.length;
      const rotationStats = this.rotationManager.getStats();
      
      // Clear logs
      this.logs = [];
      
      // Clear indices
      this.indexManager.clear();
      
      // Clear rotated logs
      this.rotationManager.clear();
      
      // Reset analytics
      this.analyticsManager.reset();
      
      // Log the clearance itself
      this.logInternal(
        Tab.System,
        'Logs cleared',
        { 
          clearedCount: logCount,
          rotatedCount: rotationStats.totalRotatedLogs,
          timestamp: Date.now()
        },
        Severity.Info
      );
      
      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      this.handleError(error as Error, 'Error clearing logs');
    }
  }
  
  /**
   * Clear all fixes
   */
  clearFixes(): void {
    try {
      this.fixManager.clear();
      this.notifySubscribers();
    } catch (error) {
      this.handleError(error as Error, 'Error clearing fixes');
    }
  }
  
  /**
   * Push a new context
   */
  pushContext(name: string, data: Record<string, any> = {}): string {
    try {
      const contextId = this.contextManager.pushContext(name, data);
      return contextId;
    } catch (error) {
      this.handleError(error as Error, 'Error pushing context');
      return '';
    }
  }
  
  /**
   * Pop the current context
   */
  popContext(): void {
    try {
      this.contextManager.popContext();
    } catch (error) {
      this.handleError(error as Error, 'Error popping context');
    }
  }
  
  /**
   * Get the current context
   */
  getCurrentContext(): { path: string[], correlationId: string } | null {
    try {
      const context = this.contextManager.getCurrentContext();
      if (!context) return null;
      
      return {
        path: context.path,
        correlationId: context.correlationId
      };
    } catch (error) {
      this.handleError(error as Error, 'Error getting current context');
      return null;
    }
  }
  
  /**
   * Get all logs (paginated)
   */
  getLogs(options: {
    limit?: number;
    offset?: number;
    includeRotated?: boolean;
  } = {}): LogEntry[] {
    try {
      let allLogs: LogEntry[] = [...this.logs];
      
      // Include rotated logs if requested
      if (options.includeRotated) {
        // Note: This is now async, but we keep the sync API for compatibility
        // In a real implementation, we would update the interface to be async
        this.rotationManager.getAllLogs(allLogs)
          .then(logs => {
            allLogs = logs;
          })
          .catch(err => {
            this.handleError(err as Error, 'Error getting rotated logs');
          });
      }
      
      // Apply pagination
      if (options.offset !== undefined || options.limit !== undefined) {
        const offset = options.offset || 0;
        const limit = options.limit || allLogs.length;
        
        return allLogs.slice(offset, offset + limit);
      }
      
      return allLogs;
    } catch (error) {
      this.handleError(error as Error, 'Error getting logs');
      return [];
    }
  }
  
  /**
   * Get all fix suggestions
   */
  getFixes(): FixSuggestion[] {
    try {
      return this.fixManager.getFixes();
    } catch (error) {
      this.handleError(error as Error, 'Error getting fixes');
      return [];
    }
  }
  
  /**
   * Get analytics data
   */
  getAnalytics(): AnalyticItem[] {
    try {
      return this.analyticsManager.getAnalytics();
    } catch (error) {
      this.handleError(error as Error, 'Error getting analytics');
      return [];
    }
  }
  
  /**
   * Get logs filtered by severity
   */
  getLogsBySeverity(severity: Severity | string): LogEntry[] {
    try {
      // Validate severity
      let validSeverity: Severity;
      if (typeof severity === 'string' && !(severity in Severity)) {
        validSeverity = Severity.Info;
      } else {
        validSeverity = severity as Severity;
      }
      
      return this.logs.filter(log => log.severity === validSeverity);
    } catch (error) {
      this.handleError(error as Error, 'Error getting logs by severity');
      return [];
    }
  }
  
  /**
   * Get logs filtered by tab
   */
  getLogsByTab(tab: Tab | string): LogEntry[] {
    try {
      // Validate tab
      let validTab: Tab;
      if (typeof tab === 'string' && !(tab in Tab)) {
        validTab = Tab.Unknown;
      } else {
        validTab = tab as Tab;
      }
      
      return this.logs.filter(log => log.tab === validTab);
    } catch (error) {
      this.handleError(error as Error, 'Error getting logs by tab');
      return [];
    }
  }
  
  /**
   * Search logs by text content with advanced options
   */
  searchLogs(options: {
    query: string;
    tabs?: Tab[];
    severities?: Severity[];
    timeRange?: { start: number; end: number };
    includeRotated?: boolean;
    limit?: number;
    useIndex?: boolean;
    advanced?: AdvancedSearchOptions;
  }): LogEntry[] {
    try {
      const startTime = performance.now();
      const query = options.query;
      let results: LogEntry[] = [];
      
      // Use indexed search if requested and available
      if (options.useIndex !== false && query.length > 2) {
        // Get matching log IDs from index
        const matchingLogIds = this.indexManager.search(query, options.advanced);
        
        if (matchingLogIds.size > 0) {
          // First get logs from current set
          for (const log of this.logs) {
            if (matchingLogIds.has(log.id) && this.matchesFilters(log, options)) {
              results.push(log);
            }
          }
          
          // Include rotated logs if requested
          if (options.includeRotated) {
            // In a real implementation, this would be async
            this.rotationManager.getAllLogs([])
              .then(allLogs => {
                for (const log of allLogs) {
                  if (matchingLogIds.has(log.id) && this.matchesFilters(log, options)) {
                    results.push(log);
                  }
                }
              })
              .catch(err => {
                this.handleError(err as Error, 'Error retrieving rotated logs');
              });
          }
        }
      } else {
        // Fall back to direct search (less efficient but more thorough)
        // First get all logs that match filters
        let filteredLogs = this.logs.filter(log => this.matchesFilters(log, options));
        
        // Include rotated logs if requested
        if (options.includeRotated) {
          // In a real implementation, this would be async
          this.rotationManager.getAllLogs([])
            .then(allLogs => {
              const filteredRotated = allLogs.filter(log => this.matchesFilters(log, options));
              filteredLogs = [...filteredLogs, ...filteredRotated];
            })
            .catch(err => {
              this.handleError(err as Error, 'Error retrieving rotated logs');
            });
        }
        
        // Handle regex search
        if (options.advanced?.regex) {
          try {
            const regex = new RegExp(query, options.advanced.caseSensitive ? '' : 'i');
            results = filteredLogs.filter(log => {
              if (regex.test(log.message)) return true;
              
              try {
                const dataString = this.serializer.stringify(log.data);
                return regex.test(dataString);
              } catch (e) {
                return false;
              }
            });
          } catch (e) {
            // Invalid regex, fall back to normal search
            results = this.performBasicSearch(filteredLogs, query, options.advanced);
          }
        } 
        // Handle fuzzy search
        else if (options.advanced?.fuzzy) {
          results = filteredLogs.filter(log => 
            FuzzySearchEngine.matchLog(log, query)
          );
        }
        // Default basic search
        else {
          results = this.performBasicSearch(filteredLogs, query, options.advanced);
        }
      }
      
      // Apply limit if specified
      if (options.limit && options.limit > 0 && results.length > options.limit) {
        results = results.slice(0, options.limit);
      }
      
      // Record search performance
      const searchTime = performance.now() - startTime;
      this.metrics.recordTimer('debug_logger.search_time', searchTime);
      this.metrics.recordHistogram('debug_logger.search_results', results.length);
      
      return results;
    } catch (error) {
      this.handleError(error as Error, 'Error searching logs');
      return [];
    }
  }
  
  /**
   * Perform basic text search on logs
   */
  private performBasicSearch(logs: LogEntry[], query: string, options?: AdvancedSearchOptions): LogEntry[] {
    const searchQuery = options?.caseSensitive ? query : query.toLowerCase();
    
    return logs.filter(log => {
      const message = options?.caseSensitive ? log.message : log.message.toLowerCase();
      if (message.includes(searchQuery)) {
        return true;
      }
      
      try {
        const dataString = this.serializer.stringify(log.data);
        const dataContent = options?.caseSensitive ? dataString : dataString.toLowerCase();
        return dataContent.includes(searchQuery);
      } catch (e) {
        return false;
      }
    });
  }
  
  /**
   * Check if a log matches the specified filters
   */
  private matchesFilters(log: LogEntry, options: {
    tabs?: Tab[];
    severities?: Severity[];
    timeRange?: { start: number; end: number };
  }): boolean {
    // Filter by tabs
    if (options.tabs && options.tabs.length > 0) {
      if (!options.tabs.includes(log.tab as Tab)) {
        return false;
      }
    }
    
    // Filter by severities
    if (options.severities && options.severities.length > 0) {
      if (!options.severities.includes(log.severity as Severity)) {
        return false;
      }
    }
    
    // Filter by time range
    if (options.timeRange) {
      if (log.timestamp < options.timeRange.start || log.timestamp > options.timeRange.end) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Subscribe to logger updates with debouncing
   */
  subscribe(callback: () => void): () => void {
    try {
      // Generate an ID for this subscription
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to subscribers
      this.subscribers.set(subscriptionId, callback);
      
      // Record subscriber count
      this.metrics.recordGauge('debug_logger.subscribers', this.subscribers.size);
      
      // Return unsubscribe function
      return () => {
        this.subscribers.delete(subscriptionId);
        this.metrics.recordGauge('debug_logger.subscribers', this.subscribers.size);
      };
    } catch (error) {
      this.handleError(error as Error, 'Error in subscription');
      
      // Return a no-op unsubscribe function
      return () => {};
    }
  }
  
  /**
   * Notify all subscribers of changes with debouncing
   */
  private notifySubscribers(): void {
    try {
      // Cancel existing notification timeout
      if (this.debounceTimerId) {
        this.scheduler.clearTimeout(this.debounceTimerId);
      }
      
      // Set new timeout
      this.debounceTimerId = this.scheduler.setTimeout(() => {
        // Record notification
        this.metrics.recordCounter('debug_logger.subscriber_notification', 1);
        
        // Call each subscriber with error isolation
        const errors: Error[] = [];
        
        this.subscribers.forEach(callback => {
          try {
            callback();
          } catch (e) {
            // Collect errors but don't let them affect other subscribers
            errors.push(e as Error);
          }
        });
        
        // Handle any errors after all subscribers were notified
        if (errors.length > 0) {
          this.handleError(
            new AggregateError(errors, `${errors.length} subscriber callback errors`),
            'Error in subscriber callbacks'
          );
        }
      }, this.config.notifyDebounceInterval);
    } catch (error) {
      this.handleError(error as Error, 'Error notifying subscribers');
    }
  }
  
  /**
   * Export logs to JSON
   */
  exportLogsToJson(options: {
    includeRotated?: boolean;
    pretty?: boolean;
    download?: boolean;
    filename?: string;
  } = {}): string {
    try {
      let logsToExport = [...this.logs];
      
      // Include rotated logs if requested
      if (options.includeRotated) {
        // In a real implementation, this would be async
        this.rotationManager.getAllLogs(logsToExport)
          .then(allLogs => {
            logsToExport = allLogs;
          })
          .catch(err => {
            this.handleError(err as Error, 'Error retrieving rotated logs for export');
          });
      }
      
      // Convert to JSON
      const jsonOutput = this.serializer.stringify(logsToExport, options.pretty ? 2 : 0);
      
      // Trigger download if requested (browser only)
      if (options.download && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const filename = options.filename || `debug_logs_${new Date().toISOString()}.json`;
        const blob = new Blob([jsonOutput], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Record export
      this.metrics.recordCounter('debug_logger.logs_exported', logsToExport.length, {
        format: 'json'
      });
      
      // Update export cursor if differential exports enabled
      if (this.persistenceManager) {
        this.persistenceManager.updateExportCursor();
      }
      
      return jsonOutput;
    } catch (error) {
      this.handleError(error as Error, 'Error exporting logs to JSON');
      return '{"error": "Failed to export logs"}';
    }
  }
  
  /**
   * Get logs that were added since the last export
   */
  getNewLogsSinceLastExport(): LogEntry[] {
    try {
      return this.persistenceManager.getLogsSinceLastExport(this.logs);
    } catch (error) {
      this.handleError(error as Error, 'Error getting logs since last export');
      return [];
    }
  }
  
  /**
   * Load logs from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const result = await this.persistenceManager.load();
      
      if (result.success && result.logs) {
        // Find available space
        const availableSpace = this.config.maxLogs - this.logs.length;
        if (availableSpace > 0) {
          // Add most recent logs up to available space
          const logsToAdd = result.logs.slice(-availableSpace);
          
          // Add to existing logs
          this.logs.push(...logsToAdd);
          
          // Index the logs
          for (const log of logsToAdd) {
            this.indexManager.indexLog(log);
          }
          
          // Log success
          this.logInternal(
            Tab.System,
            'Loaded logs from storage',
            { count: logsToAdd.length },
            Severity.Info
          );
        }
      }
      
      // Import analytics if available
      if (result.success && result.analytics) {
        this.analyticsManager.importData(result.analytics);
        
        this.logInternal(
          Tab.System,
          'Loaded analytics from storage',
          { analytics: result.analytics },
          Severity.Info
        );
      }
    } catch (error) {
      this.handleError(error as Error, 'Failed to load from storage');
    }
  }
  
  /**
   * Save current state to storage
   */
  async saveToStorage(): Promise<boolean> {
    try {
      return await this.persistenceManager.save(
        this.logs,
        this.analyticsManager.getDataForExport()
      );
    } catch (error) {
      this.handleError(error as Error, 'Error saving to storage');
      return false;
    }
  }
  
  /**
   * Get system health report
   */
  getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, any>;
    issues: Array<{
      name: string;
      description: string;
      severity: Severity;
    }>;
    recommendations: string[];
  } {
    try {
      const issues: Array<{
        name: string;
        description: string;
        severity: Severity;
      }> = [];
      
      const recommendations: string[] = [];
      
      // Get last hour of logs
      const hourAgo = Date.now() - 60 * 60 * 1000;
      const recentLogs = this.logs.filter(log => log.timestamp >= hourAgo);
      
      // Count by severity
      const recentSeverityCounts: Record<Severity, number> = {
        [Severity.Debug]: 0,
        [Severity.Info]: 0,
        [Severity.Success]: 0,
        [Severity.Warn]: 0,
        [Severity.Error]: 0,
        [Severity.Critical]: 0
      };
      
      recentLogs.forEach(log => {
        recentSeverityCounts[log.severity as Severity] = 
          (recentSeverityCounts[log.severity as Severity] || 0) + 1;
      });
      
      // Check component health
      const indexStats = this.indexManager.getStats();
      const rotationStats = this.rotationManager.getStats();
      const contextStats = this.contextManager.getContextStats();
      
      // Key metrics
      const metrics = {
        totalLogs: this.logs.length,
        totalErrors: recentSeverityCounts[Severity.Error] + recentSeverityCounts[Severity.Critical],
        recentErrors: recentSeverityCounts[Severity.Error] + recentSeverityCounts[Severity.Critical],
        recentWarnings: recentSeverityCounts[Severity.Warn],
        errorRate: recentLogs.length > 0 
          ? (recentSeverityCounts[Severity.Error] + recentSeverityCounts[Severity.Critical]) / recentLogs.length
          : 0,
        activeContexts: contextStats.activeContexts,
        fixes: this.fixManager.getFixes().length,
        rotatedLogs: rotationStats.totalRotatedLogs,
        subscribers: this.subscribers.size,
        indexSize: indexStats.totalIndexedTokens,
        memoryUsage: {
          index: indexStats.memoryUsageEstimate,
          rotated: rotationStats.estimatedMemoryUsage
        }
      };
      
      // Check for issues
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      // High error rate
      if (metrics.errorRate > 0.2) {
        status = 'critical';
        issues.push({
          name: 'High Error Rate',
          description: `Error rate of ${(metrics.errorRate * 100).toFixed(1)}% in the last hour is concerning.`,
          severity: Severity.Error
        });
        recommendations.push('Investigate recent errors and fix root causes');
      } else if (metrics.errorRate > 0.05) {
        status = 'warning';
        issues.push({
          name: 'Elevated Error Rate',
          description: `Error rate of ${(metrics.errorRate * 100).toFixed(1)}% in the last hour is above optimal.`,
          severity: Severity.Warn
        });
        recommendations.push('Monitor error trends and investigate if they increase');
      }
      
      // Context stack depth
      if (contextStats.activeContexts > 10) {
        issues.push({
          name: 'Deep Context Stack',
          description: `${contextStats.activeContexts} active contexts may indicate unclosed contexts.`,
          severity: Severity.Warn
        });
        recommendations.push('Check for unbalanced pushContext/popContext calls');
      }
      
      // Near capacity
      if (this.logs.length > this.config.maxLogs * 0.9) {
        issues.push({
          name: 'Log Storage Nearly Full',
          description: `${this.logs.length}/${this.config.maxLogs} logs stored (${Math.round(this.logs.length / this.config.maxLogs * 100)}%).`,
          severity: Severity.Warn
        });
        recommendations.push('Increase maxLogs setting or export and clear logs');
      }
      
      return {
        status,
        metrics,
        issues,
        recommendations: [...new Set(recommendations)] // Unique recommendations
      };
    } catch (error) {
      this.handleError(error as Error, 'Error generating health report');
      return {
        status: 'critical',
        metrics: { error: 'Failed to calculate metrics' },
        issues: [{
          name: 'Health Report Error',
          description: `Failed to generate health report: ${(error as Error).message}`,
          severity: Severity.Error
        }],
        recommendations: ['Reset the logger or contact support']
      };
    }
  }
  
  /**
   * Register custom serializer for specific data types
   */
  registerSerializer(serializer: CustomSerializer): void {
    try {
      if (this.serializer instanceof DefaultSerializer) {
        (this.serializer as DefaultSerializer).registerCustomSerializer(serializer);
      }
    } catch (error) {
      this.handleError(error as Error, 'Error registering serializer');
    }
  }
  
  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    try {
      // Stop all activities first
      if (this.debounceTimerId) {
        this.scheduler.clearTimeout(this.debounceTimerId);
        this.debounceTimerId = null;
      }
      
      // Save logs if persistence is enabled
      if (this.persistenceManager && this.config.persistenceConfig?.enabled) {
        await this.saveToStorage();
      }
      
      // Clear event listeners
      LogEventBus.clear();
      
      // Stop monitoring
      MonitoringIntegration.stopIntegration(this.scheduler);
      
      // Dispose all components
      await Promise.all([
        this.batchProcessor.dispose(),
        this.indexManager.dispose(),
        this.rotationManager.dispose(),
        this.fixManager.dispose(),
        this.contextManager.dispose(),
        this.persistenceManager.dispose(),
        this.analyticsManager.dispose()
      ]);
      
      // Clear all data
      this.logs = [];
      this.subscribers.clear();
      
      return Promise.resolve();
    } catch (error) {
      this.handleError(error as Error, 'Error during logger disposal');
      return Promise.reject(error);
    }
  }
}

/**
 * DefaultDebugLogger - Singleton implementation of the logger
 */
export class DebugLogger implements DebugLoggerInterface, Disposable {
  private static instance: DebugLogger | null = null;
  private static instanceLock: boolean = false;
  private coreLogger: CoreLogger;
  
  /**
   * Get the singleton instance
   * @param config - Configuration options for the logger
   * @returns The singleton logger instance
   */
  static getInstance(config?: CoreLoggerConfig): DebugLogger {
    if (!DebugLogger.instance) {
      // Thread-safety check with double-checked locking pattern
      if (!DebugLogger.instanceLock) {
        DebugLogger.instanceLock = true;
        try {
          DebugLogger.instance = new DebugLogger(config);
        } finally {
          DebugLogger.instanceLock = false;
        }
      } else {
        // Wait for instance creation
        while (!DebugLogger.instance) {
          // Tiny delay for thread safety
          if (typeof setTimeout !== 'undefined') {
            setTimeout(() => {}, 1);
          }
        }
      }
    } else if (config) {
      // Update configuration on existing instance by creating a new CoreLogger
      DebugLogger.instance.coreLogger = new CoreLogger(config);
    }
    
    return DebugLogger.instance;
  }
  
  /**
   * Reset the singleton for testing
   * @internal
   */
  static resetForTesting(): void {
    if (DebugLogger.instance) {
      DebugLogger.instance.dispose()
        .catch(e => console.error('Error disposing logger:', e));
      DebugLogger.instance = null;
    }
  }
  
  /**
   * Private constructor - use getInstance instead
   */
  private constructor(config?: CoreLoggerConfig) {
    // Initialize the core logger
    this.coreLogger = new CoreLogger(config);
    
    // Freeze the instance (immutability)
    Object.freeze(this);
  }
  
  // Delegate all methods to the core logger
  log(tab: Tab | string, message: string, data?: any, severity?: Severity | string): string {
    return this.coreLogger.log(tab, message, data, severity);
  }
  
  addFix(issue: string, description: string, suggestion: string, fixFunction?: any, severity?: Severity | string): string {
    return this.coreLogger.addFix(issue, description, suggestion, fixFunction, severity);
  }
  
  dismissFix(fixId: string): void {
    this.coreLogger.dismissFix(fixId);
  }
  
  clearLogs(): void {
    this.coreLogger.clearLogs();
  }
  
  getLogs(options?: { limit?: number; offset?: number; includeRotated?: boolean }): LogEntry[] {
    return this.coreLogger.getLogs(options);
  }
  
  getFixes(): FixSuggestion[] {
    return this.coreLogger.getFixes();
  }
  
  getAnalytics(): AnalyticItem[] {
    return this.coreLogger.getAnalytics();
  }
  
  getLogsBySeverity(severity: Severity | string): LogEntry[] {
    return this.coreLogger.getLogsBySeverity(severity);
  }
  
  getLogsByTab(tab: Tab | string): LogEntry[] {
    return this.coreLogger.getLogsByTab(tab);
  }
  
  searchLogs(options: { query: string; advanced?: AdvancedSearchOptions; [key: string]: any }): LogEntry[] {
    return this.coreLogger.searchLogs(options);
  }
  
  subscribe(callback: () => void): () => void {
    return this.coreLogger.subscribe(callback);
  }
  
  // Additional public methods that expose new functionality
  
  /**
   * Push a new context
   */
  pushContext(name: string, data?: Record<string, any>): string {
    return this.coreLogger.pushContext(name, data);
  }
  
  /**
   * Pop the current context
   */
  popContext(): void {
    this.coreLogger.popContext();
  }
  
  /**
   * Get current context
   */
  getCurrentContext(): { path: string[], correlationId: string } | null {
    return this.coreLogger.getCurrentContext();
  }
  
  /**
   * Export logs to JSON
   */
  exportLogsToJson(options?: { 
    includeRotated?: boolean; 
    pretty?: boolean; 
    download?: boolean;
    filename?: string;
  }): string {
    return this.coreLogger.exportLogsToJson(options);
  }
  
  /**
   * Apply a fix
   */
  applyFix(fixId: string): Promise<boolean> {
    return this.coreLogger.applyFix(fixId);
  }
  
  /**
   * Get logs added since last export 
   */
  getNewLogsSinceLastExport(): LogEntry[] {
    return this.coreLogger.getNewLogsSinceLastExport();
  }
  
  /**
   * Register a custom fix rule
   */
  registerFixRule(rule: FixRule): void {
    this.coreLogger.registerFixRule(rule);
  }
  
  /**
   * Get system health report
   */
  getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, any>;
    issues: Array<{
      name: string;
      description: string;
      severity: Severity;
    }>;
    recommendations: string[];
  } {
    return this.coreLogger.getHealthReport();
  }
  
  /**
   * Save current state to storage
   */
  saveToStorage(): Promise<boolean> {
    return this.coreLogger.saveToStorage();
  }
  
  /**
   * Register custom serializer for specific data types
   */
  registerSerializer(serializer: CustomSerializer): void {
    this.coreLogger.registerSerializer(serializer);
  }
  
  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    return this.coreLogger.dispose();
  }
}

// Support classes

/**
 * Browser scheduler implementation
 */
class BrowserScheduler implements Scheduler {
  setTimeout(callback: () => void, ms: number): any {
    return setTimeout(callback, ms);
  }
  
  clearTimeout(id: any): void {
    clearTimeout(id);
  }
  
  setInterval(callback: () => void, ms: number): any {
    return setInterval(callback, ms);
  }
  
  clearInterval(id: any): void {
    clearInterval(id);
  }
  
  requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): any {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, options);
    }
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50
      });
    }, options?.timeout || 50);
  }
  
  cancelIdleCallback(id: any): void {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  }
}

/**
 * No-op metrics collector implementation
 */
class NoopMetricsCollector implements MetricsCollector {
  recordCounter(_name: string, _value: number, _tags?: Record<string, string>): void {}
  recordGauge(_name: string, _value: number, _tags?: Record<string, string>): void {}
  recordHistogram(_name: string, _value: number, _tags?: Record<string, string>): void {}
  recordTimer(_name: string, _valueMs: number, _tags?: Record<string, string>): void {}
}

/**
 * In-memory storage provider
 */
class InMemoryStorage implements StorageProvider {
  private storage: Record<string, string> = {};
  
  getItem(key: string): string | null {
    return this.storage[key] || null;
  }
  
  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }
  
  removeItem(key: string): void {
    delete this.storage[key];
  }
  
  clear(): void {
    this.storage = {};
  }
  
  get length(): number {
    return Object.keys(this.storage).length;
  }
  
  key(index: number): string | null {
    const keys = Object.keys(this.storage);
    return index < keys.length ? keys[index] : null;
  }
}

/**
 * Default serializer implementation with enhanced type safety
 */
class DefaultSerializer implements Serializer {
  private customSerializers: CustomSerializer[] = [];
  
  stringify<T>(value: T, space: number = 0): string {
    try {
      return JSON.stringify(value, this.replacer.bind(this), space);
    } catch (error) {
      // Handle circular references
      const seen = new WeakSet();
      return JSON.stringify(value, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      }, space);
    }
  }
  
  parse<T = unknown>(text: string): T {
    return JSON.parse(text) as T;
  }
  
  canSerialize(value: unknown): boolean {
    try {
      JSON.stringify(value);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  registerCustomSerializer(serializer: CustomSerializer): void {
    this.customSerializers.push(serializer);
  }
  
  private replacer(key: string, value: any): any {
    // Try custom serializers first
    for (const serializer of this.customSerializers) {
      if (serializer.canSerialize(value)) {
        return serializer.serialize(value);
      }
    }
    
    // Handle special types
    if (value instanceof Error) {
      return ErrorHandler.sanitizeError(value);
    }
    
    if (value instanceof Map) {
      return {
        _type: 'Map',
        entries: Array.from(value.entries())
      };
    }
    
    if (value instanceof Set) {
      return {
        _type: 'Set',
        values: Array.from(value.values())
      };
    }
    
    if (value instanceof Date) {
      return {
        _type: 'Date',
        iso: value.toISOString(),
        timestamp: value.getTime()
      };
    }
    
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    
    if (value instanceof RegExp) {
      return {
        _type: 'RegExp',
        source: value.source,
        flags: value.flags
      };
    }
    
    if (typeof value === 'bigint') {
      return {
        _type: 'BigInt',
        value: value.toString()
      };
    }
    
    if (typeof value === 'symbol') {
      return {
        _type: 'Symbol',
        description: value.description
      };
    }
    
    if (ArrayBuffer.isView(value)) {
      return {
        _type: 'TypedArray',
        name: Object.prototype.toString.call(value).slice(8, -1),
        length: value.length,
        preview: Array.from(value.slice(0, 10))
      };
    }
    
    return value;
  }
}

// Type definitions

export interface BatchProcessorConfig {
  enabled?: boolean;
  flushInterval?: number;
  maxBatchSize?: number;
  useIdleCallback?: boolean;
  prioritySeverities?: Severity[];
  adaptiveInterval?: boolean;
  minFlushInterval?: number;
  maxFlushInterval?: number;
}

export interface IndexManagerConfig {
  maxIndexedTokenLength?: number;
  minTokenLength?: number;
  maxSearchDepth?: number;
  useWorkers?: boolean;
  maxIndexingBatchSize?: number;
  useIdleProcessing?: boolean;
}

export interface RotationManagerConfig {
  enabled?: boolean;
  rotationThreshold?: number;
  maxRotations?: number;
  rotationPercentage?: number;
  compressRotatedLogs?: boolean;
}

export interface FixSuggestionManagerConfig {
  maxFixes?: number;
  enableAutoFixes?: boolean;
  groupSimilarFixes?: boolean;
  similarityThreshold?: number;
}

export interface ContextManagerConfig {
  enabled?: boolean;
  maxContextDepth?: number;
  trackDuration?: boolean;
  trackMetrics?: boolean;
}

export interface PersistenceManagerConfig {
  enabled?: boolean;
  autoSave?: boolean;
  saveInterval?: number;
  keyPrefix?: string;
  maxLogsToSave?: number;
  persistAnalytics?: boolean;
  compressionEnabled?: boolean;
  exportCursorEnabled?: boolean;
  type?: string;
}

export interface AnalyticsManagerConfig {
  enabled?: boolean;
  trackErrorTypes?: boolean;
  maxTrackedErrorTypes?: number;
  trackUserMetrics?: boolean;
}

export interface CoreLoggerConfig {
  maxLogs?: number;
  minimumSeverity?: Severity;
  notifyDebounceInterval?: number;
  errorHandler?: (error: Error) => void;
  maxLogDataSize?: number;
  defaultTags?: string[];
  scheduler?: Scheduler;
  metrics?: MetricsCollector;
  serializer?: Serializer;
  indexConfig?: IndexManagerConfig;
  batchConfig?: BatchProcessorConfig;
  rotationConfig?: RotationManagerConfig;
  fixConfig?: FixSuggestionManagerConfig;
  contextConfig?: ContextManagerConfig;
  persistenceConfig?: PersistenceManagerConfig & { type?: string };
  analyticsConfig?: AnalyticsManagerConfig;
}

export interface LogContext {
  path: string[];
  correlationId: string;
  startTime: number;
  data: Record<string, any>;
  parentId?: string;
  duration?: number;
}

export interface IndexStats {
  totalIndexedTokens: number;
  totalIndexedLogs: number;
  pendingIndexingTasks: number;
  memoryUsageEstimate: number;
}

export interface RotationStats {
  rotationSets: number;
  totalRotatedLogs: number;
  oldestLogTimestamp: number | null;
  estimatedMemoryUsage: number;
}

export interface ContextStats {
  activeContexts: number;
  contextCounts: Record<string, number>;
  deepestContext: string;
  currentPath: string;
}

export interface FixRule {
  id: string;
  name: string;
  predicate: (log: LogEntry) => boolean;
  createFix: (log: LogEntry) => {
    issue: string;
    description: string;
    suggestion: string;
    fixFunction?: Function | string | null;
    severity?: Severity;
  };
}

export interface CustomSerializer {
  canSerialize: (value: unknown) => boolean;
  serialize: (value: unknown) => unknown;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  tab: Tab | string;
  message: string;
  data: any;
  severity: Severity | string;
  context?: LogContext;
  tags?: string[];
}

export interface FixSuggestion {
  id: string;
  issue: string;
  description: string;
  suggestion: string;
  fixFunction?: Function | string | null;
  severity: Severity;
  timestamp: number;
  occurrences?: number;
}

export interface AnalyticItem {
  category: string;
  title: string;
  data: Record<string, any>;
  total: number;
}

export interface DebugLoggerInterface {
  log(tab: Tab | string, message: string, data?: any, severity?: Severity | string): string;
  addFix(issue: string, description: string, suggestion: string, fixFunction?: any, severity?: Severity | string): string;
  dismissFix(fixId: string): void;
  clearLogs(): void;
  getLogs(options?: { limit?: number; offset?: number; includeRotated?: boolean }): LogEntry[];
  getFixes(): FixSuggestion[];
  getAnalytics(): AnalyticItem[];
  getLogsBySeverity(severity: Severity | string): LogEntry[];
  getLogsByTab(tab: Tab | string): LogEntry[];
  searchLogs(options: { query: string; [key: string]: any }): LogEntry[];
  subscribe(callback: () => void): () => void;
}

// Enums
export enum Tab {
  API = 'API',
  UI = 'UI',
  Events = 'Events',
  Database = 'Database',
  Performance = 'Performance',
  System = 'System',
  User = 'User',
  Security = 'Security',
  Network = 'Network',
  Unknown = 'Unknown'
}

export enum Severity {
  Debug = 'Debug',
  Info = 'Info',
  Success = 'Success',
  Warn = 'Warn',
  Error = 'Error',
  Critical = 'Critical'
}

// React hook for using the logger
import React, { useEffect, useState, useCallback, useRef } from 'react';

/**
 * React hook for using the DebugLogger
 * @param options - Configuration for the hook
 * @returns Logger interface and convenience methods
 */
export function useDebugLogger(options?: {
  component?: string;
  enableContextTracking?: boolean;
}) {
  const logger = DebugLogger.getInstance();
  const componentName = options?.component || 'UnknownComponent';
  const contextRef = useRef<string | null>(null);
  
  // Force component re-renders when logs change
  const [_, setUpdateCounter] = useState(0);
  
  useEffect(() => {
    // Subscribe to log updates
    const unsubscribe = logger.subscribe(() => {
      setUpdateCounter(count => count + 1);
    });
    
    // Set up context if enabled
    if (options?.enableContextTracking) {
      contextRef.current = logger.pushContext(componentName, { 
        mountTime: Date.now(),
        componentType: 'React',
        environment: process.env.NODE_ENV 
      });
    }
    
    // Log component mount
    logger.log(
      Tab.Events,
      `Component mounted: ${componentName}`,
      { timestamp: Date.now() },
      Severity.Debug
    );
    
    // Cleanup on unmount
    return () => {
      // Unsubscribe from logger
      unsubscribe();
      
      // Log component unmount
      logger.log(
        Tab.Events,
        `Component unmounted: ${componentName}`,
        { timestamp: Date.now(), mountDuration: Date.now() - (contextRef.current ? parseInt(contextRef.current.split('_')[1]) : 0) },
        Severity.Debug
      );
      
      // End context if active
      if (contextRef.current) {
        logger.popContext();
        contextRef.current = null;
      }
    };
  }, [componentName]);
  
  // Convenience logging methods
  const log = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Info);
  }, []);
  
  const debug = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Debug);
  }, []);
  
  const info = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Info);
  }, []);
  
  const success = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Success);
  }, []);
  
  const warn = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Warn);
  }, []);
  
  const error = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Error);
  }, []);
  
  const critical = useCallback((message: string, data?: any) => {
    return logger.log(Tab.Events, message, data, Severity.Critical);
  }, []);
  
  // Context methods
  const pushContext = useCallback((name: string, data?: any) => {
    return logger.pushContext(name, data);
  }, []);
  
  const popContext = useCallback(() => {
    logger.popContext();
  }, []);
  
  return {
    logger,
    log,
    debug,
    info,
    success,
    warn,
    error,
    critical,
    pushContext,
    popContext,
    getHealthReport: logger.getHealthReport.bind(logger),
    registerFixRule: logger.registerFixRule.bind(logger),
    exportLogs: logger.exportLogsToJson.bind(logger),
    getDiffLogs: logger.getNewLogsSinceLastExport.bind(logger),
    search: (query: string, options?: AdvancedSearchOptions) => 
      logger.searchLogs({ query, advanced: options })
  };
}