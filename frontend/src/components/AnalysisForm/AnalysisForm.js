import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
import FileUploader from './FileUploader';
import StreamModeToggle from './StreamModeToggle';
import LLMSelector from '../../components/LLMSelector';
import VanillaButton from '../../components/Common/VanillaButton';

// Constants for error handling
const ERROR_CODES = {
  FILE_TOO_LARGE: 'File size exceeds the 10MB limit',
  INVALID_FILE_TYPE: 'Unsupported file format',
  ANALYSIS_FAILED: 'Analysis failed - please try again',
  NETWORK_ERROR: 'Network connection error',
  TIMEOUT_ERROR: 'Request timed out',
};

// Max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Valid file types
const VALID_FILE_TYPES = [
  'text/plain', 'text/csv', 'application/json', 
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml', 'text/xml'
];

/**
 * Error message component
 */
const ErrorMessage = ({ error, onDismiss }) => {
  if (!error) return null;
  
  return (
    <div 
      className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative" 
      role="alert"
      aria-live="assertive"
    >
      <strong className="font-bold mr-1">Error:</strong>
      <span className="block sm:inline">{error}</span>
      <button
        className="absolute top-0 bottom-0 right-0 px-4 py-3"
        onClick={onDismiss}
        aria-label="Close error message"
        type="button"
      >
        <span className="text-xl">&times;</span>
      </button>
    </div>
  );
};

ErrorMessage.propTypes = {
  error: PropTypes.string,
  onDismiss: PropTypes.func.isRequired
};

/**
 * Loading spinner component
 */
const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

/**
 * AnalysisForm component for handling file uploads and analysis configuration
 */
const AnalysisForm = ({
  // File handling props
  selectedFile,
  filePreview,
  dragActive = false,
  fileInputRef,
  handleDrag,
  handleDrop,
  handleFileSelect,
  clearSelectedFile,
  
  // Analysis configuration
  streamMode = false,
  onStreamModeChange,
  analysisType = 'default',
  
  // Model selection
  selectedModel,
  onModelSelect,
  
  // Action handlers
  onAnalyze,
  onDownload,
  onShare,
  showPatternInsights = false,
  onShowPatternInsights,
  patternInsightsCount = 0,
  
  // State flags
  loading = false,
  analyses = [],
  showExportOptions = false,
  toggleExportOptions,
  setExportFormat,
  
  // Debug
  analyzeButtonRef
}) => {
  // Local state
  const [error, setError] = useState(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const exportDropdownRef = useRef(null);
  const localButtonRef = useRef(null);
  const buttonRef = analyzeButtonRef || localButtonRef;
  const [clickCount, setClickCount] = useState(0);

  // Debug logging for button state
  useEffect(() => {
    console.log('Selected File:', selectedFile);
    console.log('Loading State:', loading);
    console.log('Button Enabled:', isButtonEnabled);
  }, [selectedFile, loading, isButtonEnabled]);

  // File validation
  const validateFile = useCallback((file) => {
    if (!file) return false;
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(ERROR_CODES.FILE_TOO_LARGE);
      return false;
    }
    
    // Check file type
    const isValidType = VALID_FILE_TYPES.includes(file.type);
    if (!isValidType) {
      setError(ERROR_CODES.INVALID_FILE_TYPE);
      return false;
    }
    
    return true;
  }, []);

  // Update button state when selectedFile changes
  useEffect(() => {
    if (selectedFile && !loading) {
      const isValid = validateFile(selectedFile);
      setIsButtonEnabled(isValid);
    } else {
      setIsButtonEnabled(false);
    }
  }, [selectedFile, loading, validateFile]);

  // Handle clicks outside the export dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportDropdownRef.current && 
        !exportDropdownRef.current.contains(event.target) && 
        showExportOptions
      ) {
        toggleExportOptions();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportOptions, toggleExportOptions]);

  // Hack to prevent spurious form submission
  useEffect(() => {
    // Find any parent form elements and prevent their default submission
    if (buttonRef.current) {
      let parent = buttonRef.current.parentElement;
      while (parent) {
        if (parent.tagName === 'FORM') {
          parent.onsubmit = (e) => {
            e.preventDefault();
            console.log('Prevented form submission');
            return false;
          };
          break;
        }
        parent = parent.parentElement;
      }
    }
  }, [buttonRef.current]);

  // Memoized available analyses
  const completedAnalyses = useMemo(() => 
    analyses.filter(analysis => analysis.status === 'completed'),
    [analyses]
  );

  // Simple direct handler for analyze button
  const handleAnalyzeClick = useCallback(() => {
    console.log('handleAnalyzeClick called directly');
    setClickCount(prev => prev + 1);
    
    if (!selectedFile) {
      console.log('No file selected');
      setError('No file selected');
      return;
    }
    
    if (loading) {
      console.log('Already loading');
      return;
    }
    
    try {
      setError(null);
      console.log('Calling onAnalyze directly');
      onAnalyze();
    } catch (err) {
      console.error('Error in analyze handler:', err);
      setError(err.message || ERROR_CODES.ANALYSIS_FAILED);
    }
  }, [selectedFile, loading, onAnalyze, setError]);

  // Safe handler for download
  const handleDownload = useCallback((format) => {
    try {
      onDownload(format);
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download analysis results');
    }
  }, [onDownload]);

  // Safe handler for share
  const handleShare = useCallback(async () => {
    try {
      setError(null);
      await onShare();
    } catch (err) {
      console.error('Share error:', err);
      setError(err.message || 'Failed to generate shareable link');
    }
  }, [onShare]);

  // Handle keyboard accessibility for dropdown
  const handleKeyDown = useCallback((e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape' && showExportOptions) {
      e.preventDefault();
      toggleExportOptions();
    }
  }, [showExportOptions, toggleExportOptions]);

  return (
    <div className="analysis-form-container">
      {/* Error message display */}
      <ErrorMessage error={error} onDismiss={() => setError(null)} />

      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-3 bg-yellow-50 border rounded border-yellow-200">
          <h3 className="font-bold">Form Debug Info</h3>
          <p>Selected File: {selectedFile ? selectedFile.name : 'None'}</p>
          <p>Button Enabled: {isButtonEnabled ? 'Yes' : 'No'}</p>
          <p>Loading: {loading ? 'Yes' : 'No'}</p>
          <p>Click Count: {clickCount}</p>
          <div className="mt-2 flex gap-2">
            <button 
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm" 
              onClick={handleAnalyzeClick}
              type="button"
            >
              Debug Analyze
            </button>
            
            <button
              className="bg-purple-500 text-white px-3 py-1 rounded text-sm"
              onClick={() => {
                console.log({
                  selectedFile,
                  isButtonEnabled,
                  loading,
                  buttonRef: buttonRef.current
                });
              }}
              type="button"
            >
              Log State
            </button>
          </div>
        </div>
      )}

      {/* LLM Selector */}
      <LLMSelector 
        selectedModel={selectedModel}
        onModelSelect={onModelSelect}
        disabled={loading}
      />
      
      {/* Main form container */}
      <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 shadow-sm mt-4" role="form" aria-label="Analysis Configuration Form">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 flex-wrap">
            <h2 className="text-lg font-semibold dark:text-gray-200">Analysis Configuration</h2>
            <StreamModeToggle 
              streamMode={streamMode}
              onChange={onStreamModeChange}
              disabled={loading || analysisType === 'crash'}
            />
          </div>
          
          {/* File upload area */}
          <FileUploader
            selectedFile={selectedFile}
            filePreview={filePreview}
            dragActive={dragActive}
            fileInputRef={fileInputRef}
            handleDrag={handleDrag}
            handleDrop={handleDrop}
            handleFileSelect={(file) => {
              setError(null);
              handleFileSelect(file);
            }}
            clearSelectedFile={() => {
              setError(null);
              clearSelectedFile();
            }}
            loading={loading}
            onError={setError}
            maxFileSize={MAX_FILE_SIZE}
            validFileTypes={VALID_FILE_TYPES}
          />
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            {/* IMPORTANT: Use VanillaButton to bypass React's event system */}
            <VanillaButton
              onClick={handleAnalyzeClick}
              className={`px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-transform ${isButtonEnabled && !loading ? 'hover:scale-105' : 'opacity-50 cursor-not-allowed transform-none'}`}
              disabled={!isButtonEnabled || loading}
              ariaLabel={!selectedFile ? "Please select a file first" : loading ? "Analysis in progress" : "Begin analysis of the selected file"}
              dataTestId="analyze-button"
            >
              {loading ? (
                <span className="flex items-center">
                  <LoadingSpinner />
                  Analyzing...
                </span>
              ) : 'Analyze'}
            </VanillaButton>
            <Tooltip id="analyze-tooltip" place="top" />
            
            {/* Fallback standard button in case VanillaButton has issues */}
            <button
              onClick={handleAnalyzeClick}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded"
              disabled={!isButtonEnabled || loading}
              type="button"
            >
              Analyze (Fallback)
            </button>
            
            {completedAnalyses.length > 0 && !loading && (
              <>
                <div className="relative dropdown-container" ref={exportDropdownRef}>
                  <button
                    onClick={toggleExportOptions}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-transform hover:scale-105 flex items-center"
                    data-tooltip-id="download-tooltip"
                    data-tooltip-content="Download analysis results"
                    aria-expanded={showExportOptions}
                    aria-haspopup="true"
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDown(e, toggleExportOptions)}
                    type="button"
                  >
                    <span>Download</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showExportOptions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <Tooltip id="download-tooltip" place="top" />
                  
                  {/* Export format dropdown */}
                  {showExportOptions && (
                    <div 
                      className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-700 shadow-lg rounded-md overflow-hidden z-10"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="download-options"
                    >
                      {['txt', 'json', 'csv'].map((format, index) => (
                        <button 
                          key={format}
                          className="w-full px-4 py-2 text-left text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={() => {
                            handleDownload(format);
                            toggleExportOptions();
                          }}
                          role="menuitem"
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, () => {
                            handleDownload(format);
                            toggleExportOptions();
                          })}
                          type="button"
                        >
                          {format.toUpperCase()} (.{format})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleShare}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition-transform hover:scale-105"
                  data-tooltip-id="share-tooltip"
                  data-tooltip-content="Generate a shareable link"
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, handleShare)}
                  type="button"
                >
                  Share
                </button>
                <Tooltip id="share-tooltip" place="top" />
              </>
            )}
          </div>
          
          {patternInsightsCount > 0 && (
            <button
              onClick={onShowPatternInsights}
              className="flex items-center text-amber-500 hover:text-amber-600 transition-colors"
              data-tooltip-id="insights-tooltip"
              data-tooltip-content="View detected patterns across analyses"
              aria-label={`View ${patternInsightsCount} pattern insights`}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, onShowPatternInsights)}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span>Pattern Insights ({patternInsightsCount})</span>
            </button>
          )}
          <Tooltip id="insights-tooltip" place="left" />
        </div>
      </div>
    </div>
  );
};

// PropTypes for better documentation and runtime type checking
AnalysisForm.propTypes = {
  // File handling props
  selectedFile: PropTypes.object,
  filePreview: PropTypes.string,
  dragActive: PropTypes.bool,
  fileInputRef: PropTypes.object,
  handleDrag: PropTypes.func.isRequired,
  handleDrop: PropTypes.func.isRequired,
  handleFileSelect: PropTypes.func.isRequired,
  clearSelectedFile: PropTypes.func.isRequired,
  
  // Analysis configuration
  streamMode: PropTypes.bool,
  onStreamModeChange: PropTypes.func.isRequired,
  analysisType: PropTypes.string,
  
  // Model selection
  selectedModel: PropTypes.string,
  onModelSelect: PropTypes.func.isRequired,
  
  // Action handlers
  onAnalyze: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
  onShare: PropTypes.func.isRequired,
  showPatternInsights: PropTypes.bool,
  onShowPatternInsights: PropTypes.func,
  patternInsightsCount: PropTypes.number,
  
  // State flags
  loading: PropTypes.bool,
  analyses: PropTypes.array,
  showExportOptions: PropTypes.bool,
  toggleExportOptions: PropTypes.func.isRequired,
  setExportFormat: PropTypes.func.isRequired,
  
  // Debug
  analyzeButtonRef: PropTypes.object
};

export default AnalysisForm;