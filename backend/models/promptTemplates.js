const mongoose = require('mongoose');

/**
 * Prompt Template Schema
 * Defines the data structure for storing custom prompt templates
 */
const promptTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot be more than 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Template description cannot be more than 500 characters']
  },
  
  template: {
    type: String,
    required: [true, 'Template content is required'],
    maxlength: [10000, 'Template content cannot be more than 10000 characters']
  },
  
  category: {
    type: String,
    enum: {
      values: ['general', 'code_analysis', 'error_log', 'security', 'performance', 'custom'],
      message: '{VALUE} is not a supported category'
    },
    default: 'general'
  },
  
  variables: [{
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9_]+$/.test(v);
      },
      message: props => `${props.value} is not a valid variable name. Use only letters, numbers, and underscores.`
    }
  }],
  
  tags: [{
    type: String,
    trim: true
  }],
  
  isPublic: {
    type: Boolean,
    default: false
  },
  
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  
  favoriteCount: {
    type: Number,
    default: 0
  },
  
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for search functionality
promptTemplateSchema.index({
  name: 'text',
  description: 'text',
  'tags': 'text'
});

// Ensure user can only have templates with unique names
promptTemplateSchema.index({ name: 1, userId: 1 }, { unique: true });

// Virtual property for user ownership
promptTemplateSchema.virtual('isOwner').get(function() {
  return false; // This will be set on the client side
});

/**
 * Method to find templates by user ID
 * Includes user's own templates and public templates from others
 */
promptTemplateSchema.statics.findTemplatesForUser = async function(userId) {
  return this.find({
    $or: [
      { userId },
      { isPublic: true }
    ]
  }).sort({ createdAt: -1 });
};

/**
 * Method to find templates by keyword search
 */
promptTemplateSchema.statics.findByKeyword = async function(keyword, userId) {
  return this.find({
    $and: [
      {
        $or: [
          { userId },
          { isPublic: true }
        ]
      },
      {
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { tags: { $regex: keyword, $options: 'i' } }
        ]
      }
    ]
  }).sort({ createdAt: -1 });
};

/**
 * Method to increment usage count
 */
promptTemplateSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  return this.save();
};

/**
 * Pre-save middleware to ensure variables are unique
 */
promptTemplateSchema.pre('save', function(next) {
  if (this.variables && this.variables.length > 0) {
    // Remove duplicates
    this.variables = [...new Set(this.variables)];
  }
  
  if (this.tags && this.tags.length > 0) {
    // Remove duplicates and trim
    this.tags = [...new Set(this.tags.map(tag => tag.trim()))];
  }
  
  next();
});

// Create the model
const PromptTemplate = mongoose.model('PromptTemplate', promptTemplateSchema);

module.exports = PromptTemplate;