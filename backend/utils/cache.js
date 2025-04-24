// utils/cache.js
/**
 * Simple in-memory cache with TTL and stale-while-revalidate support
 */
class Cache {
    /**
     * Create a new cache
     * @param {Object} options Cache options
     * @param {number} [options.ttl=60000] Time-to-live in milliseconds (default: 1 minute)
     * @param {number} [options.max=1000] Maximum number of items in cache
     * @param {number} [options.staleExpiry=300000] How long to keep stale items (default: 5 minutes)
     */
    constructor(options = {}) {
      this.ttl = options.ttl || 60000; // 1 minute default
      this.max = options.max || 1000;
      this.staleExpiry = options.staleExpiry || 300000; // 5 minutes after TTL
      this.cache = new Map();
      this.hits = 0;
      this.misses = 0;
      this.staleHits = 0;
    }
    
    /**
     * Set a value in the cache
     * @param {string} key Cache key
     * @param {any} value Value to store
     * @param {number} [ttl] Optional override TTL for this item
     * @returns {boolean} True if the item was cached
     */
    set(key, value, ttl = this.ttl) {
      // Ensure we don't exceed max size
      if (this.cache.size >= this.max && !this.cache.has(key)) {
        this._evictOldest();
      }
      
      const now = Date.now();
      this.cache.set(key, {
        value,
        expires: now + ttl,
        staleExpires: now + ttl + this.staleExpiry
      });
      
      return true;
    }
    
    /**
     * Get a value from the cache
     * @param {string} key Cache key
     * @returns {any|null} The cached value or null if not found or expired
     */
    get(key) {
      const entry = this.cache.get(key);
      if (!entry) {
        this.misses++;
        return null;
      }
      
      const now = Date.now();
      
      // If the entry is fresh, return it
      if (entry.expires > now) {
        this.hits++;
        return entry.value;
      }
      
      // If the entry is stale but not yet removed, count as a stale hit
      if (entry.staleExpires > now) {
        this.staleHits++;
      } else {
        // If the entry is beyond stale expiry, remove it
        this.cache.delete(key);
        this.misses++;
        return null;
      }
      
      // Stale value is not returned by default
      this.misses++;
      return null;
    }
    
    /**
     * Get a stale value from the cache if available
     * @param {string} key Cache key
     * @returns {any|null} The cached value (even if stale) or null if not found
     */
    getStale(key) {
      const entry = this.cache.get(key);
      if (!entry) {
        this.misses++;
        return null;
      }
      
      const now = Date.now();
      
      // If the entry is fresh, return it
      if (entry.expires > now) {
        this.hits++;
        return entry.value;
      }
      
      // If the entry is stale but not yet removed, return it
      if (entry.staleExpires > now) {
        this.staleHits++;
        return entry.value;
      }
      
      // If the entry is beyond stale expiry, remove it
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    /**
     * Delete a value from the cache
     * @param {string} key Cache key
     * @returns {boolean} True if the item was deleted
     */
    delete(key) {
      return this.cache.delete(key);
    }
    
    /**
     * Clear the entire cache
     */
    clear() {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
      this.staleHits = 0;
    }
    
    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    stats() {
      return {
        size: this.cache.size,
        maxSize: this.max,
        hits: this.hits,
        misses: this.misses,
        staleHits: this.staleHits,
        hitRate: this.hits + this.misses === 0 
          ? 0 
          : this.hits / (this.hits + this.misses)
      };
    }
    
    /**
     * Evict the oldest entry from the cache
     * @private
     */
    _evictOldest() {
      // Find the oldest entry
      let oldestKey = null;
      let oldestExpiry = Infinity;
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires < oldestExpiry) {
          oldestKey = key;
          oldestExpiry = entry.expires;
        }
      }
      
      // Delete the oldest entry
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
  
  // Cache factory
  const caches = new Map();
  
  module.exports = {
    /**
     * Create a new cache or return an existing one
     * @param {Object} options Cache options
     * @param {string} [options.name='default'] Cache name
     * @returns {Cache} A cache instance
     */
    create(options = {}) {
      const name = options.name || 'default';
      
      if (caches.has(name)) {
        return caches.get(name);
      }
      
      const cache = new Cache(options);
      caches.set(name, cache);
      return cache;
    },
    
    /**
     * Get an existing cache by name
     * @param {string} name Cache name
     * @returns {Cache|null} The cache instance or null
     */
    get(name) {
      return caches.get(name) || null;
    },
    
    /**
     * Get stats for all caches
     * @returns {Object} Stats for all caches
     */
    stats() {
      const stats = {};
      for (const [name, cache] of caches.entries()) {
        stats[name] = cache.stats();
      }
      return stats;
    }
  };