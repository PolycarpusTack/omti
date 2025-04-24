// components/content/KeyboardShortcutsContent.jsx
import React from 'react';

const KeyboardShortcutsContent = () => {
  return (
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
  );
};

export default KeyboardShortcutsContent;