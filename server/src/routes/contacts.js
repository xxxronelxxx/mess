const express = require('express');
const database = require('../database/connection');
const auth = require('../middleware/auth');
const router = express.Router();

// Get user's contacts
router.get('/', auth, async (req, res) => {
  try {
    const contacts = await database.query(`
      SELECT 
        c.id,
        c.is_blocked,
        c.created_at,
        u.id as user_id,
        u.username,
        u.avatar_path
      FROM contacts c
      JOIN users u ON c.contact_user_id = u.id
      WHERE c.user_id = ?
      ORDER BY u.username ASC
    `, [req.user.userId]);

    res.json({
      success: true,
      data: contacts
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Add new contact
router.post('/', auth, async (req, res) => {
  try {
    const { contactUserId } = req.body;

    if (!contactUserId) {
      return res.status(400).json({
        success: false,
        message: 'Contact user ID is required'
      });
    }

    if (contactUserId == req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add yourself as a contact'
      });
    }

    // Check if contact exists
    const existingContact = await database.query(
      'SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ?',
      [req.user.userId, contactUserId]
    );

    if (existingContact.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact already exists'
      });
    }

    // Check if user exists
    const users = await database.query(
      'SELECT id FROM users WHERE id = ?',
      [contactUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add contact
    const result = await database.query(
      'INSERT INTO contacts (user_id, contact_user_id) VALUES (?, ?)',
      [req.user.userId, contactUserId]
    );

    // Get contact details
    const contactDetails = await database.query(`
      SELECT 
        c.id,
        c.is_blocked,
        c.created_at,
        u.id as user_id,
        u.username,
        u.avatar_path
      FROM contacts c
      JOIN users u ON c.contact_user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data: contactDetails[0]
    });

  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Remove contact
router.delete('/:contactId', auth, async (req, res) => {
  try {
    const { contactId } = req.params;

    // Check if contact exists and belongs to user
    const contacts = await database.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
      [contactId, req.user.userId]
    );

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Delete contact
    await database.query(
      'DELETE FROM contacts WHERE id = ?',
      [contactId]
    );

    res.json({
      success: true,
      message: 'Contact removed successfully'
    });

  } catch (error) {
    console.error('Remove contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Block/unblock contact
router.patch('/:contactId/block', auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isBlocked must be a boolean value'
      });
    }

    // Check if contact exists and belongs to user
    const contacts = await database.query(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?',
      [contactId, req.user.userId]
    );

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Update block status
    await database.query(
      'UPDATE contacts SET is_blocked = ? WHERE id = ?',
      [isBlocked, contactId]
    );

    res.json({
      success: true,
      message: `Contact ${isBlocked ? 'blocked' : 'unblocked'} successfully`
    });

  } catch (error) {
    console.error('Block contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search contacts
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchQuery = `%${query.trim()}%`;
    
    const contacts = await database.query(`
      SELECT 
        c.id,
        c.is_blocked,
        c.created_at,
        u.id as user_id,
        u.username,
        u.avatar_path
      FROM contacts c
      JOIN users u ON c.contact_user_id = u.id
      WHERE c.user_id = ? AND u.username LIKE ?
      ORDER BY u.username ASC
    `, [req.user.userId, searchQuery]);

    res.json({
      success: true,
      data: contacts
    });

  } catch (error) {
    console.error('Search contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;