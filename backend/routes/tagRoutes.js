// backend/routes/tagRoutes.js
const express = require('express');
const router = express.Router();
const { Tag, AnalysisTag } = require('../models/tags');
const auth = require('../middleware/auth'); // Import auth middleware if you have it
const mongoose = require('mongoose');

/**
 * @route   GET /api/tags
 * @desc    Get all tags (global + user's personal tags)
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    // Get both global tags and user-specific tags
    const tags = await Tag.find({
      $or: [
        { global: true },
        { user: req.user.id }
      ]
    }).sort({ name: 1 });
    
    res.json(tags);
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ error: 'Server error fetching tags' });
  }
});

/**
 * @route   POST /api/tags
 * @desc    Create a new tag
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, color, global } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    
    // Check if a tag with this name already exists for this user
    const existingTag = await Tag.findOne({
      name: name,
      $or: [
        { global: true },
        { user: req.user.id }
      ]
    });
    
    if (existingTag) {
      return res.status(400).json({ error: 'A tag with this name already exists' });
    }
    
    // Create the new tag
    const newTag = new Tag({
      name,
      color: color || '#3b82f6', // Default blue if no color provided
      user: req.user.id,
      global: global === true && req.user.isAdmin // Only admins can create global tags
    });
    
    const tag = await newTag.save();
    res.status(201).json(tag);
  } catch (err) {
    console.error('Error creating tag:', err);
    res.status(500).json({ error: 'Server error creating tag' });
  }
});

/**
 * @route   PUT /api/tags/:id
 * @desc    Update a tag
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, color } = req.body;
    const tagId = req.params.id;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: 'Invalid tag ID' });
    }
    
    // Find the tag to update
    const tag = await Tag.findById(tagId);
    
    // Check if tag exists
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    // Check if user has permission to update this tag
    if (tag.global && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to update global tags' });
    }
    
    if (!tag.global && tag.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this tag' });
    }
    
    // Update tag fields
    if (name) tag.name = name;
    if (color) tag.color = color;
    
    const updatedTag = await tag.save();
    res.json(updatedTag);
  } catch (err) {
    console.error('Error updating tag:', err);
    res.status(500).json({ error: 'Server error updating tag' });
  }
});

/**
 * @route   DELETE /api/tags/:id
 * @desc    Delete a tag
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const tagId = req.params.id;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: 'Invalid tag ID' });
    }
    
    // Find the tag to delete
    const tag = await Tag.findById(tagId);
    
    // Check if tag exists
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    // Check if user has permission to delete this tag
    if (tag.global && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete global tags' });
    }
    
    if (!tag.global && tag.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this tag' });
    }
    
    // Delete tag and all references to it
    await Promise.all([
      Tag.findByIdAndDelete(tagId),
      AnalysisTag.deleteMany({ tagId })
    ]);
    
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (err) {
    console.error('Error deleting tag:', err);
    res.status(500).json({ error: 'Server error deleting tag' });
  }
});

/**
 * @route   GET /api/tags/analysis/:analysisId
 * @desc    Get all tags for a specific analysis
 * @access  Private
 */
router.get('/analysis/:analysisId', auth, async (req, res) => {
  try {
    const { analysisId } = req.params;
    
    // Find all tag references for this analysis
    const analysisTags = await AnalysisTag.find({ 
      analysisId,
      user: req.user.id
    }).populate('tagId');
    
    // Extract the actual tag objects
    const tags = analysisTags.map(at => at.tagId);
    
    res.json(tags);
  } catch (err) {
    console.error('Error fetching analysis tags:', err);
    res.status(500).json({ error: 'Server error fetching analysis tags' });
  }
});

/**
 * @route   POST /api/tags/analysis/:analysisId
 * @desc    Add a tag to an analysis
 * @access  Private
 */
router.post('/analysis/:analysisId', auth, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { tagId } = req.body;
    
    // Validate tag ID
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: 'Invalid tag ID' });
    }
    
    // Verify the tag exists
    const tag = await Tag.findById(tagId);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    // Check if tag is already applied to this analysis
    const existingTag = await AnalysisTag.findOne({ analysisId, tagId, user: req.user.id });
    if (existingTag) {
      return res.status(400).json({ error: 'Tag already applied to this analysis' });
    }
    
    // Create new analysis tag relationship
    const newAnalysisTag = new AnalysisTag({
      analysisId,
      tagId,
      user: req.user.id
    });
    
    await newAnalysisTag.save();
    res.status(201).json({ success: true, message: 'Tag added to analysis' });
  } catch (err) {
    console.error('Error adding tag to analysis:', err);
    res.status(500).json({ error: 'Server error adding tag to analysis' });
  }
});

/**
 * @route   DELETE /api/tags/analysis/:analysisId/:tagId
 * @desc    Remove a tag from an analysis
 * @access  Private
 */
router.delete('/analysis/:analysisId/:tagId', auth, async (req, res) => {
  try {
    const { analysisId, tagId } = req.params;
    
    // Validate tag ID
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: 'Invalid tag ID' });
    }
    
    // Find and delete the analysis tag relationship
    const analysisTag = await AnalysisTag.findOneAndDelete({
      analysisId,
      tagId,
      user: req.user.id
    });
    
    if (!analysisTag) {
      return res.status(404).json({ error: 'Tag not found on this analysis' });
    }
    
    res.json({ success: true, message: 'Tag removed from analysis' });
  } catch (err) {
    console.error('Error removing tag from analysis:', err);
    res.status(500).json({ error: 'Server error removing tag from analysis' });
  }
});

/**
 * @route   GET /api/tags/search
 * @desc    Search for analyses by tags
 * @access  Private
 */
router.get('/search', auth, async (req, res) => {
  try {
    const { tags } = req.query;
    
    if (!tags) {
      return res.status(400).json({ error: 'No tags specified for search' });
    }
    
    // Parse tag IDs from query parameter
    const tagIds = tags.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (tagIds.length === 0) {
      return res.status(400).json({ error: 'No valid tag IDs provided' });
    }
    
    // Find all analyses that have all the specified tags
    const analysisIds = await AnalysisTag.aggregate([
      { 
        $match: { 
          tagId: { $in: tagIds.map(id => mongoose.Types.ObjectId(id)) },
          user: req.user.id
        } 
      },
      {
        $group: {
          _id: '$analysisId',
          tagCount: { $sum: 1 },
          tagIds: { $push: '$tagId' }
        }
      },
      {
        $match: {
          tagCount: { $gte: tagIds.length }
        }
      }
    ]);
    
    res.json(analysisIds.map(item => item._id));
  } catch (err) {
    console.error('Error searching analyses by tags:', err);
    res.status(500).json({ error: 'Server error searching by tags' });
  }
});

module.exports = router;