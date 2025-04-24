// src/utils/cacheStrategies.ts
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiClientMiddleware } from './apiClient';
import { logger } from '../services/logger';

/**
 * Cache storage interface definition
 */
export interface CacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
  iterate(fn: (value: string, key: string) => any): Promise<void>;
}

/**
 * Options for stale-while-revalidate cache
 */
export interface SWRCacheOptions {
  /** Maximum age for a fresh cache entry in milliseconds */
  maxAge: number;
  
  /** Maximum age for a stale cache entry in milliseconds */
  staleWhileRevalidateAge: number;
  
  /** Cache storage to use */
  storage?: CacheStorage;
  
  /** Whether to use cache for query params */
  cacheQueryParams?: boolean;
  
  /** Additional request matcher to determine if request should be cached */
  shouldCacheRequest?: (config: AxiosRequestConfig) => boolean;
  
  /** Headers to include in cache key */
  headersToInclude?: string[];
}

/**
 * Default memory-based cache storage
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  
  async getItem(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    return entry ? entry.value : null;
  }
  
  async setItem(key: string, value: string): Promise<void> {
    this.cache.set(key, { value, timestamp: Date.now() });
  }
  
  async removeItem(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async length(): Promise<number> {
    return this.cache.size;
  }
  
  async iterate(fn: (value: string, key: string) => any): Promise<void> {
    for (const [key, entry] of this.cache.entries()) {
      fn(entry.value, key);
    }
  }
}

/**
 * Creates a stale-while-revalidate cache middleware
 * This strategy returns stale data immediately while fetching fresh data in the background
 */
export function createSWRCacheMiddleware(options: SWRCacheOptions): ApiClientMiddleware {
  const {
    maxAge,
    staleWhileRevalidateAge,
    storage = new MemoryCacheStorage(),
    cacheQueryParams = true,
    shouldCacheRequest,
    headersToInclude = ['accept', 'accept-language']
  } = options;
  
  // Track background revalidation requests
  const revalidationInProgress = new Set<string>();
  
  // Generate cache key for a request
  const getCacheKey = (config: AxiosRequestConfig): string => {
    const { method, url } = config;
    
    // Don't cache if no URL
    if (!url) return '';
    
    // Start with method and URL
    let key = `${method || 'get'}_${url}`;
    
    // Add query params if enabled
    if (cacheQueryParams && config.params) {
      const serializedParams = Object.entries(config.params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${
          typeof value === 'object' ? JSON.stringify(value) : value
        }`)
        .join('&');
      
      if (serializedParams) {
        key += `?${serializedParams}`;
      }
    }
    
    // Add relevant headers
    if (headersToInclude.length > 0 && config.headers) {
      const headers = config.headers;
      const relevantHeaders = headersToInclude
        .filter(header => header in headers)
        .map(header => `${header}=${headers[header]}`)
        .join(';');
      
      if (relevantHeaders) {
        key += `|${relevantHeaders}`;
      }
    }
    
    return `swr_${key}`;
  };
  
  // Parse cache response
  const parseCacheEntry = (entry: string | null): {
    data: any;
    timestamp: number;
    headers: Record<string, string>;
  } | null => {
    if (!entry) return null;
    
    try {
      return JSON.parse(entry);
    } catch (e) {
      return null;
    }
  };
  
  // Check if a request should be cached
  const isCacheable = (config: AxiosRequestConfig): boolean => {
    // Only cache GET requests
    if (config.method && config.method.toLowerCase() !== 'get') {
      return false;
    }
    
    // Skip cache if explicitly requested
    if (config.headers?.['x-skip-cache'] === 'true') {
      return false;
    }
    
    // Apply custom matcher if provided
    if (shouldCacheRequest) {
      return shouldCacheRequest(config);
    }
    
    return true;
  };
  
  // Revalidate a cache entry in the background
  const revalidateCache = async (cacheKey: string, config: AxiosRequestConfig): Promise<void> => {
    // Avoid multiple revalidations for the same key
    if (revalidationInProgress.has(cacheKey)) {
      return;
    }
    
    revalidationInProgress.add(cacheKey);
    
    try {
      // Create a clone of the request config
      const revalidationConfig = {
        ...config,
        headers: {
          ...config.headers,
          'x-skip-cache': 'true',
          'x-cache-revalidation': 'true'
        }
      };
      
      // Execute the original request
      const response = await config.adapter!(revalidationConfig);
      
      // Update the cache with the fresh data
      const cacheEntry = {
        data: response.data,
        timestamp: Date.now(),
        headers: response.headers
      };
      
      await storage.setItem(cacheKey, JSON.stringify(cacheEntry));
      
      logger.debug('Cache revalidated', {
        cacheKey,
        url: config.url
      });
    } catch (error) {
      logger.warn('Cache revalidation failed', {
        cacheKey,
        url: config.url,
        error
      });
    } finally {
      revalidationInProgress.delete(cacheKey);
    }
  };
  
  // Return the middleware
  return {
    id: 'swrCache',
    
    request: async (config: AxiosRequestConfig) => {
      if (!isCacheable(config)) {
        return config;
      }
      
      const cacheKey = getCacheKey(config);
      if (!cacheKey) {
        return config;
      }
      
      // Get from cache
      const cachedEntry = parseCacheEntry(await storage.getItem(cacheKey));
      
      // No cache hit
      if (!cachedEntry) {
        return config;
      }
      
      const now = Date.now();
      const age = now - cachedEntry.timestamp;
      
      // Fresh cache, return the cached response
      if (age <= maxAge) {
        // Create a response that axios will handle
        const data = cachedEntry.data;
        const headers = {
          ...cachedEntry.headers,
          'x-cache': 'hit',
          'age': Math.floor(age / 1000).toString()
        };
        
        // Replace the adapter to return cached data
        config.adapter = () => Promise.resolve({
          data,
          status: 200,
          statusText: 'OK',
          headers,
          config,
          request: {
            fromCache: true
          }
        });
        
        return config;
      }
      
      // Stale cache within stale TTL
      if (age <= staleWhileRevalidateAge) {
        // Return stale data immediately
        const data = cachedEntry.data;
        const headers = {
          ...cachedEntry.headers,
          'x-cache': 'stale',
          'age': Math.floor(age / 1000).toString()
        };
        
        // Store original adapter
        const originalAdapter = config.adapter!;
        
        // Replace the adapter to return cached data
        config.adapter = () => {
          // Trigger revalidation in the background
          revalidateCache(cacheKey, {
            ...config,
            adapter: originalAdapter
          });
          
          return Promise.resolve({
            data,
            status: 200,
            statusText: 'OK',
            headers,
            config,
            request: {
              fromCache: true,
              cacheState: 'stale'
            }
          });
        };
        
        return config;
      }
      
      // Cache is too old, remove it
      await storage.removeItem(cacheKey);
      return config;
    },
    
    response: async (response: AxiosResponse) => {
      // Cache successful GET responses
      if (
        response.config.method?.toLowerCase() === 'get' &&
        response.status >= 200 && 
        response.status < 300 &&
        !response.config.headers?.['x-skip-cache'] &&
        isCacheable(response.config)
      ) {
        const cacheKey = getCacheKey(response.config);
        
        if (cacheKey) {
          // Create cache entry
          const cacheEntry = {
            data: response.data,
            timestamp: Date.now(),
            headers: response.headers
          };
          
          await storage.setItem(cacheKey, JSON.stringify(cacheEntry));
          
          // Add cache header
          response.headers['x-cache'] = 'miss';
        }
      }
      
      return response;
    }
  };
}

/**
 * Creates a middleware that handles etag/if-none-match for efficient revalidation
 */
export function createETagMiddleware(): ApiClientMiddleware {
  // Store etags in memory
  const etagCache = new Map<string, {
    etag: string;
    data: any;
    timestamp: number;
  }>();
  
  // Get cache key for a request
  const getCacheKey = (config: AxiosRequestConfig): string => {
    const { method, url, params } = config;
    
    // Only care about GET requests
    if (method?.toLowerCase() !== 'get' || !url) {
      return '';
    }
    
    // Start with URL
    let key = url;
    
    // Add query params
    if (params) {
      const serializedParams = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}=${
          typeof value === 'object' ? JSON.stringify(value) : value
        }`)
        .join('&');
      
      if (serializedParams) {
        key += `?${serializedParams}`;
      }
    }
    
    return `etag_${key}`;
  };
  
  return {
    id: 'etag',
    
    request: (config: AxiosRequestConfig) => {
      // Skip if not GET
      if (config.method?.toLowerCase() !== 'get') {
        return config;
      }
      
      const cacheKey = getCacheKey(config);
      if (!cacheKey) {
        return config;
      }
      
      // Check if we have an etag
      const cachedData = etagCache.get(cacheKey);
      if (cachedData?.etag) {
        // Add If-None-Match header
        config.headers = {
          ...config.headers,
          'If-None-Match': cachedData.etag
        };
      }
      
      return config;
    },
    
    response: (response: AxiosResponse) => {
      // Only cache GET responses
      if (response.config.method?.toLowerCase() !== 'get') {
        return response;
      }
      
      const cacheKey = getCacheKey(response.config);
      if (!cacheKey) {
        return response;
      }
      
      // If we got an ETag, store it
      const etag = response.headers.etag || response.headers.ETag;
      if (etag) {
        etagCache.set(cacheKey, {
          etag,
          data: response.data,
          timestamp: Date.now()
        });
      }
      
      return response;
    },
    
    error: (error) => {
      // Handle 304 Not Modified
      if (
        error.response?.status === 304 &&
        error.config.method?.toLowerCase() === 'get'
      ) {
        const cacheKey = getCacheKey(error.config);
        const cachedData = etagCache.get(cacheKey);
        
        if (cachedData?.data) {
          // Create a successful response from cache
          const response = {
            ...error.response,
            status: 200,
            statusText: 'OK',
            data: cachedData.data,
            headers: {
              ...error.response.headers,
              'x-cache': 'hit',
              'x-cache-source': 'etag'
            },
            request: {
              fromCache: true
            }
          };
          
          // Update timestamp
          cachedData.timestamp = Date.now();
          etagCache.set(cacheKey, cachedData);
          
          return response;
        }
      }
      
      return error;
    }
  };
}

/**
 * Creates a middleware that prefetches linked resources
 */
export function createPrefetchMiddleware(options: {
  /** Resources to prefetch based on response patterns */
  prefetchRules: Array<{
    /** URL pattern to match */
    urlPattern: RegExp;
    /** Function to extract URLs to prefetch */
    getUrls: (data: any) => string[];
  }>;
  /** Max concurrent prefetch requests */
  maxConcurrent?: number;
}): ApiClientMiddleware {
  const { 
    prefetchRules, 
    maxConcurrent = 3 
  } = options;
  
  // Track ongoing prefetch requests
  const prefetchQueue: string[] = [];
  let activePrefetches = 0;
  
  // Execute next prefetch from queue
  const processQueue = async (client: any) => {
    if (activePrefetches >= maxConcurrent || prefetchQueue.length === 0) {
      return;
    }
    
    // Get next URL from queue
    const url = prefetchQueue.shift()!;
    
    // Skip if already in progress
    if (activePrefetches >= maxConcurrent) {
      prefetchQueue.unshift(url);
      return;
    }
    
    // Prefetch the resource
    activePrefetches++;
    
    try {
      await client.get(url, {}, {
        headers: {
          'x-prefetch': 'true',
          'Purpose': 'prefetch'
        },
        timeout: 5000
      });
      
      logger.debug('Prefetched resource', { url });
    } catch (error) {
      // Ignore prefetch errors
      logger.debug('Prefetch failed', { url, error });
    } finally {
      activePrefetches--;
      
      // Process next item in queue
      if (prefetchQueue.length > 0) {
        processQueue(client);
      }
    }
  };
  
  return {
    id: 'prefetch',
    
    response: (response: AxiosResponse) => {
      // Skip prefetch requests themselves
      if (response.config.headers?.['x-prefetch']) {
        return response;
      }
      
      // Skip if not successful or not GET
      if (
        response.status < 200 || 
        response.status >= 300 ||
        response.config.method?.toLowerCase() !== 'get'
      ) {
        return response;
      }
      
      // Check if response matches any prefetch rule
      const url = response.config.url || '';
      const matchingRules = prefetchRules.filter(rule => rule.urlPattern.test(url));
      
      if (matchingRules.length === 0) {
        return response;
      }
      
      // Get URLs to prefetch from all matching rules
      const urlsToPrefetch = new Set<string>();
      
      for (const rule of matchingRules) {
        try {
          const urls = rule.getUrls(response.data);
          urls.forEach(url => urlsToPrefetch.add(url));
        } catch (error) {
          logger.warn('Failed to extract prefetch URLs', { 
            error, 
            url,
            rule: rule.urlPattern.toString()
          });
        }
      }
      
      // Add URLs to prefetch queue
      if (urlsToPrefetch.size > 0) {
        // Get client reference from config
        const client = response.config.apiClient;
        
        // Queue prefetch requests
        for (const url of urlsToPrefetch) {
          if (!prefetchQueue.includes(url)) {
            prefetchQueue.push(url);
          }
        }
        
        // Start processing if not already running
        if (activePrefetches < maxConcurrent) {
          processQueue(client);
        }
      }
      
      return response;
    }
  };
}