# Enterprise Debug Toolkit

A comprehensive debugging toolkit for React applications, specifically designed for the One More Thing Insights application.

## Overview

This debugging toolkit provides advanced monitoring and troubleshooting capabilities for various aspects of the application:

- **File System Monitoring**: Track file operations including selection, upload, and processing
- **API/Network Monitoring**: Intercept and analyze all network requests
- **State Management Debugging**: Track state changes and compare snapshots
- **Performance Monitoring**: Record performance metrics and detect issues
- **Event Tracking**: Monitor user interactions and generate test scripts
- **Error Analysis**: Capture errors with context and suggest fixes

## Files

- `debugTypes.ts` - TypeScript definitions for the debugging system
- `DebugLogger.ts` - Central logging and analytics system
- `EnterpriseAnalysisDebugger.tsx` - Main debug console component
- `NetworkMonitor.ts` - API request tracking
- `StateMonitor.ts` - Application state monitoring
- `PerformanceMonitor.ts` - Performance metrics collection
- `EventMonitor.ts` - User interaction tracking
- `FileSystemMonitor.ts` - File operation monitoring
- `index.ts` - Main entry point and toolkit initialization

## Integration

### 1. Add Dependencies

Make sure your project includes these dependencies:
- React
- React Virtualized (for log virtualization)
- TypeScript (for type safety)

### 2. Import Components

Add the debug components to your `Debug` folder, then import and use the main debugger in your App:

```jsx
// In App.js
import { EnterpriseAnalysisDebugger, debugToolkit } from './components/Debug';

// Initialize toolkit when app starts
useEffect(() => {
  debugToolkit.initialize();
  
  return () => {
    debugToolkit.shutdown();
  };
}, []);

// Then in your render method:
return (
  <div>
    {/* Your app components */}
    
    {showDebugger && (
      <EnterpriseAnalysisDebugger
        selectedFile={selectedFile}
        isButtonEnabled={!!selectedFile && !loading}
        loading={loading}
        analyzeButtonRef={analyzeButtonRef}
        analyses={analyses}
        applicationState={{
          language,
          analysisType,
          streamMode,
          settings,
          exportFormat
          // Other relevant state
        }}
        networkRequests={[]} // Populated automatically when using NetworkMonitor
        modelConfig={{
          selectedModel,
          streamMode,
          analysisType,
          progressStatus
        }}
      />
    )}
  </div>
);
```

### 3. Use Individual Monitors

You can use the individual monitoring components throughout your application:

```jsx
// In a component file
import { debugToolkit } from './components/Debug';

function MyComponent() {
  // Track file selection
  const handleFileSelect = (file) => {
    debugToolkit.fileSystem.trackFileSelection(file);
    // Your existing code...
  };
  
  // Track performance
  const handleAnalyze = async () => {
    const endMeasure = debugToolkit.performance.startMeasure('fileAnalysis', { fileType: 'log' });
    try {
      await analyzeFile();
      endMeasure(); // Record successful completion
    } catch (error) {
      endMeasure(); // Still record timing even on error
      throw error;
    }
  };
  
  // Track state changes
  useEffect(() => {
    if (selectedFile) {
      const stateId = debugToolkit.state.recordState({ selectedFile, analyses });
      // You can compare with previous states later
    }
  }, [selectedFile, analyses]);
  
  // Log custom events
  const handleCustomAction = () => {
    debugToolkit.logger.log('Events', 'Custom action performed', { metadata: 'value' }, 'Info');
  };
  
  // Return your component...
}
```

## Debug Console Features

### Key Tabs

- **Dashboard**: Overview of all debugging information
- **FileSystem**: File upload monitoring and diagnostics
- **Analysis**: Tracks analysis operations and model usage
- **State**: Application state inspection
- **Events**: User interaction monitoring
- **Network**: API request tracking
- **Performance**: Performance metrics visualization
- **Errors**: Comprehensive error logging
- **Fixes**: Automatic fix suggestions
- **Analytics**: Usage statistics

### Keyboard Shortcuts

- `Alt+1` through `Alt+9`: Switch between tabs
- `Ctrl+Shift+D`: Toggle expanded/collapsed view
- `/`: Focus the search input when expanded

## Advanced Usage

### Recording User Sessions

To record and replay user sessions for debugging:

```jsx
// Start recording
debugToolkit.events.startRecording();

// Later when an error occurs:
debugToolkit.events.captureEventsBeforeError();

// Get a test script from the recorded events
const testScript = debugToolkit.events.generateTestScript();
console.log(testScript);
```

### Network Request Tracking

The NetworkMonitor automatically intercepts all fetch and XHR requests. You can also manually track requests:

```jsx
// Manually track a request
const requestId = debugToolkit.network.trackRequest('/api/analyze', 'POST', payload);

// Later, update the request status
debugToolkit.network.completeRequest(requestId, response, 200, responseTime);
// Or if it failed:
debugToolkit.network.failRequest(requestId, error);
```

### Measuring Performance

```jsx
// Measure a specific operation
const endMeasure = debugToolkit.performance.startMeasure('operationName', { additionalData: value });
// Do work...
endMeasure();

// Measure a promise
const result = await debugToolkit.performance.measurePromise('apiCall', fetch('/api/data'));
```

## Best Practices

1. **Environment Control**: Only show the debugger in development or when explicitly enabled
2. **Performance Considerations**: The debugger itself consumes resources, so disable in production
3. **Sensitive Data**: Be careful not to log sensitive user data or credentials
4. **Extended Logging**: Increase logging detail during development or troubleshooting
5. **Fix Suggestions**: Review and test fix suggestions before applying them

## Extending the Toolkit

To add custom monitoring components:

1. Define your interfaces in `debugTypes.ts`
2. Create your monitor implementation
3. Add it to the `DebugToolkit` class in `index.ts`
4. Update the EnterpriseAnalysisDebugger to display your new data

## Troubleshooting

If you encounter issues with the debugger:

1. Check browser console for errors
2. Verify that all components are correctly imported
3. Ensure React Virtualized is properly installed
4. Check if you're using outdated references to the debug tools