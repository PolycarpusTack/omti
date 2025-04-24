import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAppContext } from '../../context/AppContext';
import { useApi } from '../../hooks/useApi';
import { ProgressIndicator } from '../UI/ProgressIndicator';
import { ErrorDisplay } from '../UI/ErrorDisplay';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = ['text/plain', 'application/json', 'application/xml', 'text/xml'];

export function FileUpload() {
  const { state, actions } = useAppContext();
  const { analyzeFile, isLoading, error } = useApi();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    if (file.size > MAX_FILE_SIZE) {
      actions.setError('File size exceeds 50MB limit');
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      actions.setError('Invalid file type. Please upload a text, JSON, or XML file.');
      return;
    }

    try {
      actions.setLoading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const result = await analyzeFile(file, {
        model: state.settings.model,
        language: state.language,
        max_tokens_per_chunk: state.settings.maxTokensPerChunk,
        timeout: state.settings.timeout
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Handle the analysis result
      if (result) {
        actions.setAnalysisResults(prev => [...prev, result]);
      }
    } catch (err) {
      actions.setError(err.message);
    } finally {
      actions.setLoading(false);
      setUploadProgress(0);
    }
  }, [analyzeFile, state.settings, state.language, actions]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_FILE_TYPES.join(','),
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="file-upload-container">
      <div
        {...getRootProps()}
        className={`file-upload-dropzone ${isDragActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <div className="file-upload-content">
          <i className="fas fa-cloud-upload-alt"></i>
          <p>Drag and drop your file here, or click to select</p>
          <p className="file-upload-hint">
            Supported formats: .txt, .json, .xml (Max size: 50MB)
          </p>
        </div>
      </div>

      {isLoading && (
        <ProgressIndicator
          progress={uploadProgress}
          message="Analyzing your file..."
        />
      )}

      {error && <ErrorDisplay error={error} />}

      <style jsx>{`
        .file-upload-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .file-upload-dropzone {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background-color: ${state.isDarkMode ? '#2d2d2d' : '#f8f9fa'};
        }

        .file-upload-dropzone.active,
        .file-upload-dropzone.dragging {
          border-color: #007bff;
          background-color: ${state.isDarkMode ? '#1a1a1a' : '#e9ecef'};
        }

        .file-upload-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .file-upload-hint {
          font-size: 0.875rem;
          color: #6c757d;
        }

        i {
          font-size: 3rem;
          color: #007bff;
        }
      `}</style>
    </div>
  );
} 