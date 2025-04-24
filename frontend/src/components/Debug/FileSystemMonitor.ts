import { Tab, Severity, LogEntry } from './debugTypes';
import { DebugLogger } from './DebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * Supported file operation types
 */
export type FileOperationType = 'select' | 'upload' | 'read' | 'process' | 'error' | 'clear';

/**
 * Interface for file operation data
 */
export interface FileOperation {
  readonly id: string;
  readonly timestamp: number;
  readonly type: FileOperationType;
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly fileType?: string;
  readonly duration?: number;
  readonly error?: Error;
  readonly details?: Record<string, any>;
}

/**
 * Configuration options for FileSystemMonitor
 */
export interface FileSystemMonitorConfig {
  /** Maximum number of operations to store in history */
  maxOperations?: number;
  /** Whether to automatically check files for potential issues */
  performFileChecks?: boolean;
  /** Maximum allowed file size in bytes before warning */
  maxFileSize?: number;
  /** List of file extensions considered potentially unsafe */
  unsafeExtensions?: string[];
  /** Maximum allowed filename length before warning */
  maxFileNameLength?: number;
}

/**
 * Result of a file read operation
 */
export interface FileReadResult {
  readonly operationId: string;
  readonly content: string;
  readonly mimeType: string;
}

/**
 * Processing completion callback parameters
 */
export interface ProcessingResult {
  readonly success: boolean;
  readonly result?: any;
  readonly error?: Error;
  readonly metrics?: Record<string, any>;
}

/**
 * Processing operation tracker
 */
export interface ProcessingTracker {
  readonly operationId: string;
  readonly complete: (params: ProcessingResult) => void;
  readonly cancel: (reason?: string) => void;
}

/**
 * Custom error class for FileSystemMonitor operations
 */
export class FileSystemMonitorError extends Error {
  readonly code: string;
  readonly isOperational: boolean;

  constructor(code: string, message: string, isOperational = true) {
    super(message);
    this.code = code;
    this.isOperational = isOperational;
    this.name = 'FileSystemMonitorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Monitors and logs file operations in the application with comprehensive tracking
 * 
 * Enterprise-level implementation with:
 * - Strong TypeScript typing
 * - Comprehensive error handling with custom error hierarchy
 * - Detailed performance metrics and telemetry
 * - Configurable behavior with validation
 * - Thread-safe operation management
 * - Audit logging capabilities
 * - Event-driven architecture for better integration
 * - Enhanced security features
 */
export class FileSystemMonitor extends EventEmitter {
  private operations: FileOperation[] = [];
  private logger: DebugLogger;
  private config: Required<FileSystemMonitorConfig>;
  private activeFile: File | null = null;
  private static instance: FileSystemMonitor | null = null;
  private validationHandlers: Array<(file: File) => Promise<{ passed: boolean; message?: string; type: string }>> = [];
  private sessionId: string = uuidv4();
  private correlationIdMap: Map<string, string> = new Map();
  
  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<FileSystemMonitorConfig> = {
    maxOperations: 1000,
    performFileChecks: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    unsafeExtensions: ['exe', 'dll', 'bat', 'sh', 'com', 'cmd', 'msi', 'vbs', 'ps1'],
    maxFileNameLength: 255
  };
  
  /**
   * Get singleton instance of FileSystemMonitor
   * @param config - Optional configuration parameters
   */
  public static getInstance(config?: FileSystemMonitorConfig): FileSystemMonitor {
    if (!FileSystemMonitor.instance) {
      FileSystemMonitor.instance = new FileSystemMonitor(config);
    } else if (config) {
      // Update existing instance configuration if provided
      FileSystemMonitor.instance.updateConfig(config);
    }
    
    return FileSystemMonitor.instance;
  }
  
  /**
   * Private constructor to enforce singleton pattern
   * @param config - Optional configuration parameters
   */
  private constructor(config?: FileSystemMonitorConfig) {
    super(); // Initialize EventEmitter
    
    this.logger = DebugLogger.getInstance();
    
    // Initialize with default config and override with provided values
    this.config = {
      ...FileSystemMonitor.DEFAULT_CONFIG,
      ...config
    };
    
    // Set up core validation handlers
    this.registerCoreValidations();
    
    // Log initialization
    this.logger.log(
      Tab.FileSystem,
      'FileSystemMonitor initialized',
      { 
        config: this.config,
        sessionId: this.sessionId
      },
      Severity.Debug
    );
  }
  
  /**
   * Register core file validation handlers
   * @private
   */
  private registerCoreValidations(): void {
    // Validate file size
    this.registerValidationHandler(async (file: File) => {
      const passed = file.size <= this.config.maxFileSize;
      return {
        passed,
        type: 'file_size',
        message: passed ? undefined : `File exceeds maximum allowed size of ${this.formatBytes(this.config.maxFileSize)}`
      };
    });
    
    // Validate file extension
    this.registerValidationHandler(async (file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const isSafe = !this.config.unsafeExtensions.includes(extension);
      return {
        passed: isSafe,
        type: 'file_extension',
        message: isSafe ? undefined : `File has potentially unsafe extension: ${extension}`
      };
    });
    
    // Validate filename length
    this.registerValidationHandler(async (file: File) => {
      const passed = file.name.length <= this.config.maxFileNameLength;
      return {
        passed,
        type: 'filename_length',
        message: passed ? undefined : `Filename exceeds maximum allowed length of ${this.config.maxFileNameLength} characters`
      };
    });
  }
  
  /**
   * Update monitor configuration
   * @param config - New configuration parameters to apply
   * @throws {FileSystemMonitorError} If configuration validation fails
   */
  public updateConfig(config: Partial<FileSystemMonitorConfig>): void {
    try {
      // Validate configuration
      this.validateConfig({
        ...this.config,
        ...config
      });
      
      const oldConfig = { ...this.config };
      this.config = {
        ...this.config,
        ...config
      };
      
      this.logger.log(
        Tab.FileSystem,
        'FileSystemMonitor configuration updated',
        { 
          oldConfig,
          newConfig: this.config,
          changedFields: Object.keys(config)
        },
        Severity.Debug
      );
      
      // Emit configuration change event
      this.emit('configUpdated', this.config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error validating configuration');
      throw new FileSystemMonitorError(
        'CONFIG_VALIDATION_ERROR',
        `Configuration validation failed: ${err.message}`,
        true
      );
    }
  }
  
  /**
   * Validate configuration parameters
   * @private
   * @param config - Configuration to validate
   * @throws {Error} If validation fails
   */
  private validateConfig(config: Required<FileSystemMonitorConfig>): void {
    // Validate maxOperations
    if (typeof config.maxOperations !== 'number' || config.maxOperations <= 0) {
      throw new Error('maxOperations must be a positive number');
    }
    
    // Validate maxFileSize
    if (typeof config.maxFileSize !== 'number' || config.maxFileSize < 0) {
      throw new Error('maxFileSize must be a non-negative number');
    }
    
    // Validate unsafeExtensions
    if (!Array.isArray(config.unsafeExtensions)) {
      throw new Error('unsafeExtensions must be an array');
    }
    
    // Validate maxFileNameLength
    if (typeof config.maxFileNameLength !== 'number' || config.maxFileNameLength <= 0) {
      throw new Error('maxFileNameLength must be a positive number');
    }
    
    // Validate performFileChecks
    if (typeof config.performFileChecks !== 'boolean') {
      throw new Error('performFileChecks must be a boolean');
    }
  }
  
  /**
   * Register a custom file validation handler
   * @param handler - Function that validates a file and returns result
   */
  public registerValidationHandler(
    handler: (file: File) => Promise<{ passed: boolean; message?: string; type: string }>
  ): void {
    this.validationHandlers.push(handler);
  }
  
  /**
   * Track file selection with detailed metadata
   * @param file - The selected file or null if selection was cleared
   * @param options - Optional tracking options
   * @returns Operation ID for tracking
   * @throws FileSystemMonitorError if the operation cannot be tracked properly
   */
  public trackFileSelection(
    file: File | null, 
    options: { 
      correlationId?: string;
      skipValidation?: boolean;
    } = {}
  ): string {
    try {
      const operationId = uuidv4();
      const timestamp = Date.now();
      
      // Store correlation ID if provided
      if (options.correlationId) {
        this.correlationIdMap.set(operationId, options.correlationId);
      }
      
      if (!file) {
        const operation: FileOperation = {
          id: operationId,
          timestamp,
          type: 'clear'
        };
        
        this.operations.push(operation);
        this.activeFile = null;
        
        this.logger.log(
          Tab.FileSystem,
          'File selection cleared',
          { 
            operationId,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          },
          Severity.Info
        );
        
        // Emit selection cleared event
        this.emit('fileSelectionCleared', { operationId });
        
        return operationId;
      }
      
      // Extract file metadata
      const fileType = file.type || this.getFileTypeFromName(file.name);
      const fileDetails = {
        lastModified: new Date(file.lastModified).toISOString(),
        name: file.name,
        size: file.size,
        type: fileType,
        correlationId: options.correlationId,
        sessionId: this.sessionId
      };
      
      const operation: FileOperation = {
        id: operationId,
        timestamp,
        type: 'select',
        fileName: file.name,
        fileSize: file.size,
        fileType,
        details: fileDetails
      };
      
      this.operations.push(operation);
      this.activeFile = file;
      
      this.logger.log(
        Tab.FileSystem,
        `File selected: ${file.name}`,
        {
          operationId,
          fileName: file.name,
          fileSize: this.formatBytes(file.size),
          fileType,
          lastModified: new Date(file.lastModified).toISOString(),
          correlationId: options.correlationId,
          sessionId: this.sessionId
        },
        Severity.Info
      );
      
      // Emit file selected event
      this.emit('fileSelected', { 
        operationId, 
        fileName: file.name,
        fileSize: file.size,
        fileType
      });
      
      // Check for potential issues with the file if enabled and not skipped
      if (this.config.performFileChecks && !options.skipValidation) {
        // Run validations asynchronously but don't wait for result
        this.runFileValidations(file, operationId).catch(err => {
          this.logger.log(
            Tab.FileSystem,
            'File validation failed',
            { 
              operationId,
              fileName: file.name,
              error: err.message
            },
            Severity.Error
          );
        });
      }
      
      // Manage operation history size
      this.trimOperationHistory();
      
      return operationId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error in trackFileSelection');
      this.logger.log(
        Tab.FileSystem,
        'Error tracking file selection',
        { error: err.message, stack: err.stack },
        Severity.Error
      );
      
      throw new FileSystemMonitorError(
        'FILE_SELECTION_ERROR',
        `Failed to track file selection: ${err.message}`,
        true
      );
    }
  }
  
  /**
   * Run all registered validation handlers against a file
   * @private
   * @param file - File to validate
   * @param operationId - ID of the associated operation
   */
  private async runFileValidations(file: File, operationId: string): Promise<void> {
    try {
      // Call all registered validation handlers
      const validationPromises = this.validationHandlers.map(handler => handler(file));
      const validationResults = await Promise.all(validationPromises);
      
      // Process validation results
      const failedValidations = validationResults.filter(result => !result.passed);
      
      if (failedValidations.length > 0) {
        this.logger.log(
          Tab.FileSystem,
          `File validation issues detected: ${file.name}`,
          {
            operationId,
            fileName: file.name,
            issues: failedValidations.map(v => ({
              type: v.type,
              message: v.message
            }))
          },
          Severity.Warn
        );
        
        // Emit validation failed event
        this.emit('fileValidationIssues', {
          operationId,
          fileName: file.name,
          issues: failedValidations
        });
      } else {
        // Emit validation success event
        this.emit('fileValidationPassed', {
          operationId,
          fileName: file.name
        });
      }
      
      // Update operation with validation results
      const operation = this.operations.find(op => op.id === operationId);
      if (operation) {
        operation.details = {
          ...operation.details,
          validationResults
        };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown validation error');
      throw new FileSystemMonitorError(
        'VALIDATION_ERROR',
        `File validation failed: ${err.message}`,
        true
      );
    }
  }
  
  /**
   * Track file upload with performance metrics
   * @param file - The file being uploaded
   * @param options - Upload operation options
   * @returns Promise that resolves with operation details when upload completes
   * @throws FileSystemMonitorError on failure
   */
  public trackFileUpload(file: File, options: {
    onProgress?: (progress: number) => void;
    abortSignal?: AbortSignal;
    customHeaders?: Record<string, string>;
    timeout?: number;
    retryCount?: number;
    correlationId?: string;
    generateChecksum?: boolean;
  } = {}): Promise<{ operationId: string; duration: number; success: boolean; checksum?: string }> {
    const startTime = Date.now();
    const operationId = uuidv4();
    
    // Store correlation ID if provided
    if (options.correlationId) {
      this.correlationIdMap.set(operationId, options.correlationId);
    }
    
    this.logger.log(
      Tab.FileSystem,
      `File upload initiated: ${file.name}`,
      { 
        operationId,
        correlationId: options.correlationId,
        sessionId: this.sessionId,
        fileName: file.name,
        fileSize: this.formatBytes(file.size),
        retryEnabled: options.retryCount !== undefined && options.retryCount > 0,
        checksumEnabled: !!options.generateChecksum
      },
      Severity.Info
    );
    
    // Emit upload started event
    this.emit('uploadStarted', { 
      operationId,
      fileName: file.name,
      fileSize: file.size
    });
    
    return new Promise(async (resolve, reject) => {
      let fileChecksum: string | undefined;
      
      // Generate checksum if requested
      if (options.generateChecksum) {
        try {
          fileChecksum = await this.calculateFileHash(file);
          
          this.logger.log(
            Tab.FileSystem,
            `File checksum generated: ${file.name}`,
            { 
              operationId,
              fileName: file.name,
              checksum: fileChecksum
            },
            Severity.Debug
          );
        } catch (error) {
          this.logger.log(
            Tab.FileSystem,
            `Failed to generate file checksum: ${file.name}`,
            { 
              operationId,
              fileName: file.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            },
            Severity.Warn
          );
        }
      }
      
      // Set up timeout if specified
      let timeoutId: number | undefined;
      if (options.timeout) {
        timeoutId = window.setTimeout(() => {
          const timeoutError = new FileSystemMonitorError(
            'UPLOAD_TIMEOUT',
            `Upload timed out after ${options.timeout}ms`,
            true
          );
          handleError(timeoutError);
        }, options.timeout);
      }
      
      // Set up abort handling
      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          const abortError = new FileSystemMonitorError(
            'UPLOAD_ABORTED',
            'Upload aborted before it began',
            true
          );
          handleError(abortError);
          return;
        }
        
        options.abortSignal.addEventListener('abort', () => {
          const abortError = new FileSystemMonitorError(
            'UPLOAD_ABORTED',
            'Upload aborted by user',
            true
          );
          handleError(abortError);
        });
      }
      
      // For this simulation, we'll calculate upload time based on file size
      // In a real implementation, this would be an actual HTTP request with proper progress tracking
      const simulatedUploadTime = Math.min(500, Math.max(50, Math.floor(file.size / 10000)));
      let progress = 0;
      
      const progressInterval = window.setInterval(() => {
        if (options.abortSignal?.aborted) {
          clearInterval(progressInterval);
          return;
        }
        
        progress += (100 / (simulatedUploadTime / 50));
        if (progress > 100) progress = 100;
        
        if (options.onProgress) {
          options.onProgress(Math.floor(progress));
        }
        
        // Emit progress event
        this.emit('uploadProgress', {
          operationId,
          fileName: file.name,
          progress: Math.floor(progress)
        });
        
        if (progress >= 100) {
          clearInterval(progressInterval);
        }
      }, 50);
      
      window.setTimeout(() => {
        clearInterval(progressInterval);
        
        if (options.abortSignal?.aborted) return;
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Clear timeout if it was set
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
        
        // Handle successful upload
        const uploadSpeed = file.size / (duration / 1000);
        
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || this.getFileTypeFromName(file.name),
          duration,
          details: {
            uploadSpeed: `${this.formatBytes(uploadSpeed)}/s`,
            headers: options.customHeaders,
            progressTracked: !!options.onProgress,
            checksum: fileChecksum,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        this.logger.log(
          Tab.FileSystem,
          `File upload completed: ${file.name}`,
          {
            operationId,
            fileName: file.name,
            fileSize: this.formatBytes(file.size),
            duration: `${duration}ms`,
            uploadSpeed: `${this.formatBytes(uploadSpeed)}/s`,
            checksum: fileChecksum,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          },
          Severity.Success
        );
        
        // Emit upload completed event
        this.emit('uploadCompleted', {
          operationId,
          fileName: file.name,
          fileSize: file.size,
          duration,
          checksum: fileChecksum
        });
        
        resolve({ operationId, duration, success: true, checksum: fileChecksum });
      }, simulatedUploadTime);
      
      // Retry handling function
      const retryUpload = async (
        currentRetry: number, 
        maxRetries: number, 
        error: Error
      ): Promise<void> => {
        if (currentRetry >= maxRetries) {
          handleError(error);
          return;
        }
        
        const backoffDelay = Math.pow(2, currentRetry) * 100;
        
        this.logger.log(
          Tab.FileSystem,
          `Retrying file upload: ${file.name} (Attempt ${currentRetry + 1}/${maxRetries})`,
          {
            operationId,
            fileName: file.name,
            fileSize: this.formatBytes(file.size),
            retryAttempt: currentRetry + 1,
            maxRetries,
            backoffDelay,
            previousError: error.message
          },
          Severity.Warn
        );
        
        // Emit retry event
        this.emit('uploadRetry', {
          operationId,
          fileName: file.name,
          retryAttempt: currentRetry + 1,
          maxRetries,
          error: error.message
        });
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Create new upload tracking (recursive call would go here in a real implementation)
        // For this simulation, we'll just succeed on the first retry
        const endTime = Date.now();
        const duration = endTime - startTime;
        const uploadSpeed = file.size / (duration / 1000);
        
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'upload',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || this.getFileTypeFromName(file.name),
          duration,
          details: {
            uploadSpeed: `${this.formatBytes(uploadSpeed)}/s`,
            headers: options.customHeaders,
            progressTracked: !!options.onProgress,
            retried: true,
            retryCount: currentRetry + 1,
            checksum: fileChecksum,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        this.logger.log(
          Tab.FileSystem,
          `File upload completed after retry: ${file.name}`,
          {
            operationId,
            fileName: file.name,
            fileSize: this.formatBytes(file.size),
            duration: `${duration}ms`,
            uploadSpeed: `${this.formatBytes(uploadSpeed)}/s`,
            retryAttempt: currentRetry + 1,
            checksum: fileChecksum
          },
          Severity.Success
        );
        
        // Emit upload completed event
        this.emit('uploadCompleted', {
          operationId,
          fileName: file.name,
          fileSize: file.size,
          duration,
          retried: true,
          retryCount: currentRetry + 1,
          checksum: fileChecksum
        });
        
        resolve({ operationId, duration, success: true, checksum: fileChecksum });
      };
      
      // Error handler function
      const handleError = (error: Error) => {
        clearInterval(progressInterval);
        
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
        
        // Check if retry is enabled and attempt a retry if possible
        if (options.retryCount && options.retryCount > 0) {
          retryUpload(0, options.retryCount, error).catch(reject);
          return;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'error',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || this.getFileTypeFromName(file.name),
          duration,
          error: error instanceof Error ? error : new Error('Unknown error'),
          details: {
            headers: options.customHeaders,
            progressTracked: !!options.onProgress,
            aborted: options.abortSignal?.aborted,
            correlationId: options.correlationId,
            sessionId: this.sessionId,
            checksum: fileChecksum
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        this.logger.log(
          Tab.FileSystem,
          `File upload failed: ${file.name}`,
          {
            operationId,
            fileName: file.name,
            fileSize: this.formatBytes(file.size),
            duration: `${duration}ms`,
            error: error.message,
            stack: error instanceof Error ? error.stack : undefined,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          },
          Severity.Error
        );
        
        // Emit upload failed event
        this.emit('uploadFailed', {
          operationId,
          fileName: file.name,
          fileSize: file.size,
          duration,
          error: error.message
        });
        
        reject(error instanceof FileSystemMonitorError ? error : new FileSystemMonitorError(
          'UPLOAD_ERROR',
          `Upload failed: ${error.message}`,
          true
        ));
      };
    });
  }
  
  /**
   * Calculate SHA-256 hash of a file
   * @param file - The file to calculate hash for
   * @returns Promise that resolves with hex-encoded hash
   */
  private async calculateFileHash(file: File): Promise<string> {
    try {
      // Use subtle crypto API to calculate hash
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      
      // Convert to hex string
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      throw new FileSystemMonitorError(
        'HASH_CALCULATION_ERROR',
        `Failed to calculate file hash: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
    }
  }
  
  /**
   * Track file reading operation with comprehensive error handling
   * @param file - The file to read
   * @param options - Reading options
   * @returns Promise with operation ID and file content
   */
  public trackFileRead(file: File, options: {
    encoding?: 'utf8' | 'binary' | 'base64' | 'dataURL';
    onProgress?: (progress: number) => void;
    abortSignal?: AbortSignal;
  } = {}): Promise<FileReadResult> {
    const startTime = Date.now();
    const operationId = uuidv4();
    
    this.logger.log(
      Tab.FileSystem,
      `File read initiated: ${file.name}`,
      { 
        operationId,
        fileName: file.name, 
        fileSize: this.formatBytes(file.size),
        encoding: options.encoding || 'utf8'
      },
      Severity.Info
    );
    
    return new Promise((resolve, reject) => {
      // Validate input
      if (!file) {
        const error = new Error('Cannot read null or undefined file');
        this.logFileReadError(operationId, 'unknown', startTime, error);
        reject(error);
        return;
      }
      
      // Check if aborted
      if (options.abortSignal?.aborted) {
        const error = new Error('File read aborted before it began');
        this.logFileReadError(operationId, file.name, startTime, error);
        reject(error);
        return;
      }
      
      // Set up abort handler
      const abortHandler = () => {
        reader.abort();
        const error = new Error('File read aborted by user');
        this.logFileReadError(operationId, file.name, startTime, error);
        reject(error);
      };
      
      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', abortHandler);
      }
      
      const reader = new FileReader();
      
      // Set up progress handler
      if (options.onProgress) {
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const progressPercent = Math.round((e.loaded / e.total) * 100);
            options.onProgress(progressPercent);
          }
        };
      }
      
      // Handle successful read
      reader.onload = (e) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const content = e.target?.result as string;
        const contentLength = content ? content.length : 0;
        
        // Clean up abort listener if it exists
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }
        
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'read',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || this.getFileTypeFromName(file.name),
          duration,
          details: {
            contentPreview: content ? `${content.substring(0, 100)}${content.length > 100 ? '...' : ''}` : '',
            contentLength,
            encoding: options.encoding || 'utf8',
            readSpeed: `${this.formatBytes(file.size / (duration / 1000))}/s`
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        this.logger.log(
          Tab.FileSystem,
          `File read completed: ${file.name}`,
          {
            operationId,
            fileName: file.name,
            fileSize: this.formatBytes(file.size),
            duration: `${duration}ms`,
            contentLength: this.formatBytes(contentLength),
            readSpeed: `${this.formatBytes(file.size / (duration / 1000))}/s`
          },
          Severity.Success
        );
        
        resolve({ 
          operationId, 
          content: content || '', 
          mimeType: file.type || this.getFileTypeFromName(file.name) 
        });
      };
      
      // Handle read error
      reader.onerror = (e) => {
        const error = e.target?.error || new Error('File read failed with unknown error');
        this.logFileReadError(operationId, file.name, startTime, error);
        
        // Clean up abort listener if it exists
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }
        
        reject(error);
      };
      
      // Start reading based on encoding option
      try {
        switch (options.encoding) {
          case 'binary':
            reader.readAsArrayBuffer(file);
            break;
          case 'base64':
          case 'dataURL':
            reader.readAsDataURL(file);
            break;
          case 'utf8':
          default:
            reader.readAsText(file);
            break;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to initiate file read');
        this.logFileReadError(operationId, file.name, startTime, err);
        
        // Clean up abort listener if it exists
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }
        
        reject(err);
      }
    });
  }
  
  /**
   * Track file processing with detailed metrics and cancellation support
   * @param fileName - Name of the file being processed
   * @param processingType - Type of processing being performed
   * @param options - Additional processing options
   * @returns Processing tracker with completion and cancellation methods
   */
  public trackFileProcessing(
    fileName: string, 
    processingType: string, 
    options: {
      fileSize?: number;
      fileType?: string;
      details?: Record<string, any>;
      timeout?: number;
      correlationId?: string;
      priority?: 'high' | 'medium' | 'low';
      tags?: string[];
    } = {}
  ): ProcessingTracker {
    const startTime = Date.now();
    const operationId = uuidv4();
    let isCancelled = false;
    let isCompleted = false;
    let timeoutId: number | undefined;
    
    // Store correlation ID if provided
    if (options.correlationId) {
      this.correlationIdMap.set(operationId, options.correlationId);
    }
    
    // Set timeout if specified
    if (options.timeout) {
      timeoutId = window.setTimeout(() => {
        if (!isCompleted && !isCancelled) {
          const timeoutError = new FileSystemMonitorError(
            'PROCESSING_TIMEOUT',
            `Processing timed out after ${options.timeout}ms`,
            true
          );
          this.completeProcessing(false, undefined, timeoutError);
        }
      }, options.timeout);
    }
    
    // Enhanced metadata
    const operationMetadata = {
      operationId,
      fileName, 
      processingType,
      fileSize: options.fileSize ? this.formatBytes(options.fileSize) : undefined,
      fileType: options.fileType,
      priority: options.priority || 'medium',
      tags: options.tags || [],
      correlationId: options.correlationId,
      sessionId: this.sessionId,
      ...options.details
    };
    
    this.logger.log(
      Tab.FileSystem,
      `File processing started: ${fileName} (${processingType})`,
      operationMetadata,
      Severity.Info
    );
    
    // Emit processing started event
    this.emit('processingStarted', {
      ...operationMetadata,
      timestamp: startTime
    });
    
    const completeProcessing = (params: ProcessingResult): void => {
      if (isCompleted || isCancelled) return;
      isCompleted = true;
      
      // Clear timeout if it exists
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (params.success) {
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'process',
          fileName,
          fileSize: options.fileSize,
          fileType: options.fileType,
          duration,
          details: {
            processingType,
            result: params.result || 'No result data',
            metrics: params.metrics || {},
            priority: options.priority || 'medium',
            tags: options.tags || [],
            correlationId: options.correlationId,
            sessionId: this.sessionId,
            ...options.details
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        // Format result summary safely
        let resultSummary: string;
        try {
          resultSummary = params.result 
            ? (typeof params.result === 'object' 
              ? JSON.stringify(params.result).substring(0, 100) + '...' 
              : String(params.result).substring(0, 100) + '...')
            : 'No result data';
        } catch (error) {
          resultSummary = 'Result cannot be stringified';
        }
        
        this.logger.log(
          Tab.FileSystem,
          `File processing completed: ${fileName} (${processingType})`,
          {
            operationId,
            fileName,
            processingType,
            duration: `${duration}ms`,
            resultSummary,
            metrics: params.metrics,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          },
          Severity.Success
        );
        
        // Emit processing completed event
        this.emit('processingCompleted', {
          operationId,
          fileName,
          processingType,
          duration,
          result: params.result,
          metrics: params.metrics
        });
      } else {
        const error = params.error || new FileSystemMonitorError(
          'PROCESSING_FAILED',
          'Processing failed with no specific error',
          true
        );
        
        const operation: FileOperation = {
          id: operationId,
          timestamp: startTime,
          type: 'error',
          fileName,
          fileSize: options.fileSize,
          fileType: options.fileType,
          duration,
          error,
          details: {
            processingType,
            metrics: params.metrics || {},
            priority: options.priority || 'medium',
            tags: options.tags || [],
            correlationId: options.correlationId,
            sessionId: this.sessionId,
            ...options.details
          }
        };
        
        this.operations.push(operation);
        this.trimOperationHistory();
        
        this.logger.log(
          Tab.FileSystem,
          `File processing failed: ${fileName} (${processingType})`,
          {
            operationId,
            fileName,
            processingType,
            duration: `${duration}ms`,
            error: error.message,
            errorCode: error instanceof FileSystemMonitorError ? error.code : 'UNKNOWN_ERROR',
            stack: error.stack,
            metrics: params.metrics,
            correlationId: options.correlationId,
            sessionId: this.sessionId
          },
          Severity.Error
        );
        
        // Emit processing failed event
        this.emit('processingFailed', {
          operationId,
          fileName,
          processingType,
          duration,
          error: error.message,
          errorCode: error instanceof FileSystemMonitorError ? error.code : 'UNKNOWN_ERROR',
          metrics: params.metrics
        });
      }
    };
    
    const cancelProcessing = (reason?: string): void => {
      if (isCompleted || isCancelled) return;
      isCancelled = true;
      
      // Clear timeout if it exists
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const cancelError = new FileSystemMonitorError(
        'PROCESSING_CANCELLED',
        reason || 'Processing cancelled by user',
        true
      );
      
      const operation: FileOperation = {
        id: operationId,
        timestamp: startTime,
        type: 'error',
        fileName,
        fileSize: options.fileSize,
        fileType: options.fileType,
        duration,
        error: cancelError,
        details: {
          processingType,
          cancelled: true,
          cancelReason: reason,
          priority: options.priority || 'medium',
          tags: options.tags || [],
          correlationId: options.correlationId,
          sessionId: this.sessionId,
          ...options.details
        }
      };
      
      this.operations.push(operation);
      this.trimOperationHistory();
      
      this.logger.log(
        Tab.FileSystem,
        `File processing cancelled: ${fileName} (${processingType})`,
        {
          operationId,
          fileName,
          processingType,
          duration: `${duration}ms`,
          reason: reason || 'User cancelled',
          correlationId: options.correlationId,
          sessionId: this.sessionId
        },
        Severity.Warn
      );
      
      // Emit processing cancelled event
      this.emit('processingCancelled', {
        operationId,
        fileName,
        processingType,
        duration,
        reason: reason || 'User cancelled'
      });
    };
    
    return { 
      operationId, 
      complete: (params: ProcessingResult) => completeProcessing(params),
      cancel: (reason?: string) => cancelProcessing(reason)
    };
  }
  
  /**
   * Export operation history to specified format
   * @param options - Export options
   * @returns String in the requested format
   */
  public exportOperations(options?: {
    format?: 'json' | 'csv' | 'html';
    filter?: {
      type?: FileOperationType | FileOperationType[];
      fileName?: string;
      startTime?: number;
      endTime?: number;
      correlationId?: string;
      tags?: string[];
      hasError?: boolean;
      minDuration?: number;
      maxDuration?: number;
    };
    includeMetrics?: boolean;
    anonymize?: boolean;
  }): string {
    const format = options?.format || 'json';
    const filter = options?.filter;
    const includeMetrics = options?.includeMetrics ?? true;
    const anonymize = options?.anonymize ?? false;
    
    let filteredOps = [...this.operations];
    
    // Apply filters if specified
    if (filter) {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        filteredOps = filteredOps.filter(op => types.includes(op.type));
      }
      
      if (filter.fileName) {
        filteredOps = filteredOps.filter(op => op.fileName === filter.fileName);
      }
      
      if (filter.startTime) {
        filteredOps = filteredOps.filter(op => op.timestamp >= filter.startTime!);
      }
      
      if (filter.endTime) {
        filteredOps = filteredOps.filter(op => op.timestamp <= filter.endTime!);
      }
      
      if (filter.correlationId) {
        filteredOps = filteredOps.filter(op => {
          return op.details?.correlationId === filter.correlationId || 
                 this.correlationIdMap.get(op.id) === filter.correlationId;
        });
      }
      
      if (filter.tags && filter.tags.length > 0) {
        filteredOps = filteredOps.filter(op => {
          const opTags = op.details?.tags || [];
          return filter.tags!.some(tag => opTags.includes(tag));
        });
      }
      
      if (filter.hasError !== undefined) {
        filteredOps = filteredOps.filter(op => 
          (op.error !== undefined || op.type === 'error') === filter.hasError
        );
      }
      
      if (filter.minDuration !== undefined) {
        filteredOps = filteredOps.filter(op => 
          op.duration !== undefined && op.duration >= filter.minDuration!
        );
      }
      
      if (filter.maxDuration !== undefined) {
        filteredOps = filteredOps.filter(op => 
          op.duration !== undefined && op.duration <= filter.maxDuration!
        );
      }
    }
    
    // Sanitize operations to remove circular references and apply anonymization if needed
    const sanitizedOps = filteredOps.map(op => {
      const sanitized = { ...op };
      
      // Convert Error objects to string representations
      if (sanitized.error instanceof Error) {
        (sanitized as any).error = {
          message: sanitized.error.message,
          name: sanitized.error.name,
          code: sanitized.error instanceof FileSystemMonitorError ? sanitized.error.code : undefined,
          stack: sanitized.error.stack
        };
      }
      
      // Anonymize sensitive data if requested
      if (anonymize) {
        if (sanitized.fileName) {
          // Replace actual filename with a hash
          const hashedName = this.hashString(sanitized.fileName);
          sanitized.fileName = `file_${hashedName.substring(0, 8)}`;
        }
        
        // Remove potentially sensitive details
        if (sanitized.details) {
          const safeDetails = { ...sanitized.details };
          
          // Keep only safe metadata
          const allowedDetailKeys = [
            'type', 'processingType', 'duration', 'timestamp',
            'uploadSpeed', 'progressTracked', 'cancelled'
          ];
          
          Object.keys(safeDetails).forEach(key => {
            if (!allowedDetailKeys.includes(key)) {
              delete safeDetails[key];
            }
          });
          
          sanitized.details = safeDetails;
        }
      }
      
      // Remove metrics if not requested
      if (!includeMetrics && sanitized.details?.metrics) {
        delete sanitized.details.metrics;
      }
      
      return sanitized;
    });
    
    // Format according to requested output type
    switch (format) {
      case 'csv':
        return this.convertToCSV(sanitizedOps);
      case 'html':
        return this.convertToHTML(sanitizedOps);
      case 'json':
      default:
        return JSON.stringify(sanitizedOps, null, 2);
    }
  }
  
  /**
   * Convert operations data to CSV format
   * @private
   * @param operations - Operations to convert
   * @returns CSV formatted string
   */
  private convertToCSV(operations: any[]): string {
    if (operations.length === 0) {
      return 'No operations to export';
    }
    
    // Flatten the structure for CSV format
    const flattenedOps = operations.map(op => {
      const flattened: Record<string, any> = {
        id: op.id,
        timestamp: new Date(op.timestamp).toISOString(),
        type: op.type,
        fileName: op.fileName || '',
        fileSize: op.fileSize ? this.formatBytes(op.fileSize) : '',
        fileType: op.fileType || '',
        duration: op.duration ? `${op.duration}ms` : '',
        error: op.error ? op.error.message : ''
      };
      
      // Add details as flattened columns
      if (op.details) {
        Object.entries(op.details).forEach(([key, value]) => {
          // Skip complex objects
          if (typeof value !== 'object' || value === null) {
            flattened[`detail_${key}`] = value;
          }
        });
      }
      
      return flattened;
    });
    
    // Get all possible columns
    const allColumns = new Set<string>();
    flattenedOps.forEach(op => {
      Object.keys(op).forEach(key => allColumns.add(key));
    });
    
    const columns = Array.from(allColumns);
    
    // Build CSV header
    let csv = columns.join(',') + '\n';
    
    // Add data rows
    flattenedOps.forEach(op => {
      const row = columns.map(column => {
        const value = op[column] === undefined ? '' : op[column];
        
        // Escape and quote strings
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      });
      
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }
  
  /**
   * Convert operations data to HTML format
   * @private
   * @param operations - Operations to convert
   * @returns HTML formatted string
   */
  private convertToHTML(operations: any[]): string {
    if (operations.length === 0) {
      return '<p>No operations to export</p>';
    }
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>File System Operations Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .error { color: #d32f2f; }
          .success { color: #388e3c; }
          h1 { color: #333; }
          .summary { margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>File System Operations Report</h1>
        <div class="summary">
          <p>Generated: ${new Date().toISOString()}</p>
          <p>Total Operations: ${operations.length}</p>
          <p>Time Range: ${new Date(operations[0].timestamp).toISOString()} - 
             ${new Date(operations[operations.length - 1].timestamp).toISOString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Type</th>
              <th>File Name</th>
              <th>File Size</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    operations.forEach(op => {
      const statusClass = op.error || op.type === 'error' ? 'error' : 'success';
      const statusText = op.error ? 'Error' : 'Success';
      
      // Format details as a list
      let detailsHtml = '';
      
      if (op.details) {
        detailsHtml = '<ul>';
        Object.entries(op.details).forEach(([key, value]) => {
          if (typeof value !== 'object' || value === null) {
            detailsHtml +=  '</ul>';
      }
      
      // Add error details if present
      if (op.error) {
        detailsHtml += `<div class="error">
          <strong>Error:</strong> ${op.error.message || 'Unknown error'}
          ${op.error.code ? `<br><strong>Code:</strong> ${op.error.code}` : ''}
        </div>`;
      }
      
      html += `
        <tr>
          <td>${op.id}</td>
          <td>${new Date(op.timestamp).toISOString()}</td>
          <td>${op.type}</td>
          <td>${op.fileName || '-'}</td>
          <td>${op.fileSize ? this.formatBytes(op.fileSize) : '-'}</td>
          <td>${op.duration ? `${op.duration}ms` : '-'}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${detailsHtml}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    return html;
  }
  
  /**
   * Create a simple hash of a string
   * @private
   * @param str - String to hash
   * @returns Hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(16);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  } `<li><strong>${key}:</strong> ${value}</li>`;
          }
        });
        detailsHtml +=
  
  /**
   * Get all file operations with enhanced filtering options
   * @param filter - Optional filter criteria
   * @returns Array of matching file operations
   */
  public getOperations(filter?: {
    type?: FileOperationType | FileOperationType[];
    fileName?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    orderBy?: 'timestamp' | 'duration' | 'fileSize';
    orderDirection?: 'asc' | 'desc';
    correlationId?: string;
    tags?: string[];
    hasError?: boolean;
    minDuration?: number;
    maxDuration?: number;
    search?: string;
    offset?: number;
  }): FileOperation[] {
    let filteredOps = [...this.operations];
    
    if (filter) {
      // Type filter
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        filteredOps = filteredOps.filter(op => types.includes(op.type));
      }
      
      // Filename filter
      if (filter.fileName) {
        filteredOps = filteredOps.filter(op => op.fileName === filter.fileName);
      }
      
      // Time range filters
      if (filter.startTime) {
        filteredOps = filteredOps.filter(op => op.timestamp >= filter.startTime!);
      }
      
      if (filter.endTime) {
        filteredOps = filteredOps.filter(op => op.timestamp <= filter.endTime!);
      }
      
      // Correlation ID filter
      if (filter.correlationId) {
        filteredOps = filteredOps.filter(op => {
          return op.details?.correlationId === filter.correlationId || 
                 this.correlationIdMap.get(op.id) === filter.correlationId;
        });
      }
      
      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        filteredOps = filteredOps.filter(op => {
          const opTags = op.details?.tags || [];
          return filter.tags!.some(tag => opTags.includes(tag));
        });
      }
      
      // Error filter
      if (filter.hasError !== undefined) {
        filteredOps = filteredOps.filter(op => 
          (op.error !== undefined || op.type === 'error') === filter.hasError
        );
      }
      
      // Duration range filters
      if (filter.minDuration !== undefined) {
        filteredOps = filteredOps.filter(op => 
          op.duration !== undefined && op.duration >= filter.minDuration!
        );
      }
      
      if (filter.maxDuration !== undefined) {
        filteredOps = filteredOps.filter(op => 
          op.duration !== undefined && op.duration <= filter.maxDuration!
        );
      }
      
      // Text search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredOps = filteredOps.filter(op => {
          return (
            // Search in filename
            (op.fileName?.toLowerCase().includes(searchLower)) || 
            // Search in filetype
            (op.fileType?.toLowerCase().includes(searchLower)) ||
            // Search in details
            (op.details && JSON.stringify(op.details).toLowerCase().includes(searchLower)) ||
            // Search in error message
            (op.error && op.error.message.toLowerCase().includes(searchLower))
          );
        });
      }
      
      // Sorting
      if (filter.orderBy) {
        const direction = filter.orderDirection === 'asc' ? 1 : -1;
        
        filteredOps.sort((a, b) => {
          let aValue, bValue;
          
          switch (filter.orderBy) {
            case 'timestamp':
              aValue = a.timestamp;
              bValue = b.timestamp;
              break;
            case 'duration':
              aValue = a.duration || 0;
              bValue = b.duration || 0;
              break;
            case 'fileSize':
              aValue = a.fileSize || 0;
              bValue = b.fileSize || 0;
              break;
            default:
              aValue = a.timestamp;
              bValue = b.timestamp;
          }
          
          return direction * (aValue > bValue ? 1 : aValue < bValue ? -1 : 0);
        });
      } else {
        // Default sort by timestamp (newest first)
        filteredOps.sort((a, b) => b.timestamp - a.timestamp);
      }
      
      // Apply offset if specified
      if (filter.offset && filter.offset > 0) {
        filteredOps = filteredOps.slice(filter.offset);
      }
      
      // Apply limit if specified
      if (filter.limit && filter.limit > 0) {
        filteredOps = filteredOps.slice(0, filter.limit);
      }
    } else {
      // Default sort by timestamp (newest first) if no filter specified
      filteredOps.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return filteredOps;
  }
  
  /**
   * Get operations filtered by type
   * @param type - The operation type to filter by
   * @param limit - Optional limit on number of results
   * @returns Array of matching operations
   */
  public getOperationsByType(type: FileOperationType, limit?: number): FileOperation[] {
    return this.getOperations({ type, limit });
  }
  
  /**
   * Get operations for a specific file
   * @param fileName - The filename to filter by
   * @param limit - Optional limit on number of results
   * @returns Array of matching operations
   */
  public getOperationsByFileName(fileName: string, limit?: number): FileOperation[] {
    return this.getOperations({ fileName, limit });
  }
  
  /**
   * Get operation by ID
   * @param id - Operation ID to find
   * @returns Operation or null if not found
   */
  public getOperationById(id: string): FileOperation | null {
    return this.operations.find(op => op.id === id) || null;
  }
  
  /**
   * Get the active file
   * @returns Currently active file or null
   */
  public getActiveFile(): File | null {
    return this.activeFile;
  }
  
  /**
   * Clear operation history
   * @param filter - Optional filter to selectively clear operations
   * @returns Number of operations cleared
   */
  public clearOperations(filter?: {
    olderThan?: number;
    type?: FileOperationType | FileOperationType[];
    fileName?: string;
  }): number {
    const originalCount = this.operations.length;
    
    if (!filter) {
      // Clear all operations
      this.operations = [];
      this.logger.log(
        Tab.FileSystem, 
        'All file operation history cleared', 
        { count: originalCount }, 
        Severity.Info
      );
      return originalCount;
    }
    
    // Apply filters
    let remainingOps = [...this.operations];
    
    if (filter.olderThan) {
      remainingOps = remainingOps.filter(op => op.timestamp >= filter.olderThan!);
    }
    
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      remainingOps = remainingOps.filter(op => !types.includes(op.type));
    }
    
    if (filter.fileName) {
      remainingOps = remainingOps.filter(op => op.fileName !== filter.fileName);
    }
    
    const removedCount = originalCount - remainingOps.length;
    this.operations = remainingOps;
    
    this.logger.log(
      Tab.FileSystem, 
      'Selectively cleared file operation history', 
      { 
        removedCount, 
        remainingCount: remainingOps.length,
        filter 
      }, 
      Severity.Info
    );
    
    return removedCount;
  }
  
  /**
   * Get file operation statistics with detailed metrics
   * @param options - Statistics calculation options
   * @returns Statistics about file operations
   */
  public getStatistics(options?: {
    startTime?: number;
    endTime?: number;
    fileTypes?: string[];
    includeHistogram?: boolean;
    groupBy?: 'day' | 'hour' | 'minute' | 'fileType';
  }): {
    totalOperations: number;
    operationsByType: Record<FileOperationType, number>;
    averageDurations: Partial<Record<FileOperationType, number>>;
    errorRate: number;
    totalBytesProcessed: number;
    successRate: number;
    topFiles?: { fileName: string; count: number }[];
    trends?: Record<string, number>;
    histogram?: Record<string, number[]>;
    medianDuration?: number;
  } {
    // Filter operations by time range if specified
    let ops = [...this.operations];
    
    if (options?.startTime) {
      ops = ops.filter(op => op.timestamp >= options.startTime!);
    }
    
    if (options?.endTime) {
      ops = ops.filter(op => op.timestamp <= options.endTime!);
    }
    
    if (options?.fileTypes && options.fileTypes.length > 0) {
      ops = ops.filter(op => op.fileType && options.fileTypes!.includes(op.fileType));
    }
    
    const stats = {
      totalOperations: ops.length,
      operationsByType: {} as Record<FileOperationType, number>,
      averageDurations: {} as Partial<Record<FileOperationType, number>>,
      errorRate: 0,
      totalBytesProcessed: 0,
      successRate: 0,
      topFiles: [] as { fileName: string; count: number }[],
      trends: {} as Record<string, number>,
      medianDuration: 0
    };
    
    // Initialize operation types counter
    const types: FileOperationType[] = ['select', 'upload', 'read', 'process', 'error', 'clear'];
    types.forEach(type => {
      stats.operationsByType[type] = 0;
    });
    
    // Count operations by type and collect durations
    const durationSums: Partial<Record<FileOperationType, number>> = {};
    const durationCounts: Partial<Record<FileOperationType, number>> = {};
    const fileNameCounts: Record<string, number> = {};
    const allDurations: number[] = [];
    
    ops.forEach(op => {
      // Count by type
      stats.operationsByType[op.type]++;
      
      // Count by filename
      if (op.fileName) {
        fileNameCounts[op.fileName] = (fileNameCounts[op.fileName] || 0) + 1;
      }
      
      // Sum durations for average calculation
      if (op.duration !== undefined) {
        durationSums[op.type] = (durationSums[op.type] || 0) + op.duration;
        durationCounts[op.type] = (durationCounts[op.type] || 0) + 1;
        allDurations.push(op.duration);
      }
      
      // Sum bytes processed
      if (op.fileSize !== undefined) {
        stats.totalBytesProcessed += op.fileSize;
      }
    });
    
    // Calculate average durations
    types.forEach(type => {
      if (durationCounts[type] && durationCounts[type]! > 0) {
        stats.averageDurations[type] = durationSums[type]! / durationCounts[type]!;
      }
    });
    
    // Calculate error rate and success rate
    stats.errorRate = stats.operationsByType.error / Math.max(1, stats.totalOperations);
    stats.successRate = 1 - stats.errorRate;
    
    // Calculate median duration
    if (allDurations.length > 0) {
      allDurations.sort((a, b) => a - b);
      const mid = Math.floor(allDurations.length / 2);
      stats.medianDuration = allDurations.length % 2 === 0 
        ? (allDurations[mid - 1] + allDurations[mid]) / 2 
        : allDurations[mid];
    }
    
    // Get top files by operation count
    stats.topFiles = Object.entries(fileNameCounts)
      .map(([fileName, count]) => ({ fileName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Generate trends if groupBy is specified
    if (options?.groupBy) {
      switch (options.groupBy) {
        case 'day':
          stats.trends = this.groupOperationsByTimeUnit(ops, 86400000); // 1 day in ms
          break;
        case 'hour':
          stats.trends = this.groupOperationsByTimeUnit(ops, 3600000); // 1 hour in ms
          break;
        case 'minute':
          stats.trends = this.groupOperationsByTimeUnit(ops, 60000); // 1 minute in ms
          break;
        case 'fileType':
          stats.trends = this.groupOperationsByFileType(ops);
          break;
      }
    }
    
    // Generate histograms if requested
    if (options?.includeHistogram) {
      const histogram: Record<string, number[]> = {};
      
      // Duration histogram
      if (allDurations.length > 0) {
        const max = Math.max(...allDurations);
        const min = Math.min(...allDurations);
        const range = max - min;
        const bucketCount = 10;
        const bucketSize = range / bucketCount;
        
        const durationHistogram = new Array(bucketCount).fill(0);
        
        allDurations.forEach(duration => {
          const index = Math.min(
            bucketCount - 1,
            Math.floor((duration - min) / bucketSize)
          );
          durationHistogram[index]++;
        });
        
        histogram.duration = durationHistogram;
      }
      
      // File size histogram
      const fileSizes = ops
        .filter(op => op.fileSize !== undefined)
        .map(op => op.fileSize!);
      
      if (fileSizes.length > 0) {
        const max = Math.max(...fileSizes);
        const min = Math.min(...fileSizes);
        const range = max - min;
        const bucketCount = 10;
        const bucketSize = range / bucketCount;
        
        const sizeHistogram = new Array(bucketCount).fill(0);
        
        fileSizes.forEach(size => {
          const index = Math.min(
            bucketCount - 1,
            Math.floor((size - min) / bucketSize)
          );
          sizeHistogram[index]++;
        });
        
        histogram.fileSize = sizeHistogram;
      }
      
      stats.histogram = histogram;
    }
    
    return stats;
  }
  
  /**
   * Group operations by time unit
   * @private
   * @param operations - Operations to group
   * @param timeUnitMs - Time unit in milliseconds
   * @returns Grouped trends data
   */
  private groupOperationsByTimeUnit(operations: FileOperation[], timeUnitMs: number): Record<string, number> {
    const trends: Record<string, number> = {};
    
    operations.forEach(op => {
      const timeKey = Math.floor(op.timestamp / timeUnitMs) * timeUnitMs;
      const label = new Date(timeKey).toISOString();
      
      trends[label] = (trends[label] || 0) + 1;
    });
    
    return trends;
  }
  
  /**
   * Group operations by file type
   * @private
   * @param operations - Operations to group
   * @returns Grouped trends data
   */
  private groupOperationsByFileType(operations: FileOperation[]): Record<string, number> {
    const trends: Record<string, number> = {};
    
    operations.forEach(op => {
      if (op.fileType) {
        trends[op.fileType] = (trends[op.fileType] || 0) + 1;
      } else {
        trends['unknown'] = (trends['unknown'] || 0) + 1;
      }
    });
    
    return trends;
  }
  
  /**
   * Format bytes to human-readable format
   * @param bytes - Number of bytes
   * @param decimals - Number of decimal places
   * @returns Formatted string with appropriate units
   */
  public formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    if (!Number.isFinite(bytes)) return 'Invalid size';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
  
  /**
   * Get MIME type from file name
   * @param fileName - Name of file to analyze
   * @returns Detected MIME type
   */
  public getFileTypeFromName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return 'application/octet-stream';
    
    const mimeTypes: Record<string, string> = {
      // Text formats
      'txt': 'text/plain',
      'log': 'text/plain',
      'md': 'text/markdown',
      'csv': 'text/csv',
      'tsv': 'text/tab-separated-values',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'rtf': 'text/rtf',
      
      // Application formats
      'json': 'application/json',
      'xml': 'application/xml',
      'yaml': 'application/yaml',
      'yml': 'application/yaml',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'jsx': 'application/javascript',
      'tsx': 'application/typescript',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      'rar': 'application/vnd.rar',
      '7z': 'application/x-7z-compressed',
      
      // Microsoft Office formats
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      
      // Open document formats
      'odt': 'application/vnd.oasis.opendocument.text',
      'ods': 'application/vnd.oasis.opendocument.spreadsheet',
      'odp': 'application/vnd.oasis.opendocument.presentation',
      
      // Image formats
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
      
      // Audio formats
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'm4a': 'audio/mp4',
      
      // Video formats
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'mkv': 'video/x-matroska',
      
      // Programming and script formats
      'py': 'text/x-python',
      'java': 'text/x-java',
      'c': 'text/x-c',
      'cpp': 'text/x-c++',
      'cs': 'text/x-csharp',
      'go': 'text/x-go',
      'rb': 'text/x-ruby',
      'php': 'text/x-php',
      'sql': 'text/x-sql',
      'sh': 'text/x-shellscript',
      'bat': 'text/x-bat',
      'ps1': 'text/x-powershell',
      
      // Database formats
      'db': 'application/vnd.sqlite3',
      'sqlite': 'application/vnd.sqlite3',
      'mdb': 'application/vnd.ms-access',
      
      // 3D model formats
      'obj': 'model/obj',
      'stl': 'model/stl',
      'fbx': 'model/fbx',
      'gltf': 'model/gltf+json',
      'glb': 'model/gltf-binary',
      
      // Font formats
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      
      // Other common formats
      'exe': 'application/x-msdownload',
      'dll': 'application/x-msdownload',
      'iso': 'application/x-iso9660-image'
    };
    
    return mimeTypes[extension] || `application/${extension}`;
  }
  
  /**
   * Check if a file type is considered safe
   * @param fileType - MIME type or extension to check
   * @returns Whether the file type is safe
   */
  public isFiletypeSafe(fileType: string): boolean {
    // Extract extension if full MIME type
    let extension = fileType.toLowerCase();
    if (extension.includes('/')) {
      extension = extension.split('/').pop() || '';
    }
    
    // Check against unsafe extensions list
    return !this.config.unsafeExtensions.includes(extension);
  }
  
  /**
   * Check a file for potential usage issues
   * @param file - The file to check
   * @returns Array of identified issues
   */
  private checkFileForIssues(file: File): { type: string; severity: Severity; message: string; recommendation?: string }[] {
    const issues: { type: string; severity: Severity; message: string; recommendation?: string }[] = [];
    
    // Check file size
    if (file.size > this.config.maxFileSize) {
      const issue = {
        type: 'large_file',
        severity: Severity.Warn,
        message: `Large file detected: ${file.name} (${this.formatBytes(file.size)})`,
        recommendation: 'Consider compressing or splitting the file for better performance'
      };
      
      issues.push(issue);
      
      this.logger.log(
        Tab.FileSystem,
        issue.message,
        {
          fileName: file.name,
          fileSize: this.formatBytes(file.size),
          recommendation: issue.recommendation
        },
        Severity.Warn
      );
    }
    
    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension && this.config.unsafeExtensions.includes(extension)) {
      const issue = {
        type: 'unsafe_filetype',
        severity: Severity.Warn,
        message: `Potentially unsafe file type: ${file.name}`,
        recommendation: 'This file type might be blocked by security features or pose security risks'
      };
      
      issues.push(issue);
      
      this.logger.log(
        Tab.FileSystem,
        issue.message,
        {
          fileName: file.name,
          fileType: file.type || this.getFileTypeFromName(file.name),
          warning: issue.recommendation
        },
        Severity.Warn
      );
    }
    
    // Check file name length
    if (file.name.length > this.config.maxFileNameLength) {
      const issue = {
        type: 'long_filename',
        severity: Severity.Warn,
        message: `Very long filename detected: ${file.name.substring(0, 50)}...`,
        recommendation: 'Long filenames may cause issues on some filesystems or in URLs'
      };
      
      issues.push(issue);
      
      this.logger.log(
        Tab.FileSystem,
        issue.message,
        {
          fileName: file.name,
          nameLength: file.name.length,
          recommendation: issue.recommendation
        },
        Severity.Warn
      );
    }
    
    // Check for zero-byte files
    if (file.size === 0) {
      const issue = {
        type: 'empty_file',
        severity: Severity.Warn,
        message: `Empty file detected: ${file.name}`,
        recommendation: 'The file contains no data, which might indicate corruption or incorrect selection'
      };
      
      issues.push(issue);
      
      this.logger.log(
        Tab.FileSystem,
        issue.message,
        {
          fileName: file.name,
          recommendation: issue.recommendation
        },
        Severity.Warn
      );
    }
    
    return issues;
  }
  
  /**
   * Log a file read error with consistent format
   * @private
   */
  private logFileReadError(operationId: string, fileName: string, startTime: number, error: Error): void {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const operation: FileOperation = {
      id: operationId,
      timestamp: startTime,
      type: 'error',
      fileName,
      duration,
      error,
      details: { 
        errorName: error.name,
        operation: 'read'
      }
    };
    
    this.operations.push(operation);
    this.trimOperationHistory();
    
    this.logger.log(
      Tab.FileSystem,
      `File read failed: ${fileName}`,
      {
        operationId,
        fileName,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack
      },
      Severity.Error
    );
  }
  
  /**
   * Trim operation history to stay within limits
   * @private
   */
  private trimOperationHistory(): void {
    if (this.operations.length <= this.config.maxOperations) {
      return;
    }
    
    // Keep 75% of max capacity, prioritizing newer operations
    const keepCount = Math.floor(this.config.maxOperations * 0.75);
    const removeCount = this.operations.length - keepCount;
    
    // Sort by timestamp to ensure we keep the newest operations
    this.operations.sort((a, b) => b.timestamp - a.timestamp);
    this.operations = this.operations.slice(0, keepCount);
    
    this.logger.log(
      Tab.FileSystem,
      `Trimmed operation history`,
      { 
        removedCount: removeCount, 
        remainingCount: this.operations.length,
        maxOperations: this.config.maxOperations
      },
      Severity.Debug
    );
  }
}