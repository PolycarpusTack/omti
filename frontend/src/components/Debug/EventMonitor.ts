/**
 * Enterprise-grade Event Monitoring System
 * 
 * This module provides comprehensive DOM event tracking, session recording,
 * test script generation capabilities, and context tracking with robust error handling,
 * performance optimizations, and type safety.
 * 
 * @module EventMonitor
 * @version 3.1.0
 */

import { Tab, Severity } from './debugTypes';
import { DebugLogger } from './DebugLogger';

/**
 * Event detail types with strict typing for improved type safety
 */
type MouseEventDetails = {
  readonly type: 'mouse';
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey?: boolean;
};

type KeyboardEventDetails = {
  readonly type: 'keyboard';
  readonly key: string;
  readonly code: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey?: boolean;
  readonly repeat?: boolean;
};

type InputEventDetails = {
  readonly type: 'input';
  readonly value: string;
  readonly inputType?: string;
  readonly isComposing?: boolean;
};

type DragEventDetails = {
  readonly type: 'drag';
  readonly dataTransfer: {
    readonly types: readonly string[];
    readonly files: number;
  } | null;
};

type FormEventDetails = {
  readonly type: 'form';
  readonly formId?: string;
  readonly formAction?: string;
  readonly formMethod?: string;
};

type CustomEventDetails = {
  readonly type: 'custom';
  readonly eventName: string;
  readonly data: Record<string, unknown>;
};

type GenericEventDetails = {
  readonly type: 'generic';
  readonly [key: string]: unknown;
};

/**
 * Union type of all possible event details
 */
type EventDetails = 
  | MouseEventDetails
  | KeyboardEventDetails
  | InputEventDetails
  | DragEventDetails
  | FormEventDetails
  | CustomEventDetails
  | GenericEventDetails;

/**
 * Element target information
 */
interface EventTarget {
  readonly tagName: string;
  readonly id?: string;
  readonly className?: string;
  readonly testId?: string;
  readonly text?: string;
  readonly attributes?: Record<string, string>;
  readonly path?: string;
}

/**
 * Comprehensive event data with readonly properties for immutability
 */
interface EventData {
  readonly id: string;
  readonly type: string;
  readonly timestamp: number;
  readonly target: EventTarget;
  readonly details: EventDetails;
  readonly url: string;
  readonly sessionId?: string;
  readonly context?: ContextInfo;
}

/**
 * Context tracking information
 */
interface ContextInfo {
  readonly name: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Performance metrics for self-monitoring
 */
interface PerformanceMetrics {
  readonly memoryUsage: number;
  readonly processingTime: number;
  readonly eventRatePerSecond: number;
  readonly samplingRate: number;
  readonly bufferUtilization: number;
}

/**
 * Privacy and compliance configuration
 */
interface PrivacyConfig {
  /** Enable PII detection and redaction */
  readonly piiDetection: 'none' | 'basic' | 'strict';
  /** Number of days to retain event data */
  readonly dataRetentionDays: number;
  /** Whether user consent is required for tracking */
  readonly consentRequired: boolean;
  /** Enable GDPR compliance mode */
  readonly gdprMode: boolean;
  /** Enable data minimization */
  readonly dataMinimization: boolean;
  /** Custom PII patterns to redact */
  readonly customPiiPatterns?: RegExp[];
}

/**
 * Configuration for custom event types
 */
interface CustomEventConfig {
  /** CSS selector for elements that trigger this event */
  readonly selector: string;
  /** Function to extract custom data */
  readonly dataExtractor: (element: HTMLElement, event: Event) => Record<string, unknown>;
  /** Importance level for prioritization */
  readonly importance: 'low' | 'medium' | 'high';
  /** Whether to throttle this event type */
  readonly throttle?: number;
}

/**
 * Configuration for heatmap visualization
 */
interface HeatmapConfig {
  /** Element to generate heatmap for (defaults to body) */
  readonly targetElement?: HTMLElement;
  /** Color scale for the heatmap */
  readonly colorScale?: 'default' | 'viridis' | 'thermal' | 'blues';
  /** Whether to normalize by element size */
  readonly normalizeByElementSize?: boolean;
  /** Max age of events to include (ms) */
  readonly maxEventAge?: number;
}

/**
 * Configuration options for EventMonitor
 */
interface EventMonitorConfig {
  /** Maximum number of events to store */
  readonly maxEvents?: number;
  /** Number of events to keep before an error */
  readonly eventsBeforeErrorCount?: number;
  /** CSS selectors for elements to ignore */
  readonly ignoredSelectors?: string[];
  /** Event types to track */
  readonly trackedEvents?: string[];
  /** Whether to use passive event listeners */
  readonly usePassiveListeners?: boolean;
  /** Whether to automatically start monitoring on initialization */
  readonly autoStart?: boolean;
  /** Session ID for grouping related events */
  readonly sessionId?: string;
  /** Sampling rate for performance (1.0 = track all events) */
  readonly samplingRate?: number;
  /** Maximum element text length to capture */
  readonly maxTextLength?: number;
  /** Privacy configuration */
  readonly privacy?: Partial<PrivacyConfig>;
  /** Performance monitoring interval in ms (0 to disable) */
  readonly performanceMonitoringInterval?: number;
}

/**
 * Monitors user interactions and DOM events with enterprise-grade reliability
 */
export class EventMonitor {
  /** Storage for captured events */
  private events: EventData[] = [];
  /** Logger instance for debug information */
  private readonly logger: DebugLogger;
  /** Merged configuration with defaults */
  private readonly config: Required<EventMonitorConfig>;
  /** Privacy configuration */
  private readonly privacyConfig: PrivacyConfig;
  /** Recording state flag */
  private isRecording: boolean = false;
  /** Recording start timestamp */
  private recordingStartTime: number = 0;
  /** Events captured before an error */
  private eventsBeforeError: EventData[] = [];
  /** Default session ID */
  private readonly sessionId: string;
  /** Collection of event handlers for cleanup */
  private eventHandlers: Map<string, EventListenerOrEventListenerObject> = new Map();
  /** Events processed count for metrics */
  private processedEventCount: number = 0;
  /** Events dropped count for metrics */
  private droppedEventCount: number = 0;
  /** Custom event definitions by name */
  private customEvents: Map<string, CustomEventConfig> = new Map();
  /** Context stack for tracking user actions and component hierarchies */
  private contextStack: ContextInfo[] = [];
  /** Performance metrics */
  private performanceMetrics: PerformanceMetrics = {
    memoryUsage: 0,
    processingTime: 0,
    eventRatePerSecond: 0,
    samplingRate: 1.0,
    bufferUtilization: 0
  };
  /** Performance monitoring interval ID */
  private performanceMonitoringIntervalId: number | null = null;
  /** Timestamp of last performance update */
  private lastPerformanceUpdateTime: number = 0;
  /** Events processed since last performance update */
  private eventsSinceLastPerformanceUpdate: number = 0;
  /** Processing times */
  private processingTimes: number[] = [];

  /** Default configuration settings */
  private static readonly DEFAULT_CONFIG: Required<EventMonitorConfig> = {
    maxEvents: 1000,
    eventsBeforeErrorCount: 50,
    ignoredSelectors: ['.debug-console', '[data-debug-ignore]'],
    trackedEvents: [
      'click',
      'dblclick',
      'focus',
      'blur',
      'change',
      'input',
      'submit',
      'keydown',
      'dragstart',
      'dragend',
      'drop'
    ],
    usePassiveListeners: true,
    autoStart: false,
    sessionId: '',
    samplingRate: 1.0,
    maxTextLength: 100,
    privacy: {},
    performanceMonitoringInterval: 30000
  };

  /** Default privacy configuration */
  private static readonly DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
    piiDetection: 'basic',
    dataRetentionDays: 30,
    consentRequired: false,
    gdprMode: false,
    dataMinimization: true
  };

  /** Common PII patterns to detect and redact */
  private static readonly PII_PATTERNS: Record<string, RegExp> = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    phone: /\b(?:\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    ipv4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    password: /\bpassword\s*[=:]\s*\S+/gi
  };

  /**
   * Create a new EventMonitor instance
   * @param config - Configuration options
   * @throws Error if configuration is invalid
   */
  constructor(config: EventMonitorConfig = {}) {
    // Get logger instance
    this.logger = DebugLogger.getInstance();

    // Merge provided config with defaults
    this.config = {
      ...EventMonitor.DEFAULT_CONFIG,
      ...config
    };

    // Set up privacy configuration
    this.privacyConfig = {
      ...EventMonitor.DEFAULT_PRIVACY_CONFIG,
      ...this.config.privacy
    };

    // Validate configuration
    this.validateConfig();

    // Generate a unique session ID if not provided
    this.sessionId = this.config.sessionId || this.generateSessionId();

    // Auto-start if configured
    if (this.config.autoStart) {
      try {
        this.startMonitoring();
      } catch (error) {
        this.logger.log(
          Tab.Events,
          'Failed to auto-start event monitoring',
          { error: this.formatError(error) },
          Severity.Error
        );
      }
    }

    // Start performance monitoring if enabled
    if (this.config.performanceMonitoringInterval > 0) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Validate the configuration values
   * @throws Error if configuration is invalid
   */
  private validateConfig(): void {
    if (this.config.maxEvents < 50) {
      throw new Error('EventMonitor: maxEvents must be at least 50');
    }

    if (this.config.eventsBeforeErrorCount < 1) {
      throw new Error('EventMonitor: eventsBeforeErrorCount must be at least 1');
    }

    if (this.config.samplingRate <= 0 || this.config.samplingRate > 1) {
      throw new Error('EventMonitor: samplingRate must be between 0 and 1');
    }

    if (this.config.maxTextLength < 10) {
      throw new Error('EventMonitor: maxTextLength must be at least 10');
    }

    if (this.config.performanceMonitoringInterval < 0) {
      throw new Error('EventMonitor: performanceMonitoringInterval must not be negative');
    }
  }

  /**
   * Generate a unique session ID
   * @returns A unique session identifier
   */
  private generateSessionId(): string {
    return `event_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Define a custom event type for domain-specific tracking
   * @param name - Name of the custom event
   * @param config - Configuration for the custom event
   */
  defineCustomEventType(name: string, config: CustomEventConfig): void {
    if (this.customEvents.has(name)) {
      this.logger.log(
        Tab.Events,
        `Custom event type "${name}" already exists and will be overwritten`,
        {},
        Severity.Warn
      );
    }

    try {
      // Validate selector
      document.querySelector(config.selector);
      
      // Store custom event definition
      this.customEvents.set(name, config);
      
      this.logger.log(
        Tab.Events,
        `Custom event type "${name}" defined`,
        {
          selector: config.selector,
          importance: config.importance
        },
        Severity.Info
      );
    } catch (error) {
      this.logger.log(
        Tab.Events,
        `Failed to define custom event type "${name}"`,
        { error: this.formatError(error) },
        Severity.Error
      );
      throw new Error(`Invalid selector for custom event type "${name}": ${error}`);
    }
  }

  /**
   * Remove a custom event type definition
   * @param name - Name of the custom event to remove
   */
  removeCustomEventType(name: string): void {
    if (this.customEvents.has(name)) {
      this.customEvents.delete(name);
      
      this.logger.log(
        Tab.Events,
        `Custom event type "${name}" removed`,
        {},
        Severity.Info
      );
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceMonitoringIntervalId !== null) {
      return;
    }

    this.lastPerformanceUpdateTime = Date.now();
    this.eventsSinceLastPerformanceUpdate = 0;
    
    // Update initial metrics
    this.updatePerformanceMetrics();
    
    // Set up interval for metrics collection
    this.performanceMonitoringIntervalId = window.setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceMonitoringInterval);
    
    this.logger.log(
      Tab.Events,
      'Performance monitoring started',
      {
        intervalMs: this.config.performanceMonitoringInterval
      },
      Severity.Info
    );
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitoringIntervalId !== null) {
      window.clearInterval(this.performanceMonitoringIntervalId);
      this.performanceMonitoringIntervalId = null;
      
      this.logger.log(
        Tab.Events,
        'Performance monitoring stopped',
        {},
        Severity.Info
      );
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastPerformanceUpdateTime;
    
    // Calculate event rate
    let eventRate = 0;
    if (elapsedTime > 0) {
      eventRate = (this.eventsSinceLastPerformanceUpdate / elapsedTime) * 1000;
    }
    
    // Calculate average processing time
    let avgProcessingTime = 0;
    if (this.processingTimes.length > 0) {
      avgProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
    
    // Reset for next interval
    this.processingTimes = [];
    this.lastPerformanceUpdateTime = now;
    this.eventsSinceLastPerformanceUpdate = 0;
    
    // Get memory usage if available
    let memoryUsage = 0;
    if (window.performance && 'memory' in window.performance) {
      memoryUsage = (window.performance as any).memory.usedJSHeapSize;
    }
    
    // Update metrics
    this.performanceMetrics = {
      memoryUsage,
      processingTime: avgProcessingTime,
      eventRatePerSecond: eventRate,
      samplingRate: this.config.samplingRate,
      bufferUtilization: this.events.length / this.config.maxEvents
    };
    
    this.logger.log(
      Tab.Events,
      'Performance metrics updated',
      {
        metrics: this.performanceMetrics,
        totalProcessed: this.processedEventCount,
        totalDropped: this.droppedEventCount
      },
      Severity.Debug
    );
  }

  /**
   * Get the current performance metrics
   * @returns Copy of current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Force an update to get the latest metrics
    this.updatePerformanceMetrics();
    return { ...this.performanceMetrics };
  }

  /**
   * Get performance impact analysis
   * @returns Impact analysis with recommendations
   */
  getPerformanceImpact(): Record<string, unknown> {
    this.updatePerformanceMetrics();
    
    const impact = {
      memoryOverhead: this.formatMemorySize(this.performanceMetrics.memoryUsage),
      cpuUtilization: this.performanceMetrics.processingTime > 10 ? 'high' : this.performanceMetrics.processingTime > 3 ? 'medium' : 'low',
      processingTimePerEvent: `${this.performanceMetrics.processingTime.toFixed(2)}ms`,
      eventRatePerSecond: `${this.performanceMetrics.eventRatePerSecond.toFixed(2)} events/sec`,
      bufferUtilization: `${(this.performanceMetrics.bufferUtilization * 100).toFixed(1)}%`,
      optimizationSuggestions: [] as string[]
    };
    
    // Generate optimization suggestions
    if (this.performanceMetrics.processingTime > 10) {
      impact.optimizationSuggestions.push('Consider increasing sampling rate to reduce CPU usage');
    }
    
    if (this.performanceMetrics.bufferUtilization > 0.8) {
      impact.optimizationSuggestions.push('Buffer utilization is high, consider increasing maxEvents or reducing the data retention period');
    }
    
    if (this.processedEventCount > 10000 && this.config.trackedEvents.length > 5) {
      impact.optimizationSuggestions.push('Track fewer event types to improve performance');
    }
    
    return impact;
  }

  /**
   * Format memory size for human readability
   * @param bytes - Size in bytes
   * @returns Formatted string with appropriate unit
   */
  private formatMemorySize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
  }

  /**
   * Configure privacy settings
   * @param config - Privacy configuration to apply
   */
  setPrivacyControls(config: Partial<PrivacyConfig>): void {
    this.privacyConfig = {
      ...this.privacyConfig,
      ...config
    };
    
    this.logger.log(
      Tab.Events,
      'Privacy controls updated',
      {
        piiDetection: this.privacyConfig.piiDetection,
        dataRetentionDays: this.privacyConfig.dataRetentionDays,
        consentRequired: this.privacyConfig.consentRequired,
        gdprMode: this.privacyConfig.gdprMode,
        dataMinimization: this.privacyConfig.dataMinimization
      },
      Severity.Info
    );
    
    // Apply data retention policy immediately
    this.applyDataRetentionPolicy();
  }

  /**
   * Apply the data retention policy based on configuration
   */
  private applyDataRetentionPolicy(): void {
    const retentionThreshold = Date.now() - (this.privacyConfig.dataRetentionDays * 24 * 60 * 60 * 1000);
    const initialCount = this.events.length;
    
    // Filter out events older than the retention threshold
    this.events = this.events.filter(event => event.timestamp >= retentionThreshold);
    
    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      this.logger.log(
        Tab.Events,
        'Applied data retention policy',
        {
          removedEvents: removedCount,
          retentionDays: this.privacyConfig.dataRetentionDays
        },
        Severity.Info
      );
    }
  }

  /**
   * Wrap a function with automatic context management
   * @param name - Context name
   * @param data - Context data
   * @param fn - Function to wrap
   * @returns Wrapped function that manages context
   */
  wrapWithContext<T extends (...args: any[]) => any>(
    name: string,
    data: Record<string, unknown>,
    fn: T
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      // Push context before execution
      this.pushContext(name, {
        ...data,
        arguments: args.map(arg => 
          typeof arg === 'object' ? 'object' : 
          typeof arg === 'function' ? 'function' : 
          arg
        )
      });
      
      try {
        // Execute the wrapped function
        const result = fn(...args);
        
        // Handle promises specially
        if (result instanceof Promise) {
          return result
            .then(value => {
              this.popContext();
              return value;
            })
            .catch(error => {
              this.popContext();
              throw error;
            }) as ReturnType<T>;
        }
        
        // Pop context after synchronous execution
        this.popContext();
        return result;
      } catch (error) {
        // Ensure context is popped even if an error occurs
        this.popContext();
        throw error;
      }
    };
  }

  /**
   * Start monitoring events
   * @throws Error if monitoring fails to start
   */
  startMonitoring(): void {
    // Check if user consent is required but not granted
    if (this.privacyConfig.consentRequired && !this.hasUserConsent()) {
      this.logger.log(
        Tab.Events,
        'Event monitoring requires user consent',
        {},
        Severity.Warn
      );
      return;
    }

    try {
      // Create and store event handler references for proper cleanup
      this.config.trackedEvents.forEach(eventType => {
        // Create a bound handler for this event type
        const handler = this.createEventHandler(eventType);
        this.eventHandlers.set(eventType, handler);

        // Add the event listener with appropriate options
        document.addEventListener(
          eventType,
          handler,
          {
            capture: true,
            passive: this.config.usePassiveListeners
          }
        );
      });

      // Also set up handlers for custom events
      this.setupCustomEventHandlers();

      // Log successful monitoring start
      this.logger.log(
        Tab.Events,
        'Event monitoring started',
        {
          trackedEvents: this.config.trackedEvents,
          customEvents: Array.from(this.customEvents.keys()),
          sessionId: this.sessionId,
          usePassiveListeners: this.config.usePassiveListeners
        },
        Severity.Info
      );
    } catch (error) {
      // Log error and rethrow
      this.logger.log(
        Tab.Events,
        'Failed to start event monitoring',
        { error: this.formatError(error) },
        Severity.Error
      );
      throw error;
    }
  }

  /**
   * Check if user consent has been granted
   * @returns Whether consent is granted
   */
  private hasUserConsent(): boolean {
    // Simple consent check, would be replaced with actual consent management in production
    const consentCookie = document.cookie
      .split('; ')
      .find(cookie => cookie.startsWith('event_monitor_consent='));
    
    return consentCookie !== undefined && consentCookie.split('=')[1] === 'granted';
  }

  /**
   * Set up event listeners for custom events
   */
  private setupCustomEventHandlers(): void {
    this.customEvents.forEach((config, eventName) => {
      try {
        const handler = (event: Event) => {
          if (event.target instanceof HTMLElement && event.target.matches(config.selector)) {
            try {
              // Extract custom data using the provided function
              const data = config.dataExtractor(event.target, event);
              
              // Create a custom event
              this.recordCustomEvent(eventName, event.target, data);
            } catch (error) {
              this.logger.log(
                Tab.Events,
                `Error processing custom event "${eventName}"`,
                { error: this.formatError(error) },
                Severity.Error
              );
            }
          }
        };
        
        // Add click listener for this custom event
        document.addEventListener(
          'click',
          handler,
          {
            capture: true,
            passive: true
          }
        );
        
        // Store handler with unique key for cleanup
        this.eventHandlers.set(`custom_${eventName}`, handler);
      } catch (error) {
        this.logger.log(
          Tab.Events,
          `Failed to set up handler for custom event "${eventName}"`,
          { error: this.formatError(error) },
          Severity.Error
        );
      }
    });
  }

  /**
   * Record a custom event
   * @param eventName - Name of the custom event
   * @param target - Target element
   * @param data - Custom event data
   */
  private recordCustomEvent(eventName: string, target: HTMLElement, data: Record<string, unknown>): void {
    // Create event data structure
    const eventData: EventData = {
      id: this.generateEventId(),
      type: `custom:${eventName}`,
      timestamp: Date.now(),
      target: this.extractTargetInfo(target),
      details: {
        type: 'custom',
        eventName,
        data: this.redactPiiFromData(data)
      },
      url: window.location.href,
      sessionId: this.sessionId
    };
    
    // Store the event
    this.addEvent(eventData);
    
    // Log the custom event
    const config = this.customEvents.get(eventName);
    if (config && config.importance === 'high') {
      this.logger.log(
        Tab.Events,
        `Custom event "${eventName}" recorded`,
        {
          data: eventData.details.data,
          target: eventData.target
        },
        Severity.Info
      );
    }
  }

  /**
   * Redact PII from data based on privacy settings
   * @param data - Data to redact PII from
   * @returns Redacted data
   */
  private redactPiiFromData(data: Record<string, unknown>): Record<string, unknown> {
    if (this.privacyConfig.piiDetection === 'none') {
      return data;
    }
    
    const redactedData = { ...data };
    
    // Apply redaction to string values
    for (const [key, value] of Object.entries(redactedData)) {
      if (typeof value === 'string') {
        redactedData[key] = this.redactPii(value);
      }
    }
    
    return redactedData;
  }

  /**
   * Redact PII from a string
   * @param text - Text to redact
   * @returns Redacted text
   */
  private redactPii(text: string): string {
    // Skip if PII detection is disabled
    if (this.privacyConfig.piiDetection === 'none') {
      return text;
    }
    
    let redactedText = text;
    
    // Apply common PII patterns
    for (const [type, pattern] of Object.entries(EventMonitor.PII_PATTERNS)) {
      // For basic mode, only redact the most sensitive data
      if (this.privacyConfig.piiDetection === 'basic' && !['email', 'creditCard', 'ssn'].includes(type)) {
        continue;
      }
      
      redactedText = redactedText.replace(pattern, `[REDACTED ${type.toUpperCase()}]`);
    }
    
    // Apply custom patterns if provided
    if (this.privacyConfig.customPiiPatterns) {
      for (const pattern of this.privacyConfig.customPiiPatterns) {
        redactedText = redactedText.replace(pattern, '[REDACTED CUSTOM]');
      }
    }
    
    return redactedText;
  }

  /**
   * Stop monitoring events
   */
  stopMonitoring(): void {
    try {
      // Remove all registered event listeners
      this.eventHandlers.forEach((handler, eventType) => {
        document.removeEventListener(
          eventType,
          handler,
          { capture: true }
        );
      });

      // Clear the handler references
      this.eventHandlers.clear();

      // Log monitoring stopped with metrics
      this.logger.log(
        Tab.Events,
        'Event monitoring stopped',
        {
          processedEvents: this.processedEventCount,
          droppedEvents: this.droppedEventCount,
          capturedEvents: this.events.length
        },
        Severity.Info
      );
    } catch (error) {
      // Log error during cleanup
      this.logger.log(
        Tab.Events,
        'Error stopping event monitoring',
        { error: this.formatError(error) },
        Severity.Error
      );
    }
  }

  /**
   * Create a type-specific event handler
   * @param eventType - The DOM event type
   * @returns Event handler function
   */
  private createEventHandler(eventType: string): EventListener {
    return (event: Event) => {
      try {
        this.handleEvent(eventType, event);
      } catch (error) {
        // Prevent event handler errors from bubbling up
        this.logger.log(
          Tab.Events,
          `Error in ${eventType} event handler`,
          { error: this.formatError(error) },
          Severity.Error
        );
      }
    };
  }

  /**
   * Start recording a user session
   */
  startRecording(): void {
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.eventsBeforeError = [];
    
    this.logger.log(
      Tab.Events,
      'Session recording started',
      {
        timestamp: this.recordingStartTime,
        sessionId: this.sessionId
      },
      Severity.Info
    );
  }
  
  /**
   * Stop recording and return the recorded session
   * @returns Array of recorded events
   */
  stopRecording(): EventData[] {
    const recordingEndTime = Date.now();
    this.isRecording = false;
    
    // Get events from the recording period
    const recordedEvents = this.events.filter(
      event => event.timestamp >= this.recordingStartTime && event.timestamp <= recordingEndTime
    );
    
    this.logger.log(
      Tab.Events,
      'Session recording stopped',
      {
        startTime: this.recordingStartTime,
        endTime: recordingEndTime,
        duration: recordingEndTime - this.recordingStartTime,
        eventCount: recordedEvents.length,
        sessionId: this.sessionId
      },
      Severity.Info
    );
    
    return recordedEvents;
  }
  
  /**
   * Get all recorded events
   * @returns Copy of all recorded events
   */
  getEvents(): ReadonlyArray<EventData> {
    return [...this.events];
  }
  
  /**
   * Filter events by type
   * @param eventType - The event type to filter by
   * @returns Array of matching events
   */
  getEventsByType(eventType: string): ReadonlyArray<EventData> {
    return this.events.filter(event => event.type === eventType);
  }
  
  /**
   * Get events that occurred before an error
   * @returns Copy of events before error
   */
  getEventsBeforeError(): ReadonlyArray<EventData> {
    return [...this.eventsBeforeError];
  }
  
  /**
   * Clear all recorded events
   */
  clearEvents(): void {
    const previousCount = this.events.length;
    this.events = [];
    
    this.logger.log(
      Tab.Events,
      'Event history cleared',
      { previousCount },
      Severity.Info
    );
  }
  
  /**
   * Save events that occurred before an error
   */
  captureEventsBeforeError(): void {
    // Save up to the configured number of events before an error
    const recentEvents = this.events.slice(-this.config.eventsBeforeErrorCount);
    this.eventsBeforeError = recentEvents;
    
    this.logger.log(
      Tab.Events,
      'Captured events before error',
      {
        eventCount: recentEvents.length,
        maxEvents: this.config.eventsBeforeErrorCount,
        sessionId: this.sessionId
      },
      Severity.Info
    );
  }

  /**
   * Generate a test script from recorded events
   * @param events - Optional specific events to use (defaults to events before error)
   * @returns Generated test script as a string
   */
  generateTestScript(events?: EventData[]): string {
    const targetEvents = events || this.eventsBeforeError;
    
    if (targetEvents.length === 0) {
      return '// No events to generate test script from';
    }
    
    try {
      let script = `
/**
 * Generated Test Script
 * Created: ${new Date().toISOString()}
 * Events: ${targetEvents.length}
 * Session: ${this.sessionId}
 */
describe('User Interaction Test', () => {
  test('should replicate user interactions', async () => {
    // Navigate to the page
    await page.goto('${targetEvents[0]?.url || window.location.href}');
    
`;
      
      targetEvents.forEach((event, index) => {
        const { type, target } = event;
        const selector = this.generateSelector(target);
        
        switch (type) {
          case 'click':
            script += `    // Click on ${target.tagName}${target.text ? ` with text "${target.text}"` : ''}
    await page.click('${selector}');\n`;
            break;
          
          case 'input':
          case 'change':
            if ('type' in event.details && event.details.type === 'input' && 'value' in event.details) {
              script += `    // Type into ${target.tagName}
    await page.type('${selector}', '${(event.details as InputEventDetails).value.replace(/'/g, "\\'")}');\n`;
            }
            break;
          
          case 'submit':
            script += `    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('${selector}')
    ]);\n`;
            break;
          
          case 'keydown':
            if ('type' in event.details && event.details.type === 'keyboard' && 'key' in event.details) {
              script += `    // Press ${(event.details as KeyboardEventDetails).key} key
    await page.keyboard.press('${(event.details as KeyboardEventDetails).key}');\n`;
            }
            break;
          
          case 'drop':
            script += `    // Handle file drop
    await page.setInputFiles('${selector}', 'test-file.txt');\n`;
            break;

          // Handle custom events
          default:
            if (type.startsWith('custom:')) {
              const customEventName = type.split(':')[1];
              script += `    // Custom event: ${customEventName} on ${target.tagName}
    await page.waitForSelector('${selector}');\n`;
            } else {
              // Generic event handler
              script += `    // ${type} on ${target.tagName}
    await page.waitForSelector('${selector}');\n`;
            }
            break;
        }
        
        // Add a delay between actions for more realistic playback
        if (index < targetEvents.length - 1) {
          script += `    await page.waitForTimeout(100);\n`;
        }
      });
      
      script += `
    // Verify the expected results
    // Add assertions here based on expected application state
    // await expect(page).toMatchElement('.success-message', { text: 'Operation completed' });
  });
});
`;
      
      return script;
    } catch (error) {
      this.logger.log(
        Tab.Events,
        'Error generating test script',
        { error: this.formatError(error) },
        Severity.Error
      );
      return `// Error generating test script: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generate a basic click heatmap visualization
   * @param config - Configuration for the heatmap
   * @returns HTML/CSS for a heatmap visualization
   */
  generateHeatmap(config: HeatmapConfig = {}): string {
    try {
      // Default configuration
      const targetElement = config.targetElement || document.body;
      const colorScale = config.colorScale || 'default';
      const normalizeByElementSize = config.normalizeByElementSize || false;
      const maxEventAge = config.maxEventAge || 24 * 60 * 60 * 1000; // 24 hours default
      
      // Get click events within the time range
      const minTimestamp = Date.now() - maxEventAge;
      const clickEvents = this.events.filter(
        event => event.type === 'click' && event.timestamp >= minTimestamp
      );
      
      if (clickEvents.length === 0) {
        return 'No click events to generate heatmap from';
      }
      
      // Get target element dimensions and position
      const rect = targetElement.getBoundingClientRect();
      const targetWidth = rect.width;
      const targetHeight = rect.height;
      
      // Record click positions relative to the target element
      const clickPositions: Array<{x: number, y: number}> = [];
      
      clickEvents.forEach(event => {
        if (
          'details' in event && 
          event.details.type === 'mouse' &&
          'x' in event.details && 
          'y' in event.details
        ) {
          const mouseDetails = event.details as MouseEventDetails;
          
          // Calculate position relative to the target element
          // Note: This is a simplified approach and would need to be adjusted
          // for scrolling and element positioning in a real implementation
          clickPositions.push({
            x: mouseDetails.x - rect.left,
            y: mouseDetails.y - rect.top
          });
        }
      });
      
      // Generate CSS for different color scales
      let colorGradient = '';
      switch (colorScale) {
        case 'viridis':
          colorGradient = 'rgba(68, 1, 84, 0.7), rgba(59, 82, 139, 0.7), rgba(33, 144, 141, 0.7), rgba(93, 201, 99, 0.7), rgba(253, 231, 37, 0.7)';
          break;
        case 'thermal':
          colorGradient = 'rgba(0, 0, 255, 0.7), rgba(128, 0, 255, 0.7), rgba(255, 0, 128, 0.7), rgba(255, 128, 0, 0.7), rgba(255, 255, 0, 0.7)';
          break;
        case 'blues':
          colorGradient = 'rgba(8, 48, 107, 0.7), rgba(8, 81, 156, 0.7), rgba(33, 113, 181, 0.7), rgba(66, 146, 198, 0.7), rgba(158, 202, 225, 0.7)';
          break;
        default:
          colorGradient = 'rgba(0, 0, 255, 0.7), rgba(0, 255, 0, 0.7), rgba(255, 255, 0, 0.7), rgba(255, 128, 0, 0.7), rgba(255, 0, 0, 0.7)';
          break;
      }
      
      // Generate heatmap visualization as HTML with CSS
      let heatmapHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Click Heatmap</title>
  <style>
    .heatmap-container {
      position: relative;
      width: ${targetWidth}px;
      height: ${targetHeight}px;
      background-color: rgba(0, 0, 0, 0.1);
      margin: 20px;
      overflow: hidden;
    }
    .heatmap-point {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, ${colorGradient});
      opacity: 0.6;
    }
    .heatmap-info {
      margin: 20px;
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div class="heatmap-info">
    <h2>Click Heatmap</h2>
    <p>Total clicks: ${clickPositions.length}</p>
    <p>Time range: ${new Date(minTimestamp).toLocaleString()} to ${new Date().toLocaleString()}</p>
  </div>
  <div class="heatmap-container">
`;
      
      // Add click points
      clickPositions.forEach((pos, index) => {
        // Skip if outside the element
        if (pos.x < 0 || pos.x > targetWidth || pos.y < 0 || pos.y > targetHeight) {
          return;
        }
        
        // Adjust size if normalizing by element size
        let size = 20;
        if (normalizeByElementSize) {
          size = Math.max(10, Math.min(30, (targetWidth * targetHeight) / 30000));
        }
        
        heatmapHtml += `    <div class="heatmap-point" style="left: ${pos.x}px; top: ${pos.y}px; width: ${size}px; height: ${size}px;"></div>\n`;
      });
      
      heatmapHtml += `  </div>
</body>
</html>`;
      
      return heatmapHtml;
    } catch (error) {
      this.logger.log(
        Tab.Events,
        'Error generating heatmap',
        { error: this.formatError(error) },
        Severity.Error
      );
      return `Error generating heatmap: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Process a DOM event and extract relevant information
   * @param eventType - Type of the event
   * @param event - The raw DOM event object
   */
  private handleEvent(eventType: string, event: Event): void {
    // For specific events that represent user actions, automatically manage context
    if (this.shouldManageContextForEvent(eventType, event)) {
      this.manageContextForEvent(eventType, event);
    }
    // Track processing start time
    const startTime = performance.now();

    // Performance optimization: Apply sampling rate to reduce overhead
    if (Math.random() > this.config.samplingRate) {
      this.droppedEventCount++;
      return;
    }

    // Update processed count
    this.processedEventCount++;
    this.eventsSinceLastPerformanceUpdate++;

    // Skip specific elements based on configured selectors
    if (this.shouldIgnoreEvent(event)) {
      return;
    }
    
    const target = event.target as HTMLElement;
    if (!target || !('tagName' in target)) {
      // Skip events without valid targets
      return;
    }
    
    try {
      // Create standardized event data
      const eventData: EventData = {
        id: this.generateEventId(),
        type: eventType,
        timestamp: Date.now(),
        target: this.extractTargetInfo(target),
        details: this.extractEventDetails(event),
        url: window.location.href,
        sessionId: this.sessionId,
        context: this.getCurrentContext() // Include current context if available
      };
      
      // Apply data minimization if enabled
      const finalEventData = this.privacyConfig.dataMinimization ? 
        this.minimizeEventData(eventData) : eventData;
      
      // Store the event with buffer management
      this.addEvent(finalEventData);
      
      // Log specific important events
      this.logRelevantEvent(eventType, finalEventData);
      
      // Track processing time
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);
    } catch (error) {
      this.logger.log(
        Tab.Events,
        `Error processing ${eventType} event`,
        { 
          error: this.formatError(error),
          elementInfo: this.getSafeElementInfo(target)
        },
        Severity.Error
      );
    }
  }

  /**
   * Apply data minimization to reduce stored event data
   * @param eventData - Full event data
   * @returns Minimized event data
   */
  private minimizeEventData(eventData: EventData): EventData {
    // Skip minimization for important events
    if (['submit', 'error'].includes(eventData.type)) {
      return eventData;
    }
    
    // Create a copy with minimal target info
    const minimizedTarget: EventTarget = {
      tagName: eventData.target.tagName,
      path: eventData.target.path
    };
    
    // Keep ID and test ID as they're important for selectors
    if (eventData.target.id) {
      minimizedTarget.id = eventData.target.id;
    }
    
    if (eventData.target.testId) {
      minimizedTarget.testId = eventData.target.testId;
    }
    
    // Minimize details based on event type
    let minimizedDetails: EventDetails;
    
    switch (eventData.details.type) {
      case 'mouse':
        // Keep only coordinates for mouse events
        minimizedDetails = {
          type: 'mouse',
          x: eventData.details.x,
          y: eventData.details.y,
          button: eventData.details.button,
          altKey: false,
          ctrlKey: false,
          shiftKey: false
        };
        break;
        
      case 'keyboard':
        // Keep only key info for keyboard events
        minimizedDetails = {
          type: 'keyboard',
          key: eventData.details.key,
          code: eventData.details.code,
          altKey: eventData.details.altKey,
          ctrlKey: eventData.details.ctrlKey,
          shiftKey: eventData.details.shiftKey
        };
        break;
        
      case 'input':
        // Truncate input values and remove unnecessary fields
        minimizedDetails = {
          type: 'input',
          value: eventData.details.value.length > 10 ? 
            `${eventData.details.value.substring(0, 10)}...` : 
            eventData.details.value
        };
        break;
        
      default:
        // Keep original details for other event types
        minimizedDetails = eventData.details;
        break;
    }
    
    return {
      ...eventData,
      target: minimizedTarget,
      details: minimizedDetails
    };
  }

  /**
   * Check if an event should be ignored based on configuration
   * @param event - The DOM event to check
   * @returns True if the event should be ignored
   */
  private shouldIgnoreEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    
    // Skip if no valid target
    if (!target || !('tagName' in target)) {
      return true;
    }
    
    // Check against ignored selectors
    return this.config.ignoredSelectors.some(selector => {
      try {
        return !!target.closest(selector);
      } catch (error) {
        // If selector is invalid, log warning and don't ignore
        this.logger.log(
          Tab.Events,
          `Invalid ignored selector: ${selector}`,
          { error: this.formatError(error) },
          Severity.Warn
        );
        return false;
      }
    });
  }

  /**
   * Add an event to storage with buffer management
   * @param eventData - The event data to store
   */
  private addEvent(eventData: EventData): void {
    if (this.events.length >= this.config.maxEvents) {
      // Remove oldest events when buffer is full (20% at a time for performance)
      const itemsToRemove = Math.ceil(this.config.maxEvents * 0.2);
      this.events = this.events.slice(itemsToRemove);
    }
    
    // Add new event
    this.events.push(eventData);
  }

  /**
   * Log certain important events for analysis
   * @param eventType - Type of the event
   * @param eventData - Processed event data
   */
  private logRelevantEvent(eventType: string, eventData: EventData): void {
    // Only log specific important events to avoid noise
    if (['click', 'submit', 'drop', 'error'].includes(eventType)) {
      this.logger.log(
        Tab.Events,
        `User ${eventType} on ${eventData.target.tagName}`,
        {
          elementDetails: eventData.target,
          eventDetails: eventData.details,
          sessionId: this.sessionId,
          url: eventData.url
        },
        Severity.Info
      );
    }
    
    // Also log custom events with high importance
    if (eventType.startsWith('custom:')) {
      const customEventName = eventType.split(':')[1];
      const config = this.customEvents.get(customEventName);
      
      if (config && config.importance === 'high') {
        this.logger.log(
          Tab.Events,
          `Custom event "${customEventName}" triggered`,
          {
            elementDetails: eventData.target,
            eventDetails: eventData.details,
            sessionId: this.sessionId
          },
          Severity.Info
        );
      }
    }
  }

  /**
   * Extract target element information safely
   * @param element - DOM element to extract information from
   * @returns Structured target information
   */
  private extractTargetInfo(element: HTMLElement): EventTarget {
    try {
      const tagName = element.tagName?.toLowerCase() || 'unknown';
      
      // Basic target info
      const target: EventTarget = {
        tagName,
        path: this.getElementPath(element)
      };
      
      // Optional properties with null checks
      if (element.id) {
        target.id = element.id;
      }
      
      if (element.className && typeof element.className === 'string') {
        target.className = element.className;
      }
      
      // Extract test IDs for testing frameworks
      const testId = element.getAttribute('data-test-id') || 
                     element.getAttribute('data-testid') || 
                     element.getAttribute('data-cy') ||
                     element.getAttribute('data-e2e');
      
      if (testId) {
        target.testId = testId;
      }
      
      // Extract text content safely
      const text = this.getElementText(element);
      if (text) {
        // Apply PII redaction to text content
        target.text = this.redactPii(text);
      }
      
      // Extract key attributes for specific elements
      if (tagName === 'input' || tagName === 'button' || tagName === 'a' || tagName === 'form') {
        target.attributes = this.getKeyAttributes(element);
      }
      
      return target;
    } catch (error) {
      // Provide minimal information if extraction fails
      return {
        tagName: 'unknown',
        text: 'Error extracting target info'
      };
    }
  }

  /**
   * Get key attributes based on element type
   * @param element - DOM element to extract attributes from
   * @returns Record of key attributes
   */
  private getKeyAttributes(element: HTMLElement): Record<string, string> {
    const attributes: Record<string, string> = {};
    const tagName = element.tagName.toLowerCase();
    
    try {
      if (tagName === 'input') {
        const inputEl = element as HTMLInputElement;
        if (inputEl.type) attributes.type = inputEl.type;
        if (inputEl.name) attributes.name = inputEl.name;
        if (inputEl.placeholder) attributes.placeholder = this.redactPii(inputEl.placeholder);
        
        // Don't capture values for sensitive input types
        if (inputEl.type !== 'password' && inputEl.type !== 'hidden') {
          // For other inputs, redact potential PII
          if (inputEl.value) attributes.value = this.redactPii(inputEl.value);
        }
      } else if (tagName === 'button') {
        const buttonEl = element as HTMLButtonElement;
        if (buttonEl.name) attributes.name = buttonEl.name;
        if (buttonEl.type) attributes.type = buttonEl.type;
      } else if (tagName === 'a') {
        const linkEl = element as HTMLAnchorElement;
        if (linkEl.href) {
          // Redact potential PII in URLs (like email addresses in mailto: links)
          attributes.href = this.redactPii(linkEl.href);
        }
        if (linkEl.target) attributes.target = linkEl.target;
      } else if (tagName === 'form') {
        const formEl = element as HTMLFormElement;
        if (formEl.action) attributes.action = formEl.action;
        if (formEl.method) attributes.method = formEl.method;
        if (formEl.name) attributes.name = formEl.name;
      }
    } catch (error) {
      // Silent error for attributes - non-critical
    }
    
    return attributes;
  }

  /**
   * Extract safe text content from an element
   * @param element - DOM element to extract text from
   * @returns Sanitized text content or undefined
   */
  private getElementText(element: HTMLElement): string | undefined {
    try {
      const text = element.textContent?.trim();
      if (!text) return undefined;
      
      // Clean and truncate text
      return this.sanitizeText(text, this.config.maxTextLength);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Sanitize and truncate text for safety
   * @param text - Raw text to sanitize
   * @param maxLength - Maximum length to allow
   * @returns Sanitized text
   */
  private sanitizeText(text: string, maxLength: number): string {
    // Remove potentially dangerous characters
    const sanitized = text
      .replace(/[<>"'&]/g, c => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#39;';
          case '&': return '&amp;';
          default: return c;
        }
      });
    
    // Truncate if too long
    if (sanitized.length > maxLength) {
      return sanitized.substring(0, maxLength - 3) + '...';
    }
    
    return sanitized;
  }

  /**
   * Extract DOM path for an element
   * @param element - Element to get path for
   * @returns CSS selector path
   */
  private getElementPath(element: HTMLElement): string {
    try {
      const path: string[] = [];
      let currentElement: HTMLElement | null = element;
      
      // Walk up the DOM tree to build path
      while (currentElement && currentElement !== document.body && path.length < 10) {
        // Generate a selector for this level
        let selector = currentElement.tagName.toLowerCase();
        
        if (currentElement.id) {
          selector += `#${currentElement.id}`;
        } else if (currentElement.className && typeof currentElement.className === 'string') {
          const classes = currentElement.className.split(/\s+/).filter(c => c.length > 0);
          if (classes.length > 0) {
            selector += `.${classes.join('.')}`;
          }
        }
        
        // Add to path and move up
        path.unshift(selector);
        currentElement = currentElement.parentElement;
      }
      
      return path.join(' > ');
    } catch (error) {
      return 'unknown-path';
    }
  }

  /**
   * Extract detailed event information based on event type
   * @param event - DOM event object
   * @returns Structured event details
   */
  private extractEventDetails(event: Event): EventDetails {
    try {
      switch (event.type) {
        case 'click':
        case 'dblclick':
        case 'mousedown':
        case 'mouseup':
        case 'mousemove':
          return this.extractMouseEventDetails(event as MouseEvent);
        
        case 'keydown':
        case 'keyup':
        case 'keypress':
          return this.extractKeyboardEventDetails(event as KeyboardEvent);
        
        case 'input':
        case 'change':
          return this.extractInputEventDetails(event);
        
        case 'dragstart':
        case 'dragend':
        case 'drop':
          return this.extractDragEventDetails(event as DragEvent);
        
        case 'submit':
          return this.extractFormEventDetails(event);
        
        default:
          // Generic event details
          return {
            type: 'generic',
            eventType: event.type
          };
      }
    } catch (error) {
      // Return minimal information if extraction fails
      return {
        type: 'generic',
        error: this.formatError(error)
      };
    }
  }

  /**
   * Extract mouse event specific details
   * @param event - Mouse event
   * @returns Mouse event details
   */
  private extractMouseEventDetails(event: MouseEvent): MouseEventDetails {
    return {
      type: 'mouse',
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    };
  }

  /**
   * Extract keyboard event specific details
   * @param event - Keyboard event
   * @returns Keyboard event details
   */
  private extractKeyboardEventDetails(event: KeyboardEvent): KeyboardEventDetails {
    return {
      type: 'keyboard',
      key: event.key,
      code: event.code,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      repeat: event.repeat
    };
  }

  /**
   * Extract input event specific details
   * @param event - Input event
   * @returns Input event details
   */
  private extractInputEventDetails(event: Event): InputEventDetails {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    
    // Apply PII redaction for input values
    let value = target?.value || '';
    
    // Special handling for password fields
    if (target instanceof HTMLInputElement && target.type === 'password') {
      value = '********'; // Always mask passwords
    } else {
      // Redact PII from other input values
      value = this.redactPii(value);
    }
    
    const sanitizedValue = this.sanitizeText(value, this.config.maxTextLength);
    const inputType = (target as HTMLInputElement)?.type;
    
    const details: InputEventDetails = {
      type: 'input',
      value: sanitizedValue
    };
    
    if (inputType) {
      details.inputType = inputType;
    }
    
    if ('isComposing' in event) {
      details.isComposing = (event as InputEvent).isComposing;
    }
    
    return details;
  }

  /**
   * Extract drag event specific details
   * @param event - Drag event
   * @returns Drag event details
   */
  private extractDragEventDetails(event: DragEvent): DragEventDetails {
    let dataTransfer = null;
    
    if (event.dataTransfer) {
      dataTransfer = {
        types: Array.from(event.dataTransfer.types),
        files: event.dataTransfer.files.length
      };
    }
    
    return {
      type: 'drag',
      dataTransfer
    };
  }

  /**
   * Extract form event specific details
   * @param event - Form event
   * @returns Form event details
   */
  private extractFormEventDetails(event: Event): FormEventDetails {
    const form = (event.target as HTMLElement)?.closest('form') as HTMLFormElement;
    
    const details: FormEventDetails = {
      type: 'form'
    };
    
    if (form) {
      if (form.id) details.formId = form.id;
      if (form.action) details.formAction = form.action;
      if (form.method) details.formMethod = form.method;
    }
    
    return details;
  }

  /**
   * Generate a selector for the element with fallback strategies
   * @param target - Event target data
   * @returns CSS selector for the element
   */
  private generateSelector(target: EventTarget): string {
    const selectors: string[] = [];
    
    // Try to find the best selector for the element
    if (target.testId) {
      selectors.push(`[data-test-id="${this.escapeSelectorString(target.testId)}"], [data-testid="${this.escapeSelectorString(target.testId)}"]`);
    }
    
    if (target.id) {
      selectors.push(`#${this.escapeSelectorString(target.id)}`);
    }
    
    if (target.className) {
      const classes = target.className.split(/\s+/).filter(c => c.length > 0);
      if (classes.length === 1) {
        selectors.push(`.${this.escapeSelectorString(classes[0])}`);
      } else if (classes.length > 1) {
        // Use first class with path for more specificity
        selectors.push(`${target.tagName}.${this.escapeSelectorString(classes[0])}`);
      }
    }
    
    // Use text content for text-based selectors - useful for buttons, links
    if (target.text) {
      selectors.push(`${target.tagName}:has-text("${this.escapeSelectorString(target.text)}")`);
    }
    
    // Path-based selector as last resort
    if (target.path) {
      selectors.push(target.path);
    }
    
    // Last resort - just tag name
    selectors.push(target.tagName || '*');
    
    // Return first non-empty selector
    for (const selector of selectors) {
      if (selector && selector.trim()) {
        return selector;
      }
    }
    
    return target.tagName || '*';
  }

  /**
   * Generate a unique ID for an event
   * @returns Unique event ID
   */
  private generateEventId(): string {
    // Use crypto.randomUUID() if available for stronger randomness
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    // Fallback for older browsers
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Format an error for consistent logging
   * @param error - Error object or unknown value
   * @returns Formatted error object
   */
  private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }
    
    return {
      message: String(error),
      type: typeof error
    };
  }

  /**
   * Get safe element info for logging
   * @param element - DOM element
   * @returns Safe element info
   */
  private getSafeElementInfo(element: HTMLElement): Record<string, unknown> {
    try {
      return {
        tagName: element.tagName?.toLowerCase(),
        id: element.id || undefined,
        className: typeof element.className === 'string' ? element.className : undefined,
        type: (element as HTMLInputElement).type || undefined
      };
    } catch {
      return { error: 'Could not extract element info' };
    }
  }

  /**
   * Escape a string for use in CSS selectors
   * @param str - String to escape
   * @returns Escaped string
   */
  private escapeSelectorString(str: string): string {
    return str.replace(/["\\:\/\[\]|]/g, '\\  private generateSelector(target: EventTarget): string {
    const selectors: string[] = [];
    
    // Try to find the best selector for the element
    if (target.testId) {
      selectors.push(`[data-test-id="${this.escapeSelectorString(target.testId)}"], [data-testid="${this.escapeSelectorString(target.testId)}"]`);
    }
    
    if (target.id) {
      selectors.push(`#${this.escapeSelectorString(target.id)}`);
    }
    
    if (target.className) {
      const classes = target.className.split(/\s+/).filter(c => c.length > 0);
      if (classes.length === 1) {
        selectors.push(`.${this.escapeSelectorString(classes[0])}`);
      } else if (classes.length > 1) {
        // Use first class with path for more specificity
        selectors.push(`${target.tagName}.${this.escapeSelectorString(classes[0])}`);
      }
    }
    
    // Use text content for text-based selectors - useful for buttons, links
    if (target.text) {
      selectors.push(`${target.tagName}:has-text("${this.')
              .replace(/\n/g, '\\A')
              .replace(/\r/g, '\\D');
  }

  /**
   * Generate a user flow diagram visualization
   * @param config - Configuration options for the flow diagram
   * @returns HTML/CSS flow diagram visualization
   */
  generateUserFlowDiagram(config: { 
    simplifyPaths?: boolean, 
    highlightConversionPaths?: boolean,
    maxEvents?: number 
  } = {}): string {
    try {
      // Default config values
      const simplifyPaths = config.simplifyPaths !== false;
      const highlightConversions = config.highlightConversionPaths === true;
      const maxEvents = config.maxEvents || 1000;

      // Get relevant events, limiting to prevent performance issues
      const events = [...this.events].slice(-maxEvents);
      
      if (events.length === 0) {
        return 'No events available for flow diagram';
      }

      // Create a mapping of page URLs to make the diagram more readable
      const uniqueUrls = Array.from(new Set(events.map(e => e.url)));
      const urlMap = new Map<string, string>();
      
      uniqueUrls.forEach((url, index) => {
        // Create a shorthand identifier for each URL
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const shortName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'home';
        urlMap.set(url, `Page ${index + 1}: ${shortName}`);
      });

      // Build a graph of page transitions
      interface Node {
        id: string;
        label: string;
        count: number;
        isConversion?: boolean;
      }
      
      interface Edge {
        source: string;
        target: string;
        count: number;
        isConversion?: boolean;
      }
      
      const nodes: Map<string, Node> = new Map();
      const edges: Map<string, Edge> = new Map();
      
      // Add all URLs as nodes
      uniqueUrls.forEach(url => {
        const nodeId = url;
        nodes.set(nodeId, {
          id: nodeId,
          label: urlMap.get(url) || url,
          count: events.filter(e => e.url === url).length
        });
      });
      
      // Create edges for page transitions
      for (let i = 0; i < events.length - 1; i++) {
        const currentUrl = events[i].url;
        const nextUrl = events[i + 1].url;
        
        // Skip if same page (no transition)
        if (currentUrl === nextUrl) {
          continue;
        }
        
        const edgeKey = `${currentUrl}|${nextUrl}`;
        if (edges.has(edgeKey)) {
          const edge = edges.get(edgeKey)!;
          edge.count++;
        } else {
          edges.set(edgeKey, {
            source: currentUrl,
            target: nextUrl,
            count: 1
          });
        }
      }
      
      // Mark conversion pages (submit events)
      if (highlightConversions) {
        const submitEvents = events.filter(e => e.type === 'submit');
        submitEvents.forEach(event => {
          const nodeId = event.url;
          if (nodes.has(nodeId)) {
            const node = nodes.get(nodeId)!;
            node.isConversion = true;
          }
        });
        
        // Mark conversion paths
        edges.forEach(edge => {
          const targetNode = nodes.get(edge.target);
          if (targetNode?.isConversion) {
            edge.isConversion = true;
          }
        });
      }
      
      // Simplify the graph if requested
      if (simplifyPaths) {
        // Remove low-traffic edges (less than 5% of the max edge count)
        const maxEdgeCount = Math.max(...Array.from(edges.values()).map(e => e.count));
        const threshold = Math.max(1, Math.floor(maxEdgeCount * 0.05));
        
        for (const [key, edge] of edges.entries()) {
          if (edge.count < threshold && !edge.isConversion) {
            edges.delete(key);
          }
        }
      }
      
      // Generate SVG diagram
      const nodeRadius = 50;
      const nodeSpacing = 200;
      const rows = Math.ceil(Math.sqrt(nodes.size));
      const cols = Math.ceil(nodes.size / rows);
      const width = Math.max(800, cols * nodeSpacing);
      const height = Math.max(600, rows * nodeSpacing);
      
      // Position nodes in a grid layout
      let i = 0;
      for (const node of nodes.values()) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        // Assign x and y coordinates
        (node as any).x = (col + 0.5) * nodeSpacing;
        (node as any).y = (row + 0.5) * nodeSpacing;
        
        i++;
      }
      
      // Generate SVG content
      let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#999" />
    </marker>
    <marker id="arrowheadHighlight" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#ff6347" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#f8f9fa" />

  <!-- Edges -->
`;
      
      // Add edges
      for (const edge of edges.values()) {
        const sourceNode = nodes.get(edge.source) as any;
        const targetNode = nodes.get(edge.target) as any;
        
        if (!sourceNode || !targetNode) continue;
        
        // Calculate edge path
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);
        
        // Adjust start and end points to be on the node circle
        const startX = sourceNode.x + nodeRadius * Math.cos(angle);
        const startY = sourceNode.y + nodeRadius * Math.sin(angle);
        const endX = targetNode.x - nodeRadius * Math.cos(angle);
        const endY = targetNode.y - nodeRadius * Math.sin(angle);
        
        // Edge thickness based on count (min 1, max 5)
        const strokeWidth = Math.max(1, Math.min(5, 1 + edge.count / 10));
        
        // Conversion highlighting
        const color = edge.isConversion ? '#ff6347' : '#999';
        const markerEnd = edge.isConversion ? 'url(#arrowheadHighlight)' : 'url(#arrowhead)';
        
        svg += `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
        stroke="${color}" stroke-width="${strokeWidth}" marker-end="${markerEnd}" />
  
  <!-- Edge label -->
  <text x="${(startX + endX) / 2}" y="${(startY + endY) / 2 - 5}" 
        text-anchor="middle" fill="${color}" font-size="12">
    ${edge.count}
  </text>
`;
      }
      
      // Add nodes
      for (const node of nodes.values()) {
        const { x, y } = node as any;
        const nodeFill = node.isConversion ? '#ffebee' : '#e3f2fd';
        const nodeStroke = node.isConversion ? '#ff6347' : '#42a5f5';
        
        svg += `  <!-- Node: ${node.label} -->
  <circle cx="${x}" cy="${y}" r="${nodeRadius}" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="2" />
  
  <text x="${x}" y="${y - 5}" text-anchor="middle" fill="#333" font-size="12" font-weight="bold">
    ${node.label}
  </text>
  
  <text x="${x}" y="${y + 15}" text-anchor="middle" fill="#666" font-size="10">
    ${node.count} events
  </text>
`;
        
        if (node.isConversion) {
          svg += `  <text x="${x}" y="${y + 30}" text-anchor="middle" fill="#ff6347" font-size="10" font-style="italic">
    Conversion
  </text>
`;
        }
      }
      
      // Close SVG
      svg += `</svg>`;
      
      // Generate HTML wrapper
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>User Flow Diagram</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    .diagram-container {
      border: 1px solid #ddd;
      border-radius: 5px;
      overflow: auto;
      margin-top: 20px;
    }
    h1 {
      font-size: 24px;
      color: #333;
    }
    .legend {
      margin: 15px 0;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .legend-item {
      display: inline-block;
      margin-right: 20px;
    }
    .color-box {
      display: inline-block;
      width: 15px;
      height: 15px;
      margin-right: 5px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <h1>User Flow Diagram</h1>
  
  <div class="legend">
    <div class="legend-item"><span class="color-box" style="background: #e3f2fd; border: 2px solid #42a5f5;"></span> Regular page</div>
    <div class="legend-item"><span class="color-box" style="background: #ffebee; border: 2px solid #ff6347;"></span> Conversion page</div>
    <div class="legend-item"><span class="color-box" style="background: #999;"></span> Path (thickness = frequency)</div>
    <div class="legend-item"><span class="color-box" style="background: #ff6347;"></span> Conversion path</div>
  </div>
  
  <p>Based on ${events.length} events from ${new Date(events[0].timestamp).toLocaleString()} to ${new Date(events[events.length-1].timestamp).toLocaleString()}</p>
  
  <div class="diagram-container">
    ${svg}
  </div>
</body>
</html>
`;
      
      return html;
    } catch (error) {
      this.logger.log(
        Tab.Events,
        'Error generating user flow diagram',
        { error: this.formatError(error) },
        Severity.Error
      );
      return `Error generating user flow diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Dispose of all resources and clean up
   */
  /**
   * Determine if the event should automatically manage context
   * @param eventType - Type of the event
   * @param event - The DOM event
   * @returns Whether to manage context for this event
   */
  private shouldManageContextForEvent(eventType: string, event: Event): boolean {
    // Manage context for clicks, form submits, and other key user interactions
    if (['click', 'submit', 'change'].includes(eventType)) {
      return true;
    }
    
    // We could add more sophisticated rules here in the future
    return false;
  }
  
  /**
   * Manage context for specific event types
   * @param eventType - Type of the event
   * @param event - The DOM event
   */
  private manageContextForEvent(eventType: string, event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || !('tagName' in target)) {
      return;
    }
    
    switch (eventType) {
      case 'click':
        // Push context for click on interactive elements
        if (['button', 'a', 'input[type=button]', 'input[type=submit]'].some(selector => {
          try {
            return target.matches(selector);
          } catch {
            return false;
          }
        })) {
          const elementText = this.getElementText(target) || 'unknown';
          const elementId = target.id || undefined;
          
          this.pushContext('click', {
            elementType: target.tagName.toLowerCase(),
            elementText,
            elementId,
            originAction: 'click',
            originComponent: this.getComponentNameFromElement(target)
          });
          
          // For single-fire events, schedule a pop after a short delay
          setTimeout(() => this.popContext(), 100);
        }
        break;
      
      case 'submit':
        // Push context for form submissions
        if (target.tagName.toLowerCase() === 'form' || target.closest('form')) {
          const form = target.tagName.toLowerCase() === 'form' ? target : target.closest('form');
          
          this.pushContext('formSubmit', {
            formId: form?.id,
            formAction: (form as HTMLFormElement)?.action,
            formMethod: (form as HTMLFormElement)?.method,
            originAction: 'submit',
            originComponent: this.getComponentNameFromElement(form as HTMLElement)
          });
          
          // Pop after a delay to allow the submission to complete
          setTimeout(() => this.popContext(), 500);
        }
        break;
      
      case 'change':
        // Push context for significant input changes
        if (['select', 'input[type=checkbox]', 'input[type=radio]'].some(selector => {
          try {
            return target.matches(selector);
          } catch {
            return false;
          }
        })) {
          this.pushContext('valueChange', {
            elementType: target.tagName.toLowerCase(),
            elementId: target.id || undefined,
            elementName: (target as HTMLInputElement).name,
            originAction: 'change',
            originComponent: this.getComponentNameFromElement(target)
          });
          
          // Pop immediately for input changes
          setTimeout(() => this.popContext(), 50);
        }
        break;
    }
  }
  
  /**
   * Extract component name from element
   * @param element - DOM element
   * @returns Best guess at component name
   */
  private getComponentNameFromElement(element: HTMLElement | null): string {
    if (!element) return 'unknown';
    
    // Look for React component indicator
    const reactAttribute = Array.from(element.attributes)
      .find(attr => attr.name.startsWith('data-reactid') || 
                   attr.name.startsWith('data-react-') ||
                   attr.name.includes('__reactInternalInstance'));
    
    if (reactAttribute) {
      // Try to find a component name in a parent with an ID or specific class
      let current: HTMLElement | null = element;
      while (current && current !== document.body) {
        if (current.id) {
          return this.formatComponentName(current.id);
        }
        
        // Look for component-like class names
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.split(/\s+/);
          const componentClass = classes.find(cls => 
            cls.includes('Component') || 
            cls.includes('component') || 
            cls.includes('Container') ||
            cls.includes('-component') ||
            /^[A-Z][a-zA-Z0-9]+$/.test(cls) // PascalCase class likely a component
          );
          
          if (componentClass) {
            return this.formatComponentName(componentClass);
          }
        }
        
        // Check for data attributes that might indicate a component
        const dataComponent = current.getAttribute('data-component');
        if (dataComponent) {
          return this.formatComponentName(dataComponent);
        }
        
        current = current.parentElement;
      }
    }
    
    // Fallback: Use the element's tag name and any ID/class as a best guess
    const idPart = element.id ? `#${element.id}` : '';
    const classPart = element.className && typeof element.className === 'string' && element.className.trim() ? 
      `.${element.className.split(/\s+/)[0]}` : '';
    
    return `${element.tagName.toLowerCase()}${idPart}${classPart}`;
  }
  
  /**
   * Format a string as a component name
   * @param name - Raw name string
   * @returns Formatted component name
   */
  private formatComponentName(name: string): string {
    // Convert kebab-case or snake_case to PascalCase
    if (name.includes('-') || name.includes('_')) {
      return name
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    }
    
    // If already PascalCase or camelCase, return as is
    if (/^[a-zA-Z0-9]+$/.test(name)) {
      // If camelCase, convert to PascalCase
      if (/^[a-z]/.test(name)) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      return name;
    }
    
    return name;
  }

  dispose(): void {
    try {
      // Stop performance monitoring
      this.stopPerformanceMonitoring();
      
      // Stop monitoring
      this.stopMonitoring();
      
      // Clear events to free memory
      this.events = [];
      this.eventsBeforeError = [];
      
      // Clear context stack
      this.contextStack = [];
      
      this.logger.log(
        Tab.Events,
        'Event monitor disposed',
        {
          sessionId: this.sessionId,
          processedEvents: this.processedEventCount,
          droppedEvents: this.droppedEventCount
        },
        Severity.Info
      );
    } catch (error) {
      this.logger.log(
        Tab.Events,
        'Error disposing event monitor',
        { error: this.formatError(error) },
        Severity.Error
      );
    }
  }
}