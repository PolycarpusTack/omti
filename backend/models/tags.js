// backend/models/tags.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema for a single tag
 */
const TagSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  color: {
    type: String,
    required: true,
    default: '#3b82f6', // Default blue color
    validate: {
      validator: function(v) {
        // Validate hex color code
        return /^#([0-9A-F]{3}){1,2}$/i.test(v);
      },
      message: props => `${props.value} is not a valid color hex code!`
    }
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional, if you want to support user-specific tags
  },
  global: {
    type: Boolean,
    default: false // Whether the tag is available to all users
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Schema for relating tags to analyses
 */
const AnalysisTagSchema = new Schema({
  analysisId: {
    type: String,
    required: true,
    index: true
  },
  tagId: {
    type: Schema.Types.ObjectId,
    ref: 'Tag',
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional, for user-specific tagging
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index to ensure uniqueness
AnalysisTagSchema.index({ analysisId: 1, tagId: 1 }, { unique: true });

/**
 * Pre-save hook to update the updatedAt field
 */
TagSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create models
const Tag = mongoose.model('Tag', TagSchema);
const AnalysisTag = mongoose.model('AnalysisTag', AnalysisTagSchema);

module.exports = {
  Tag,
  AnalysisTag
};