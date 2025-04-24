// src/utils/copyUtils.js

/**
 * Utility functions for copying content in different formats
 */

import { highlightAll } from './highlighter';

/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<{success: boolean, message: string}>} - Result with feedback
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, message: 'Copied to clipboard!' };
  } catch (err) {
    console.error('Failed to copy text: ', err);
    
    // Provide more specific error messages based on common issues
    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'Permission denied. Please allow clipboard access.' };
    } else if (err.name === 'SecurityError') {
      return { success: false, message: 'Cannot copy in this context due to security restrictions.' };
    }
    
    return { success: false, message: 'Failed to copy to clipboard.' };
  }
};

/**
 * Format analysis as plain text
 * @param {Object} analysis - The analysis object
 * @returns {string} - Formatted plain text
 */
export const formatAsPlainText = (analysis) => {
  if (!analysis) return '';
  
  let result = '';
  
  if (analysis.chunk && analysis.total_chunks) {
    result += `=== ANALYSIS CHUNK ${analysis.chunk}/${analysis.total_chunks} ===\n`;
  }
  
  if (analysis.timestamp) {
    result += `Generated at: ${new Date(analysis.timestamp).toLocaleString()}\n\n`;
  }
  
  if (analysis.technical_analysis) {
    result += `--- TECHNICAL ANALYSIS ---\n${analysis.technical_analysis}\n\n`;
  }
  
  if (analysis.simplified_analysis) {
    result += `--- SIMPLIFIED EXPLANATION ---\n${analysis.simplified_analysis}\n\n`;
  }
  
  if (analysis.suggested_solutions) {
    result += `--- SUGGESTED SOLUTIONS ---\n${analysis.suggested_solutions}\n\n`;
  }
  
  if (analysis.crash_resolution_report) {
    result += `=== CRASH RESOLUTION REPORT ===\n${analysis.crash_resolution_report}\n\n`;
  }
  
  if (analysis.diagnostic_overview_report) {
    result += `=== DIAGNOSTIC OVERVIEW REPORT ===\n${analysis.diagnostic_overview_report}\n\n`;
  }
  
  return result;
};

/**
 * Format analysis as Markdown
 * @param {Object} analysis - The analysis object
 * @returns {string} - Formatted markdown text
 */
export const formatAsMarkdown = (analysis) => {
  if (!analysis) return '';
  
  let result = '';
  
  if (analysis.chunk && analysis.total_chunks) {
    result += `# Analysis Chunk ${analysis.chunk}/${analysis.total_chunks}\n\n`;
  }
  
  if (analysis.timestamp) {
    result += `*Generated at: ${new Date(analysis.timestamp).toLocaleString()}*\n\n`;
  }
  
  if (analysis.technical_analysis) {
    result += `## Technical Analysis\n\n${analysis.technical_analysis}\n\n`;
  }
  
  if (analysis.simplified_analysis) {
    result += `## Simplified Explanation\n\n${analysis.simplified_analysis}\n\n`;
  }
  
  if (analysis.suggested_solutions) {
    result += `## Suggested Solutions\n\n${analysis.suggested_solutions}\n\n`;
  }
  
  if (analysis.crash_resolution_report) {
    result += `# Crash Resolution Report\n\n${analysis.crash_resolution_report}\n\n`;
  }
  
  if (analysis.diagnostic_overview_report) {
    result += `# Diagnostic Overview Report\n\n${analysis.diagnostic_overview_report}\n\n`;
  }
  
  return result;
};

/**
 * Format analysis as HTML
 * @param {Object} analysis - The analysis object
 * @param {Object} highlightOptions - Optional highlighting options
 * @returns {string} - Formatted HTML text
 */
export const formatAsHTML = (analysis, highlightOptions = null) => {
  if (!analysis) return '';
  
  let result = '<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">';
  
  if (analysis.chunk && analysis.total_chunks) {
    result += `<h1 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Analysis Chunk ${analysis.chunk}/${analysis.total_chunks}</h1>`;
  }
  
  if (analysis.timestamp) {
    result += `<p style="color: #666; font-style: italic;">Generated at: ${new Date(analysis.timestamp).toLocaleString()}</p>`;
  }
  
  if (analysis.technical_analysis) {
    const content = highlightOptions 
      ? highlightAll(analysis.technical_analysis, highlightOptions).__html
      : analysis.technical_analysis.replace(/\n/g, '<br>');
      
    result += `
      <div style="margin: 20px 0;">
        <h2 style="color: #2563eb;">Technical Analysis</h2>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 5px solid #2563eb;">
          ${content}
        </div>
      </div>
    `;
  }
  
  if (analysis.simplified_analysis) {
    const content = highlightOptions 
      ? highlightAll(analysis.simplified_analysis, highlightOptions).__html
      : analysis.simplified_analysis.replace(/\n/g, '<br>');
      
    result += `
      <div style="margin: 20px 0;">
        <h2 style="color: #10b981;">Simplified Explanation</h2>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 5px solid #10b981;">
          ${content}
        </div>
      </div>
    `;
  }
  
  if (analysis.suggested_solutions) {
    const content = highlightOptions 
      ? highlightAll(analysis.suggested_solutions, highlightOptions).__html
      : analysis.suggested_solutions.replace(/\n/g, '<br>');
      
    result += `
      <div style="margin: 20px 0;">
        <h2 style="color: #f59e0b;">Suggested Solutions</h2>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 5px solid #f59e0b;">
          ${content}
        </div>
      </div>
    `;
  }
  
  if (analysis.crash_resolution_report) {
    const content = highlightOptions 
      ? highlightAll(analysis.crash_resolution_report, highlightOptions).__html
      : analysis.crash_resolution_report.replace(/\n/g, '<br>');
      
    result += `
      <div style="margin: 20px 0;">
        <h1 style="color: #ef4444; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Crash Resolution Report</h1>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 5px solid #ef4444;">
          ${content}
        </div>
      </div>
    `;
  }
  
  if (analysis.diagnostic_overview_report) {
    const content = highlightOptions 
      ? highlightAll(analysis.diagnostic_overview_report, highlightOptions).__html
      : analysis.diagnostic_overview_report.replace(/\n/g, '<br>');
      
    result += `
      <div style="margin: 20px 0;">
        <h1 style="color: #8b5cf6; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Diagnostic Overview Report</h1>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; border-left: 5px solid #8b5cf6;">
          ${content}
        </div>
      </div>
    `;
  }
  
  result += '</div>';
  
  return result;
};

/**
 * Format analysis as JSON
 * @param {Object} analysis - The analysis object
 * @returns {string} - JSON string
 */
export const formatAsJSON = (analysis) => {
  if (!analysis) return '{}';
  
  // Create a clean copy without any circular references
  const cleanAnalysis = JSON.parse(JSON.stringify(analysis));
  
  return JSON.stringify(cleanAnalysis, null, 2);
};

/**
 * Get/set the last used copy format preference
 * @param {string|null} format - Format to set, or null to retrieve
 * @returns {string} - The format ('text', 'markdown', 'html', 'json')
 */
export const copyFormatPreference = (format = null) => {
  if (format) {
    try {
      localStorage.setItem('preferred_copy_format', format);
    } catch (e) {
      console.warn('Could not save format preference', e);
    }
  }
  
  try {
    const saved = localStorage.getItem('preferred_copy_format');
    return saved || 'text'; // Default to text
  } catch (e) {
    return 'text';
  }
};

/**
 * Copy analysis in specified format
 * @param {Object} analysis - The analysis object
 * @param {string} format - The format to copy ('text', 'markdown', 'html', 'json')
 * @param {Object} highlightOptions - Optional highlighting options for HTML
 * @returns {Promise<{success: boolean, message: string}>} - Result with feedback
 */
export const copyAnalysisAs = async (analysis, format = 'text', highlightOptions = null) => {
  let formattedContent = '';
  
  // Save the format preference
  copyFormatPreference(format);
  
  switch (format.toLowerCase()) {
    case 'markdown':
      formattedContent = formatAsMarkdown(analysis);
      break;
    case 'html':
      formattedContent = formatAsHTML(analysis, highlightOptions);
      break;
    case 'json':
      formattedContent = formatAsJSON(analysis);
      break;
    case 'text':
    default:
      formattedContent = formatAsPlainText(analysis);
      break;
  }
  
  return await copyToClipboard(formattedContent);
};

/**
 * Copy specific section of analysis
 * @param {Object} analysis - The analysis object
 * @param {string} section - The section to copy ('technical_analysis', etc.)
 * @param {string} format - The format to copy ('text', 'markdown', 'html', 'json')
 * @param {Object} highlightOptions - Optional highlighting options for HTML
 * @returns {Promise<{success: boolean, message: string}>} - Result with feedback
 */
export const copySectionAs = async (analysis, section, format = 'text', highlightOptions = null) => {
  if (!analysis || !analysis[section]) {
    return { success: false, message: 'Nothing to copy. Section not found.' };
  }
  
  // Create a temporary analysis object with just this section
  const sectionAnalysis = {
    timestamp: analysis.timestamp,
    [section]: analysis[section]
  };
  
  // Add metadata only if relevant
  if (analysis.chunk && analysis.total_chunks) {
    sectionAnalysis.chunk = analysis.chunk;
    sectionAnalysis.total_chunks = analysis.total_chunks;
  }
  
  // Use the existing function with our temporary object
  return await copyAnalysisAs(sectionAnalysis, format, highlightOptions);
};