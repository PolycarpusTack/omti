/**
 * Enterprise Analysis Debugger Types
 *
 * @description Enhanced core type definitions for the Enterprise Analysis Debugger system
 * @module DebugTypes
 * @version 3.0.0
 * @license Proprietary
 * @copyright Copyright (c) 2025 Enterprise Analysis Systems, Inc.
 * @author Enterprise Analysis Development Team
 */

// ----------------------------------------------------------------------------------
// BRANDED TYPES FOR TYPE SAFETY
// ----------------------------------------------------------------------------------

/**
 * Branded type for entity IDs to prevent mixing different ID types
 */
declare const brand: unique symbol;

/**
 * Branded ID type that prevents mixing different entity types
 * @template T - Entity type discriminator
 */
export type EntityID<T extends string = string> = string & { readonly [brand]: T };

/**
 * Specific entity ID types
 */
export type LogEntryID = EntityID<'log'>;
export type FixSuggestionID = EntityID<'fix'>;
export type ApiCallID = EntityID<'apiCall'>;
export type ActionContextID = EntityID<'action'>;
export type WebSocketMessageID = EntityID<'wsMessage'>;
export type FileOperationID = EntityID<'fileOp'>;
export type PerformanceMetricID = EntityID<'metric'>;

// ----------------------------------------------------------------------------------
// ENUMS AND CONSTANTS
// ----------------------------------------------------------------------------------

/**
 * Available tabs in the debugger console
 * @enum {string}
 * @readonly
 */
export enum Tab {
  Dashboard = 'Dashboard',
  FileSystem = 'FileSystem',
  Analysis = 'Analysis',
  State = 'State',
  Events = 'Events',
  Network = 'Network',
  ApiDebug = 'API Debug',
  Performance = 'Performance',
  Errors = 'Errors',
  Fixes = 'Fixes',
  Analytics = 'Analytics',
  Memory = 'Memory',
  Security = 'Security',
  Profiler = 'Profiler',
  // Allow for extension without modifying the source
  Custom = 'Custom'
}

/**
 * Log severity levels with numerical values for comparison
 * Using bit flags allows for more efficient filtering operations
 * @enum {number}
 * @readonly
 */
export enum Severity {
  Debug = 1 << 0,     // 1
  Info = 1 << 1,      // 2
  Success = 1 << 2,   // 4
  Warn = 1 << 3,      // 8
  Error = 1 << 4,     // 16
  Critical = 1 << 5    // 32
}

/**
 * Common combinations of severity levels for filtering
 * @readonly
 */
export const SeverityMasks = Object.freeze({
  /** All severity levels */
  ALL: ~0,
  /** Only errors and critical issues */
  ERRORS_ONLY: Severity.Error | Severity.Critical,
  /** All warnings and above */
  WARNINGS_AND_ABOVE: Severity.Warn | Severity.Error | Severity.Critical,
  /** Standard level (info and above, no debug messages) */
  STANDARD: Severity.Info | Severity.Success | Severity.Warn | Severity.Error | Severity.Critical
});

/**
 * String representations of severity levels for display purposes
 * @readonly
 */
export const SeverityLabels: Readonly<Record<Severity, string>> = Object.freeze({
  [Severity.Debug]: 'Debug',
  [Severity.Info]: 'Info',
  [Severity.Success]: 'Success',
  [Severity.Warn]: 'Warning',
  [Severity.Error]: 'Error',
  [Severity.Critical]: 'Critical'
});

/**
 * CSS colors for severity levels
 * @readonly
 */
export const SeverityColors: Readonly<Record<Severity, string>> = Object.freeze({
  [Severity.Debug]: '#6c757d',  // Gray
  [Severity.Info]: '#0d6efd',   // Blue
  [Severity.Success]: '#198754', // Green
  [Severity.Warn]: '#ffc107',   // Yellow
  [Severity.Error]: '#dc3545',  // Red
  [Severity.Critical]: '#7c0000' // Dark red
});

/**
 * HTTP methods for network requests
 * @enum {string}
 * @readonly
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
  CONNECT = 'CONNECT'
}

/**
 * Network request statuses
 * @enum {string}
 * @readonly
 */
export enum RequestStatus {
  Pending = 'pending',
  Success = 'success',
  Error = 'error',
  Canceled = 'canceled',
  Timeout = 'timeout',
  Aborted = 'aborted'
}

/**
 * Common HTTP status code ranges
 * @readonly
 */
export const HttpStatusRanges = Object.freeze({
  INFORMATIONAL: { min: 100, max: 199 },
  SUCCESS: { min: 200, max: 299 },
  REDIRECTION: { min: 300, max: 399 },
  CLIENT_ERROR: { min: 400, max: 499 },
  SERVER_ERROR: { min: 500, max: 599 }
});

/**
 * File operation types
 * @enum {string}
 * @readonly
 */
export enum FileOperationType {
  Select = 'select',
  Upload = 'upload',
  Read = 'read',
  Process = 'process',
  Write = 'write',
  Copy = 'copy',
  Delete = 'delete',
  Error = 'error',
  Clear = 'clear'
}

/**
 * Compression algorithms for storage optimization
 * @enum {string}
 * @readonly
 */
export enum CompressionAlgorithm {
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  BROTLI = 'brotli',
  LZ4 = 'lz4',
  NONE = 'none'
}

/**
 * JavaScript environment detection
 * @readonly
 */
export const Environment = Object.freeze({
  isBrowser: typeof window !== 'undefined' && typeof document !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
  isWebWorker: typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope',
  isDeno: typeof Deno !== 'undefined',
  isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
});

// ----------------------------------------------------------------------------------
// CORE INTERFACES
// ----------------------------------------------------------------------------------

/**
 * Base interface for all debugger entities with metadata
 * @template T - Optional type parameter for specialized entity types
 */
export interface DebugEntity<T extends string = string> {
  /** Unique identifier for the entity */
  readonly id: EntityID<T>;
  /** Entity type discriminator for type-safe operations */
  readonly entityType: T;
  /** Timestamp when the entity was created (in milliseconds since epoch) */
  readonly timestamp: number;
  /** Timestamp for entity expiration (if applicable) */
  readonly expiresAt?: number;
  /** Additional metadata for extensibility */
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
}

/**
 * Context information for grouped logging
 */
export interface LogContext {
  /** Path segments representing the context hierarchy */
  readonly path: DeepReadonly<string[]>;
  /** Correlation ID for tracing */
  readonly correlationId: string;
  /** Start time of the context */
  readonly startTime: number;
  /** Additional context data */
  readonly data?: DeepReadonly<Record<string, unknown>>;
  /** Parent context ID if any */
  readonly parentId?: string;
  /** Duration of the context if completed */
  readonly duration?: number;
}

/**
 * Source code location information
 */
export interface SourceLocation {
  /** Filename or resource identifier */
  readonly fileName: string;
  /** Line number (1-based) */
  readonly lineNumber: number;
  /** Column number (1-based) */
  readonly columnNumber: number;
  /** Function name if available */
  readonly functionName?: string;
  /** Source code snippet */
  readonly codeSnippet?: string;
}

/**
 * Structured log entry with enhanced type safety and indexing capabilities
 */
export interface LogEntry extends DebugEntity<'log'> {
  /** Tab category for the log */
  readonly tab: Tab;
  /** Log message */
  readonly message: string;
  /** Structured data associated with the log */
  readonly data?: DeepReadonly<Record<string, unknown>>;
  /** Severity level */
  readonly severity: Severity;
  /** Context information if available */
  readonly context?: DeepReadonly<LogContext>;
  /** Optional tags for categorization and grouping */
  readonly tags?: readonly string[];
  /** Tokenized terms for efficient searching (internal use) */
  readonly searchTokens?: readonly string[];
  /** Source code location where the log was created */
  readonly sourceLocation?: DeepReadonly<SourceLocation>;
  /** Associated user ID if applicable */
  readonly userId?: string;
  /** Session ID for grouping logs from the same user session */
  readonly sessionId?: string;
  /** Request ID for grouping logs from the same request */
  readonly requestId?: string;
  /** Group name for organizing related logs */
  readonly group?: string;
  /** Is this a system-generated or user log */
  readonly isSystemGenerated?: boolean;
  /** Whether this log has been acknowledged by user */
  readonly acknowledged?: boolean;
}

/**
 * Fix suggestion for detected issues
 */
export interface FixSuggestion extends DebugEntity<'fix'> {
  /** Brief issue description */
  readonly issue: string;
  /** Detailed issue explanation */
  readonly description: string;
  /** Recommended fix */
  readonly suggestion: string;
  /** Function or script to apply the fix */
  readonly fixFunction?: Function | string;
  /** Issue severity */
  readonly severity: Severity;
  /** Number of occurrences of this issue */
  readonly occurrences?: number;
  /** Whether the fix was applied */
  readonly applied?: boolean;
  /** Timestamp when the fix was applied (if it was) */
  readonly appliedAt?: number;
  /** Result of applying the fix if attempted */
  readonly applyResult?: boolean;
  /** Error details if fix application failed */
  readonly applyError?: DeepReadonly<Record<string, unknown>>;
  /** Whether this fix is automatic or requires manual intervention */
  readonly isAutomatic?: boolean;
  /** Links to documentation or reference material */
  readonly referenceLinks?: readonly string[];
  /** Source location where the issue was detected */
  readonly sourceLocation?: DeepReadonly<SourceLocation>;
  /** Related issues or fixes */
  readonly relatedIssues?: readonly string[];
  /** Unique error signature for deduplication */
  readonly errorSignature?: string;
  /** Fix success rate if applied multiple times */
  readonly successRate?: number;
}

/**
 * Options for searching logs
 */
export interface SearchOptions {
  /** Text query to search for */
  query: string;
  /** Filter by specific tabs */
  tabs?: readonly Tab[];
  /** Filter by severity levels */
  severities?: readonly Severity[];
  /** Filter by time range */
  timeRange?: {
    /** Start timestamp */
    readonly start: number;
    /** End timestamp */
    readonly end: number;
  };
  /** Whether to include rotated logs */
  includeRotated?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Whether to use indexed search */
  useIndex?: boolean;
  /** Advanced search options */
  advanced?: AdvancedSearchOptions;
}

/**
 * Advanced options for log searching
 */
export interface AdvancedSearchOptions {
  /** Logical operators for the search query */
  operators?: readonly ('AND' | 'OR' | 'NOT')[];
  /** Whether to use regex matching */
  regex?: boolean;
  /** Whether to use fuzzy matching */
  fuzzy?: boolean;
  /** Whether to use case-sensitive matching */
  caseSensitive?: boolean;
}

/**
 * Analytics data structure
 */
export interface AnalyticItem {
  /** Category for the analytics data */
  readonly category: string;
  /** Human-readable title */
  readonly title: string;
  /** The analytics data record */
  readonly data: DeepReadonly<Record<string, number>>;
  /** Sum total for the analytics data */
  readonly total: number;
  /** Additional metadata */
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
}

// ----------------------------------------------------------------------------------
// NETWORK AND API INTERFACES
// ----------------------------------------------------------------------------------

/**
 * Network timing information
 */
export interface NetworkTiming {
  /** DNS lookup time in milliseconds */
  readonly dnsTime?: number;
  /** TCP connection time in milliseconds */
  readonly connectTime?: number;
  /** TLS handshake time in milliseconds */
  readonly tlsTime?: number;
  /** Time to first byte in milliseconds */
  readonly ttfb?: number;
  /** Time downloading response in milliseconds */
  readonly downloadTime?: number;
  /** Time waiting for server response in milliseconds */
  readonly waitTime?: number;
}

/**
 * Network request headers
 */
export interface RequestHeaders {
  /** HTTP headers sent with the request */
  readonly headers?: DeepReadonly<Record<string, string>>;
  /** Content type */
  readonly contentType?: string;
  /** Authentication information (sanitized) */
  readonly authentication?: {
    /** Authentication method used */
    readonly method: string;
    /** Whether the request was authenticated */
    readonly present: boolean;
  };
}

/**
 * Network request details
 */
export interface NetworkRequest extends DebugEntity<'networkRequest'>, NetworkTiming, RequestHeaders {
  /** Request URL */
  readonly url: string;
  /** HTTP method */
  readonly method: HttpMethod | string;
  /** Request status */
  readonly status: RequestStatus | string;
  /** HTTP status code if available */
  readonly statusCode?: number;
  /** Response time in milliseconds */
  readonly responseTime?: number;
  /** Size of response in bytes */
  readonly size?: number;
  /** Request payload data (sanitized) */
  readonly payload?: unknown;
  /** Response data (sanitized) */
  readonly response?: unknown;
  /** Error details if failed */
  readonly error?: unknown;
  /** Response headers */
  readonly responseHeaders?: DeepReadonly<Record<string, string>>;
  /** Whether the request was canceled */
  readonly canceled?: boolean;
  /** Associated correlation IDs */
  readonly correlationIds?: readonly string[];
}

/**
 * Cache operation information
 */
export interface CacheOperation {
  /** Whether the request hit the cache */
  readonly cacheHit: boolean;
  /** Cache key used */
  readonly cacheKey: string;
  /** Time-to-live in seconds */
  readonly ttl?: number;
  /** Cache source/storage location */
  readonly cacheStore?: string;
  /** Size of cached item in bytes */
  readonly size?: number;
  /** Whether this was a write operation */
  readonly isWrite?: boolean;
  /** Timestamp when the item was cached */
  readonly cachedAt?: number;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  /** Whether rate limiting was applied */
  readonly limited: boolean;
  /** Maximum requests allowed in the period */
  readonly limit: number;
  /** Remaining requests in the current period */
  readonly remaining: number;
  /** Time when the limit resets (epoch ms) */
  readonly resetAt: number;
  /** Duration of rate limit window in seconds */
  readonly windowSeconds: number;
  /** Type of rate limit (user, ip, global) */
  readonly type?: string;
}

/**
 * Enhanced API call data with tracing information
 */
export interface ApiCallData extends DebugEntity<'apiCall'>, NetworkTiming {
  /** Parent call ID if this is a child request */
  readonly parentCallId?: ApiCallID;
  /** URL of the API endpoint */
  readonly url: string;
  /** HTTP method used */
  readonly method: HttpMethod | string;
  /** Component that originated the call */
  readonly originComponent?: string;
  /** Action that triggered the call */
  readonly originAction?: string;
  /** Stack trace showing call origin */
  readonly originStack?: string;
  /** Route path when the call was made */
  readonly routePath?: string;
  /** User ID if authenticated */
  readonly userId?: string;
  /** Environment (dev/stage/prod) */
  readonly environment?: string;
  /** Request headers */
  readonly requestHeaders?: DeepReadonly<Record<string, string>>;
  /** URL query parameters */
  readonly requestParams?: DeepReadonly<Record<string, string>>;
  /** Request body (sanitized) */
  readonly requestBody?: unknown;
  /** HTTP status code */
  readonly status?: number;
  /** HTTP status text */
  readonly statusText?: string;
  /** Response headers */
  readonly responseHeaders?: DeepReadonly<Record<string, string>>;
  /** Response body (sanitized) */
  readonly responseBody?: unknown;
  /** Request size in bytes */
  readonly requestBodySize?: number;
  /** Response size in bytes */
  readonly responseBodySize?: number;
  /** Time to complete in milliseconds */
  readonly responseTime?: number;
  /** Error details if failed */
  readonly error?: unknown;
  /** Whether this is a cross-origin request */
  readonly isCrossOrigin?: boolean;
  /** Correlation IDs for distributed tracing */
  readonly correlationIds?: readonly string[];
  /** Time when the call completed */
  readonly completedAt?: number;
  /** Trace ID for distributed tracing */
  readonly traceId?: string;
  /** Span ID for OpenTelemetry tracing */
  readonly spanId?: string;
  /** Parent span ID if applicable */
  readonly parentSpanId?: string;
  /** W3C trace context */
  readonly traceContext?: DeepReadonly<Record<string, string>>;
  /** Function to retry this call */
  readonly retryHelper?: () => Promise<unknown>;
  /** Whether the request was compressed */
  readonly compressed?: boolean;
  /** Compression algorithm used if any */
  readonly compressionMethod?: CompressionAlgorithm;
  /** Original size before compression in bytes */
  readonly uncompressedSize?: number;
  /** Cache operation details if applicable */
  readonly cacheInfo?: DeepReadonly<CacheOperation>;
  /** Rate limiting information if available */
  readonly rateLimitInfo?: DeepReadonly<RateLimitInfo>;
  /** Request priority if specified */
  readonly priority?: 'high' | 'normal' | 'low';
  /** Number of retries performed */
  readonly retryCount?: number;
  /** Maximum allowed retries */
  readonly maxRetries?: number;
  /** Whether this call was sampled for detailed monitoring */
  readonly sampled?: boolean;
  /** Authentication method used if any */
  readonly authMethod?: string;
  /** Whether the request was authenticated */
  readonly authenticated?: boolean;
  /** Authorization scopes used if applicable */
  readonly authScopes?: readonly string[];
  /** API version targeted */
  readonly apiVersion?: string;
  /** API feature flags active during call */
  readonly featureFlags?: DeepReadonly<Record<string, boolean>>;
}

/**
 * Action context for tracking user interactions
 */
export interface ActionContext extends DebugEntity<'action'> {
  /** Name of the action */
  readonly name: string;
  /** Component where the action originated */
  readonly component?: string;
  /** Additional action details */
  readonly details?: DeepReadonly<Record<string, unknown>>;
  /** Child actions if any */
  readonly childActions?: readonly ActionContextID[];
  /** Duration in milliseconds if completed */
  readonly duration?: number;
  /** Status of the action if applicable */
  readonly status?: 'pending' | 'completed' | 'failed';
  /** Error details if failed */
  readonly error?: unknown;
  /** Source location where the action was triggered */
  readonly sourceLocation?: DeepReadonly<SourceLocation>;
  /** User ID who triggered the action */
  readonly userId?: string;
  /** Associated request ID if applicable */
  readonly requestId?: string;
}

/**
 * WebSocket message data for monitoring
 */
export interface WebSocketMessageData extends DebugEntity<'wsMessage'> {
  /** Message direction */
  readonly direction: 'sent' | 'received';
  /** Connection ID */
  readonly connectionId: string;
  /** WebSocket URL */
  readonly url: string;
  /** Message data (sanitized) */
  readonly data: unknown;
  /** Message size in bytes */
  readonly size: number;
  /** Origin component */
  readonly originComponent?: string;
  /** Origin action */
  readonly originAction?: string;
  /** Origin action ID */
  readonly originActionId?: ActionContextID;
  /** Message type if available */
  readonly messageType?: string;
  /** Format of the message (json, binary, text) */
  readonly format?: 'json' | 'binary' | 'text';
  /** Protocol used */
  readonly protocol?: string;
  /** Extension data if available */
  readonly extensions?: DeepReadonly<Record<string, unknown>>;
}

/**
 * File operation details
 */
export interface FileOperation extends DebugEntity<'fileOp'> {
  /** Type of file operation */
  readonly type: FileOperationType | string;
  /** Filename if available */
  readonly fileName?: string;
  /** File size in bytes */
  readonly fileSize?: number;
  /** MIME type */
  readonly fileType?: string;
  /** Operation duration in milliseconds */
  readonly duration?: number;
  /** Error details if failed */
  readonly error?: unknown;
  /** Additional details */
  readonly details?: DeepReadonly<Record<string, unknown>>;
  /** Action that triggered the operation */
  readonly originAction?: string;
  /** Component that triggered the operation */
  readonly originComponent?: string;
  /** Status of the operation */
  readonly status?: 'pending' | 'completed' | 'failed';
  /** Checksum of the file if available */
  readonly checksum?: string;
  /** Content encoding (e.g., base64, utf8) */
  readonly encoding?: string;
  /** File path relative to root */
  readonly path?: string;
  /** Associated metadata */
  readonly fileMetadata?: DeepReadonly<Record<string, unknown>>;
}

// ----------------------------------------------------------------------------------
// PERFORMANCE METRICS AND MONITORING INTERFACES
// ----------------------------------------------------------------------------------

/**
 * Performance metric category types
 * @enum {string}
 * @readonly
 */
export enum MetricCategory {
  Timing = 'timing',
  Count = 'count',
  Gauge = 'gauge',
  Histogram = 'histogram',
  Summary = 'summary',
  Rate = 'rate'
}

/**
 * Metric data point with enhanced type safety and metadata
 */
export interface MetricDataPoint<T = number> {
  /** Metric value */
  readonly value: T;
  /** Timestamp when recorded */
  readonly timestamp: number;
  /** Additional dimensions/labels */
  readonly labels?: DeepReadonly<Record<string, string>>;
  /** Exemplar for histogram metrics */
  readonly exemplar?: DeepReadonly<{
    /** Exemplar value */
    readonly value: number;
    /** Trace ID for correlation */
    readonly traceId?: string;
    /** Span ID for correlation */
    readonly spanId?: string;
    /** Labels for the exemplar */
    readonly labels?: DeepReadonly<Record<string, string>>;
  }>;
}

/**
 * Performance metric with efficient time-series storage
 * Optimized for high-volume metrics collection and analysis
 */
export interface PerformanceMetric extends DebugEntity<'metric'> {
  /** Metric name with optional namespace */
  readonly name: string;
  /** Metric description */
  readonly description?: string;
  /** Metric category */
  readonly category: MetricCategory;
  /** Metric unit (e.g., 'ms', 'bytes', 'count') */
  readonly unit?: string;
  /** Tags for categorization */
  readonly tags?: readonly string[];
  /** Latest recorded value */
  readonly currentValue: number;
  /** Minimum value recorded */
  readonly minValue?: number;
  /** Maximum value recorded */
  readonly maxValue?: number;
  /** Count of data points */
  readonly count: number;
  /** Sum of all values */
  readonly sum?: number;
  /** Data samples (most recent values) */
  readonly samples?: readonly MetricDataPoint[];
  /** Timestamp of first value */
  readonly firstTimestamp?: number;
  /** Timestamp of last value */
  readonly lastTimestamp?: number;
  /** Whether this metric uses histogram buckets */
  readonly isHistogram?: boolean;
  /** Histogram bucket boundaries */
  readonly bucketBoundaries?: readonly number[];
  /** Histogram bucket counts */
  readonly bucketCounts?: readonly number[];
  /** Percentile values (p50, p90, p95, p99) */
  readonly percentiles?: DeepReadonly<Record<string, number>>;
  /** Rate per minute for count metrics */
  readonly ratePerMinute?: number;
  /** Rate per second for count metrics */
  readonly ratePerSecond?: number;
  /** Whether metric values follow an increasing trend */
  readonly increasingTrend?: boolean;
  /** Whether metric values follow a decreasing trend */
  readonly decreasingTrend?: boolean;
  /** Alert threshold if configured */
  readonly alertThreshold?: number;
  /** Whether the metric is currently above threshold */
  readonly alertTriggered?: boolean;
  /** Component that generated the metric */
  readonly originComponent?: string;
  /** Correlation with other metrics */
  readonly correlatedMetrics?: readonly string[];
  /** Whether this metric should be persisted */
  readonly persistent?: boolean;
}

/**
 * Component performance profile with aggregated metrics
 */
export interface ComponentProfile {
  /** Component name */
  readonly componentName: string;
  /** Render count */
  readonly renderCount: number;
  /** Total render time in milliseconds */
  readonly totalRenderTime: number;
  /** Average render time in milliseconds */
  readonly avgRenderTime: number;
  /** Maximum render time in milliseconds */
  readonly maxRenderTime: number;
  /** Total effect execution time in milliseconds */
  readonly totalEffectTime: number;
  /** Total memory usage estimation in bytes */
  readonly estimatedMemoryBytes: number;
  /** DOM node count */
  readonly domNodeCount: number;
  /** Total re-render percentage */
  readonly reRenderPercentage: number;
  /** Last render timestamp */
  readonly lastRenderTimestamp: number;
  /** Component render history */
  readonly renderHistory?: readonly {
    /** Render timestamp */
    readonly timestamp: number;
    /** Render duration */
    readonly duration: number;
    /** Render cause */
    readonly cause?: string;
    /** Props that changed */
    readonly changedProps?: readonly string[];
    /** State that changed */
    readonly changedState?: readonly string[];
  }[];
  /** Component hierarchy depth */
  readonly hierarchyDepth?: number;
  /** Parent component name */
  readonly parentComponent?: string;
  /** Child component count */
  readonly childComponentCount?: number;
  /** Context providers used */
  readonly contextProviders?: readonly string[];
  /** Whether this component has performance issues */
  readonly hasPerformanceIssues?: boolean;
  /** Performance recommendations */
  readonly recommendations?: readonly string[];
  /** Wasted render cycles */
  readonly wastedRenderCount?: number;
  /** Performance optimization tactics applied */
  readonly optimizations?: readonly string[];
  /** Used hooks */
  readonly hooks?: readonly string[];
  /** Prop types definition quality */
  readonly propTypesScore?: number;
  /** Memory leak risk assessment */
  readonly memoryLeakRisk?: 'low' | 'medium' | 'high';
}

/**
 * Health check result with comprehensive status information
 */
export interface HealthCheckResult {
  /** Overall status */
  readonly status: 'healthy' | 'warning' | 'critical';
  /** Key metrics */
  readonly metrics: DeepReadonly<{
    /** CPU usage percentage */
    readonly cpuUsage?: number;
    /** Memory usage in bytes */
    readonly memoryUsage?: number;
    /** Heap usage in bytes */
    readonly heapUsage?: number;
    /** Event loop lag in milliseconds */
    readonly eventLoopLag?: number;
    /** Active requests count */
    readonly activeRequests?: number;
    /** Error rate per minute */
    readonly errorRate?: number;
    /** Log volume per minute */
    readonly logRate?: number;
    /** Average API response time */
    readonly avgResponseTime?: number;
    /** Storage used in bytes */
    readonly storageUsed?: number;
    /** Active WebSocket connections */
    readonly websocketConnections?: number;
    /** Average render time in milliseconds */
    readonly avgRenderTime?: number;
    /** Current frame rate */
    readonly fps?: number;
  }>;
  /** Detected issues */
  readonly issues: readonly {
    /** Issue name */
    readonly name: string;
    /** Issue description */
    readonly description: string;
    /** Issue severity */
    readonly severity: Severity;
    /** Component where issue was detected */
    readonly component?: string;
    /** When the issue was first detected */
    readonly detectedAt: number;
    /** Duration of the issue in milliseconds */
    readonly duration?: number;
    /** Related log entries */
    readonly relatedLogs?: readonly LogEntryID[];
    /** Whether the issue is actionable */
    readonly actionable?: boolean;
    /** Suggested fix ID if available */
    readonly suggestedFixId?: FixSuggestionID;
  }[];
  /** Recommendations for resolving issues */
  readonly recommendations: readonly string[];
  /** Check timestamp */
  readonly timestamp: number;
  /** Health check duration in milliseconds */
  readonly checkDuration: number;
  /** Environment information */
  readonly environment?: DeepReadonly<{
    /** Browser name and version */
    readonly browser?: string;
    /** Operating system */
    readonly os?: string;
    /** Device type */
    readonly device?: string;
    /** Screen resolution */
    readonly screen?: string;
    /** Connection type */
    readonly connection?: string;
    /** Memory limits */
    readonly memoryLimit?: number;
  }>;
  /** Application version */
  readonly appVersion?: string;
  /** Next scheduled check timestamp */
  readonly nextCheckAt?: number;
  /** Historical status trends */
  readonly trends?: DeepReadonly<Record<string, number[]>>;
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  /** Whether an error has occurred */
  readonly hasError: boolean;
  /** The error that was caught */
  readonly error?: Error;
  /** React error info with component stack */
  readonly errorInfo?: React.ErrorInfo;
  /** Parsed component stack */
  readonly componentStack?: string;
  /** When the error occurred */
  readonly timestamp?: number;
  /** Fallback render attempts */
  readonly fallbackRenders?: number;
  /** Recovery attempts */
  readonly recoveryAttempts?: number;
  /** Log entry IDs related to this error */
  readonly relatedLogIds?: readonly LogEntryID[];
}

// ----------------------------------------------------------------------------------
// SERVICE INTERFACES
// ----------------------------------------------------------------------------------

/**
 * Log filtering options with optimized performance for large log sets
 */
export interface LogFilterOptions {
  /** Filter by multiple tab categories */
  readonly tabs?: readonly Tab[];
  /** Filter by severity mask for bitwise operations */
  readonly severityMask?: number;
  /** Filter by minimum severity level */
  readonly minSeverity?: Severity;
  /** Filter by maximum severity level */
  readonly maxSeverity?: Severity;
  /** Filter by time range */
  readonly timeRange?: {
    /** Start timestamp (inclusive) */
    readonly start: number;
    /** End timestamp (inclusive) */
    readonly end: number;
  };
  /** Filter by tags (supports AND/OR operations) */
  readonly tags?: {
    /** Tags that must all be present */
    readonly all?: readonly string[];
    /** Tags where at least one must be present */
    readonly any?: readonly string[];
    /** Tags that must not be present */
    readonly none?: readonly string[];
  };
  /** Text search query */
  readonly searchText?: string;
  /** Include logs from cold storage/rotation */
  readonly includeRotated?: boolean;
  /** Include logs from archives */
  readonly includeArchived?: boolean;
  /** Pagination limit */
  readonly limit?: number;
  /** Pagination offset */
  readonly offset?: number;
  /** Sort direction */
  readonly sortDirection?: 'asc' | 'desc';
  /** Filter by specific user ID */
  readonly userId?: string;
  /** Filter by session ID */
  readonly sessionId?: string;
  /** Filter by request ID */
  readonly requestId?: string;
  /** Filter by log group */
  readonly group?: string;
  /** Filter system vs. user-generated logs */
  readonly isSystemGenerated?: boolean;
  /** Filter by acknowledgment status */
  readonly acknowledged?: boolean;
}

/**
 * Subscription options for log change notifications
 */
export interface SubscriptionOptions {
  /** Filter notifications by tab category */
  readonly tabFilter?: Tab | readonly Tab[];
  /** Filter notifications by severity mask */
  readonly severityMask?: number;
  /** Minimum time between notifications in milliseconds */
  readonly throttleMs?: number;
  /** Whether to include data in notifications */
  readonly includeData?: boolean;
  /** Whether to notify on initial subscription */
  readonly notifyOnSubscribe?: boolean;
  /** Unique ID for the subscription (auto-generated if not provided) */
  readonly subscriptionId?: string;
}

/**
 * Export options for data exporting
 */
export interface ExportOptions {
  /** Whether to include rotated logs */
  readonly includeRotated?: boolean;
  /** Whether to pretty print JSON */
  readonly pretty?: boolean;
  /** Whether to trigger a download */
  readonly download?: boolean;
  /** Custom filename for download */
  readonly filename?: string;
  /** Maximum number of entries to include */
  readonly maxEntries?: number;
  /** Fields to include in export */
  readonly fields?: readonly string[];
  /** Whether to include metadata */
  readonly includeMetadata?: boolean;
  /** Whether to sign the export */
  readonly signed?: boolean;
  /** Whether to compress the export */
  readonly compressed?: boolean;
  /** Compression algorithm to use */
  readonly compressionAlgorithm?: CompressionAlgorithm;
  /** Custom export format options */
  readonly formatOptions?: DeepReadonly<Record<string, unknown>>;
}

/**
 * Debug logger interface for system-wide logging with performance optimizations
 */
export interface DebugLoggerInterface {
  /**
   * Log a message with associated data
   * @param tab - Tab category for the log
   * @param message - Message to log
   * @param data - Additional structured data
   * @param severity - Severity level
   * @param options - Additional logging options
   * @returns ID of the created log entry
   * @throws {InvalidOperationError} If the logger is disabled
   */
  log(
    tab: Tab | string, 
    message: string, 
    data?: Record<string, unknown>,
    severity?: Severity | string,
    options?: {
      /** Tags for categorization */
      readonly tags?: readonly string[];
      /** Source location information */
      readonly sourceLocation?: DeepReadonly<SourceLocation>;
      /** Associated user ID */
      readonly userId?: string;
      /** Session ID */
      readonly sessionId?: string;
      /** Request ID */
      readonly requestId?: string;
      /** Log grouping identifier */
      readonly group?: string;
      /** Whether to mark as system-generated */
      readonly isSystemGenerated?: boolean;
    }
  ): LogEntryID;

  /**
   * Log messages in bulk for better performance
   * @param entries - Array of log entries to create
   * @returns Array of created log entry IDs
   * @throws {InvalidOperationError} If the logger is disabled
   */
  logBulk(entries: readonly {
    readonly tab: Tab | string;
    readonly message: string;
    readonly data?: Record<string, unknown>;
    readonly severity?: Severity | string;
    readonly options?: Record<string, unknown>;
  }[]): readonly LogEntryID[];

  /**
   * Add a fix suggestion
   * @param issue - Brief issue description
   * @param description - Detailed explanation
   * @param suggestion - Fix suggestion text
   * @param fixFunction - Function or script to implement the fix
   * @param severity - Issue severity
   * @param options - Additional fix options
   * @returns ID of the created fix suggestion
   * @throws {InvalidOperationError} If the logger is disabled
   */
  addFix(
    issue: string, 
    description: string, 
    suggestion: string, 
    fixFunction?: Function | string, 
    severity?: Severity | string,
    options?: {
      /** Whether this fix can be applied automatically */
      readonly isAutomatic?: boolean;
      /** Reference documentation links */
      readonly referenceLinks?: readonly string[];
      /** Source location where the issue was found */
      readonly sourceLocation?: DeepReadonly<SourceLocation>;
      /** Related issue IDs */
      readonly relatedIssues?: readonly string[];
      /** Error signature for deduplication */
      readonly errorSignature?: string;
    }
  ): FixSuggestionID;

  /**
   * Dismiss a fix suggestion
   * @param fixId - ID of the fix to dismiss
   * @throws {ResourceNotFoundError} If the fix ID doesn't exist
   */
  dismissFix(fixId: FixSuggestionID): void;

  /**
   * Clear all logs
   * @param options - Options for selective clearing
   * @returns Number of logs cleared
   */
  clearLogs(options?: {
    /** Only clear logs older than this timestamp */
    readonly olderThan?: number;
    /** Only clear logs with these tabs */
    readonly tabs?: readonly Tab[];
    /** Only clear logs with these severity levels */
    readonly severities?: readonly Severity[];
    /** Skip log rotation/archiving */
    readonly skipRotation?: boolean;
  }): number;

  /**
   * Get logs with optimized filtering
   * @param options - Filter options
   * @returns Array of matching log entries
   */
  getLogs(options?: LogFilterOptions): readonly LogEntry[];

  /**
   * Get logs by ID with batch optimization
   * @param ids - Array of log IDs to retrieve
   * @returns Record of log IDs to log entries (with missing IDs omitted)
   */
  getLogsByIds(ids: readonly LogEntryID[]): DeepReadonly<Record<string, LogEntry>>;

  /**
   * Get all fix suggestions with optional filtering
   * @param options - Filter options
   * @returns Array of fix suggestions
   */
  getFixes(options?: {
    /** Filter by severity levels */
    readonly severities?: readonly Severity[];
    /** Filter by whether the fix is applied */
    readonly applied?: boolean;
    /** Filter for automatic fixes only */
    readonly isAutomatic?: boolean;
    /** Filter by related issue IDs */
    readonly relatedIssues?: readonly string[];
    /** Filter by error signature */
    readonly errorSignature?: string;
  }): readonly FixSuggestion[];

  /**
   * Get analytics data
   * @param options - Options for customizing analytics
   * @returns Array of analytic items
   */
  getAnalytics(options?: {
    /** Time range for analytics */
    readonly timeRange?: { readonly start: number; readonly end: number };
    /** Categories to include */
    readonly categories?: readonly string[];
    /** Whether to include raw data points */
    readonly includeRawData?: boolean;
  }): readonly AnalyticItem[];

  /**
   * Subscribe to logger updates with efficient change notification
   * @param callback - Function to call when logs change
   * @param options - Subscription options for filtering and performance
   * @returns Unsubscribe function
   */
  subscribe(callback: (notification: {
    readonly type: 'logs' | 'fixes' | 'analytics';
    readonly added?: readonly string[];
    readonly updated?: readonly string[];
    readonly removed?: readonly string[];
    readonly timestamp: number;
    readonly data?: unknown;
  }) => void, options?: SubscriptionOptions): () => void;

  /**
   * Apply a fix suggestion
   * @param fixId - ID of the fix to apply
   * @param options - Options for fix application
   * @returns Promise that resolves to success status
   * @throws {ResourceNotFoundError} If the fix ID doesn't exist
   */
  applyFix(fixId: FixSuggestionID, options?: {
    /** Context data to pass to the fix function */
    readonly context?: Record<string, unknown>;
    /** Timeout in milliseconds */
    readonly timeoutMs?: number;
    /** Whether to retry on failure */
    readonly retry?: boolean;
    /** Maximum retry attempts */
    readonly maxRetries?: number;
  }): Promise<boolean>;

  /**
   * Clear all fixes
   * @param options - Options for selective clearing
   * @returns Number of fixes cleared
   */
  clearFixes(options?: {
    /** Only clear applied fixes */
    readonly appliedOnly?: boolean;
    /** Only clear automatic fixes */
    readonly automaticOnly?: boolean;
    /** Only clear fixes older than this timestamp */
    readonly olderThan?: number;
  }): number;

  /**
   * Create a log group for organizing related logs
   * @param groupName - Name of the group
   * @param options - Group options
   * @returns Group ID
   */
  createLogGroup(groupName: string, options?: {
    /** Group description */
    readonly description?: string;
    /** Tags for the group */
    readonly tags?: readonly string[];
    /** Parent group if nested */
    readonly parentGroup?: string;
    /** Time to auto-expire group (ms) */
    readonly expiresIn?: number;
  }): string;

  /**
   * End a log group
   * @param groupId - ID of the group to end
   */
  endLogGroup(groupId: string): void;

  /**
   * Export logs to different formats
   * @param format - Export format
   * @param options - Export options
   * @returns Exported data string or URL
   */
  exportLogs(format: 'json' | 'csv' | 'text' | 'html', options?: ExportOptions): string | Blob;

  /**
   * Check system health
   * @returns Health status object
   */
  getHealthStatus(): HealthCheckResult;

  /**
   * Get logger statistics and metrics
   * @returns Statistics object
   */
  getStatistics(): DeepReadonly<{
    /** Total log count */
    readonly totalLogs: number;
    /** Log counts by tab */
    readonly logsByTab: DeepReadonly<Record<Tab, number>>;
    /** Log counts by severity */
    readonly logsBySeverity: DeepReadonly<Record<Severity, number>>;
    /** Total fixes count */
    readonly totalFixes: number;
    /** Applied fixes count */
    readonly appliedFixes: number;
    /** Storage usage in bytes */
    readonly storageUsage: number;
    /** Memory usage in bytes */
    readonly memoryUsage: number;
    /** Active subscriptions count */
    readonly subscriptionCount: number;
    /** Log rate per minute */
    readonly logsPerMinute: number;
    /** Error rate per minute */
    readonly errorsPerMinute: number;
  }>;

  /**
   * Flush any buffered logs to persistent storage
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>;
}

/**
 * Network monitor interface for request tracking
 */
export interface NetworkMonitor {
  /**
   * Start tracking a network request
   * @param url - Request URL
   * @param method - HTTP method
   * @param payload - Request payload
   * @returns ID of the tracked request
   */
  trackRequest(url: string, method: HttpMethod | string, payload?: unknown): string;

  /**
   * Update an existing request with new data
   * @param requestId - ID of the request to update
   * @param updates - Partial updates to apply
   */
  updateRequest(requestId: string, updates: Partial<NetworkRequest>): void;

  /**
   * Mark a request as successfully completed
   * @param requestId - ID of the request
   * @param response - Response data
   * @param statusCode - HTTP status code
   * @param responseTime - Response time in milliseconds
   */
  completeRequest(requestId: string, response: unknown, statusCode: number, responseTime: number): void;

  /**
   * Mark a request as failed
   * @param requestId - ID of the request
   * @param error - Error details
   */
  failRequest(requestId: string, error: unknown): void;

  /**
   * Get all tracked requests
   * @returns Array of network requests
   */
  getRequests(): readonly NetworkRequest[];

  /**
   * Clear all tracked requests
   */
  clearRequests?(): void;
}

/**
 * Enhanced network monitor with advanced API tracing
 */
export interface EnhancedNetworkMonitor extends NetworkMonitor {
  /**
   * Get API call chains (parent-child relationships)
   * @returns Array of call chains with root call and related calls
   */
  getApiCallChains(): readonly {
    readonly rootCall: ApiCallData;
    readonly chain: readonly ApiCallData[];
  }[];

  /**
   * Get API calls grouped by user action
   * @returns Record of action names to associated API calls
   */
  getApiCallsByUserAction(): DeepReadonly<Record<string, readonly ApiCallData[]>>;

  /**
   * Export network traffic to HAR format
   * @param options - Export options
   * @returns HAR format string
   */
  exportToHAR(options?: ExportOptions): string;

  /**
   * Install Axios interceptors
   * @param axios - Axios instance
   * @returns Object with remove function
   */
  installAxiosInterceptors(axios: unknown): { readonly remove: () => void };

  /**
   * Retry a failed API call
   * @param callId - ID of the call to retry
   * @returns Promise with retry result
   */
  retryApiCall?(callId: ApiCallID): Promise<unknown>;

  /**
   * Get WebSocket messages
   * @param options - Filter options
   * @returns Array of WebSocket messages
   */
  getWebSocketMessages?(options?: {
    connectionId?: string;
    direction?: 'sent' | 'received';
    timeRange?: { start: number; end: number };
  }): readonly WebSocketMessageData[];

  /**
   * Mock API responses for testing
   * @param urlPattern - URL pattern to mock
   * @param mockResponse - Mock response data
   * @param options - Mock options
   * @returns Function to remove the mock
   */
  mockApi?(
    urlPattern: string | RegExp,
    mockResponse: unknown,
    options?: {
      /** HTTP method to mock */
      readonly method?: HttpMethod | string;
      /** HTTP status code to return */
      readonly statusCode?: number;
      /** Simulated delay in milliseconds */
      readonly delay?: number;
      /** Whether to persist this mock across reloads */
      readonly persistent?: boolean;
      /** Times this mock should be used before expiring */
      readonly times?: number;
    }
  ): () => void;
}

// ----------------------------------------------------------------------------------
// CONFIGURATION INTERFACES
// ----------------------------------------------------------------------------------

/**
 * Core debugger configuration options
 */
export interface DebuggerConfig {
  /** Maximum logs to keep in memory */
  readonly maxLogs?: number;
  /** Minimum severity level to log */
  readonly minimumSeverity?: Severity;
  /** Notification debounce interval in milliseconds */
  readonly notifyDebounceInterval?: number;
  /** Error handler function */
  readonly errorHandler?: (error: Error) => void;
  /** Maximum log data size in bytes */
  readonly maxLogDataSize?: number;
  /** Default tags to apply to all logs */
  readonly defaultTags?: readonly string[];
  /** Custom scheduler implementation */
  readonly scheduler?: Scheduler;
  /** Metrics collector implementation */
  readonly metrics?: MetricsCollector;
  /** Custom serializer implementation */
  readonly serializer?: Serializer;
  /** Index configuration */
  readonly indexConfig?: IndexManagerConfig;
  /** Batch processor configuration */
  readonly batchConfig?: BatchProcessorConfig;
  /** Rotation manager configuration */
  readonly rotationConfig?: RotationManagerConfig;
  /** Fix suggestion manager configuration */
  readonly fixConfig?: FixSuggestionManagerConfig;
  /** Context manager configuration */
  readonly contextConfig?: ContextManagerConfig;
  /** Persistence configuration */
  readonly persistenceConfig?: PersistenceManagerConfig & { readonly type?: string };
  /** Analytics manager configuration */
  readonly analyticsConfig?: AnalyticsManagerConfig;
  /** Compression configuration */
  readonly compressionConfig?: CompressionConfig;
  /** Security configuration */
  readonly securityConfig?: SecurityConfig;
  /** Performance monitoring configuration */
  readonly performanceConfig?: PerformanceConfig;
  /** Worker configuration */
  readonly workerConfig?: WorkerConfig;
  /** Enable debug mode with additional diagnostics */
  readonly debug?: boolean;
  /** Error boundary configuration */
  readonly errorBoundaryConfig?: ErrorBoundaryConfig;
}

/**
 * Index manager configuration
 */
export interface IndexManagerConfig {
  /** Maximum tokens per log entry */
  readonly maxIndexedTokenLength?: number;
  /** Minimum token length to index */
  readonly minTokenLength?: number;
  /** Maximum depth for searching structured data */
  readonly maxSearchDepth?: number;
  /** Whether to use web workers for indexing */
  readonly useWorkers?: boolean;
  /** Maximum batch size for indexing */
  readonly maxIndexingBatchSize?: number;
  /** Whether to use idle callbacks for indexing */
  readonly useIdleProcessing?: boolean;
  /** Fields to exclude from indexing */
  readonly excludeFields?: readonly string[];
  /** Whether to build a reverse index */
  readonly buildReverseIndex?: boolean;
  /** Index storage mode */
  readonly storageMode?: 'memory' | 'indexed-db' | 'hybrid';
  /** Whether to optimize for fast lookups or memory usage */
  readonly optimizationMode?: 'speed' | 'memory';
  /** Whether to index numeric values */
  readonly indexNumericValues?: boolean;
  /** Custom tokenizer function */
  readonly tokenizer?: (text: string) => string[];
  /** Maximum tokens to index per field */
  readonly maxTokensPerField?: number;
  /** Case sensitivity for indexing */
  readonly caseSensitive?: boolean;
  /** Stop words to exclude from indexing */
  readonly stopWords?: readonly string[];
}

/**
 * Batch processor configuration
 */
export interface BatchProcessorConfig {
  /** Whether batch processing is enabled */
  readonly enabled?: boolean;
  /** Batch flush interval in milliseconds */
  readonly flushInterval?: number;
  /** Maximum batch size before forced flush */
  readonly maxBatchSize?: number;
  /** Whether to use idle callbacks for processing */
  readonly useIdleCallback?: boolean;
  /** Severity levels that trigger immediate processing */
  readonly prioritySeverities?: readonly Severity[];
  /** Whether to use adaptive flush intervals */
  readonly adaptiveInterval?: boolean;
  /** Minimum flush interval in milliseconds */
  readonly minFlushInterval?: number;
  /** Maximum flush interval in milliseconds */
  readonly maxFlushInterval?: number;
  /** Whether to compress batched logs */
  readonly compressBatches?: boolean;
  /** Minimum batch size for compression */
  readonly compressionThreshold?: number;
  /** Whether to group similar logs */
  readonly groupSimilarLogs?: boolean;
  /** Similarity threshold for grouping */
  readonly similarityThreshold?: number;
  /** Whether to persist batches on page unload */
  readonly persistOnUnload?: boolean;
  /** Priority map for tab categories */
  readonly tabPriorities?: DeepReadonly<Record<Tab, 'high' | 'normal' | 'low'>>;
}

/**
 * Rotation manager configuration
 */
export interface RotationManagerConfig {
  /** Whether log rotation is enabled */
  readonly enabled?: boolean;
  /** Threshold for triggering rotation */
  readonly rotationThreshold?: number;
  /** Maximum rotation sets to keep */
  readonly maxRotations?: number;
  /** Percentage of logs to rotate */
  readonly rotationPercentage?: number;
  /** Whether to compress rotated logs */
  readonly compressRotatedLogs?: boolean;
  /** Whether to store rotated logs in IndexedDB */
  readonly persistRotatedLogs?: boolean;
  /** Compression algorithm to use */
  readonly compressionAlgorithm?: CompressionAlgorithm;
  /** Whether to apply rotation based on memory pressure */
  readonly memoryPressureAware?: boolean;
  /** Whether to automatically archive old rotations */
  readonly autoArchive?: boolean;
  /** Age threshold for auto-archiving (ms) */
  readonly archiveThresholdMs?: number;
  /** Whether rotated logs are searchable */
  readonly searchableRotations?: boolean;
  /** Whether to track analytics on rotations */
  readonly trackRotationMetrics?: boolean;
}

/**
 * Fix suggestion manager configuration
 */
export interface FixSuggestionManagerConfig {
  /** Maximum fix suggestions to keep */
  readonly maxFixes?: number;
  /** Whether to enable automatic fix generation */
  readonly enableAutoFixes?: boolean;
  /** Whether to group similar fixes */
  readonly groupSimilarFixes?: boolean;
  /** Similarity threshold for grouping */
  readonly similarityThreshold?: number;
  /** Whether to allow automatic application of fixes */
  readonly allowAutoApply?: boolean;
  /** Fix rules to auto-register */
  readonly fixRules?: readonly {
    /** Rule ID */
    readonly id: string;
    /** Rule name */
    readonly name: string;
    /** Error pattern for matching */
    readonly errorPattern: string | RegExp;
    /** Fix template */
    readonly fixTemplate: string;
    /** Whether this fix can be applied automatically */
    readonly isAutomatic: boolean;
  }[];
  /** Whether to persist fixes between sessions */
  readonly persistFixes?: boolean;
  /** Whether to track fix success rates */
  readonly trackSuccessRates?: boolean;
  /** Whether to sort fixes by severity */
  readonly sortBySeverity?: boolean;
  /** Timeout for fix application in milliseconds */
  readonly fixTimeoutMs?: number;
  /** Maximum retries for applying fixes */
  readonly maxFixRetries?: number;
  /** Whether to tag related logs */
  readonly tagRelatedLogs?: boolean;
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Whether context tracking is enabled */
  readonly enabled?: boolean;
  /** Maximum context nesting depth */
  readonly maxContextDepth?: number;
  /** Whether to track context duration */
  readonly trackDuration?: boolean;
  /** Whether to track context metrics */
  readonly trackMetrics?: boolean;
  /** Whether to auto-end contexts on timeout */
  readonly autoEndContexts?: boolean;
  /** Default context timeout in milliseconds */
  readonly defaultContextTimeout?: number;
  /** Whether contexts are recovered on page reload */
  readonly persistContexts?: boolean;
  /** Whether to track context switches */
  readonly trackContextSwitches?: boolean;
  /** Whether to associate errors with contexts */
  readonly associateErrors?: boolean;
  /** Context data sanitization level */
  readonly sanitizationLevel?: 'none' | 'sensitive' | 'aggressive';
  /** Whether child contexts inherit tags */
  readonly inheritTags?: boolean;
  /** Path separator for context paths */
  readonly pathSeparator?: string;
}

/**
 * Persistence manager configuration
 */
export interface PersistenceManagerConfig {
  /** Whether persistence is enabled */
  readonly enabled?: boolean;
  /** Whether to auto-save periodically */
  readonly autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  readonly saveInterval?: number;
  /** Storage key prefix */
  readonly keyPrefix?: string;
  /** Maximum logs to save */
  readonly maxLogsToSave?: number;
  /** Whether to persist analytics */
  readonly persistAnalytics?: boolean;
  /** Whether to enable compression */
  readonly compressionEnabled?: boolean;
  /** Whether to track export cursor */
  readonly exportCursorEnabled?: boolean;
  /** Storage implementation to use */
  readonly storage?: StorageProvider;
  /** Maximum storage size in bytes */
  readonly maxStorageSize?: number;
  /** Storage quota management strategy */
  readonly quotaStrategy?: 'error' | 'prune-oldest' | 'ignore';
  /** Whether to encrypt stored data */
  readonly encryptData?: boolean;
  /** Encryption key or key provider */
  readonly encryptionKey?: string | (() => Promise<string>);
  /** Whether to use IndexedDB for larger storage */
  readonly useIndexedDB?: boolean;
  /** Storage version for migration */
  readonly storageVersion?: number;
  /** Backup strategy configuration */
  readonly backupStrategy?: {
    /** Whether to create backups */
    readonly enabled: boolean;
    /** Backup interval in milliseconds */
    readonly intervalMs: number;
    /** Maximum backups to keep */
    readonly maxBackups: number;
  };
}

/**
 * Analytics manager configuration
 */
export interface AnalyticsManagerConfig {
  /** Whether analytics is enabled */
  readonly enabled?: boolean;
  /** Whether to track error types */
  readonly trackErrorTypes?: boolean;
  /** Maximum error types to track */
  readonly maxTrackedErrorTypes?: number;
  /** Whether to track user metrics */
  readonly trackUserMetrics?: boolean;
  /** Whether to track component renderings */
  readonly trackComponentRendering?: boolean;
  /** Whether to track individual API calls */
  readonly trackApiCalls?: boolean;
  /** Sample rate for high-volume metrics */
  readonly sampleRate?: number;
  /** Whether to use time-series data */
  readonly timeSeriesEnabled?: boolean;
  /** Resolution for time series in milliseconds */
  readonly timeSeriesResolutionMs?: number;
  /** Whether to track feature usage */
  readonly trackFeatureUsage?: boolean;
  /** Whether analytics data can be exported */
  readonly allowExport?: boolean;
  /** Categories to track */
  readonly categories?: readonly string[];
  /** Maximum datapoints per series */
  readonly maxDatapointsPerSeries?: number;
  /** Retention period in milliseconds */
  readonly retentionPeriodMs?: number;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Whether compression is enabled */
  readonly enabled?: boolean;
  /** Default compression algorithm */
  readonly algorithm?: CompressionAlgorithm;
  /** Size threshold for compression in bytes */
  readonly threshold?: number;
  /** Minimum compression ratio to use result */
  readonly minCompressionRatio?: number;
  /** Whether to track compression metrics */
  readonly trackMetrics?: boolean;
  /** Fields to never compress */
  readonly excludeFields?: readonly string[];
  /** Maximum single field size to compress */
  readonly maxFieldSize?: number;
  /** Compression level (1-9) */
  readonly compressionLevel?: number;
  /** Whether to use dictionary compression */
  readonly useDictionary?: boolean;
  /** Custom dictionary for compression */
  readonly dictionary?: Uint8Array;
  /** Maximum compression timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Whether to use workers for compression */
  readonly useWorkers?: boolean;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Whether security checks are enabled */
  readonly enabled?: boolean;
  /** Authentication provider implementation */
  readonly authProvider?: AuthenticationProvider;
  /** Default permission level */
  readonly defaultPermissionLevel?: PermissionLevel;
  /** Whether to mask sensitive data */
  readonly maskSensitiveData?: boolean;
  /** Patterns for identifying sensitive data */
  readonly sensitivePatterns?: Array<string | RegExp>;
  /** Whether to validate inputs */
  readonly validateInputs?: boolean;
  /** Whether to sign exports */
  readonly signExports?: boolean;
  /** Whether to encrypt persisted data */
  readonly encryptStorage?: boolean;
  /** Encryption key or key provider */
  readonly encryptionKey?: string | (() => Promise<string>);
  /** Whether to validate origins */
  readonly validateOrigins?: boolean;
  /** Allowed origins for API calls */
  readonly allowedOrigins?: readonly string[];
  /** Whether to apply CSP restrictions */
  readonly enforceCsp?: boolean;
  /** Content Security Policy to apply */
  readonly contentSecurityPolicy?: string;
  /** Whether to prevent data exfiltration */
  readonly preventExfiltration?: boolean;
  /** Whether to use permissions API */
  readonly usePermissionsApi?: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Whether performance monitoring is enabled */
  readonly enabled?: boolean;
  /** Sample rate for high-volume metrics */
  readonly sampleRate?: number;
  /** Performance budget thresholds */
  readonly budget?: {
    /** Maximum acceptable render time in milliseconds */
    readonly maxRenderTimeMs?: number;
    /** Maximum memory usage in bytes */
    readonly maxMemoryBytes?: number;
    /** Maximum DOM node count */
    readonly maxDomNodes?: number;
    /** Maximum API response time in milliseconds */
    readonly maxApiResponseTimeMs?: number;
  };
  /** Whether to use the Performance API */
  readonly usePerformanceApi?: boolean;
  /** Whether to track component render times */
  readonly trackComponentRenders?: boolean;
  /** Whether to notify on threshold violations */
  readonly notifyOnViolation?: boolean;
  /** Whether to automatically suggest optimizations */
  readonly autoSuggestOptimizations?: boolean;
  /** API to use for high resolution timing */
  readonly timingApi?: 'performance' | 'date' | 'hrtime';
  /** Whether to track layout thrashing */
  readonly trackLayoutThrashing?: boolean;
  /** Whether to track memory leaks */
  readonly trackMemoryLeaks?: boolean;
  /** Whether to profile expensive operations */
  readonly profileExpensiveOps?: boolean;
  /** Operations to automatically profile */
  readonly autoProfileOperations?: readonly string[];
  /** Whether to track long tasks */
  readonly trackLongTasks?: boolean;
  /** Long task threshold in milliseconds */
  readonly longTaskThresholdMs?: number;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Whether to use web workers */
  readonly enabled?: boolean;
  /** Number of workers to create */
  readonly workerCount?: number;
  /** Whether to terminate idle workers */
  readonly terminateWhenIdle?: boolean;
  /** Idle timeout in milliseconds */
  readonly idleTimeoutMs?: number;
  /** Maximum memory per worker in bytes */
  readonly maxWorkerMemory?: number;
  /** Task types to run in workers */
  readonly taskTypes?: readonly WorkerTaskType[];
  /** Worker script URL */
  readonly workerScriptUrl?: string;
  /** Whether to use shared workers if available */
  readonly useSharedWorkers?: boolean;
  /** Whether to prioritize tasks */
  readonly prioritizeTasks?: boolean;
  /** Task timeout in milliseconds */
  readonly taskTimeoutMs?: number;
  /** Whether to monitor worker health */
  readonly monitorHealth?: boolean;
  /** Health check interval in milliseconds */
  readonly healthCheckIntervalMs?: number;
  /** Whether to transfer ownership of large objects */
  readonly useTransferables?: boolean;
}

/**
 * Error boundary configuration
 */
export interface ErrorBoundaryConfig {
  /** Whether to capture React errors */
  readonly enabled?: boolean;
  /** Whether to retry on error */
  readonly retry?: boolean;
  /** Maximum retry attempts */
  readonly maxRetries?: number;
  /** Delay between retries in milliseconds */
  readonly retryDelayMs?: number;
  /** Whether to log captured errors */
  readonly logErrors?: boolean;
  /** Whether to track component stack */
  readonly trackComponentStack?: boolean;
  /** Whether to attempt recovery */
  readonly attemptRecovery?: boolean;
  /** Recovery timeout in milliseconds */
  readonly recoveryTimeoutMs?: number;
  /** Whether to persist error state */
  readonly persistErrorState?: boolean;
  /** Custom error handler */
  readonly errorHandler?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Error severity mapping function */
  readonly errorSeverityMapper?: (error: Error) => Severity;
  /** Whether errors are reportable to external service */
  readonly reportable?: boolean;
  /** Error grouping strategy */
  readonly errorGrouping?: 'message' | 'component' | 'stack' | 'none';
}

/**
 * Scheduler interface for timing operations
 */
export interface Scheduler {
  /**
   * Schedule a function to run after a delay
   * @param callback - Function to run
   * @param ms - Delay in milliseconds
   * @returns Timeout ID
   */
  setTimeout(callback: () => void, ms: number): any;

  /**
   * Cancel a scheduled timeout
   * @param id - Timeout ID
   */
  clearTimeout(id: any): void;

  /**
   * Schedule a function to run periodically
   * @param callback - Function to run
   * @param ms - Interval in milliseconds
   * @returns Interval ID
   */
  setInterval(callback: () => void, ms: number): any;

  /**
   * Cancel a scheduled interval
   * @param id - Interval ID
   */
  clearInterval(id: any): void;

  /**
   * Schedule a function to run during idle time
   * @param callback - Function to run
   * @param options - Idle callback options
   * @returns Idle callback ID
   */
  requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): any;

  /**
   * Cancel a scheduled idle callback
   * @param id - Idle callback ID
   */
  cancelIdleCallback(id: any): void;
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  /**
   * Record a counter metric
   * @param name - Metric name
   * @param value - Value to record
   * @param tags - Additional tags
   */
  recordCounter(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a gauge metric
   * @param name - Metric name
   * @param value - Value to record
   * @param tags - Additional tags
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a histogram metric
   * @param name - Metric name
   * @param value - Value to record
   * @param tags - Additional tags
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a timer metric
   * @param name - Metric name
   * @param valueMs - Value in milliseconds
   * @param tags - Additional tags
   */
  recordTimer(name: string, valueMs: number, tags?: Record<string, string>): void;
}

/**
 * Storage provider interface
 */
export interface StorageProvider {
  /**
   * Get a value by key
   * @param key - Storage key
   * @returns Stored value or null if not found
   */
  getItem(key: string): string | null;
  
  /**
   * Set a value by key
   * @param key - Storage key
   * @param value - Value to store
   */
  setItem(key: string, value: string): void;
  
  /**
   * Remove a value by key
   * @param key - Storage key
   */
  removeItem(key: string): void;
  
  /**
   * Clear all stored values
   */
  clear(): void;
  
  /**
   * Get key at index
   * @param index - Storage index
   * @returns Key at the given index
   */
  key(index: number): string | null;
  
  /**
   * Number of stored items
   */
  readonly length: number;
}

/**
 * Serializer interface for data serialization
 */
export interface Serializer {
  /**
   * Serialize a value to string
   * @param value - Value to serialize
   * @param space - Optional indentation for pretty printing
   * @returns Serialized string
   */
  stringify<T>(value: T, space?: number): string;
  
  /**
   * Parse a string to a value
   * @param text - String to parse
   * @returns Parsed value
   */
  parse<T = unknown>(text: string): T;
  
  /**
   * Check if a value can be serialized
   * @param value - Value to check
   * @returns Whether the value can be serialized
   */
  canSerialize(value: unknown): boolean;
}

/**
 * Custom serializer for specific data types
 */
export interface CustomSerializer {
  /**
   * Check if this serializer can handle a value
   * @param value - Value to check
   * @returns Whether this serializer can handle the value
   */
  canSerialize(value: unknown): boolean;
  
  /**
   * Serialize a value
   * @param value - Value to serialize
   * @returns Serialized value
   */
  serialize(value: unknown): unknown;
}

/**
 * Authentication provider interface
 */
export interface AuthenticationProvider {
  /**
   * Authenticate a user
   * @param credentials - Authentication credentials
   * @returns Promise that resolves with security context
   */
  authenticate(credentials: {
    /** Username or API key ID */
    readonly username?: string;
    /** Password or API key */
    readonly password?: string;
    /** Token if using token auth */
    readonly token?: string;
    /** Other authentication parameters */
    readonly [key: string]: unknown;
  }): Promise<SecurityContext>;

  /**
   * Check if an operation is authorized
   * @param context - Security context
   * @param operation - Operation to check
   * @param resource - Resource being accessed
   * @returns Whether the operation is authorized
   */
  isAuthorized(
    context: SecurityContext,
    operation: string,
    resource: string
  ): boolean;

  /**
   * Get current security context
   * @returns Current security context or null if not authenticated
   */
  getCurrentContext(): SecurityContext | null;

  /**
   * Logout current user
   * @returns Promise that resolves when logged out
   */
  logout(): Promise<void>;
}

// ----------------------------------------------------------------------------------
// ERROR HANDLING
// ----------------------------------------------------------------------------------

/**
 * Standardized error codes for debugging system
 * @enum {string}
 * @readonly
 */
export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'ERR_UNKNOWN',
  INVALID_OPERATION = 'ERR_INVALID_OPERATION',
  NOT_IMPLEMENTED = 'ERR_NOT_IMPLEMENTED',
  TIMEOUT = 'ERR_TIMEOUT',
  RESOURCE_NOT_FOUND = 'ERR_RESOURCE_NOT_FOUND',
  PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
  
  // Configuration errors
  INVALID_CONFIG = 'ERR_INVALID_CONFIG',
  MISSING_DEPENDENCY = 'ERR_MISSING_DEPENDENCY',
  
  // Resource errors
  RESOURCE_EXHAUSTED = 'ERR_RESOURCE_EXHAUSTED',
  QUOTA_EXCEEDED = 'ERR_QUOTA_EXCEEDED',
  MEMORY_LIMIT = 'ERR_MEMORY_LIMIT',
  
  // Validation errors
  INVALID_ARGUMENT = 'ERR_INVALID_ARGUMENT',
  INVALID_STATE = 'ERR_INVALID_STATE',
  DATA_VALIDATION = 'ERR_DATA_VALIDATION',
  
  // Storage errors
  STORAGE_ERROR = 'ERR_STORAGE',
  SERIALIZATION_ERROR = 'ERR_SERIALIZATION',
  PERSISTENCE_ERROR = 'ERR_PERSISTENCE',
  
  // API errors
  API_ERROR = 'ERR_API',
  NETWORK_ERROR = 'ERR_NETWORK',
  PROTOCOL_ERROR = 'ERR_PROTOCOL',
  
  // Security errors
  SECURITY_ERROR = 'ERR_SECURITY',
  UNAUTHORIZED = 'ERR_UNAUTHORIZED',
  ENCRYPTION_ERROR = 'ERR_ENCRYPTION'
}

/**
 * Options for debugger error constructor
 */
export interface DebugErrorOptions {
  /** Error details */
  readonly details?: Record<string, unknown>;
  /** Associated request ID */
  readonly requestId?: string;
  /** Whether this error is retryable */
  readonly retryable?: boolean;
  /** Cause of this error */
  readonly cause?: Error;
}

/**
 * Base error class for debugger errors with standardized properties
 * Optimized for performance and memory usage in error-heavy scenarios
 */
export class DebuggerError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCode | string;
  /** Error details with proper type safety */
  readonly details?: DeepReadonly<Record<string, unknown>>;
  /** Timestamp when the error occurred */
  readonly timestamp: number;
  /** Associated request or operation ID */
  readonly requestId?: string;
  /** Whether this error is retryable */
  readonly retryable: boolean;

  /**
   * Create a new debugger error
   * @param message - Error message
   * @param code - Error code
   * @param options - Additional options
   */
  constructor(
    message: string, 
    code: ErrorCode | string = ErrorCode.UNKNOWN_ERROR,
    options: DebugErrorOptions = {}
  ) {
    // Pass the cause to the Error constructor if supported
    const errorOptions = options.cause ? { cause: options.cause } : undefined;
    super(message, errorOptions);
    
    this.name = 'DebuggerError';
    this.code = code;
    this.details = options.details;
    this.timestamp = Date.now();
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DebuggerError.prototype);
    
    // Capture stack trace with V8 specific API if available (improved performance)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Maintains proper stack trace for V8 engines
    if (typeof Error.prototype.constructor === 'function') {
      Error.prototype.constructor.apply(this, [message]);
    }
  }

  /**
   * Create a standardized JSON representation
   * @returns JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      details: this.details,
      requestId: this.requestId,
      retryable: this.retryable,
      stack: this.stack
    };
  }

  /**
   * Create a human-readable error representation
   * @returns Formatted error string
   */
  toString(): string {
    return `[${this.code}] ${this.message}${this.requestId ? ` (Request ID: ${this.requestId})` : ''}`;
  }
}

/**
 * Error thrown when an invalid operation is attempted
 */
export class InvalidOperationError extends DebuggerError {
  constructor(
    message: string, 
    options: DebugErrorOptions = {}
  ) {
    super(message, ErrorCode.INVALID_OPERATION, options);
    this.name = 'InvalidOperationError';
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, InvalidOperationError.prototype);
  }
}

/**
 * Error thrown when a resource is not found
 */
export class ResourceNotFoundError extends DebuggerError {
  /** Resource ID that wasn't found */
  readonly resourceId: string;
  /** Resource type for clearer error messages */
  readonly resourceType?: string;

  constructor(
    message: string, 
    resourceId: string,
    options: {
      readonly resourceType?: string;
      readonly details?: Record<string, unknown>;
      readonly requestId?: string;
      readonly retryable?: boolean;
      readonly cause?: Error;
    } = {}
  ) {
    super(
      message, 
      ErrorCode.RESOURCE_NOT_FOUND, 
      { 
        ...options, 
        details: { 
          ...options.details, 
          resourceId, 
          resourceType: options.resourceType 
        } 
      }
    );
    this.name = 'ResourceNotFoundError';
    this.resourceId = resourceId;
    this.resourceType = options.resourceType;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

/**
 * Error thrown for validation failures
 */
export class ValidationError extends DebuggerError {
  /** Validation issues list */
  readonly validationIssues: readonly { 
    readonly path: string;
    readonly message: string;
    readonly value?: unknown;
  }[];

  constructor(
    message: string,
    validationIssues: readonly { 
      readonly path: string;
      readonly message: string;
      readonly value?: unknown;
    }[],
    options: DebugErrorOptions = {}
  ) {
    super(message, ErrorCode.DATA_VALIDATION, {
      ...options,
      details: {
        ...options.details,
        validationIssues
      }
    });
    this.name = 'ValidationError';
    this.validationIssues = validationIssues;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when a timeout occurs
 */
export class TimeoutError extends DebuggerError {
  /** Timeout duration in milliseconds */
  readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    options: DebugErrorOptions = {}
  ) {
    super(message, ErrorCode.TIMEOUT, {
      ...options,
      details: {
        ...options.details,
        timeoutMs
      },
      retryable: options.retryable ?? true // Timeouts are typically retryable
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Error thrown for quota or rate limiting issues
 */
export class QuotaExceededError extends DebuggerError {
  /** When the quota will reset */
  readonly resetAt?: number;
  /** Rate limit information */
  readonly rateLimit?: DeepReadonly<RateLimitInfo>;

  constructor(
    message: string,
    options: {
      readonly resetAt?: number;
      readonly rateLimit?: DeepReadonly<RateLimitInfo>;
      readonly details?: Record<string, unknown>;
      readonly requestId?: string;
      readonly retryable?: boolean;
      readonly cause?: Error;
    } = {}
  ) {
    super(message, ErrorCode.QUOTA_EXCEEDED, {
      ...options,
      details: {
        ...options.details,
        resetAt: options.resetAt,
        rateLimit: options.rateLimit
      },
      retryable: options.retryable ?? (options.resetAt !== undefined) // Retryable if reset time is known
    });
    this.name = 'QuotaExceededError';
    this.resetAt = options.resetAt;
    this.rateLimit = options.rateLimit;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

/**
 * Error thrown for network-related issues
 */
export class NetworkError extends DebuggerError {
  /** The URL that failed */
  readonly url: string;
  /** HTTP method used (if applicable) */
  readonly method?: string;
  /** HTTP status code (if available) */
  readonly statusCode?: number;

  constructor(
    message: string,
    url: string,
    options: {
      readonly method?: string;
      readonly statusCode?: number;
      readonly details?: Record<string, unknown>;
      readonly requestId?: string;
      readonly retryable?: boolean;
      readonly cause?: Error;
    } = {}
  ) {
    super(message, ErrorCode.NETWORK_ERROR, {
      ...options,
      details: {
        ...options.details,
        url,
        method: options.method,
        statusCode: options.statusCode
      },
      // Network errors are often retryable
      retryable: options.retryable ?? 
        (options.statusCode ? (options.statusCode >= 500 || options.statusCode === 429) : true)
    });
    this.name = 'NetworkError';
    this.url = url;
    this.method = options.method;
    this.statusCode = options.statusCode;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error thrown when serialization fails
 */
export class SerializationError extends DebuggerError {
  /** Type of data that failed to serialize */
  readonly dataType: string;
  /** Size of data if known */
  readonly dataSize?: number;

  constructor(
    message: string,
    dataType: string,
    options: {
      readonly dataSize?: number;
      readonly details?: Record<string, unknown>;
      readonly requestId?: string;
      readonly retryable?: boolean;
      readonly cause?: Error;
    } = {}
  ) {
    super(message, ErrorCode.SERIALIZATION_ERROR, {
      ...options,
      details: {
        ...options.details,
        dataType,
        dataSize: options.dataSize
      }
    });
    this.name = 'SerializationError';
    this.dataType = dataType;
    this.dataSize = options.dataSize;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SerializationError.prototype);
  }
}

/**
 * Error thrown when a security constraint is violated
 */
export class SecurityError extends DebuggerError {
  /** Security constraint that was violated */
  readonly constraint: string;
  /** Security level where the error occurred */
  readonly securityLevel?: string;

  constructor(
    message: string,
    constraint: string,
    options: {
      readonly securityLevel?: string;
      readonly details?: Record<string, unknown>;
      readonly requestId?: string;
      readonly retryable?: boolean;
      readonly cause?: Error;
    } = {}
  ) {
    super(message, ErrorCode.SECURITY_ERROR, {
      ...options,
      details: {
        ...options.details,
        constraint,
        securityLevel: options.securityLevel
      },
      // Security errors are rarely retryable
      retryable: options.retryable ?? false
    });
    this.name = 'SecurityError';
    this.constraint = constraint;
    this.securityLevel = options.securityLevel;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

// ----------------------------------------------------------------------------------
// WORKER INTEGRATION
// ----------------------------------------------------------------------------------

/**
 * Message types for worker communication
 * @enum {string}
 * @readonly
 */
export enum WorkerMessageType {
  /** Initialize the worker */
  Initialize = 'initialize',
  /** Run a task in the worker */
  RunTask = 'run_task',
  /** Task result from worker */
  TaskResult = 'task_result',
  /** Error from worker */
  TaskError = 'task_error',
  /** Terminate worker */
  Terminate = 'terminate',
  /** Log message from worker */
  Log = 'log',
  /** Worker status update */
  Status = 'status',
  /** Performance metrics from worker */
  Metrics = 'metrics'
}

/**
 * Worker task types
 * @enum {string}
 * @readonly
 */
export enum WorkerTaskType {
  /** Process and filter logs */
  ProcessLogs = 'process_logs',
  /** Build search index */
  BuildIndex = 'build_index',
  /** Run search query */
  Search = 'search',
  /** Compress data */
  Compress = 'compress',
  /** Decompress data */
  Decompress = 'decompress',
  /** Calculate metrics */
  CalculateMetrics = 'calculate_metrics',
  /** Export logs */
  ExportLogs = 'export_logs',
  /** Parse and transform data */
  Transform = 'transform'
}

/**
 * Base message interface for worker communication
 */
export interface WorkerMessage {
  /** Message type */
  readonly type: WorkerMessageType;
  /** Message ID for correlation */
  readonly id: string;
  /** Timestamp of message */
  readonly timestamp: number;
}

/**
 * Task message sent to worker
 */
export interface WorkerTaskMessage extends WorkerMessage {
  /** Override to task type */
  readonly type: WorkerMessageType.RunTask;
  /** Task type to run */
  readonly taskType: WorkerTaskType;
  /** Task data */
  readonly taskData: unknown;
  /** Task options */
  readonly taskOptions?: Record<string, unknown>;
  /** Task timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Task priority (higher is more important) */
  readonly priority?: number;
}

/**
 * Task result message from worker
 */
export interface WorkerResultMessage extends WorkerMessage {
  /** Override to result type */
  readonly type: WorkerMessageType.TaskResult;
  /** Original task type */
  readonly taskType: WorkerTaskType;
  /** Original task ID */
  readonly taskId: string;
  /** Result data */
  readonly result: unknown;
  /** Task execution time in milliseconds */
  readonly executionTime: number;
  /** Additional result metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Task error message from worker
 */
export interface WorkerErrorMessage extends WorkerMessage {
  /** Override to error type */
  readonly type: WorkerMessageType.TaskError;
  /** Original task type */
  readonly taskType: WorkerTaskType;
  /** Original task ID */
  readonly taskId: string;
  /** Error details */
  readonly error: {
    /** Error name */
    readonly name: string;
    /** Error message */
    readonly message: string;
    /** Error stack trace */
    readonly stack?: string;
    /** Error code if available */
    readonly code?: string;
    /** Additional error details */
    readonly details?: unknown;
  };
  /** Time spent before error in milliseconds */
  readonly executionTime: number;
}

/**
 * Worker manager for multithreaded debugging operations
 */
export interface WorkerManager {
  /**
   * Initialize the worker pool
   * @param options - Configuration options
   * @returns Promise that resolves when initialized
   */
  initialize(options?: {
    /** Number of workers to create */
    readonly workerCount?: number;
    /** Initial data to pass to workers */
    readonly initialData?: unknown;
    /** Whether to use web workers or node workers */
    readonly workerType?: 'web' | 'node';
    /** Custom worker script URL */
    readonly workerScriptUrl?: string;
  }): Promise<void>;

  /**
   * Run a task in a worker
   * @param taskType - Type of task to run
   * @param taskData - Task data
   * @param options - Task options
   * @returns Promise that resolves with task result
   */
  runTask<T = unknown, R = unknown>(
    taskType: WorkerTaskType,
    taskData: T,
    options?: {
      /** Task timeout in milliseconds */
      readonly timeoutMs?: number;
      /** Task priority (higher is more important) */
      readonly priority?: number;
      /** Additional task options */
      readonly taskOptions?: Record<string, unknown>;
      /** Specific worker ID to use */
      readonly workerId?: string;
    }
  ): Promise<R>;

  /**
   * Get worker pool status
   * @returns Worker pool status
   */
  getStatus(): {
    /** Active worker count */
    readonly activeWorkers: number;
    /** Total worker count */
    readonly totalWorkers: number;
    /** Idle worker count */
    readonly idleWorkers: number;
    /** Pending task count */
    readonly pendingTasks: number;
    /** Completed task count */
    readonly completedTasks: number;
    /** Failed task count */
    readonly failedTasks: number;
    /** Average task execution time */
    readonly avgExecutionTime: number;
    /** Whether the workers are initialized */
    readonly initialized: boolean;
  };

  /**
   * Terminate all workers
   * @returns Promise that resolves when terminated
   */
  terminate(): Promise<void>;
}

// ----------------------------------------------------------------------------------
// SECURITY AND AUTHENTICATION
// ----------------------------------------------------------------------------------

/**
 * Permission levels for debugger access
 * @enum {string}
 * @readonly
 */
export enum PermissionLevel {
  /** Only read access to logs and metrics */
  ReadOnly = 'read_only',
  /** Can add logs but not modify configuration */
  WriteOnly = 'write_only',
  /** Can read logs and modify some settings */
  ReadWrite = 'read_write',
  /** Full access to all debug features */
  Admin = 'admin',
  /** No access */
  None = 'none'
}

/**
 * Security context for debug operations
 */
export interface SecurityContext {
  /** User ID if authenticated */
  readonly userId?: string;
  /** Permission level */
  readonly permissionLevel: PermissionLevel;
  /** Specific permissions granted */
  readonly permissions: readonly string[];
  /** Authentication method used */
  readonly authMethod?: string;
  /** Authentication timestamp */
  readonly authenticatedAt?: number;
  /** Session ID */
  readonly sessionId?: string;
  /** IP address */
  readonly ipAddress?: string;
  /** User agent */
  readonly userAgent?: string;
  /** Organization ID if applicable */
  readonly organizationId?: string;
  /** Environment context */
  readonly environment?: 'development' | 'test' | 'staging' | 'production';
  /** Authorization token if applicable */
  readonly token?: string;
  /** Token expiration timestamp */
  readonly tokenExpiresAt?: number;
  /** Whether the security context has been verified */
  readonly verified?: boolean;
  /** Security scope limitations */
  readonly scope?: readonly string[];
  /** Multi-factor authentication status */
  readonly mfaCompleted?: boolean;
}

// ----------------------------------------------------------------------------------
// TYPE VALIDATION AND UTILITIES
// ----------------------------------------------------------------------------------

/**
 * Optimized lookup maps for faster validation
 * @internal
 */
const VALIDATION_MAPS = {
  TAB: new Set(Object.values(Tab)),
  SEVERITY: new Set(Object.values(Severity)),
  HTTP_METHOD: new Set(Object.values(HttpMethod)),
  REQUEST_STATUS: new Set(Object.values(RequestStatus)),
  FILE_OPERATION: new Set(Object.values(FileOperationType)),
  WORKER_MESSAGE_TYPE: new Set(Object.values(WorkerMessageType)),
  WORKER_TASK_TYPE: new Set(Object.values(WorkerTaskType)),
  PERMISSION_LEVEL: new Set(Object.values(PermissionLevel)),
  ERROR_CODE: new Set(Object.values(ErrorCode))
} as const;

/**
 * Type guard for checking if a value is a valid Tab
 * Using Set lookup for O(1) performance instead of O(n) array search
 * @param value - Value to check
 * @returns Whether the value is a valid Tab
 */
export function isValidTab(value: unknown): value is Tab {
  return typeof value === 'string' && VALIDATION_MAPS.TAB.has(value as Tab);
}

/**
 * Type guard for checking if a value is a valid Severity
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid Severity
 */
export function isValidSeverity(value: unknown): value is Severity {
  return typeof value === 'number' && VALIDATION_MAPS.SEVERITY.has(value as Severity);
}

/**
 * Type guard for checking if a value is a valid HttpMethod
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid HttpMethod
 */
export function isValidHttpMethod(value: unknown): value is HttpMethod {
  return typeof value === 'string' && VALIDATION_MAPS.HTTP_METHOD.has(value as HttpMethod);
}

/**
 * Type guard for checking if a value is a valid RequestStatus
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid RequestStatus
 */
export function isValidRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && VALIDATION_MAPS.REQUEST_STATUS.has(value as RequestStatus);
}

/**
 * Type guard for checking if a value is a valid FileOperationType
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid FileOperationType
 */
export function isValidFileOperationType(value: unknown): value is FileOperationType {
  return typeof value === 'string' && VALIDATION_MAPS.FILE_OPERATION.has(value as FileOperationType);
}

/**
 * Type guard for checking if a value is a valid ErrorCode
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid ErrorCode
 */
export function isValidErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && VALIDATION_MAPS.ERROR_CODE.has(value as ErrorCode);
}

/**
 * Type guard for checking if a value is a valid PermissionLevel
 * Using Set lookup for O(1) performance
 * @param value - Value to check
 * @returns Whether the value is a valid PermissionLevel
 */
export function isValidPermissionLevel(value: unknown): value is PermissionLevel {
  return typeof value === 'string' && VALIDATION_MAPS.PERMISSION_LEVEL.has(value as PermissionLevel);
}

/**
 * Exhaustive type checking helper
 * @param value - Value that should be of type never
 * @throws Error if value is not of type never
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

/**
 * Runtime validation for severity
 * @param severity - Value to validate
 * @throws ValidationError if severity is invalid
 */
export function assertValidSeverity(severity: number): asserts severity is Severity {
  if (process.env.NODE_ENV === 'production') return;
  
  if (!isValidSeverity(severity)) {
    throw new ValidationError(`Invalid severity value: ${severity}`, [{
      path: 'severity',
      message: `Must be one of ${Object.values(Severity).join(', ')}`
    }]);
  }
}

/**
 * Runtime validation for tab
 * @param tab - Value to validate
 * @throws ValidationError if tab is invalid
 */
export function assertValidTab(tab: string): asserts tab is Tab {
  if (process.env.NODE_ENV === 'production') return;
  
  if (!isValidTab(tab)) {
    throw new ValidationError(`Invalid tab value: ${tab}`, [{
      path: 'tab',
      message: `Must be one of ${Object.values(Tab).join(', ')}`
    }]);
  }
}

/**
 * Runtime validation for HTTP method
 * @param method - Value to validate
 * @throws ValidationError if method is invalid
 */
export function assertValidHttpMethod(method: string): asserts method is HttpMethod {
  if (process.env.NODE_ENV === 'production') return;
  
  if (!isValidHttpMethod(method)) {
    throw new ValidationError(`Invalid HTTP method: ${method}`, [{
      path: 'method',
      message: `Must be one of ${Object.values(HttpMethod).join(', ')}`
    }]);
  }
}

/**
 * Optimized severity string mapping using precomputed values
 * @internal
 */
const SEVERITY_STRING_MAP: Readonly<Record<string, Severity>> = Object.freeze({
  'debug': Severity.Debug,
  'info': Severity.Info,
  'information': Severity.Info,
  'success': Severity.Success,
  'warn': Severity.Warn,
  'warning': Severity.Warn,
  'error': Severity.Error,
  'critical': Severity.Critical,
  'fatal': Severity.Critical,
  
  // Also support numeric values as strings
  '0': Severity.Debug,
  '1': Severity.Info,
  '2': Severity.Success,
  '3': Severity.Warn,
  '4': Severity.Error,
  '5': Severity.Critical,
  
  // And by importance
  'low': Severity.Debug,
  'medium': Severity.Info,
  'high': Severity.Warn,
  'severe': Severity.Error,
  'critical': Severity.Critical,
});

/**
 * Check if a severity value meets or exceeds a minimum threshold
 * Uses bit operations for performance
 * @param severity - The severity level to check
 * @param minSeverity - The minimum severity level required
 * @returns Whether the severity meets or exceeds the minimum
 */
export function isAboveMinSeverity(severity: Severity, minSeverity: Severity): boolean {
  return severity >= minSeverity;
}

/**
 * Check if a severity value is within a severity mask
 * Uses efficient bitwise operations
 * @param severity - The severity level to check
 * @param severityMask - Bitmask of allowed severity levels
 * @returns Whether the severity is in the mask
 */
export function matchesSeverityMask(severity: Severity, severityMask: number): boolean {
  return (severity & severityMask) !== 0;
}

/**
 * Utility to safely convert string representation to Tab enum
 * With caching optimization for repeated values
 * @param value - String value
 * @returns Tab enum value or undefined if invalid
 */
export function parseTab(value: string): Tab | undefined {
  // Use direct lookup for common values
  if (value in Tab) {
    return Tab[value as keyof typeof Tab];
  }
  
  // Case insensitive match for user-friendly lookup
  const normalizedValue = value.toLowerCase();
  
  // Check for special case matches
  switch (normalizedValue) {
    case 'api': 
    case 'api debug': 
    case 'api_debug': 
      return Tab.ApiDebug;
    case 'file': 
    case 'filesystem': 
    case 'file_system': 
      return Tab.FileSystem;
    case 'dash': 
    case 'home': 
      return Tab.Dashboard;
    case 'perf': 
      return Tab.Performance;
    case 'stats': 
      return Tab.Analytics;
    default:
      // Full validation as fallback
      return isValidTab(value) ? value as Tab : undefined;
  }
}

/**
 * Utility to safely convert string representation to Severity enum
 * Uses precomputed lookup map for performance
 * @param value - String value
 * @returns Severity enum value or undefined if invalid
 */
export function parseSeverity(value: string): Severity | undefined {
  // If already a valid number, convert directly
  if (typeof value === 'number' && isValidSeverity(value)) {
    return value;
  }
  
  // For string values, use our optimized map
  const normalized = String(value).toLowerCase();
  return SEVERITY_STRING_MAP[normalized];
}

/**
 * Utility to safely convert string representation to HttpMethod enum
 * @param value - String value
 * @returns HttpMethod enum value or undefined if invalid
 */
export function parseHttpMethod(value: string): HttpMethod | undefined {
  // Check for direct match (most common case - uppercase method names)
  if (value in HttpMethod) {
    return HttpMethod[value as keyof typeof HttpMethod];
  }
  
  // Case insensitive fallback
  const normalized = value.toUpperCase();
  return VALIDATION_MAPS.HTTP_METHOD.has(normalized as HttpMethod) 
    ? normalized as HttpMethod 
    : undefined;
}

/**
 * Get the display name for a severity level
 * with null/undefined safety
 * @param severity - Severity enum value
 * @returns Human-readable severity name
 */
export function getSeverityLabel(severity: Severity | null | undefined): string {
  if (severity === null || severity === undefined) {
    return 'Unknown';
  }
  return SeverityLabels[severity] || 'Unknown';
}

/**
 * Get the color for a severity level
 * @param severity - Severity enum value
 * @returns CSS color string
 */
export function getSeverityColor(severity: Severity | null | undefined): string {
  if (severity === null || severity === undefined) {
    return SeverityColors[Severity.Info]; // Default to info color
  }
  return SeverityColors[severity] || SeverityColors[Severity.Info];
}

/**
 * Check if an HTTP status code is within a specific range
 * @param statusCode - The status code to check
 * @param range - The range to check against
 * @returns Whether the status is in the range
 */
export function isStatusInRange(statusCode: number, range: { min: number; max: number }): boolean {
  return statusCode >= range.min && statusCode <= range.max;
}

/**
 * Create a severity mask from an array of severity levels
 * @param severities - Array of severity levels to include in the mask
 * @returns Bitmask representing the selected severity levels
 */
export function createSeverityMask(severities: readonly Severity[]): number {
  return severities.reduce((mask, severity) => mask | severity, 0);
}

/**
 * Get current timestamp with consistent format for logging
 * @returns Current timestamp in milliseconds
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Generate a consistent, performant unique ID for debug entities
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function generateId(prefix: string = 'dbg'): string {
  // Using performance.now() for higher resolution when available
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(now % 1000000).toString(36)}${Math.floor(Math.random() * 1000000).toString(36)}`;
}

/**
 * Create a validated entity ID with proper type
 * @param id - Raw ID string or generated ID
 * @param type - Entity type for the branded ID
 * @returns Branded entity ID
 */
export function createEntityId<T extends string>(
  id: string | undefined,
  type: T
): EntityID<T> {
  return (id || generateId(type)) as EntityID<T>;
}

/**
 * Create a structured error object from any error value
 * Optimized version with better type detection and handling
 * @param error - Original error
 * @returns Structured error object
 */
export function createErrorObject(error: unknown): Record<string, unknown> {
  // For our own error types, use the built-in toJSON
  if (error instanceof DebuggerError) {
    return error.toJSON();
  }
  
  // For standard errors, extract standard properties
  if (error instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
    
    // Handle additional properties that might be present on some error types
    if ('code' in error) {
      errorObj.code = (error as any).code;
    }
    
    if ('cause' in error) {
      errorObj.cause = createErrorObject((error as any).cause);
    }
    
    // Add all enumerable properties (might include custom fields)
    for (const key of Object.keys(error)) {
      // Skip properties we've already handled
      if (!['name', 'message', 'stack', 'code', 'cause'].includes(key)) {
        try {
          // Use a safe accessor pattern to avoid property access errors
          const value = (error as any)[key];
          errorObj[key] = value;
        } catch {
          // Ignore inaccessible properties
        }
      }
    }
    
    return errorObj;
  }
  
  // For non-Error objects, use a consistent format
  if (error !== null && typeof error === 'object') {
    return {
      name: 'UnknownErrorObject',
      message: String(error),
      value: JSON.parse(JSON.stringify(error)) // Safely clone the object
    };
  }
  
  // For primitives and other values
  return {
    name: 'UnknownError',
    message: String(error),
    type: typeof error,
    value: error
  };
}

/**
 * Extract a safe source location from an error's stack trace
 * @param error - Error with stack information
 * @returns SourceLocation object or undefined if unavailable
 */
export function extractSourceLocation(error: Error): SourceLocation | undefined {
  if (!error.stack) return undefined;
  
  // Match common stack trace formats
  const stackLines = error.stack.split('\n');
  
  // Skip the first line (error name and message)
  for (let i = 1; i < stackLines.length; i++) {
    const line = stackLines[i].trim();
    
    // Skip internal frames that are part of the logging system
    if (line.includes('DebugLogger') || 
        line.includes('debugTypes') || 
        line.includes('Function.log')) {
      continue;
    }
    
    // Chrome format: "at functionName (file:line:column)"
    // Firefox format: "functionName@file:line:column"
    // Safari format: "functionName@file:line:column"
    // Node.js format: "at functionName (file:line:column)"
    
    let match = line.match(/at\s+(.*)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      return {
        functionName: match[1],
        fileName: match[2],
        lineNumber: parseInt(match[3], 10),
        columnNumber: parseInt(match[4], 10),
        codeSnippet: line
      };
    }
    
    // Alternative format: "at file:line:column"
    match = line.match(/at\s+(.+):(\d+):(\d+)/);
    if (match) {
      return {
        fileName: match[1],
        lineNumber: parseInt(match[2], 10),
        columnNumber: parseInt(match[3], 10),
        codeSnippet: line
      };
    }
    
    // Firefox/Safari format
    match = line.match(/([^@]*)@(.+):(\d+):(\d+)/);
    if (match) {
      return {
        functionName: match[1] || undefined,
        fileName: match[2],
        lineNumber: parseInt(match[3], 10),
        columnNumber: parseInt(match[4], 10),
        codeSnippet: line
      };
    }
  }
  
  return undefined;
}

/**
 * Create a capturable source location at the current execution point
 * @returns Source location object
 */
export function captureSourceLocation(): SourceLocation | undefined {
  try {
    throw new Error('__capture_source_location__');
  } catch (e) {
    if (e instanceof Error) {
      const location = extractSourceLocation(e);
      
      if (location) {
        // Adjust to exclude the current function from the stack
        return {
          ...location,
          codeSnippet: location.codeSnippet?.replace('__capture_source_location__', '') || undefined
        };
      }
    }
    return undefined;
  }
}

/**
 * Create a stack trace parser that adapts to the current environment
 * @returns Function that parses stack traces in the current environment
 */
export function createStackTraceParser(): (stack: string) => SourceLocation[] {
  // Determine environment once
  const isNodeJS = typeof process !== 'undefined' && !!process.version;
  const isChrome = typeof navigator !== 'undefined' && 
                  navigator.userAgent.includes('Chrome');
  const isFirefox = typeof navigator !== 'undefined' && 
                   navigator.userAgent.includes('Firefox');
  
  return (stack: string): SourceLocation[] => {
    if (!stack) return [];
    
    const locations: SourceLocation[] = [];
    const lines = stack.split('\n');
    
    // Different parsers for different environments
    if (isNodeJS) {
      // Node.js format
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const match = line.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/);
        if (match) {
          locations.push({
            functionName: match[1] || 'anonymous',
            fileName: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10) || 0,
            codeSnippet: line
          });
        }
      }
    } else if (isChrome) {
      // Chrome format
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const match = line.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/);
        if (match) {
          locations.push({
            functionName: match[1] || 'anonymous',
            fileName: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10) || 0,
            codeSnippet: line
          });
        }
      }
    } else if (isFirefox) {
      // Firefox format
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const match = line.match(/(.*)@(.+):(\d+):(\d+)/);
        if (match) {
          locations.push({
            functionName: match[1] || 'anonymous',
            fileName: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10),
            codeSnippet: line
          });
        }
      }
    } else {
      // Generic fallback parser - tries multiple formats
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Try Chrome/Node.js format first
        let match = line.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/);
        if (match) {
          locations.push({
            functionName: match[1] || 'anonymous',
            fileName: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10) || 0,
            codeSnippet: line
          });
          continue;
        }
        
        // Try Firefox format
        match = line.match(/(.*)@(.+):(\d+):(\d+)/);
        if (match) {
          locations.push({
            functionName: match[1] || 'anonymous',
            fileName: match[2],
            lineNumber: parseInt(match[3], 10),
            columnNumber: parseInt(match[4], 10),
            codeSnippet: line
          });
          continue;
        }
        
        // Last resort - try to extract any file:line:column pattern
        match = line.match(/([^:]+):(\d+):(\d+)/);
        if (match) {
          locations.push({
            fileName: match[1],
            lineNumber: parseInt(match[2], 10),
            columnNumber: parseInt(match[3], 10),
            codeSnippet: line
          });
        }
      }
    }
    
    return locations;
  };
}

/**
 * Sanitize potentially sensitive data
 * @param data - Data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data
 */
export function sanitizeData<T>(
  data: T, 
  options: {
    /** Patterns for sensitive data */
    patterns?: Array<string | RegExp>;
    /** Maximum recursion depth */
    maxDepth?: number;
    /** Replacement for sensitive values */
    replacement?: string;
  } = {}
): T {
  const patterns = options.patterns || [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i,
    /apikey/i,
    /access_?token/i,
    /refresh_?token/i,
    /credit/i,
    /card/i,
    /cvv/i,
    /ssn/i,
    /social/i,
    /security/i,
    /birth/i,
    /dob/i,
    /passport/i,
    /license/i,
    /address/i,
    /zip/i,
    /phone/i,
    /private/i
  ];
  
  const maxDepth = options.maxDepth || 10;
  const replacement = options.replacement || '[REDACTED]';
  
  // Recursive sanitization function
  function _sanitize(value: unknown, depth = 0): unknown {
    // Check recursion depth
    if (depth >= maxDepth) return '[MAX_DEPTH]';
    
    // Handle primitive types
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => _sanitize(item, depth + 1));
    }
    
    // Handle objects
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Check if key matches sensitive patterns
      const isSensitive = patterns.some(pattern => {
        if (typeof pattern === 'string') {
          return key.toLowerCase().includes(pattern.toLowerCase());
        }
        return pattern.test(key);
      });
      
      result[key] = isSensitive ? replacement : _sanitize(val, depth + 1);
    }
    
    return result;
  }
  
  return _sanitize(data, 0) as T;
}

/**
 * Validate debugger configuration
 * @param config - Configuration to validate
 * @returns Validated configuration
 * @throws ValidationError if config is invalid
 */
export function validateConfig(config: DebuggerConfig): DebuggerConfig {
  if (process.env.NODE_ENV === 'production') return config;
  
  const validationIssues: { path: string; message: string; value?: unknown }[] = [];
  
  // Validate severity if provided
  if (config.minimumSeverity !== undefined && !isValidSeverity(config.minimumSeverity)) {
    validationIssues.push({
      path: 'minimumSeverity',
      message: `Must be one of ${Object.values(Severity).join(', ')}`,
      value: config.minimumSeverity
    });
  }
  
  // Validate maxLogs
  if (config.maxLogs !== undefined && (typeof config.maxLogs !== 'number' || config.maxLogs <= 0)) {
    validationIssues.push({
      path: 'maxLogs',
      message: 'Must be a positive number',
      value: config.maxLogs
    });
  }
  
  // Validate notifyDebounceInterval
  if (config.notifyDebounceInterval !== undefined && 
      (typeof config.notifyDebounceInterval !== 'number' || config.notifyDebounceInterval < 0)) {
    validationIssues.push({
      path: 'notifyDebounceInterval',
      message: 'Must be a non-negative number',
      value: config.notifyDebounceInterval
    });
  }
  
  // Validate maxLogDataSize
  if (config.maxLogDataSize !== undefined && 
      (typeof config.maxLogDataSize !== 'number' || config.maxLogDataSize <= 0)) {
    validationIssues.push({
      path: 'maxLogDataSize',
      message: 'Must be a positive number',
      value: config.maxLogDataSize
    });
  }
  
  // Validate defaultTags
  if (config.defaultTags !== undefined && !Array.isArray(config.defaultTags)) {
    validationIssues.push({
      path: 'defaultTags',
      message: 'Must be an array of strings',
      value: config.defaultTags
    });
  }
  
  // If validation issues found, throw error
  if (validationIssues.length > 0) {
    throw new ValidationError(
      `Invalid debugger configuration with ${validationIssues.length} issues`,
      validationIssues
    );
  }
  
  return config;
}

/**
 * Performance tracking decorator
 * @param target - Target object
 * @param propertyKey - Method name
 * @param descriptor - Method descriptor
 * @returns Modified descriptor
 */
export function trackPerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const duration = performance.now() - start;
    
    // If this object has metrics, record method duration
    if (this.metrics) {
      this.metrics.recordHistogram('method_duration', duration, {
        method: propertyKey
      });
    }
    
    // Handle Promise results
    if (result instanceof Promise) {
      return result.finally(() => {
        const totalDuration = performance.now() - start;
        if (this.metrics) {
          this.metrics.recordHistogram('async_method_duration', totalDuration, {
            method: propertyKey
          });
        }
      });
    }
    
    return result;
  };
  
  return descriptor;
}

/**
 * Validation decorator for checking properties
 * @param validator - Validation function
 * @returns Property decorator
 */
export function Validate<T>(validator: (value: unknown) => value is T) {
  return function(target: any, propertyKey: string) {
    let value: any;
    
    const getter = function() {
      return value;
    };
    
    const setter = function(newVal: any) {
      if (process.env.NODE_ENV !== 'production' && !validator(newVal)) {
        throw new ValidationError(`Invalid value for ${propertyKey}`, [{
          path: propertyKey,
          message: `Value failed validation`,
          value: newVal
        }]);
      }
      value = newVal;
    };
    
    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true
    });
  };
}

/**
 * Deep freeze an object recursively
 * @param obj - Object to freeze
 * @returns Frozen object
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  // Freeze primitives and non-objects
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Freeze properties before freezing self
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as any)[prop];
    
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  
  return Object.freeze(obj);
}

/**
 * Memoize a function result
 * @param fn - Function to memoize
 * @param keyFn - Optional key generator function
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  } as T;
}

// ----------------------------------------------------------------------------------
// TYPE UTILITIES
// ----------------------------------------------------------------------------------

/**
 * Readonly deep version of a type
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends Function
    ? T
    : T extends Date | RegExp
      ? T
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

/**
 * Mutable version of a readonly type
 */
export type Mutable<T> = T extends ReadonlyArray<infer U>
  ? Array<U>
  : { -readonly [K in keyof T]: T[K] };

/**
 * Deep mutable version of a readonly type
 */
export type DeepMutable<T> = T extends ReadonlyArray<infer U>
  ? Array<DeepMutable<U>>
  : T extends Function
    ? T
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

/**
 * Get keys of an object type that have a specified type
 */
export type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];

/**
 * Pick properties from a type that match a specific type
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Remove undefined from a type
 */
export type NonUndefined<T> = T extends undefined ? never : T;

/**
 * Make specific properties required
 */
export type RequiredProperties<T, K extends keyof T> = T & { [P in K]-?: NonUndefined<T[P]> };

/**
 * Make specific properties optional
 */
export type OptionalProperties<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Result of a state comparison operation
 */
export interface StateComparisonResult {
  /** Changes between states */
  readonly changes: DeepReadonly<Record<string, unknown>>;
  /** Properties added in the new state */
  readonly added: readonly string[];
  /** Properties removed in the new state */
  readonly removed: readonly string[];
  /** Whether the states are different */
  readonly isDifferent: boolean;
  /** Timestamp of the comparison */
  readonly timestamp: number;
}
