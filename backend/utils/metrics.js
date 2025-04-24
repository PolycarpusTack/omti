// utils/metrics.js
/**
 * Metrics collection utility for monitoring and observability
 * In a real implementation, this would integrate with a metrics system
 * like Prometheus, StatsD, or Datadog.
 */
class Metrics {
    constructor() {
      this.counters = new Map();
      this.gauges = new Map();
      this.histograms = new Map();
      
      // Store last N values for histograms
      this.histogramValues = new Map();
      this.histogramMaxValues = 1000;
      
      // Internal counter for metrics operations
      this._operations = 0;
    }
    
    /**
     * Get a namespaced metric key with labels
     * @param {string} name Metric name
     * @param {Object} labels Label key-value pairs
     * @returns {string} Namespaced key
     * @private
     */
    _getKey(name, labels = {}) {
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      
      return labelStr ? `${name}{${labelStr}}` : name;
    }
    
    /**
     * Increment a counter
     * @param {string} name Counter name
     * @param {Object} [labels] Labels for the counter
     * @param {number} [value=1] Value to increment by
     */
    incrementCounter(name, labels = {}, value = 1) {
      const key = this._getKey(name, labels);
      const currentValue = this.counters.get(key) || 0;
      this.counters.set(key, currentValue + value);
      this._operations++;
    }
    
    /**
     * Decrement a counter
     * @param {string} name Counter name
     * @param {Object} [labels] Labels for the counter
     * @param {number} [value=1] Value to decrement by
     */
    decrementCounter(name, labels = {}, value = 1) {
      this.incrementCounter(name, labels, -value);
    }
    
    /**
     * Set a gauge value
     * @param {string} name Gauge name
     * @param {number} value Gauge value
     * @param {Object} [labels] Labels for the gauge
     */
    setGauge(name, value, labels = {}) {
      const key = this._getKey(name, labels);
      this.gauges.set(key, value);
      this._operations++;
    }
    
    /**
     * Record a value in a histogram
     * @param {string} name Histogram name
     * @param {number} value Value to record
     * @param {Object} [labels] Labels for the histogram
     */
    recordHistogram(name, value, labels = {}) {
      const key = this._getKey(name, labels);
      
      // Initialize histogram values array if needed
      if (!this.histogramValues.has(key)) {
        this.histogramValues.set(key, []);
      }
      
      const values = this.histogramValues.get(key);
      values.push(value);
      
      // Trim if we have too many values
      if (values.length > this.histogramMaxValues) {
        values.shift();
      }
      
      // Update the histogram
      this.histograms.set(key, {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      });
      
      this._operations++;
    }
    
    /**
     * Record response time for an operation
     * @param {string} operation Operation name
     * @param {number} timeMs Time in milliseconds
     * @param {Object} [labels] Additional labels
     */
    recordResponseTime(operation, timeMs, labels = {}) {
      this.recordHistogram('response_time_ms', timeMs, {
        operation,
        ...labels
      });
    }
    
    /**
     * Get current metric values
     * @returns {Object} All metrics
     */
    getMetrics() {
      return {
        counters: Object.fromEntries(this.counters),
        gauges: Object.fromEntries(this.gauges),
        histograms: Object.fromEntries(this.histograms),
        _meta: {
          operations: this._operations,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    /**
     * Get a specific metric
     * @param {string} type Metric type (counter, gauge, histogram)
     * @param {string} name Metric name
     * @param {Object} [labels] Labels to filter by
     * @returns {*} Metric value or null
     */
    getMetric(type, name, labels = {}) {
      const key = this._getKey(name, labels);
      
      switch (type) {
        case 'counter':
          return this.counters.get(key) || 0;
        case 'gauge':
          return this.gauges.get(key) || 0;
        case 'histogram':
          return this.histograms.get(key) || null;
        default:
          return null;
      }
    }
    
    /**
     * Reset all metrics
     */
    reset() {
      this.counters.clear();
      this.gauges.clear();
      this.histograms.clear();
      this.histogramValues.clear();
      this._operations = 0;
    }
  }
  
  // Export a singleton instance
  module.exports = new Metrics();