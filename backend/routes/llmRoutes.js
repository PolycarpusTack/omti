// backend/routes/llmRoutes.js

const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');

/**
 * @route   GET /api/models
 * @desc    Get list of available models
 * @access  Public
 */
router.get('/models', llmController.getModels);

/**
 * @route   GET /api/models/status
 * @desc    Get status of available models
 * @access  Public
 */
router.get('/models/status', llmController.getModelStatus);

/**
 * @route   POST /api/models/:modelId/benchmark
 * @desc    Run a benchmark on a specific model
 * @access  Public
 */
router.post('/models/:modelId/benchmark', llmController.benchmarkModel);

/**
 * @route   POST /api/process
 * @desc    Process a request through the selected LLM
 * @access  Public
 */
router.post('/process', llmController.processWithLLM);

module.exports = router;