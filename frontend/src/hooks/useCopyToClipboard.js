import { useState, useCallback } from 'react';

const useCopyToClipboard = (onError) => {
  const [copySuccess, setCopySuccess] = useState(null);

  const copyToClipboard = useCallback(async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(section);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(null);
      }, 2000);
      
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      if (onError) {
        onError('Failed to copy to clipboard');
      }
      return false;
    }
  }, [onError]);

  return {
    copySuccess,
    copyToClipboard
  };
};

export default useCopyToClipboard;