// backend/database/index.js
const { Sequelize } = require('sequelize');
const config = require('../config/database');

// Create Sequelize instance
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: 'postgres',
    logging: config.logging ? console.log : false,
    dialectOptions: config.dialectOptions,
    pool: config.pool,
    timezone: '+00:00'
  }
);

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  Sequelize
};