// components/content/FileUploadContent.jsx
import React from 'react';

const UploadMethods = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li><strong>Drag and Drop:</strong> Drag files directly into the upload area</li>
    <li><strong>File Browser:</strong> Click the upload area to open a file browser</li>
    <li><strong>Clipboard Paste:</strong> Paste content from clipboard (for text files)</li>
  </ul>
);

const SupportedFiles = () => (
  <ul className="list-disc pl-5 space-y-2">
    <li>
      <strong>Code Files:</strong>
      <ul className="list-disc pl-5 mt-1">
        <li>JavaScript (.js, .jsx, .ts, .tsx)</li>
        <li>Python (.py)</li>
        <li>Java (.java)</li>
        <li>C/C++ (.c, .cpp, .h)</li>
        <li>Go (.go)</li>
        <li>Ruby (.rb)</li>
        <li>PHP (.php)</li>
        <li>Other common programming languages</li>
      </ul>
    </li>
    <li>
      <strong>Log Files:</strong>
      <ul className="list-disc pl-5 mt-1">
        <li>Text logs (.log, .txt)</li>
        <li>JSON logs (.json)</li>
        <li>XML logs (.xml)</li>
        <li>CSV logs (.csv)</li>
      </ul>
    </li>
    <li>
      <strong>Configuration Files:</strong>
      <ul className="list-disc pl-5 mt-1">
        <li>JSON (.json)</li>
        <li>YAML (.yml, .yaml)</li>
        <li>TOML (.toml)</li>
        <li>INI (.ini)</li>
      </ul>
    </li>
  </ul>
);

const FilePreview = () => (
  <p>
    Once uploaded, the application provides a preview of the file content. For large files, this preview is limited to the first few kilobytes. The preview helps confirm you've selected the correct file before analysis.
  </p>
);

const FileLimits = () => (
  <ul className="list-disc pl-5 space-y-1">
    <li><strong>Default Limit:</strong> 10MB per file</li>
    <li><strong>Extended Limit (with chunking):</strong> Up to 50MB with automatic chunking</li>
    <li><strong>Note:</strong> Very large files are automatically split into smaller chunks for analysis, which may impact the cohesiveness of results</li>
  </ul>
);

const FileUploadContent = {
  UploadMethods,
  SupportedFiles,
  FilePreview,
  FileLimits
};

export default FileUploadContent;