import React, { useState } from 'react';
import axios from 'axios';
import './ChunkVisualizer.css';

const COLORS = [
  '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
  '#9b59b6', '#1abc9c', '#d35400', '#34495e'
];

const ChunkVisualizer = () => {
  const [text, setText] = useState('');
  const [maxTokens, setMaxTokens] = useState(4000);
  const [strategy, setStrategy] = useState('');
  const [visualization, setVisualization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChunk, setSelectedChunk] = useState(null);

  const visualizeChunks = async () => {
    if (!text.trim()) {
      setError('Please enter some text to visualize');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/chunker/visualize', {
        text,
        max_tokens: maxTokens,
        strategy: strategy || undefined
      });
      
      setVisualization(response.data);
    } catch (err) {
      setError('Failed to visualize chunks: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderVisualizedText = () => {
    if (!visualization) return null;
    
    const { original_text, chunks, chunk_positions } = visualization;
    
    // Create a map of character positions to chunk indices
    const positionMap = new Array(original_text.length).fill(-1);
    
    chunk_positions.forEach((position, index) => {
      if (position.start >= 0) {
        for (let i = position.start; i < position.end; i++) {
          if (i < positionMap.length) {
            positionMap[i] = index;
          }
        }
      }
    });
    
    // Create a colored representation of the text
    return (
      <div className="visualized-text">
        {original_text.split('').map((char, charIndex) => {
          const chunkIndex = positionMap[charIndex];
          const isSelected = selectedChunk === chunkIndex;
          const color = chunkIndex >= 0 ? COLORS[chunkIndex % COLORS.length] : 'transparent';
          
          return (
            <span 
              key={charIndex}
              className={`text-char ${isSelected ? 'selected' : ''} ${chunkIndex >= 0 ? 'chunked' : ''}`}
              style={{ 
                backgroundColor: color,
                opacity: selectedChunk !== null && !isSelected ? 0.3 : 1
              }}
              onClick={() => chunkIndex >= 0 && setSelectedChunk(chunkIndex === selectedChunk ? null : chunkIndex)}
            >
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="chunk-visualizer">
      <h2>Document Chunking Visualizer</h2>
      
      <div className="visualizer-controls">
        <div className="control-group">
          <label htmlFor="text-input">Text to Chunk:</label>
          <textarea 
            id="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to visualize how it will be chunked..."
            rows={5}
          />
        </div>
        
        <div className="control-row">
          <div className="control-group">
            <label htmlFor="max-tokens">Max Tokens per Chunk:</label>
            <input 
              id="max-tokens"
              type="number" 
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              min={100}
              max={8000}
            />
          </div>
          
          <div className="control-group">
            <label htmlFor="strategy">Chunking Strategy:</label>
            <select 
              id="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="">Adaptive (Default)</option>
              <option value="semantic">Semantic</option>
              <option value="structural">Structural</option>
              <option value="fixed_size">Fixed Size</option>
              <option value="sentence">Sentence</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={visualizeChunks}
          disabled={loading || !text.trim()}
          className="visualize-button"
        >
          {loading ? 'Processing...' : 'Visualize Chunks'}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {visualization && (
        <div className="visualization-results">
          <h3>Chunking Results</h3>
          <div className="chunk-stats">
            <div className="stat">
              <span className="stat-label">Total Chunks:</span>
              <span className="stat-value">{visualization.chunk_count}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg Chunk Size:</span>
              <span className="stat-value">
                {Math.round(visualization.chunk_sizes.reduce((a, b) => a + b, 0) / visualization.chunk_count)} chars
              </span>
            </div>
          </div>
          
          <div className="chunk-legend">
            {visualization.chunks.map((chunk, index) => (
              <div 
                key={index}
                className={`chunk-item ${selectedChunk === index ? 'selected' : ''}`}
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                onClick={() => setSelectedChunk(index === selectedChunk ? null : index)}
              >
                <span className="chunk-number">#{index + 1}</span>
                <span className="chunk-size">{chunk.length} chars</span>
              </div>
            ))}
          </div>
          
          {renderVisualizedText()}
        </div>
      )}
    </div>
  );
};

export default ChunkVisualizer;