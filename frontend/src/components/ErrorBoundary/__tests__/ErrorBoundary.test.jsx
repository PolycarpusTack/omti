// src/components/ErrorBoundary/__tests__/ErrorBoundary.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';
import { ErrorFallback } from '../ErrorFallback';
import { useErrorBoundary, useErrorControl } from '../ErrorContext';

// Mock the error logging service
jest.mock('../../../services/errorLogging', () => ({
  logErrorToService: jest.fn(),
  reportError: jest.fn()
}));

// Testing components
const ErrorThrower = ({ shouldThrow, message = 'Test error', delay = 0 }) => {
  React.useEffect(() => {
    if (shouldThrow && delay > 0) {
      const timer = setTimeout(() => {
        throw new Error(message);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [shouldThrow, message, delay]);

  if (shouldThrow && delay === 0) {
    throw new Error(message);
  }

  return <div data-testid="normal-component">Normal Component</div>;
};

const ErrorButton = ({ message = 'Button error' }) => {
  const { throwBoundaryError } = useErrorControl();
  return (
    <button
      data-testid="error-button"
      onClick={() => throwBoundaryError(new Error(message))}
    >
      Throw Error
    </button>
  );
};

const ResetButton = () => {
  const { resetBoundary } = useErrorBoundary();
  return (
    <button
      data-testid="reset-button"
      onClick={resetBoundary}
    >
      Reset Boundary
    </button>
  );
};

// Mock console.error to avoid test noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Suppress React error boundary error messages
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (args[0]?.includes?.('Error was caught')) return;
    originalConsoleError(...args);
  });
});

describe('ErrorBoundary', () => {
  describe('Basic functionality', () => {
    test('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child component</div>
        </ErrorBoundary>
      );
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
    
    test('catches errors in children and displays fallback', () => {
      render(
        <ErrorBoundary>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      expect(screen.queryByTestId('normal-component')).not.toBeInTheDocument();
      expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
    });
    
    test('allows retry and resets the error state', async () => {
      let shouldThrow = true;
      
      const TestComponent = () => {
        const [error, setError] = React.useState(shouldThrow);
        
        React.useEffect(() => {
          // Update the component's error state when the outer variable changes
          setError(shouldThrow);
        }, []);
        
        if (error) {
          throw new Error('Test error');
        }
        
        return <div data-testid="recovered">Recovered successfully</div>;
      };
      
      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );
      
      // Initially shows the error
      expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      
      // Prepare for retry
      shouldThrow = false;
      
      // Click retry button
      fireEvent.click(screen.getByText(/Try Again/i));
      
      // Component should recover
      await waitFor(() => {
        expect(screen.getByTestId('recovered')).toBeInTheDocument();
      });
    });
  });
  
  describe('Error reporting', () => {
    test('calls onError prop when an error occurs', () => {
      const handleError = jest.fn();
      
      render(
        <ErrorBoundary onError={handleError}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
    
    test('reports to server when reportToServer is true', () => {
      const { logErrorToService } = require('../../../services/errorLogging');
      
      render(
        <ErrorBoundary reportToServer={true} name="TestBoundary">
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      expect(logErrorToService).toHaveBeenCalledTimes(1);
      expect(logErrorToService).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          boundary: 'TestBoundary',
          context: expect.any(Object),
          componentStack: expect.any(String)
        })
      );
    });
    
    test('does not report to server when reportToServer is false', () => {
      const { logErrorToService } = require('../../../services/errorLogging');
      
      render(
        <ErrorBoundary reportToServer={false}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      expect(logErrorToService).not.toHaveBeenCalled();
    });
  });
  
  describe('Retry mechanism', () => {
    test('disables retry button after reaching retryLimit', async () => {
      const retryLimit = 2;
      
      render(
        <ErrorBoundary retryLimit={retryLimit}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      // First retry
      fireEvent.click(screen.getByText(/Try Again/i));
      expect(screen.getByText(/Try Again/i)).toBeEnabled();
      
      // Second retry
      fireEvent.click(screen.getByText(/Try Again/i));
      
      // Button should be disabled after reaching the limit
      await waitFor(() => {
        expect(screen.getByText(/Max Retries Reached/i)).toBeDisabled();
      });
    });
    
    test('uses exponential backoff when useBackoff is true', async () => {
      jest.useFakeTimers();
      
      const onReset = jest.fn();
      
      render(
        <ErrorBoundary useBackoff={true} onReset={onReset} retryLimit={3}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      // First retry - should happen immediately
      fireEvent.click(screen.getByText(/Try Again/i));
      
      // Wait for the first exponential backoff
      act(() => {
        jest.advanceTimersByTime(100); // First backoff would be ~350ms
      });
      
      expect(onReset).toHaveBeenCalledTimes(1);
      
      // Reset for the next test
      jest.useRealTimers();
    });
    
    test('calls onReset prop when retrying', () => {
      const handleReset = jest.fn();
      
      render(
        <ErrorBoundary onReset={handleReset}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByText(/Try Again/i));
      
      expect(handleReset).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Custom fallback', () => {
    test('renders custom FallbackComponent when provided', () => {
      const CustomFallback = ({ errorDetails, resetErrorBoundary }) => (
        <div data-testid="custom-fallback">
          <h1>Custom Error UI</h1>
          <button onClick={resetErrorBoundary}>Custom Reset</button>
          {errorDetails && <p>{errorDetails.message}</p>}
        </div>
      );
      
      render(
        <ErrorBoundary FallbackComponent={CustomFallback} showDetails={true}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText(/Custom Error UI/i)).toBeInTheDocument();
      expect(screen.getByText(/Custom Reset/i)).toBeInTheDocument();
      expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    });
  });
  
  describe('Context and hooks', () => {
    test('useErrorControl hook allows manual error throwing', async () => {
      render(
        <ErrorBoundary>
          <ErrorButton message="Manual error" />
        </ErrorBoundary>
      );
      
      fireEvent.click(screen.getByTestId('error-button'));
      
      await waitFor(() => {
        expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      });
    });
    
    test('useErrorBoundary hook allows reset from deeply nested components', async () => {
      const NestedComponent = () => {
        const [recovered, setRecovered] = React.useState(false);
        
        React.useEffect(() => {
          if (recovered) {
            throw new Error('Still broken');
          }
        }, [recovered]);
        
        return (
          <>
            <ResetButton />
            <button 
              data-testid="recovered-button"
              onClick={() => setRecovered(true)}
            >
              Mark as recovered
            </button>
          </>
        );
      };
      
      render(
        <ErrorBoundary>
          <ErrorThrower shouldThrow />
          <NestedComponent />
        </ErrorBoundary>
      );
      
      // Error is displayed
      expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      
      // Reset using the nested button
      fireEvent.click(screen.getByTestId('reset-button'));
      
      // Error is cleared
      await waitFor(() => {
        expect(screen.queryByText(/Application Error/i)).not.toBeInTheDocument();
      });
      
      // Trigger another error
      fireEvent.click(screen.getByTestId('recovered-button'));
      
      // Error is displayed again
      await waitFor(() => {
        expect(screen.getByText(/Application Error/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Accessibility', () => {
    test('focuses on error fallback when error occurs and a11yFocus is true', () => {
      render(
        <ErrorBoundary a11yFocus={true}>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      // The error boundary container should have focus
      const errorContainer = screen.getByRole('alert');
      expect(document.activeElement).toBe(errorContainer);
    });
    
    test('has proper ARIA attributes for screen readers', () => {
      render(
        <ErrorBoundary>
          <ErrorThrower shouldThrow />
        </ErrorBoundary>
      );
      
      // Check for appropriate ARIA roles and attributes
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });
  
  describe('Error filtering', () => {
    test('respects shouldCaptureError prop to filter errors', () => {
      const shouldCaptureError = jest.fn(error => error.message !== 'Ignored error');
      const { logErrorToService } = require('../../../services/errorLogging');
      
      render(
        <ErrorBoundary shouldCaptureError={shouldCaptureError} reportToServer={true}>
          <ErrorThrower shouldThrow message="Ignored error" />
        </ErrorBoundary>
      );
      
      expect(shouldCaptureError).toHaveBeenCalled();
      expect(logErrorToService).not.toHaveBeenCalled();
      
      // Render again with an error that should be captured
      jest.clearAllMocks();
      render(
        <ErrorBoundary shouldCaptureError={shouldCaptureError} reportToServer={true}>
          <ErrorThrower shouldThrow message="Captured error" />
        </ErrorBoundary>
      );
      
      expect(shouldCaptureError).toHaveBeenCalled();
      expect(logErrorToService).toHaveBeenCalled();
    });
  });
  
  describe('Remounting behavior', () => {
    test('remounts children when remountOnReset is true', async () => {
      const mount = jest.fn();
      const unmount = jest.fn();
      
      class MountTracker extends React.Component {
        componentDidMount() {
          mount();
        }
        
        componentWillUnmount() {
          unmount();
        }
        
        render() {
          if (this.props.shouldThrow) {
            throw new Error('Test error');
          }
          return <div data-testid="tracked-component">Tracked Component</div>;
        }
      }
      
      const { rerender } = render(
        <ErrorBoundary remountOnReset={true}>
          <MountTracker shouldThrow={true} />
        </ErrorBoundary>
      );
      
      // Initially mounted once
      expect(mount).toHaveBeenCalledTimes(1);
      
      // Update props to not throw
      rerender(
        <ErrorBoundary remountOnReset={true}>
          <MountTracker shouldThrow={false} />
        </ErrorBoundary>
      );
      
      // Click retry
      fireEvent.click(screen.getByText(/Try Again/i));
      
      // Component should be unmounted and remounted
      expect(unmount).toHaveBeenCalledTimes(1);
      expect(mount).toHaveBeenCalledTimes(2);
      
      // Component should be visible after recovery
      await waitFor(() => {
        expect(screen.getByTestId('tracked-component')).toBeInTheDocument();
      });
    });
    
    test('does not remount children when remountOnReset is false', async () => {
      const mount = jest.fn();
      const unmount = jest.fn();
      
      class MountTracker extends React.Component {
        componentDidMount() {
          mount();
        }
        
        componentWillUnmount() {
          unmount();
        }
        
        render() {
          if (this.props.shouldThrow) {
            throw new Error('Test error');
          }
          return <div data-testid="tracked-component">Tracked Component</div>;
        }
      }
      
      const { rerender } = render(
        <ErrorBoundary remountOnReset={false}>
          <MountTracker shouldThrow={true} />
        </ErrorBoundary>
      );
      
      // Initially mounted once
      expect(mount).toHaveBeenCalledTimes(1);
      
      // Update props to not throw
      rerender(
        <ErrorBoundary remountOnReset={false}>
          <MountTracker shouldThrow={false} />
        </ErrorBoundary>
      );
      
      // Click retry
      fireEvent.click(screen.getByText(/Try Again/i));
      
      // Component should not be unmounted
      expect(unmount).not.toHaveBeenCalled();
      // No additional mount (still just the initial one)
      expect(mount).toHaveBeenCalledTimes(1);
      
      // Component should be visible after recovery
      await waitFor(() => {
        expect(screen.getByTestId('tracked-component')).toBeInTheDocument();
      });
    });
  });