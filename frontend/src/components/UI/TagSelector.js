// src/components/UI/TagSelector.js
import React, { useState, useRef, useEffect } from 'react';
import useTags from '../../hooks/useTags';

const TagSelector = ({ analysisId, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [editingTag, setEditingTag] = useState(null);
  
  const dropdownRef = useRef(null);
  
  const {
    tags,
    selectedTags,
    selectedTagObjects,
    loading,
    error,
    addTag,
    deleteTag,
    updateTag,
    toggleTag
  } = useTags(analysisId);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle tag toggle
  const handleTagToggle = (tagId) => {
    toggleTag(tagId);
  };
  
  // Handle add tag
  const handleAddTag = () => {
    if (newTagName.trim()) {
      addTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowTagEditor(false);
    }
  };
  
  // Handle update tag
  const handleUpdateTag = () => {
    if (editingTag && newTagName.trim()) {
      updateTag(editingTag.id, { name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setEditingTag(null);
      setShowTagEditor(false);
    }
  };
  
  // Set up tag editing
  const handleEditTag = (tag, e) => {
    e.stopPropagation(); // Prevent tag toggle
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setShowTagEditor(true);
  };
  
  // Handle tag deletion
  const handleDeleteTag = (tagId, e) => {
    e.stopPropagation(); // Prevent tag toggle
    deleteTag(tagId);
  };
  
  const colorOptions = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#d946ef', // Fuchsia
    '#ec4899'  // Pink
  ];
  
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div>
        <button
          type="button"
          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen ? 'true' : 'false'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" 
              clipRule="evenodd" 
            />
          </svg>
          {selectedTagObjects.length > 0 ? (
            <span>
              {selectedTagObjects.length} tag{selectedTagObjects.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>Add tags</span>
          )}
        </button>
      </div>
      
      {/* Show selected tags */}
      {selectedTagObjects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedTagObjects.map(tag => (
            <span 
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ 
                backgroundColor: `${tag.color}20`, // 20% opacity
                color: tag.color,
                borderColor: tag.color
              }}
            >
              <span>{tag.name}</span>
            </span>
          ))}
        </div>
      )}
      
      {/* Dropdown */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-60 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 focus:outline-none z-10">
          {/* Tag creation/editing form */}
          {showTagEditor && (
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {editingTag ? 'Edit tag' : 'Create new tag'}
              </h3>
              
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white mb-2"
              />
              
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex flex-wrap gap-1">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-5 h-5 rounded-full focus:outline-none ${newTagColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-3">
                <button
                  type="button"
                  className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  onClick={() => {
                    setShowTagEditor(false);
                    setEditingTag(null);
                    setNewTagName('');
                    setNewTagColor('#3b82f6');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={editingTag ? handleUpdateTag : handleAddTag}
                >
                  {editingTag ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          )}
          
          {/* Tag list */}
          <div className="py-1">
            {tags.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                No tags available
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {tags.map(tag => (
                  <div 
                    key={tag.id}
                    className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedTags.includes(tag.id) ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className={`${selectedTags.includes(tag.id) ? 'font-medium' : ''} text-gray-700 dark:text-gray-200`}>
                        {tag.name}
                      </span>
                    </div>
                    
                    <div className="flex space-x-1">
                      {/* Edit button */}
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                        onClick={(e) => handleEditTag(tag, e)}
                        aria-label={`Edit tag ${tag.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      
                      {/* Delete button */}
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        onClick={(e) => handleDeleteTag(tag.id, e)}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer actions */}
          <div className="py-1">
            <button
              type="button"
              className="w-full text-left block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                setShowTagEditor(true);
                setEditingTag(null);
                setNewTagName('');
                setNewTagColor('#3b82f6');
              }}
            >
              + Create new tag
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagSelector;