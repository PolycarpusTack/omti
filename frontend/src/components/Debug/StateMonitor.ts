import { Tab, Severity } from './debugTypes';
import { DebugLogger } from './DebugLogger';

/**
 * Interface for state entry with metadata
 */
interface StateEntry {
  id: string;
  timestamp: number;
  name: string;
  state: any;
  componentName?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Interface for state change entry
 */
interface StateChangeEntry {
  id: string;
  timestamp: number;
  previousStateId: string;
  currentStateId: string;
  changes: Record<string, { previous: any; current: any }>;
  componentName?: string;
  actionName?: string;
}

/**
 * Configuration options for state monitor
 */
interface StateMonitorConfig {
  maxEntries?: number;
  diffAlgorithm?: 'deep' | 'shallow' | 'auto';
  ignoreKeys?: string[];
  trackCircularReferences?: boolean;
  enableTimeTravelDebugging?: boolean;
  snapshotFrequency?: number;
  maxStateSize?: number;
  useCompression?: boolean;
  ignoreFunctions?: boolean;
  persistStateHistory?: boolean;
  includeMetadata?: boolean;
}

/**
 * Monitors application state changes for debugging purposes
 */
export class StateMonitorImpl {
  private states: StateEntry[] = [];
  private stateChanges: StateChangeEntry[] = [];
  private logger: DebugLogger;
  private config: Required<StateMonitorConfig>;
  private snapshotIntervalId: number | null = null;
  private activeStateId: string | null = null;
  private stateHistoryEnabled: boolean = true;
  private stateSubscriptions: Map<string, Set<(state: any) => void>> = new Map();
  private lastComparison: { previous: string; current: string; timestamp: number } | null = null;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<StateMonitorConfig> = {
    maxEntries: 100,
    diffAlgorithm: 'auto',
    ignoreKeys: ['__typename', '_tempId', 'lastUpdated', 'timestamp'],
    trackCircularReferences: true,
    enableTimeTravelDebugging: false,
    snapshotFrequency: 0, // 0 means no automatic snapshots
    maxStateSize: 2 * 1024 * 1024, // 2MB
    useCompression: false,
    ignoreFunctions: true,
    persistStateHistory: false,
    includeMetadata: true
  };

  /**
   * Create a new StateMonitor instance
   * @param config Configuration options
   */
  constructor(config: StateMonitorConfig = {}) {
    this.logger = DebugLogger.getInstance();
    this.config = { ...StateMonitorImpl.DEFAULT_CONFIG, ...config };

    // Log initialization
    this.logger.log(
      Tab.State,
      'StateMonitor initialized',
      { config: this.config },
      Severity.Info
    );

    // Set up automatic snapshots if configured
    if (this.config.snapshotFrequency > 0) {
      this.startAutomaticSnapshots();
    }

    // Set up state history persistence if enabled
    if (this.config.persistStateHistory) {
      this.loadStateHistory();
      window.addEventListener('beforeunload', () => {
        this.saveStateHistory();
      });
    }
  }

  /**
   * Record a state snapshot
   * @param state The state to record
   * @param name A name for the state entry
   * @param componentName Optional component name
   * @param metadata Optional metadata
   * @returns ID of the recorded state entry
   */
  recordState(
    state: any, 
    name: string = 'State Snapshot', 
    componentName?: string,
    metadata?: Record<string, any>
  ): string {
    if (!this.stateHistoryEnabled) return '';

    try {
      // Generate a unique ID for this state entry
      const id = this.generateStateId();

      // Process state for storage (handle circular refs, etc.)
      const processedState = this.processState(state);

      // Create state entry
      const entry: StateEntry = {
        id,
        timestamp: Date.now(),
        name,
        state: processedState,
        componentName,
        metadata: this.config.includeMetadata ? metadata : undefined
      };

      // Add to states array with buffer management
      this.addStateEntry(entry);

      // If this is the first state or timeTravelDebugging is enabled, make it active
      if (this.states.length === 1 || this.config.enableTimeTravelDebugging) {
        this.activeStateId = id;
      }

      // If there's a previous state, compute and record the changes
      if (this.states.length > 1) {
        const previousState = this.states[this.states.length - 2];
        this.recordStateChange(previousState, entry, componentName);
      }

      // Notify subscribers if any
      this.notifySubscribers(entry);

      return id;
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error recording state',
        { error, stateName: name, componentName },
        Severity.Error
      );
      return '';
    }
  }

  /**
   * Process state to handle circular references and functions
   * @param state Original state
   * @returns Processed state safe for storage
   */
  private processState(state: any): any {
    if (!state) return state;

    try {
      // Check if the state is too large
      const estimatedSize = this.estimateObjectSize(state);
      if (estimatedSize > this.config.maxStateSize) {
        this.logger.log(
          Tab.State,
          'State size exceeds maximum allowed size',
          { 
            estimatedSize: this.formatBytes(estimatedSize), 
            maxSize: this.formatBytes(this.config.maxStateSize) 
          },
          Severity.Warn
        );
        
        // Return truncated state
        return {
          __truncated: true,
          __originalSize: estimatedSize,
          __message: 'State was too large to store completely',
          __timestamp: Date.now(),
          summary: this.createStateSummary(state)
        };
      }

      // Handle circular references if configured
      if (this.config.trackCircularReferences) {
        return this.handleCircularReferences(state);
      }
      
      // Otherwise just do a deep clone with function handling
      return this.deepClone(state);
    } catch (error) {
      this.logger.log(
        Tab.State, 
        'Error processing state for storage', 
        { error },
        Severity.Error
      );
      
      return {
        __error: true,
        __message: 'Failed to process state',
        __errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a summary of a large state object
   * @param state The state to summarize
   * @returns Summary with key information
   */
  private createStateSummary(state: any): any {
    if (!state || typeof state !== 'object') {
      return { value: state };
    }

    // For arrays, summarize length and sample items
    if (Array.isArray(state)) {
      return {
        type: 'array',
        length: state.length,
        sample: state.slice(0, 3).map(item => 
          typeof item === 'object' ? 
            { type: typeof item, keys: Object.keys(item).slice(0, 5) } : 
            item
        )
      };
    }

    // For objects, summarize keys and a few values
    const keys = Object.keys(state);
    const summary: Record<string, any> = {
      type: 'object',
      keyCount: keys.length,
      keys: keys.slice(0, 20)
    };

    // Add a few sample values for important keys
    const sampleKeys = keys.slice(0, 5);
    for (const key of sampleKeys) {
      const value = state[key];
      if (value === null || value === undefined) {
        summary[key] = value;
      } else if (typeof value !== 'object') {
        summary[key] = value;
      } else if (Array.isArray(value)) {
        summary[key] = `Array(${value.length})`;
      } else {
        summary[key] = `Object{${Object.keys(value).slice(0, 3).join(', ')}}`;
      }
    }

    return summary;
  }

  /**
   * Estimate the size of an object in bytes
   * @param obj Object to estimate size for
   * @returns Estimated size in bytes
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    
    // For primitives, use approximate sizes
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'string') return obj.length * 2; // UTF-16 encoding
    
    if (typeof obj === 'object') {
      // Detect circular references to avoid infinite recursion
      const seen = new WeakSet();
      
      const sizeOf = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value !== 'object') {
          if (typeof value === 'string') return value.length * 2;
          return 8; // Approximate size for other primitives
        }
        
        // Handle circular references
        if (seen.has(value)) return 0;
        seen.add(value);
        
        let size = 0;
        
        // Arrays
        if (Array.isArray(value)) {
          size = 40; // Array overhead
          // For large arrays, estimate based on sample
          if (value.length > 1000) {
            const sampleSize = 100;
            let sampleSum = 0;
            for (let i = 0; i < sampleSize; i++) {
              const idx = Math.floor(i * (value.length / sampleSize));
              sampleSum += sizeOf(value[idx]);
            }
            size += (sampleSum / sampleSize) * value.length;
          } else {
            // For smaller arrays, measure all elements
            for (const item of value) {
              size += sizeOf(item);
            }
          }
          return size;
        }
        
        // Objects
        size = 40; // Object overhead
        // Add size for all keys and values
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            size += key.length * 2; // Key size
            size += sizeOf(value[key]); // Value size
          }
        }
        
        return size;
      };
      
      return sizeOf(obj);
    }
    
    // Default for other types
    return 8;
  }

  /**
   * Format bytes to human readable string
   * @param bytes Size in bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle circular references in objects
   * @param obj Object to process
   * @returns Processed object with circular references marked
   */
  private handleCircularReferences(obj: any): any {
    const cache = new WeakSet();
    
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      // Skip ignored keys
      if (this.config.ignoreKeys.includes(key)) {
        return undefined;
      }
      
      // Skip functions if configured
      if (this.config.ignoreFunctions && typeof value === 'function') {
        return '[Function]';
      }
      
      // Handle cyclical objects
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular Reference]';
        }
        cache.add(value);
      }
      
      return value;
    }));
  }

  /**
   * Deep clone an object with special handling for functions, etc.
   * @param obj Object to clone
   * @returns Deep cloned object
   */
  private deepClone(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Skip ignored keys
        if (this.config.ignoreKeys.includes(key)) {
          continue;
        }
        
        const value = obj[key];
        
        // Handle functions
        if (typeof value === 'function') {
          if (this.config.ignoreFunctions) {
            result[key] = '[Function]';
          } else {
            result[key] = value.toString();
          }
          continue;
        }
        
        // Handle objects
        if (typeof value === 'object' && value !== null) {
          result[key] = this.deepClone(value);
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Add a state entry with buffer management
   * @param entry State entry to add
   */
  private addStateEntry(entry: StateEntry): void {
    // Apply buffer management if needed
    if (this.states.length >= this.config.maxEntries) {
      // Remove oldest entries (20% at a time for efficiency)
      const itemsToRemove = Math.ceil(this.config.maxEntries * 0.2);
      this.states = this.states.slice(itemsToRemove);
      
      // Also remove corresponding state changes
      const oldestRemainingTimestamp = this.states[0].timestamp;
      this.stateChanges = this.stateChanges.filter(
        change => change.timestamp >= oldestRemainingTimestamp
      );
      
      this.logger.log(
        Tab.State,
        'State history trimmed due to buffer limit',
        { 
          removedEntries: itemsToRemove, 
          remainingEntries: this.states.length 
        },
        Severity.Debug
      );
    }
    
    // Add the new entry
    this.states.push(entry);
  }

  /**
   * Record changes between two state entries
   * @param previous Previous state entry
   * @param current Current state entry
   * @param componentName Component that changed state
   */
  private recordStateChange(
    previous: StateEntry,
    current: StateEntry,
    componentName?: string
  ): void {
    // Skip duplicate comparisons to avoid redundant processing
    const comparisonKey = `${previous.id}:${current.id}`;
    if (
      this.lastComparison && 
      this.lastComparison.previous === previous.id && 
      this.lastComparison.current === current.id
    ) {
      return;
    }
    
    // Update last comparison
    this.lastComparison = {
      previous: previous.id,
      current: current.id,
      timestamp: Date.now()
    };
    
    try {
      // Calculate changes between states
      const changes = this.calculateChanges(previous.state, current.state);
      
      // Only record if there are actually changes
      if (Object.keys(changes).length > 0) {
        const changeEntry: StateChangeEntry = {
          id: this.generateStateId('change'),
          timestamp: current.timestamp,
          previousStateId: previous.id,
          currentStateId: current.id,
          changes,
          componentName,
          actionName: current.name
        };
        
        this.stateChanges.push(changeEntry);
        
        // Log significant state changes
        if (Object.keys(changes).length > 5) {
          this.logger.log(
            Tab.State,
            `Significant state change in ${componentName || 'application'}`,
            { 
              actionName: current.name,
              changedProperties: Object.keys(changes).length,
              timestamp: current.timestamp,
              changeId: changeEntry.id
            },
            Severity.Info
          );
        }
      }
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error calculating state changes',
        { error, previousState: previous.id, currentState: current.id },
        Severity.Error
      );
    }
  }

  /**
   * Calculate changes between previous and current state
   * @param previous Previous state
   * @param current Current state
   * @returns Record of changes with previous and current values
   */
  private calculateChanges(
    previous: any, 
    current: any
  ): Record<string, { previous: any; current: any }> {
    const changes: Record<string, { previous: any; current: any }> = {};
    
    // Use the appropriate diff algorithm based on configuration
    if (this.config.diffAlgorithm === 'shallow' || 
        (this.config.diffAlgorithm === 'auto' && this.isLargeObject(current))) {
      // Use faster shallow comparison for large objects
      return this.calculateShallowChanges(previous, current);
    } else {
      // Use more comprehensive deep comparison
      return this.calculateDeepChanges(previous, current);
    }
  }
  
  /**
   * Calculate shallow changes between states (top-level only)
   * @param previous Previous state
   * @param current Current state
   * @returns Changes at the top level
   */
  private calculateShallowChanges(
    previous: any, 
    current: any
  ): Record<string, { previous: any; current: any }> {
    const changes: Record<string, { previous: any; current: any }> = {};
    
    // Handle edge cases
    if (!previous || !current) {
      if (previous !== current) {
        changes['root'] = { previous, current };
      }
      return changes;
    }
    
    // Check all keys in current state
    for (const key in current) {
      if (this.config.ignoreKeys.includes(key)) continue;
      
      // Only look at own properties
      if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
      
      const currentVal = current[key];
      
      // If key doesn't exist in previous state, it's an addition
      if (!(key in previous)) {
        changes[key] = { previous: undefined, current: currentVal };
        continue;
      }
      
      const previousVal = previous[key];
      
      // Simple equality check for shallow comparison
      if (previousVal !== currentVal) {
        changes[key] = { previous: previousVal, current: currentVal };
      }
    }
    
    // Check for keys that were in previous but removed from current
    for (const key in previous) {
      if (this.config.ignoreKeys.includes(key)) continue;
      
      if (!Object.prototype.hasOwnProperty.call(previous, key)) continue;
      
      if (!(key in current)) {
        changes[key] = { previous: previous[key], current: undefined };
      }
    }
    
    return changes;
  }
  
  /**
   * Calculate deep changes between states (recursive)
   * @param previous Previous state
   * @param current Current state
   * @param path Current property path for nested properties
   * @returns Changes including nested properties
   */
  private calculateDeepChanges(
    previous: any, 
    current: any,
    path: string = ''
  ): Record<string, { previous: any; current: any }> {
    const changes: Record<string, { previous: any; current: any }> = {};
    
    // Handle edge cases
    if (previous === current) return changes;
    
    if (!previous || !current || typeof previous !== 'object' || typeof current !== 'object') {
      if (previous !== current) {
        changes[path || 'root'] = { previous, current };
      }
      return changes;
    }
    
    // Handle arrays
    if (Array.isArray(previous) && Array.isArray(current)) {
      if (previous.length !== current.length) {
        changes[path || 'root'] = {
          previous: `Array(${previous.length})`,
          current: `Array(${current.length})`
        };
      } else {
        // For arrays of the same length, check individual elements
        for (let i = 0; i < current.length; i++) {
          const nestedPath = path ? `${path}[${i}]` : `[${i}]`;
          const nestedChanges = this.calculateDeepChanges(previous[i], current[i], nestedPath);
          Object.assign(changes, nestedChanges);
        }
      }
      return changes;
    }
    
    // Check all keys in current state
    for (const key in current) {
      if (this.config.ignoreKeys.includes(key)) continue;
      
      // Only look at own properties
      if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
      
      const nestedPath = path ? `${path}.${key}` : key;
      const currentVal = current[key];
      
      // If key doesn't exist in previous state, it's an addition
      if (!(key in previous)) {
        changes[nestedPath] = { previous: undefined, current: currentVal };
        continue;
      }
      
      const previousVal = previous[key];
      
      // If both values are objects, recurse
      if (
        typeof previousVal === 'object' && previousVal !== null &&
        typeof currentVal === 'object' && currentVal !== null
      ) {
        const nestedChanges = this.calculateDeepChanges(previousVal, currentVal, nestedPath);
        Object.assign(changes, nestedChanges);
      } 
      // Otherwise compare directly
      else if (previousVal !== currentVal) {
        changes[nestedPath] = { previous: previousVal, current: currentVal };
      }
    }
    
    // Check for keys that were in previous but removed from current
    for (const key in previous) {
      if (this.config.ignoreKeys.includes(key)) continue;
      
      if (!Object.prototype.hasOwnProperty.call(previous, key)) continue;
      
      if (!(key in current)) {
        const nestedPath = path ? `${path}.${key}` : key;
        changes[nestedPath] = { previous: previous[key], current: undefined };
      }
    }
    
    return changes;
  }

  /**
   * Check if an object is large enough to use shallow comparison
   * @param obj Object to check
   * @returns True if object is large
   */
  private isLargeObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    // Use key count as a simple heuristic
    if (Array.isArray(obj)) return obj.length > 100;
    
    return Object.keys(obj).length > 50;
  }

  /**
   * Generate a unique ID for state entries
   * @param prefix Optional prefix for the ID
   * @returns Unique ID string
   */
  private generateStateId(prefix: string = 'state'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get all state entries
   * @returns Array of state entries
   */
  getStates(): StateEntry[] {
    return [...this.states];
  }

  /**
   * Get all state change entries
   * @returns Array of state change entries
   */
  getStateChanges(): StateChangeEntry[] {
    return [...this.stateChanges];
  }

  /**
   * Get a specific state by ID
   * @param stateId ID of the state to retrieve
   * @returns State entry or undefined if not found
   */
  getStateById(stateId: string): StateEntry | undefined {
    return this.states.find(state => state.id === stateId);
  }

  /**
   * Get state changes by component name
   * @param componentName Name of the component
   * @returns Array of state changes for that component
   */
  getStateChangesByComponent(componentName: string): StateChangeEntry[] {
    return this.stateChanges.filter(change => change.componentName === componentName);
  }

  /**
   * Compare two states by their IDs
   * @param stateId1 First state ID
   * @param stateId2 Second state ID
   * @returns Changes between the states or null if states not found
   */
  compareStates(stateId1: string, stateId2: string): Record<string, { previous: any; current: any }> | null {
    const state1 = this.getStateById(stateId1);
    const state2 = this.getStateById(stateId2);
    
    if (!state1 || !state2) {
      this.logger.log(
        Tab.State,
        'Cannot compare states: one or both states not found',
        { stateId1, stateId2 },
        Severity.Warn
      );
      return null;
    }
    
    try {
      return this.calculateChanges(state1.state, state2.state);
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error comparing states',
        { error, stateId1, stateId2 },
        Severity.Error
      );
      return null;
    }
  }

  /**
   * Set active state for time-travel debugging
   * @param stateId ID of the state to activate
   * @returns True if successful, false otherwise
   */
  setActiveState(stateId: string): boolean {
    if (!this.config.enableTimeTravelDebugging) {
      this.logger.log(
        Tab.State,
        'Time travel debugging is not enabled',
        {},
        Severity.Warn
      );
      return false;
    }
    
    const state = this.getStateById(stateId);
    if (!state) {
      this.logger.log(
        Tab.State,
        'Cannot set active state: state not found',
        { stateId },
        Severity.Warn
      );
      return false;
    }
    
    this.activeStateId = stateId;
    
    this.logger.log(
      Tab.State,
      'Active state changed',
      { 
        stateId,
        stateName: state.name,
        timestamp: state.timestamp
      },
      Severity.Info
    );
    
    return true;
  }

  /**
   * Get the currently active state
   * @returns Active state entry or undefined if none
   */
  getActiveState(): StateEntry | undefined {
    if (!this.activeStateId) return undefined;
    return this.getStateById(this.activeStateId);
  }

  /**
   * Enable or disable state history recording
   * @param enabled Whether state history should be enabled
   */
  setStateHistoryEnabled(enabled: boolean): void {
    this.stateHistoryEnabled = enabled;
    
    this.logger.log(
      Tab.State,
      `State history ${enabled ? 'enabled' : 'disabled'}`,
      {},
      Severity.Info
    );
  }

  /**
   * Clear all state history
   */
  clearStateHistory(): void {
    const stateCount = this.states.length;
    const changeCount = this.stateChanges.length;
    
    this.states = [];
    this.stateChanges = [];
    this.activeStateId = null;
    
    this.logger.log(
      Tab.State,
      'State history cleared',
      { stateCount, changeCount },
      Severity.Info
    );
  }

  /**
   * Start automatic state snapshots at regular intervals
   */
  private startAutomaticSnapshots(): void {
    // Clean up any existing interval
    this.stopAutomaticSnapshots();
    
    // Set up new interval
    this.snapshotIntervalId = window.setInterval(() => {
      // This method relies on external code calling recordState
      // with the current application state
      this.logger.log(
        Tab.State,
        'Automatic snapshot interval triggered',
        { frequency: this.config.snapshotFrequency },
        Severity.Debug
      );
    }, this.config.snapshotFrequency);
    
    this.logger.log(
      Tab.State,
      'Automatic state snapshots started',
      { frequencyMs: this.config.snapshotFrequency },
      Severity.Info
    );
  }

  /**
   * Stop automatic state snapshots
   */
  private stopAutomaticSnapshots(): void {
    if (this.snapshotIntervalId !== null) {
      window.clearInterval(this.snapshotIntervalId);
      this.snapshotIntervalId = null;
      
      this.logger.log(
        Tab.State,
        'Automatic state snapshots stopped',
        {},
        Severity.Info
      );
    }
  }

  /**
   * Save state history to localStorage if configured
   */
  private saveStateHistory(): void {
    if (!this.config.persistStateHistory) return;
    
    try {
      // Only save a limited number of recent states to avoid storage limits
      const recentStates = this.states.slice(-20);
      const recentChanges = this.stateChanges.slice(-50);
      
      const saveData = {
        states: recentStates,
        changes: recentChanges,
        activeStateId: this.activeStateId,
        savedAt: Date.now()
      };
      
      localStorage.setItem('debugStateHistory', JSON.stringify(saveData));
      
      this.logger.log(
        Tab.State,
        'State history saved to localStorage',
        { 
          stateCount: recentStates.length,
          changeCount: recentChanges.length 
        },
        Severity.Debug
      );
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error saving state history',
        { error },
        Severity.Error
      );
    }
  }

  /**
   * Load state history from localStorage if configured
   */
  private loadStateHistory(): void {
    if (!this.config.persistStateHistory) return;
    
    try {
      const savedData = localStorage.getItem('debugStateHistory');
      if (!savedData) return;
      
      const data = JSON.parse(savedData);
      
      // Only load if data is recent (less than 1 hour old)
      const ONE_HOUR = 60 * 60 * 1000;
      if (Date.now() - data.savedAt > ONE_HOUR) {
        this.logger.log(
          Tab.State,
          'Saved state history expired, not loading',
          { savedAt: new Date(data.savedAt).toISOString() },
          Severity.Info
        );
        return;
      }
      
      this.states = data.states || [];
      this.stateChanges = data.changes || [];
      this.activeStateId = data.activeStateId;
      
      this.logger.log(
        Tab.State,
        'State history loaded from localStorage',
        { 
          stateCount: this.states.length,
          changeCount: this.stateChanges.length 
        },
        Severity.Info
      );
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error loading state history',
        { error },
        Severity.Error
      );
    }
  }

  /**
   * Subscribe to state changes
   * @param key Subscription key
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  subscribe(key: string, callback: (state: any) => void): () => void {
    if (!this.stateSubscriptions.has(key)) {
      this.stateSubscriptions.set(key, new Set());
    }
    
    this.stateSubscriptions.get(key)!.add(callback);
    
    return () => {
      const callbacks = this.stateSubscriptions.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stateSubscriptions.delete(key);
        }
      }
    };
  }

  /**
   * Notify subscribers of state changes
   * @param entry The state entry to send to subscribers
   */
  private notifySubscribers(entry: StateEntry): void {
    try {
      // Notify global subscribers
      const globalCallbacks = this.stateSubscriptions.get('global') || new Set();
      globalCallbacks.forEach(callback => {
        try {
          callback(entry.state);
        } catch (error) {
          this.logger.log(
            Tab.State,
            'Error in global state subscriber callback',
            { error },
            Severity.Error
          );
        }
      });
      
      // Notify component-specific subscribers
      if (entry.componentName) {
        const componentCallbacks = this.stateSubscriptions.get(entry.componentName) || new Set();
        componentCallbacks.forEach(callback => {
          try {
            callback(entry.state);
          } catch (error) {
            this.logger.log(
              Tab.State,
              `Error in component "${entry.componentName}" state subscriber callback`,
              { error },
              Severity.Error
            );
          }
        });
      }
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error notifying state subscribers',
        { error },
        Severity.Error
      );
    }
  }

  /**
   * Get a history of states for a specific component
   * @param componentName Component name to filter by
   * @returns Array of state entries for that component
   */
  getComponentStateHistory(componentName: string): StateEntry[] {
    return this.states.filter(entry => entry.componentName === componentName);
  }

  /**
   * Get the most recent state for a component
   * @param componentName Component name
   * @returns Most recent state entry or undefined
   */
  getLatestComponentState(componentName: string): StateEntry | undefined {
    const componentStates = this.getComponentStateHistory(componentName);
    if (componentStates.length === 0) return undefined;
    
    return componentStates[componentStates.length - 1];
  }

  /**
   * Export state history to JSON for download
   * @returns JSON string with state history
   */
  exportStateHistory(): string {
    try {
      const exportData = {
        states: this.states,
        stateChanges: this.stateChanges,
        exportedAt: Date.now(),
        config: this.config
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error exporting state history',
        { error },
        Severity.Error
      );
      return JSON.stringify({ error: 'Failed to export state history' });
    }
  }

  /**
   * Import state history from JSON
   * @param jsonData JSON string with state history
   * @returns True if successful, false otherwise
   */
  importStateHistory(jsonData: string): boolean {
    try {
      const importedData = JSON.parse(jsonData);
      
      if (!importedData.states || !Array.isArray(importedData.states)) {
        this.logger.log(
          Tab.State,
          'Invalid state history data: missing states array',
          {},
          Severity.Error
        );
        return false;
      }
      
      // Replace current state history
      this.states = importedData.states;
      this.stateChanges = importedData.stateChanges || [];
      
      if (importedData.states.length > 0) {
        this.activeStateId = importedData.states[importedData.states.length - 1].id;
      }
      
      this.logger.log(
        Tab.State,
        'State history imported',
        { 
          stateCount: this.states.length,
          changeCount: this.stateChanges.length,
          importedAt: new Date(importedData.exportedAt).toISOString()
        },
        Severity.Info
      );
      
      return true;
    } catch (error) {
      this.logger.log(
        Tab.State,
        'Error importing state history',
        { error },
        Severity.Error
      );
      return false;
    }
  }

  /**
   * Dispose of the StateMonitor and clean up resources
   */
  dispose(): void {
    // Stop automatic snapshots
    this.stopAutomaticSnapshots();
    
    // Save state history if configured
    if (this.config.persistStateHistory) {
      this.saveStateHistory();
    }
    
    // Clear all subscriptions
    this.stateSubscriptions.clear();
    
    this.logger.log(
      Tab.State,
      'StateMonitor disposed',
      {},
      Severity.Info
    );
  }
}