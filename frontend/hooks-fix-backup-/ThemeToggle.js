import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';

export function ThemeToggle({ 
  position = 'fixed', 
  className = '',
  iconSize = 'w-6 h-6', 
  ariaLabel = 'Toggle dark mode' 
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration mismatch by only rendering after component is mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle theme toggle with keyboard safety
  const handleToggle = () => {
    const currentTheme = theme || resolvedTheme;
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // If not mounted yet, render an invisible placeholder to prevent layout shift
  if (!mounted) {
    return (
      <div 
        className={`${position === 'fixed' ? 'fixed bottom-4 right-4' : ''} 
          p-2 rounded-full invisible ${className}`}
        aria-hidden="true"
      >
        <div className={iconSize} />
      </div>
    );
  }

  // Determine current theme, falling back to resolvedTheme if theme is undefined
  const currentTheme = theme || resolvedTheme;
  const isDark = currentTheme === 'dark';

  return (
    <button
      onClick={handleToggle}
      className={`${position === 'fixed' ? 'fixed bottom-4 right-4' : ''} 
        p-2 rounded-full shadow-lg bg-gray-200 dark:bg-gray-700 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
        transition-colors duration-200 ${className}`}
      aria-label={ariaLabel}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {isDark ? (
        <SunIcon className={`${iconSize} text-yellow-500`} aria-hidden="true" />
      ) : (
        <MoonIcon className={`${iconSize} text-gray-900`} aria-hidden="true" />
      )}
      <span className="sr-only">{isDark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
    </button>
  );
}