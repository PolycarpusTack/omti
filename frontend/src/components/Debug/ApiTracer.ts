  /**
   * Start batch flush interval for batched logging using setInterval
   */
  private startBatchFlushInterval(): void {
    if (this.batchIntervalId) {
      this.stopBatchFlushInterval();
    }
    
    // Use idle callback when available for better performance
    if (typeof this.scheduler.requestIdleCallback === 'function') {
      const scheduleIdleCallback = () => {
        this.idleCallbackId = this.scheduler.requestIdleCallback(() => {
          this.flushBatchedLogs();
          scheduleIdleCallback(); // Reschedule
        }, { timeout: this.batchFlushInterval });
      };
      
      scheduleIdleCallback();
    } else {
      // Fall back to interval if idle callback not available
      this.batchIntervalId = this.scheduler.setInterval(() => {
        this.flushBatchedLogs();
      }, this.batchFlushInterval);
    }
  }
  
  /**
   * Stop batch flush interval
   */
  private stopBatchFlushInterval(): void {
    if (this.batchIntervalId) {
      this.scheduler.clearInterval(this.batchIntervalId);
      this.batchIntervalId = null;
    }
    
    if (this.idleCallbackId !== null) {
      this.scheduler.cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }
  
  /**
   * Start storage interval for persistence
   */
  private startStorageInterval(): void {
    if (!this.storage || !this.storage.autoSave) return;
    
    const saveInterval = this.storage.saveInterval || 30000; // 30 seconds default
    
    this.storageIntervalId = this.scheduler.setInterval(() => {
      this.saveToStorage();
    }, saveInterval);
  }
  
  /**
   * Stop storage interval
   */
  private stopStorageInterval(): void {
    if (this.storageIntervalId) {
      this.scheduler.clearInterval(this.storageIntervalId);
      this.storageIntervalId = null;
    }
  }
  
  /**
   * Save current state to storage
   */
  private saveToStorage(): void {
    if (!this.storage) return;
    
    try {
      // Prepare data for storage (only store completed calls to save space)
      const completedCalls = this.calls.filter(call => call.completedAt);
      
      // Prepare a compressed snapshot
      const snapshot = {
        timestamp: Date.now(),
        calls: completedCalls.map(call => {
          // Create a minimal version of the call
          return {
            callId: call.callId,
            timestamp: call.timestamp,
            completedAt: call.completedAt,
            url: call.url,
            method: call.method,
            status: call.status,
            responseTime: call.responseTime,
            originComponent: call.originComponent,
            originAction: call.originAction,
            error: call.error ? true : undefined
          };
        }),
        metrics: this.metricsEnabled ? this.getPerformanceMetrics() : undefined
      };
      
      // Convert to string
      const dataString = JSON.stringify(snapshot);
      
      // Store in the selected storage
      if (this.storage.type === 'localStorage' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('api-tracer-snapshot', dataString);
      } else if (this.storage.type === 'sessionStorage' && typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('api-tracer-snapshot', dataString);
      } else if (this.storage.type === 'custom' && this.storage.customStore) {
        this.storage.customStore.setItem('api-tracer-snapshot', dataString);
      }
      
      this.debugLog('Saved state to storage', {
        callCount: completedCalls.length,
        timestamp: snapshot.timestamp
      });
    } catch (e) {
      this.debugLog('Error saving to storage', { error: e });
    }
  }
  
  /**
   * Load state from storage
   */
  private loadFromStorage(): void {
    if (!this.storage) return;
    
    try {
      let dataString = null;
      
      // Get from the selected storage
      if (this.storage.type === 'localStorage' && typeof window !== 'undefined' && window.localStorage) {
        dataString = window.localStorage.getItem('api-tracer-snapshot');
      } else if (this.storage.type === 'sessionStorage' && typeof window !== 'undefined' && window.sessionStorage) {
        dataString = window.sessionStorage.getItem('api-tracer-snapshot');
      } else if (this.storage.type === 'custom' && this.storage.customStore) {
        dataString = this.storage.customStore.getItem('api-tracer-snapshot');
      }
      
      if (!dataString) return;
      
      // Parse the stored data
      const snapshot = JSON.parse(dataString);
      
      // Only import if it's recent (within last 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - snapshot.timestamp > maxAge) {
        this.debugLog('Stored data is too old, not loading', {
          age: this.formatTimeDuration(Date.now() - snapshot.timestamp)
        });
        return;
      }
      
      // Import the calls
      if (snapshot.calls && Array.isArray(snapshot.calls)) {
        this.log(
          Tab.ApiDebug,
          'Loaded previous API calls from storage',
          { 
            callCount: snapshot.calls.length,
            age: this.formatTimeDuration(Date.now() - snapshot.timestamp)
          },
          Severity.Info
        );
        
        // We don't replace existing calls, just add the restored ones
        this.calls = [...this.calls, ...snapshot.calls];
        
        // Ensure we don't exceed max calls
        if (this.calls.length > this.maxCalls) {
          this.calls = this.calls.slice(-this.maxCalls);
        }
      }
      
      // Import metrics if available
      if (this.metricsEnabled && snapshot.metrics) {
        // We don't directly import metrics to avoid corruption,
        // but we could use this to initialize certain metrics if needed
        this.debugLog('Metrics data available in snapshot', {
          metrics: snapshot.metrics
        });
      }
    } catch (e) {
      this.debugLog('Error loading from storage', { error: e });
    }
  }
  
  /**
   * Format time duration into human-readable string
   */
  private formatTimeDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    return `${Math.round(ms / 86400000)}d`;
  }
  
  /**
   * Flush batched logs to the logger
   */
  private flushBatchedLogs(): void {
    if (this.batchedLogs.length === 0) return;
    
    try {
      // Group by tab, severity, and priority for more efficient logging
      const groupedLogs: Record<string, Record<string, Record<string, BatchLogEntry[]>>> = {};
      
      // Group logs by tab, severity, and priority
      this.batchedLogs.forEach(log => {
        const tabKey = String(log.tab);
        const severityKey = String(log.severity);
        const priorityKey = log.priority || 'normal';
        
        if (!groupedLogs[tabKey]) {
          groupedLogs[tabKey] = {};
        }
        
        if (!groupedLogs[tabKey][severityKey]) {
          groupedLogs[tabKey][severityKey] = {};
        }
        
        if (!groupedLogs[tabKey][severityKey][priorityKey]) {
          groupedLogs[tabKey][severityKey][priorityKey] = [];
        }
        
        groupedLogs[tabKey][severityKey][priorityKey].push(log);
      });
      
      // Log each group, process high priority first
      for (const [tab, severityGroups] of Object.entries(groupedLogs)) {
        for (const [severity, priorityGroups] of Object.entries(severityGroups)) {
          // Process priorities in order: high, normal, low
          const priorities = ['high', 'normal', 'low'];
          
          for (const priority of priorities) {
            const logs = priorityGroups[priority];
            if (!logs || logs.length === 0) continue;
            
            // Sort logs by timestamp
            logs.sort((a, b) => a.timestamp - b.timestamp);
            
            if (logs.length === 1) {
              // Single log, log normally
              const log = logs[0];
              this.logger.log(log.tab, log.message, log.data, log.severity);
            } else {
              // Multiple logs, batch them
              const batchData = logs.map(log => ({
                timestamp: log.timestamp,
                message: log.message,
                data: log.data
              }));
              
              this.logger.log(
                tab, 
                `Batch log: ${logs.length} entries`, 
                { entries: batchData, priority }, 
                severity
              );
            }
          }
        }
      }
      
      // Clear the batched logs
      this.batchedLogs = [];
    } catch (e) {
      // Error in batched logging, try to use fallback methods
      if (this.debugMode) {
        // In debug mode, we can log to console as a fallback
        try {
          console.warn('Error flushing batched logs', e);
        } catch (consoleError) {
          // Even console logging failed, nothing more we can do
        }
      }
      
      // Try to log individual entries as a fallback
      try {
        for (let i = 0; i < this.batchedLogs.length; i++) {
          try {
            const log = this.batchedLogs[i];
            this.logger.log(log.tab, log.message, log.data, log.severity);
          } catch (individualError) {
            // Skip individual failures
            if (this.debugMode) {
              try {
                console.warn('Failed to log individual entry', individualError);
              } catch (innerError) {
                // Nothing more we can do
              }
            }
          }
        }
      } catch (fallbackError) {
        // If even the fallback fails, we give up to avoid infinite recursion
      }
      
      // Clear the batched logs to prevent retry of failed batch
      this.batchedLogs = [];
    }
  }
  
  /**
   * Internal logging wrapper for API tracer
   */
  private log(
    tab: Tab | string, 
    message: string, 
    data: any = {}, 
    severity: Severity | string = Severity.Info,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    try {
      // Ensure data is a proper object and not null
      const safeData = data === null ? {} : typeof data === 'object' ? data : { value: data };
      
      // If batch logging is enabled, add to batch
      if (this.batchLogging) {
        this.batchedLogs.push({
          tab,
          message,
          data: safeData as Record<string, any>,
          severity,
          timestamp: Date.now(),
          priority
        });
        
        // If we have too many batched logs, flush them immediately
        if (this.batchedLogs.length >= this.maxBatchSize) {
          this.flushBatchedLogs();
        }
        
        // Also flush immediately for high priority logs
        if (priority === 'high') {
          // Use idle callback when available to avoid blocking UI
          if (typeof this.scheduler.requestIdleCallback === 'function') {
            this.scheduler.requestIdleCallback(() => {
              this.flushBatchedLogs();
            }, { timeout: 100 }); // Ensure it runs within 100ms even if app is busy
          } else {
            // Immediate flush for high priority
            this.flushBatchedLogs();
          }
        }
        
        return;
      }
      
      // Otherwise log immediately
      this.logger.log(tab, message, safeData, severity);
    } catch (e) {
      // Only use console.error in debug mode
      if (this.debugMode) {
        try {
          console.error('ApiTracer: Error logging message', message, e);
        } catch (consoleError) {
          // Even console logging failed, nothing more we can do
        }
      }
    }
  }
  
  /**
   * Debug logging - only outputs in debug mode
   */
  private debugLog(message: string, data: any = {}): void {
    if (!this.debugMode) return;
    
    try {
      // Ensure data is a proper object and not null
      const safeData = data === null ? {} : typeof data === 'object' ? data : { value: data };
      
      this.log(Tab.ApiDebug, `[DEBUG] ${message}`, safeData, Severity.Debug);
    } catch (e) {
      // Only use console.debug in debug mode (we're already in a debug function)
      try {
        console.debug('ApiTracer debug:', message, data);
      } catch (consoleError) {
        // Even console logging failed, nothing more we can do
      }
    }
  }
  
  /**
   * Get statistics about the current API tracer state
   * Useful for monitoring memory usage and performance
   */
  getStats(): Record<string, any> {
    return {
      totalCalls: this.calls.length,
      inFlightRequests: this.inFlightRequests.size,
      actionStackDepth: this.actionStack.length,
      actionStacks: this.actionStacks.size,
      batchedLogs: this.batchedLogs.length,
      webSocketMessages: this.webSocketMessages.length,
      webSocketConnections: this.webSocketConnections.size,
      correlationIdCounter: this.correlationIdCounter,
      enabled: this.enabled,
      batchLogging: this.batchLogging,
      configLimits: {
        maxCalls: this.maxCalls,
        maxInFlightRequests: this.maxInFlightRequests,
        maxCorrelationIdCounter: this.maxCorrelationIdCounter,
        maxActionsPerStack: this.maxActionsPerStack,
        maxActionStackSize: this.maxActionStackSize,
        maxBatchSize: this.maxBatchSize
      },
      memoryEstimate: {
        callsBytes: this.estimateObjectSize(this.calls),
        actionStackBytes: this.estimateObjectSize(this.actionStack),
        actionStacksBytes: this.estimateMapSize(this.actionStacks),
        inFlightBytes: this.estimateMapSize(this.inFlightRequests),
        batchedLogsBytes: this.estimateObjectSize(this.batchedLogs),
        webSocketBytes: this.estimateObjectSize(this.webSocketMessages)
      },
      cpuUsage: this.estimateCpuUsage(),
      memoryUsage: this.estimateMemoryUsage(),
      metrics: this.metricsEnabled ? this.getPerformanceMetrics() : null
    };
  }
  
  /**
   * Estimate the size of an object in bytes (rough approximation)
   * @internal
   */
  private estimateObjectSize(obj: any): number {
    try {
      if (!obj) return 0;
      
      // For arrays, estimate size of a sample and multiply
      if (Array.isArray(obj)) {
        if (obj.length === 0) return 0;
        
        // For large arrays, just sample a subset
        const sampleSize = Math.min(obj.length, 10);
        const sample = obj.slice(0, sampleSize);
        const sampleJson = JSON.stringify(sample);
        
        // Estimate based on sample ratio
        return Math.round((sampleJson.length * 2) * (obj.length / sampleSize));
      }
      
      // For regular objects
      const jsonString = JSON.stringify(obj);
      return jsonString ? jsonString.length * 2 : 0; // * 2 for UTF-16 encoding
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Estimate the size of a Map in bytes (rough approximation)
   * @internal
   */
  private estimateMapSize(map: Map<any, any>): number {
    try {
      let size = 0;
      
      // For empty maps
      if (map.size === 0) return 0;
      
      // For large maps, sample a subset
      if (map.size > 100) {
        const sampleSize = 10;
        let count = 0;
        let sampleSize = 0;
        
        // Sample the first 10 entries
        for (const [key, value] of map.entries()) {
          if (count >= sampleSize) break;
          
          const keySize = (String(key).length * 2); // Key size (UTF-16)
          const valueSize = this.estimateObjectSize(value); // Value size
          
          sampleSize += keySize + valueSize;
          count++;
        }
        
        // Extrapolate to full map
        return Math.round(sampleSize * (map.size / sampleSize));
      }
      
      // For smaller maps, process all entries
      for (const [key, value] of map.entries()) {
        size += (String(key).length * 2); // Key size (UTF-16)
        size += this.estimateObjectSize(value); // Value size
      }
      
      return size;
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Estimate CPU usage (if available)
   * @internal
   */
  private estimateCpuUsage(): any {
    try {
      // This is only available in some environments
      if (typeof performance !== 'undefined' && 'now' in performance) {
        const start = performance.now();
        
        // Do a simple computation to measure CPU time
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += Math.sqrt(i);
        }
        
        const end = performance.now();
        
        return {
          benchmarkTime: end - start,
          benchmarkUnit: 'ms'
        };
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Estimate memory usage (if available)
   * @internal
   */
  private estimateMemoryUsage(): any {
    try {
      // Check if performance.memory is available (Chrome only)
      if (typeof window !== 'undefined' && 
          'performance' in window && 
          'memory' in (window.performance as any)) {
          
        const memoryInfo = (window.performance as any).memory;
        
        return {
          usedJSHeapSize: this.formatBytes(memoryInfo.usedJSHeapSize),
          totalJSHeapSize: this.formatBytes(memoryInfo.totalJSHeapSize),
          jsHeapSizeLimit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
        };
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Update metrics with a completed call
   */
  private updateCallMetrics(
    call: ApiCallData, 
    status: number, 
    responseTime: number, 
    requestSize: number, 
    responseSize: number,
    error: boolean = false
  ): void {
    if (!this.metricsEnabled) return;
    
    // Record call duration
    this.metricsData.callDurations.push(responseTime);
    
    // Record error/success
    if (error || (status >= 400)) {
      this.metricsData.errorCount++;
    } else if (status >= 200 && status < 400) {
      this.metricsData.successCount++;
    }
    
    // Record sizes
    this.metricsData.requestSizes.push(requestSize);
    this.metricsData.responseSizes.push(responseSize);
    
    // Endpoint-specific metrics
    try {
      // Extract endpoint pattern from URL
      const endpoint = this.getEndpointPattern(call.url);
      
      // Get or create endpoint stats
      if (!this.metricsData.endpointStats.has(endpoint)) {
        this.metricsData.endpointStats.set(endpoint, {
          durations: [],
          errors: 0,
          successes: 0,
          bytes: 0
        });
      }
      
      const endpointStats = this.metricsData.endpointStats.get(endpoint)!;
      
      // Update endpoint metrics
      endpointStats.durations.push(responseTime);
      endpointStats.bytes += (requestSize + responseSize);
      
      if (error || (status >= 400)) {
        endpointStats.errors++;
      } else if (status >= 200 && status < 400) {
        endpointStats.successes++;
      }
    } catch (e) {
      // Ignore endpoint metric errors
    }
  }
  
  /**
   * Extract a generalized endpoint pattern from a URL
   */
  private getEndpointPattern(url: string): string {
    try {
      const urlObj = this.createUrl(url);
      const path = urlObj.pathname;
      
      // Try to identify ID patterns in URL paths
      return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
        .replace(/\/[0-9a-f]{24}/gi, '/:objectId')
        .replace(/\/\d+/g, '/:id');
    } catch (e) {
      return url;
    }
  }
  
  /**
   * Reset metrics data
   */
  private resetMetrics(): void {
    this.metricsData = {
      callDurations: [],
      errorCount: 0,
      successCount: 0,
      requestSizes: [],
      responseSizes: [],
      endpointStats: new Map(),
      startTime: Date.now()
    };
  }
  
  /**
   * Get performance metrics for API calls
   */
  getPerformanceMetrics(timeframe?: number): PerformanceMetrics {
    if (!this.metricsEnabled) {
      return {
        avgCallDuration: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        successRate: 0,
        sampleSize: 0,
        timeframe: 0,
        totalBytesTransferred: 0,
        avgRequestSize: 0,
        avgResponseSize: 0,
        endpointMetrics: {}
      };
    }
    
    // Filter by timeframe if provided
    let durations = [...this.metricsData.callDurations];
    let errorCount = this.metricsData.errorCount;
    let successCount = this.metricsData.successCount;
    let requestSizes = [...this.metricsData.requestSizes];
    let responseSizes = [...this.metricsData.responseSizes];
    
    if (timeframe) {
      const timeThreshold = Date.now() - timeframe;
      
      // We don't store timestamps with each metric point for performance reasons
      // So we can only approximate timeframe filtering if metrics were reset
      if (this.metricsData.startTime > timeThreshold) {
        // All metrics are within timeframe, no filtering needed
      } else {
        // We can't filter by time, so we'll use the full dataset
        // but note that it includes data outside the requested timeframe
      }
    }
    
    // Calculate average call duration
    const avgCallDuration = durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;
    
    // Calculate percentiles
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);
    
    const p95ResponseTime = sortedDurations.length > 0 
      ? sortedDurations[Math.min(p95Index, sortedDurations.length - 1)]
      : 0;
      
    const p99ResponseTime = sortedDurations.length > 0 
      ? sortedDurations[Math.min(p99Index, sortedDurations.length - 1)]
      : 0;
    
    // Calculate error and success rates
    const totalCalls = errorCount + successCount;
    const errorRate = totalCalls > 0 ? errorCount / totalCalls : 0;
    const successRate = totalCalls > 0 ? successCount / totalCalls : 0;
    
    // Calculate size metrics
    const totalRequestBytes = requestSizes.reduce((sum, size) => sum + size, 0);
    const totalResponseBytes = responseSizes.reduce((sum, size) => sum + size, 0);
    const totalBytes = totalRequestBytes + totalResponseBytes;
    
    const avgRequestSize = requestSizes.length > 0
      ? totalRequestBytes / requestSizes.length
      : 0;
      
    const avgResponseSize = responseSizes.length > 0 
      ? totalResponseBytes / responseSizes.length
      : 0;
    
    // Calculate endpoint-specific metrics
    const endpointMetrics: Record<string, {
      callCount: number;
      avgDuration: number;
      errorRate: number;
      totalBytes: number;
    }> = {};
    
    for (const [endpoint, stats] of this.metricsData.endpointStats.entries()) {
      const endpointTotalCalls = stats.errors + stats.successes;
      const endpointErrorRate = endpointTotalCalls > 0 
        ? stats.errors / endpointTotalCalls 
        : 0;
        
      const endpointAvgDuration = stats.durations.length > 0
        ? stats.durations.reduce((sum, duration) => sum + duration, 0) / stats.durations.length
        : 0;
      
      endpointMetrics[endpoint] = {
        callCount: endpointTotalCalls,
        avgDuration: endpointAvgDuration,
        errorRate: endpointErrorRate,
        totalBytes: stats.bytes
      };
    }
    
    return {
      avgCallDuration,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      successRate,
      sampleSize: totalCalls,
      timeframe: timeframe || (Date.now() - this.metricsData.startTime),
      totalBytesTransferred: totalBytes,
      avgRequestSize,
      avgResponseSize,
      endpointMetrics
    };
  }
  
  /**
   * Set up WebSocket monitoring
   */
  private setupWebSocketMonitoring(): void {
    if (this.monkeyPatchedWebSocket) return;
    
    try {
      // Only available in browser environments
      if (typeof window === 'undefined' || !window.WebSocket) {
        return;
      }
      
      // Store the original WebSocket constructor
      const OriginalWebSocket = window.WebSocket;
      
      // Create a patched version
      const tracer = this;
      window.WebSocket = function(url: string, protocols?: string | string[]) {
        // Create the actual WebSocket
        const webSocket = new OriginalWebSocket(url, protocols);
        
        // Generate a unique ID for this connection
        const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Track the connection
        tracer.webSocketConnections.set(connectionId, webSocket);
        
        // Get current action context
        const currentAction = tracer.getCurrentAction();
        const originComponent = currentAction?.component;
        const originAction = currentAction?.name;
        const originActionId = currentAction?.id;
        
        // Log connection
        tracer.log(
          Tab.Network,
          `WebSocket connection opened: ${url}`,
          {
            connectionId,
            url,
            protocols,
            originComponent,
            originAction
          },
          Severity.Info
        );
        
        // Track messages
        const originalSend = webSocket.send;
        webSocket.send = function(data: any) {
          // Call the original function
          const result = originalSend.apply(this, [data]);
          
          // Track the message
          try {
            let size = 0;
            let parsedData = data;
            
            // Try to determine message size and parse if it's a string
            if (typeof data === 'string') {
              size = data.length;
              try {
                // Try to parse as JSON
                parsedData = JSON.parse(data);
              } catch (e) {
                // Not JSON, use as is
              }
            } else if (data instanceof ArrayBuffer) {
              size = data.byteLength;
            } else if (data instanceof Blob) {
              size = data.size;
            }
            
            // Create message record
            const message: WebSocketMessageData = {
              id: `wsmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              timestamp: Date.now(),
              direction: 'sent',
              connectionId,
              url,
              data: parsedData,
              size,
              originComponent,
              originAction,
              originActionId
            };
            
            // Store message
            tracer.webSocketMessages.push(message);
            
            // Trim if needed
            if (tracer.webSocketMessages.length > tracer.maxCalls) {
              tracer.webSocketMessages.splice(0, Math.floor(tracer.maxCalls * 0.2));
            }
            
            // Log message
            tracer.log(
              Tab.Network,
              `WebSocket message sent`,
              {
                connectionId,
                messageId: message.id,
                size,
                data: tracer.maskSensitiveData(parsedData)
              },
              Severity.Debug
            );
          } catch (e) {
            tracer.debugLog('Error tracking WebSocket send', { error: e });
          }
          
          return result;
        };
        
        // Track received messages
        webSocket.addEventListener('message', function(event) {
          try {
            let size = 0;
            let parsedData = event.data;
            
            // Try to determine message size and parse if it's a string
            if (typeof event.data === 'string') {
              size = event.data.length;
              try {
                // Try to parse as JSON
                parsedData = JSON.parse(event.data);
              } catch (e) {
                // Not JSON, use as is
              }
            } else if (event.data instanceof ArrayBuffer) {
              size = event.data.byteLength;
            } else if (event.data instanceof Blob) {
              size = event.data.size;
            }
            
            // Create message record
            const message: WebSocketMessageData = {
              id: `wsmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              timestamp: Date.now(),
              direction: 'received',
              connectionId,
              url,
              data: parsedData,
              size,
              originComponent,
              originAction,
              originActionId
            };
            
            // Store message
            tracer.webSocketMessages.push(message);
            
            // Trim if needed
            if (tracer.webSocketMessages.length > tracer.maxCalls) {
              tracer.webSocketMessages.splice(0, Math.floor(tracer.maxCalls * 0.2));
            }
            
            // Log message
            tracer.log(
              Tab.Network,
              `WebSocket message received`,
              {
                connectionId,
                messageId: message.id,
                size,
                data: tracer.maskSensitiveData(parsedData)
              },
              Severity.Debug
            );
          } catch (e) {
            tracer.debugLog('Error tracking WebSocket message', { error: e });
          }
        });
        
        // Track connection close
        webSocket.addEventListener('close', function(event) {
          // Remove from active connections
          tracer.webSocketConnections.delete(connectionId);
          
          // Log close
          tracer.log(
            Tab.Network,
            `WebSocket connection closed: ${url}`,
            {
              connectionId,
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            },
            Severity.Info
          );
        });
        
        // Track connection errors
        webSocket.addEventListener('error', function(event) {
          tracer.log(
            Tab.Network,
            `WebSocket connection error: ${url}`,
            {
              connectionId,
              error: event
            },
            Severity.Error
          );
        });
        
        return webSocket;
      } as any;
      
      // Copy over static properties
      window.WebSocket.prototype = OriginalWebSocket.prototype;
      window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
      window.WebSocket.OPEN = OriginalWebSocket.OPEN;
      window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
      window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
      
      this.monkeyPatchedWebSocket = true;
      
      this.debugLog('WebSocket monitoring set up', {});
    } catch (e) {
      this.debugLog('Error setting up WebSocket monitoring', { error: e });
    }
  }
  
  /**
   * Clean up WebSocket patches
   */
  private cleanupWebSocketPatches(): void {
    if (!this.monkeyPatchedWebSocket) return;
    
    try {
      // Only relevant in browser environments
      if (typeof window === 'undefined' || !window.WebSocket) {
        return;
      }
      
      // Restore the original WebSocket if it was modified
      // Note: This requires the original WebSocket to be stored elsewhere and is not
      // always possible due to JavaScript engine limitations
      
      this.webSocketConnections.clear();
      this.monkeyPatchedWebSocket = false;
      
      this.debugLog('WebSocket monitoring cleaned up', {});
    } catch (e) {
      this.debugLog('Error cleaning up WebSocket monitoring', { error: e });
    }
  }
  
  /**
   * Get WebSocket messages
   */
  getWebSocketMessages(options: {
    connectionId?: string;
    direction?: 'sent' | 'received';
    timeRange?: { start: number; end: number };
    limit?: number;
    offset?: number;
  } = {}): WebSocketMessageData[] {
    let filtered = [...this.webSocketMessages];
    
    if (options.connectionId) {
      filtered = filtered.filter(msg => msg.connectionId === options.connectionId);
    }
    
    if (options.direction) {
      filtered = filtered.filter(msg => msg.direction === options.direction);
    }
    
    if (options.timeRange) {
      filtered = filtered.filter(
        msg => msg.timestamp >= options.timeRange!.start && msg.timestamp <= options.timeRange!.end
      );
    }
    
    // Apply pagination if specified
    if (options.offset !== undefined && options.offset > 0) {
      filtered = filtered.slice(options.offset);
    }
    
    if (options.limit !== undefined && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }
  
  /**
   * Get active WebSocket connections
   */
  getActiveWebSocketConnections(): string[] {
    return Array.from(this.webSocketConnections.keys());
  }
  
  /**
   * Create OpenTelemetry span for API call
   * @internal
   */
  private createOpenTelemetrySpan(
    url: string, 
    method: string,
    options: any,
    traceId: string
  ): void {
    // This is a placeholder for OpenTelemetry integration
    // In a real implementation, this would create a span using the OpenTelemetry SDK
    if (!this.openTelemetry) return;
    
    try {
      // Basic OTel tracing integration with comments for how it would be implemented
      
      /*
      // Example implementation with OpenTelemetry
      const tracer = this.openTelemetry.tracerProvider.getTracer('api-tracer');
      
      // Create a span
      const span = tracer.startSpan(`HTTP ${method}`, {
        attributes: {
          'http.url': url,
          'http.method': method,
          'http.target': this.getPathFromUrl(url),
          'component': options.component,
          'action': this.getCurrentAction()?.name
        }
      });
      
      // Add the span context to the headers for distributed tracing
      const { traceId, spanId, traceFlags } = span.spanContext();
      
      // Update headers with OTel trace context
      if (options.requestHeaders) {
        options.requestHeaders = {
          ...options.requestHeaders,
          'traceparent': `00-${traceId}-${spanId}-${traceFlags}`,
        };
      }
      
      // Store the span for later completion
      this.activeSpans.set(traceId, span);
      */
      
      this.debugLog('OpenTelemetry span created (placeholder)', {
        url,
        method,
        traceId
      });
    } catch (e) {
      this.debugLog('Error creating OpenTelemetry span', { error: e });
    }
  }
  
  /**
   * Complete OpenTelemetry span for API call
   * @internal
   */
  private completeOpenTelemetrySpan(
    call: ApiCallData,
    options: any
  ): void {
    // This is a placeholder for OpenTelemetry integration
    if (!this.openTelemetry) return;
    
    try {
      // Basic OTel span completion with comments for how it would be implemented
      
      /*
      const span = this.activeSpans.get(call.traceId);
      if (!span) return;
      
      // Add response attributes
      span.setAttribute('http.status_code', options.status || 0);
      span.setAttribute('http.response_content_length', options.responseBodySize || 0);
      
      // Record error if applicable
      if (options.error || (options.status && options.status >= 400)) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: options.error ? String(options.error) : `HTTP Error ${options.status}`
        });
        
        if (options.error) {
          span.recordException(options.error);
        }
      }
      
      // End the span
      span.end();
      
      // Remove from active spans
      this.activeSpans.delete(call.traceId);
      */
      
      this.debugLog('OpenTelemetry span completed (placeholder)', {
        traceId: call.traceId,
        status: options.status,
        error: options.error ? true : false
      });
    } catch (e) {
      this.debugLog('Error completing OpenTelemetry span', { error: e });
    }
  }
}

// React import and helper functions
import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * HOC to wrap React event handlers with debug context
 */
export function withDebugContext<T extends Function>(
  handler: T, 
  actionName: string, 
  componentName?: string
): T {
  const apiTracer = ApiTracer.getInstance();
  
  const wrappedHandler = function(this: any, ...args: any[]) {
    // Start action tracking
    const actionId = apiTracer.startAction(actionName, componentName);
    
    try {
      // Call the original handler
      const result = handler.apply(this, args);
      
      // If the result is a Promise, handle async completion
      if (result instanceof Promise) {
        return result.finally(() => {
          apiTracer.endAction(actionId);
        });
      }
      
      // For synchronous handlers, end the action immediately
      apiTracer.endAction(actionId);
      return result;
    } catch (error) {
      // End action on error
      apiTracer.endAction(actionId);
      throw error;
    }
  };
  
  return wrappedHandler as unknown as T;
}

/**
 * React hook for component lifecycle debugging
 */
export function useDebugLifecycle(componentName: string): void {
  const apiTracer = ApiTracer.getInstance();
  const logger = DebugLogger.getInstance();
  const actionIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Start component mount action
    actionIdRef.current = apiTracer.startAction(`Component Mount`, componentName);
    
    // Log component mount
    logger.log(
      Tab.Events,
      `Component mounted: ${componentName}`,
      { timestamp: Date.now() },
      Severity.Debug
    );
    
    // Return cleanup function
    return () => {
      // End the mount action if still active
      if (actionIdRef.current) {
        apiTracer.endAction(actionIdRef.current);
        actionIdRef.current = null;
      }
      
      logger.log(
        Tab.Events,
        `Component unmounted: ${componentName}`,
        { timestamp: Date.now() },
        Severity.Debug
      );
    };
  }, [componentName]);
}

/**
 * Enhanced fetch wrapper with debug tracing
 */
export async function debugFetch(
  url: string, 
  options: RequestInit & {
    component?: string;
    parentCallId?: string;
    userId?: string;
    environment?: string;
  } = {}
): Promise<Response> {
  const apiTracer = ApiTracer.getInstance();
  const method = options.method || 'GET';
  
  // Extract custom options
  const { component, parentCallId, userId, environment, ...fetchOptions } = options;
  
  // Parse request body
  let requestBody;
  let requestBodySize = 0;
  
  if (fetchOptions.body) {
    if (typeof fetchOptions.body === 'string') {
      requestBodySize = fetchOptions.body.length;
      try {
        requestBody = JSON.parse(fetchOptions.body);
      } catch (e) {
        requestBody = fetchOptions.body;
      }
    } else {
      requestBody = fetchOptions.body;
      try {
        requestBodySize = JSON.stringify(fetchOptions.body).length;
      } catch (e) {
        // Unable to determine size
      }
    }
  }
  
  // Extract headers
  const requestHeaders: Record<string, string> = {};
  if (fetchOptions.headers) {
    if (fetchOptions.headers instanceof Headers) {
      fetchOptions.headers.forEach((value, key) => {
        requestHeaders[key] = value;
      });
    } else if (Array.isArray(fetchOptions.headers)) {
      fetchOptions.headers.forEach(([key, value]) => {
        requestHeaders[key] = value;
      });
    } else {
      Object.assign(requestHeaders, fetchOptions.headers as Record<string, string>);
    }
  }
  
  // Create retry helper for this call
  const retryHelper = () => {
    return fetch(url, fetchOptions);
  };
  
  // Start tracking the API call
  const callId = apiTracer.trackApiCall(url, method, {
    component,
    parentCallId,
    requestHeaders,
    requestBody,
    retryHelper,
    userId,
    environment
  });
  
  const startTime = Date.now();
  
  try {
    // Make the actual fetch request
    const response = await fetch(url, fetchOptions);
    
    const responseTime = Date.now() - startTime;
    
    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // Clone response to read the body
    const clonedResponse = response.clone();
    
    // Determine content type
    const contentType = response.headers.get('content-type');
    
    // Parse response body based on content type
    let responseBody;
    let responseBodySize = 0;
    
    try {
      if (contentType?.includes('application/json')) {
        responseBody = await clonedResponse.json();
        responseBodySize = JSON.stringify(responseBody).length;
      } else if (contentType?.includes('text/')) {
        const text = await clonedResponse.text();
        responseBody = text;
        responseBodySize = text.length;
      } else {
        responseBody = {
          _type: contentType,
          _size: +(response.headers.get('content-length') || '0')
        };
        responseBodySize = +(response.headers.get('content-length') || '0');
      }
    } catch (e) {
      responseBody = { _error: 'Could not parse response body' };
    }
    
    // Complete the API call tracking
    apiTracer.completeApiCall(callId, {
      status: response.status,
      statusText: response.statusText,
      responseHeaders,
      responseBody,
      responseTime
    });
    
    return response;
  } catch (error) {
    // Mark the API call as failed
    apiTracer.failApiCall(callId, error);
    throw error;
  }
}

/**
 * Enhanced fetch wrapper with abort controller support
 */
export function useDebugFetch() {
  const [abortControllers, setAbortControllers] = useState<Record<string, AbortController>>({});
  
  // Clean up abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllers).forEach(controller => {
        try {
          controller.abort();
        } catch (e) {
          // Ignore abort errors
        }
      });
    };
  }, [abortControllers]);
  
  const fetch = useCallback(async (
    url: string,
    options: RequestInit & {
      component?: string;
      parentCallId?: string;
      userId?: string;
      environment?: string;
      requestId?: string;
      abortPrevious?: boolean;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<Response> => {
    const { requestId, abortPrevious, priority, ...fetchOptions } = options;
    
    // Generate a unique request ID if not provided
    const id = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Abort previous request with the same ID if requested
    if (abortPrevious && abortControllers[id]) {
      try {
        abortControllers[id].abort();
      } catch (e) {
        // Ignore abort errors
      }
    }
    
    // Create a new abort controller
    const controller = new AbortController();
    
    // Store the controller
    setAbortControllers(prev => ({
      ...prev,
      [id]: controller
    }));
    
    try {
      // Set fetch priority if supported
      const signal = controller.signal as any;
      if (priority && 'priority' in signal) {
        signal.priority = priority;
      }
      
      // Add the signal to the fetch options
      const response = await debugFetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      
      // Clean up the controller after successful completion
      setAbortControllers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      
      return response;
    } catch (error) {
      // Clean up the controller on error too
      setAbortControllers(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      
      throw error;
    }
  }, [abortControllers]);
  
  const abort = useCallback((requestId: string) => {
    if (abortControllers[requestId]) {
      try {
        abortControllers[requestId].abort();
        
        // Clean up the controller
        setAbortControllers(prev => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
      } catch (e) {
        // Ignore abort errors
      }
    }
  }, [abortControllers]);
  
  const abortAll = useCallback(() => {
    Object.values(abortControllers).forEach(controller => {
      try {
        controller.abort();
      } catch (e) {
        // Ignore abort errors
      }
    });
    
    // Clean up all controllers
    setAbortControllers({});
  }, [abortControllers]);
  
  return { fetch, abort, abortAll, activeRequests: Object.keys(abortControllers) };
}

/**
 * Hook for debugged data fetching with state tracking
 */
export function useDebugDataFetch<T = any>(options: {
  component: string;
  state?: T;
  enableStateTracking?: boolean;
}) {
  const stateRef = useRef(options.state);
  const prevStateRef = useRef<T | undefined>();
  const { fetch, abort, abortAll, activeRequests } = useDebugFetch();
  const apiTracer = ApiTracer.getInstance();
  
  // Update the ref when state changes
  useEffect(() => {
    // Track state changes if enabled
    if (options.enableStateTracking && prevStateRef.current !== undefined) {
      apiTracer.trackStateChange(
        `${options.component} state update`,
        prevStateRef.current,
        options.state
      );
    }
    
    prevStateRef.current = stateRef.current;
    stateRef.current = options.state;
  }, [options.state, options.component, options.enableStateTracking, apiTracer]);
  
  return {
    fetch: useCallback((url: string, fetchOptions: RequestInit & {
      requestId?: string;
      abortPrevious?: boolean;
      priority?: 'high' | 'normal' | 'low';
    } = {}) => {
      return fetch(url, {
        ...fetchOptions,
        component: options.component
      });
    }, [fetch, options.component]),
    abort,
    abortAll,
    activeRequests,
    
    // Add retry functionality
    retry: useCallback((callId: string) => {
      return apiTracer.retryApiCall(callId);
    }, [apiTracer])
  };
}

// Export an enhanced API for axios interceptors
export const createAxiosInterceptors = (axios: any) => {
  const apiTracer = ApiTracer.getInstance();

  // Request interceptor
  const requestInterceptor = axios.interceptors.request.use(
    (config: any) => {
      const url = config.url;
      const method = config.method?.toUpperCase() || 'GET';
      
      // Add request start time
      config._debugRequestStartTime = Date.now();
      
      // Calculate request body size
      let requestBodySize = 0;
      if (config.data) {
        try {
          requestBodySize = JSON.stringify(config.data).length;
        } catch (e) {
          // Unable to determine size
        }
      }
      
      // Create retry helper for this call
      const retryHelper = () => {
        return axios(config);
      };
      
      // Start tracking the API call
      const callId = apiTracer.trackApiCall(url, method, {
        component: config.component,
        parentCallId: config.parentCallId,
        requestHeaders: config.headers,
        requestParams: config.params,
        requestBody: config.data,
        requestBodySize,
        retryHelper,
        userId: config.userId,
        environment: config.environment
      });
      
      // Add callId to the config for the response interceptor
      config._debugCallId = callId;
      
      return config;
    },
    (error: any) => {
      // Request preparation failed
      if (error.config?._debugCallId) {
        apiTracer.failApiCall(error.config._debugCallId, error);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor
  const responseInterceptor = axios.interceptors.response.use(
    (response: any) => {
      const callId = response.config._debugCallId;
      if (!callId) return response;
      
      // Calculate response size
      let responseBodySize = 0;
      if (response.data) {
        try {
          responseBodySize = JSON.stringify(response.data).length;
        } catch (e) {
          // Use content-length header as fallback
          responseBodySize = +(response.headers['content-length'] || 0);
        }
      }
      
      // Complete the API call tracking
      apiTracer.completeApiCall(callId, {
        status: response.status,
        statusText: response.statusText,
        responseHeaders: response.headers,
        responseBody: response.data,
        responseTime: Date.now() - (response.config._debugRequestStartTime || 0)
      });
      
      return response;
    },
    (error: any) => {
      const callId = error.config?._debugCallId;
      if (!callId) return Promise.reject(error);
      
      // Handle Axios error response
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        let responseBodySize = 0;
        if (error.response.data) {
          try {
            responseBodySize = JSON.stringify(error.response.data).length;
          } catch (e) {
            // Unable to determine size
          }
        }
        
        apiTracer.completeApiCall(callId, {
          status: error.response.status,
          statusText: error.response.statusText,
          responseHeaders: error.response.headers,
          responseBody: error.response.data,
          responseTime: Date.now() - (error.config?._debugRequestStartTime || 0)
        });
      } else if (error.request) {
        // The request was made but no response was received
        apiTracer.failApiCall(callId, {
          message: 'No response received',
          request: error.request
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        apiTracer.failApiCall(callId, error);
      }
      
      return Promise.reject(error);
    }
  );

  return {
    remove: () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    }
  };
};

/**
 * A higher-order component (HOC) that adds API tracing to a React component
 */
export function withApiTracing<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    componentName?: string;
    traceLifecycle?: boolean;
    enableStateTracking?: boolean;
  } = {}
) {
  const componentName = options.componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const WithApiTracing: React.FC<P> = (props) => {
    // Use debug lifecycle if requested
    if (options.traceLifecycle) {
      useDebugLifecycle(componentName);
    }
    
    // State tracking
    const [state, setState] = useState<any>({});
    const prevStateRef = useRef<any>({});
    const apiTracer = ApiTracer.getInstance();
    
    // Track state changes if enabled
    useEffect(() => {
      if (options.enableStateTracking && Object.keys(prevStateRef.current).length > 0) {
        apiTracer.trackStateChange(
          `${componentName} state update`,
          prevStateRef.current,
          state
        );
      }
      
      prevStateRef.current = { ...state };
    }, [state, componentName, apiTracer]);
    
    // Enhanced setState that tracks changes
    const trackedSetState = useCallback((newState: any) => {
      setState(prev => {
        const updatedState = typeof newState === 'function' 
          ? newState(prev) 
          : newState;
        
        return updatedState;
      });
    }, []);
    
    // Provide access to the ApiTracer instance and helpers
    const debugFetchInstance = useDebugFetch();
    
    return (
      <WrappedComponent
        {...props as any}
        apiTracer={apiTracer}
        debugFetch={debugFetchInstance.fetch}
        abortRequest={debugFetchInstance.abort}
        abortAllRequests={debugFetchInstance.abortAll}
        trackedState={state}
        setTrackedState={trackedSetState}
        retryApiCall={(callId: string) => apiTracer.retryApiCall(callId)}
        getApiCalls={(options: any) => apiTracer.getApiCalls(options)}
        getPerformanceMetrics={(timeframe?: number) => apiTracer.getPerformanceMetrics(timeframe)}
      />
    );
  };
  
  WithApiTracing.displayName = `WithApiTracing(${componentName})`;
  
  return WithApiTracing;
}
            import { Tab, Severity, ApiCallData, ActionContext } from './debugTypes';
import { DebugLogger } from './DebugLogger';

/**
 * Interface for logger implementation
 * This allows us to make the logger pluggable
 */
export interface Logger {
  log: (tab: Tab | string, message: string, data?: any, severity?: Severity | string) => string;
  addFix?: (issue: string, description: string, suggestion: string, fixFunction?: any, severity?: Severity | string) => string;
}

/**
 * Configuration options for the API tracer
 */
export interface ApiTracerConfig {
  /** Sampling rate (0-1) for determining which calls to trace */
  sampleRate?: number;
  /** Maximum number of calls to keep in memory */
  maxCalls?: number;
  /** Maximum number of in-flight requests to track */
  maxInFlightRequests?: number;
  /** Maximum correlation ID counter value before resetting */
  maxCorrelationIdCounter?: number;
  /** Maximum number of actions to keep in memory per stack */
  maxActionsPerStack?: number;
  /** Maximum size of action stack before pruning oldest entries */
  maxActionStackSize?: number;
  /** Patterns for sensitive data that should be masked */
  sensitivePatterns?: Array<string | RegExp>;
  /** Custom logger implementation */
  logger?: Logger;
  /** Enable verbose debug logging */
  debug?: boolean;
  /** Enable batch logging */
  batchLogging?: boolean;
  /** Batch flush interval in ms (if batch logging is enabled) */
  batchFlushInterval?: number;
  /** Maximum number of batch logs before forcing a flush */
  maxBatchSize?: number;
  /** Custom scheduler implementation for batch flushing */
  scheduler?: {
    setInterval: (callback: () => void, ms: number) => any;
    clearInterval: (id: any) => void;
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  /** Maximum recursion depth for maskSensitiveData */
  maxMaskingDepth?: number;
  /** Maximum number of keys to process in large objects during masking */
  maxKeysToMask?: number;
  /** Enable state diff throttling to improve performance */
  throttleStateDiffs?: boolean;
  /** Configure response body size limits (bytes) for HAR export */
  harBodySizeLimit?: number;
  /** Custom sampling strategy function */
  samplingStrategy?: (call: Partial<ApiCallData>) => boolean;
  /** Server location information for SSR environments */
  serverLocation?: {
    pathname: string;
    host: string;
    protocol: string;
  };
  /** Integration with OpenTelemetry */
  openTelemetry?: {
    enabled: boolean;
    tracerProvider?: any; // OpenTelemetry TracerProvider
    resource?: any; // OpenTelemetry Resource
  };
  /** Memory thresholds for automatic garbage collection triggers */
  memoryThresholds?: {
    warn: number; // Heap size in bytes to trigger warning
    critical: number; // Heap size in bytes to trigger aggressive pruning
  };
  /** W3C Trace Context header support */
  w3cTraceContext?: boolean;
  /** Enable runtime call metrics collection */
  collectMetrics?: boolean;
  /** Enable compression for large request/response bodies */
  compressLargeBodies?: boolean;
  /** Threshold in bytes for body compression */
  compressionThreshold?: number;
  /** Storage mechanism for persistence between sessions */
  storage?: {
    type: 'localStorage' | 'sessionStorage' | 'custom';
    customStore?: {
      setItem: (key: string, value: string) => void;
      getItem: (key: string) => string | null;
      removeItem: (key: string) => void;
    };
    /** Auto-save session data for later recovery */
    autoSave?: boolean;
    /** Save interval in ms */
    saveInterval?: number;
  };
  /** WebSocket monitoring support */
  webSocketSupport?: boolean;
}

/**
 * Performance metrics for API calls
 */
export interface PerformanceMetrics {
  /** Average call duration in ms */
  avgCallDuration: number;
  /** P95 response time in ms */
  p95ResponseTime: number;
  /** P99 response time in ms */
  p99ResponseTime: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Number of calls in the sample */
  sampleSize: number;
  /** Timeframe of the metrics in ms */
  timeframe: number;
  /** Total bytes transferred (request + response) */
  totalBytesTransferred: number;
  /** Average bytes per request */
  avgRequestSize: number;
  /** Average bytes per response */
  avgResponseSize: number;
  /** Breakdown by endpoint */
  endpointMetrics: Record<string, {
    callCount: number;
    avgDuration: number;
    errorRate: number;
    totalBytes: number;
  }>;
}

/**
 * WebSocket message data for monitoring
 */
interface WebSocketMessageData {
  id: string;
  timestamp: number;
  direction: 'sent' | 'received';
  connectionId: string;
  url: string;
  data: any;
  size: number;
  originComponent?: string;
  originAction?: string;
  originActionId?: string;
}

/**
 * Log entry for batch processing with strongly-typed data
 */
interface BatchLogEntry {
  tab: Tab | string;
  message: string;
  data: Record<string, any>; // Strongly-typed for serialization safety
  severity: Severity | string;
  timestamp: number;
  /** Priority level for flushing decision */
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Enhanced API tracing with origin tracking and call chain analysis
 */
export class ApiTracer {
  private static instance: ApiTracer | null = null;
  
  // Core state
  private calls: ApiCallData[] = [];
  private actionStack: ActionContext[] = [];
  private actionStacks: Map<string, ApiCallData[]> = new Map();
  private inFlightRequests: Map<string, ApiCallData> = new Map();
  private correlationIdCounter: number = 0;
  private currentRoute: string | undefined;
  
  // WebSocket monitoring
  private webSocketMessages: WebSocketMessageData[] = [];
  private webSocketConnections: Map<string, WebSocket> = new Map();
  private monkeyPatchedWebSocket: boolean = false;
  
  // Metrics collection
  private metricsEnabled: boolean = false;
  private metricsData: {
    callDurations: number[];
    errorCount: number;
    successCount: number;
    requestSizes: number[];
    responseSizes: number[];
    endpointStats: Map<string, {
      durations: number[];
      errors: number;
      successes: number;
      bytes: number;
    }>;
    startTime: number;
  } = {
    callDurations: [],
    errorCount: 0,
    successCount: 0,
    requestSizes: [],
    responseSizes: [],
    endpointStats: new Map(),
    startTime: Date.now()
  };
  
  // Batch logging
  private batchedLogs: BatchLogEntry[] = [];
  private batchIntervalId: any = null;
  private idleCallbackId: number | null = null;
  
  // Storage and persistence
  private storage: ApiTracerConfig['storage'] | null = null;
  private storageIntervalId: any = null;
  
  // OpenTelemetry integration
  private openTelemetry: ApiTracerConfig['openTelemetry'] | null = null;
  private useW3CTraceContext: boolean = false;
  
  // Compression support
  private compressionEnabled: boolean = false;
  private compressionThreshold: number = 1024 * 50; // 50KB default
  
  // Configuration
  private enabled: boolean = true;
  private maxCalls: number;
  private maxInFlightRequests: number;
  private maxCorrelationIdCounter: number;
  private maxActionsPerStack: number;
  private maxActionStackSize: number;
  private maxBatchSize: number;
  private sampleRate: number;
  private samplingStrategy: ((call: Partial<ApiCallData>) => boolean) | null = null;
  private sensitivePatterns: Array<string | RegExp>;
  private logger: Logger;
  private debugMode: boolean;
  private batchLogging: boolean;
  private batchFlushInterval: number;
  private scheduler: Required<ApiTracerConfig['scheduler']>;
  private serverLocation: ApiTracerConfig['serverLocation'] | null = null;
  private memoryThresholds: Required<NonNullable<ApiTracerConfig['memoryThresholds']>>;
  private maxMaskingDepth: number;
  private maxKeysToMask: number;
  private throttleStateDiffs: boolean;
  private harBodySizeLimit: number;
  
  /**
   * Get the singleton instance
   */
  static getInstance(config?: ApiTracerConfig): ApiTracer {
    if (!ApiTracer.instance) {
      ApiTracer.instance = new ApiTracer(config);
    } else if (config) {
      // Update configuration on existing instance
      ApiTracer.instance.configure(config);
    }
    return ApiTracer.instance;
  }
  
  /**
   * Reset the singleton for testing
   * @internal
   */
  static resetForTesting(): void {
    if (ApiTracer.instance) {
      // Ensure cleanup of intervals
      ApiTracer.instance.stopBatchFlushInterval();
      ApiTracer.instance.stopStorageInterval();
      
      // Remove WebSocket patches if applied
      ApiTracer.instance.cleanupWebSocketPatches();
      
      ApiTracer.instance = null;
    }
  }
  
  /**
   * Private constructor (use getInstance instead)
   */
  private constructor(config?: ApiTracerConfig) {
    this.maxCalls = config?.maxCalls ?? 1000;
    this.maxInFlightRequests = config?.maxInFlightRequests ?? 100;
    this.maxCorrelationIdCounter = config?.maxCorrelationIdCounter ?? 10000;
    this.maxActionsPerStack = config?.maxActionsPerStack ?? 50;
    this.maxActionStackSize = config?.maxActionStackSize ?? 100;
    this.maxBatchSize = config?.maxBatchSize ?? 100;
    this.sampleRate = config?.sampleRate ?? 1.0;
    this.maxMaskingDepth = config?.maxMaskingDepth ?? 10;
    this.maxKeysToMask = config?.maxKeysToMask ?? 500;
    this.throttleStateDiffs = config?.throttleStateDiffs ?? true;
    this.harBodySizeLimit = config?.harBodySizeLimit ?? 100000;
    this.logger = config?.logger ?? DebugLogger.getInstance();
    this.debugMode = config?.debug ?? false;
    this.batchLogging = config?.batchLogging ?? false;
    this.batchFlushInterval = config?.batchFlushInterval ?? 1000;
    
    // Set up custom sampling strategy
    if (config?.samplingStrategy) {
      this.samplingStrategy = config.samplingStrategy;
    }
    
    // Set up server location for SSR
    if (config?.serverLocation) {
      this.serverLocation = config.serverLocation;
    }
    
    // Memory thresholds
    this.memoryThresholds = {
      warn: config?.memoryThresholds?.warn ?? 150 * 1024 * 1024, // 150MB
      critical: config?.memoryThresholds?.critical ?? 250 * 1024 * 1024 // 250MB
    };
    
    // OpenTelemetry integration
    if (config?.openTelemetry?.enabled) {
      this.openTelemetry = config.openTelemetry;
    }
    
    // W3C Trace Context support
    this.useW3CTraceContext = config?.w3cTraceContext ?? false;
    
    // Metrics collection
    this.metricsEnabled = config?.collectMetrics ?? false;
    
    // Compression support
    this.compressionEnabled = config?.compressLargeBodies ?? false;
    if (config?.compressionThreshold) {
      this.compressionThreshold = config.compressionThreshold;
    }
    
    // Storage configuration
    if (config?.storage) {
      this.storage = config.storage;
      
      if (this.storage.autoSave) {
        this.startStorageInterval();
        this.loadFromStorage();
      }
    }
    
    // Use custom scheduler or default to window/global if available
    this.scheduler = {
      setInterval: config?.scheduler?.setInterval ?? ((callback: () => void, ms: number): any => {
        // Safe cross-environment interval
        if (typeof setInterval !== 'undefined') {
          return setInterval(callback, ms);
        }
        return null;
      }),
      clearInterval: config?.scheduler?.clearInterval ?? ((id: any): void => {
        // Safe cross-environment interval clearing
        if (typeof clearInterval !== 'undefined') {
          clearInterval(id);
        }
      }),
      requestIdleCallback: config?.scheduler?.requestIdleCallback ?? ((callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
        // Use requestIdleCallback if available, fall back to setTimeout
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          return window.requestIdleCallback(callback, options);
        }
        return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 
          options?.timeout ?? 50) as unknown as number;
      }),
      cancelIdleCallback: config?.scheduler?.cancelIdleCallback ?? ((handle: number): void => {
        // Use cancelIdleCallback if available, fall back to clearTimeout
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(handle);
        } else {
          clearTimeout(handle);
        }
      })
    };
    
    // Enhanced sensitive patterns including PII detection
    this.sensitivePatterns = config?.sensitivePatterns ?? [
      // Common auth and API key patterns
      'authorization',
      'cookie',
      'x-api-key',
      'token',
      'password',
      'secret',
      'key',
      'credential',
      'auth',
      
      // Case-insensitive patterns
      /apikey/i,
      /password/i,
      /secret/i,
      
      // Credit card numbers (with or without spaces/dashes)
      /\b(?:\d[ -]*?){13,16}\b/,
      
      // Social security numbers
      /\b\d{3}[ -]?\d{2}[ -]?\d{4}\b/,
      
      // Personal identifiable information
      /ssn/i,
      /social.*security/i,
      /passport/i,
      /driver.*license/i,
      /birth.*date/i,
      /dob/i
    ];
    
    this.debugLog('ApiTracer initialized', { config });
    
    // Start batch logging flush interval if enabled
    if (this.batchLogging) {
      this.startBatchFlushInterval();
    }
    
    // Set up WebSocket monitoring if enabled
    if (config?.webSocketSupport) {
      this.setupWebSocketMonitoring();
    }
  }
  
  /**
   * Update tracer configuration
   */
  configure(config: ApiTracerConfig): void {
    if (config.maxCalls !== undefined) this.maxCalls = config.maxCalls;
    if (config.maxInFlightRequests !== undefined) this.maxInFlightRequests = config.maxInFlightRequests;
    if (config.maxCorrelationIdCounter !== undefined) this.maxCorrelationIdCounter = config.maxCorrelationIdCounter;
    if (config.maxActionsPerStack !== undefined) this.maxActionsPerStack = config.maxActionsPerStack;
    if (config.maxActionStackSize !== undefined) this.maxActionStackSize = config.maxActionStackSize;
    if (config.maxBatchSize !== undefined) this.maxBatchSize = config.maxBatchSize;
    if (config.sampleRate !== undefined) this.sampleRate = config.sampleRate;
    if (config.maxMaskingDepth !== undefined) this.maxMaskingDepth = config.maxMaskingDepth;
    if (config.maxKeysToMask !== undefined) this.maxKeysToMask = config.maxKeysToMask;
    if (config.throttleStateDiffs !== undefined) this.throttleStateDiffs = config.throttleStateDiffs;
    if (config.harBodySizeLimit !== undefined) this.harBodySizeLimit = config.harBodySizeLimit;
    if (config.logger) this.logger = config.logger;
    if (config.debug !== undefined) this.debugMode = config.debug;
    if (config.sensitivePatterns) this.sensitivePatterns = config.sensitivePatterns;
    if (config.scheduler) this.scheduler = { ...this.scheduler, ...config.scheduler };
    if (config.samplingStrategy) this.samplingStrategy = config.samplingStrategy;
    if (config.serverLocation) this.serverLocation = config.serverLocation;
    if (config.w3cTraceContext !== undefined) this.useW3CTraceContext = config.w3cTraceContext;
    if (config.collectMetrics !== undefined) this.metricsEnabled = config.collectMetrics;
    if (config.memoryThresholds) {
      this.memoryThresholds = {
        ...this.memoryThresholds,
        ...config.memoryThresholds
      };
    }
    
    // Update compression settings
    if (config.compressLargeBodies !== undefined) {
      this.compressionEnabled = config.compressLargeBodies;
    }
    if (config.compressionThreshold !== undefined) {
      this.compressionThreshold = config.compressionThreshold;
    }
    
    // Update OpenTelemetry integration
    if (config.openTelemetry?.enabled !== undefined) {
      if (config.openTelemetry.enabled && !this.openTelemetry) {
        // Initialize OpenTelemetry if enabling
        this.openTelemetry = config.openTelemetry;
      } else if (!config.openTelemetry.enabled && this.openTelemetry) {
        // Disable OpenTelemetry if disabling
        this.openTelemetry = null;
      }
    }
    
    // Update storage settings
    if (config.storage) {
      const oldAutoSave = this.storage?.autoSave;
      this.storage = config.storage;
      
      // Start auto-save if newly enabled
      if (!oldAutoSave && this.storage.autoSave) {
        this.startStorageInterval();
        this.loadFromStorage();
      } 
      // Stop auto-save if newly disabled
      else if (oldAutoSave && !this.storage.autoSave) {
        this.stopStorageInterval();
      }
      // Update save interval if still enabled
      else if (this.storage.autoSave && config.storage.saveInterval) {
        this.stopStorageInterval();
        this.startStorageInterval();
      }
    }
    
    // Handle batch logging changes
    const batchLoggingChanged = config.batchLogging !== undefined && config.batchLogging !== this.batchLogging;
    if (batchLoggingChanged) {
      this.batchLogging = config.batchLogging;
      
      // If batch logging was enabled, start the interval
      if (this.batchLogging) {
        this.startBatchFlushInterval();
      } else {
        // If batch logging was disabled, flush pending logs and clear interval
        this.flushBatchedLogs();
        this.stopBatchFlushInterval();
      }
    }
    
    // Update batch flush interval if changed
    if (config.batchFlushInterval !== undefined) {
      this.batchFlushInterval = config.batchFlushInterval;
      
      // Restart the interval with the new timing if batch logging is enabled
      if (this.batchLogging) {
        this.stopBatchFlushInterval();
        this.startBatchFlushInterval();
      }
    }
    
    // Handle WebSocket monitoring
    if (config.webSocketSupport !== undefined) {
      if (config.webSocketSupport && !this.monkeyPatchedWebSocket) {
        this.setupWebSocketMonitoring();
      } else if (!config.webSocketSupport && this.monkeyPatchedWebSocket) {
        this.cleanupWebSocketPatches();
      }
    }
    
    this.debugLog('ApiTracer configuration updated', { config });
  }
  
  /**
   * Enable or disable API tracing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.log(
      Tab.Network,
      `API tracing ${enabled ? 'enabled' : 'disabled'}`,
      {},
      Severity.Info
    );
  }
  
  /**
   * Set the current route
   * This can be called from both client and server
   */
  setCurrentRoute(route: string): void {
    this.currentRoute = route;
    this.debugLog('Current route updated', { route });
  }
  
  /**
   * Get the current route
   */
  getCurrentRoute(): string | undefined {
    // First use manually set route if available
    if (this.currentRoute) {
      return this.currentRoute;
    }
    
    // Try to access from window.location in browser environments
    try {
      if (typeof window !== 'undefined' && window.location && window.location.pathname) {
        return window.location.pathname;
      }
    } catch (e) {
      // Silently fail if unavailable (e.g., in SSR)
      this.debugLog('Error accessing window.location', { error: e });
    }
    
    // Fall back to server location in SSR environments
    if (this.serverLocation) {
      return this.serverLocation.pathname;
    }
    
    return undefined;
  }
  
  /**
   * Start tracking a user action
   */
  startAction(name: string, component?: string, details?: any): string {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const actionContext: ActionContext = {
      id: actionId,
      name,
      timestamp: Date.now(),
      component,
      details
    };
    
    // Prune action stack if it exceeds the maximum size
    if (this.actionStack.length >= this.maxActionStackSize) {
      // Remove oldest 20% to avoid repeated pruning
      const itemsToRemove = Math.max(1, Math.floor(this.maxActionStackSize * 0.2));
      const removedActions = this.actionStack.splice(0, itemsToRemove);
      
      this.log(
        Tab.Events,
        `Action stack pruned ${itemsToRemove} oldest entries to prevent memory growth`,
        { 
          removedActions: removedActions.map(a => ({ id: a.id, name: a.name })),
          newStackDepth: this.actionStack.length
        },
        Severity.Warn
      );
      
      // Also clean up action stacks for removed actions
      removedActions.forEach(action => {
        this.actionStacks.delete(action.id);
      });
    }
    
    // Push to action stack
    this.actionStack.push(actionContext);
    
    // Warn if stack depth is large (but still under the hard limit)
    if (this.actionStack.length > this.maxActionsPerStack) {
      this.log(
        Tab.Events,
        'Warning: Action stack exceeds recommended size, possible action leak',
        { 
          stackDepth: this.actionStack.length,
          recommendedMax: this.maxActionsPerStack,
          hardLimit: this.maxActionStackSize
        },
        Severity.Warn
      );
    }
    
    // Initialize call stack for this action
    this.actionStacks.set(actionId, []);
    
    this.log(
      Tab.Events,
      `User action started: ${name}`,
      { 
        component,
        actionId,
        details,
        stackDepth: this.actionStack.length
      },
      Severity.Debug
    );
    
    return actionId;
  }
  
  /**
   * End a user action by its ID
   * If no ID is provided, ends the most recent action
   */
  endAction(actionId?: string): void {
    if (!this.actionStack.length) {
      this.log(
        Tab.Events,
        'Warning: Attempted to end action but action stack is empty',
        { actionId },
        Severity.Warn
      );
      return;
    }
    
    // If specific actionId provided, try to find and remove it
    if (actionId) {
      const actionIndex = this.actionStack.findIndex(action => action.id === actionId);
      
      if (actionIndex === -1) {
        this.log(
          Tab.Events,
          'Warning: Attempted to end action that does not exist in stack',
          { actionId },
          Severity.Warn
        );
        return;
      }
      
      if (actionIndex !== this.actionStack.length - 1) {
        this.log(
          Tab.Events,
          'Warning: Action stack integrity violation - ending action that is not at top of stack',
          { 
            actionId, 
            actionIndex,
            topActionId: this.actionStack[this.actionStack.length - 1].id,
            stackDepth: this.actionStack.length
          },
          Severity.Warn
        );
        
        // In debug mode, dump the whole stack for analysis
        if (this.debugMode) {
          this.debugLog('Action stack at violation point', {
            stack: [...this.actionStack].map(a => ({ id: a.id, name: a.name }))
          });
        }
        
        // Don't continue with out-of-order actions to maintain stack integrity
        return;
      }
    }
    
    // Pop the action from the stack
    const action = this.actionStack.pop();
    
    if (action) {
      this.log(
        Tab.Events,
        `User action ended: ${action.name}`,
        { 
          actionId: action.id, 
          duration: Date.now() - action.timestamp,
          stackDepth: this.actionStack.length
        },
        Severity.Debug
      );
      
      // Clean up the action's call stack
      this.actionStacks.delete(action.id);
    }
  }
  
  /**
   * Start tracking an API call
   */
  trackApiCall(
    url: string, 
    method: string, 
    options: {
      parentCallId?: string;
      component?: string;
      requestHeaders?: Record<string, string>;
      requestParams?: Record<string, string>;
      requestBody?: any;
      correlationIds?: string[];
      retryHelper?: () => Promise<any>; // Function to retry this call
      userId?: string;
      environment?: string;
    } = {}
  ): string {
    if (!this.enabled) return '';
    
    // Apply custom sampling strategy if defined
    if (this.samplingStrategy) {
      const shouldSample = this.samplingStrategy({
        url,
        method,
        timestamp: Date.now(),
        originComponent: options.component,
        originAction: this.getCurrentAction()?.name,
        requestHeaders: options.requestHeaders,
        requestParams: options.requestParams,
        requestBody: options.requestBody,
        userId: options.userId,
        environment: options.environment
      });
      
      if (!shouldSample) {
        return '';
      }
    } 
    // Otherwise use sample rate
    else if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      return '';
    }
    
    // Check if we're at max correlation ID counter
    if (this.correlationIdCounter >= this.maxCorrelationIdCounter) {
      this.debugLog('Resetting correlation ID counter', 
        { oldValue: this.correlationIdCounter });
      this.correlationIdCounter = 0;
    }
    
    // Generate a unique call ID
    const callId = `api_${Date.now()}_${this.correlationIdCounter++}`;
    
    try {
      // Limit in-flight requests if exceeding max
      if (this.inFlightRequests.size >= this.maxInFlightRequests) {
        // Get the oldest in-flight request to remove
        const oldestKey = Array.from(this.inFlightRequests.keys())[0];
        if (oldestKey) {
          this.inFlightRequests.delete(oldestKey);
          
          this.debugLog('Pruned oldest in-flight request due to limit', 
            { oldestKey, currentSize: this.inFlightRequests.size });
        }
      }
      
      // Determine parent call ID based on the current action
      let parentCallId = options.parentCallId;
      const currentAction = this.getCurrentAction();
      
      if (!parentCallId && currentAction) {
        const actionId = currentAction.id;
        const actionCalls = this.actionStacks.get(actionId) || [];
        
        // If there are calls in this action, use the most recent as parent
        if (actionCalls.length > 0) {
          parentCallId = actionCalls[actionCalls.length - 1].callId;
        }
      }
      
      // Get stack trace for origin tracking (in development only)
      let originStack: string | undefined;
      if (this.debugMode) {
        try {
          throw new Error('Trace API call origin');
        } catch (e) {
          if (e instanceof Error && e.stack) {
            // Parse the stack trace and remove the first line (the error message)
            originStack = e.stack
              .split('\n')
              .slice(1) // Skip the error message line
              .map(line => line.trim())
              .filter(line => !line.includes('ApiTracer.ts')) // Filter out lines from this file
              .slice(0, 5) // Take the first 5 remaining lines
              .join('\n');
          }
        }
      }
      
      // Generate or extract trace ID for distributed tracing
      let traceId: string;
      let traceContext: Record<string, string> = {};
      
      if (this.useW3CTraceContext) {
        // Try to extract W3C trace context from headers
        if (options.requestHeaders && options.requestHeaders['traceparent']) {
          // Use existing W3C trace context
          traceId = options.requestHeaders['traceparent'];
          
          if (options.requestHeaders['tracestate']) {
            traceContext.tracestate = options.requestHeaders['tracestate'];
          }
        } else {
          // Generate new W3C trace context
          // Format: version-trace_id-parent_id-flags
          // Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
          const randHex = (size: number) => Array.from(
            { length: size }, 
            () => Math.floor(Math.random() * 16).toString(16)
          ).join('');
          
          const traceIdHex = randHex(32); // 128-bit trace ID
          const spanIdHex = randHex(16);  // 64-bit span ID
          
          traceId = `00-${traceIdHex}-${spanIdHex}-01`; // version 00, sampled flag 01
          
          // Add to headers if provided
          if (options.requestHeaders) {
            options.requestHeaders = {
              ...options.requestHeaders,
              'traceparent': traceId,
              'tracestate': `${this.getHostname()}=${spanIdHex}`
            };
            
            traceContext = {
              'tracestate': `${this.getHostname()}=${spanIdHex}`,
              'traceparent': traceId
            };
          }
        }
      } else {
        // Use simpler trace ID (non-W3C)
        if (options.requestHeaders && options.requestHeaders['x-trace-id']) {
          // Use existing trace ID if present
          traceId = options.requestHeaders['x-trace-id'];
        } else {
          // Generate new trace ID
          traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // Add to headers if provided
          if (options.requestHeaders) {
            options.requestHeaders = {
              ...options.requestHeaders,
              'x-trace-id': traceId
            };
          }
        }
      }
      
      // OpenTelemetry integration
      if (this.openTelemetry) {
        // Integration would create a span and attach context to headers
        this.createOpenTelemetrySpan(url, method, options, traceId);
      }
      
      // Parse URL for query parameters
      let queryParams: Record<string, string> = {};
      try {
        const urlObj = this.createUrl(url);
        // Convert URLSearchParams to object
        urlObj.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
      } catch (e) {
        // If URL parsing fails (e.g. relative URL), continue without query params
        this.debugLog('Error parsing URL for query parameters', { url, error: e });
      }
      
      // Compress large request body if enabled
      let compressedRequestBody;
      let requestBodySize = 0;
      
      if (this.compressionEnabled && options.requestBody) {
        try {
          const requestBodyStr = typeof options.requestBody === 'string' 
            ? options.requestBody 
            : JSON.stringify(options.requestBody);
          
          requestBodySize = requestBodyStr.length;
          
          if (requestBodySize > this.compressionThreshold) {
            compressedRequestBody = {
              _compressed: true,
              _originalSize: requestBodySize,
              _sample: requestBodyStr.substring(0, 100) + '...',
              _compressedAt: Date.now()
            };
          }
        } catch (e) {
          this.debugLog('Error compressing request body', { error: e });
        }
      }
      
      // Create API call data
      const apiCall: ApiCallData = {
        callId,
        parentCallId,
        timestamp: Date.now(),
        url,
        method,
        traceId,
        traceContext,
        originComponent: options.component || currentAction?.component,
        originAction: currentAction?.name,
        originActionId: currentAction?.id,
        originStack,
        routePath: this.getCurrentRoute(),
        requestHeaders: this.maskSensitiveData(options.requestHeaders || {}),
        requestParams: options.requestParams || queryParams,
        requestBody: compressedRequestBody || this.maskSensitiveData(options.requestBody),
        requestBodySize,
        correlationIds: options.correlationIds || [],
        retryHelper: options.retryHelper,
        userId: options.userId,
        environment: options.environment
      };
      
      // Store the call
      this.calls.push(apiCall);
      
      // Add to in-flight requests
      this.inFlightRequests.set(callId, apiCall);
      
      // Add to current action's call stack if one exists
      if (currentAction) {
        const actionCalls = this.actionStacks.get(currentAction.id) || [];
        actionCalls.push(apiCall);
        this.actionStacks.set(currentAction.id, actionCalls);
      }
      
      // Log the API call start
      this.log(
        Tab.ApiDebug,
        `API call started: ${method} ${this.getPathFromUrl(url)}`,
        { 
          callId,
          url,
          method,
          parentCallId,
          traceId,
          originComponent: apiCall.originComponent,
          originAction: apiCall.originAction,
        },
        Severity.Debug
      );
      
      // Trim calls if needed
      this.performHousekeeping();
      
      return callId;
    } catch (e) {
      // Catch any errors in the tracking logic to avoid breaking the application
      this.log(
        Tab.ApiDebug,
        'Error tracking API call',
        { error: e, url, method },
        Severity.Error
      );
      return callId; // Still return the ID even on error
    }
  }
  
  /**
   * Perform housekeeping to manage memory usage
   */
  private performHousekeeping(): void {
    // Check memory usage if the browser performance API is available
    this.checkMemoryUsage();
    
    // Trim calls if needed
    if (this.calls.length > this.maxCalls) {
      const countToRemove = Math.floor(this.maxCalls * 0.2); // Remove 20% of max calls
      const removed = this.calls.splice(0, countToRemove);
      
      this.debugLog('Pruned old API calls', { 
        removedCount: removed.length, 
        newSize: this.calls.length 
      });
      
      // Remove any action stacks that have been around too long
      // Check timestamp of the oldest call we're keeping
      if (this.calls.length > 0) {
        const oldestTimestamp = this.calls[0].timestamp;
        
        // Cleanup action stacks
        for (const [actionId, calls] of this.actionStacks.entries()) {
          // Remove action stack if it has no active calls or all calls are old
          const hasRecentCalls = calls.some(call => call.timestamp >= oldestTimestamp);
          if (calls.length === 0 || !hasRecentCalls) {
            this.actionStacks.delete(actionId);
          }
        }
      }
    }
    
    // Trim WebSocket messages if needed
    if (this.webSocketMessages.length > this.maxCalls) {
      const wsCountToRemove = Math.floor(this.maxCalls * 0.2);
      this.webSocketMessages.splice(0, wsCountToRemove);
    }
    
    // Trim metrics data if needed
    if (this.metricsEnabled) {
      const maxMetricsSamples = 10000;
      if (this.metricsData.callDurations.length > maxMetricsSamples) {
        const metricsToRemove = this.metricsData.callDurations.length - maxMetricsSamples;
        this.metricsData.callDurations.splice(0, metricsToRemove);
        this.metricsData.requestSizes.splice(0, metricsToRemove);
        this.metricsData.responseSizes.splice(0, metricsToRemove);
      }
      
      // Trim per-endpoint metrics
      for (const [endpoint, stats] of this.metricsData.endpointStats.entries()) {
        if (stats.durations.length > maxMetricsSamples / 10) {
          const endpointMetricsToRemove = stats.durations.length - (maxMetricsSamples / 10);
          stats.durations.splice(0, endpointMetricsToRemove);
        }
      }
    }
  }
  
  /**
   * Check memory usage and perform aggressive cleanup if needed
   */
  private checkMemoryUsage(): void {
    try {
      // Check if performance.memory is available (Chrome only)
      if (typeof window !== 'undefined' && 
          'performance' in window && 
          'memory' in (window.performance as any)) {
          
        const memoryInfo = (window.performance as any).memory;
        const usedHeapSize = memoryInfo.usedJSHeapSize;
        
        // Log warning if memory usage is high
        if (usedHeapSize > this.memoryThresholds.warn) {
          this.log(
            Tab.ApiDebug,
            'High memory usage detected',
            {
              usedHeapSize: this.formatBytes(usedHeapSize),
              totalHeapSize: this.formatBytes(memoryInfo.totalJSHeapSize),
              heapLimit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
            },
            Severity.Warn
          );
        }
        
        // Perform aggressive cleanup if memory usage is critical
        if (usedHeapSize > this.memoryThresholds.critical) {
          this.log(
            Tab.ApiDebug,
            'Critical memory usage detected - performing aggressive cleanup',
            {
              usedHeapSize: this.formatBytes(usedHeapSize),
              totalHeapSize: this.formatBytes(memoryInfo.totalJSHeapSize),
              heapLimit: this.formatBytes(memoryInfo.jsHeapSizeLimit)
            },
            Severity.Error
          );
          
          // Aggressive cleanup:
          // 1. Clear old calls (keep only last 10%)
          const callsToKeep = Math.floor(this.calls.length * 0.1);
          if (this.calls.length > callsToKeep) {
            this.calls = this.calls.slice(-callsToKeep);
          }
          
          // 2. Clear WebSocket messages
          this.webSocketMessages = [];
          
          // 3. Clear metrics data
          if (this.metricsEnabled) {
            this.resetMetrics();
          }
          
          // 4. Force garbage collection if supported
          if (typeof window.gc === 'function') {
            try {
              window.gc();
            } catch (e) {
              // Continue even if GC fails
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors in memory check
    }
  }
  
  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Complete an API call with response data
   */
  completeApiCall(
    callId: string, 
    options: {
      status?: number;
      statusText?: string;
      responseHeaders?: Record<string, string>;
      responseBody?: any;
      responseTime?: number;
    }
  ): void {
    if (!this.enabled || !callId) return;
    
    try {
      const index = this.calls.findIndex(c => c.callId === callId);
      if (index === -1) return;
      
      const call = this.calls[index];
      
      // Calculate response size
      let responseBodySize = 0;
      let compressedResponseBody;
      
      if (options.responseBody) {
        try {
          const responseBodyStr = typeof options.responseBody === 'string' 
            ? options.responseBody 
            : JSON.stringify(options.responseBody);
          
          responseBodySize = responseBodyStr.length;
          
          // Compress large response bodies if enabled
          if (this.compressionEnabled && responseBodySize > this.compressionThreshold) {
            compressedResponseBody = {
              _compressed: true,
              _originalSize: responseBodySize,
              _sample: responseBodyStr.substring(0, 100) + '...',
              _compressedAt: Date.now()
            };
          }
        } catch (e) {
          this.debugLog('Error calculating response body size', { error: e });
        }
      }
      
      // Update call with response data
      this.calls[index] = {
        ...call,
        status: options.status,
        statusText: options.statusText,
        responseHeaders: this.maskSensitiveData(options.responseHeaders || {}),
        responseBody: compressedResponseBody || this.maskSensitiveData(options.responseBody),
        responseBodySize,
        responseTime: options.responseTime,
        completedAt: Date.now()
      };
      
      // Remove from in-flight requests
      this.inFlightRequests.delete(callId);
      
      // Remove from action call stack if present
      if (call.originActionId) {
        const actionCalls = this.actionStacks.get(call.originActionId);
        if (actionCalls) {
          // Find this call and remove it
          const callIndex = actionCalls.findIndex(c => c.callId === callId);
          if (callIndex !== -1) {
            actionCalls.splice(callIndex, 1);
          }
        }
      }
      
      // Determine severity based on status
      let severity = Severity.Info;
      let message = `API call completed: ${call.method} ${this.getPathFromUrl(call.url)}`;
      
      if (options.status) {
        if (options.status >= 200 && options.status < 300) {
          severity = Severity.Success;
        } else if (options.status >= 400 && options.status < 500) {
          severity = Severity.Warn;
          message = `API call client error: ${call.method} ${this.getPathFromUrl(call.url)}`;
        } else if (options.status >= 500) {
          severity = Severity.Error;
          message = `API call server error: ${call.method} ${this.getPathFromUrl(call.url)}`;
        }
      }
      
      // Log the API call completion
      this.log(
        Tab.ApiDebug,
        message,
        { 
          callId,
          traceId: call.traceId,
          status: options.status,
          statusText: options.statusText,
          responseTime: options.responseTime ? `${options.responseTime}ms` : undefined,
          responseBodySize: responseBodySize 
            ? this.formatBytes(responseBodySize) 
            : undefined
        },
        severity
      );
      
      // Update metrics if enabled
      if (this.metricsEnabled && options.responseTime) {
        this.updateCallMetrics(call, options.status || 0, options.responseTime, call.requestBodySize || 0, responseBodySize);
      }
      
      // Complete OpenTelemetry span if enabled
      if (this.openTelemetry) {
        this.completeOpenTelemetrySpan(call, options);
      }
      
      // Add potential fixes for error status codes
      if (options.status && options.status >= 400) {
        this.suggestApiCallFix(this.calls[index]);
      }
    } catch (e) {
      // Catch any errors in the completion logic to avoid breaking the application
      this.log(
        Tab.ApiDebug,
        'Error completing API call',
        { error: e, callId },
        Severity.Error
      );
    }
  }
  
  /**
   * Mark an API call as failed
   */
  failApiCall(callId: string, error: any): void {
    if (!this.enabled || !callId) return;
    
    try {
      const index = this.calls.findIndex(c => c.callId === callId);
      if (index === -1) return;
      
      const call = this.calls[index];
      const completedAt = Date.now();
      const responseTime = completedAt - call.timestamp;
      
      // Update call with error data
      this.calls[index] = {
        ...call,
        error,
        completedAt,
        responseTime
      };
      
      // Remove from in-flight requests
      this.inFlightRequests.delete(callId);
      
      // Remove from action call stack if present
      if (call.originActionId) {
        const actionCalls = this.actionStacks.get(call.originActionId);
        if (actionCalls) {
          // Find this call and remove it
          const callIndex = actionCalls.findIndex(c => c.callId === callId);
          if (callIndex !== -1) {
            actionCalls.splice(callIndex, 1);
          }
        }
      }
      
      // Log the API call failure
      this.log(
        Tab.ApiDebug,
        `API call failed: ${call.method} ${this.getPathFromUrl(call.url)}`,
        { 
          callId,
          traceId: call.traceId,
          error: error?.message || String(error),
          stack: error?.stack,
          responseTime: `${responseTime}ms`
        },
        Severity.Error
      );
      
      // Update metrics if enabled
      if (this.metricsEnabled) {
        this.updateCallMetrics(call, 0, responseTime, call.requestBodySize || 0, 0, true);
      }
      
      // Complete OpenTelemetry span if enabled
      if (this.openTelemetry) {
        this.completeOpenTelemetrySpan(call, { 
          error, 
          responseTime
        });
      }
      
      // Add potential fixes
      this.suggestApiCallFix(this.calls[index], error);
    } catch (e) {
      // Catch any errors in the failure logic to avoid breaking the application
      this.log(
        Tab.ApiDebug,
        'Error marking API call as failed',
        { error: e, callId },
        Severity.Error
      );
    }
  }
  
  /**
   * Retry a failed API call
   */
  retryApiCall(callId: string): Promise<any> | null {
    const call = this.calls.find(c => c.callId === callId);
    
    if (!call || !call.retryHelper) {
      this.log(
        Tab.ApiDebug,
        'Cannot retry API call - no retry helper available',
        { callId },
        Severity.Warn
      );
      return null;
    }
    
    this.log(
      Tab.ApiDebug,
      `Retrying API call: ${call.method} ${this.getPathFromUrl(call.url)}`,
      { callId, traceId: call.traceId },
      Severity.Info
    );
    
    try {
      return call.retryHelper();
    } catch (e) {
      this.log(
        Tab.ApiDebug,
        'Error retrying API call',
        { error: e, callId },
        Severity.Error
      );
      return null;
    }
  }
  
  /**
   * Get the current top-level action
   */
  getCurrentAction(): ActionContext | null {
    return this.actionStack.length ? this.actionStack[this.actionStack.length - 1] : null;
  }
  
  /**
   * Get API calls filtered by various criteria
   */
  getApiCalls(options: {
    callId?: string;
    parentCallId?: string;
    traceId?: string;
    url?: string;
    method?: string;
    status?: number;
    originComponent?: string;
    originAction?: string;
    originActionId?: string;
    timeRange?: { start: number; end: number };
    hasError?: boolean;
    userId?: string;
    environment?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'responseTime' | 'url' | 'method' | 'status';
    sortOrder?: 'asc' | 'desc';
  } = {}): ApiCallData[] {
    let filtered = [...this.calls];
    
    if (options.callId) {
      filtered = filtered.filter(call => call.callId === options.callId);
    }
    
    if (options.parentCallId) {
      filtered = filtered.filter(call => call.parentCallId === options.parentCallId);
    }
    
    if (options.traceId) {
      filtered = filtered.filter(call => call.traceId === options.traceId);
    }
    
    if (options.url) {
      filtered = filtered.filter(call => call.url.includes(options.url));
    }
    
    if (options.method) {
      filtered = filtered.filter(call => call.method === options.method);
    }
    
    if (options.status) {
      filtered = filtered.filter(call => call.status === options.status);
    }
    
    if (options.originComponent) {
      filtered = filtered.filter(call => call.originComponent === options.originComponent);
    }
    
    if (options.originAction) {
      filtered = filtered.filter(call => call.originAction === options.originAction);
    }
    
    if (options.originActionId) {
      filtered = filtered.filter(call => call.originActionId === options.originActionId);
    }
    
    if (options.timeRange) {
      filtered = filtered.filter(
        call => call.timestamp >= options.timeRange!.start && call.timestamp <= options.timeRange!.end
      );
    }
    
    if (options.hasError !== undefined) {
      filtered = filtered.filter(call => (!!call.error) === options.hasError);
    }
    
    if (options.userId) {
      filtered = filtered.filter(call => call.userId === options.userId);
    }
    
    if (options.environment) {
      filtered = filtered.filter(call => call.environment === options.environment);
    }
    
    // Sort results if specified
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      
      filtered.sort((a, b) => {
        switch (options.sortBy) {
          case 'timestamp':
            return sortOrder * (a.timestamp - b.timestamp);
          case 'responseTime':
            return sortOrder * ((a.responseTime || 0) - (b.responseTime || 0));
          case 'url':
            return sortOrder * a.url.localeCompare(b.url);
          case 'method':
            return sortOrder * a.method.localeCompare(b.method);
          case 'status':
            return sortOrder * ((a.status || 0) - (b.status || 0));
          default:
            return 0;
        }
      });
    }
    
    // Apply pagination if specified
    if (options.offset !== undefined && options.offset > 0) {
      filtered = filtered.slice(options.offset);
    }
    
    if (options.limit !== undefined && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }
  
  /**
   * Get call chains for a root API call
   */
  getCallChain(rootCallId: string): ApiCallData[] {
    const rootCall = this.calls.find(call => call.callId === rootCallId);
    if (!rootCall) return [];
    
    const chain: ApiCallData[] = [rootCall];
    
    // Recursive function to find all child calls
    const findChildCalls = (parentId: string) => {
      const childCalls = this.calls.filter(call => call.parentCallId === parentId);
      childCalls.forEach(childCall => {
        chain.push(childCall);
        findChildCalls(childCall.callId);
      });
    };
    
    findChildCalls(rootCallId);
    
    return chain.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get API calls grouped by user action name
   */
  getCallsByAction(): Record<string, ApiCallData[]> {
    const callsByAction: Record<string, ApiCallData[]> = {};
    
    // Group calls by originAction
    this.calls.forEach(call => {
      if (call.originAction) {
        if (!callsByAction[call.originAction]) {
          callsByAction[call.originAction] = [];
        }
        callsByAction[call.originAction].push(call);
      }
    });
    
    return callsByAction;
  }
  
  /**
   * Get API calls grouped by action ID (more precise than action name)
   */
  getCallsByActionId(): Record<string, ApiCallData[]> {
    const callsByActionId: Record<string, ApiCallData[]> = {};
    
    // Group calls by originActionId
    this.calls.forEach(call => {
      if (call.originActionId) {
        if (!callsByActionId[call.originActionId]) {
          callsByActionId[call.originActionId] = [];
        }
        callsByActionId[call.originActionId].push(call);
      }
    });
    
    return callsByActionId;
  }
  
  /**
   * Get API calls by trace ID
   */
  getCallsByTraceId(traceId: string): ApiCallData[] {
    return this.calls.filter(call => call.traceId === traceId);
  }
  
  /**
   * Get root-level API calls that don't have a parent
   */
  getRootCalls(): ApiCallData[] {
    return this.calls.filter(call => !call.parentCallId);
  }
  
  /**
   * Export API calls to HAR format
   * @param options Options for customizing the export
   */
  exportToHAR(options: {
    /** Maximum number of entries to include */
    maxEntries?: number;
    /** Include only calls within this time range */
    timeRange?: { start: number; end: number };
    /** Include only calls with these status codes */
    statusCodes?: number[];
    /** Include only calls from these components */
    components?: string[];
    /** Truncate large request/response bodies */
    truncateBodies?: boolean;
    /** Maximum size of bodies before truncation (in chars) */
    maxBodySize?: number;
    /** Format output with indentation (pretty-print) */
    prettyPrint?: boolean;
    /** Include root calls only (exclude child calls) */
    rootCallsOnly?: boolean;
    /** Include only calls matching this URL pattern */
    urlPattern?: string | RegExp;
  } = {}): string {
    try {
      // Apply filters for call selection
      let filteredCalls = [...this.calls];
      
      // Filter by time range
      if (options.timeRange) {
        filteredCalls = filteredCalls.filter(call => 
          call.timestamp >= options.timeRange!.start && 
          call.timestamp <= options.timeRange!.end
        );
      }
      
      // Filter by status codes
      if (options.statusCodes && options.statusCodes.length > 0) {
        filteredCalls = filteredCalls.filter(call => 
          call.status && options.statusCodes!.includes(call.status)
        );
      }
      
      // Filter by components
      if (options.components && options.components.length > 0) {
        filteredCalls = filteredCalls.filter(call => 
          call.originComponent && options.components!.includes(call.originComponent)
        );
      }
      
      // Filter by URL pattern
      if (options.urlPattern) {
        if (typeof options.urlPattern === 'string') {
          filteredCalls = filteredCalls.filter(call => 
            call.url.includes(options.urlPattern as string)
          );
        } else if (options.urlPattern instanceof RegExp) {
          filteredCalls = filteredCalls.filter(call => 
            (options.urlPattern as RegExp).test(call.url)
          );
        }
      }
      
      // Filter root calls only
      if (options.rootCallsOnly) {
        filteredCalls = filteredCalls.filter(call => !call.parentCallId);
      }
      
      // Limit entries if maxEntries specified
      if (options.maxEntries && options.maxEntries > 0 && filteredCalls.length > options.maxEntries) {
        filteredCalls = filteredCalls.slice(0, options.maxEntries);
      }
      
      // Default body size limit
      const maxBodySize = options.maxBodySize || this.harBodySizeLimit;

      // Create HAR entries
      const entries = filteredCalls.map(call => {
        // Parse the URL to get query parameters
        let queryString: { name: string, value: string }[] = [];
        try {
          const urlObj = this.createUrl(call.url);
          urlObj.searchParams.forEach((value, name) => {
            queryString.push({ name, value });
          });
        } catch (e) {
          // If URL can't be parsed, use the request params if provided
          if (call.requestParams) {
            queryString = Object.entries(call.requestParams).map(([name, value]) => ({
              name,
              value: String(value)
            }));
          }
        }
        
        // Determine content types
        const requestContentType = this.detectContentType(call.requestBody);
        const responseContentType = this.detectContentType(call.responseBody);
        
        // Prepare request body text with potential truncation
        let requestBodyText = '';
        let requestBodySize = call.requestBodySize || 0;
        
        if (call.requestBody) {
          try {
            // Handle compressed bodies
            if (call.requestBody._compressed) {
              requestBodyText = `[COMPRESSED BODY - Original size: ${this.formatBytes(call.requestBody._originalSize)}]`;
              requestBodySize = call.requestBody._originalSize;
            } else {
              if (typeof call.requestBody === 'object') {
                requestBodyText = JSON.stringify(call.requestBody);
              } else {
                requestBodyText = String(call.requestBody);
              }
              
              requestBodySize = requestBodyText.length;
              
              // Truncate if needed
              if (options.truncateBodies && requestBodySize > maxBodySize) {
                requestBodyText = requestBodyText.substring(0, maxBodySize) + 
                  `\n[TRUNCATED - ${requestBodySize - maxBodySize} more characters]`;
              }
            }
          } catch (e) {
            requestBodyText = '[ERROR: Could not stringify request body]';
            requestBodySize = requestBodyText.length;
          }
        }
        
        // Prepare response body text with potential truncation
        let responseBodyText = '';
        let responseBodySize = call.responseBodySize || 0;
        
        if (call.responseBody) {
          try {
            // Handle compressed bodies
            if (call.responseBody._compressed) {
              responseBodyText = `[COMPRESSED BODY - Original size: ${this.formatBytes(call.responseBody._originalSize)}]`;
              responseBodySize = call.responseBody._originalSize;
            } else {
              if (typeof call.responseBody === 'object') {
                responseBodyText = JSON.stringify(call.responseBody);
              } else {
                responseBodyText = String(call.responseBody);
              }
              
              responseBodySize = responseBodyText.length;
              
              // Truncate if needed
              if (options.truncateBodies && responseBodySize > maxBodySize) {
                responseBodyText = responseBodyText.substring(0, maxBodySize) + 
                  `\n[TRUNCATED - ${responseBodySize - maxBodySize} more characters]`;
              }
            }
          } catch (e) {
            responseBodyText = '[ERROR: Could not stringify response body]';
            responseBodySize = responseBodyText.length;
          }
        }
        
        // Detailed timing information
        const timings = {
          blocked: -1,
          dns: -1,
          connect: -1,
          ssl: -1,
          send: 0,
          wait: call.responseTime || 0,
          receive: 0,
          _blocked_queueing: -1
        };
        
        // Create HAR entry
        return {
          _id: call.callId,
          _traceId: call.traceId,
          _resourceType: 'xhr',
          startedDateTime: new Date(call.timestamp).toISOString(),
          time: call.responseTime || 0,
          request: {
            method: call.method,
            url: call.url,
            httpVersion: 'HTTP/1.1',
            headers: call.requestHeaders ? 
              Object.entries(call.requestHeaders).map(([name, value]) => ({ name, value })) : [],
            queryString,
            cookies: [],
            headersSize: -1,
            bodySize: requestBodySize,
            postData: call.requestBody ? { 
              mimeType: requestContentType,
              text: requestBodyText
            } : undefined
          },
          response: {
            status: call.status || 0,
            statusText: call.statusText || '',
            httpVersion: 'HTTP/1.1',
            headers: call.responseHeaders ? 
              Object.entries(call.responseHeaders).map(([name, value]) => ({ name, value })) : [],
            cookies: [],
            content: { 
              mimeType: responseContentType,
              size: responseBodySize,
              text: responseBodyText || ''
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: responseBodySize,
          },
          cache: {},
          timings,
          serverIPAddress: '',
          _error: call.error ? String(call.error) : undefined,
          _originComponent: call.originComponent,
          _originAction: call.originAction,
          _originActionId: call.originActionId,
          _routePath: call.routePath,
          _parentCallId: call.parentCallId,
          _userId: call.userId,
          _environment: call.environment,
          _traceContext: call.traceContext
        };
      });
      
      // Create HAR object
      const har = {
        log: {
          version: '1.2',
          creator: {
            name: 'EnterpriseAnalysisDebugger',
            version: '1.0'
          },
          pages: [],
          entries
        }
      };
      
      // Stringify with or without pretty-printing
      return JSON.stringify(har, null, options.prettyPrint ? 2 : 0);
    } catch (e) {
      this.log(
        Tab.ApiDebug,
        'Error exporting to HAR format',
        { error: e },
        Severity.Error
      );
      return JSON.stringify({ error: 'Failed to export to HAR format' });
    }
  }
  
  /**
   * Stream HAR export for large datasets without memory spikes
   * @param options Export options
   * @returns ReadableStream of JSON chunks
   */
  exportToHARStream(options: {
    maxEntriesPerChunk?: number;
    timeRange?: { start: number; end: number };
    statusCodes?: number[];
    truncateBodies?: boolean;
    maxBodySize?: number;
  } = {}): ReadableStream<Uint8Array> {
    try {
      // Use default chunk size if not specified
      const maxEntriesPerChunk = options.maxEntriesPerChunk || 100;
      
      // Filter calls by time range
      let filteredCalls = [...this.calls];
      if (options.timeRange) {
        filteredCalls = filteredCalls.filter(call => 
          call.timestamp >= options.timeRange!.start && 
          call.timestamp <= options.timeRange!.end
        );
      }
      
      // Filter by status codes
      if (options.statusCodes && options.statusCodes.length > 0) {
        filteredCalls = filteredCalls.filter(call => 
          call.status && options.statusCodes!.includes(call.status)
        );
      }
      
      // Create readable stream
      return new ReadableStream({
        start(controller) {
          // Write HAR header
          controller.enqueue(new TextEncoder().encode(
            `{"log":{"version":"1.2","creator":{"name":"EnterpriseAnalysisDebugger","version":"1.0"},"pages":[],"entries":[`
          ));
        },
        pull: (async (controller) => {
          if (filteredCalls.length === 0) {
            // End of entries, write HAR footer
            controller.enqueue(new TextEncoder().encode(']}}')); 
            controller.close();
            return;
          }
          
          // Process next chunk of calls
          const chunk = filteredCalls.splice(0, maxEntriesPerChunk);
          
          // Convert chunk to HAR entries
          const harEntries = chunk.map((call, index) => {
            // [HAR entry generation code similar to exportToHAR]
            // Simplified for brevity
            return JSON.stringify({
              startedDateTime: new Date(call.timestamp).toISOString(),
              time: call.responseTime || 0,
              request: {
                method: call.method,
                url: call.url
                // ... other request fields
              },
              response: {
                status: call.status || 0
                // ... other response fields
              }
            });
          }).join(',');
          
          // Add comma between chunks if not the first chunk
          controller.enqueue(new TextEncoder().encode(
            harEntries + (filteredCalls.length > 0 ? ',' : '')
          ));
        }),
      });
    } catch (e) {
      // Return error as a stream
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ error: 'Failed to export to HAR format stream' })
          ));
          controller.close();
        }
      });
    }
  }
  
  /**
   * Detect content type from data
   */
  private detectContentType(data: any): string {
    if (data === undefined || data === null) {
      return 'text/plain';
    }
    
    // Handle compressed data
    if (data && data._compressed) {
      return 'application/octet-stream';
    }
    
    if (typeof data === 'object') {
      return 'application/json';
    }
    
    if (typeof data === 'string' && 
        (data.startsWith('<!DOCTYPE html>') || data.startsWith('<html'))) {
      return 'text/html';
    }
    
    if (typeof data === 'string' && 
        (data.startsWith('<?xml') || data.match(/^\s*<\?xml/))) {
      return 'application/xml';
    }
    
    return 'text/plain';
  }
  
  /**
   * Clear all stored API calls and batch logs
   */
  clearApiCalls(): void {
    this.calls = [];
    this.inFlightRequests.clear();
    this.correlationIdCounter = 0;
    
    // Also clean up action stacks
    this.actionStacks.clear();
    
    // Clean up WebSocket messages
    this.webSocketMessages = [];
    
    // Reset metrics if enabled
    if (this.metricsEnabled) {
      this.resetMetrics();
    }
    
    // Clean up any batched logs (new)
    this.flushBatchedLogs();
    this.batchedLogs = [];
    
    this.log(Tab.ApiDebug, 'API call history cleared', {}, Severity.Info);
  }
  
  /**
   * Track a state change related to an API call
   */
  trackStateChange(actionType: string, stateBefore: any, stateAfter: any): void {
    // Skip if throttling is enabled and we should skip this diff
    if (this.throttleStateDiffs && !this.shouldComputeDiff()) {
      return;
    }
    
    try {
      // Find the most recent in-flight call
      if (this.inFlightRequests.size === 0) return;
      
      // Get the most recent in-flight request key (last one added)
      const recentCallIds = Array.from(this.inFlightRequests.keys());
      const recentCallId = recentCallIds[recentCallIds.length - 1];
      
      const index = this.calls.findIndex(c => c.callId === recentCallId);
      
      if (index !== -1) {
        // Compute state diff
        const stateChanges = this.computeStateDiff(stateBefore, stateAfter);
        
        // Log the state change
        this.log(
          Tab.ApiDebug,
          `State change detected for action: ${actionType}`,
          {
            callId: recentCallId,
            actionType,
            stateChanges
          },
          Severity.Debug
        );
      }
    } catch (e) {
      this.debugLog('Error tracking state change', { error: e });
    }
  }
  
  /**
   * Decide whether to compute a diff based on throttling settings
   */
  private shouldComputeDiff(): boolean {
    // Simple throttling strategy - compute diff for 1 in every 5 calls when there are many in-flight
    if (this.inFlightRequests.size > 10) {
      return Math.random() < 0.2; // 20% chance to compute the diff
    }
    
    // Always compute diff when there are few in-flight requests
    return true;
  }
  
  /**
   * Compute a diff between two state objects with performance optimizations
   */
  private computeStateDiff(before: any, after: any): Record<string, any> {
    try {
      // Handle null or undefined inputs
      if (!before && !after) return {};
      if (!before) return { __summary: 'State initialized' };
      if (!after) return { __summary: 'State cleared' };
      
      // Quick reference equality check
      if (before === after) return { __summary: 'No changes (same reference)' };
      
      // For primitive types, do simple comparison
      if (typeof before !== 'object' || typeof after !== 'object') {
        if (before === after) return {};
        return { value: { from: before, to: after } };
      }
      
      const changes: Record<string, any> = {};
      let changeCount = 0;
      const maxChanges = 50; // Limit to prevent performance issues with large objects
      
      // Compare top-level keys only for simplicity
      const beforeKeys = Object.keys(before || {});
      const afterKeys = Object.keys(after || {});
      
      // Check for added keys
      const addedKeys = afterKeys.filter(key => !beforeKeys.includes(key));
      if (addedKeys.length > 0) {
        // If there are many added keys, summarize
        if (addedKeys.length > 10) {
          changes['__added'] = { 
            summary: `${addedKeys.length} properties added`,
            // Show just a few examples
            examples: addedKeys.slice(0, 5).map(key => ({ key, value: after[key] }))
          };
        } else {
          // Show all added keys if there aren't too many
          addedKeys.forEach(key => {
            if (changeCount < maxChanges) {
              changes[key] = { added: after[key] };
              changeCount++;
            }
          });
        }
      }
      
      // Check for removed keys
      const removedKeys = beforeKeys.filter(key => !afterKeys.includes(key));
      if (removedKeys.length > 0) {
        // If there are many removed keys, summarize
        if (removedKeys.length > 10) {
          changes['__removed'] = { 
            summary: `${removedKeys.length} properties removed`,
            // Show just a few examples
            examples: removedKeys.slice(0, 5).map(key => ({ key, value: before[key] }))
          };
        } else {
          // Show all removed keys if there aren't too many
          removedKeys.forEach(key => {
            if (changeCount < maxChanges) {
              changes[key] = { removed: before[key] };
              changeCount++;
            }
          });
        }
      }
      
      // Check for changed keys (that exist in both objects)
      const commonKeys = beforeKeys.filter(key => afterKeys.includes(key));
      
      // First, do a shallow comparison of values
      for (const key of commonKeys) {
        if (changeCount >= maxChanges) {
          changes['__truncated'] = { message: `${commonKeys.length - changeCount} more changes not shown` };
          break;
        }
        
        const beforeValue = before[key];
        const afterValue = after[key];
        
        // Skip if the values are the same reference
        if (beforeValue === afterValue) continue;
        
        // For primitives or different types, do a simple comparison
        if (typeof beforeValue !== 'object' || 
            typeof afterValue !== 'object' ||
            beforeValue === null || 
            afterValue === null || 
            Array.isArray(beforeValue) !== Array.isArray(afterValue)) {
          // Use simple equality comparison to avoid expensive JSON.stringify
          if (beforeValue !== afterValue) {
            changes[key] = {
              from: beforeValue,
              to: afterValue
            };
            changeCount++;
          }
          continue;
        }
        
        // For arrays, do length comparison and check a sample of elements
        if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
          if (beforeValue.length !== afterValue.length) {
            changes[key] = {
              arrayChanged: true,
              lengthChange: { from: beforeValue.length, to: afterValue.length }
            };
            changeCount++;
            continue;
          }
          
          // Check first and last few elements for large arrays
          if (beforeValue.length > 10) {
            let arrayDiff = false;
            
            // Check first 3 elements
            for (let i = 0; i < 3 && i < beforeValue.length; i++) {
              if (beforeValue[i] !== afterValue[i]) {
                arrayDiff = true;
                break;
              }
            }
            
            // Check last 3 elements if we didn't find a diff yet
            if (!arrayDiff) {
              for (let i = 1; i <= 3 && i <= beforeValue.length; i++) {
                const idx = beforeValue.length - i;
                if (beforeValue[idx] !== afterValue[idx]) {
                  arrayDiff = true;
                  break;
                }
              }
            }
            
            if (arrayDiff) {
              changes[key] = { arrayChanged: true, length: beforeValue.length };
              changeCount++;
            }
          } else {
            // For small arrays, do element-by-element comparison
            let arrayDiff = false;
            for (let i = 0; i < beforeValue.length; i++) {
              if (beforeValue[i] !== afterValue[i]) {
                arrayDiff = true;
                break;
              }
            }
            
            if (arrayDiff) {
              changes[key] = { arrayChanged: true, length: beforeValue.length };
              changeCount++;
            }
          }
          continue;
        }
        
        // For objects, just indicate they changed (without deep inspection)
        const beforeKeys = Object.keys(beforeValue);
        const afterKeys = Object.keys(afterValue);
        
        if (beforeKeys.length !== afterKeys.length) {
          changes[key] = {
            objectChanged: true,
            keyCountChange: { from: beforeKeys.length, to: afterKeys.length }
          };
          changeCount++;
          continue;
        }
        
        // Check a sample of keys for large objects
        let objectDiff = false;
        const keysToCheck = beforeKeys.length > 10 
          ? beforeKeys.slice(0, 5) // Check first 5 keys for large objects
          : beforeKeys;           // Check all keys for small objects
        
        for (const subKey of keysToCheck) {
          if (beforeValue[subKey] !== afterValue[subKey]) {
            objectDiff = true;
            break;
          }
        }
        
        if (objectDiff) {
          changes[key] = { objectChanged: true, keyCount: beforeKeys.length };
          changeCount++;
        }
      }
      
      return changes;
    } catch (e) {
      this.debugLog('Error computing state diff', { error: e });
      return { error: 'Failed to compute diff' };
    }
  }
  
  /**
   * Get path from URL
   */
  private getPathFromUrl(url: string): string {
    try {
      const urlObj = this.createUrl(url);
      return urlObj.pathname;
    } catch (e) {
      // If it's not a valid URL (e.g., relative path), return as is
      return url;
    }
  }
  
  /**
   * Helper to create URL objects safely in any environment
   */
  private createUrl(url: string): URL {
    try {
      // Try to create URL directly
      return new URL(url);
    } catch (e) {
      // If that fails, it might be a relative URL
      try {
        // Try with browser base URL if available
        if (typeof window !== 'undefined' && window.location) {
          return new URL(url, window.location.href);
        }
        
        // Try with server location if configured
        if (this.serverLocation) {
          const base = `${this.serverLocation.protocol}//${this.serverLocation.host}`;
          return new URL(url, base);
        }
        
        // Last resort - use a dummy base
        return new URL(url, 'http://localhost');
      } catch (innerErr) {
        // If everything fails, create a URL with a dummy string as the path
        return new URL(`http://localhost/${url.replace(/^\//, '')}`);
      }
    }
  }
  
  /**
   * Get the hostname for the current environment
   */
  private getHostname(): string {
    try {
      if (typeof window !== 'undefined' && window.location) {
        return window.location.hostname;
      }
      
      if (this.serverLocation) {
        return this.serverLocation.host.split(':')[0];
      }
      
      return 'localhost';
    } catch (e) {
      return 'localhost';
    }
  }
  
  /**
   * Check if a key matches any sensitive pattern
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = String(key).toLowerCase();
    
    for (const pattern of this.sensitivePatterns) {
      if (typeof pattern === 'string') {
        if (lowerKey.includes(pattern.toLowerCase())) {
          return true;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(lowerKey)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Mask sensitive data in objects or headers
   * With deep traversal for nested objects and arrays
   * Performance optimized for large objects with optional depth limit
   */
  private maskSensitiveData<T>(data: T, depth: number = 0, maxDepth: number = 10): T {
    try {
      // Early return for null/undefined
      if (data === null || data === undefined) {
        return data;
      }
      
      // Early return for primitives
      if (typeof data !== 'object') {
        return data;
      }
      
      // Check recursion depth to prevent stack overflow
      if (depth >= this.maxMaskingDepth) {
        return typeof data === 'object' ? ('[MAX_DEPTH_REACHED]' as unknown as T) : data;
      }
      
      // Handle arrays efficiently
      if (Array.isArray(data)) {
        // Optimization: only process the array if it's reasonably sized
        if (data.length > 1000) {
          // For very large arrays, truncate and add a note
          const truncated = data.slice(0, 1000);
          truncated.push('[TRUNCATED...]' as any);
          return truncated as unknown as T;
        }
        
        return data.map(item => this.maskSensitiveData(item, depth + 1, maxDepth)) as unknown as T;
      }
      
      // Handle objects (includes Maps, regular objects, etc.)
      if (typeof data === 'object') {
        const result = { ...data };
        let processedKeys = 0;
        
        for (const key in result) {
          if (processedKeys >= this.maxKeysToMask) {
            // For very large objects, stop processing after maxKeys
            (result as any)['[TRUNCATED...]'] = `Object too large, ${Object.keys(result).length - processedKeys} more properties omitted`;
            break;
          }
          
          if (Object.prototype.hasOwnProperty.call(result, key)) {
            if (this.isSensitiveKey(key)) {
              // Mask sensitive values
              result[key] = '[REDACTED]';
            } else if (typeof result[key] === 'object' && result[key] !== null) {
              // Recursively mask nested objects
              result[key] = this.maskSensitiveData(result[key], depth + 1, maxDepth);
            }
          }
          
          processedKeys++;
        }
        
        return result as T;
      }
      
      return data;
    } catch (e) {
      // If anything goes wrong, return the original data
      this.debugLog('Error masking sensitive data', { error: e });
      return data;
    }
  }
  
  /**
   * Suggest fixes for API call errors
   */
  private suggestApiCallFix(call: ApiCallData, error?: any): void {
    try {
      if (!this.logger.addFix) {
        // Logger doesn't support fix suggestions
        return;
      }
      
      const status = call.status;
      const url = call.url;
      const method = call.method;
      
      // Create a fix function for retrying the call if a retryHelper is available
      let fixFunction = null;
      if (call.retryHelper) {
        fixFunction = () => {
          return this.retryApiCall(call.callId);
        };
      }
      
      if (status) {
        // HTTP status code error
        switch (status) {
          case 400:
            this.logger.addFix(
              '400 Bad Request',
              `The request to ${this.getPathFromUrl(url)} was malformed.`,
              'Check the request body format and parameters for errors.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 401:
            this.logger.addFix(
              '401 Unauthorized',
              `The request to ${this.getPathFromUrl(url)} lacks valid authentication.`,
              'Check that your auth token is valid and not expired.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 403:
            this.logger.addFix(
              '403 Forbidden',
              `The request to ${this.getPathFromUrl(url)} was denied due to insufficient permissions.`,
              'Verify that the user has the necessary permissions for this operation.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 404:
            this.logger.addFix(
              '404 Not Found',
              `The endpoint ${this.getPathFromUrl(url)} was not found.`,
              'Verify the endpoint path is correct and exists on the server.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 405:
            this.logger.addFix(
              '405 Method Not Allowed',
              `The method ${method} is not allowed for ${this.getPathFromUrl(url)}.`,
              'Verify that you are using the correct HTTP method for this endpoint.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 408:
            this.logger.addFix(
              '408 Request Timeout',
              `The request to ${this.getPathFromUrl(url)} timed out.`,
              'The server took too long to respond. Consider increasing timeout values or check server performance.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 413:
            this.logger.addFix(
              '413 Payload Too Large',
              `The request payload to ${this.getPathFromUrl(url)} was too large.`,
              'Reduce the size of the request data or check server upload limits.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 429:
            this.logger.addFix(
              '429 Too Many Requests',
              `Rate limit exceeded for ${this.getPathFromUrl(url)}.`,
              'Implement rate limiting or back-off strategy in your code.',
              fixFunction,
              Severity.Warn
            );
            break;
            
          case 500:
          case 502:
          case 503:
          case 504:
            this.logger.addFix(
              `${status} Server Error`,
              `The server encountered an error processing request to ${this.getPathFromUrl(url)}.`,
              'This is a server-side issue. Check server logs or contact API provider.',
              fixFunction,
              Severity.Error
            );
            break;
            
          default:
            // Generic error handling for other status codes
            if (status >= 400 && status < 500) {
              this.logger.addFix(
                `${status} Client Error`,
                `Client error when requesting ${this.getPathFromUrl(url)}.`,
                'Review the request details and API documentation.',
                fixFunction,
                Severity.Warn
              );
            } else if (status >= 500) {
              this.logger.addFix(
                `${status} Server Error`,
                `Server error when requesting ${this.getPathFromUrl(url)}.`,
                'This is a server-side issue. Check server logs or contact API provider.',
                fixFunction,
                Severity.Error
              );
            }
        }
      } else if (error) {
        // Network or other errors
        const errorMessage = error.message || String(error);
        
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          this.logger.addFix(
            'Request Timeout',
            `The request to ${this.getPathFromUrl(url)} timed out.`,
            'Check server availability or increase the request timeout.',
            fixFunction,
            Severity.Warn
          );
        } else if (
          errorMessage.includes('Network Error') || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('connect')
        ) {
          this.logger.addFix(
            'Network Error',
            `Network error occurred when requesting ${this.getPathFromUrl(url)}.`,
            'Check your internet connection and API endpoint availability.',
            fixFunction,
            Severity.Warn
          );
        } else if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
          this.logger.addFix(
            'CORS Error',
            `CORS policy blocked the request to ${this.getPathFromUrl(url)}.`,
            'The server needs to include appropriate CORS headers in its response.',
            fixFunction,
            Severity.Warn
          );
        } else if (errorMessage.includes('aborted') || errorMessage.includes('canceled')) {
          this.logger.addFix(
            'Request Aborted',
            `The request to ${this.getPathFromUrl(url)} was aborted.`,
            'The request was canceled before completion. Check if there are competing requests or navigation events.',
            fixFunction,
            Severity.Warn
          );
        } else if (errorMessage.includes('Failed to parse')) {
          this.logger.addFix(
            'Parse Error',
            `Failed to parse response from ${this.getPathFromUrl(url)}.`,
            'The response format may not match what your code expects. Check content types and response formats.',
            fixFunction,
            Severity.Warn
          );
        } else {
          // Generic error suggestion
          this.logger.addFix(
            'API Request Error',
            `Error occurred when requesting ${this.getPathFromUrl(url)}: ${errorMessage}`,
            'Review the error details and check your request configuration.',
            fixFunction,
            Severity.Warn
          );
        }
      }
    } catch (e) {
      this.debugLog('Error suggesting API call fix', { error: e });
    }
  }