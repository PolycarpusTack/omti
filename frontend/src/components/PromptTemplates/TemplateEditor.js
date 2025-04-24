import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Template Editor component for creating and editing prompt templates
 */
const TemplateEditor = ({ 
  initialTemplate = null, 
  onSave, 
  onCancel 
}) => {
  // Initial template data structure
  const emptyTemplate = {
    name: '',
    description: '',
    template: '',
    category: 'general',
    variables: [],
    isPublic: false,
    tags: []
  };

  // Template state
  const [template, setTemplate] = useState(initialTemplate || emptyTemplate);
  
  // Form validation state
  const [errors, setErrors] = useState({});
  
  // Variable management
  const [newVariable, setNewVariable] = useState('');
  const [newTag, setNewTag] = useState('');
  
  // UI states
  const [previewMode, setPreviewMode] = useState(false);
  const [variableValues, setVariableValues] = useState({});
  
  // Initialize the editor with data if we're editing an existing template
  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
      
      // Initialize variable values for preview
      const initialValues = {};
      initialTemplate.variables.forEach(variable => {
        initialValues[variable] = `[${variable}]`;
      });
      setVariableValues(initialValues);
    }
  }, [initialTemplate]);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTemplate(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear validation error when field is modified
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Add a variable to the template
  const handleAddVariable = () => {
    if (!newVariable.trim()) return;
    
    // Validate variable name (alphanumeric with underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(newVariable)) {
      toast.error('Variable names should only contain letters, numbers, and underscores');
      return;
    }
    
    // Check for duplicates
    if (template.variables.includes(newVariable)) {
      toast.error('This variable already exists');
      return;
    }
    
    setTemplate(prev => ({
      ...prev,
      variables: [...prev.variables, newVariable]
    }));
    
    // Add to preview values
    setVariableValues(prev => ({
      ...prev,
      [newVariable]: `[${newVariable}]`
    }));
    
    setNewVariable('');
  };

  // Remove a variable from the template
  const handleRemoveVariable = (variable) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v !== variable)
    }));
    
    // Remove from preview values
    setVariableValues(prev => {
      const newValues = {...prev};
      delete newValues[variable];
      return newValues;
    });
  };

  // Add a tag to the template
  const handleAddTag = () => {
    if (!newTag.trim()) return;
    
    // Check for duplicates
    if (template.tags.includes(newTag)) {
      toast.error('This tag already exists');
      return;
    }
    
    setTemplate(prev => ({
      ...prev,
      tags: [...prev.tags, newTag]
    }));
    
    setNewTag('');
  };

  // Remove a tag from the template
  const handleRemoveTag = (tag) => {
    setTemplate(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Handle variable value changes for the preview
  const handleVariableValueChange = (variable, value) => {
    setVariableValues(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Generate preview with variables substituted
  const generatePreview = () => {
    let preview = template.template;
    
    // Replace each variable with its value
    template.variables.forEach(variable => {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
      preview = preview.replace(regex, variableValues[variable] || `[${variable}]`);
    });
    
    return preview;
  };

  // Validate the form before submission
  const validateForm = () => {
    const newErrors = {};
    
    if (!template.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!template.template.trim()) {
      newErrors.template = 'Template content is required';
    } else if (!template.template.includes('{{') && template.variables.length > 0) {
      newErrors.template = 'Template should use the variables you defined (format: {{variable_name}})';
    }
    
    // Check if all defined variables are used in the template
    template.variables.forEach(variable => {
      if (!template.template.includes(`{{${variable}}}`)) {
        newErrors.variables = `Variable "${variable}" is defined but not used in the template`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle template save
  const handleSave = () => {
    if (!validateForm()) {
      toast.error('Please correct the errors before saving');
      return;
    }
    
    // Extract variables from the template content
    const extractedVariables = extractVariablesFromTemplate(template.template);
    const allVariables = [...new Set([...template.variables, ...extractedVariables])];
    
    const templateToSave = {
      ...template,
      variables: allVariables
    };
    
    onSave(templateToSave);
  };

  // Extract variables from template content
  const extractVariablesFromTemplate = (content) => {
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const matches = [...content.matchAll(regex)];
    return matches.map(match => match[1]);
  };

  // Detect variables in the template as user types
  const handleTemplateChange = (e) => {
    const content = e.target.value;
    setTemplate(prev => ({
      ...prev,
      template: content
    }));
    
    // Update variables automatically if new ones are found
    const extractedVariables = extractVariablesFromTemplate(content);
    
    // Add any new variables found in the template
    extractedVariables.forEach(variable => {
      if (!template.variables.includes(variable)) {
        setTemplate(prev => ({
          ...prev,
          variables: [...prev.variables, variable]
        }));
        
        // Add to preview values
        setVariableValues(prev => ({
          ...prev,
          [variable]: `[${variable}]`
        }));
      }
    });
  };

  // Available template categories
  const categories = [
    { value: 'general', label: 'General' },
    { value: 'code_analysis', label: 'Code Analysis' },
    { value: 'error_log', label: 'Error Log Analysis' },
    { value: 'security', label: 'Security Audit' },
    { value: 'performance', label: 'Performance Analysis' },
    { value: 'custom', label: 'Custom' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">
        {initialTemplate ? 'Edit Template' : 'Create New Template'}
      </h2>
      
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <div className="w-full md:w-1/2 md:pr-2">
            <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2" htmlFor="template-name">
              Template Name
            </label>
            <input
              id="template-name"
              name="name"
              type="text"
              className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              value={template.name}
              onChange={handleChange}
              placeholder="E.g., Code Security Audit"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
          
          <div className="w-full md:w-1/2 md:pl-2 mt-4 md:mt-0">
            <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2" htmlFor="template-category">
              Category
            </label>
            <select
              id="template-category"
              name="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={template.category}
              onChange={handleChange}
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2" htmlFor="template-description">
            Description
          </label>
          <textarea
            id="template-description"
            name="description"
            rows="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
            value={template.description}
            onChange={handleChange}
            placeholder="Brief description of what this template does"
          />
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-gray-700 dark:text-gray-200 font-medium" htmlFor="template-content">
            Template Content
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              className={`px-3 py-1 text-sm rounded ${previewMode ? 'bg-gray-200 dark:bg-gray-600' : 'bg-blue-500 text-white'}`}
              onClick={() => setPreviewMode(false)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-sm rounded ${!previewMode ? 'bg-gray-200 dark:bg-gray-600' : 'bg-blue-500 text-white'}`}
              onClick={() => setPreviewMode(true)}
            >
              Preview
            </button>
          </div>
        </div>
        
        {previewMode ? (
          <div className="border border-gray-300 rounded-md p-4 min-h-[200px] whitespace-pre-wrap dark:bg-gray-700 dark:text-white dark:border-gray-600">
            {generatePreview()}
          </div>
        ) : (
          <>
            <textarea
              id="template-content"
              name="template"
              rows="8"
              className={`w-full px-3 py-2 border rounded-md font-mono dark:bg-gray-700 dark:text-white dark:border-gray-600 ${
                errors.template ? 'border-red-500' : 'border-gray-300'
              }`}
              value={template.template}
              onChange={handleTemplateChange}
              placeholder="Write your template here. Use {{variable_name}} syntax for variables."
            />
            {errors.template && <p className="text-red-500 text-sm mt-1">{errors.template}</p>}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Use {{variable_name}} syntax to define variables that can be replaced when using the template.
            </p>
          </>
        )}
      </div>
      
      <div className="mb-6">
        <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
          Variables
        </label>
        {errors.variables && <p className="text-red-500 text-sm mb-2">{errors.variables}</p>}
        
        <div className="flex mb-2">
          <input
            type="text"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
            value={newVariable}
            onChange={(e) => setNewVariable(e.target.value)}
            placeholder="Add a variable (e.g., file_type)"
            onKeyPress={(e) => e.key === 'Enter' && handleAddVariable()}
          />
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
            onClick={handleAddVariable}
          >
            Add
          </button>
        </div>
        
        {template.variables.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {template.variables.map(variable => (
              <div key={variable} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1">
                <span className="text-gray-800 dark:text-gray-200 mr-2">{{variable}}</span>
                <button
                  type="button"
                  className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                  onClick={() => handleRemoveVariable(variable)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No variables defined yet. Variables will be automatically detected from your template.
          </p>
        )}
      </div>
      
      {previewMode && template.variables.length > 0 && (
        <div className="mb-6 border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
          <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
            Preview Values
          </label>
          <div className="space-y-2">
            {template.variables.map(variable => (
              <div key={variable} className="flex items-center">
                <label className="w-1/3 text-gray-600 dark:text-gray-300">{variable}:</label>
                <input
                  type="text"
                  className="flex-grow px-3 py-1 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-white dark:border-gray-500"
                  value={variableValues[variable] || ''}
                  onChange={(e) => handleVariableValueChange(variable, e.target.value)}
                  placeholder={`Value for ${variable}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <label className="block text-gray-700 dark:text-gray-200 font-medium mb-2">
          Tags
        </label>
        
        <div className="flex mb-2">
          <input
            type="text"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag (e.g., security)"
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
          />
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
            onClick={handleAddTag}
          >
            Add
          </button>
        </div>
        
        {template.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {template.tags.map(tag => (
              <div key={tag} className="flex items-center bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1">
                <span className="text-blue-800 dark:text-blue-200 mr-2">{tag}</span>
                <button
                  type="button"
                  className="text-blue-500 hover:text-red-500 dark:text-blue-400 dark:hover:text-red-400"
                  onClick={() => handleRemoveTag(tag)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm italic">
            No tags added yet. Tags help with organizing and finding templates.
          </p>
        )}
      </div>
      
      <div className="mb-6">
        <div className="flex items-center">
          <input
            id="template-public"
            type="checkbox"
            name="isPublic"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            checked={template.isPublic}
            onChange={handleChange}
          />
          <label htmlFor="template-public" className="ml-2 block text-gray-700 dark:text-gray-200">
            Make this template public (available to all users)
          </label>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Public templates can be used by anyone, but can only be edited or deleted by you.
        </p>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          onClick={handleSave}
        >
          Save Template
        </button>
      </div>
    </div>
  );
};

export default TemplateEditor;