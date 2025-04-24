// backend/models/modelSuggestionModel.js
const { DataTypes } = require('sequelize');

/**
 * Model Suggestion model for PostgreSQL using Sequelize
 * Used to store feedback data for improving model suggestions
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Sequelize model
 */
module.exports = (sequelize) => {
  const ModelSuggestion = sequelize.define('ModelSuggestion', {
    // Auto-incrementing ID as primary key
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // When the suggestion was made
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    
    // Model that was suggested by the system
    suggestedModelId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Model that was actually selected by the user
    selectedModelId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Whether the suggestion was accepted
    wasSuggestionAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    
    // Type of log (error, info, debug, etc.)
    logType: {
      type: DataTypes.STRING,
      defaultValue: 'unknown'
    },
    
    // Length range of the content (xs, s, m, l, xl)
    contentLengthRange: {
      type: DataTypes.ENUM('xs', 's', 'm', 'l', 'xl'),
      defaultValue: 'm'
    },
    
    // Whether content had stack traces
    includeStackTraces: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // User ID for personalized suggestions
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'model_suggestions',
    timestamps: true, // Adds createdAt and updatedAt fields
    indexes: [
      // Create indexes for common queries
      { fields: ['timestamp'] },
      { fields: ['logType'] },
      { fields: ['contentLengthRange'] },
      { fields: ['suggestedModelId', 'wasSuggestionAccepted'] },
      { fields: ['userId'] }
    ]
  });
  
  // Define associations
  ModelSuggestion.associate = function(models) {
    // Each suggestion can belong to a user
    ModelSuggestion.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };
  
  return ModelSuggestion;
};