import { useState, useCallback, useRef } from 'react';

const useFileHandling = (onError) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Handle drag and drop events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      
      // Create a preview of the file content
      const reader = new FileReader();
      reader.onload = (evt) => {
        // Only show first 500 characters for preview
        setFilePreview(evt.target.result.slice(0, 500) + '...');
      };
      reader.onerror = () => {
        if (onError) onError('Failed to read file for preview');
      };
      reader.readAsText(file);
    }
  }, [onError]);

  // Handle file selection with preview
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    
    // Create a preview of the file content
    const reader = new FileReader();
    reader.onload = (e) => {
      // Only show first 500 characters for preview
      setFilePreview(e.target.result.slice(0, 500) + '...');
    };
    reader.onerror = () => {
      if (onError) onError('Failed to read file for preview');
    };
    reader.readAsText(file);
  }, [onError]);

  // Clear the selected file
  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
    selectedFile,
    filePreview,
    dragActive,
    fileInputRef,
    handleDrag,
    handleDrop,
    handleFileSelect,
    clearSelectedFile
  };
};

export default useFileHandling;