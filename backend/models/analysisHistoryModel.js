// backend/models/analysisHistoryModel.js
const { DataTypes } = require('sequelize');

/**
 * Analysis History model for PostgreSQL using Sequelize
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Sequelize model
 */
module.exports = (sequelize) => {
  const AnalysisHistory = sequelize.define('AnalysisHistory', {
    // Primary key - the ISO timestamp when analysis was created
    timestamp: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    
    // User who created the analysis
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Basic metadata
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Type of analysis (original, follow-up, comparison, etc.)
    analysisType: {
      type: DataTypes.ENUM('original', 'follow-up', 'comparison', 'custom', 'summary'),
      defaultValue: 'original'
    },
    
    // User-defined tags for organization (stored as JSON array)
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Model used for the analysis
    modelId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    // User rating of analysis success (1-5)
    successRating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5
      },
      allowNull: true
    },
    
    // Type of content analyzed
    logType: {
      type: DataTypes.STRING,
      defaultValue: 'unknown'
    },
    
    // Length of the content analyzed
    contentLength: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // Length range category (for more efficient querying)
    contentLengthRange: {
      type: DataTypes.ENUM('xs', 's', 'm', 'l', 'xl'),
      defaultValue: 'm'
    },
    
    // Whether the analysis included stack traces
    includeStackTraces: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // User notes about the analysis
    notes: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    
    // References to related analyses (stored as JSON array)
    relatedAnalyses: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    
    // Optional metadata for advanced filtering
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'analysis_history',
    timestamps: true, // Adds createdAt and updatedAt fields
    indexes: [
      // Create indexes for common queries
      { fields: ['userId'] },
      { fields: ['modelId'] },
      { fields: ['analysisType'] },
      { fields: ['logType'] },
      { fields: ['contentLengthRange'] },
    ],
    hooks: {
      // Set appropriate content length range before creating or updating
      beforeSave: (instance) => {
        if (instance.contentLength) {
          if (instance.contentLength < 500) instance.contentLengthRange = 'xs';
          else if (instance.contentLength < 2000) instance.contentLengthRange = 's';
          else if (instance.contentLength < 5000) instance.contentLengthRange = 'm';
          else if (instance.contentLength < 10000) instance.contentLengthRange = 'l';
          else instance.contentLengthRange = 'xl';
        }
      }
    }
  });
  
  // Instance method to get formatted date
  AnalysisHistory.prototype.getFormattedDate = function() {
    return new Date(this.timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Define associations
  AnalysisHistory.associate = function(models) {
    // Each history item belongs to a user
    AnalysisHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    // Each history item has one content record
    AnalysisHistory.hasOne(models.AnalysisContent, {
      foreignKey: 'timestamp',
      sourceKey: 'timestamp',
      as: 'content'
    });
  };
  
  return AnalysisHistory;
};