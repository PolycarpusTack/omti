// backend/models/modelSuggestion.js
const mongoose = require('mongoose');

/**
 * Schema for storing model suggestion feedback
 * Used to learn and improve suggestions over time
 */
const modelSuggestionSchema = new mongoose.Schema({
  // When the suggestion was made
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Model that was suggested by the system
  suggestedModelId: {
    type: String,
    required: true
  },
  
  // Model that was actually selected by the user
  selectedModelId: {
    type: String,
    required: true
  },
  
  // Whether the suggestion was accepted
  wasSuggestionAccepted: {
    type: Boolean,
    required: true
  },
  
  // Content characteristics that led to the suggestion
  contentCharacteristics: {
    // Type of log (error, info, debug, etc.)
    logType: {
      type: String,
      default: 'unknown'
    },
    
    // Length range of the content (xs, s, m, l, xl)
    contentLengthRange: {
      type: String,
      enum: ['xs', 's', 'm', 'l', 'xl'],
      default: 'm'
    },
    
    // Whether content had stack traces
    includeStackTraces: {
      type: Boolean,
      default: false
    }
  },
  
  // Optional user ID for personalized suggestions
  userId: {
    type: String,
    default: 'anonymous'
  }
});

// Add indexes for faster queries
modelSuggestionSchema.index({ timestamp: -1 });
modelSuggestionSchema.index({ 'contentCharacteristics.logType': 1 });
modelSuggestionSchema.index({ 'contentCharacteristics.contentLengthRange': 1 });
modelSuggestionSchema.index({ suggestedModelId: 1, wasSuggestionAccepted: 1 });

const ModelSuggestion = mongoose.model('ModelSuggestion', modelSuggestionSchema);

module.exports = ModelSuggestion;