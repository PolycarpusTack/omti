# PowerShell script to fix React hooks errors
# Save this as fix-react-hooks.ps1

Write-Host "Starting React hooks error fix process..." -ForegroundColor Green

# Step 1: Backup current files
$backupFolder = "hooks-fix-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -Path $backupFolder -ItemType Directory -Force
Write-Host "Created backup folder: $backupFolder" -ForegroundColor Cyan

# Backup critical files
Copy-Item -Path ".\src\index.js" -Destination "$backupFolder\index.js" -Force
Copy-Item -Path ".\src\App.js" -Destination "$backupFolder\App.js" -Force
Copy-Item -Path ".\src\components\ThemeToggle.js" -Destination "$backupFolder\ThemeToggle.js" -Force
Write-Host "Core files backed up" -ForegroundColor Green

# Step 2: Fix index.js by ensuring proper React 18 initialization
$indexContent = @"
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Use createRoot API for React 18
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  // Temporarily disable StrictMode to isolate if that's causing issues
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
"@

Set-Content -Path ".\src\index.js" -Value $indexContent
Write-Host "Fixed index.js with proper React 18 initialization" -ForegroundColor Green

# Step 3: Create a custom ThemeToggle component that handles hydration issues
$themeToggleContent = @"
import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration mismatch by only rendering after component is mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-5 h-5" />;
  }

  const currentTheme = theme || resolvedTheme;
  const isDark = currentTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
"@

Set-Content -Path ".\src\components\ThemeToggle.js" -Value $themeToggleContent
Write-Host "Created fixed ThemeToggle component with hydration handling" -ForegroundColor Green

# Step 4: Create a simplified error display component
$errorDisplayContent = @"
import React from 'react';

export const ErrorDisplay = ({ error, onDismiss }) => {
  if (!error) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 text-red-400 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-800 dark:text-red-200 font-medium">{error}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
"@

New-Item -Path ".\src\components" -Name "ErrorDisplay.js" -ItemType "file" -Value $errorDisplayContent -Force
Write-Host "Created ErrorDisplay component" -ForegroundColor Green

# Step 5: Create a placeholder for the LanguageSelector component if needed
$languageSelectorContent = @"
import React from 'react';

export const LanguageSelector = ({ selectedLanguage, onChange }) => {
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' }
  ];

  return (
    <div className="relative inline-block text-left">
      <select
        value={selectedLanguage}
        onChange={(e) => onChange({ value: e.target.value })}
        className="block w-full px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
      >
        {languages.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
"@

New-Item -Path ".\src\components" -Name "LanguageSelector.js" -ItemType "file" -Value $languageSelectorContent -Force
Write-Host "Created simplified LanguageSelector component" -ForegroundColor Green

# Step 6: Clean npm cache and install packages cleanly
Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "Reinstalling packages..." -ForegroundColor Yellow
npm ci

Write-Host "React hooks error fix process completed!" -ForegroundColor Green
Write-Host "Please restart your development server with: npm start" -ForegroundColor Cyan