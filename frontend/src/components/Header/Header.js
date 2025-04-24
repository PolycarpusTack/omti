// src/components/Header/Header.js
import React from 'react';
import ThemeToggle from '../UI/ThemeToggle';
import { Link } from 'react-router-dom';

export function Header({ 
  language,
  onLanguageChange,
  analysisType,
  onAnalysisTypeChange,
  onOpenSettings,
  onToggleHistory,
  onOpenHelp,
  ollamaStatus
}) {
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
    { value: 'de', label: 'German' }
  ];

  const analysisOptions = [
    { value: 'original', label: 'Standard Analysis' },
    { value: 'crash', label: 'Crash Analysis' }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Log Analyzer</h1>
            
            {/* Status indicator */}
            <div className="ml-4 flex items-center">
              <div className={`h-2 w-2 rounded-full ${ollamaStatus ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {ollamaStatus ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Navigation Links */}
            <nav className="ml-6">
              <ul className="flex space-x-4">
                <li>
                  <Link 
                    to="/" 
                    className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/monitoring" 
                    className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    System Monitoring
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Language selector */}
            <div className="flex items-center">
              <label htmlFor="language-select" className="mr-2 text-sm text-gray-700 dark:text-gray-300">
                Language:
              </label>
              <select
                id="language-select"
                value={language}
                onChange={e => onLanguageChange({ value: e.target.value })}
                className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {languageOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Analysis type selector */}
            <div className="flex items-center">
              <label htmlFor="analysis-type-select" className="mr-2 text-sm text-gray-700 dark:text-gray-300">
                Analysis Type:
              </label>
              <select
                id="analysis-type-select"
                value={analysisType}
                onChange={e => onAnalysisTypeChange(e.target.value)}
                className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {analysisOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Theme toggle */}
            <ThemeToggle />
            
            {/* History button */}
            <button
              onClick={onToggleHistory}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="View history"
              title="View history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" />
              </svg>
            </button>
            
            {/* Settings button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Open settings"
              title="Open settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Help button */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Help"
              title="Help"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}