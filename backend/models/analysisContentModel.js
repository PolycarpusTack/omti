// backend/models/analysisContentModel.js
const { DataTypes } = require('sequelize');

/**
 * Analysis Content model for PostgreSQL using Sequelize
 * Stores the actual analysis content separately from metadata for better performance
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Sequelize model
 */
module.exports = (sequelize) => {
  const AnalysisContent = sequelize.define('AnalysisContent', {
    // Primary key - matches the timestamp in AnalysisHistory
    timestamp: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    
    // The actual analysis content as JSONB
    // This allows for efficient storage of complex nested JSON structures
    content: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    
    // Optional compressed version for large analyses
    compressedContent: {
      type: DataTypes.BLOB,
      allowNull: true
    },
    
    // Whether the content is compressed
    isCompressed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Content size in bytes
    contentSize: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'analysis_content',
    timestamps: true, // Adds createdAt and updatedAt fields
    indexes: [
      // Create index for timestamp lookups
      { fields: ['timestamp'] }
    ],
    hooks: {
      // Calculate content size before saving
      beforeSave: (instance) => {
        if (!instance.isCompressed) {
          const contentString = JSON.stringify(instance.content);
          instance.contentSize = Buffer.byteLength(contentString);
          
          // If content is large, consider compression in future implementations
          if (instance.contentSize > 100000) { // 100KB
            // Placeholder for compression logic
            // Would need to implement actual compression using zlib or similar
          }
        }
      }
    }
  });
  
  // Instance method to get content, handling decompression if needed
  AnalysisContent.prototype.getContent = function() {
    if (this.isCompressed && this.compressedContent) {
      // Note: This would actually decompress the content in a real implementation
      // using zlib or similar library
      return this.content;
    } else {
      return this.content;
    }
  };
  
  // Define associations
  AnalysisContent.associate = function(models) {
    // Each content record belongs to one history item
    AnalysisContent.belongsTo(models.AnalysisHistory, {
      foreignKey: 'timestamp',
      targetKey: 'timestamp',
      as: 'historyItem'
    });
  };
  
  return AnalysisContent;
};