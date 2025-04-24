// components/Help/data/helpContent.js
import React from 'react';

// Help content structure without external component dependencies
export const helpSections = {
  'overview': {
    title: 'Application Overview',
    content: 'One More Thing Insights is an advanced code and log analysis tool that leverages AI models to help identify issues, patterns, and insights in your code or log files. The application combines powerful AI analysis with user-friendly features to make debugging and troubleshooting more efficient.',
    subItems: [
      {
        id: 'core-features',
        title: 'Core Features',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>AI-powered code and log analysis</li>
            <li>Multiple analysis modes and model options</li>
            <li>Smart model suggestion based on content type</li>
            <li>Pattern detection across multiple analyses</li>
            <li>Detailed issue categorization and filtering</li>
            <li>Advanced analytics dashboard with visualizations</li>
            <li>Timeline view of analysis history</li>
            <li>Troubleshooting wizard with guided steps</li>
            <li>Shareable analysis results</li>
            <li>Analysis history management</li>
            <li>Dark/light theme support</li>
          </ul>
        )
      },
      {
        id: 'workflow',
        title: 'Typical Workflow',
        content: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Upload a file (code or log) for analysis</li>
            <li>Use the auto-suggested model or select your preferred model</li>
            <li>Configure analysis settings (language, type)</li>
            <li>Run the analysis</li>
            <li>Review the analytics dashboard for high-level insights</li>
            <li>Examine categorized issues and detailed analysis</li>
            <li>Use filters to focus on specific issues</li>
            <li>Use the troubleshooting wizard for guided resolution</li>
            <li>Save to history for future reference and pattern detection</li>
            <li>Export or share results as needed</li>
          </ol>
        )
      }
    ]
  },
  
  'file-upload': {
    title: 'File Upload & Handling',
    content: 'The application supports multiple methods for uploading files for analysis.',
    subItems: [
      {
        id: 'upload-methods',
        title: 'Upload Methods',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Drag and Drop:</strong> Drag files directly into the upload area</li>
            <li><strong>File Browser:</strong> Click the upload area to open a file browser</li>
            <li><strong>Clipboard Paste:</strong> Paste content from clipboard (for text files)</li>
          </ul>
        )
      },
      {
        id: 'supported-files',
        title: 'Supported File Types',
        content: (
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Code Files:</strong>
              <ul className="list-disc pl-5 mt-1">
                <li>JavaScript (.js, .jsx, .ts, .tsx)</li>
                <li>Python (.py)</li>
                <li>Java (.java)</li>
                <li>C/C++ (.c, .cpp, .h)</li>
                <li>Go (.go)</li>
                <li>Ruby (.rb)</li>
                <li>PHP (.php)</li>
                <li>Other common programming languages</li>
              </ul>
            </li>
            <li>
              <strong>Log Files:</strong>
              <ul className="list-disc pl-5 mt-1">
                <li>Text logs (.log, .txt)</li>
                <li>JSON logs (.json)</li>
                <li>XML logs (.xml)</li>
                <li>CSV logs (.csv)</li>
              </ul>
            </li>
            <li>
              <strong>Configuration Files:</strong>
              <ul className="list-disc pl-5 mt-1">
                <li>JSON (.json)</li>
                <li>YAML (.yml, .yaml)</li>
                <li>TOML (.toml)</li>
                <li>INI (.ini)</li>
              </ul>
            </li>
          </ul>
        )
      },
      {
        id: 'file-preview',
        title: 'File Preview',
        content: (
          <p>
            Once uploaded, the application provides a preview of the file content. For large files, this preview is limited to the first few kilobytes. The preview helps confirm you've selected the correct file before analysis.
          </p>
        )
      },
      {
        id: 'file-limits',
        title: 'File Size Limits',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Default Limit:</strong> 10MB per file</li>
            <li><strong>Extended Limit (with chunking):</strong> Up to 50MB with automatic chunking</li>
            <li><strong>Note:</strong> Very large files are automatically split into smaller chunks for analysis, which may impact the cohesiveness of results</li>
          </ul>
        )
      }
    ]
  },
  
  'models': {
    title: 'AI Model Selection',
    content: 'The application supports multiple AI model providers and configurations for analysis.',
    subItems: [
      {
        id: 'supported-models',
        title: 'Supported Model Providers',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>OpenAI Models:</strong> GPT-4, GPT-3.5 Turbo</li>
            <li><strong>Anthropic Models:</strong> Claude 2, Claude Instant</li>
            <li><strong>Ollama:</strong> For running local open-source models</li>
            <li><strong>Custom API:</strong> Support for custom AI endpoints</li>
          </ul>
        )
      },
      {
        id: 'model-settings',
        title: 'Model Settings',
        content: (
          <>
            <p>
              Each model can be configured with different parameters:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Temperature:</strong> Controls randomness/creativity (0.0-1.0)</li>
              <li><strong>Top P:</strong> Controls diversity of model outputs</li>
              <li><strong>System Prompt:</strong> Base instructions for the model</li>
              <li><strong>Max Tokens:</strong> Maximum response length</li>
            </ul>
          </>
        )
      }
    ]
  },
  
  'auto-suggest': {
    title: 'Auto-suggest Model Selection',
    content: 'The Auto-suggest Model Selection feature intelligently recommends the most suitable AI model based on the content you\'re analyzing.',
    subItems: [
      {
        id: 'auto-suggest-overview',
        title: 'Feature Overview',
        content: (
          <p>
            This feature analyzes your content characteristics and automatically suggests the best model for your specific analysis needs:
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Content-aware model recommendation</li>
              <li>Suggests specialized models for specific content types</li>
              <li>Learns from your previous analysis choices</li>
              <li>Provides explanation for why a particular model is suggested</li>
              <li>Shows confidence level for each suggestion</li>
            </ul>
          </p>
        )
      }
    ]
  },
  
  'results': {
    title: 'Analysis Results',
    content: 'After analysis completes, the application provides structured results in multiple formats.',
    subItems: [
      {
        id: 'result-sections',
        title: 'Result Sections',
        content: (
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Analytics Dashboard:</strong> Visual representation of analysis data with interactive charts and metrics
            </li>
            <li>
              <strong>Issues Summary:</strong> Aggregated overview of detected issues categorized by severity and type
            </li>
            <li>
              <strong>Technical Analysis:</strong> Detailed technical evaluation with code references
            </li>
            <li>
              <strong>Simplified Analysis:</strong> Easy-to-understand explanations of issues
            </li>
            <li>
              <strong>Categorized Issues:</strong> Issues grouped by category (syntax, logic, security, performance, etc.)
            </li>
            <li>
              <strong>Recommendations:</strong> Specific suggestions for fixing identified issues
            </li>
          </ul>
        )
      }
    ]
  },
  
  'keyboard-shortcuts': {
    title: 'Keyboard Shortcuts',
    content: 'The application provides keyboard shortcuts for efficient navigation and operation.',
    subItems: [
      {
        id: 'keyboard-shortcuts-content',
        title: '',
        content: (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <h3 className="font-bold mb-2 dark:text-gray-200">General</h3>
              <ul className="space-y-1 dark:text-gray-300">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">?</span> - Show keyboard shortcuts</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+/</span> - Show keyboard shortcuts</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+S</span> - Open settings</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+H</span> - Toggle history</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+D</span> - Toggle dark mode</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-2 dark:text-gray-200">File Handling</h3>
              <ul className="space-y-1 dark:text-gray-300">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+O</span> - Open file</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+V</span> - Paste from clipboard</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Escape</span> - Clear selected file</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-2 dark:text-gray-200">Analysis</h3>
              <ul className="space-y-1 dark:text-gray-300">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+Enter</span> - Start analysis</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+.</span> - Cancel analysis</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+Shift+E</span> - Export results</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+Shift+S</span> - Share results</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+M</span> - Select model</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-2 dark:text-gray-200">Navigation</h3>
              <ul className="space-y-1 dark:text-gray-300">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+F</span> - Focus search</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Alt+N</span> - Next issue</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Alt+P</span> - Previous issue</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Alt+1-5</span> - Filter by severity</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1">Ctrl+T</span> - Open timeline view</li>
              </ul>
            </div>
          </div>
        )
      }
    ]
  },
  
  'tips-tricks': {
    title: 'Tips & Best Practices',
    content: 'Get the most out of the application with these tips and best practices.',
    subItems: [
      {
        id: 'file-preparation',
        title: 'File Preparation',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Format code files before analysis for better results</li>
            <li>For large files, analyze the most critical sections separately</li>
            <li>Include necessary context files when analyzing dependencies</li>
            <li>Clean log files of sensitive information before uploading</li>
            <li>For logs, include timestamps and thread/process IDs when available</li>
          </ul>
        )
      },
      {
        id: 'model-selection',
        title: 'Model Selection Tips',
        content: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Use GPT-4 or Claude 2 for complex analysis needs</li>
            <li>Use faster models like GPT-3.5 for initial screening</li>
            <li>For privacy-sensitive code, use Ollama with local models</li>
            <li>Specialized models often work better for certain languages (e.g., Codellama for code)</li>
            <li>Balance between model quality and response time based on your needs</li>
          </ul>
        )
      }
    ]
  }
  
  // Add more sections as needed, but this is a good starting point
};