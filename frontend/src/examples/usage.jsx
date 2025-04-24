// src/examples/usage.jsx
import React, { useState } from 'react';
import { 
  ErrorBoundary, 
  GlobalErrorBoundary, 
  FeatureErrorBoundary,
  WidgetErrorBoundary,
  withErrorBoundary,
  useErrorControl,
  safeLazy,
  throwTestError
} from '../components/ErrorBoundary';
import { useErrorReporting } from '../services/errorLogging';

/**
 * Example 1: Basic application-wide error boundary
 */
function App() {
  return (
    <GlobalErrorBoundary>
      <AppContent />
    </GlobalErrorBoundary>
  );
}

/**
 * Example 2: Feature-level error isolation
 */
function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {/* Protected feature area */}
      <FeatureErrorBoundary>
        <DashboardMetrics />
      </FeatureErrorBoundary>
      
      <div className="dashboard-widgets">
        {/* Each widget gets its own boundary */}
        <WidgetErrorBoundary>
          <RevenueWidget />
        </WidgetErrorBoundary>
        
        <WidgetErrorBoundary>
          <UserActivityWidget />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

/**
 * Example 3: Triggering errors manually
 */
function UserProfile() {
  const { throwBoundaryError } = useErrorControl();
  const { reportError } = useErrorReporting();
  
  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        // Option 1: Report to monitoring without crashing UI
        reportError(
          new Error(`Failed to delete account: ${response.status}`),
          { endpoint: '/api/user/delete', userId: 'current' }
        );
        
        // Option 2: Crash component and show error UI
        if (response.status === 403) {
          throwBoundaryError(
            new Error('You do not have permission to delete this account')
          );
        }
      }
    } catch (error) {
      throwBoundaryError(error);
    }
  };
  
  return (
    <div>
      <h2>User Profile</h2>
      <button onClick={handleDeleteAccount}>Delete Account</button>
    </div>
  );
}

/**
 * Example 4: Using withErrorBoundary HOC
 */
function DataChart({ data }) {
  // Potentially error-prone rendering logic
  return (
    <div className="chart">
      {data.map((item, index) => (
        <div key={index} style={{ height: `${item.value}px` }}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

// Create protected version with custom props
const SafeDataChart = withErrorBoundary(DataChart, {
  name: 'ChartBoundary',
  FallbackComponent: ({ resetErrorBoundary }) => (
    <div className="chart-error">
      <p>Unable to display chart</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  )
});

/**
 * Example 5: Safe code-splitting with error handling
 */
const AdminPanel = safeLazy(
  () => import('./AdminPanel'),
  {
    name: 'AdminPanel',
    fallback: <div className="loading">Loading admin panel...</div>,
    retryLimit: 2,
    reportToServer: true
  }
);

/**
 * Example 6: Complex nested boundary configuration
 */
function ApplicationShell() {
  return (
    <GlobalErrorBoundary 
      FallbackComponent={({ resetErrorBoundary }) => (
        <div className="app-error">
          <h1>Application Error</h1>
          <p>The application has encountered a critical error.</p>
          <button onClick={resetErrorBoundary}>Restart Application</button>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      )}
      onError={(error, info) => {
        // Log to analytics
        window.analytics?.track('Fatal Application Error', {
          error: error.message,
          stack: error.stack
        });
      }}
    >
      <Router>
        <Route path="/" element={<Home />} />
        <Route 
          path="/dashboard" 
          element={
            <FeatureErrorBoundary 
              name="DashboardBoundary"
              metadata={{ section: 'dashboard' }}
            >
              <Dashboard />
            </FeatureErrorBoundary>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <FeatureErrorBoundary name="ProfileBoundary">
              <UserProfile />
            </FeatureErrorBoundary>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <AdminPanel />
            </React.Suspense>
          } 
        />
      </Router>
    </GlobalErrorBoundary>
  );
}

/**
 * Integration Example: Application entry point
 */
function RootApplication() {
  // Initialize necessary providers
  return (
    <ConfigProvider>
      <AuthProvider>
        <ThemeProvider>
          <LocaleProvider>
            {/* Global error boundary catches everything */}
            <GlobalErrorBoundary>
              <ApplicationShell />
              
              {/* Developer tools in development only */}
              {process.env.NODE_ENV === 'development' && (
                <DevTools>
                  <ErrorTester />
                </DevTools>
              )}
            </GlobalErrorBoundary>
          </LocaleProvider>
        </ThemeProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}

/**
 * Development Error Testing Tool
 */
function ErrorTester() {
  const [errorType, setErrorType] = useState('render');
  const { throwBoundaryError } = useErrorControl();
  
  const triggerError = () => {
    switch (errorType) {
      case 'render':
        throwTestError('Render error test');
        break;
      case 'async':
        setTimeout(() => {
          throwBoundaryError(new Error('Async error test'));
        }, 100);
        break;
      case 'fetch':
        throwBoundaryError(
          new Error('Fetch error test')
        );
        break;
      default:
        throwBoundaryError(new Error('Unknown error type'));
    }
  };
  
  return (
    <div className="error-tester">
      <h3>Error Testing Panel</h3>
      <select
        value={errorType}
        onChange={(e) => setErrorType(e.target.value)}
      >
        <option value="render">Render Error</option>
        <option value="async">Async Error</option>
        <option value="fetch">Fetch Error</option>
      </select>
      <button onClick={triggerError}>Trigger Error</button>
    </div>
  );
}

// Export all examples for documentation
export {
  App,
  Dashboard,
  UserProfile,
  DataChart,
  SafeDataChart,
  AdminPanel,
  ApplicationShell,
  RootApplication,
  ErrorTester
};