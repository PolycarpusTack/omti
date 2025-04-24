// backend/database/migrations/20250415-initial-schema.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      preferences: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create analyses table
    await queryInterface.createTable('analyses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      fileType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      modelId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      modelProvider: {
        type: Sequelize.STRING,
        allowNull: false
      },
      analysisType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'original'
      },
      language: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'en'
      },
      processingTime: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      chunks: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      severity: {
        type: Sequelize.ENUM('critical', 'high', 'medium', 'low', 'unknown'),
        defaultValue: 'unknown'
      },
      rootCauses: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      shareUrl: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create analysis_results table
    await queryInterface.createTable('analysis_results', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      analysisId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'analyses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      chunk: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      totalChunks: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      technicalAnalysis: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      simplifiedAnalysis: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      suggestedSolutions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      processingTime: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create tags table
    await queryInterface.createTable('tags', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '#3b82f6'
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      isGlobal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create analysis_tags junction table
    await queryInterface.createTable('analysis_tags', {
      analysisId: {
        type: Sequelize.UUID,
        references: {
          model: 'analyses',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true
      },
      tagId: {
        type: Sequelize.UUID,
        references: {
          model: 'tags',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes
    await queryInterface.addIndex('analyses', ['userId']);
    await queryInterface.addIndex('analyses', ['createdAt']);
    await queryInterface.addIndex('analyses', ['status']);
    await queryInterface.addIndex('analyses', ['severity']);
    await queryInterface.addIndex('analysis_results', ['analysisId']);
    await queryInterface.addIndex('tags', ['userId']);
    await queryInterface.addIndex('tags', ['isGlobal']);

    // Create enum types for new tables
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_analysis_history_analysis_type" AS ENUM (
        'original', 'follow-up', 'comparison', 'custom', 'summary'
      );
      
      CREATE TYPE "enum_analysis_history_content_length_range" AS ENUM (
        'xs', 's', 'm', 'l', 'xl'
      );
      
      CREATE TYPE "enum_model_suggestions_content_length_range" AS ENUM (
        'xs', 's', 'm', 'l', 'xl'
      );
    `);
    
    // Create analysis_history table
    await queryInterface.createTable('analysis_history', {
      timestamp: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      filename: {
        type: Sequelize.STRING,
        allowNull: false
      },
      analysisType: {
        type: Sequelize.ENUM,
        values: ['original', 'follow-up', 'comparison', 'custom', 'summary'],
        defaultValue: 'original'
      },
      tags: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      modelId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      successRating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      logType: {
        type: Sequelize.STRING,
        defaultValue: 'unknown'
      },
      contentLength: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      contentLengthRange: {
        type: Sequelize.ENUM,
        values: ['xs', 's', 'm', 'l', 'xl'],
        defaultValue: 'm'
      },
      includeStackTraces: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      notes: {
        type: Sequelize.TEXT,
        defaultValue: ''
      },
      relatedAnalyses: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    
    // Create analysis_content table
    await queryInterface.createTable('analysis_content', {
      timestamp: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      compressedContent: {
        type: Sequelize.BLOB,
        allowNull: true
      },
      isCompressed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      contentSize: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    
    // Create model_suggestions table
    await queryInterface.createTable('model_suggestions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      suggestedModelId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      selectedModelId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      wasSuggestionAccepted: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      logType: {
        type: Sequelize.STRING,
        defaultValue: 'unknown'
      },
      contentLengthRange: {
        type: Sequelize.ENUM,
        values: ['xs', 's', 'm', 'l', 'xl'],
        defaultValue: 'm'
      },
      includeStackTraces: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    
    // Add indexes for new tables
    await queryInterface.addIndex('analysis_history', ['userId']);
    await queryInterface.addIndex('analysis_history', ['modelId']);
    await queryInterface.addIndex('analysis_history', ['analysisType']);
    await queryInterface.addIndex('analysis_history', ['logType']);
    await queryInterface.addIndex('analysis_history', ['contentLengthRange']);
    
    await queryInterface.addIndex('model_suggestions', ['timestamp']);
    await queryInterface.addIndex('model_suggestions', ['logType']);
    await queryInterface.addIndex('model_suggestions', ['contentLengthRange']);
    await queryInterface.addIndex('model_suggestions', ['suggestedModelId', 'wasSuggestionAccepted']);
    await queryInterface.addIndex('model_suggestions', ['userId']);
    
    // Add full-text search capabilities
    await queryInterface.sequelize.query(`
      -- Create GIN index for full-text search on filename, tags and notes
      CREATE INDEX analysis_history_search_idx ON analysis_history
      USING GIN ((to_tsvector('english', filename) || 
                  to_tsvector('english', notes) ||
                  to_tsvector('english', (
                    SELECT string_agg(t, ' ')
                    FROM jsonb_array_elements_text(tags) AS t
                  ))
                 ));
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop new tables
    await queryInterface.dropTable('model_suggestions');
    await queryInterface.dropTable('analysis_content');
    await queryInterface.dropTable('analysis_history');
    
    // Drop enum types
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_analysis_history_analysis_type";
      DROP TYPE IF EXISTS "enum_analysis_history_content_length_range";
      DROP TYPE IF EXISTS "enum_model_suggestions_content_length_range";
    `);

    // Drop original tables
    await queryInterface.dropTable('analysis_tags');
    await queryInterface.dropTable('tags');
    await queryInterface.dropTable('analysis_results');
    await queryInterface.dropTable('analyses');
    await queryInterface.dropTable('users');
  }
};