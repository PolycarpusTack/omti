/**
 * Debug Toolkit Index
 * 
 * This file exports all components of the debugging toolkit for easy imports
 */

// Type definitions
export * from './debugTypes';

// Main debugger component
export { default as EnterpriseAnalysisDebugger } from './EnterpriseAnalysisDebugger';

// Core utilities
export { DebugLogger } from './DebugLogger';
export { NetworkMonitorImpl } from './NetworkMonitor';
export { EnhancedNetworkMonitor } from './EnhancedNetworkMonitor'; // Export the enhanced version
export { StateMonitorImpl } from './StateMonitor';
export { PerformanceMonitorImpl } from './PerformanceMonitor';
export { EventMonitor } from './EventMonitor';
export { FileSystemMonitor } from './FileSystemMonitor';

// API Tracing utilities
export { 
  ApiTracer, 
  withDebugContext, 
  useDebugLifecycle, 
  debugFetch, 
  createAxiosInterceptors,
  useDebugDataFetch
} from './ApiTracer';

// API Debug Panel
export { default as ApiDebugPanel } from './ApiDebugPanel';

// Create a debug toolkit object with all components
/**
 * Debug toolkit with all monitoring components
 */
export class DebugToolkit {
  private static instance: DebugToolkit | null = null;
  
  logger: DebugLogger;
  network: EnhancedNetworkMonitor; // Using the enhanced version
  state: StateMonitorImpl;
  performance: PerformanceMonitorImpl;
  events: EventMonitor;
  fileSystem: FileSystemMonitor;
  apiTracer: ApiTracer; // Add API tracer
  
  // Singleton pattern
  static getInstance(): DebugToolkit {
    if (!DebugToolkit.instance) {
      DebugToolkit.instance = new DebugToolkit();
    }
    return DebugToolkit.instance;
  }
  
  private constructor() {
    // Initialize all components
    this.logger = DebugLogger.getInstance();
    this.network = new EnhancedNetworkMonitor(); // Use enhanced network monitor
    this.state = new StateMonitorImpl();
    this.performance = new PerformanceMonitorImpl();
    this.events = new EventMonitor();
    this.fileSystem = new FileSystemMonitor();
    this.apiTracer = ApiTracer.getInstance(); // Initialize API tracer
  }
  
  /**
   * Initialize all monitoring components
   */
  initialize(): void {
    // Install network interceptors
    this.network.installInterceptors();
    
    // Start event monitoring
    this.events.startMonitoring();
    
    this.logger.log(
      'Dashboard', 
      'Debug toolkit initialized', 
      {}, 
      'Info'
    );
  }
  
  /**
   * Shutdown monitoring components
   */
  shutdown(): void {
    // Stop event monitoring
    this.events.stopMonitoring();
    
    this.logger.log(
      'Dashboard', 
      'Debug toolkit shutdown', 
      {}, 
      'Info'
    );
  }
}

// Export a pre-initialized instance for convenience
export const debugToolkit = DebugToolkit.getInstance();