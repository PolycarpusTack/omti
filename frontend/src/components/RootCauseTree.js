import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * RootCauseTree Component
 * Extracts and displays cause-effect relationships from analysis text
 * 
 * @param {Object} props
 * @param {Object} props.analysis - Analysis object containing technical_analysis or crash_resolution_report
 * @returns {JSX.Element|null}
 */
const RootCauseTree = ({ analysis }) => {
  // Validate input structure
  const isValidAnalysis = useMemo(() => {
    return analysis && typeof analysis === 'object' && 
      (typeof analysis.technical_analysis === 'string' || 
       typeof analysis.crash_resolution_report === 'string');
  }, [analysis]);

  // Extract cause-effect relationships
  const causes = useMemo(() => {
    if (!isValidAnalysis) return [];
    
    const text = String(analysis.technical_analysis || analysis.crash_resolution_report || '');
    const causePattern = /([^.]*?(?:caused by|due to|because of|result of|led to|triggered|initiated)[^.]*\.)/gi;
    
    const matches = [...text.matchAll(causePattern)];
    const validCauses = [];

    matches.forEach((match) => {
      const sentence = match[1]?.trim();
      if (!sentence) return;

      // Split into cause and effect parts with safety checks
      const splitRegex = /(caused by|due to|because of|result of|led to|triggered|initiated)/i;
      const splitIndex = sentence.search(splitRegex);
      if (splitIndex === -1) return;

      const effectPart = sentence.slice(0, splitIndex).trim();
      const causePart = sentence.slice(splitIndex + match[0].match(splitRegex)[0].length).trim();

      if (effectPart && causePart) {
        validCauses.push({
          id: uuidv4(),
          effect: effectPart.replace(/,$/, ''), // Remove trailing commas
          cause: causePart.replace(/\.$/, '')   // Remove trailing periods
        });
      }
    });

    return validCauses;
  }, [analysis, isValidAnalysis]);

  // Don't render if no valid cause-effect relationships found
  if (!isValidAnalysis) {
    return (
      <div className="mt-4 p-4 border rounded bg-yellow-50 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
        Invalid or missing analysis data for root cause detection.
      </div>
    );
  }

  if (causes.length === 0) return null;

  return (
    <div className="mt-4 border rounded p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="font-semibold mb-2 dark:text-gray-200">Root Cause Analysis</h3>
      <div className="flex flex-col space-y-3">
        {causes.map((cause, idx) => (
          <div 
            key={cause.id}
            className="group relative mb-2 flex items-start p-3 rounded-lg bg-white dark:bg-gray-700 shadow-sm hover:shadow-md transition-shadow"
            role="listitem"
          >
            <span className="mr-3 font-medium text-gray-500 dark:text-gray-300">
              {idx + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {cause.effect}
              </div>
              {cause.cause && (
                <div className="ml-4 mt-2 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Root cause:</span> {cause.cause}
                  </p>
                  {idx < causes.length - 1 && (
                    <div className="absolute bottom-0 left-0 ml-5 border-l-2 border-gray-200 dark:border-gray-600 h-6" 
                         aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

RootCauseTree.propTypes = {
  analysis: PropTypes.shape({
    technical_analysis: PropTypes.string,
    crash_resolution_report: PropTypes.string
  }).isRequired
};

export default RootCauseTree;