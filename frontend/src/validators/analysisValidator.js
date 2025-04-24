// src/validators/analysisValidator.js
import Joi from 'joi';

export const analysisRequestSchema = Joi.object({
  content: Joi.string()
    .required()
    .min(1)
    .max(5000)
    .messages({
      'string.empty': 'Content cannot be empty',
      'string.max': 'Content exceeds maximum length of 5000 characters'
    }),
  modelId: Joi.string()
    .required()
    .uuid({ version: 'uuidv4' })
    .message('Invalid model ID format'),
  modelSettings: Joi.object()
    .pattern(
      Joi.string().min(1),
      Joi.any()
    )
    .optional()
});

/**
 * Validates an analysis request against the schema
 * 
 * @param {Object} request - The request object to validate
 * @returns {Joi.ValidationError|null} - Returns validation error or null if valid
 */
export function validateAnalysisRequest(request) {
  const { error } = analysisRequestSchema.validate(request, {
    abortEarly: false,
    allowUnknown: false,
  });
  
  return error;
}