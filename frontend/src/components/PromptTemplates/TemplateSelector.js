import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Template Selector component for browsing and selecting prompt templates
 */
const TemplateSelector = ({
  templates = [],
  loading = false,
  selectedTemplate = null,
  onSelect,
  onEdit,
  onDelete,
  onCreateNew
}) => {
  // State for filtering and sorting templates
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showMineOnly, setShowMineOnly] = useState(false);
  
  // Variable values for template customization
  const [variableValues, setVariableValues] = useState({});
  
  // Preview state
  const [previewContent, setPreviewContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Initialize variable values when a template is selected
  useEffect(() => {
    if (!selectedTemplate) {
      setVariableValues({});
      setPreviewContent('');
      return;
    }
    
    // Initialize with empty values for each variable
    const initialValues = {};
    selectedTemplate.variables.forEach(variable => {
      initialValues[variable] = '';
    });
    
    setVariableValues(initialValues);
    updatePreview(selectedTemplate, initialValues);
  }, [selectedTemplate]);

  // Filter and sort templates based on current filters
  const filteredTemplates = templates
    .filter(template => {
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesDescription = template.description.toLowerCase().includes(query);
        const matchesTags = template.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesDescription && !matchesTags) {
          return false;
        }
      }
      
      // Filter by category
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false;
      }
      
      // Filter by ownership
      if (showMineOnly && !template.isOwner) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort templates
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

  // Update variable value and regenerate preview
  const handleVariableChange = (variable, value) => {
    const newValues = {
      ...variableValues,
      [variable]: value
    };
    
    setVariableValues(newValues);
    updatePreview(selectedTemplate, newValues);
  };

  // Generate preview content with variables substituted
  const updatePreview = (template, values) => {
    if (!template) return;
    
    let content = template.template;
    
    // Replace each variable with its value
    template.variables.forEach(variable => {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
      const value = values[variable] || `{{${variable}}}`;
      content = content.replace(regex, value);
    });
    
    setPreviewContent(content);
  };

  // Handle template selection
  const handleSelectTemplate = (template) => {
    onSelect(template);
  };

  // Handle use template button click
  const handleUseTemplate = () => {
    // Make sure all variables have values
    const missingVariables = selectedTemplate.variables.filter(
      variable => !variableValues[variable]
    );
    
    if (missingVariables.length > 0) {
      // We'll just warn the user but still allow them to proceed
      toast.warn(`Some variables don't have values: ${missingVariables.join(', ')}`);
    }
    
    // Apply the template with current variable values
    onSelect({
      ...selectedTemplate,
      filledTemplate: previewContent
    });
  };

  // Available template categories
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'code_analysis', label: 'Code Analysis' },
    { value: 'error_log', label: 'Error Log Analysis' },
    { value: 'security', label: 'Security Audit' },
    { value: 'performance', label: 'Performance Analysis' },
    { value: 'custom', label: 'Custom' }
  ];

  // Template item component
  const TemplateItem = ({ template }) => (
    <div 
      className={`p-4 border rounded-md mb-3 cursor-pointer transition-colors duration-150
        ${selectedTemplate && selectedTemplate.id === template.id 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700' 
          : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700'
        }
        dark:bg-gray-800
      `}
      onClick={() => handleSelectTemplate(template)}
    >
      <div className="flex justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
        <div className="flex space-x-2">
          {template.isOwner && (
            <>
              <button 
                className="text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button 
                className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(template);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{template.description}</p>
      
      <div className="flex justify-between mt-2">
        <div className="flex items-center">
          <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300">
            {categories.find(c => c.value === template.category)?.label || 'Custom'}
          </span>
          
          {template.isPublic && (
            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded dark:bg-green-900 dark:text-green-200">
              Public
            </span>
          )}
          
          {template.isOwner && !template.isPublic && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-200">
              Private
            </span>
          )}
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {template.variables.length > 0 ? (
            <span>{template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}</span>
          ) : (
            <span>No variables</span>
          )}
        </div>
      </div>
      
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.map(tag => (
            <span 
              key={tag} 
              className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Prompt Templates</h2>
        
        {/* Search and filter controls */}
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Search templates..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-2">
            <select
              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            
            <select
              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
              <option value="category">Sort by Category</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center mt-3">
          <input
            id="show-mine-only"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            checked={showMineOnly}
            onChange={(e) => setShowMineOnly(e.target.checked)}
          />
          <label htmlFor="show-mine-only" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
            Show my templates only
          </label>
          
          <button
            className="ml-auto inline-flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            onClick={onCreateNew}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create New
          </button>
        </div>
      </div>
      
      {/* Template list */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-1/2 p-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="loader border-t-4 border-blue-500 rounded-full w-8 h-8 animate-spin"></div>
            </div>
          ) : filteredTemplates.length > 0 ? (
            filteredTemplates.map(template => (
              <TemplateItem key={template.id} template={template} />
            ))
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {searchQuery || selectedCategory !== 'all' || showMineOnly ? (
                <p>No templates match your filters.</p>
              ) : (
                <p>No templates available. Create one to get started!</p>
              )}
            </div>
          )}
        </div>
        
        {/* Template details and customization */}
        <div className="hidden md:block w-1/2 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          {selectedTemplate ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold dark:text-white">{selectedTemplate.name}</h3>
                <button
                  className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Edit Variables' : 'Show Preview'}
                </button>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">{selectedTemplate.description}</p>
              
              {showPreview ? (
                <div className="border border-gray-300 rounded-md p-4 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap mb-4 min-h-[200px]">
                  {previewContent}
                </div>
              ) : (
                <>
                  {selectedTemplate.variables.length > 0 ? (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 dark:text-white">Customize Template</h4>
                      <div className="space-y-2">
                        {selectedTemplate.variables.map(variable => (
                          <div key={variable} className="flex flex-col">
                            <label className="mb-1 text-sm text-gray-700 dark:text-gray-300">
                              {variable}:
                            </label>
                            <input
                              type="text"
                              className="px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-white dark:border-gray-600"
                              value={variableValues[variable] || ''}
                              onChange={(e) => handleVariableChange(variable, e.target.value)}
                              placeholder={`Value for ${variable}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <p className="text-gray-600 dark:text-gray-300">
                        This template has no customizable variables.
                      </p>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <h4 className="font-medium mb-2 dark:text-white">Template Content</h4>
                    <div className="border border-gray-300 rounded-md p-3 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap">
                      {selectedTemplate.template}
                    </div>
                  </div>
                </>
              )}
              
              <div className="mt-auto">
                <button
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  onClick={handleUseTemplate}
                >
                  Use This Template
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-lg mb-1">No Template Selected</p>
              <p className="text-sm text-center">Select a template from the list to view details and customize it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelector;