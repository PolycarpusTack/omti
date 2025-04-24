const express = require('express');
const router = express.Router();
const PromptTemplate = require('../models/promptTemplates');
const authMiddleware = require('../middleware/auth');

/**
 * @route   GET /api/templates
 * @desc    Get all templates for the user (own + public)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's templates and public templates
    const templates = await PromptTemplate.findTemplatesForUser(userId);
    
    // Add isOwner flag to each template
    const templatesWithOwnership = templates.map(template => {
      const templateObj = template.toObject();
      templateObj.isOwner = template.userId === userId;
      return templateObj;
    });
    
    res.json(templatesWithOwnership);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * @route   GET /api/templates/search
 * @desc    Search templates by keyword
 * @access  Private
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { keyword } = req.query;
    const userId = req.user.id;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Search keyword is required' });
    }
    
    // Search for templates matching the keyword
    const templates = await PromptTemplate.findByKeyword(keyword, userId);
    
    // Add isOwner flag to each template
    const templatesWithOwnership = templates.map(template => {
      const templateObj = template.toObject();
      templateObj.isOwner = template.userId === userId;
      return templateObj;
    });
    
    res.json(templatesWithOwnership);
  } catch (error) {
    console.error('Error searching templates:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

/**
 * @route   GET /api/templates/:id
 * @desc    Get a template by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const template = await PromptTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if the template is accessible to the user
    if (!template.isPublic && template.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const templateObj = template.toObject();
    templateObj.isOwner = template.userId === userId;
    
    res.json(templateObj);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * @route   POST /api/templates
 * @desc    Create a new template
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, template, description, category, variables, tags, isPublic } = req.body;
    const userId = req.user.id;
    
    if (!name || !template) {
      return res.status(400).json({ error: 'Name and template content are required' });
    }
    
    const newTemplate = new PromptTemplate({
      name,
      template,
      description: description || '',
      category: category || 'general',
      variables: variables || [],
      tags: tags || [],
      isPublic: isPublic || false,
      userId,
      favoriteCount: 0,
      usageCount: 0
    });
    
    await newTemplate.save();
    
    const templateObj = newTemplate.toObject();
    templateObj.isOwner = true;
    
    res.status(201).json(templateObj);
  } catch (error) {
    console.error('Error creating template:', error);
    if (error.code === 11000) {
      // Duplicate key error (likely the unique index on name+userId)
      return res.status(400).json({ error: 'You already have a template with this name' });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * @route   PUT /api/templates/:id
 * @desc    Update a template
 * @access  Private
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, template: templateContent, description, category, variables, tags, isPublic } = req.body;
    
    const template = await PromptTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if the user is the owner of the template
    if (template.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if name is being changed and if it would create a duplicate
    if (name && name !== template.name) {
      const existingTemplate = await PromptTemplate.findOne({ 
        name: name,
        userId: userId,
        _id: { $ne: id } // Exclude the current template
      });
      
      if (existingTemplate) {
        return res.status(400).json({ error: 'You already have a template with this name' });
      }
    }
    
    // Update the template
    template.name = name || template.name;
    template.template = templateContent || template.template;
    template.description = description !== undefined ? description : template.description;
    template.category = category || template.category;
    template.variables = variables || template.variables;
    template.tags = tags || template.tags;
    template.isPublic = isPublic !== undefined ? isPublic : template.isPublic;
    
    await template.save();
    
    const templateObj = template.toObject();
    templateObj.isOwner = true;
    
    res.json(templateObj);
  } catch (error) {
    console.error('Error updating template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'You already have a template with this name' });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * @route   DELETE /api/templates/:id
 * @desc    Delete a template
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const template = await PromptTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if the user is the owner of the template
    if (template.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await PromptTemplate.findByIdAndDelete(id);
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * @route   GET /api/templates/tags
 * @desc    Get all unique tags from user's accessible templates
 * @access  Private
 */
router.get('/tags', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Aggregate to get unique tags from all accessible templates
    const templates = await PromptTemplate.findTemplatesForUser(userId);
    
    // Extract all tags and deduplicate
    const allTags = templates.reduce((tags, template) => {
      return [...tags, ...template.tags];
    }, []);
    
    const uniqueTags = [...new Set(allTags)].sort();
    
    res.json(uniqueTags);
  } catch (error) {
    console.error('Error fetching template tags:', error);
    res.status(500).json({ error: 'Failed to fetch template tags' });
  }
});

/**
 * @route   GET /api/templates/categories
 * @desc    Get all template categories
 * @access  Private
 */
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    // Simply return the predefined categories from the schema
    const categories = [
      'general',
      'code_analysis',
      'error_log',
      'security',
      'performance',
      'custom'
    ];
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ error: 'Failed to fetch template categories' });
  }
});

/**
 * @route   POST /api/templates/:id/clone
 * @desc    Clone a template
 * @access  Private
 */
router.post('/:id/clone', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const template = await PromptTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if the template is accessible to the user
    if (!template.isPublic && template.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Create a new template as a clone
    const clonedTemplate = new PromptTemplate({
      name: `${template.name} (Copy)`,
      template: template.template,
      description: template.description,
      category: template.category,
      variables: template.variables,
      tags: template.tags,
      isPublic: false, // Default to private when cloning
      userId,
      favoriteCount: 0,
      usageCount: 0
    });
    
    await clonedTemplate.save();
    
    const templateObj = clonedTemplate.toObject();
    templateObj.isOwner = true;
    
    res.status(201).json(templateObj);
  } catch (error) {
    console.error('Error cloning template:', error);
    if (error.code === 11000) {
      // Handle duplicate name
      return res.status(400).json({ error: 'You already have a template with this name' });
    }
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

/**
 * @route   POST /api/templates/:id/usage
 * @desc    Increment usage count for a template
 * @access  Private
 */
router.post('/:id/usage', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const template = await PromptTemplate.findById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if the template is accessible to the user
    if (!template.isPublic && template.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Increment the usage count
    await template.incrementUsage();
    
    res.json({ success: true, usageCount: template.usageCount });
  } catch (error) {
    console.error('Error incrementing template usage:', error);
    res.status(500).json({ error: 'Failed to update template usage' });
  }
});

module.exports = router;