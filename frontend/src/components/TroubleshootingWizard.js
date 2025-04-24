import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TroubleshootingWizard Component
 * Provides a step-by-step guided troubleshooting experience based on analysis
 * 
 * @param {Object} props
 * @param {Object} props.analysis - Analysis object containing technical_analysis or crash reports
 * @param {Function} props.onClose - Function to close the wizard
 * @param {Function} props.onBack - Function to handle back navigation at outer level (optional)
 * @returns {JSX.Element}
 */
const TroubleshootingWizard = ({ analysis, onClose, onBack }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [userResponses, setUserResponses] = useState({});
  const [validationError, setValidationError] = useState(null);
  // Track step history for back button functionality
  const [stepHistory, setStepHistory] = useState([]);
  // Track detailed progress status
  const [progressStatus, setProgressStatus] = useState('Starting troubleshooting...');

  // Reset state when analysis changes
  useEffect(() => {
    setCurrentStep(0);
    setUserResponses({});
    setValidationError(null);
    setStepHistory([]);
    setProgressStatus('Starting troubleshooting...');
  }, [analysis]);

  // Validate analysis structure
  useEffect(() => {
    if (!analysis || typeof analysis !== 'object') {
      setValidationError('Invalid analysis data provided');
    } else if (!analysis.crash_resolution_report && !analysis.technical_analysis) {
      setValidationError('Analysis data is incomplete');
    } else {
      setValidationError(null);
    }
  }, [analysis]);

  // Generate steps based on the analysis
  const steps = useMemo(() => {
    if (validationError) return [];
    
    const content = String(analysis.crash_resolution_report || analysis.technical_analysis || '');
    const steps = [];
    
    // Default steps for any analysis
    steps.push({
      id: 'previous_experience',
      question: "Have you seen this issue before?",
      description: "Knowing if this is a recurring issue helps determine the approach.",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" }
      ]
    });
    
    // Detect if crash-related
    if (/(crash|exception|fatal error)/i.test(content)) {
      steps.push({
        id: 'crash_reproducibility',
        question: "Can you reproduce the crash consistently?",
        description: "Understanding reproducibility helps diagnose the root cause.",
        options: [
          { label: "Yes", value: "yes" },
          { label: "Sometimes", value: "sometimes" },
          { label: "No", value: "no" }
        ]
      });
    }
    
    // Detect if memory-related
    if (/(memory leak|allocation|heap|out of memory)/i.test(content)) {
      steps.push({
        id: 'memory_usage',
        question: "Does the issue occur under high load?",
        description: "Memory issues often manifest when the system is under stress.",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
          { label: "Unsure", value: "unsure" }
        ]
      });
    }
    
    // Detect if timeout-related
    if (/(timeout|exceeded|slow|performance)/i.test(content)) {
      steps.push({
        id: 'timing_issue',
        question: "Did this issue start after a recent code or infrastructure change?",
        description: "Correlating with recent changes can help isolate the cause.",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
          { label: "Unsure", value: "unsure" }
        ]
      });
    }
    
    // Always add a final step
    steps.push({
      id: 'final_decision',
      question: "Would you like to implement the suggested solution now?",
      description: "Based on the information gathered, we can recommend next steps.",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No, I need more information", value: "no" }
      ]
    });
    
    return steps;
  }, [analysis, validationError]);

  const handleResponse = (response) => {
    if (currentStep >= steps.length) return;
    
    // Save current step to history before advancing
    setStepHistory(prev => [...prev, currentStep]);
    
    setUserResponses(prev => ({ 
      ...prev, 
      [steps[currentStep].id]: response 
    }));
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setProgressStatus(`Step ${currentStep + 2} of ${steps.length}`);
    } else {
      setCurrentStep(prev => prev + 1); // Move to final step
      setProgressStatus('Generating recommendations...');
    }
  };
  
  // Handle going back to the previous step
  const handleBack = () => {
    if (stepHistory.length === 0) {
      // If there's no history but there's an onBack prop, call it
      if (onBack) onBack();
      return;
    }
    
    // Pop the last step from history
    const newHistory = [...stepHistory];
    const previousStep = newHistory.pop();
    
    // Go back to that step
    setCurrentStep(previousStep);
    setStepHistory(newHistory);
    setProgressStatus(`Step ${previousStep + 1} of ${steps.length}`);
  };

  const generateRecommendation = () => {
    if (!steps.length) return 'No recommendation available';

    // Previous experience check
    if (userResponses.previous_experience === "yes") {
      return "Since you've seen this issue before, check your previous resolution steps. The current analysis suggests focusing on the same area.";
    }

    // Final decision check
    if (userResponses.final_decision === "no") {
      return "For more detailed information, consider capturing additional logs with increased verbosity or consulting with the development team about this specific issue.";
    }

    // Memory-related check
    if (userResponses.memory_usage === "yes") {
      return "This appears to be a memory-related issue that manifests under load. Consider implementing memory usage monitoring, adding memory limits, and reviewing resource-intensive operations in your code.";
    }

    // Timeout-related check
    if (userResponses.timing_issue === "yes") {
      return "The timing-related issues suggest recent changes might be involved. Consider rolling back recent deployments or conducting A/B testing with previous versions.";
    }

    // Default recommendation
    return "Based on the analysis, we recommend implementing the suggested fix and monitoring the system for recurrence. If the issue persists, please collect more detailed logs.";
  };

  if (validationError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
          <div className="text-red-500 dark:text-red-400 font-medium mb-2">
            Error: {validationError}
          </div>
          <button
            onClick={onClose}
            className="mt-3 text-blue-500 text-sm hover:underline"
          >
            Close Wizard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold dark:text-gray-200">Guided Troubleshooting</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close troubleshooting wizard"
            data-tooltip-id="close-wizard-tooltip"
            data-tooltip-content="Close wizard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex justify-between mb-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{currentStep < steps.length ? `Step ${currentStep + 1} of ${steps.length}` : 'Complete'}</span>
            <span>{progressStatus}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${currentStep >= steps.length ? 100 : (currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-${currentStep}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep < steps.length ? (
              <div>
                <div className="text-md font-medium mb-2 dark:text-gray-200">
                  {steps[currentStep]?.question || 'Question not available'}
                </div>
                
                {steps[currentStep]?.description && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {steps[currentStep].description}
                  </div>
                )}
                
                <div className="space-y-2 mb-6">
                  {steps[currentStep]?.options?.map((option, idx) => (
                    <button
                      key={`option-${steps[currentStep].id}-${idx}`}
                      onClick={() => handleResponse(option.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleResponse(option.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200 transition-colors text-left"
                      role="button"
                      tabIndex={0}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                
                {/* Back button */}
                <div className="flex justify-start">
                  <button
                    onClick={handleBack}
                    className={`px-4 py-2 text-gray-700 dark:text-gray-200 rounded flex items-center ${
                      stepHistory.length > 0 
                        ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors' 
                        : 'bg-gray-100 opacity-50 cursor-not-allowed dark:bg-gray-800'
                    }`}
                    disabled={stepHistory.length === 0}
                    aria-label="Go back to previous step"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-green-600 dark:text-green-400 font-medium mb-3">
                  ✓ Troubleshooting complete
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded mb-4">
                  <h4 className="font-medium mb-2 dark:text-gray-200">Recommendation:</h4>
                  <p className="dark:text-gray-300">{generateRecommendation()}</p>
                </div>
                <div className="flex justify-between">
                  <button
                    onClick={handleBack}
                    className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Back
                  </button>
                  
                  <div className="space-x-3">
                    <button
                      onClick={() => {
                        setCurrentStep(0);
                        setUserResponses({});
                        setStepHistory([]);
                        setProgressStatus('Starting troubleshooting...');
                      }}
                      className="px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      Close Wizard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

TroubleshootingWizard.propTypes = {
  analysis: PropTypes.shape({
    crash_resolution_report: PropTypes.string,
    technical_analysis: PropTypes.string
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onBack: PropTypes.func
};

export default TroubleshootingWizard;