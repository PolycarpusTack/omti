// src/examples/apiClientUsage.ts
import { defaultApiClient, ApiClient, GraphQLOperationType } from '../utils/apiClient';
import { timingMiddleware, idempotencyMiddleware, offlineDetectionMiddleware } from '../utils/apiMiddleware';
import { logger } from '../services/logger';
import { metrics } from '../services/metrics';

// Type definitions for API responses
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  imageUrl?: string;
}

interface Order {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Basic usage with typed responses
async function fetchUserProfile(): Promise<User> {
  try {
    const response = await defaultApiClient.get<User>('/users/profile');
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch user profile', { error });
    throw error;
  }
}

// Using the client with pagination and type safety
async function fetchProducts(page: number = 1, pageSize: number = 20, category?: string): Promise<PaginatedResponse<Product>> {
  try {
    const params = {
      page,
      pageSize,
      ...(category ? { category } : {})
    };
    
    const response = await defaultApiClient.get<PaginatedResponse<Product>>('/products', params);
    
    // Log request metadata
    logger.debug('Products fetched', {
      duration: response.meta.duration,
      requestId: response.meta.requestId,
      totalItems: response.data.totalItems
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch products', { error, page, pageSize, category });
    throw error;
  }
}

//Creating a specialized client for orders with custom middleware
const ordersClient = new ApiClient({
  baseURL: process.env.REACT_APP_ORDERS_SERVICE_URL,
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes cache for order data
  middleware: [
    timingMiddleware,
    idempotencyMiddleware, // Ensure order operations are idempotent
    offlineDetectionMiddleware,
    {
      id: 'orderLogging',
      request: (config) => {
        // Log all order operations
        logger.info(`Order operation: ${config.method} ${config.url}`, {
          data: config.data
        });
        return config;
      }
    }
  ]
});

// Using the specialized client
async function createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
  try {
    const startTimer = metrics.startTimer('orders.create');
    
    const response = await ordersClient.post<Order>('/orders', orderData);
    
    // Stop the timer with additional tags
    startTimer({ 
      success: true,
      items: orderData.items.length,
      total: orderData.total
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to create order', { error, orderData });
    throw error;
  }
}

// Example with GraphQL for complex queries
interface ProductWithReviews {
    id: string;
    name: string;
    price: number;
    category: string;
    reviews: Array<{
      id: string;
      rating: number;
      comment: string;
      author: {
        name: string;
        avatar: string;
      }
    }>;
  }
  
  async function getProductWithReviews(productId: string): Promise<ProductWithReviews> {
    // Check if GraphQL is configured
    if (!defaultApiClient.config.graphQLEndpoint) {
      defaultApiClient.config.graphQLEndpoint = '/graphql';
    }
    
    try {
      // Define GraphQL query
      const query = `
        query GetProductWithReviews($id: ID!) {
          product(id: $id) {
            id
            name
            price
            category
            reviews {
              id
              rating
              comment
              author {
                name
                avatar
              }
            }
          }
        }
      `;
      
      // Execute GraphQL query
      const response = await defaultApiClient.graphql<{ product: ProductWithReviews }>({
        query,
        variables: { id: productId },
        operationName: 'GetProductWithReviews',
        type: GraphQLOperationType.Query
      });
      
      return response.data.product;
    } catch (error) {
      logger.error('Failed to fetch product with reviews', { error, productId });
      throw error;
    }
  }
  
  // Example with batch requests for efficient loading
  async function loadDashboardData(userId: string): Promise<{
    user: User;
    recentOrders: Order[];
    recommendations: Product[];
  }> {
    try {
      // Make multiple requests in parallel with batching
      const [userResponse, ordersResponse, recommendationsResponse] = await defaultApiClient.batch<[
        User,
        PaginatedResponse<Order>,
        Product[]
      ]>([
        { method: 'get', url: `/users/${userId}` },
        { method: 'get', url: '/orders', params: { 
          userId, 
          status: 'active', 
          limit: 5,
          sort: 'createdAt:desc' 
        }},
        { method: 'get', url: '/recommendations', params: { userId }}
      ]);
      
      // Handle any errors in the batch
      if (userResponse instanceof Error) {
        throw userResponse;
      }
      
      const recentOrders = ordersResponse instanceof Error 
        ? [] 
        : ordersResponse.data.items;
        
      const recommendations = recommendationsResponse instanceof Error 
        ? [] 
        : recommendationsResponse.data;
      
      return {
        user: userResponse.data,
        recentOrders,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to load dashboard data', { error, userId });
      throw error;
    }
  }
  
  // Example with offline support for forms
  interface OrderForm {
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    shippingAddress: string;
    paymentMethod: string;
  }
  
  function createOfflineCapableOrderSubmission() {
    const pendingOrders: OrderForm[] = [];
    let syncInProgress = false;
    
    // Load any pending orders from storage
    try {
      const storedOrders = localStorage.getItem('pendingOrders');
      if (storedOrders) {
        pendingOrders.push(...JSON.parse(storedOrders));
      }
    } catch (e) {
      logger.error('Failed to load pending orders', { error: e });
    }
    
    // Function to submit order
    async function submitOrder(orderForm: OrderForm): Promise<{ success: boolean; orderId?: string; message?: string }> {
      // Check if we're online
      if (!navigator.onLine) {
        // Store for later submission
        pendingOrders.push(orderForm);
        localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
        
        return { 
          success: false, 
          message: 'Order saved for later submission when you are back online.' 
        };
      }
      
      try {
        // Submit order directly
        const response = await ordersClient.post<Order>('/orders', orderForm);
        
        return {
          success: true,
          orderId: response.data.id
        };
      } catch (error) {
        // If it's a network error, store for later
        if (!error.response) {
          pendingOrders.push(orderForm);
          localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
          
          return { 
            success: false, 
            message: 'Network error occurred. Order saved for later submission.' 
          };
        }
        
        // Otherwise it's a server error
        logger.error('Order submission failed', { error });
        return {
          success: false,
          message: error.message || 'Failed to submit order. Please try again.'
        };
      }
    }
    
    // Function to sync pending orders
    async function syncPendingOrders(): Promise<{ success: number; failed: number }> {
      if (syncInProgress || pendingOrders.length === 0 || !navigator.onLine) {
        return { success: 0, failed: 0 };
      }
      
      syncInProgress = true;
      let success = 0;
      let failed = 0;
      
      try {
        // Process each pending order
        const remainingOrders: OrderForm[] = [];
        
        for (const orderForm of pendingOrders) {
          try {
            await ordersClient.post<Order>('/orders', orderForm);
            success++;
          } catch (error) {
            failed++;
            // Keep in the queue if it's a temporary error
            if (!error.response || error.response.status >= 500) {
              remainingOrders.push(orderForm);
            } else {
              // Log permanent errors
              logger.error('Failed to sync order', { error, orderForm });
            }
          }
        }
        
        // Update pending orders
        pendingOrders.length = 0;
        pendingOrders.push(...remainingOrders);
        localStorage.setItem('pendingOrders', JSON.stringify(pendingOrders));
        
        return { success, failed };
      } finally {
        syncInProgress = false;
      }
    }
    
    // Set up online listener to sync when connection is restored
    window.addEventListener('online', () => {
      logger.info('Connection restored. Syncing pending orders...');
      syncPendingOrders()
        .then(result => {
          logger.info('Order sync completed', result);
        })
        .catch(error => {
          logger.error('Order sync failed', { error });
        });
    });
    
    // Return the API
    return {
      submitOrder,
      syncPendingOrders,
      getPendingCount: () => pendingOrders.length
    };
  }
  
  // Example with request cancellation for search
  function createSearchComponent() {
    let currentRequest: { cancel: () => void } | null = null;
    
    async function search(term: string): Promise<Product[]> {
      // Cancel any in-flight request
      if (currentRequest) {
        currentRequest.cancel();
        currentRequest = null;
      }
      
      // Skip empty searches
      if (!term.trim()) {
        return [];
      }
      
      try {
        // Make a new request
        const request = defaultApiClient.get<Product[]>('/products/search', { q: term });
        currentRequest = request;
        
        const response = await request;
        return response.data;
      } catch (error) {
        // Ignore cancellation errors
        if (error.name === 'CanceledError') {
          return [];
        }
        
        logger.error('Search failed', { error, term });
        throw error;
      } finally {
        currentRequest = null;
      }
    }
    
    return { search };
  }
  
  // Export examples for use in application
  export {
    fetchUserProfile,
    fetchProducts,
    createOrder,
    getProductWithReviews,
    loadDashboardData,
    createOfflineCapableOrderSubmission,
    createSearchComponent
  };// src/examples/apiClientUsage.ts
  import { defaultApiClient, ApiClient, GraphQLOperationType } from '../utils/apiClient';
  import { timingMiddleware, idempotencyMiddleware, offlineDetectionMiddleware } from '../utils/apiMiddleware';
  import { logger } from '../services/logger';
  import { metrics } from '../services/metrics';
  
  // Type definitions for API responses
  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
  }
  
  interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
    description: string;
    imageUrl?: string;
  }
  
  interface Order {
    id: string;
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    total: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    createdAt: string;
  }
  
  interface PaginatedResponse<T> {
    items: T[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }
  
  // Basic usage with typed responses
  async function fetchUserProfile(): Promise<User> {
    try {
      const response = await defaultApiClient.get<User>('/users/profile');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch user profile', { error });
      throw error;
    }
  }
  
  // Using the client with pagination and type safety
  async function fetchProducts(page: number = 1, pageSize: number = 20, category?: string): Promise<PaginatedResponse<Product>> {
    try {
      const params = {
        page,
        pageSize,
        ...(category ? { category } : {})
      };
      
      const response = await defaultApiClient.get<PaginatedResponse<Product>>('/products', params);
      
      // Log request metadata
      logger.debug('Products fetched', {
        duration: response.meta.duration,
        requestId: response.meta.requestId,
        totalItems: response.data.totalItems
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch products', { error, page, pageSize, category });
      throw error;
    }
  }
  
  //Creating a specialized client for orders with custom middleware
  const ordersClient = new ApiClient({
    baseURL: process.env.REACT_APP_ORDERS_SERVICE_URL,
    enableCache: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes cache for order data
    middleware: [
      timingMiddleware,
      idempotencyMiddleware, // Ensure order operations are idempotent
      offlineDetectionMiddleware,
      {
        id: 'orderLogging',
        request: (config) => {
          // Log all order operations
          logger.info(`Order operation: ${config.method} ${config.url}`, {
            data: config.data
          });
          return config;
        }
      }
    ]
  });
  
  // Using the specialized client
  async function createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    try {
      const startTimer = metrics.startTimer('orders.create');
      
      const response = await ordersClient.post<Order>('/orders', orderData);
      
      // Stop the timer with additional tags
      startTimer({ 
        success: true,
        items: orderData.items.length,
        total: orderData.total
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to create order', { error, orderData });
      throw error;
    }
  }