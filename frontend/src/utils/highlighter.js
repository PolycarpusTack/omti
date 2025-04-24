// src/utils/highlighter.js

/**
 * Utility functions for highlighting text based on patterns
 */

// Regular expressions for different severity levels
const CRITICAL_PATTERNS = [
    /\b(crash(ed|ing)?|exception|fatal error|serious problem|deadlock)\b/gi,
    /\b(assertion failed|segmentation fault|access violation|null pointer)\b/gi,
    /\b(critical|severe error|emergency|alert)\b/gi
  ];
  
  const ERROR_PATTERNS = [
    /\b(error|failure|problem|broken|corruption|invalid)\b/gi,
    /\b(denied|rejected|violated|infringement|wrong)\b/gi,
    /\b(overflow|underflow|out of bounds|buffer overflow)\b/gi
  ];
  
  const WARNING_PATTERNS = [
    /\b(warning|caution|attention|notice|note|careful)\b/gi,
    /\b(may|might|could|should|consider|potential|possible)\b/gi,
    /\b(deprecated|unstable|experimental|unreliable)\b/gi
  ];
  
  const SUCCESS_PATTERNS = [
    /\b(success|successful|succeeded|completed|resolved|fixed)\b/gi,
    /\b(working|works|operational|functioning|passed)\b/gi,
    /\b(healthy|stable|reliable|robust|resilient)\b/gi
  ];
  
  const INFO_PATTERNS = [
    /\b(info|information|notice|log|message)\b/gi,
    /\b(debug|trace|verbose|detail)\b/gi
  ];
  
  // Pattern groups by their highlight color
  const PATTERN_GROUPS = [
    { patterns: CRITICAL_PATTERNS, className: 'text-red-600 font-bold dark:text-red-400' },
    { patterns: ERROR_PATTERNS, className: 'text-red-500 font-semibold dark:text-red-300' },
    { patterns: WARNING_PATTERNS, className: 'text-yellow-600 font-semibold dark:text-yellow-400' },
    { patterns: SUCCESS_PATTERNS, className: 'text-green-600 font-semibold dark:text-green-400' },
    { patterns: INFO_PATTERNS, className: 'text-blue-600 font-semibold dark:text-blue-400' }
  ];
  
  // Stack trace patterns
  const STACK_TRACE_LINE = /^\s*at\s+.+\(.+:\d+:\d+\)|\s+at\s+.+\s\(.+\)|\s*at\s+.+/gm;
  const STACK_TRACE_PATTERNS = [
    { pattern: STACK_TRACE_LINE, className: 'text-gray-500 font-mono text-xs dark:text-gray-400' }
  ];
  
  // Technical terms patterns
  const TECHNICAL_TERMS = [
    /\b(API|SDK|HTTP|RPC|REST|SOAP|JSON|XML|HTML|CSS|JS)\b/g,
    /\b(GET|POST|PUT|DELETE|PATCH|OPTIONS)\b/g,
    /\b(CPU|GPU|RAM|ROM|I\/O|HDD|SSD|NVMe)\b/g,
    /\b(TCP|IP|UDP|DNS|HTTPS|SSH|SSL|TLS)\b/g,
    /\b(OAuth|JWT|SAML|SSO|MFA|2FA)\b/g
  ];
  
  const TECHNICAL_TERM_PATTERNS = [
    { pattern: TECHNICAL_TERMS, className: 'text-indigo-600 font-semibold dark:text-indigo-400' }
  ];
  
  // Path and URL patterns
  const PATH_URL_PATTERNS = [
    { pattern: /((?:\w:)?[\\\/](?:[^\\\/\n\r:]+[\\\/])+[^\\\/\n\r:]*)/g, className: 'text-emerald-600 font-mono text-sm dark:text-emerald-400' },
    { pattern: /(https?:\/\/[^\s]+)/g, className: 'text-cyan-600 underline font-mono text-sm dark:text-cyan-400' }
  ];
  
  // Date and time patterns
  const DATETIME_PATTERNS = [
    { 
      pattern: /\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, 
      className: 'text-purple-600 font-mono text-sm dark:text-purple-400' 
    },
    {
      pattern: /\d{2}\/\d{2}\/\d{4}(?:\s\d{2}:\d{2}:\d{2})?/g,
      className: 'text-purple-600 font-mono text-sm dark:text-purple-400'
    }
  ];
  
  /**
   * Highlight severity levels in text
   * @param {string} text - Text to highlight
   * @returns {string} - HTML with highlighted text
   */
  export const highlightSeverity = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Apply all pattern groups
    PATTERN_GROUPS.forEach(({ patterns, className }) => {
      patterns.forEach(pattern => {
        result = result.replace(pattern, match => `<span class="${className}">${match}</span>`);
      });
    });
    
    return result;
  };
  
  /**
   * Highlight stack traces in text
   * @param {string} text - Text to highlight
   * @returns {string} - HTML with highlighted stack traces
   */
  export const highlightStackTraces = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Apply stack trace patterns
    STACK_TRACE_PATTERNS.forEach(({ pattern, className }) => {
      result = result.replace(pattern, match => `<span class="${className}">${match}</span>`);
    });
    
    return result;
  };
  
  /**
   * Highlight technical terms in text
   * @param {string} text - Text to highlight
   * @returns {string} - HTML with highlighted technical terms
   */
  export const highlightTechnicalTerms = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Apply technical term patterns
    TECHNICAL_TERM_PATTERNS.forEach(({ pattern, className }) => {
      result = result.replace(pattern, match => `<span class="${className}">${match}</span>`);
    });
    
    return result;
  };
  
  /**
   * Highlight paths and URLs in text
   * @param {string} text - Text to highlight
   * @returns {string} - HTML with highlighted paths and URLs
   */
  export const highlightPathsAndUrls = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Apply path and URL patterns
    PATH_URL_PATTERNS.forEach(({ pattern, className }) => {
      result = result.replace(pattern, match => `<span class="${className}">${match}</span>`);
    });
    
    return result;
  };
  
  /**
   * Highlight dates and times in text
   * @param {string} text - Text to highlight
   * @returns {string} - HTML with highlighted dates and times
   */
  export const highlightDateTimes = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Apply date and time patterns
    DATETIME_PATTERNS.forEach(({ pattern, className }) => {
      result = result.replace(pattern, match => `<span class="${className}">${match}</span>`);
    });
    
    return result;
  };
  
  /**
   * Apply all highlighting to text
   * @param {string} text - Text to highlight
   * @param {Object} options - Highlighting options
   * @param {boolean} options.severity - Highlight severity levels
   * @param {boolean} options.stackTraces - Highlight stack traces
   * @param {boolean} options.technicalTerms - Highlight technical terms
   * @param {boolean} options.pathsAndUrls - Highlight paths and URLs
   * @param {boolean} options.dateTimes - Highlight dates and times
   * @returns {Object} - HTML with all highlights
   */
  export const highlightAll = (text, options = {}) => {
    if (!text) return { __html: '' };
    
    const {
      severity = true,
      stackTraces = true,
      technicalTerms = true,
      pathsAndUrls = true,
      dateTimes = true
    } = options;
    
    let result = text;
    
    // Apply all requested highlighting in order
    if (dateTimes) result = highlightDateTimes(result);
    if (pathsAndUrls) result = highlightPathsAndUrls(result);
    if (severity) result = highlightSeverity(result);
    if (stackTraces) result = highlightStackTraces(result);
    if (technicalTerms) result = highlightTechnicalTerms(result);
    
    return { __html: result };
  };
  
  /**
   * Determine the severity level of text content
   * @param {string} text - Text to analyze
   * @returns {string} - Severity level: 'critical', 'error', 'warning', 'info'
   */
  export const determineSeverity = (text) => {
    if (!text) return 'info';
    
    // Check for critical patterns
    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(text)) {
        pattern.lastIndex = 0; // Reset regex state
        return 'critical';
      }
    }
    
    // Check for error patterns
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(text)) {
        pattern.lastIndex = 0; // Reset regex state
        return 'error';
      }
    }
    
    // Check for warning patterns
    for (const pattern of WARNING_PATTERNS) {
      if (pattern.test(text)) {
        pattern.lastIndex = 0; // Reset regex state
        return 'warning';
      }
    }
    
    // Default to info
    return 'info';
  };
  
  /**
   * Get UI properties for a severity level
   * @param {string} severity - Severity level: 'critical', 'error', 'warning', 'info'
   * @returns {Object} - Properties including color, background, border, etc.
   */
  export const getSeverityProperties = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          color: 'text-red-700 dark:text-red-400',
          background: 'bg-red-50 dark:bg-red-900/10',
          border: 'border-red-300 dark:border-red-800',
          icon: 'text-red-500',
          label: 'Critical'
        };
      case 'error':
        return {
          color: 'text-red-600 dark:text-red-300',
          background: 'bg-red-50 dark:bg-red-900/10',
          border: 'border-red-200 dark:border-red-700',
          icon: 'text-red-400',
          label: 'Error'
        };
      case 'warning':
        return {
          color: 'text-yellow-700 dark:text-yellow-400',
          background: 'bg-yellow-50 dark:bg-yellow-900/10',
          border: 'border-yellow-300 dark:border-yellow-800',
          icon: 'text-yellow-500',
          label: 'Warning'
        };
      case 'info':
      default:
        return {
          color: 'text-blue-700 dark:text-blue-400',
          background: 'bg-blue-50 dark:bg-blue-900/10',
          border: 'border-blue-200 dark:border-blue-700',
          icon: 'text-blue-500',
          label: 'Info'
        };
    }
  };