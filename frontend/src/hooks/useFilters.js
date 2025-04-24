import { useState, useMemo } from 'react';

const useFilters = (analyses) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({
    severity: {
      critical: true,
      high: true,
      medium: true,
      low: true
    },
    type: {
      crash: true,
      memory: true,
      performance: true,
      security: true,
      other: true
    },
    timeRange: {
      start: null,
      end: null
    }
  });

  // Update search term
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Update severity filter
  const toggleSeverityFilter = (severity) => {
    setFilterCriteria(prev => ({
      ...prev,
      severity: {
        ...prev.severity,
        [severity]: !prev.severity[severity]
      }
    }));
  };

  // Update type filter
  const toggleTypeFilter = (type) => {
    setFilterCriteria(prev => ({
      ...prev,
      type: {
        ...prev.type,
        [type]: !prev.type[type]
      }
    }));
  };

  // Set time range
  const setTimeRange = (start, end) => {
    setFilterCriteria(prev => ({
      ...prev,
      timeRange: { start, end }
    }));
  };

  // Filtered analyses based on search term and filter options
  const filteredAnalyses = useMemo(() => {
    if (!analyses || !analyses.length) return [];
    
    // Skip filtering if all options are enabled and no search term
    if (!searchTerm && 
        Object.values(filterCriteria.severity).every(v => v) && 
        Object.values(filterCriteria.type).every(v => v) &&
        !filterCriteria.timeRange.start && 
        !filterCriteria.timeRange.end) {
      return analyses;
    }
    
    return analyses.filter(analysis => {
      // Content to search through
      const content = `${analysis.technical_analysis || ''} ${analysis.simplified_analysis || ''} ${analysis.suggested_solutions || ''}`.toLowerCase();
      
      // Search term matching
      const matchesSearch = !searchTerm || content.includes(searchTerm.toLowerCase());
      
      // Severity filtering
      const matchesSeverity = 
        (filterCriteria.severity.critical && /(critical|crash|fatal|exception)/i.test(content)) ||
        (filterCriteria.severity.high && /(high|error|severe)/i.test(content)) ||
        (filterCriteria.severity.medium && /(medium|warning|issue)/i.test(content)) ||
        (filterCriteria.severity.low && /(low|info|note)/i.test(content));
      
      // Type filtering
      const matchesType = 
        (filterCriteria.type.crash && /(crash|exception|stack trace)/i.test(content)) ||
        (filterCriteria.type.memory && /(memory|leak|allocation|heap)/i.test(content)) ||
        (filterCriteria.type.performance && /(performance|slow|latency|timeout)/i.test(content)) ||
        (filterCriteria.type.security && /(security|vulnerability|exploit|access)/i.test(content)) ||
        (filterCriteria.type.other);
      
      // Time range filtering
      let withinTimeRange = true;
      if (analysis.timestamp && (filterCriteria.timeRange.start || filterCriteria.timeRange.end)) {
        const timestamp = new Date(analysis.timestamp).getTime();
        if (filterCriteria.timeRange.start && timestamp < filterCriteria.timeRange.start.getTime()) {
          withinTimeRange = false;
        }
        if (filterCriteria.timeRange.end && timestamp > filterCriteria.timeRange.end.getTime()) {
          withinTimeRange = false;
        }
      }
      
      return matchesSearch && matchesSeverity && matchesType && withinTimeRange;
    });
  }, [analyses, searchTerm, filterCriteria]);

  return {
    searchTerm,
    filterCriteria,
    filteredAnalyses,
    handleSearchChange,
    toggleSeverityFilter,
    toggleTypeFilter,
    setTimeRange
  };
};

export default useFilters;