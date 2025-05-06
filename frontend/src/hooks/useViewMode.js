// src/hooks/useViewMode.js
import { useState, useCallback } from 'react';

/**
 * Custom hook for managing view mode state (concise vs expanded)
 * @returns {Object} View mode state and helper functions
 */
export const useViewMode = () => {
  // View mode state
  const [viewMode, setViewMode] = useState("expanded"); // "concise" or "expanded"

  // Toggle view mode function
  const toggleViewMode = useCallback(() => {
    setViewMode((prevMode) =>
      prevMode === "expanded" ? "concise" : "expanded"
    );
  }, []);

  // Helper to conditionally render expanded content
  const renderIfExpanded = useCallback(
    (content) => {
      return viewMode === "expanded" ? content : null;
    },
    [viewMode]
  );

  return {
    viewMode,
    toggleViewMode,
    renderIfExpanded,
  };
};