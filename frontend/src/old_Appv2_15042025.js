import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from 'next-themes';
import { DEFAULT_SETTINGS } from './constants';

// Components
import Header from './components/Header/Header';
import AnalysisForm from './components/AnalysisForm/AnalysisForm';
import ProgressIndicator from './components/Analysis/ProgressIndicator';
import SearchFilters from './components/Analysis/SearchFilters';
import AnalysisResults from './components/Analysis/AnalysisResults';
import IssuesSummary from './components/Analysis/IssuesSummary';
import ErrorDisplay from './components/UI/ErrorDisplay';
import EmptyState from './components/UI/EmptyState';
import { SettingsModal, HistoryModal, PatternInsightsModal, ShareModal } from './components/Modals';
import TroubleshootingWizard from './components/TroubleshootingWizard';
import HelpModal from './components/Modals/HelpModal';

// Hooks
import useAnalysis from './hooks/useAnalysis';
import useFileHandling from './hooks/useFileHandling';
import useFilters from './hooks/useFilters';
import useModalState from './hooks/useModalState';
import useCopyToClipboard from './hooks/useCopyToClipboard';
import useModelSelection from './hooks/useModelSelection';

function App() {
  // App configuration state
  const [language, setLanguage] = useState('en');
  const [analysisType, setAnalysisType] = useState('original');
  const [streamMode, setStreamMode] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [exportFormat, setExportFormat] = useState('txt');
  const [patternInsights, setPatternInsights] = useState([]);
  
  // Use custom hooks
  const { 
    selectedModel, 
    ollamaStatus, 
    modelProviders, 
    handleModelSelect 
  } = useModelSelection();
  
  const {
    analyses,
    loading,
    error,
    progress,
    progressStatus,
    categorizedIssues,
    setError,
    analyzeFile,
    loadAnalysis,
    loadFromSharedUrl,
    generateShareUrl,
    formatAnalysisForDownload,
    highlightErrors
  } = useAnalysis();
  
  const {
    selectedFile,
    filePreview,
    dragActive,
    fileInputRef,
    handleDrag,
    handleDrop,
    handleFileSelect,
    clearSelectedFile
  } = useFileHandling(setError);
  
  const {
    searchTerm,
    filterCriteria,
    filteredAnalyses,
    handleSearchChange,
    toggleSeverityFilter,
    toggleTypeFilter
  } = useFilters(analyses);
  
  const {
    showSettings,
    showHistory,
    showPatternInsights,
    showShareDialog,
    showTroubleshootingWizard,
    showExportOptions,
    showHelp,
    activeAnalysisForWizard,
    shareUrl,
    openSettings,
    closeSettings,
    openHistory,
    closeHistory,
    toggleHistory,
    openPatternInsights,
    closePatternInsights,
    openShareDialog,
    closeShareDialog,
    openTroubleshootingWizard,
    closeTroubleshootingWizard,
    toggleExportOptions,
    closeExportOptions,
    openHelp,
    closeHelp
  } = useModalState();
  
  const { copySuccess, copyToClipboard } = useCopyToClipboard(setError);
  
  // Load history from localStorage on mount
  const [analysisHistory, setAnalysisHistory] = useState([]);
  
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('analysisHistory');
      if (savedHistory) {
        setAnalysisHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
    
    // Check for shared URL parameters
    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('shared');
      if (shared) {
        loadFromSharedUrl(shared);
      }
    } catch (e) {
      console.error('Error parsing shared URL:', e);
    }
  }, [loadFromSharedUrl]);
  
  // Handle language change
  const handleLanguageChange = useCallback((selectedOption) => {
    if (!selectedOption || !selectedOption.value) {
      console.error('Invalid language option selected');
      return;
    }
    setLanguage(selectedOption.value);
  }, []);
  
  // Analyze patterns across analyses history
  const detectPatterns = useCallback(() => {
    if (analysisHistory.length < 2) return;
    
    const insights = [];
    const allAnalyses = analysisHistory.flatMap(h => 
      JSON.parse(localStorage.getItem(`analysis_${h.timestamp}`) || '[]')
    );
    
    // Error message frequency counter
    const errorMessages = {};
    const errorPatterns = [
      /([A-Z][a-z]+ (error|exception|failure):[^.]+)/g,
      /(failed to [^.]+)/gi,
      /(could not [^.]+)/gi
    ];
    
    allAnalyses.forEach(analysis => {
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''}`;
      
      errorPatterns.forEach(pattern => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
          const error = match[0].trim();
          errorMessages[error] = (errorMessages[error] || 0) + 1;
        });
      });
    });
    
    // Find recurring errors
    Object.entries(errorMessages)
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .slice(0, 5)  // Top 5 recurring issues
      .forEach(([error, count]) => {
        insights.push({
          type: 'recurring_error',
          message: error,
          frequency: count,
          suggestion: generateSuggestionForPattern(error)
        });
      });
    
    // Detect time-based patterns
    if (analysisHistory.length >= 3) {
      const timestamps = analysisHistory.map(h => new Date(h.timestamp));
      const timeDiffs = [];
      
      for (let i = 1; i < timestamps.length; i++) {
        timeDiffs.push(timestamps[i].getTime() - timestamps[i-1].getTime());
      }
      
      const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      const hoursDiff = avgTimeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        insights.push({
          type: 'time_pattern',
          message: `Issues occur approximately every ${hoursDiff.toFixed(1)} hours`,
          suggestion: "Consider investigating cyclical processes or scheduled tasks that run at this interval."
        });
      }
    }
    
    setPatternInsights(insights);
    return insights.length > 0;
  }, [analysisHistory]);
  
  // Generate suggestions based on detected patterns
  function generateSuggestionForPattern(error) {
    if (/memory|allocation|heap/i.test(error)) {
      return "Check for memory leaks in resource handling code. Consider implementing better cleanup procedures.";
    }
    
    if (/timeout|exceeded|slow/i.test(error)) {
      return "Review performance bottlenecks in related operations. Consider optimization or increasing timeout thresholds.";
    }
    
    if (/permission|access|denied/i.test(error)) {
      return "Verify access control settings and permissions for the affected resources.";
    }
    
    if (/network|connection|socket/i.test(error)) {
      return "Check network connectivity and firewall settings. Ensure all required services are accessible.";
    }
    
    return "Review related code sections for potential improvements or error handling.";
  }
  
  // Handle pattern insights button click
  const handleShowPatternInsights = useCallback(() => {
    const hasInsights = detectPatterns();
    if (hasInsights) {
      openPatternInsights();
    } else {
      setError('No pattern insights available');
    }
  }, [detectPatterns, openPatternInsights, setError]);
  
  // Handle analysis submission
  const handleAnalyze = useCallback(() => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }
    
    analyzeFile(selectedFile, {
      language,
      model: selectedModel,
      maxTokensPerChunk: settings.maxTokensPerChunk,
      timeout: settings.timeout,
      analysisType,
      streamMode
    });
  }, [
    selectedFile, 
    language, 
    selectedModel, 
    settings.maxTokensPerChunk, 
    settings.timeout, 
    analysisType, 
    streamMode, 
    analyzeFile, 
    setError
  ]);
  
  // Handle download of analysis
  const handleDownload = useCallback((format = 'txt') => {
    try {
      const formattedData = formatAnalysisForDownload(format);
      if (!formattedData) return;
      
      const { data, type, extension } = formattedData;
      
      const blob = new Blob([data], { type });
      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = `WCR-analysis-${new Date().toISOString().slice(0, 10)}.${extension}`;
      document.body.appendChild(element);
      element.click();

      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(element.href);
        document.body.removeChild(element);
      }, 100);
    } catch (err) {
      console.error('Download error:', err);
      setError(`Failed to download analysis: ${err.message || 'Unknown error'}`);
    }
  }, [formatAnalysisForDownload, setError]);
  
  // Handle share button click
  const handleShare = useCallback(() => {
    const url = generateShareUrl();
    if (url) {
      openShareDialog(url);
    }
  }, [generateShareUrl, openShareDialog]);
  
  // Handle history loading
  const handleLoadHistory = useCallback((historyItem) => {
    const success = loadAnalysis(historyItem);
    if (success) {
      closeHistory();
    }
  }, [loadAnalysis, closeHistory]);
  
  // Handle clearing history
  const handleClearHistory = useCallback(() => {
    localStorage.removeItem('analysisHistory');
    setAnalysisHistory([]);
  }, []);
  
  return (
    <ThemeProvider attribute="class">
      <div className="min-h-screen bg-gray-100 dark:bg-gray-800 p-6 relative">
        {/* Header with controls */}
        <Header 
          language={language}
          onLanguageChange={handleLanguageChange}
          analysisType={analysisType}
          onAnalysisTypeChange={setAnalysisType}
          onOpenSettings={openSettings}
          onToggleHistory={toggleHistory}
          onOpenHelp={openHelp}
          ollamaStatus={ollamaStatus}
        />

        <h1 className="text-4xl font-bold text-center mb-4 pt-16 dark:text-white">One More Thing Insights 🚀</h1>
        
        {/* Main content area */}
        <div id="main-content" className="mt-6 max-w-4xl mx-auto">
          {/* Analysis form with LLM selector */}
          <AnalysisForm 
            // File handling props
            selectedFile={selectedFile}
            filePreview={filePreview}
            dragActive={dragActive}
            fileInputRef={fileInputRef}
            handleDrag={handleDrag}
            handleDrop={handleDrop}
            handleFileSelect={handleFileSelect}
            clearSelectedFile={clearSelectedFile}
            
            // Analysis configuration
            streamMode={streamMode}
            onStreamModeChange={setStreamMode}
            analysisType={analysisType}
            
            // Model selection
            selectedModel={selectedModel}
            onModelSelect={handleModelSelect}
            
            // Action handlers
            onAnalyze={handleAnalyze}
            onDownload={handleDownload}
            onShare={handleShare}
            showPatternInsights={showPatternInsights}
            onShowPatternInsights={handleShowPatternInsights}
            patternInsightsCount={patternInsights.length}
            
            // State flags
            loading={loading}
            analyses={analyses}
            showExportOptions={showExportOptions}
            toggleExportOptions={toggleExportOptions}
            setExportFormat={setExportFormat}
          />
          
          {/* Progress indicator */}
          {loading && (
            <ProgressIndicator 
              progress={progress} 
              status={progressStatus}
              analysisType={analysisType}
              analysesCount={analyses.length}
              totalChunks={analyses.length > 0 ? analyses[0].total_chunks : null}
            />
          )}
          
          {/* Error display */}
          <ErrorDisplay message={error} />
          
          {/* Results section */}
          {!loading && (
            <>
              {/* Issue summary */}
              {Object.values(categorizedIssues).some(list => list.length > 0) && (
                <IssuesSummary issues={categorizedIssues} />
              )}
              
              {/* Search and filters */}
              {analyses.length > 0 && (
                <SearchFilters 
                  searchTerm={searchTerm}
                  onSearchChange={handleSearchChange}
                  filterCriteria={filterCriteria}
                  toggleSeverityFilter={toggleSeverityFilter}
                  toggleTypeFilter={toggleTypeFilter}
                />
              )}
              
              {/* Empty state */}
              {analyses.length === 0 && !error && (
                <EmptyState />
              )}
              
              {/* Analysis results */}
              <AnalysisResults 
                analyses={analyses}
                filteredAnalyses={filteredAnalyses}
                totalCount={analyses.length}
                copySuccess={copySuccess}
                onCopy={copyToClipboard}
                onStartTroubleshooting={openTroubleshootingWizard}
                highlightErrors={highlightErrors}
              />
            </>
          )}
        </div>
        
        {/* Modals */}
        {showSettings && (
          <SettingsModal 
            settings={settings}
            onSettingsChange={setSettings}
            onClose={closeSettings}
          />
        )}
        
        {showHistory && (
          <HistoryModal 
            analysisHistory={analysisHistory}
            onLoadHistory={handleLoadHistory}
            onClearHistory={handleClearHistory}
            onClose={closeHistory}
          />
        )}
        
        {showPatternInsights && patternInsights.length > 0 && (
          <PatternInsightsModal 
            insights={patternInsights}
            onClose={closePatternInsights}
          />
        )}
        
        {showShareDialog && (
          <ShareModal 
            shareUrl={shareUrl}
            copySuccess={copySuccess}
            onCopy={copyToClipboard}
            onClose={closeShareDialog}
          />
        )}
        
        {showHelp && (
          <HelpModal
            onClose={closeHelp}
          />
        )}
        
        {showTroubleshootingWizard && activeAnalysisForWizard && (
          <TroubleshootingWizard 
            analysis={activeAnalysisForWizard} 
            onClose={closeTroubleshootingWizard}
            onBack={() => {
              // This will be implemented in the TroubleshootingWizard component
              // to enable navigating back to previous steps
            }}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;