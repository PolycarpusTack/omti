import { useState, useCallback } from 'react';

const useModalState = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPatternInsights, setShowPatternInsights] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTroubleshootingWizard, setShowTroubleshootingWizard] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeAnalysisForWizard, setActiveAnalysisForWizard] = useState(null);
  const [shareUrl, setShareUrl] = useState('');

  // Settings modal handlers
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  
  // History modal handlers
  const openHistory = useCallback(() => setShowHistory(true), []);
  const closeHistory = useCallback(() => setShowHistory(false), []);
  const toggleHistory = useCallback(() => setShowHistory(prev => !prev), []);
  
  // Pattern insights modal handlers
  const openPatternInsights = useCallback(() => setShowPatternInsights(true), []);
  const closePatternInsights = useCallback(() => setShowPatternInsights(false), []);
  
  // Share dialog handlers
  const openShareDialog = useCallback((url) => {
    setShareUrl(url);
    setShowShareDialog(true);
  }, []);
  const closeShareDialog = useCallback(() => setShowShareDialog(false), []);
  
  // Troubleshooting wizard handlers
  const openTroubleshootingWizard = useCallback((analysis) => {
    setActiveAnalysisForWizard(analysis);
    setShowTroubleshootingWizard(true);
  }, []);
  const closeTroubleshootingWizard = useCallback(() => {
    setShowTroubleshootingWizard(false);
    setActiveAnalysisForWizard(null);
  }, []);
  
  // Export options handlers
  const toggleExportOptions = useCallback(() => {
    setShowExportOptions(prev => !prev);
  }, []);
  const closeExportOptions = useCallback(() => {
    setShowExportOptions(false);
  }, []);
  
  // Help modal handlers
  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);

  return {
    // States
    showSettings,
    showHistory,
    showPatternInsights,
    showShareDialog,
    showTroubleshootingWizard,
    showExportOptions,
    showHelp,
    activeAnalysisForWizard,
    shareUrl,
    
    // Actions
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
  };
};

export default useModalState;