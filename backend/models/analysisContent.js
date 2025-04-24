// backend/models/analysisContent.js
const mongoose = require('mongoose');

/**
 * Schema for storing analysis content
 * Separated from metadata for better performance and scalability
 */
const analysisContentSchema = new mongoose.Schema({
  // Timestamp identifier that matches the AnalysisHistory record
  timestamp: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // The actual analysis content
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Optional compressed version for large analyses
  compressedContent: {
    type: Buffer
  },
  
  // Whether the content is compressed
  isCompressed: {
    type: Boolean,
    default: false
  },
  
  // Content size in bytes
  contentSize: {
    type: Number
  },
  
  // Creation time
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to calculate content size
analysisContentSchema.pre('save', function(next) {
  if (!this.isCompressed) {
    this.contentSize = Buffer.byteLength(JSON.stringify(this.content));
    
    // If content is large, consider compressing
    if (this.contentSize > 100000) { // 100KB
      // Note: Actually implementing compression would require additional
      // libraries like zlib and more complex logic
      // This is just a placeholder for the concept
    }
  }
  next();
});

// Method to get content, handling decompression if needed
analysisContentSchema.methods.getContent = function() {
  if (this.isCompressed && this.compressedContent) {
    // Note: This would actually decompress the content
    // Again, just a placeholder for the concept
    return this.content;
  } else {
    return this.content;
  }
};

const AnalysisContent = mongoose.model('AnalysisContent', analysisContentSchema);

module.exports = AnalysisContent;