import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';

/**
 * Error codes enumeration for structured error handling
 */
const FILE_ERRORS = {
  INVALID_SIZE: {
    code: 'FILE_001',
    message: (max) => `File exceeds the size limit (${formatFileSize(max)})`
  },
  INVALID_TYPE: {
    code: 'FILE_002',
    message: (types) => `Unsupported format. Valid types: ${types.join(', ')}`
  },
  CONTENT_VALIDATION_FAILED: {
    code: 'FILE_003',
    message: 'File could not be validated'
  },
  NETWORK_ERROR: {
    code: 'FILE_004',
    message: 'Network error occurred while processing file'
  },
  UPLOAD_CANCELLED: {
    code: 'FILE_005',
    message: 'File upload was cancelled'
  },
  UNKNOWN_ERROR: {
    code: 'FILE_999',
    message: 'An unknown error occurred'
  }
};

/**
 * Formats a file size in bytes to a human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Sanitizes a filename to prevent security issues
 * @param {string} name - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFileName = (name) => {
  if (!name) return 'unnamed_file';
  return name.replace(/[^a-zA-Z0-9_\u0400-\u04FF\-\.]/g, '_').substring(0, 255);
};

/**
 * Gets a simplified file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} - The file extension (lowercase, without dot)
 */
const getFileExtension = (filename) => {
  if (!filename) return '';
  return filename.split('.').pop().toLowerCase();
};

/**
 * Enhanced FileUploader component with enterprise-level error handling and robustness
 * while preserving the original behavior and appearance
 */
const FileUploader = ({ 
  selectedFile,
  filePreview,
  dragActive = false,
  fileInputRef,
  handleDrag,
  handleDrop,
  handleFileSelect,
  clearSelectedFile,
  loading = false,
  // New optional props (won't break existing usage)
  onError,
  onEvent,
  maxFileSize = null, // No limit by default to maintain original behavior
  validFileTypes = null, // No restrictions by default to maintain original behavior
  className = '',
  enableRetry = false,
  sanitizeFilenames = true,
  autoFocus = false,
  darkMode = null, // Auto-detect if null
  labels = {},
  debounceDelay = 300
}) => {
  // Local states for enhanced behavior
  const [localDragActive, setLocalDragActive] = useState(dragActive);
  const [fileError, setFileError] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);
  
  // Create local ref if one isn't provided
  const localFileInputRef = useRef(null);
  const actualFileInputRef = fileInputRef || localFileInputRef;
  const srAnnouncementTimeoutRef = useRef(null);
  const componentRef = useRef(null);
  
  // Default labels with fallbacks
  const defaultLabels = {
    dropzoneText: 'Click to select or drag a file here',
    dropActiveText: 'Drop file to upload',
    maxSizeText: 'Maximum size',
    supportedFormatsText: 'Supported formats',
    removeFileText: 'Remove selected file',
    previewText: 'Preview',
    retryText: 'Retry',
    errorPrefixText: 'Error'
  };
  
  // Merge default labels with provided labels
  const mergedLabels = { ...defaultLabels, ...labels };
  
  // Effect to detect dark mode
  useEffect(() => {
    if (darkMode !== null) {
      setIsDarkMode(darkMode);
    } else {
      // Auto-detect dark mode
      const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = document.documentElement.classList.contains('dark');
      setIsDarkMode(prefersDarkMode || hasDarkClass);
      
      // Listen for changes in dark mode preference
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleDarkModeChange = (e) => setIsDarkMode(e.matches);
      
      if (darkModeMediaQuery.addEventListener) {
        darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
      } else if (darkModeMediaQuery.addListener) { // For older browsers
        darkModeMediaQuery.addListener(handleDarkModeChange);
      }
      
      return () => {
        if (darkModeMediaQuery.removeEventListener) {
          darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
        } else if (darkModeMediaQuery.removeListener) { // For older browsers
          darkModeMediaQuery.removeListener(handleDarkModeChange);
        }
      };
    }
  }, [darkMode]);
  
  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && componentRef.current && !selectedFile) {
      componentRef.current.focus();
    }
  }, [autoFocus, selectedFile]);
  
  // Effect to sync drag state from props
  useEffect(() => {
    setLocalDragActive(dragActive);
  }, [dragActive]);

  // Effect for screen reader announcements
  useEffect(() => {
    if (srAnnouncement) {
      clearTimeout(srAnnouncementTimeoutRef.current);
      srAnnouncementTimeoutRef.current = setTimeout(() => {
        setSrAnnouncement('');
      }, 5000);
    }
    
    return () => {
      clearTimeout(srAnnouncementTimeoutRef.current);
    };
  }, [srAnnouncement]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clear any timers
      if (debounceTimer) clearTimeout(debounceTimer);
      clearTimeout(srAnnouncementTimeoutRef.current);
    };
  }, [debounceTimer]);

  // Handle file error reporting in a structured way
  const reportError = useCallback((errorType, ...args) => {
    if (!FILE_ERRORS[errorType]) {
      errorType = 'UNKNOWN_ERROR';
    }
    
    const error = {
      ...FILE_ERRORS[errorType],
      timestamp: new Date().toISOString(),
      fileInfo: selectedFile ? {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        extension: getFileExtension(selectedFile.name)
      } : null
    };
    
    const message = typeof error.message === 'function' 
      ? error.message(...args)
      : error.message;
    
    const errorObj = { ...error, message };
    setFileError(message);
    
    // Log event for telemetry
    if (onEvent) {
      onEvent('FILE_ERROR', {
        error: errorObj,
        retryAttempt
      });
    }
    
    if (typeof onError === 'function') {
      onError(errorObj);
    } else {
      console.warn('FileUploader:', message);
    }
  }, [onError, onEvent, selectedFile, retryAttempt]);

  // Report events for telemetry with debouncing for high-frequency events
  const reportEvent = useCallback((eventName, data = {}, shouldDebounce = false) => {
    if (typeof onEvent !== 'function') return;
    
    const sendEvent = () => {
      onEvent(eventName, {
        timestamp: new Date().toISOString(),
        component: 'FileUploader',
        ...data
      });
    };
    
    if (shouldDebounce) {
      if (debounceTimer) clearTimeout(debounceTimer);
      const newTimer = setTimeout(() => {
        sendEvent();
        setDebounceTimer(null);
      }, debounceDelay);
      setDebounceTimer(newTimer);
    } else {
      sendEvent();
    }
  }, [onEvent, debounceTimer, debounceDelay]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setFileError(null);
  }, []);

  // Announce to screen readers
  const announce = useCallback((message) => {
    setSrAnnouncement(message);
  }, []);

  // Enhanced drag handlers that preserve original behavior
  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Call original handler with the event and true for dragActive
    handleDrag(e, true);
    setLocalDragActive(true);
    announce('File drop area active. Release to upload file.');
    reportEvent('DRAG_ENTER', {}, true);
  }, [handleDrag, announce, reportEvent]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!localDragActive) {
      // Call original handler with the event and true for dragActive
      handleDrag(e, true);
      setLocalDragActive(true);
      announce('File drop area active. Release to upload file.');
      reportEvent('DRAG_OVER', {}, true);
    }
  }, [handleDrag, localDragActive, announce, reportEvent]);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Call original handler with the event and false for dragActive
    handleDrag(e, false);
    setLocalDragActive(false);
    announce('File drop area inactive.');
    reportEvent('DRAG_LEAVE', {}, true);
  }, [handleDrag, announce, reportEvent]);

  // Enhanced drop handler with validation
  const onDropHandler = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Update drag state
    handleDrag(e, false);
    setLocalDragActive(false);
    
    try {
      // Clear previous errors
      clearErrors();
      
      // Check if files exist
      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        reportEvent('DROP_NO_FILES');
        return;
      }
      
      const file = e.dataTransfer.files[0];
      const extension = getFileExtension(file.name);
      
      // Report the event
      reportEvent('FILE_DROPPED', {
        fileSize: file.size,
        fileType: file.type,
        fileExtension: extension
      });
      
      // Sanitize filename if enabled
      if (sanitizeFilenames) {
        const sanitizedName = sanitizeFileName(file.name);
        if (sanitizedName !== file.name) {
          reportEvent('FILENAME_SANITIZED', {
            original: file.name,
            sanitized: sanitizedName
          });
        }
      }
      
      // Validate file size if maxFileSize is specified
      if (maxFileSize && file.size > maxFileSize) {
        reportError('INVALID_SIZE', maxFileSize);
        announce(`${mergedLabels.errorPrefixText}: File size exceeds the limit of ${formatFileSize(maxFileSize)}.`);
        return;
      }
      
      // Validate file type if validFileTypes is specified
      if (validFileTypes && validFileTypes.length > 0) {
        const isValidType = validFileTypes.some(type => {
          // Check both MIME type and extension
          return file.type.includes(type) || 
                 type.includes(extension) || 
                 type === '.' + extension;
        });
        
        if (!isValidType) {
          reportError('INVALID_TYPE', validFileTypes);
          announce(`${mergedLabels.errorPrefixText}: Unsupported file format. Please upload a valid file type.`);
          return;
        }
      }
      
      // Call original drop handler
      handleDrop(e);
      announce(`File ${file.name} selected successfully.`);
    } catch (error) {
      reportError('UNKNOWN_ERROR');
      console.error('FileUploader drop error:', error);
    }
  }, [handleDrag, handleDrop, clearErrors, reportError, reportEvent, maxFileSize, validFileTypes, sanitizeFilenames, announce, mergedLabels.errorPrefixText]);

  // Enhanced file selection handler with validation
  const onFileInputChange = useCallback((e) => {
    try {
      // Clear previous errors
      clearErrors();
      
      if (!e.target.files || e.target.files.length === 0) {
        reportEvent('INPUT_NO_FILES');
        return;
      }
      
      const file = e.target.files[0];
      const extension = getFileExtension(file.name);
      
      // Report the event
      reportEvent('FILE_SELECTED', {
        fileSize: file.size,
        fileType: file.type,
        fileExtension: extension,
        selectionMethod: 'input'
      });
      
      // Validate file size if maxFileSize is specified
      if (maxFileSize && file.size > maxFileSize) {
        reportError('INVALID_SIZE', maxFileSize);
        announce(`${mergedLabels.errorPrefixText}: File size exceeds the limit of ${formatFileSize(maxFileSize)}.`);
        return;
      }
      
      // Validate file type if validFileTypes is specified
      if (validFileTypes && validFileTypes.length > 0) {
        const isValidType = validFileTypes.some(type => {
          // Check both MIME type and extension
          return file.type.includes(type) || 
                 type.includes(extension) || 
                 type === '.' + extension;
        });
        
        if (!isValidType) {
          reportError('INVALID_TYPE', validFileTypes);
          announce(`${mergedLabels.errorPrefixText}: Unsupported file format. Please upload a valid file type.`);
          return;
        }
      }
      
      // Call original handler
      handleFileSelect(e);
      announce(`File ${file.name} selected successfully.`);
    } catch (error) {
      reportError('UNKNOWN_ERROR');
      console.error('FileUploader selection error:', error);
    }
  }, [handleFileSelect, clearErrors, reportError, reportEvent, maxFileSize, validFileTypes, announce, mergedLabels.errorPrefixText]);
  
  // Safe wrapper for clearSelectedFile
  const safelyRemoveFile = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      clearErrors();
      clearSelectedFile();
      reportEvent('FILE_REMOVED');
      announce('File removed.');
    } catch (error) {
      console.error('Error clearing file:', error);
    }
  }, [clearSelectedFile, clearErrors, reportEvent, announce]);
  
  // Handle keyboard accessibility
  const handleKeyDown = useCallback((e) => {
    // Handle Enter or Space key for a11y
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      actualFileInputRef.current?.click();
      reportEvent('KEY_NAVIGATION', { key: e.key });
    }
  }, [actualFileInputRef, reportEvent]);

  // Handle retry
  const handleRetry = useCallback(() => {
    clearErrors();
    setRetryAttempt(prev => prev + 1);
    reportEvent('RETRY_INITIATED', { attemptNumber: retryAttempt + 1 });
    announce('Retrying file selection.');
    actualFileInputRef.current?.click();
  }, [clearErrors, reportEvent, retryAttempt, actualFileInputRef, announce]);
  
  // Get display name for file types
  const getFileTypesDisplay = useCallback(() => {
    if (!validFileTypes || !validFileTypes.length) return '';
    
    return validFileTypes.map(type => {
      const cleaned = type
        .replace('application/', '')
        .replace('text/', '')
        .replace('image/', '')
        .replace('audio/', '')
        .replace('video/', '')
        .replace('.', '');
      
      return cleaned;
    }).join(', ');
  }, [validFileTypes]);

  return (
    <div className={`file-uploader mb-4 ${className}`}>
      {/* Hidden element for screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {srAnnouncement}
      </div>
      
      {/* Error message if present */}
      {fileError && (
        <div className="mb-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" role="alert">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>{fileError}</span>
            
            {enableRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="ml-auto text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                aria-label={mergedLabels.retryText}
              >
                {mergedLabels.retryText}
              </button>
            )}
          </div>
        </div>
      )}
      
      {selectedFile ? (
        /* Selected file display - preserved from original */
        <div className="border rounded p-3 bg-gray-50 dark:bg-gray-800" aria-live="polite">
          <div className="flex justify-between">
            <div>
              <p className="font-medium dark:text-gray-200">{selectedFile.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
              </p>
            </div>
            <button 
              onClick={safelyRemoveFile}
              className="text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 rounded-full p-1"
              disabled={loading}
              data-tooltip-id="clear-file-tooltip"
              data-tooltip-content={mergedLabels.removeFileText}
              aria-label={mergedLabels.removeFileText}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <Tooltip id="clear-file-tooltip" place="left" />
          </div>
          {filePreview && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{mergedLabels.previewText}:</p>
              <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-20 dark:text-gray-300">{filePreview}</pre>
            </div>
          )}
        </div>
      ) : (
        /* File upload area - preserved from original with enhanced handlers */
        <div 
          ref={componentRef}
          className={`border-2 border-dashed ${localDragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} rounded-lg p-6 text-center transition-colors duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={loading ? undefined : onDragEnter}
          onDragOver={loading ? undefined : onDragOver}
          onDragLeave={loading ? undefined : onDragLeave}
          onDrop={loading ? undefined : onDropHandler}
          onClick={loading ? undefined : () => actualFileInputRef.current?.click()}
          onKeyDown={loading ? undefined : handleKeyDown}
          tabIndex={loading ? -1 : 0}
          role="button"
          aria-disabled={loading}
          aria-label={mergedLabels.dropzoneText}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`mx-auto h-12 w-12 ${localDragActive ? 'text-blue-500' : 'text-gray-400'} transition-colors duration-200`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className={`mt-1 text-sm ${localDragActive ? 'text-blue-500 font-medium' : 'text-gray-500 dark:text-gray-400'} transition-colors duration-200`}>
            {localDragActive ? mergedLabels.dropActiveText : mergedLabels.dropzoneText}
          </p>
          
          {/* Show file type/size constraints if provided */}
          {(validFileTypes || maxFileSize) && (
            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              {validFileTypes && validFileTypes.length > 0 && (
                <p>{mergedLabels.supportedFormatsText}: {getFileTypesDisplay()}</p>
              )}
              {maxFileSize && (
                <p>{mergedLabels.maxSizeText}: {formatFileSize(maxFileSize)}</p>
              )}
            </div>
          )}
          
          <input
            ref={actualFileInputRef}
            id="file-upload"
            type="file"
            onChange={onFileInputChange}
            className="hidden"
            disabled={loading}
            accept={validFileTypes ? validFileTypes.join(',') : undefined}
            aria-label="File upload"
          />
        </div>
      )}
    </div>
  );
};

// PropTypes for documentation and runtime validation
FileUploader.propTypes = {
  selectedFile: PropTypes.object,
  filePreview: PropTypes.string,
  dragActive: PropTypes.bool,
  fileInputRef: PropTypes.shape({ current: PropTypes.any }),
  handleDrag: PropTypes.func.isRequired,
  handleDrop: PropTypes.func.isRequired,
  handleFileSelect: PropTypes.func.isRequired,
  clearSelectedFile: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  // New optional props
  onError: PropTypes.func,
  onEvent: PropTypes.func,
  maxFileSize: PropTypes.number,
  validFileTypes: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string,
  enableRetry: PropTypes.bool,
  sanitizeFilenames: PropTypes.bool,
  autoFocus: PropTypes.bool,
  darkMode: PropTypes.bool,
  labels: PropTypes.shape({
    dropzoneText: PropTypes.string,
    dropActiveText: PropTypes.string,
    maxSizeText: PropTypes.string,
    supportedFormatsText: PropTypes.string,
    removeFileText: PropTypes.string,
    previewText: PropTypes.string,
    retryText: PropTypes.string,
    errorPrefixText: PropTypes.string
  }),
  debounceDelay: PropTypes.number
};

// Remove defaultProps and use parameter defaults instead

export default FileUploader;