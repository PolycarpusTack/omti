// ultimate-file-chunker.js

/**
 * UltimateChunker - Enterprise-grade file chunking utility for LLM processing
 * 
 * Features:
 * - Hybrid token estimation with multiple strategies
 * - Memory-efficient processing for large files
 * - Format-aware chunking (JSON, XML, code, logs, markdown)
 * - Structural boundary preservation
 * - Streaming support for large files
 * - Intelligent overlap with context retention
 * - Performance optimized for standard hardware
 * - Comprehensive error handling and recovery
 */
class UltimateChunker {
  constructor(options = {}) {
    this.options = {
      // Default settings
      defaultMaxTokensPerChunk: 4000,
      defaultOverlapTokens: 200,
      reservedTokens: 1000,
      formatDetectionSampleSize: 2500,
      maxRecursionDepth: 3,
      tokenHeuristic: 'balanced', // [balanced|precision|performance]
      enableFormatDetection: true,
      cacheSize: 1000, // Maximum number of token estimations to cache
      streamBufferSize: 100000, // Buffer size for stream processing
      ...options
    };

    // Initialize token estimation cache with LRU behavior
    this.tokenCache = new Map();
    this.tokenCacheOrder = [];
    
    // Pre-compile regex patterns for performance
    this.patterns = this._compilePatterns();
  }

  /**
   * Pre-compile all regex patterns for performance
   * @private
   * @returns {Object} Compiled patterns
   */
  _compilePatterns() {
    return {
      // Format detection patterns
      json: /^\s*[\[{]/,
      xml: /^\s*<(?:\?xml|!DOCTYPE|[a-zA-Z])/,
      markdown: /^(?:#+\s|\*\s|\d+\.\s|>\s|=+|-+)/m,
      sourceCode: /^(?:function|class|import|export|const|let|var|if|for|while)\b/m,
      
      // Character sets for token estimation
      latin: /[a-zA-Z0-9\s.,?!;:()\[\]{}'"<>\/\\|`~!@#$%^&*_+=]/,
      cjk: /[\u4e00-\u9fff\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u3400-\u4dbf]/,
      emoji: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u,
      
      // Content boundary markers
      sections: [
        // Move pattern.lastIndex to avoid infinite loop
        pattern.lastIndex = match.index + 1;
      }
    }
    
    // Then, find structural elements
    for (const pattern of structuralPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        boundaries.push({
          index: match.index,
          end: match.index + match[0].length,
          text: match[0],
          isHeader: false
        });
        
        // Move pattern.lastIndex to avoid infinite loop
        pattern.lastIndex = match.index + 1;
      }
    }
    
    // Sort boundaries by position
    boundaries.sort((a, b) => a.index - b.index);
    
    if (boundaries.length === 0) {
      // No markdown structure found, use generic chunking
      return this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
    }
    
    // Create chunks based on headers and structure
    const chunks = [];
    let currentChunk = '';
    let lastPosition = 0;
    
    // Keep track of header context for chunk continuity
    const headerStack = [];
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      
      // Skip if we've already processed past this point
      if (boundary.index < lastPosition) continue;
      
      // Determine the end of this section (start of next boundary or end of file)
      const nextBoundary = boundaries.find(b => b.index > boundary.end) || 
                         { index: content.length };
      
      const section = content.substring(boundary.index, nextBoundary.index);
      
      // Update header stack if this is a header
      if (boundary.isHeader) {
        // Remove any headers of same or higher level (lower numbers are higher level)
        while (headerStack.length > 0 && 
              headerStack[headerStack.length - 1].level >= boundary.level) {
          headerStack.pop();
        }
        
        // Add this header to the stack
        headerStack.push({
          level: boundary.level,
          text: boundary.text
        });
      }
      
      // Check if adding this section would exceed chunk size
      if (currentChunk && 
          currentChunk.length + section.length > maxCharsPerChunk) {
        chunks.push(currentChunk);
        
        // Start new chunk with context from headers
        let contextHeaders = '';
        for (const header of headerStack) {
          contextHeaders += `${'#'.repeat(header.level)} ${header.text.replace(/^#+\s+/, '')}\n`;
        }
        
        if (contextHeaders) {
          currentChunk = `<!-- Context from previous chunk -->\n${contextHeaders}\n<!-- Current content -->\n`;
        } else {
          currentChunk = `<!-- Continued from previous chunk -->\n`;
        }
        
        // Add overlap from previous chunk if not a header boundary
        if (!boundary.isHeader && currentChunk.length > overlapChars) {
          const prevChunkEnd = chunks[chunks.length - 1].slice(-overlapChars);
          currentChunk += prevChunkEnd;
        }
        
        currentChunk += section;
      } else {
        currentChunk += section;
      }
      
      lastPosition = nextBoundary.index;
    }
    
    // Add any remaining content
    if (lastPosition < content.length) {
      const remainingContent = content.substring(lastPosition);
      
      if (currentChunk.length + remainingContent.length > maxCharsPerChunk) {
        chunks.push(currentChunk);
        chunks.push(remainingContent);
      } else {
        currentChunk += remainingContent;
        chunks.push(currentChunk);
      }
    } else if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Add chunk metadata
    return chunks.map((chunk, i) => {
      return `<!-- MARKDOWN CHUNK ${i + 1}/${chunks.length} -->\n${chunk}`;
    });
  }

  /**
   * Emergency chunking for when all else fails
   * @private
   * @param {string} content - Text content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @returns {Array} Array of chunks
   */
  _emergencyChunk(content, maxTokensPerChunk) {
    console.warn('Using emergency chunking as fallback');
    
    const chunks = [];
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk);
    
    // Simple character-based chunking
    for (let i = 0; i < content.length; i += maxCharsPerChunk) {
      chunks.push(content.substring(i, i + maxCharsPerChunk));
    }
    
    return chunks.map((chunk, i) => {
      return `/* EMERGENCY CHUNK ${i + 1}/${chunks.length} */\n${chunk}`;
    });
  }

  /**
   * Final processing to ensure all chunks are valid
   * @private
   * @param {Array} chunks - Initial chunks
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Finalized chunks
   */
  _finalizeChunks(chunks, maxTokensPerChunk, overlapTokens) {
    // Filter out empty chunks
    const nonEmptyChunks = chunks.filter(chunk => chunk && chunk.trim().length > 0);
    
    // Double-check token counts
    const finalChunks = [];
    
    for (const chunk of nonEmptyChunks) {
      const tokenCount = this.estimateTokenCount(chunk);
      
      if (tokenCount <= maxTokensPerChunk) {
        finalChunks.push(chunk);
      } else {
        // Emergency split if still over limit
        console.warn(`Chunk still exceeds token limit (${tokenCount} > ${maxTokensPerChunk}), using emergency split`);
        const subChunks = this._emergencyChunk(chunk, maxTokensPerChunk);
        finalChunks.push(...subChunks);
      }
    }
    
    return finalChunks;
  }

  /**
   * Stitch chunks back together with context handling
   * @param {Array} chunks - Processed chunks
   * @param {Object} options - Stitching options
   * @returns {string} Reconstructed content
   */
  stitchChunks(chunks, options = {}) {
    if (!chunks || chunks.length === 0) return '';
    
    // Handle single chunk case
    if (chunks.length === 1) return this._cleanChunk(chunks[0]);
    
    let result = '';
    
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      
      // Clean chunk from metadata and overlap markers
      chunk = this._cleanChunk(chunk);
      
      // Remove overlap content in subsequent chunks
      if (i > 0) {
        chunk = chunk.replace(/^(?:\/\*|<!--) Continued from previous chunk (?:\*\/|-->)\n.*?\n/s, '');
        chunk = chunk.replace(/^# Log continues from previous chunk\n(?:# Last timestamp from previous chunk: .*?\n)?/s, '');
        chunk = chunk.replace(/^<!-- Context from previous chunk -->\n.*?<!-- Current content -->\n/s, '');
      }
      
      result += chunk;
    }
    
    return result;
  }

  /**
   * Clean a chunk from metadata markers
   * @private
   * @param {string} chunk - Chunk to clean
   * @returns {string} Cleaned chunk
   */
  _cleanChunk(chunk) {
    return chunk
      .replace(/^(?:\/\*|<!--) (?:CODE |MARKDOWN |EMERGENCY )?CHUNK \d+\/\d+ (?:\*\/|-->)\n/s, '')
      .replace(/^\/\/ CODE CHUNK \d+\/\d+\n/s, '');
  }
}

module.exports = new UltimateChunker(); Headers and section markers
        /^[=-]{3,}\s*$/m,                     // ===== or -----
        /^#{1,6}\s+.+$/m,                     // Markdown headers
        /^\s*<h[1-6]>.*<\/h[1-6]>\s*$/m,      // HTML headers
        
        // Log patterns
        /^\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?\]/m, // ISO timestamps
        /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?/m,     // ISO timestamps without brackets
        /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?/m,         // US date format
        
        // Log levels
        /^(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)\b/m,
        /^(?:E|W|I|D|T|F|C|N|S)\/[\w.]+\(\s*\d+\):/m,  // Android log format
        
        // Exception and stacktrace indicators
        /^(?:Exception|Error|Traceback|Caused by|at)\s+[\w.$]+(?:[:]\s|[:]\s+\w+|\s+[\w.(]+\()/m,
        /^\s+at\s+[\w.$]+(?:\.[\w.$]+)+\([^)]*\)$/m,  // Java/JS stack trace
        /^\s+File ".*", line \d+/m,                   // Python stack trace
        
        // Process and thread indicators
        /^Process ID:?\s+\d+/m,
        /^Thread(?: ID)?:?\s+\d+/m,
        /^pid=\d+\s+tid=\d+/m,
        
        // JSON, XML document boundaries
        /^\s*[{\[]/m,                           // JSON object/array start
        /^\s*<\?xml/m,                          // XML declaration
        /^\s*<[a-zA-Z][a-zA-Z0-9]*(?:\s+[a-zA-Z][a-zA-Z0-9]*(?:=(?:"[^"]*"|'[^']*'))?)*\s*>/m, // XML/HTML tag
        
        // Code structure
        /^(?:function|class|def|public|private|protected|internal|static|async|export|import)\s+[\w<>]+/m,
        /^(?:\s*if|\s*for|\s*while|\s*switch|\s*try|\s*catch|\s*finally)\s*\(/m,
        
        // Configuration sections
        /^\s*\[[^\]]+\]\s*$/m,                  // INI section header [section]
        /^---\s*$/m,                            // YAML document separator
        
        // Natural language paragraph boundaries
        /^\s*$/m,                               // Empty line (paragraph break)
        
        // Special structured content
        /^-{3,}BEGIN [A-Z]+-{3,}$/m,           // BEGIN CERTIFICATE or similar
        /^-{3,}END [A-Z]+-{3,}$/m              // END CERTIFICATE or similar
      ],
      
      // Nested structure markers for better preservation
      nestedStructures: {
        json: { open: /[{\[]/, close: /[}\]]/ },
        xml: { open: /<([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?>/, close: /<\/\1>/ },
        code: { 
          open: /(?:function|class|if|for|while|try|do)\s*(?:\w+\s*)?(?:\([^)]*\))?\s*{/, 
          close: /}/ 
        }
      },
      
      // Format-specific patterns
      logFormats: {
        iso8601: /\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]/,
        rfc3164: /\<\d+\>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\w+/,
        android: /^(?:[A-Z])\/[^\(]+\(\s*\d+\):/
      }
    };
  }

  /**
   * Master method to chunk content based on format and constraints
   * @param {string} content - File content
   * @param {Object} options - Chunking options
   * @returns {Array} Array of optimally chunked content pieces
   */
  chunkContent(content, options = {}) {
    try {
      const opts = { ...this.options, ...options };
      const maxTokensPerChunk = opts.maxTokensPerChunk || this.options.defaultMaxTokensPerChunk;
      const overlapTokens = opts.overlapTokens || this.options.defaultOverlapTokens;
      
      // Early return for empty content
      if (!content || content.length === 0) {
        return [];
      }
      
      // Handle small content that doesn't need chunking
      if (this.estimateTokenCount(content) <= maxTokensPerChunk) {
        return [content];
      }
      
      // Detect content format if format detection is enabled
      const contentFormat = opts.enableFormatDetection ? 
        this._detectFormat(content) : 'text';
      
      // Choose chunking strategy based on format
      let chunks;
      try {
        switch (contentFormat) {
          case 'json':
            chunks = this._chunkJson(content, maxTokensPerChunk, overlapTokens);
            break;
          case 'xml':
            chunks = this._chunkXml(content, maxTokensPerChunk, overlapTokens);
            break;
          case 'code':
            chunks = this._chunkCode(content, maxTokensPerChunk, overlapTokens);
            break;
          case 'logs':
            chunks = this._chunkLogs(content, maxTokensPerChunk, overlapTokens);
            break;
          case 'markdown':
            chunks = this._chunkMarkdown(content, maxTokensPerChunk, overlapTokens);
            break;
          default:
            chunks = this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
        }
      } catch (error) {
        console.warn(`Format-specific chunking for ${contentFormat} failed, falling back to generic chunking. Error: ${error.message}`);
        chunks = this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
      }
      
      // Ensure all chunks are valid and within token limits
      return this._finalizeChunks(chunks, maxTokensPerChunk, overlapTokens);
    } catch (error) {
      console.error('Error during content chunking:', error);
      // Emergency fallback: simple chunking by size
      return this._emergencyChunk(content, this.options.defaultMaxTokensPerChunk);
    }
  }

  /**
   * Stream-based processing for large files
   * @param {ReadableStream|string} source - File content stream or string
   * @param {Object} options - Chunking options
   * @returns {AsyncGenerator} Generator yielding chunks
   */
  async *chunkStream(source, options = {}) {
    const opts = { ...this.options, ...options };
    const bufferSize = opts.streamBufferSize || this.options.streamBufferSize;
    
    try {
      // Handle string input
      if (typeof source === 'string') {
        const chunks = this.chunkContent(source, options);
        for (const chunk of chunks) {
          yield chunk;
        }
        return;
      }
      
      // Handle stream input
      const decoder = new TextDecoder();
      let buffer = '';
      let previousChunk = '';
      
      // Process the stream in chunks
      for await (const chunk of source) {
        buffer += decoder.decode(chunk, { stream: true });
        
        // Process buffer when it gets large enough
        while (buffer.length > bufferSize) {
          const splitPoint = this._findSafeSplitPoint(buffer, opts);
          const contentToProcess = buffer.substring(0, splitPoint);
          
          // Process this portion with context from previous chunk
          const processedChunks = this.chunkContent(
            previousChunk ? 
              this._createOverlap(previousChunk, contentToProcess, opts.defaultOverlapTokens) : 
              contentToProcess, 
            opts
          );
          
          // Yield all but the last chunk
          for (let i = 0; i < processedChunks.length - 1; i++) {
            yield processedChunks[i];
          }
          
          // Save the last chunk for context
          previousChunk = processedChunks[processedChunks.length - 1];
          
          // Update buffer
          buffer = buffer.substring(splitPoint);
        }
      }
      
      // Handle any remaining content
      if (buffer.length > 0) {
        const finalContent = previousChunk ? 
          this._createOverlap(previousChunk, buffer, opts.defaultOverlapTokens) : 
          buffer;
          
        const finalChunks = this.chunkContent(finalContent, opts);
        
        // If we had previous context, skip the first chunk as it contains overlap
        const startIdx = previousChunk ? 1 : 0;
        
        for (let i = startIdx; i < finalChunks.length; i++) {
          yield finalChunks[i];
        }
      }
    } catch (error) {
      console.error('Error during stream chunking:', error);
      // Emergency fallback
      yield* this._emergencyStreamChunk(source, opts);
    }
  }

  /**
   * Create an overlapped chunk from previous and current content
   * @private
   * @param {string} previous - Previous chunk
   * @param {string} current - Current content
   * @param {number} overlapTokens - Target overlap size in tokens
   * @returns {string} Combined content with appropriate overlap
   */
  _createOverlap(previous, current, overlapTokens) {
    const overlapChars = this._getMaxCharLength(overlapTokens);
    const overlapContent = previous.length > overlapChars ? 
      previous.slice(-overlapChars) : previous;
      
    return overlapContent + current;
  }

  /**
   * Find a safe point to split a buffer for streaming
   * @private
   * @param {string} buffer - Text buffer
   * @param {Object} options - Processing options
   * @returns {number} Index where it's safe to split
   */
  _findSafeSplitPoint(buffer, options) {
    const targetPoint = Math.floor(buffer.length * 0.8); // Target 80% of buffer
    
    // Look for natural boundaries near the target point
    for (const pattern of this.patterns.sections) {
      // Reset lastIndex to avoid issues with global patterns
      pattern.lastIndex = 0;
      
      // Find all matches
      const matches = [];
      let match;
      while ((match = pattern.exec(buffer)) !== null) {
        matches.push(match.index);
        if (pattern.global === false) break;
        pattern.lastIndex = match.index + 1;
      }
      
      // Find closest match after target point
      for (const index of matches) {
        if (index >= targetPoint) {
          return index;
        }
      }
    }
    
    // Fallback: find a line break near target point
    const lineBreaks = [];
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === '\n') lineBreaks.push(i);
    }
    
    for (const index of lineBreaks) {
      if (index >= targetPoint) {
        return index + 1; // include the line break
      }
    }
    
    // Last resort: just use the target point
    return targetPoint;
  }

  /**
   * Emergency chunking for stream when regular processing fails
   * @private
   * @param {ReadableStream|string} source - Content source
   * @param {Object} options - Processing options
   * @returns {AsyncGenerator} Generator yielding emergency chunks
   */
  async *_emergencyStreamChunk(source, options) {
    try {
      const chunkSize = options.streamBufferSize || 50000;
      
      if (typeof source === 'string') {
        // Handle string case
        let position = 0;
        while (position < source.length) {
          const end = Math.min(position + chunkSize, source.length);
          yield source.substring(position, end);
          position = end;
        }
      } else {
        // Handle stream case
        const decoder = new TextDecoder();
        let buffer = '';
        
        for await (const chunk of source) {
          buffer += decoder.decode(chunk, { stream: true });
          
          while (buffer.length > chunkSize) {
            yield buffer.substring(0, chunkSize);
            buffer = buffer.substring(chunkSize);
          }
        }
        
        if (buffer.length > 0) {
          yield buffer;
        }
      }
    } catch (error) {
      console.error('Emergency stream chunking failed:', error);
      yield 'Error: Content could not be processed due to technical issues.';
    }
  }

  /**
   * Detect content format based on patterns and heuristics
   * @private
   * @param {string} content - Input content
   * @returns {string} Detected format type
   */
  _detectFormat(content) {
    // Sample the beginning of the content for faster detection
    const sampleSize = Math.min(content.length, this.options.formatDetectionSampleSize);
    const sample = content.substring(0, sampleSize);
    
    // Calculate format scores (higher = more confidence)
    const scores = {
      json: this._scoreJson(sample),
      xml: this._scoreXml(sample),
      logs: this._scoreLogs(sample),
      code: this._scoreCode(sample),
      markdown: this._scoreMarkdown(sample),
      text: 0.1 // Default low score for plain text
    };
    
    // Find format with highest score
    let maxFormat = 'text';
    let maxScore = scores.text;
    
    for (const [format, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxFormat = format;
      }
    }
    
    return maxFormat;
  }

  /**
   * Score likelihood of content being JSON
   * @private
   * @param {string} sample - Content sample
   * @returns {number} Score (0-1)
   */
  _scoreJson(sample) {
    try {
      // Clean the sample to handle potential truncation
      const cleaned = sample.replace(/,\s*$/, '')
                           .replace(/[{[][\s\S]*$/, match => 
                             match[0] === '{' ? '{}' : '[]');
                             
      // Try to parse - immediate high confidence if valid
      JSON.parse(cleaned);
      return 0.95;
    } catch (e) {
      // Check for JSON-like patterns
      const jsonMarkers = (sample.match(/[{}\[\],:]/g) || []).length / sample.length;
      const stringLiterals = (sample.match(/"(?:[^"\\]|\\.)*"/g) || []).length;
      const jsonKeywords = (sample.match(/\b(?:true|false|null)\b/g) || []).length;
      
      let score = 0;
      if (this.patterns.json.test(sample)) score += 0.3;
      score += jsonMarkers * 5;
      score += (stringLiterals / 10) * 0.3;
      score += (jsonKeywords / 5) * 0.2;
      
      return Math.min(0.9, score);
    }
  }

  /**
   * Score likelihood of content being XML/HTML
   * @private
   * @param {string} sample - Content sample
   * @returns {number} Score (0-1)
   */
  _scoreXml(sample) {
    // Check for XML declaration or DOCTYPE
    if (/<\?xml|<!DOCTYPE/i.test(sample)) {
      return 0.9;
    }
    
    // Count tags and attributes
    const openTags = (sample.match(/<[a-zA-Z][^>]*>/g) || []).length;
    const closeTags = (sample.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
    const attributes = (sample.match(/\s[a-zA-Z][a-zA-Z0-9]*=["'][^"']*["']/g) || []).length;
    
    let score = 0;
    score += (openTags / 20) * 0.4;
    score += (closeTags / 20) * 0.3;
    score += (attributes / 10) * 0.2;
    
    // Check for HTML-specific patterns
    if (/<html|<body|<div|<p|<span|<h[1-6]|<a\s|<img|<table/i.test(sample)) {
      score += 0.3;
    }
    
    return Math.min(0.9, score);
  }

  /**
   * Score likelihood of content being log file
   * @private
   * @param {string} sample - Content sample
   * @returns {number} Score (0-1)
   */
  _scoreLogs(sample) {
    // Split into first few lines
    const lines = sample.split(/\r?\n/).slice(0, 20);
    
    // Count timestamp-like patterns
    const timestampCount = lines.filter(line => 
      /\d{4}-\d{2}-\d{2}/.test(line) || 
      /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line) ||
      /\d{2}:\d{2}:\d{2}/.test(line)
    ).length;
    
    // Count log level indicators
    const logLevelCount = lines.filter(line => 
      /\b(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL)\b/i.test(line)
    ).length;
    
    // Count stack trace indicators
    const stackTraceCount = lines.filter(line =>
      /at .+\(.+\.(?:java|js|ts|cs|py):\d+\)/.test(line) ||
      /\s+at\s+[\w.$]+(?:\.[\w.$]+)+\([^)]*\)/.test(line) ||
      /File ".+", line \d+/.test(line)
    ).length;
    
    // Calculate score based on log patterns
    let score = 0;
    score += (timestampCount / lines.length) * 0.5;
    score += (logLevelCount / lines.length) * 0.4;
    score += (stackTraceCount / lines.length) * 0.3;
    
    // Check for platform-specific log formats
    if (this.patterns.logFormats.iso8601.test(sample)) score += 0.2;
    if (this.patterns.logFormats.rfc3164.test(sample)) score += 0.2;
    if (this.patterns.logFormats.android.test(sample)) score += 0.2;
    
    return Math.min(0.9, score);
  }

  /**
   * Score likelihood of content being source code
   * @private
   * @param {string} sample - Content sample
   * @returns {number} Score (0-1)
   */
  _scoreCode(sample) {
    // Remove strings and comments for more accurate detection
    const cleaned = sample
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    
    // Count code-specific patterns
    const keywordCount = (cleaned.match(/\b(?:function|class|if|else|for|while|return|var|const|let|import|export|try|catch)\b/g) || []).length;
    const bracketPairs = Math.min(
      (cleaned.match(/\{/g) || []).length,
      (cleaned.match(/\}/g) || []).length
    );
    const semicolons = (cleaned.match(/;/g) || []).length;
    const indentation = (cleaned.match(/^\s+/gm) || []).length;
    
    // Language-specific patterns
    const jsPatterns = (cleaned.match(/\b(?:typeof|undefined|null|console|document|window)\b/g) || []).length;
    const pythonPatterns = (cleaned.match(/\b(?:def|elif|lambda|self|__init__|pass)\b/g) || []).length;
    const javaPatterns = (cleaned.match(/\b(?:public|private|protected|static|void|new|extends|implements)\b/g) || []).length;
    
    // Calculate score
    let score = 0;
    score += (keywordCount / 20) * 0.3;
    score += (bracketPairs / 10) * 0.2;
    score += (semicolons / 15) * 0.1;
    score += (indentation / 15) * 0.2;
    score += (jsPatterns / 5) * 0.1;
    score += (pythonPatterns / 5) * 0.1;
    score += (javaPatterns / 5) * 0.1;
    
    // Check for common code patterns
    if (this.patterns.sourceCode.test(sample)) score += 0.2;
    
    return Math.min(0.9, score);
  }

  /**
   * Score likelihood of content being markdown
   * @private
   * @param {string} sample - Content sample
   * @returns {number} Score (0-1)
   */
  _scoreMarkdown(sample) {
    // Count markdown-specific patterns
    const headings = (sample.match(/^#{1,6}\s+.+$/gm) || []).length;
    const alternateHeadings = (sample.match(/^[^\n]+\n[=\-]{2,}$/gm) || []).length;
    const listItems = (sample.match(/^[\s]*[-*+]\s+.+$/gm) || []).length;
    const numberedItems = (sample.match(/^[\s]*\d+\.\s+.+$/gm) || []).length;
    const codeBlocks = (sample.match(/^```[\s\S]*?```$/gm) || []).length;
    const links = (sample.match(/\[.+?\]\(.+?\)/g) || []).length;
    const emphasis = (sample.match(/(\*\*|__).+?(\*\*|__)/g) || []).length;
    
    // Calculate score
    let score = 0;
    score += (headings / 5) * 0.3;
    score += (alternateHeadings / 2) * 0.2;
    score += (listItems / 10) * 0.2;
    score += (numberedItems / 5) * 0.1;
    score += (codeBlocks / 2) * 0.2;
    score += (links / 5) * 0.1;
    score += (emphasis / 5) * 0.1;
    
    // Additional check for common markdown features
    if (/!\[.*?\]\(.*?\)/.test(sample)) score += 0.1; // Images
    if (/>\s+.*?/.test(sample)) score += 0.1; // Blockquotes
    
    return Math.min(0.9, score);
  }

  /**
   * Advanced token estimation with caching
   * @param {string} text - Input text
   * @param {string} strategy - Estimation strategy
   * @returns {number} Estimated token count
   */
  estimateTokenCount(text, strategy = this.options.tokenHeuristic) {
    // Trivial cases
    if (!text) return 0;
    if (text.length <= 1) return 1;
    
    // Check cache first for performance
    const cacheKey = `${text.substring(0, 50)}...${text.length}...${text.substring(text.length - 50)}`;
    if (this.tokenCache.has(cacheKey)) {
      // Move to end of cache order (LRU behavior)
      const index = this.tokenCacheOrder.indexOf(cacheKey);
      if (index !== -1) {
        this.tokenCacheOrder.splice(index, 1);
        this.tokenCacheOrder.push(cacheKey);
      }
      return this.tokenCache.get(cacheKey);
    }
    
    // Calculate token count based on strategy
    let count;
    switch (strategy) {
      case 'precision':
        count = this._precisionTokenEstimate(text);
        break;
      case 'performance':
        count = Math.ceil(text.length / 3.5);
        break;
      default:
        count = this._balancedTokenEstimate(text);
    }
    
    // Cache the result (with LRU eviction if needed)
    if (this.tokenCacheOrder.length >= this.options.cacheSize) {
      const oldestKey = this.tokenCacheOrder.shift();
      this.tokenCache.delete(oldestKey);
    }
    this.tokenCache.set(cacheKey, count);
    this.tokenCacheOrder.push(cacheKey);
    
    return count;
  }

  /**
   * High-precision token estimation (slower but more accurate)
   * @private
   * @param {string} text - Input text
   * @returns {number} Estimated token count
   */
  _precisionTokenEstimate(text) {
    // Extract features
    const features = this._extractTextFeatures(text);
    
    // Calculate initial estimate based on word count
    const wordCount = (text.match(/\b\w+\b/g) || []).length;
    
    // Base token count from words (most tokens are word-based)
    let baseEstimate = wordCount * 1.25;
    
    // Adjust for different content characteristics
    baseEstimate *= 1 + (features.symbolDensity * 0.2);
    
    // Add tokens for special character sets
    if (features.hasCJK) {
      const cjkChars = (text.match(this.patterns.cjk) || []).length;
      baseEstimate += cjkChars * 0.8; // CJK chars often tokenize 1:1
    }
    
    if (features.hasEmoji) {
      const emojiCount = (text.match(this.patterns.emoji) || []).length;
      baseEstimate += emojiCount * 1.5; // Emojis typically 1-2 tokens each
    }
    
    // Add tokens for whitespace and punctuation
    const whitespaceCount = (text.match(/\s+/g) || []).length;
    const punctuationCount = (text.match(/[.,;:!?()[\]{}'"<>\/\\|`~@#$%^&*_+=\-]/g) || []).length;
    
    baseEstimate += whitespaceCount * 0.1;
    baseEstimate += punctuationCount * 0.3;
    
    return Math.ceil(baseEstimate);
  }

  /**
   * Balanced token estimation (compromise between speed and accuracy)
   * @private
   * @param {string} text - Input text
   * @returns {number} Estimated token count
   */
  _balancedTokenEstimate(text) {
    // Normalize whitespace for more consistent results
    const normalizedText = text.replace(/\s+/g, ' ');
    
    // Check language characteristics
    const nonLatinChars = (normalizedText.match(/[^\x00-\x7F]/g) || []).length;
    const nonLatinRatio = nonLatinChars / normalizedText.length;
    
    // Different character-per-token ratios based on content
    let charsPerToken;
    
    if (nonLatinRatio > 0.5) {
      // CJK text typically has much different tokenization
      charsPerToken = 1.5;
    } else if (/\S+/.test(normalizedText) && !/\s/.test(normalizedText)) {
      // No whitespace (like identifiers or URLs)
      charsPerToken = 3;
    } else if (/[\{\}\[\]()=><]/g.test(normalizedText)) {
      // Code-like content with symbols
      charsPerToken = 3.5;
    } else {
      // Standard English text
      charsPerToken = 4;
    }
    
    // Adjust for emoji
    let emojiAdjustment = 0;
    if (this.patterns.emoji.test(normalizedText)) {
      const emojiMatches = normalizedText.match(this.patterns.emoji) || [];
      // Each emoji can take 1-2 tokens, subtract their character count and add directly
      emojiAdjustment = emojiMatches.length;
      charsPerToken = (normalizedText.length - emojiMatches.length * 2) / 
                      (normalizedText.length / charsPerToken - emojiAdjustment);
    }
    
    return Math.ceil(normalizedText.length / charsPerToken + emojiAdjustment);
  }

  /**
   * Extract text features for token estimation
   * @private
   * @param {string} text - Input text
   * @returns {Object} Features object
   */
  _extractTextFeatures(text) {
    return {
      length: text.length,
      wordCount: (text.match(/\b\w+\b/g) || []).length,
      whitespaceRatio: (text.match(/\s/g) || []).length / text.length,
      symbolDensity: (text.match(/[^\w\s]/g) || []).length / text.length,
      hasCJK: this.patterns.cjk.test(text),
      hasEmoji: this.patterns.emoji.test(text),
      avgWordLength: text.match(/\b\w+\b/g) ? 
        text.match(/\b\w+\b/g).reduce((sum, word) => sum + word.length, 0) / 
        text.match(/\b\w+\b/g).length : 5
    };
  }

  /**
   * Calculate maximum character length based on token limit
   * @private
   * @param {number} maxTokens - Maximum tokens allowed
   * @param {string} contentType - Type of content for estimation
   * @returns {number} Maximum character length
   */
  _getMaxCharLength(maxTokens, contentType = 'text') {
    const reservedTokens = this.options.reservedTokens;
    const effectiveMaxTokens = Math.max(1, maxTokens - reservedTokens);
    
    // Different character-to-token ratios based on content type
    let charsPerToken;
    switch (contentType) {
      case 'json':
      case 'code':
        charsPerToken = 3.5;
        break;
      case 'xml':
        charsPerToken = 3;
        break;
      case 'cjk':
        charsPerToken = 1.5;
        break;
      default:
        charsPerToken = 4;
    }
    
    return Math.floor(effectiveMaxTokens * charsPerToken);
  }

  /**
   * Intelligent chunking for generic text content
   * @private
   * @param {string} content - Text content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkGeneric(content, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk);
    const overlapChars = this._getMaxCharLength(overlapTokens);
    
    // Try to split by semantic boundaries
    let chunks = [content];
    
    // Iteratively apply boundary patterns from most significant to least
    for (const boundaryPattern of this.patterns.sections) {
      if (chunks.every(chunk => this.estimateTokenCount(chunk) <= maxTokensPerChunk)) {
        break; // All chunks are already small enough
      }
      
      const newChunks = [];
      
      for (const chunk of chunks) {
        if (this.estimateTokenCount(chunk) <= maxTokensPerChunk) {
          newChunks.push(chunk);
          continue;
        }
        
        // Try to split by this boundary
        const parts = this._splitByPattern(chunk, boundaryPattern);
        
        if (parts.length <= 1) {
          // This pattern didn't split the chunk
          newChunks.push(chunk);
          continue;
        }
        
        let currentChunk = '';
        let lastBoundary = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          
          // Get the matched boundary (preserved in split)
          const boundary = i > 0 && parts[i-1].match ? parts[i-1].match : '';
          
          // Check if adding this part would exceed the chunk size
          if (currentChunk && 
              (currentChunk.length + boundary.length + part.text.length > maxCharsPerChunk)) {
            newChunks.push(currentChunk);
            
            // Start new chunk with overlap from the previous chunk
            if (currentChunk.length > overlapChars) {
              currentChunk = currentChunk.slice(-overlapChars) + boundary + part.text;
            } else {
              currentChunk = currentChunk + boundary + part.text;
            }
          } else {
            currentChunk += boundary + part.text;
          }
          
          lastBoundary = boundary;
        }
        
        if (currentChunk) {
          newChunks.push(currentChunk);
        }
      }
      
      chunks = newChunks;
    }
    
    // Final fallback: If any chunks are still too large, use line-based chunking
    chunks = this._ensureChunkSize(chunks, maxTokensPerChunk, overlapTokens);
    
    return chunks;
  }

  /**
   * Split text by pattern while preserving the pattern matches
   * @private
   * @param {string} text - Text to split
   * @param {RegExp} pattern - Pattern to split by
   * @returns {Array} Array of {text, match} objects
   */
  _splitByPattern(text, pattern) {
    // Reset the pattern if it has a global flag
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    
    const result = [];
    let lastIndex = 0;
    let match;
    
    // Use exec to iterate through matches
    while ((match = pattern.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result.push({
          text: text.substring(lastIndex, match.index),
          match: ''
        });
      }
      
      // Add the match
      result.push({
        text: '',
        match: match[0]
      });
      
      lastIndex = match.index + match[0].length;
      
      // Break loop if pattern is not global
      if (!pattern.global) break;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        text: text.substring(lastIndex),
        match: ''
      });
    }
    
    // Merge adjacent entries for cleaner result
    const merged = [];
    let current = null;
    
    for (const item of result) {
      if (!current) {
        current = { ...item };
      } else if (item.match && !current.match) {
        current.match = item.match;
      } else if (!item.match && current.match) {
        current.text += item.text;
      } else {
        merged.push(current);
        current = { ...item };
      }
    }
    
    if (current) {
      merged.push(current);
    }
    
    return merged;
  }

  /**
   * Ensure all chunks are within token limits
   * @private
   * @param {Array} chunks - Initial chunks
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Size-compliant chunks
   */
  _ensureChunkSize(chunks, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk);
    const overlapChars = this._getMaxCharLength(overlapTokens);
    const result = [];
    
    for (const chunk of chunks) {
      if (this.estimateTokenCount(chunk) <= maxTokensPerChunk) {
        result.push(chunk);
        continue;
      }
      
      // Split by lines first
      const lines = chunk.split(/\r?\n/);
      let currentChunk = '';
      
      for (const line of lines) {
        if (currentChunk && 
            (currentChunk.length + line.length + 1 > maxCharsPerChunk)) {
          result.push(currentChunk);
          
          // Start new chunk with overlap
          if (currentChunk.length > overlapChars) {
            currentChunk = currentChunk.slice(-overlapChars) + '\n' + line;
          } else {
            currentChunk = currentChunk + '\n' + line;
          }
        } else {
          if (currentChunk) currentChunk += '\n';
          currentChunk += line;
        }
        
        // Handle very long lines
        while (currentChunk.length > maxCharsPerChunk) {
          const splitPos = maxCharsPerChunk - Math.min(overlapChars, maxCharsPerChunk / 5);
          result.push(currentChunk.slice(0, splitPos));
          currentChunk = currentChunk.slice(splitPos - overlapChars);
        }
      }
      
      if (currentChunk) {
        result.push(currentChunk);
      }
    }
    
    return result;
  }

  /**
   * Chunk JSON content intelligently
   * @private
   * @param {string} content - JSON content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkJson(content, maxTokensPerChunk, overlapTokens) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      
      // Handle different JSON structures
      if (Array.isArray(parsed)) {
        return this._chunkJsonArray(content, parsed, maxTokensPerChunk, overlapTokens);
      } else if (typeof parsed === 'object' && parsed !== null) {
        return this._chunkJsonObject(content, parsed, maxTokensPerChunk, overlapTokens);
      }
      
      // Simple JSON (number, string, boolean) - return as is
      return [content];
    } catch (e) {
      // Not valid JSON or other error
      console.warn('Failed to parse JSON content, using generic chunking:', e.message);
      return this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
    }
  }

  /**
   * Chunk a JSON array into parts
   * @private
   * @param {string} originalJson - Original JSON string
   * @param {Array} parsedArray - Parsed JSON array
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of JSON chunks
   */
  _chunkJsonArray(originalJson, parsedArray, maxTokensPerChunk, overlapTokens) {
    const chunks = [];
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk, 'json');
    
    // Handle empty or small arrays
    if (parsedArray.length === 0 || originalJson.length <= maxCharsPerChunk) {
      return [originalJson];
    }
    
    let currentChunk = [];
    let currentSize = 2; // account for [ and ]
    
    for (const item of parsedArray) {
      const itemJson = JSON.stringify(item);
      const itemSize = itemJson.length + 1; // +1 for comma
      
      // Check if adding this item would exceed chunk size
      if (currentChunk.length > 0 && currentSize + itemSize > maxCharsPerChunk) {
        // Finalize current chunk
        chunks.push(JSON.stringify(currentChunk));
        
        // Start new chunk with overlap if needed
        const overlapItems = Math.min(
          Math.ceil(overlapTokens / 50), // rough estimate of items for overlap
          currentChunk.length
        );
        
        if (overlapItems > 0) {
          currentChunk = currentChunk.slice(-overlapItems);
          currentSize = JSON.stringify(currentChunk).length;
        } else {
          currentChunk = [];
          currentSize = 2;
        }
      }
      
      currentChunk.push(item);
      currentSize += itemSize;
    }
    
    if (currentChunk.length > 0) {
      chunks.push(JSON.stringify(currentChunk));
    }
    
    // Add metadata to each chunk
    return chunks.map((chunk, index) => {
      return `{"_chunk_info":{"index":${index},"total":${chunks.length},"type":"json_array"},"data":${chunk}}`;
    });
  }

  /**
   * Chunk a JSON object by properties
   * @private
   * @param {string} originalJson - Original JSON string
   * @param {Object} parsedObj - Parsed JSON object
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of JSON chunks
   */
  _chunkJsonObject(originalJson, parsedObj, maxTokensPerChunk, overlapTokens) {
    const chunks = [];
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk, 'json');
    
    // Handle small objects
    if (originalJson.length <= maxCharsPerChunk) {
      return [originalJson];
    }
    
    // Get all top-level properties
    const properties = Object.keys(parsedObj);
    
    let currentChunk = {};
    let currentSize = 2; // account for { and }
    
    for (const prop of properties) {
      const value = parsedObj[prop];
      const propJson = `"${prop}":${JSON.stringify(value)}`;
      const propSize = propJson.length + 1; // +1 for comma
      
      // Check if adding this property would exceed chunk size
      if (Object.keys(currentChunk).length > 0 && currentSize + propSize > maxCharsPerChunk) {
        // Finalize current chunk with metadata
        currentChunk._chunk_info = {
          index: chunks.length,
          properties: Object.keys(currentChunk).filter(k => k !== '_chunk_info')
        };
        chunks.push(JSON.stringify(currentChunk));
        
        // Start new chunk with metadata
        currentChunk = {
          _chunk_info: {
            continued: true,
            previous_chunk: chunks.length - 1
          }
        };
        currentSize = JSON.stringify(currentChunk).length;
      }
      
      currentChunk[prop] = value;
      currentSize += propSize;
    }
    
    if (Object.keys(currentChunk).length > 0) {
      // Add metadata to final chunk
      if (!currentChunk._chunk_info) {
        currentChunk._chunk_info = {};
      }
      
      currentChunk._chunk_info.index = chunks.length;
      currentChunk._chunk_info.properties = Object.keys(currentChunk)
        .filter(k => k !== '_chunk_info');
      currentChunk._chunk_info.final = true;
      
      chunks.push(JSON.stringify(currentChunk));
    }
    
    // Update all chunks with total count
    return chunks.map(chunk => {
      const parsed = JSON.parse(chunk);
      parsed._chunk_info.total = chunks.length;
      parsed._chunk_info.type = "json_object";
      return JSON.stringify(parsed);
    });
  }

  /**
   * Chunk XML content preserving structure
   * @private
   * @param {string} content - XML content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkXml(content, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk, 'xml');
    const overlapChars = this._getMaxCharLength(overlapTokens, 'xml');
    
    // Find XML tag boundaries
    const tagMatches = [];
    const tagRegex = /<\/?[a-zA-Z][^>]*>/g;
    let match;
    
    // Collect all tag positions
    while ((match = tagRegex.exec(content)) !== null) {
      tagMatches.push({
        index: match.index,
        end: match.index + match[0].length,
        text: match[0],
        isOpening: !match[0].startsWith('</') && !match[0].endsWith('/>'),
        isClosing: match[0].startsWith('</'),
        isSelfClosing: match[0].endsWith('/>'),
        // Extract tag name
        name: match[0].match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1] || ''
      });
    }
    
    if (tagMatches.length === 0) {
      // No XML tags found, use generic chunking
      return this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
    }
    
    // Track tag stack for proper nesting
    const chunks = [];
    let currentChunk = '';
    let openTags = [];
    let lastPosition = 0;
    
    for (let i = 0; i < tagMatches.length; i++) {
      const tagMatch = tagMatches[i];
      
      // Add content before this tag
      const contentBefore = content.substring(lastPosition, tagMatch.index);
      
      // Check if adding this content and tag would exceed the chunk size
      if (currentChunk && 
          (currentChunk.length + contentBefore.length + tagMatch.text.length > maxCharsPerChunk) &&
          openTags.length === 0) {
        // We can safely break here without violating nesting
        chunks.push(currentChunk);
        
        // Start new chunk with appropriate overlap
        if (currentChunk.length > overlapChars) {
          currentChunk = `<!-- Continued from previous chunk -->\n${currentChunk.slice(-overlapChars)}`;
        } else {
          currentChunk = `<!-- Continued from previous chunk -->\n${currentChunk}`;
        }
      }
      
      // Add content before this tag to current chunk
      currentChunk += contentBefore;
      
      // Process opening and closing tags to track nesting
      if (tagMatch.isOpening) {
        openTags.push(tagMatch.name);
      } else if (tagMatch.isClosing) {
        // Find matching opening tag
        const matchIndex = openTags.lastIndexOf(tagMatch.name);
        if (matchIndex !== -1) {
          openTags.splice(matchIndex, 1);
        }
      }
      
      // Add this tag to current chunk
      currentChunk += tagMatch.text;
      lastPosition = tagMatch.end;
      
      // Check if we've reached a good breaking point (no open tags)
      if (openTags.length === 0 && 
          currentChunk.length > maxCharsPerChunk * 0.5 && 
          i < tagMatches.length - 1) {
        chunks.push(currentChunk);
        currentChunk = `<!-- Continued from previous chunk -->\n`;
      }
    }
    
    // Add any remaining content
    if (lastPosition < content.length) {
      currentChunk += content.substring(lastPosition);
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Double-check that no chunk exceeds token limit
    return this._ensureChunkSize(chunks, maxTokensPerChunk, overlapTokens);
  }

  /**
   * Chunk source code preserving structure
   * @private
   * @param {string} content - Source code
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkCode(content, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk, 'code');
    const overlapChars = this._getMaxCharLength(overlapTokens, 'code');
    
    // Common code boundary patterns
    const boundaryPatterns = [
      // Function/class/method definitions
      /^(?:function|class|def|public|private|protected|static|async)\s+\w+\s*\([^)]*\)\s*{?/gm,
      // Control structures
      /^(?:if|for|while|switch|try|catch|finally)\s*\([^)]*\)\s*{?/gm,
      // Module declarations
      /^(?:import|export|require|module\.exports)\s+.+?;?$/gm,
      // Variable declarations
      /^(?:const|let|var)\s+\w+\s*=.+?;?$/gm,
      // Comments
      /^\/\/.*$|^\/\*[\s\S]*?\*\/$/gm,
      // Empty lines as minimal boundaries
      /^\s*$/gm
    ];
    
    // Find all boundaries
    const boundaries = [];
    
    for (const pattern of boundaryPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        boundaries.push({
          index: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
    }
    
    // Sort boundaries by position
    boundaries.sort((a, b) => a.index - b.index);
    
    if (boundaries.length === 0) {
      // No code structure boundaries found, use generic chunking
      return this._chunkGeneric(content, maxTokensPerChunk, overlapTokens);
    }
    
    // Create chunks based on boundaries
    const chunks = [];
    let currentChunk = '';
    let lastPosition = 0;
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      
      // Skip if we've already processed past this point
      if (boundary.index < lastPosition) continue;
      
      // Determine the end of this section (start of next boundary or end of file)
      const nextBoundary = boundaries.find(b => b.index > boundary.end) || 
                           { index: content.length };
      
      const section = content.substring(boundary.index, nextBoundary.index);
      
      // Check if adding this section would exceed chunk size
      if (currentChunk && 
          currentChunk.length + section.length > maxCharsPerChunk) {
        chunks.push(currentChunk);
        
        // Start new chunk with overlap
        if (currentChunk.length > overlapChars) {
          currentChunk = `// Continued from previous chunk\n${currentChunk.slice(-overlapChars)}${section}`;
        } else {
          currentChunk = `// Continued from previous chunk\n${currentChunk}${section}`;
        }
      } else {
        currentChunk += section;
      }
      
      lastPosition = nextBoundary.index;
    }
    
    // Add any remaining content
    if (lastPosition < content.length) {
      const remainingContent = content.substring(lastPosition);
      
      if (currentChunk.length + remainingContent.length > maxCharsPerChunk) {
        chunks.push(currentChunk);
        chunks.push(remainingContent);
      } else {
        currentChunk += remainingContent;
        chunks.push(currentChunk);
      }
    } else if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Add chunk metadata
    return chunks.map((chunk, i) => {
      return `// CODE CHUNK ${i + 1}/${chunks.length}\n${chunk}`;
    });
  }

  /**
   * Chunk logs by timestamps and entries
   * @private
   * @param {string} content - Log content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkLogs(content, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk);
    const overlapChars = this._getMaxCharLength(overlapTokens);
    
    // Common log entry patterns
    const logEntryPatterns = [
      // ISO timestamp patterns
      /^\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]/m,
      /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/m,
      // US date format
      /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?/m,
      // Log levels
      /^(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)(?:\s+|\:)/m,
      // Mobile platform logs
      /^(?:E|W|I|D|T|F|C|N|S)\/[\w.]+\(\s*\d+\):/m,
    ];
    
    // Split content by lines
    const lines = content.split(/\r?\n/);
    const chunks = [];
    let currentChunk = '';
    let isNewEntry = true;
    
    for (const line of lines) {
      // Check if this line starts a new log entry
      isNewEntry = logEntryPatterns.some(pattern => pattern.test(line));
      
      // Check if adding this line would exceed chunk size and it's a new entry
      if (currentChunk && 
          (currentChunk.length + line.length + 1 > maxCharsPerChunk) && 
          isNewEntry) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        if (currentChunk) currentChunk += '\n';
        currentChunk += line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    // Add overlap between chunks for log context
    return chunks.map((chunk, index) => {
      if (index === 0) return chunk;
      
      // Extract timestamp from previous chunk if possible
      const prevChunk = chunks[index - 1];
      let contextHeader = '# Log continues from previous chunk\n';
      
      // Try to add the last timestamp from previous chunk
      const timestampMatch = prevChunk.match(
        /(?:^|\n)(\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]|
        \d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?|
        \d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?).*$/m
      );
      
      if (timestampMatch) {
        contextHeader += `# Last timestamp from previous chunk: ${timestampMatch[1]}\n`;
      }
      
      return contextHeader + chunk;
    });
  }

  /**
   * Chunk markdown content by headers and sections
   * @private
   * @param {string} content - Markdown content
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {number} overlapTokens - Tokens to overlap between chunks
   * @returns {Array} Array of chunks
   */
  _chunkMarkdown(content, maxTokensPerChunk, overlapTokens) {
    const maxCharsPerChunk = this._getMaxCharLength(maxTokensPerChunk);
    const overlapChars = this._getMaxCharLength(overlapTokens);
    
    // Markdown section patterns (headers)
    const headerPatterns = [
      /^#{1,6}\s+(.+)$/m,    // ATX headings (#, ##, etc)
      /^(.+)\n[=]{2,}$/m,    // Setext heading level 1 (===)
      /^(.+)\n[-]{2,}$/m     // Setext heading level 2 (---)
    ];
    
    // Other structural patterns
    const structuralPatterns = [
      /^(?:\s*[-+*]\s+.+)$/m,  // List items
      /^(?:\s*\d+\.\s+.+)$/m,  // Numbered lists
      /^>(.+)$/m,              // Blockquotes
      /^```[a-z]*$/m,          // Code blocks
      /^---$/m,                // Horizontal rule
      /^\s*$/m                 // Blank lines
    ];
    
    // Collect all header and structural boundaries
    const boundaries = [];
    
    // First, find all headers (most important boundaries)
    for (const pattern of headerPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        boundaries.push({
          index: match.index,
          end: match.index + match[0].length,
          text: match[0],
          isHeader: true,
          level: match[0].startsWith('#') ? 
            match[0].match(/^(#+)/)[1].length : 
            (match[0].includes('=') ? 1 : 2)
        });
        
        //