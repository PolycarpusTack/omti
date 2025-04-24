// Application-wide constants

// API Endpoints - Use environment variables with fallbacks
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/analyze/';
export const OLLAMA_URL = process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_CHECK_INTERVAL = parseInt(process.env.REACT_APP_OLLAMA_CHECK_INTERVAL || '5000', 10);
export const REQUEST_TIMEOUT = parseInt(process.env.REACT_APP_REQUEST_TIMEOUT || '1200000', 10); // 20 minutes in ms

// Model options
export const MODEL_OPTIONS = [
  { value: 'mistral', label: 'Mistral' },
  { value: 'llama2', label: 'Llama 2' },
  { value: 'mixtral', label: 'Mixtral' }
];

// Default settings
export const DEFAULT_SETTINGS = {
  model: 'mistral',
  maxTokensPerChunk: 8000,
  timeout: 1200 // seconds
};

// Issue severity patterns
export const ISSUE_PATTERNS = {
  critical: /(.*?(?:crash|exception|fatal|failure|deadlock).*?\.)/i,
  high: /(.*?(?:error|warning|leak|overflow).*?\.)/i,
  medium: /(.*?(?:warning|potential issue|consider|might).*?\.)/i,
  low: /(.*?(?:info|note|reminder|suggestion).*?\.)/i
};

// Error patterns for detection
export const ERROR_PATTERNS = [
  /([A-Z][a-z]+ (error|exception|failure):[^.]+)/g,
  /(failed to [^.]+)/gi,
  /(could not [^.]+)/gi
];

// Supported file types
export const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'application/json',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'application/log',
  'text/x-log'
];

export const SUPPORTED_EXTENSIONS = [
  'txt', 'log', 'json', 'csv', 'xml', 'xls', 'xlsx'
];

// Maximum file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;