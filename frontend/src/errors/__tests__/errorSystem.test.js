// @ts-check
import { 
    ApplicationError, 
    ValidationError, 
    NotFoundError,
    AuthenticationError,
    RateLimitError,
    BusinessError,
    ErrorSeverity,
    ErrorCategory
  } from './errors';
  
  describe('Enterprise Error System', () => {
    describe('ApplicationError', () => {
      test('creates basic error with defaults', () => {
        const error = new ApplicationError('Something went wrong');
        
        expect(error.name).toBe('ApplicationError');
        expect(error.message).toBe('Something went wrong');
        expect(error.statusCode).toBe(500);
        expect(error.isRetryable).toBe(true);
        expect(error.severity).toBe(ErrorSeverity.ERROR);
        expect(error.category).toBe(ErrorCategory.BUSINESS);
        expect(error.timestamp).toBeDefined();
        expect(error.errorCode).toMatch(/^APP_[\w\d]+_[\w\d]+$/);
      });
      
      test('includes all provided options', () => {
        const cause = new Error('Original error');
        const context = { userId: '123', operation: 'update' };
        const validationErrors = [{ field: 'email', message: 'Invalid format' }];
        
        const error = new ApplicationError('Data error', {
          statusCode: 400,
          cause,
          context,
          validationErrors,
          isRetryable: false,
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.DATA,
          transactionId: 'txn-123',
          requestId: 'req-456',
          retryAfter: 5000
        });
        
        expect(error.statusCode).toBe(400);
        expect(error.cause).toBe(cause);
        expect(error.context).toEqual(context);
        expect(error.validationErrors).toEqual(validationErrors);
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.DATA);
        expect(error.transactionId).toBe('txn-123');
        expect(error.requestId).toBe('req-456');
        expect(error.retryAfter).toBe(5000);
      });
      
      test('sanitizes sensitive context data', () => {
        const context = {
          userId: '123',
          password: 'secret123',
          apiKey: 'key-abc',
          token: 'jwt-token',
          settings: {
            secretKey: 'hidden-value'
          },
          normalData: 'visible'
        };
        
        const error = new ApplicationError('Auth error', { context });
        
        expect(error.context.userId).toBe('123');
        expect(error.context.password).toBe('[REDACTED]');
        expect(error.context.apiKey).toBe('[REDACTED]');
        expect(error.context.token).toBe('[REDACTED]');
        expect(error.context.settings.secretKey).toBe('[REDACTED]');
        expect(error.context.normalData).toBe('visible');
      });
      
      test('captures causal chain in stack', () => {
        const originalError = new Error('Database connection failed');
        const middleError = new Error('Query execution failed');
        middleError.cause = originalError;
        
        const error = new ApplicationError('Data retrieval failed', {
          cause: middleError
        });
        
        expect(error.stack).toContain('Data retrieval failed');
        expect(error.stack).toContain('Caused by: Error: Query execution failed');
        expect(error.stack).toContain('Database connection failed');
      });
      
      test('serializes to JSON correctly', () => {
        const error = new ApplicationError('API error', {
          statusCode: 503,
          context: { service: 'payment' },
          errorCode: 'SVC_UNAVAILABLE'
        });
        
        const json = error.toJSON();
        
        expect(json.name).toBe('ApplicationError');
        expect(json.message).toBe('API error');
        expect(json.statusCode).toBe(503);
        expect(json.context).toEqual({ service: 'payment' });
        expect(json.errorCode).toBe('SVC_UNAVAILABLE');
        // Stack should not be included in JSON
        expect(json.stack).toBeUndefined();
      });
      
      test('generates string representation with context', () => {
        const error = new ApplicationError('Database error', {
          statusCode: 500,
          context: { table: 'users', operation: 'insert' },
          transactionId: 'txn-abc123'
        });
        
        const str = error.toString();
        
        expect(str).toContain('ApplicationError');
        expect(str).toContain('Database error');
        expect(str).toContain('(500)');
        expect(str).toContain('[txn:txn-abc123]');
        expect(str).toContain('Context:');
        expect(str).toContain('table');
        expect(str).toContain('users');
      });
    });
    
    describe('Domain-specific errors', () => {
      test('ValidationError sets correct defaults', () => {
        const validationErrors = [
          { field: 'email', message: 'Invalid format' },
          { field: 'password', message: 'Too short' }
        ];
        
        const error = new ValidationError('Invalid input', { validationErrors });
        
        expect(error.name).toBe('ValidationError');
        expect(error.statusCode).toBe(400);
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.INPUT);
        expect(error.validationErrors).toEqual(validationErrors);
      });
      
      test('NotFoundError formats message with resource info', () => {
        const error = new NotFoundError('User', '12345');
        
        expect(error.message).toBe('User not found: 12345');
        expect(error.statusCode).toBe(404);
        expect(error.isRetryable).toBe(false);
        expect(error.context.resourceType).toBe('User');
        expect(error.context.resourceId).toBe('12345');
        expect(error.resourceInfo.type).toBe('User');
        expect(error.resourceInfo.id).toBe('12345');
      });
      
      test('AuthenticationError sets correct defaults', () => {
        const error = new AuthenticationError();
        
        expect(error.message).toBe('Authentication failed');
        expect(error.statusCode).toBe(401);
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.SECURITY);
      });
      
      test('RateLimitError includes retry information', () => {
        const error = new RateLimitError('API rate limit exceeded', {
          retryAfter: 30000
        });
        
        expect(error.statusCode).toBe(429);
        expect(error.isRetryable).toBe(true);
        expect(error.retryAfter).toBe(30000);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.INFRASTRUCTURE);
      });
      
      test('BusinessError has correct defaults', () => {
        const error = new BusinessError('Cannot delete active account');
        
        expect(error.statusCode).toBe(422);
        expect(error.isRetryable).toBe(false);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.BUSINESS);
      });
    });
    
    describe('Factory methods', () => {
      test('fromApiError creates appropriate error from API response', () => {
        const originalError = {
          response: {
            status: 400,
            data: {
              message: 'Validation failed',
              validationErrors: [
                { field: 'email', message: 'Invalid email' }
              ]
            },
            headers: {
              'x-request-id': 'req-123',
              'retry-after': '30'
            }
          },
          config: {
            url: 'https://api.example.com/users',
            method: 'POST'
          }
        };
        
        const error = ApplicationError.fromApiError(originalError);
        
        expect(error.message).toBe('Validation failed');
        expect(error.statusCode).toBe(400);
        expect(error.context.url).toBe('https://api.example.com/users');
        expect(error.context.method).toBe('POST');
        expect(error.context.requestId).toBe('req-123');
        expect(error.validationErrors).toEqual([{ field: 'email', message: 'Invalid email' }]);
        expect(error.retryAfter).toBe(30000); // 30 seconds in ms
        expect(error.isRetryable).toBe(false); // 400 is not retryable
      });
      
      test('networkError creates correct error type', () => {
        const originalError = {
          message: 'Network Error',
          code: 'ECONNABORTED',
          config: {
            url: 'https://api.example.com/data'
          }
        };
        
        const error = ApplicationError.networkError(originalError);
        
        expect(error.message).toBe('Network connectivity failure');
        expect(error.statusCode).toBe(0);
        expect(error.context.url).toBe('https://api.example.com/data');
        expect(error.isRetryable).toBe(true);
        expect(error.severity).toBe(ErrorSeverity.ERROR);
        expect(error.category).toBe(ErrorCategory.INFRASTRUCTURE);
      });
      
      test('timeoutError creates correct error type', () => {
        const originalError = {
          message: 'timeout of 5000ms exceeded',
          code: 'ETIMEDOUT',
          config: {
            url: 'https://api.example.com/users',
            timeout: 5000,
            method: 'GET'
          }
        };
        
        const error = ApplicationError.timeoutError(originalError);
        
        expect(error.message).toBe('Request timed out');
        expect(error.statusCode).toBe(0);
        expect(error.context.url).toBe('https://api.example.com/users');
        expect(error.context.timeout).toBe(5000);
        expect(error.context.method).toBe('GET');
        expect(error.isRetryable).toBe(true);
        expect(error.severity).toBe(ErrorSeverity.WARNING);
        expect(error.category).toBe(ErrorCategory.INTEGRATION);
      });
      
      test('serviceUnavailableError creates correct error type', () => {
        const error = ApplicationError.serviceUnavailableError('PaymentGateway', {
          retryAfter: 120000 // 2 minutes
        });
        
        expect(error.message).toBe('Service PaymentGateway is unavailable');
        expect(error.statusCode).toBe(503);
        expect(error.context.service).toBe('PaymentGateway');
        expect(error.isRetryable).toBe(true);
        expect(error.retryAfter).toBe(120000);
        expect(error.severity).toBe(ErrorSeverity.CRITICAL);
        expect(error.category).toBe(ErrorCategory.INFRASTRUCTURE);
      });
    });
    
    describe('ValidationError static methods', () => {
      test('fromFieldErrors generates appropriate validation error', () => {
        const fieldErrors = [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' }
        ];
        
        const error = ValidationError.fromFieldErrors(fieldErrors);
        
        expect(error.message).toBe('Invalid values for 2 fields');
        expect(error.validationErrors).toEqual(fieldErrors);
        expect(error.statusCode).toBe(400);
      });
      
      test('fromFieldErrors handles single field case', () => {
        const fieldErrors = [
          { field: 'email', message: 'Invalid email format' }
        ];
        
        const error = ValidationError.fromFieldErrors(fieldErrors);
        
        expect(error.message).toBe('Invalid value for field: email');
        expect(error.validationErrors).toEqual(fieldErrors);
      });
    });
  });
  
  // Integration examples
  
  describe('Error system integration examples', () => {
    // Express middleware example
    test('Express error middleware formats errors correctly', () => {
      // Mock Express objects
      const err = new ValidationError('Invalid input', {
        validationErrors: [{ field: 'email', message: 'Invalid format' }]
      });
      
      const req = {
        url: '/api/users',
        method: 'POST',
        params: { id: '123' },
        query: { include: 'profile' },
        headers: { 'x-request-id': 'req-abc' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      const next = jest.fn();
      
      // Import the actual middleware
      const { expressErrorHandler } = require('./errors');
      
      // Call middleware
      expressErrorHandler(err, req, res, next);
      
      // Assertions
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'ValidationError',
        message: 'Invalid input',
        validationErrors: [{ field: 'email', message: 'Invalid format' }],
        requestId: 'req-abc'
      }));
    });
    
    // API error handling example
    test('API client error handling', async () => {
      // Mock API client and response
      const mockAxios = {
        get: jest.fn()
      };
      
      // Set up mock implementation
      mockAxios.get.mockImplementation(url => {
        if (url.includes('invalid')) {
          const error = new Error('Request failed');
          error.response = {
            status: 400,
            data: {
              message: 'Invalid parameter',
              validationErrors: [{ field: 'id', message: 'Invalid format' }]
            },
            headers: { 'x-request-id': 'req-123' }
          };
          error.config = { url, method: 'GET' };
          return Promise.reject(error);
        }
        
        if (url.includes('network')) {
          const error = new Error('Network Error');
          error.code = 'ECONNABORTED';
          error.config = { url, method: 'GET' };
          return Promise.reject(error);
        }
        
        if (url.includes('timeout')) {
          const error = new Error('timeout exceeded');
          error.code = 'ETIMEDOUT';
          error.config = { url, method: 'GET', timeout: 5000 };
          return Promise.reject(error);
        }
        
        return Promise.resolve({ data: { id: '123', name: 'Test User' } });
      });
      
      // Client function using our error system
      async function fetchData(url) {
        try {
          const response = await mockAxios.get(url);
          return response.data;
        } catch (error) {
          if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
            throw ApplicationError.networkError(error);
          }
          
          if (error.code === 'ETIMEDOUT') {
            throw ApplicationError.timeoutError(error);
          }
          
          if (error.response) {
            throw ApplicationError.fromApiError(error);
          }
          
          throw new ApplicationError('Unknown API error', { cause: error });
        }
      }
      
      // Test successful request
      const data = await fetchData('/api/users/123');
      expect(data).toEqual({ id: '123', name: 'Test User' });
      
      // Test validation error
      try {
        await fetchData('/api/users/invalid');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.message).toBe('Invalid parameter');
        expect(error.statusCode).toBe(400);
        expect(error.validationErrors).toEqual([{ field: 'id', message: 'Invalid format' }]);
      }
      
      // Test network error
      try {
        await fetchData('/api/users/network');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.message).toBe('Network connectivity failure');
        expect(error.category).toBe(ErrorCategory.INFRASTRUCTURE);
      }
      
      // Test timeout error
      try {
        await fetchData('/api/users/timeout');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.message).toBe('Request timed out');
        expect(error.context.timeout).toBe(5000);
      }
    });
  });