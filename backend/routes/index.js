// backend/models/index.js
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/database.js'); // Adjust path as needed

const db = {};

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: 'postgres',
    logging: config.logging || false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: config.ssl || false
    },
    timezone: '+00:00'
  }
);

// Import models
const modelFiles = [
  require('./analysisHistoryModel')(sequelize),
  require('./analysisContentModel')(sequelize),
  require('./modelSuggestionModel')(sequelize)
];

// Add models to db object
modelFiles.forEach(model => {
  db[model.name] = model;
});

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Define associations
// AnalysisHistory and AnalysisContent have a one-to-one relationship
db.AnalysisHistory.hasOne(db.AnalysisContent, { foreignKey: 'timestamp', sourceKey: 'timestamp' });
db.AnalysisContent.belongsTo(db.AnalysisHistory, { foreignKey: 'timestamp', targetKey: 'timestamp' });

// Add Sequelize and instance to db
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;