// src/components/UI/CollapsibleSection.js
import React, { useState } from 'react';

const CollapsibleSection = ({ 
  title, 
  children, 
  defaultOpen = false, 
  severity = null,
  className = '',
  headerClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // Set color based on severity
  const getSeverityColors = () => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800 text-red-700 dark:text-red-400';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800 text-red-600 dark:text-red-300';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400';
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 text-blue-700 dark:text-blue-400';
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200';
    }
  };
  
  const severityColors = severity ? getSeverityColors() : '';
  
  return (
    <div className={`border rounded-lg shadow-sm overflow-hidden ${severityColors} ${className}`}>
      <div
        className={`px-4 py-3 flex justify-between items-center cursor-pointer ${headerClassName}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-base font-medium">
          {title}
        </h3>
        <button 
          className="flex items-center focus:outline-none"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse section" : "Expand section"}
        >
          <svg
            className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-screen' : 'max-h-0'}`}
      >
        <div className={`p-4 border-t ${severity ? `border-opacity-20 border-${severity}` : 'border-gray-200 dark:border-gray-600'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;