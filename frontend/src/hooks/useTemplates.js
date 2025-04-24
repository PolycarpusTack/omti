import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_URL } from '../constants';

const TEMPLATE_API_URL = `${API_URL}templates`;

/**
 * Custom hook for managing prompt templates
 * Handles template loading, creation, updating, and deletion
 */
const useTemplates = (userId) => {
  // State for templates
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // State for offline mode
  const [offlineMode, setOfflineMode] = useState(false);
  
  // Load templates from the server or localStorage
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (offlineMode) {
        // Load from localStorage when in offline mode
        loadTemplatesFromLocalStorage();
        setLoading(false);
        return;
      }
      
      // Load from the server
      const response = await axios.get(TEMPLATE_API_URL);
      
      if (response.data && Array.isArray(response.data)) {
        // Process templates to mark ownership
        const processedTemplates = response.data.map(template => ({
          ...template,
          isOwner: template.userId === userId
        }));
        
        setTemplates(processedTemplates);
        
        // Also save to localStorage as a backup
        saveTemplatesToLocalStorage(processedTemplates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Using offline mode.');
      
      // Fall back to localStorage
      loadTemplatesFromLocalStorage();
      setOfflineMode(true);
      
      toast.error('Failed to connect to the server. Working in offline mode.');
    } finally {
      setLoading(false);
    }
  }, [userId, offlineMode]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load templates from localStorage
  const loadTemplatesFromLocalStorage = () => {
    try {
      const storedTemplates = localStorage.getItem('promptTemplates');
      if (storedTemplates) {
        const parsedTemplates = JSON.parse(storedTemplates);
        
        // Process templates to mark ownership in offline mode
        const processedTemplates = parsedTemplates.map(template => ({
          ...template,
          isOwner: template.userId === userId
        }));
        
        setTemplates(processedTemplates);
      }
    } catch (err) {
      console.error('Failed to load templates from localStorage:', err);
      setError('Failed to load templates from local storage.');
      setTemplates([]);
    }
  };

  // Save templates to localStorage
  const saveTemplatesToLocalStorage = (templatesData) => {
    try {
      localStorage.setItem('promptTemplates', JSON.stringify(templatesData));
    } catch (err) {
      console.error('Failed to save templates to localStorage:', err);
    }
  };

  // Create a new template
  const createTemplate = useCallback(async (templateData) => {
    setLoading(true);
    setError(null);
    
    try {
      const newTemplate = {
        ...templateData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (offlineMode) {
        // Generate a local ID when offline
        newTemplate.id = `local_${Date.now()}`;
        newTemplate.isOwner = true;
        
        const updatedTemplates = [...templates, newTemplate];
        setTemplates(updatedTemplates);
        saveTemplatesToLocalStorage(updatedTemplates);
        
        toast.success('Template created successfully (offline mode)');
        return newTemplate;
      }
      
      // Create on the server
      const response = await axios.post(TEMPLATE_API_URL, newTemplate);
      
      if (response.data) {
        const createdTemplate = {
          ...response.data,
          isOwner: true
        };
        
        setTemplates(prev => [...prev, createdTemplate]);
        
        // Update localStorage
        saveTemplatesToLocalStorage([...templates, createdTemplate]);
        
        toast.success('Template created successfully');
        return createdTemplate;
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      setError('Failed to create template');
      
      if (!offlineMode) {
        // Switch to offline mode if server is unreachable
        setOfflineMode(true);
        toast.error('Failed to connect to the server. Switched to offline mode.');
        return createTemplate(templateData);
      } else {
        toast.error('Failed to create template');
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, templates, offlineMode]);

  // Update an existing template
  const updateTemplate = useCallback(async (id, templateData) => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedTemplate = {
        ...templateData,
        updatedAt: new Date().toISOString()
      };
      
      if (offlineMode) {
        // Update locally when offline
        const updatedTemplates = templates.map(template => 
          template.id === id ? { ...updatedTemplate, id, isOwner: true } : template
        );
        
        setTemplates(updatedTemplates);
        saveTemplatesToLocalStorage(updatedTemplates);
        
        // Update selected template if it was the one updated
        if (selectedTemplate && selectedTemplate.id === id) {
          setSelectedTemplate({ ...updatedTemplate, id, isOwner: true });
        }
        
        toast.success('Template updated successfully (offline mode)');
        return { ...updatedTemplate, id };
      }
      
      // Update on the server
      const response = await axios.put(`${TEMPLATE_API_URL}/${id}`, updatedTemplate);
      
      if (response.data) {
        const updatedTemplateWithOwner = {
          ...response.data,
          isOwner: true
        };
        
        setTemplates(prev => 
          prev.map(template => 
            template.id === id ? updatedTemplateWithOwner : template
          )
        );
        
        // Update selected template if it was the one updated
        if (selectedTemplate && selectedTemplate.id === id) {
          setSelectedTemplate(updatedTemplateWithOwner);
        }
        
        // Update localStorage
        const updatedTemplates = templates.map(template => 
          template.id === id ? updatedTemplateWithOwner : template
        );
        saveTemplatesToLocalStorage(updatedTemplates);
        
        toast.success('Template updated successfully');
        return updatedTemplateWithOwner;
      }
    } catch (err) {
      console.error('Failed to update template:', err);
      setError('Failed to update template');
      
      if (!offlineMode) {
        // Switch to offline mode if server is unreachable
        setOfflineMode(true);
        toast.error('Failed to connect to the server. Switched to offline mode.');
        return updateTemplate(id, templateData);
      } else {
        toast.error('Failed to update template');
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [templates, selectedTemplate, offlineMode]);

  // Delete a template
  const deleteTemplate = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      if (offlineMode) {
        // Delete locally when offline
        const updatedTemplates = templates.filter(template => template.id !== id);
        setTemplates(updatedTemplates);
        saveTemplatesToLocalStorage(updatedTemplates);
        
        // Clear selected template if it was the one deleted
        if (selectedTemplate && selectedTemplate.id === id) {
          setSelectedTemplate(null);
        }
        
        toast.success('Template deleted successfully (offline mode)');
        return true;
      }
      
      // Delete on the server
      await axios.delete(`${TEMPLATE_API_URL}/${id}`);
      
      setTemplates(prev => prev.filter(template => template.id !== id));
      
      // Clear selected template if it was the one deleted
      if (selectedTemplate && selectedTemplate.id === id) {
        setSelectedTemplate(null);
      }
      
      // Update localStorage
      const updatedTemplates = templates.filter(template => template.id !== id);
      saveTemplatesToLocalStorage(updatedTemplates);
      
      toast.success('Template deleted successfully');
      return true;
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template');
      
      if (!offlineMode) {
        // Switch to offline mode if server is unreachable
        setOfflineMode(true);
        toast.error('Failed to connect to the server. Switched to offline mode.');
        return deleteTemplate(id);
      } else {
        toast.error('Failed to delete template');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [templates, selectedTemplate, offlineMode]);

  // Select a template
  const selectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
  }, []);

  // Apply a template to the current analysis
  const applyTemplate = useCallback((template, additionalVariables = {}) => {
    if (!template) return null;
    
    let content = template.filledTemplate || template.template;
    
    // If we have a filled template, use that directly
    if (template.filledTemplate) {
      return template.filledTemplate;
    }
    
    // Otherwise, replace variables with any provided values
    if (additionalVariables && Object.keys(additionalVariables).length > 0) {
      Object.entries(additionalVariables).forEach(([variable, value]) => {
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
        content = content.replace(regex, value || `{{${variable}}}`);
      });
    }
    
    return content;
  }, []);

  // Get default templates
  const getDefaultTemplates = useCallback(() => {
    return [
      {
        id: 'default_1',
        name: 'General Code Analysis',
        description: 'A general-purpose template for analyzing code files',
        template: 'Analyze the following {{language}} code for bugs, errors, and potential improvements:\n\n```{{language}}\n{{code}}\n```\n\nProvide a detailed technical analysis and suggested improvements.',
        variables: ['language', 'code'],
        category: 'code_analysis',
        tags: ['general', 'code'],
        isPublic: true,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: false
      },
      {
        id: 'default_2',
        name: 'Log Error Analysis',
        description: 'Template for analyzing error logs and identifying issues',
        template: 'Analyze the following error log from {{system_type}} and identify the root cause of the issues:\n\n```\n{{log_content}}\n```\n\nExplain the errors, their likely causes, and suggest potential fixes.',
        variables: ['system_type', 'log_content'],
        category: 'error_log',
        tags: ['logs', 'errors', 'debugging'],
        isPublic: true,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: false
      },
      {
        id: 'default_3',
        name: 'Security Vulnerability Scan',
        description: 'Template for identifying security vulnerabilities in code',
        template: 'Perform a security analysis on the following {{language}} code, focusing on potential vulnerabilities like SQL injection, XSS, CSRF, authentication issues, and other security concerns:\n\n```{{language}}\n{{code}}\n```\n\nList all identified vulnerabilities, their severity (Critical, High, Medium, Low), and recommended fixes.',
        variables: ['language', 'code'],
        category: 'security',
        tags: ['security', 'vulnerabilities'],
        isPublic: true,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: false
      },
      {
        id: 'default_4',
        name: 'Performance Optimization',
        description: 'Template for identifying performance bottlenecks in code',
        template: 'Analyze the following {{language}} code for performance issues and optimization opportunities:\n\n```{{language}}\n{{code}}\n```\n\nIdentify inefficient algorithms, resource usage issues, bottlenecks, and suggest specific performance improvements with examples where possible.',
        variables: ['language', 'code'],
        category: 'performance',
        tags: ['performance', 'optimization'],
        isPublic: true,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: false
      },
      {
        id: 'default_5',
        name: 'API Documentation Generator',
        description: 'Generate documentation for APIs based on code',
        template: 'Based on the following {{language}} API code, generate comprehensive documentation:\n\n```{{language}}\n{{code}}\n```\n\nInclude:\n- Endpoint descriptions\n- Required parameters\n- Return values\n- Error codes\n- Example requests and responses\n- Authentication requirements',
        variables: ['language', 'code'],
        category: 'general',
        tags: ['documentation', 'api'],
        isPublic: true,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOwner: false
      }
    ];
  }, []);

  // Reset to default templates
  const resetToDefaultTemplates = useCallback(() => {
    const defaultTemplates = getDefaultTemplates();
    
    // Keep user templates but add default ones if they don't exist
    const userTemplates = templates.filter(template => template.userId === userId);
    const existingDefaultIds = templates
      .filter(template => template.userId === 'system')
      .map(template => template.id);
    
    const newDefaultTemplates = defaultTemplates.filter(
      template => !existingDefaultIds.includes(template.id)
    );
    
    const updatedTemplates = [...userTemplates, ...newDefaultTemplates];
    
    setTemplates(updatedTemplates);
    saveTemplatesToLocalStorage(updatedTemplates);
    
    toast.success('Reset to default templates successfully');
  }, [templates, userId, getDefaultTemplates]);

  // Initialize with default templates if none exist
  useEffect(() => {
    if (templates.length === 0 && !loading) {
      const defaultTemplates = getDefaultTemplates();
      setTemplates(defaultTemplates);
      saveTemplatesToLocalStorage(defaultTemplates);
    }
  }, [templates, loading, getDefaultTemplates]);

  return {
    templates,
    selectedTemplate,
    loading,
    error,
    offlineMode,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    selectTemplate,
    applyTemplate,
    resetToDefaultTemplates
  };
};

export default useTemplates;