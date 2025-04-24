import { PerformanceMonitor, PerformanceMetric, Tab, Severity, MetricThresholdViolation } from './debugTypes';
import { DebugLogger } from './DebugLogger';
import { EventEmitter } from 'events';
import { groupBy } from 'lodash';

/**
 * Events emitted by the PerformanceMonitor
 */
export enum PerformanceMonitorEvent {
  METRIC_RECORDED = 'metricRecorded',
  THRESHOLD_EXCEEDED = 'thresholdExceeded',
  THRESHOLD_UPDATED = 'thresholdUpdated',
  MEMORY_WARNING = 'memoryWarning',
  ERROR = 'error'
}

/**
 * Configuration options for the PerformanceMonitor
 */
export interface PerformanceMonitorOptions {
  /** Maximum number of metrics to keep in memory */
  maxMetricsCount?: number;
  /** Default thresholds for common metrics */
  defaultThresholds?: Record<string, number>;
  /** Memory monitoring interval in milliseconds */
  memoryMonitoringInterval?: number;
  /** Enable automatic memory monitoring */
  enableMemoryMonitoring?: boolean;
  /** Custom logger instance */
  logger?: DebugLogger;
  /** Auto-sample frequency (set to 0 to disable) */
  samplingRate?: number;
  /** Enable concurrent operation tracking */
  trackConcurrentOperations?: boolean;
}

/**
 * Efficient circular buffer implementation for storing metrics
 * Prevents memory leaks while maintaining constant-time operations
 */
class MetricCircularBuffer<T> {
  private buffer: Array<T | undefined>;
  private head = 0;
  private tail = 0;
  private size = 0;
  private readonly capacity: number;

  /**
   * Create a new circular buffer with the specified capacity
   */
  constructor(capacity: number) {
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      throw new Error(`Invalid buffer capacity: ${capacity}. Must be a positive integer.`);
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer, overwriting oldest items if full
   */
  add(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, move head to overwrite oldest item
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in chronological order (oldest first)
   */
  getAll(): T[] {
    const result: T[] = [];
    let current = this.head;
    
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[current];
      if (item !== undefined) {
        result.push(item);
      }
      current = (current + 1) % this.capacity;
    }
    
    return result;
  }

  /**
   * Clear all items from the buffer
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Get the current size of the buffer
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Get the total capacity of the buffer
   */
  getCapacity(): number {
    return this.capacity;
  }
}

/**
 * Enhanced Enterprise-level Performance Monitor with comprehensive monitoring capabilities
 * 
 * Features:
 * - Real-time performance metric tracking with threshold alerts
 * - Memory leak detection and monitoring
 * - Event-based architecture for integration with dashboards
 * - Efficient storage with circular buffer implementation
 * - Thread-safe operations with concurrency protections
 * - Comprehensive error handling and logging
 * - Statistical aggregation and analysis capabilities
 */
export class EnterprisePerformanceMonitor extends EventEmitter implements PerformanceMonitor {
  private readonly metrics: MetricCircularBuffer<PerformanceMetric>;
  private readonly thresholds = new Map<string, number>();
  private readonly logger: DebugLogger;
  private memoryMonitoringInterval?: NodeJS.Timeout;
  private isMemoryMonitoring = false;
  private isSampling = false;
  private readonly samplingRate: number;
  private readonly DEFAULT_OPTIONS: Required<PerformanceMonitorOptions> = {
    maxMetricsCount: 10000,
    defaultThresholds: {
      'render.time': 16, // 16ms = 60fps target
      'api.responseTime': 1000, // 1 second
      'fileRead.time': 500, // 500ms
      'stateUpdate.time': 50, // 50ms
      'memory.usage': 100 * 1024 * 1024, // 100MB
      'domNode.count': 1000, // 1000 nodes
      'init.time': 2000, // 2 seconds
      'route.transition': 300, // 300ms
      'dataTransform.time': 100, // 100ms
      'computation.time': 200, // 200ms
    },
    memoryMonitoringInterval: 10000, // 10 seconds
    enableMemoryMonitoring: true,
    logger: DebugLogger.getInstance(),
    samplingRate: 5000, // 5 seconds
    trackConcurrentOperations: true
  };

  private activeTimers = new Map<string, { startTime: number; details?: unknown }>();
  private activeOperations = new Set<string>();
  private memoryTrend: { timestamp: number; value: number }[] = [];
  private lastMemoryWarning = 0;
  private readonly MEMORY_WARNING_THRESHOLD = 0.85; // 85% of heap limit
  private readonly MEMORY_WARNING_INTERVAL = 60000; // 1 minute
  private readonly trackConcurrentOperations: boolean;
  private instanceId = `perf-monitor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  /**
   * Create a new EnterprisePerformanceMonitor instance
   */
  constructor(options: PerformanceMonitorOptions = {}) {
    super();
    
    // Merge provided options with defaults
    const mergedOptions: Required<PerformanceMonitorOptions> = {
      ...this.DEFAULT_OPTIONS,
      ...options,
      defaultThresholds: {
        ...this.DEFAULT_OPTIONS.defaultThresholds,
        ...(options.defaultThresholds || {})
      }
    };

    // Enhanced validation
    if (mergedOptions.samplingRate < 0) {
      throw new Error(`Invalid sampling rate: ${mergedOptions.samplingRate}`);
    }

    if (mergedOptions.maxMetricsCount <= 0) {
      throw new Error(`Invalid metrics capacity: ${mergedOptions.maxMetricsCount}`);
    }

    this.logger = mergedOptions.logger;
    this.samplingRate = mergedOptions.samplingRate;
    this.trackConcurrentOperations = mergedOptions.trackConcurrentOperations;
    
    // Initialize metric buffer
    this.metrics = new MetricCircularBuffer<PerformanceMetric>(mergedOptions.maxMetricsCount);
    
    // Set default thresholds
    Object.entries(mergedOptions.defaultThresholds).forEach(([metric, value]) => {
      this.setThreshold(metric, value);
    });

    // Initialize memory monitoring if enabled
    if (mergedOptions.enableMemoryMonitoring) {
      this.initializeMemoryMonitoring(mergedOptions.memoryMonitoringInterval);
    }

    // Set up auto-sampling if enabled
    if (this.samplingRate > 0) {
      this.startAutoSampling();
    }

    // Log initialization
    this.logger.log(
      Tab.Performance,
      'EnterprisePerformanceMonitor initialized',
      { 
        instanceId: this.instanceId,
        options: mergedOptions,
        timestamp: Date.now()
      },
      Severity.Info
    );

    // Handle uncaught errors in event handlers
    this.on('error', (error) => {
      this.logger.log(
        Tab.Performance,
        'Unhandled error in PerformanceMonitor event handler',
        this.serializeError(error),
        Severity.Error
      );
    });
  }

  /**
   * Initialize memory monitoring at the specified interval
   */
  private initializeMemoryMonitoring(intervalMs: number): void {
    try {
      if (typeof window !== 'undefined' && 
          window.performance && 
          (window.performance as any).memory?.usedJSHeapSize !== undefined) {
        
        this.memoryMonitoringInterval = setInterval(() => {
          this.monitorMemory();
        }, intervalMs);
        
        // Add event listener for page visibility to pause monitoring when tab is inactive
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              this.monitorMemory();
            }
          });
        }
      } else {
        this.logger.log(
          Tab.Performance,
          'Memory monitoring not available in this environment',
          { environment: typeof window !== 'undefined' ? 'browser' : 'non-browser' },
          Severity.Info
        );
      }
    } catch (error) {
      this.logger.log(
        Tab.Performance,
        'Failed to initialize memory monitoring',
        this.serializeError(error),
        Severity.Error
      );
    }
  }

  /**
   * Monitor memory usage and detect potential memory leaks
   */
  private monitorMemory(): void {
    if (this.isMemoryMonitoring) return; // Prevent concurrent execution
    this.isMemoryMonitoring = true;
    
    try {
      const memory = (window.performance as any).memory;
      if (!memory) return;
      
      const usedJSHeapSize = memory.usedJSHeapSize;
      const jsHeapSizeLimit = memory.jsHeapSizeLimit;
      const totalJSHeapSize = memory.totalJSHeapSize;
      
      // Record metric
      this.recordMetric(
        'memory.usage',
        usedJSHeapSize,
        {
          totalHeap: totalJSHeapSize,
          heapLimit: jsHeapSizeLimit,
          percentUsed: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100) / 100
        }
      );
      
      // Update memory trend (keep last 10 readings)
      this.memoryTrend.push({ 
        timestamp: Date.now(), 
        value: usedJSHeapSize 
      });
      
      if (this.memoryTrend.length > 10) {
        this.memoryTrend.shift();
      }
      
      // Check for memory leaks by analyzing the trend
      this.detectMemoryLeaks();
      
      // Check if memory usage is approaching limit
      const memoryRatio = usedJSHeapSize / jsHeapSizeLimit;
      if (memoryRatio > this.MEMORY_WARNING_THRESHOLD) {
        const now = Date.now();
        if (now - this.lastMemoryWarning > this.MEMORY_WARNING_INTERVAL) {
          this.lastMemoryWarning = now;
          
          const warningData = {
            usedJSHeapSize,
            jsHeapSizeLimit,
            usagePercentage: Math.round(memoryRatio * 100),
            timestamp: now
          };
          
          this.logger.log(
            Tab.Performance,
            'Memory usage warning: approaching heap limit',
            warningData,
            Severity.Warn
          );
          
          this.emit(PerformanceMonitorEvent.MEMORY_WARNING, warningData);
        }
      }
    } catch (error) {
      this.logger.log(
        Tab.Performance,
        'Memory monitoring failed',
        this.serializeError(error),
        Severity.Error
      );
    } finally {
      this.isMemoryMonitoring = false;
    }
  }

  /**
   * Calculate the slope of a linear regression for memory points
   */
  private linearRegressionSlope(points: Array<{ timestamp: number; value: number }>): number {
    if (points.length < 2) return 0;
    
    // Normalize timestamps to avoid numerical issues
    const baseTime = points[0].timestamp;
    const normalizedPoints = points.map(p => ({
      x: (p.timestamp - baseTime) / 1000, // seconds
      y: p.value / (1024 * 1024) // MB
    }));
    
    // Calculate means
    const n = normalizedPoints.length;
    const meanX = normalizedPoints.reduce((sum, p) => sum + p.x, 0) / n;
    const meanY = normalizedPoints.reduce((sum, p) => sum + p.y, 0) / n;
    
    // Calculate slope using least squares method
    const numerator = normalizedPoints.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
    const denominator = normalizedPoints.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0);
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Detect potential memory leaks by analyzing the memory usage trend
   * Uses advanced analysis with segmented trend detection
   */
  private detectMemoryLeaks(): void {
    if (this.memoryTrend.length < 6) return; // Need at least 6 data points for segmented analysis
    
    // Basic rate calculation
    const firstReading = this.memoryTrend[0];
    const lastReading = this.memoryTrend[this.memoryTrend.length - 1];
    
    const timeDiffMs = lastReading.timestamp - firstReading.timestamp;
    const memoryDiff = lastReading.value - firstReading.value;
    
    // Convert to MB per minute for easier interpretation
    const memoryIncreaseRate = (memoryDiff / (1024 * 1024)) / (timeDiffMs / 60000);
    
    // Advanced segmented analysis
    const memoryAnalysis = {
      current: this.memoryTrend.slice(-3), // Most recent 3 readings
      previous: this.memoryTrend.slice(-6, -3) // 3 readings before that
    };
    
    const currentSlope = this.linearRegressionSlope(memoryAnalysis.current);
    const previousSlope = this.linearRegressionSlope(memoryAnalysis.previous);
    
    // Alert conditions:
    // 1. Memory is consistently increasing at a high rate
    // 2. The rate of increase is accelerating significantly
    const isHighRate = memoryIncreaseRate > 5 && memoryDiff > 0; // More than 5MB per minute
    const isAccelerating = currentSlope > previousSlope * 1.5 && currentSlope > 0;
    
    if (isHighRate || isAccelerating) {
      const severityLevel = isAccelerating ? Severity.Error : Severity.Warn;
      const leakType = isAccelerating ? 'Accelerating memory leak' : 'Potential memory leak';
      
      this.logger.log(
        Tab.Performance,
        leakType,
        {
          memoryIncreaseRate: `${memoryIncreaseRate.toFixed(2)} MB/minute`,
          currentTrend: {
            slope: `${currentSlope.toFixed(2)} MB/second`,
            readings: memoryAnalysis.current.map(r => ({
              timestamp: new Date(r.timestamp).toISOString(),
              valueInMB: (r.value / (1024 * 1024)).toFixed(2)
            }))
          },
          previousTrend: {
            slope: `${previousSlope.toFixed(2)} MB/second`,
            readings: memoryAnalysis.previous.map(r => ({
              timestamp: new Date(r.timestamp).toISOString(),
              valueInMB: (r.value / (1024 * 1024)).toFixed(2)
            }))
          },
          acceleration: currentSlope / (previousSlope || 0.001),
          readingsCount: this.memoryTrend.length
        },
        severityLevel
      );
      
      // Emit a memory warning event with detailed analysis
      this.emit(PerformanceMonitorEvent.MEMORY_WARNING, {
        type: leakType,
        currentSlope,
        previousSlope,
        acceleration: currentSlope / (previousSlope || 0.001),
        isAccelerating,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start automatic sampling of performance metrics
   * This collects general browser performance data at regular intervals
   */
  private startAutoSampling(): void {
    if (this.samplingRate <= 0 || typeof window === 'undefined') return;
    
    setInterval(() => {
      if (this.isSampling || document.visibilityState !== 'visible') return;
      this.isSampling = true;
      
      try {
        // Sample network information if available
        if ((navigator as any).connection) {
          const connection = (navigator as any).connection;
          this.recordMetric('network.effectiveType', 0, { 
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
          });
        }
        
        // Sample page visibility and focus state
        this.recordMetric('page.visibility', 0, {
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus()
        });
        
        // Sample performance timing metrics
        if (window.performance?.timing) {
          const timing = window.performance.timing;
          const now = Date.now();
          
          this.recordMetric('page.loadTime', timing.loadEventEnd - timing.navigationStart, {
            navigationStart: timing.navigationStart,
            loadEventEnd: timing.loadEventEnd,
            ageInSeconds: Math.floor((now - timing.loadEventEnd) / 1000)
          });
        }
        
        // Sample performance entries if available
        if (window.performance?.getEntriesByType) {
          try {
            const paintMetrics = window.performance.getEntriesByType('paint');
            paintMetrics.forEach(metric => {
              this.recordMetric(`paint.${metric.name}`, metric.startTime, {
                entryType: metric.entryType,
                name: metric.name
              });
            });
            
            // Sample long tasks
            const longTasks = window.performance.getEntriesByType('longtask');
            if (longTasks.length > 0) {
              this.recordMetric('longtasks.count', longTasks.length, {
                totalDuration: longTasks.reduce((sum, task) => sum + task.duration, 0)
              });
            }
          } catch (error) {
            // Silent catch - not all browsers support all entry types
          }
        }
      } catch (error) {
        this.logger.log(
          Tab.Performance,
          'Auto-sampling failed',
          this.serializeError(error),
          Severity.Error
        );
      } finally {
        this.isSampling = false;
      }
    }, this.samplingRate);
  }

  /**
   * Record a performance metric with validation and error handling
   * 
   * @param metricName - The name of the metric to record
   * @param value - The numeric value of the metric
   * @param details - Additional details about the metric (will be sanitized)
   * @throws {Error} If the metric name or value is invalid
   */
  recordMetric(metricName: string, value: number, details?: unknown): void {
    try {
      // Validate inputs
      if (typeof metricName !== 'string' || metricName.trim() === '') {
        throw new Error('Invalid metric name: must be a non-empty string');
      }

      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Invalid metric value: ${value}`);
      }

      // Create and sanitize the metric object
      const metric: PerformanceMetric = {
        timestamp: Date.now(),
        metricName,
        value,
        details: this.sanitizeDetails(details)
      };

      // Store the metric
      this.metrics.add(metric);
      
      // Check if the metric exceeds any threshold
      this.checkThreshold(metric);
      
      // Emit event for subscribers
      this.emit(PerformanceMonitorEvent.METRIC_RECORDED, metric);
    } catch (error) {
      this.handleError('Failed to record metric', {
        metricName,
        value,
        error
      });
    }
  }

  /**
   * Check if a metric exceeds its threshold and emit events if it does
   */
  private checkThreshold(metric: PerformanceMetric): void {
    try {
      const threshold = this.thresholds.get(metric.metricName);
      if (threshold === undefined) return;

      if (metric.value > threshold) {
        const percentExceeded = Math.round((metric.value / threshold - 1) * 100);
        
        const violation: MetricThresholdViolation = {
          metric: metric.metricName,
          value: metric.value,
          threshold,
          percentExceeded,
          timestamp: metric.timestamp,
          details: metric.details
        };

        this.logger.log(
          Tab.Performance,
          `Performance threshold exceeded: ${metric.metricName}`,
          violation,
          Severity.Warn
        );

        this.emit(PerformanceMonitorEvent.THRESHOLD_EXCEEDED, violation);
      }
    } catch (error) {
      this.handleError('Threshold check failed', {
        metric: metric.metricName,
        error
      });
    }
  }

  /**
   * Get metrics filtered by name and time range
   * 
   * @param metricName - Optional filter by metric name
   * @param timeRange - Optional filter by time range
   * @returns Filtered array of metrics
   */
  getMetrics(
    metricName?: string,
    timeRange?: { start: number; end: number }
  ): PerformanceMetric[] {
    try {
      let filteredMetrics = this.metrics.getAll();
      
      // Filter by metric name if provided
      if (metricName) {
        filteredMetrics = filteredMetrics.filter(m => m.metricName === metricName);
      }
      
      // Filter by time range if provided
      if (timeRange) {
        if (typeof timeRange.start !== 'number' || typeof timeRange.end !== 'number') {
          throw new Error('Invalid time range: start and end must be numbers');
        }
        
        if (timeRange.start > timeRange.end) {
          throw new Error('Invalid time range: start must be less than or equal to end');
        }
        
        filteredMetrics = filteredMetrics.filter(
          m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
        );
      }
      
      return filteredMetrics;
    } catch (error) {
      this.handleError('Failed to get metrics', { metricName, timeRange, error });
      return [];
    }
  }

  /**
   * Get comprehensive statistics for a metric in a given time range
   * 
   * @param metricName - The name of the metric to analyze
   * @param timeRange - Optional time range filter
   * @returns Statistical analysis of the metric
   */
  getMetricStats(
    metricName: string,
    timeRange?: { start: number; end: number }
  ): {
    avg: number;
    min: number;
    max: number;
    median: number;
    p95: number;
    p99: number;
    stdDev: number;
    count: number;
  } {
    try {
      const metrics = this.getMetrics(metricName, timeRange);
      
      if (metrics.length === 0) {
        return {
          avg: 0,
          min: 0,
          max: 0,
          median: 0,
          p95: 0,
          p99: 0,
          stdDev: 0,
          count: 0
        };
      }
      
      // Extract values and sort them for percentile calculations
      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      const count = values.length;
      
      // Calculate basic statistics
      const min = values[0];
      const max = values[count - 1];
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / count;
      
      // Calculate percentiles
      const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * count) - 1;
        return values[Math.max(0, Math.min(count - 1, index))];
      };
      
      const median = count % 2 === 0
        ? (values[count / 2 - 1] + values[count / 2]) / 2
        : values[Math.floor(count / 2)];
        
      const p95 = getPercentile(95);
      const p99 = getPercentile(99);
      
      // Calculate standard deviation
      const squaredDifferences = values.map(val => Math.pow(val - avg, 2));
      const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / count;
      const stdDev = Math.sqrt(variance);
      
      return {
        avg,
        min,
        max,
        median,
        p95,
        p99,
        stdDev,
        count
      };
    } catch (error) {
      this.handleError('Failed to calculate metric statistics', { metricName, timeRange, error });
      return {
        avg: 0,
        min: 0,
        max: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
        count: 0
      };
    }
  }

  /**
   * Get the average value for a metric in a given time range
   * 
   * @param metricName - The name of the metric
   * @param timeRange - Optional time range filter
   * @returns The average value or 0 if no metrics found
   */
  getAverageMetric(
    metricName: string,
    timeRange?: { start: number; end: number }
  ): number {
    return this.getMetricStats(metricName, timeRange).avg;
  }

  /**
   * Get the minimum value for a metric in a given time range
   * 
   * @param metricName - The name of the metric
   * @param timeRange - Optional time range filter
   * @returns The minimum value or 0 if no metrics found
   */
  getMinMetric(
    metricName: string,
    timeRange?: { start: number; end: number }
  ): number {
    return this.getMetricStats(metricName, timeRange).min;
  }

  /**
   * Get the maximum value for a metric in a given time range
   * 
   * @param metricName - The name of the metric
   * @param timeRange - Optional time range filter
   * @returns The maximum value or 0 if no metrics found
   */
  getMaxMetric(
    metricName: string,
    timeRange?: { start: number; end: number }
  ): number {
    return this.getMetricStats(metricName, timeRange).max;
  }

  /**
   * Get all unique metric names that have been recorded
   * 
   * @returns Array of unique metric names
   */
  getMetricNames(): string[] {
    try {
      const metrics = this.metrics.getAll();
      const uniqueNames = new Set<string>();
      
      metrics.forEach(metric => uniqueNames.add(metric.metricName));
      
      return Array.from(uniqueNames);
    } catch (error) {
      this.handleError('Failed to get metric names', { error });
      return [];
    }
  }

  /**
   * Set a threshold for a specific metric with validation
   * 
   * @param metricName - The name of the metric
   * @param threshold - The threshold value
   * @throws {Error} If the threshold value is invalid
   */
  setThreshold(metricName: string, threshold: number): void {
    try {
      if (typeof metricName !== 'string' || metricName.trim() === '') {
        throw new Error('Invalid metric name: must be a non-empty string');
      }
      
      if (typeof threshold !== 'number' || Number.isNaN(threshold) || threshold <= 0) {
        throw new Error(`Invalid threshold value: ${threshold}. Must be a positive number.`);
      }
      
      this.thresholds.set(metricName, threshold);
      
      this.emit(PerformanceMonitorEvent.THRESHOLD_UPDATED, {
        metricName,
        threshold,
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError('Failed to set threshold', { metricName, threshold, error });
      throw error; // Re-throw for client code to handle
    }
  }

  /**
   * Get the current threshold for a metric
   * 
   * @param metricName - The name of the metric
   * @returns The threshold value or undefined if not set
   */
  getThreshold(metricName: string): number | undefined {
    return this.thresholds.get(metricName);
  }

  /**
   * Get all configured thresholds
   * 
   * @returns Map of metric names to threshold values
   */
  getAllThresholds(): Map<string, number> {
    return new Map(this.thresholds);
  }

  /**
   * Start measuring a timed operation
   * Returns a function to call when the operation completes
   * 
   * @param operationName - The name of the operation being measured
   * @param details - Optional additional details about the operation
   * @returns Function to call when the operation completes
   */
  startMeasure(operationName: string, details?: unknown): () => void {
    try {
      if (typeof operationName !== 'string' || operationName.trim() === '') {
        throw new Error('Invalid operation name: must be a non-empty string');
      }
      
      const trackingId = `${operationName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const startTime = performance.now();
      
      // Store the timer for tracking and potential cleanup
      this.activeTimers.set(trackingId, {
        startTime,
        details: this.sanitizeDetails(details)
      });
      
      // Return a completion function
      return () => {
        try {
          const timerData = this.activeTimers.get(trackingId);
          if (!timerData) {
            this.logger.log(
              Tab.Performance,
              'Timer not found or already completed',
              { operationName, trackingId },
              Severity.Warning
            );
            return;
          }
          
          const endTime = performance.now();
          const duration = endTime - timerData.startTime;
          
          this.recordMetric(`${operationName}.time`, duration, {
            ...timerData.details,
            startTime: timerData.startTime,
            endTime,
            duration,
            trackingId
          });
          
          // Clean up the timer
          this.activeTimers.delete(trackingId);
        } catch (error) {
          this.handleError('Error completing performance measurement', {
            operationName,
            trackingId,
            error
          });
        }
      };
    } catch (error) {
      this.handleError('Failed to start measurement', { operationName, error });
      
      // Return a no-op function in case of error
      return () => {
        /* no-op */
      };
    }
  }

  /**
   * Measure the time a promise takes to resolve
   * Enhanced with concurrent operation tracking
   * 
   * @param operationName - The name of the operation being measured
   * @param promise - The promise to measure
   * @param details - Optional additional details about the operation
   * @returns The promise result
   */
  async measurePromise<T>(
    operationName: string,
    promise: Promise<T>,
    details?: unknown
  ): Promise<T> {
    if (typeof operationName !== 'string' || operationName.trim() === '') {
      throw new Error('Invalid operation name: must be a non-empty string');
    }

    if (!(promise instanceof Promise)) {
      throw new Error('Second argument must be a Promise');
    }

    // Track concurrent operations if enabled
    if (this.trackConcurrentOperations) {
      if (this.activeOperations.has(operationName)) {
        this.logger.log(
          Tab.Performance,
          'Concurrent operation detected',
          {
            operationName,
            currentActive: Array.from(this.activeOperations),
            timestamp: Date.now()
          },
          Severity.Warning
        );
      }
      this.activeOperations.add(operationName);
    }

    const trackingId = `${operationName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = performance.now();
    let success = false;
    let resultDetails: unknown = {};

    try {
      const result = await promise;
      success = true;
      return result;
    } catch (error) {
      resultDetails = { error: this.serializeError(error) };
      throw error;
    } finally {
      try {
        // Remove from active operations tracker
        if (this.trackConcurrentOperations) {
          this.activeOperations.delete(operationName);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.recordMetric(`${operationName}.time`, duration, {
          ...this.sanitizeDetails(details),
          startTime,
          endTime,
          duration,
          success,
          trackingId,
          ...resultDetails
        });
      } catch (finallyError) {
        this.handleError('Error recording promise measurement', {
          operationName,
          trackingId,
          error: finallyError
        });
        
        // Ensure we remove from active operations even if metric recording fails
        if (this.trackConcurrentOperations) {
          this.activeOperations.delete(operationName);
        }
      }
    }
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics(): void {
    try {
      this.metrics.clear();
      this.logger.log(
        Tab.Performance,
        'Performance metrics cleared',
        { timestamp: Date.now() },
        Severity.Info
      );
    } catch (error) {
      this.handleError('Failed to clear metrics', { error });
    }
  }

  /**
   * Safely handle and log errors
   */
  private handleError(message: string, context: { error: unknown; [key: string]: unknown }): void {
    try {
      const errorObj = {
        message,
        ...context,
        error: this.serializeError(context.error)
      };
      
      this.logger.log(
        Tab.Performance,
        message,
        errorObj,
        Severity.Error
      );
      
      this.emit(PerformanceMonitorEvent.ERROR, errorObj);
    } catch (logError) {
      // Last resort if even error handling fails
      console.error('PerformanceMonitor error handling failed', message, logError);
    }
  }

  /**
   * Safely serialize errors for logging
   */
  private serializeError(error: unknown): any {
    try {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause ? this.serializeError(error.cause) : undefined
        };
      }
      
      return String(error);
    } catch {
      return 'Unserializable error';
    }
  }

  /**
   * Safely sanitize details for serialization with enhanced handling
   */
  private sanitizeDetails(details?: unknown): unknown {
    if (details === undefined) return undefined;
    
    try {
      // Handle objects with non-serializable content
      if (typeof details === 'object' && details !== null) {
        // Filter out function properties and create a new object
        const filtered = Object.fromEntries(
          Object.entries(details as Record<string, unknown>)
            .filter(([_, value]) => {
              const valueType = typeof value;
              return valueType !== 'function' && 
                     valueType !== 'symbol' && 
                     !(value instanceof WeakMap) && 
                     !(value instanceof WeakSet);
            })
            .map(([key, value]) => {
              // Handle circular references or complex objects
              if (typeof value === 'object' && value !== null) {
                try {
                  // Test if it can be serialized
                  JSON.stringify(value);
                  return [key, value];
                } catch {
                  return [key, '[Non-serializable Object]'];
                }
              }
              return [key, value];
            })
        );
        
        return filtered;
      }
      
      // For primitives and arrays, attempt standard serialization
      return JSON.parse(JSON.stringify(details));
    } catch {
      // If all else fails, return a simplified object
      return { 
        warning: 'Non-serializable details removed',
        originalType: typeof details,
        isArray: Array.isArray(details),
        hasProperties: typeof details === 'object' && details !== null ? 
          Object.keys(details).length : 'N/A'
      };
    }
  }

  /**
   * Calculate correlation between two arrays of metrics
   */
  private calculateCorrelation(
    metricsA: PerformanceMetric[],
    metricsB: PerformanceMetric[]
  ): number {
    // Need at least 3 samples for meaningful correlation
    if (metricsA.length < 3 || metricsB.length < 3) return 0;
    
    // Create time-aligned samples by matching closest timestamps
    const alignedSamples: Array<{ a: number; b: number }> = [];
    
    for (const metricA of metricsA) {
      // Find closest metricB by timestamp
      let closestB = metricsB[0];
      let minTimeDiff = Math.abs(metricA.timestamp - closestB.timestamp);
      
      for (let i = 1; i < metricsB.length; i++) {
        const timeDiff = Math.abs(metricA.timestamp - metricsB[i].timestamp);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestB = metricsB[i];
        }
      }
      
      // Only include if timestamps are reasonably close (within 10 seconds)
      if (minTimeDiff < 10000) {
        alignedSamples.push({ a: metricA.value, b: closestB.value });
      }
    }
    
    // Not enough matching samples
    if (alignedSamples.length < 3) return 0;
    
    // Calculate correlation coefficient
    const n = alignedSamples.length;
    
    // Calculate means
    const meanA = alignedSamples.reduce((sum, s) => sum + s.a, 0) / n;
    const meanB = alignedSamples.reduce((sum, s) => sum + s.b, 0) / n;
    
    // Calculate variances and covariance
    let varA = 0, varB = 0, covAB = 0;
    
    for (const sample of alignedSamples) {
      const diffA = sample.a - meanA;
      const diffB = sample.b - meanB;
      
      varA += diffA * diffA;
      varB += diffB * diffB;
      covAB += diffA * diffB;
    }
    
    // Prevent division by zero
    if (varA === 0 || varB === 0) return 0;
    
    // Calculate correlation coefficient
    return covAB / (Math.sqrt(varA) * Math.sqrt(varB));
  }

  /**
   * Calculate cross-metric correlations for analytical insights
   */
  private calculateCrossMetricCorrelations(
    metricGroups: Record<string, PerformanceMetric[]>
  ): Array<{ metricA: string; metricB: string; correlation: number }> {
    const metricNames = Object.keys(metricGroups);
    const correlations: Array<{ metricA: string; metricB: string; correlation: number }> = [];
    
    // Calculate correlations between all pairs of metrics
    // Only include strong correlations (positive or negative)
    for (let i = 0; i < metricNames.length; i++) {
      for (let j = i + 1; j < metricNames.length; j++) {
        const nameA = metricNames[i];
        const nameB = metricNames[j];
        
        const metricsA = metricGroups[nameA];
        const metricsB = metricGroups[nameB];
        
        const correlation = this.calculateCorrelation(metricsA, metricsB);
        
        // Only include significant correlations (strong positive or negative)
        if (Math.abs(correlation) > 0.5) {
          correlations.push({
            metricA: nameA,
            metricB: nameB,
            correlation
          });
        }
      }
    }
    
    // Sort by absolute correlation strength (strongest first)
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Generate a performance report for the specified time period
   * Enhanced with correlation analysis and additional metrics
   * 
   * @param timeRange - Optional time range for the report
   * @returns Comprehensive performance report
   */
  generatePerformanceReport(timeRange?: { start: number; end: number }): {
    timestamp: number;
    metricSummaries: Array<{
      name: string;
      count: number;
      avg: number;
      min: number;
      max: number;
      p95: number;
      thresholdExceeded: boolean;
      stdDev: number;
    }>;
    memoryTrend: Array<{ timestamp: number; valueInMB: number }>;
    thresholdViolations: number;
    totalMetricsCount: number;
    correlations: Array<{
      metricA: string;
      metricB: string;
      correlation: number;
      interpretation: string;
    }>;
    concurrencyAnalysis?: {
      maxConcurrent: number;
      frequentConcurrentOperations: string[];
    };
  } {
    try {
      const metricNames = this.getMetricNames();
      const metrics = this.getMetrics(undefined, timeRange);
      const now = Date.now();
      
      // Count threshold violations
      const thresholdViolations = metrics.filter(metric => {
        const threshold = this.thresholds.get(metric.metricName);
        return threshold !== undefined && metric.value > threshold;
      }).length;
      
      // Generate summaries for each metric with enhanced statistics
      const metricSummaries = metricNames.map(name => {
        const stats = this.getMetricStats(name, timeRange);
        const threshold = this.thresholds.get(name);
        
        return {
          name,
          count: stats.count,
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
          p95: stats.p95,
          stdDev: stats.stdDev,
          thresholdExceeded: threshold !== undefined && stats.max > threshold
        };
      });
      
      // Format memory trend
      const formattedMemoryTrend = this.memoryTrend.map(point => ({
        timestamp: point.timestamp,
        valueInMB: point.value / (1024 * 1024)
      }));
      
      // Group metrics by name for correlation analysis
      const metricGroups = groupBy(metrics, 'metricName');
      
      // Calculate cross-metric correlations
      const rawCorrelations = this.calculateCrossMetricCorrelations(metricGroups);
      
      // Add human-readable interpretations to correlations
      const correlations = rawCorrelations.map(c => ({
        ...c,
        interpretation: c.correlation > 0.8 
          ? 'Very strong positive correlation'
          : c.correlation > 0.6
            ? 'Strong positive correlation'
            : c.correlation > 0
              ? 'Moderate positive correlation'
              : c.correlation > -0.6
                ? 'Moderate negative correlation'
                : c.correlation > -0.8
                  ? 'Strong negative correlation'
                  : 'Very strong negative correlation'
      }));
      
      // Concurrency analysis (when tracking is enabled)
      let concurrencyAnalysis = undefined;
      
      if (this.trackConcurrentOperations) {
        // Analyze concurrent operations from metrics details
        // This analysis would typically come from recorded metrics
        // that captured concurrent operation warnings
        concurrencyAnalysis = {
          maxConcurrent: this.activeOperations.size,
          frequentConcurrentOperations: Array.from(this.activeOperations)
        };
      }
      
      return {
        timestamp: now,
        metricSummaries,
        memoryTrend: formattedMemoryTrend,
        thresholdViolations,
        totalMetricsCount: metrics.length,
        correlations,
        concurrencyAnalysis
      };
    } catch (error) {
      this.handleError('Failed to generate performance report', { error, timeRange });
      
      // Return an empty report
      return {
        timestamp: Date.now(),
        metricSummaries: [],
        memoryTrend: [],
        thresholdViolations: 0,
        totalMetricsCount: 0,
        correlations: []
      };
    }
  }

  /**
   * Clean up resources when the monitor is no longer needed
   */
  dispose(): void {
    try {
      // Clear intervals
      if (this.memoryMonitoringInterval) {
        clearInterval(this.memoryMonitoringInterval);
        this.memoryMonitoringInterval = undefined;
      }
      
      // Remove event listeners
      this.removeAllListeners();
      
      // Log disposal
      this.logger.log(
        Tab.Performance,
        'PerformanceMonitor disposed',
        { instanceId: this.instanceId, timestamp: Date.now() },
        Severity.Info
      );
    } catch (error) {
      this.handleError('Error during PerformanceMonitor disposal', { error });
    }
  }
}

// Export a singleton instance for application-wide usage
let instance: EnterprisePerformanceMonitor | null = null;

/**
 * Get the application-wide instance of the EnterprisePerformanceMonitor
 */
export function getPerformanceMonitor(options?: PerformanceMonitorOptions): EnterprisePerformanceMonitor {
  if (!instance) {
    instance = new EnterprisePerformanceMonitor(options);
  }
  return instance;
}

/**
 * Create a new independent instance of the EnterprisePerformanceMonitor
 * Use this for isolated monitoring (e.g., in tests or separate application modules)
 */
export function createPerformanceMonitor(options?: PerformanceMonitorOptions): EnterprisePerformanceMonitor {
  return new EnterprisePerformanceMonitor(options);
}

/**
 * Enable OpenTelemetry integration for the performance monitor
 * This allows metrics to be exported to OpenTelemetry-compatible backends
 */
export function enableOpenTelemetryIntegration(
  monitor: EnterprisePerformanceMonitor
): { dispose: () => void } {
  try {
    // This would typically use the actual OpenTelemetry libraries
    // We're providing a simplified implementation for demonstration
    
    // Set up event listeners
    const metricHandler = (metric: PerformanceMetric) => {
      // In a real implementation, this would create OpenTelemetry metrics
      console.log(`[OpenTelemetry] Metric recorded: ${metric.metricName}=${metric.value}`);
    };
    
    const thresholdHandler = (violation: MetricThresholdViolation) => {
      // In a real implementation, this would create an OpenTelemetry span with an event
      console.log(`[OpenTelemetry] Threshold exceeded: ${violation.metric}=${violation.value}`);
    };
    
    // Register event handlers
    monitor.on(PerformanceMonitorEvent.METRIC_RECORDED, metricHandler);
    monitor.on(PerformanceMonitorEvent.THRESHOLD_EXCEEDED, thresholdHandler);
    
    // Return a function to clean up the integration
    return {
      dispose: () => {
        monitor.off(PerformanceMonitorEvent.METRIC_RECORDED, metricHandler);
        monitor.off(PerformanceMonitorEvent.THRESHOLD_EXCEEDED, thresholdHandler);
      }
    };
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry integration', error);
    return { dispose: () => {} };
  }
}

// Types for integration with EnterpriseAnalysisDebugger
export interface PerformanceVisualizationOptions {
  metricName: string;
  timeRange?: { start: number; end: number };
  visualizationType: 'line' | 'bar' | 'scatter';
  aggregation?: 'none' | 'avg' | 'max' | 'min' | 'sum';
  interval?: number; // Time interval in ms for aggregation
  includeThreshold?: boolean;
  colorScheme?: 'light' | 'dark' | 'colorBlind';
}

// Example integration with EnterpriseAnalysisDebugger

// 1. Application Integration Example

// Add this to your application initialization
import { EnterpriseAnalysisDebugger } from './EnterpriseAnalysisDebugger';
import { 
  getPerformanceMonitor, 
  PerformanceMonitorEvent, 
  enableOpenTelemetryIntegration 
} from './EnterprisePerformanceMonitor';

// Initialize the performance monitor with appropriate options
const performanceMonitor = getPerformanceMonitor({
  samplingRate: 2000,  // More frequent sampling for development
  maxMetricsCount: 50000,  // Larger buffer for enterprise applications
  trackConcurrentOperations: true
});

// Connect with observability systems
const telemetryIntegration = enableOpenTelemetryIntegration(performanceMonitor);

// Register with the debugger
EnterpriseAnalysisDebugger.registerMetricsProvider(performanceMonitor);

// Subscribe to events for real-time dashboard updates
performanceMonitor.on(PerformanceMonitorEvent.METRIC_RECORDED, (metric) => {
  EnterpriseAnalysisDebugger.updateMetricDisplay(metric);
});

performanceMonitor.on(PerformanceMonitorEvent.THRESHOLD_EXCEEDED, (violation) => {
  EnterpriseAnalysisDebugger.showAlert(violation);
});

performanceMonitor.on(PerformanceMonitorEvent.MEMORY_WARNING, (warning) => {
  EnterpriseAnalysisDebugger.showMemoryWarning(warning);
});

// For testing:
export function simulateLoad(): void {
  const endSimulation = performanceMonitor.startMeasure('loadSimulation');
  
  // Simulate API call
  performanceMonitor.measurePromise(
    'api.fetch',
    new Promise(resolve => setTimeout(resolve, 500)),
    { endpoint: '/api/data', method: 'GET' }
  );
  
  // Complete simulation
  setTimeout(endSimulation, 1000);
}


// 2. React Hook Integration Example

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getPerformanceMonitor, PerformanceMonitorEvent } from './EnterprisePerformanceMonitor';

// Hook for tracking performance metrics in React components
export function usePerformanceTracker(metricName: string) {
  const monitor = useMemo(() => getPerformanceMonitor(), []);
  const [stats, setStats] = useState<{
    avg: number;
    min: number;
    max: number;
    count: number;
  }>();

  useEffect(() => {
    // Update stats every 5 seconds
    const interval = setInterval(() => {
      const timeRange = { 
        start: Date.now() - 5 * 60 * 1000, // Last 5 minutes
        end: Date.now() 
      };
      
      const metricStats = monitor.getMetricStats(metricName, timeRange);
      setStats({
        avg: metricStats.avg,
        min: metricStats.min,
        max: metricStats.max,
        count: metricStats.count
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [metricName, monitor]);

  // Method to measure component operations
  const measureOperation = useCallback((operationName: string, fn: () => void) => {
    const endMeasure = monitor.startMeasure(`${metricName}.${operationName}`);
    fn();
    endMeasure();
  }, [metricName, monitor]);

  // Method to measure async operations
  const measureAsyncOperation = useCallback(
    <T,>(operationName: string, promise: Promise<T>) => {
      return monitor.measurePromise(`${metricName}.${operationName}`, promise);
    },
    [metricName, monitor]
  );

  return { stats, measureOperation, measureAsyncOperation };
}

// Example usage in a component
function DataGrid({ data }) {
  const { stats, measureOperation, measureAsyncOperation } = usePerformanceTracker('dataGrid');
  
  // Track sorting performance
  const handleSort = (column) => {
    measureOperation('sort', () => {
      // Sorting logic
    });
  };
  
  // Track data fetching
  const fetchMoreData = () => {
    return measureAsyncOperation('fetchMore', api.fetchData());
  };
  
  // Render performance stats if in development
  return (
    <div>
      {process.env.NODE_ENV === 'development' && stats && (
        <div className="performance-stats">
          <span>Avg: {stats.avg.toFixed(2)}ms</span>
          <span>Max: {stats.max.toFixed(2)}ms</span>
          <span>Count: {stats.count}</span>
        </div>
      )}
      
      {/* DataGrid component */}
    </div>
  );
}


// 3. CLI Integration Example

// Command line tool for performance analysis
// Example usage: node analyze-performance.js --report=summary --timeWindow=1h

import { createPerformanceMonitor } from './EnterprisePerformanceMonitor';
import fs from 'fs';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const reportType = getArgValue(args, '--report') || 'summary';
  const timeWindow = getArgValue(args, '--timeWindow') || '1h';
  const format = getArgValue(args, '--format') || 'json';
  
  // Load metrics from log files
  const metrics = loadMetricsFromLogs();
  
  // Create an isolated monitor instance for analysis
  const monitor = createPerformanceMonitor();
  
  // Import metrics
  metrics.forEach(m => monitor.recordMetric(m.metricName, m.value, m.details));
  
  // Generate time range based on window
  const timeRange = parseTimeWindow(timeWindow);
  
  // Generate and output report
  const report = monitor.generatePerformanceReport(timeRange);
  
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === 'csv') {
    outputCsv(report);
  }
  
  // Optionally save report
  const outputPath = getArgValue(args, '--output');
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to ${outputPath}`);
  }
  
  // Clean up
  monitor.dispose();
}

// Helper function to parse command line arguments
function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && index < args.length - 1) {
    return args[index + 1];
  }
  return null;
}

// Parse time window string (e.g., "1h", "30m", "1d") to time range
function parseTimeWindow(window) {
  const now = Date.now();
  const match = window.match(/^(\d+)([mhd])$/);
  
  if (!match) {
    throw new Error(`Invalid time window format: ${window}`);
  }
  
  const [_, value, unit] = match;
  let msMultiplier = 60 * 1000; // minutes by default
  
  if (unit === 'h') msMultiplier = 60 * 60 * 1000;
  if (unit === 'd') msMultiplier = 24 * 60 * 60 * 1000;
  
  const duration = parseInt(value) * msMultiplier;
  
  return {
    start: now - duration,
    end: now
  };
}

// Entry point
main().catch(console.error);