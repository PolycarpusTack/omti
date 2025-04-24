import React from 'react';
import { Tooltip } from 'react-tooltip';

const OllamaStatus = ({ status }) => {
  return (
    <div className="absolute top-4 right-4 flex items-center">
      <span className="mr-2 font-semibold dark:text-gray-200">Ollama:</span>
      <div
        className={`w-4 h-4 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`}
        aria-label={status ? 'Ollama is running' : 'Ollama is not running'}
        data-tooltip-id="ollama-status-tooltip"
        data-tooltip-content={status ? 'Ollama service is running' : 'Ollama service is not running. Analysis may be limited.'}
      />
      <Tooltip id="ollama-status-tooltip" place="left" />
    </div>
  );
};

export default OllamaStatus;