import React from 'react';
import CollapsibleSection from '../UI/CollapsibleSection';
import CopyMenu from '../UI/CopyMenu';
import { determineSeverity, highlightAll } from '../../utils/highlighter';

export const AnalysisResultItem = React.memo(({ result, highlightOptions, language }) => {
  const { technical_analysis, simplified_analysis, suggested_solutions, error } = result;
  
  // Create a unique ID for the analysis
  const analysisId = result.timestamp 
    ? `analysis-${new Date(result.timestamp).getTime()}`
    : `analysis-${Date.now()}`;
  
  // Determine severity from technical analysis
  const technicalSeverity = technical_analysis
    ? determineSeverity(technical_analysis)
    : 'info';
    
  // Determine severity from suggested solutions
  const solutionsSeverity = suggested_solutions
    ? determineSeverity(suggested_solutions)
    : 'info';
  
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-4">
        <div className="text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 flex justify-between items-start border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Analysis Result
          </h3>
          {result.timestamp && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Generated on {new Date(result.timestamp).toLocaleString()}
            </p>
          )}
        </div>
        
        <div className="flex space-x-2">
          <CopyMenu
            analysis={result}
            onCopy={() => {}}
            highlightOptions={highlightOptions}
          />
        </div>
      </div>
      
      {/* Technical Analysis */}
      <CollapsibleSection
        title="Technical Analysis"
        defaultOpen={true}
        severity={technicalSeverity}
      >
        <div 
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={
            highlightAll(technical_analysis, highlightOptions)
          }
        />
      </CollapsibleSection>
      
      {/* Simplified Analysis */}
      <CollapsibleSection
        title="Simplified Analysis"
        defaultOpen={true}
        severity="info"
      >
        <div 
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={
            highlightAll(simplified_analysis, highlightOptions)
          }
        />
      </CollapsibleSection>
      
      {/* Suggested Solutions */}
      <CollapsibleSection
        title="Suggested Solutions"
        defaultOpen={true}
        severity={solutionsSeverity}
      >
        <div 
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={
            highlightAll(suggested_solutions, highlightOptions)
          }
        />
      </CollapsibleSection>
    </div>
  );
}); 