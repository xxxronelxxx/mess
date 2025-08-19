const express = require('express');
const database = require('../database/connection');
const auth = require('../middleware/auth');
const router = express.Router();

// Get user's chats
router.get('/', auth, async (req, res) => {
  try {
    const chats = await database.query(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at,
        c.updated_at,
        cp.is_pinned,
        cp.joined_at,
        (
          SELECT COUNT(*) 
          FROM chat_participants cp2 
          WHERE cp2.chat_id = c.id
        ) as participants_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ?
      ORDER BY cp.is_pinned DESC, c.updated_at DESC
    `, [req.user.userId]);

    res.json({
      success: true,
      data: chats
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new private chat
router.post('/private', auth, async (req, res) => {
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
        message: 'Cannot create chat with yourself'
      });
    }

    // Check if contact exists
    const contacts = await database.query(
      'SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ? AND is_blocked = FALSE',
      [req.user.userId, contactUserId]
    );

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact not found or blocked'
      });
    }

    // Check if private chat already exists
    const existingChats = await database.query(`
      SELECT c.id
      FROM chats c
      JOIN chat_participants cp1 ON c.id = cp1.chat_id
      JOIN chat_participants cp2 ON c.id = cp2.chat_id
      WHERE c.type = 'private' 
        AND cp1.user_id = ? 
        AND cp2.user_id = ?
    `, [req.user.userId, contactUserId]);

    if (existingChats.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Private chat already exists'
      });
    }

    // Create new private chat
    const chatResult = await database.query(
      'INSERT INTO chats (type) VALUES (?)',
      ['private']
    );

    const chatId = chatResult.insertId;

    // Add participants
    await database.query(
      'INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)',
      [chatId, req.user.userId, chatId, contactUserId]
    );

    // Get chat details
    const chatDetails = await database.query(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at,
        c.updated_at,
        cp.is_pinned,
        cp.joined_at
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE c.id = ? AND cp.user_id = ?
    `, [chatId, req.user.userId]);

    res.status(201).json({
      success: true,
      message: 'Private chat created successfully',
      data: chatDetails[0]
    });

  } catch (error) {
    console.error('Create private chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new group chat
router.post('/group', auth, async (req, res) => {
  try {
    const { name, participantIds } = req.body;

    if (!name || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({
        success: false,
        message: 'Chat name and participant IDs array are required'
      });
    }

    if (participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one participant is required'
      });
    }

    // Check if all participants are contacts
    const contactChecks = await Promise.all(
      participantIds.map(id => 
        database.query(
          'SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ? AND is_blocked = FALSE',
          [req.user.userId, id]
        )
      )
    );

    const invalidParticipants = contactChecks.some(check => check.length === 0);
    if (invalidParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Some participants are not in your contacts or are blocked'
      });
    }

    // Create group chat
    const chatResult = await database.query(
      'INSERT INTO chats (name, type, created_by) VALUES (?, ?, ?)',
      [name, 'group', req.user.userId]
    );

    const chatId = chatResult.insertId;

    // Add participants (including creator)
    const allParticipantIds = [req.user.userId, ...participantIds];
    const participantValues = allParticipantIds.map(id => [chatId, id]);
    
    await database.query(
      'INSERT INTO chat_participants (chat_id, user_id, role) VALUES ?',
      [participantValues.map(([chatId, userId]) => [chatId, userId, userId === req.user.userId ? 'owner' : 'member'])]
    );

    // Get chat details
    const chatDetails = await database.query(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.created_at,
        c.updated_at,
        cp.is_pinned,
        cp.joined_at
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE c.id = ? AND cp.user_id = ?
    `, [chatId, req.user.userId]);

    res.status(201).json({
      success: true,
      message: 'Group chat created successfully',
      data: chatDetails[0]
    });

  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Pin/unpin chat
router.patch('/:chatId/pin', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPinned must be a boolean value'
      });
    }

    // Check if user is participant in chat
    const participants = await database.query(
      'SELECT id FROM chat_participants WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.userId]
    );

    if (participants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Update pin status
    await database.query(
      'UPDATE chat_participants SET is_pinned = ? WHERE chat_id = ? AND user_id = ?',
      [isPinned, chatId, req.user.userId]
    );

    res.json({
      success: true,
      message: `Chat ${isPinned ? 'pinned' : 'unpinned'} successfully`
    });

  } catch (error) {
    console.error('Pin chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get chat participants
router.get('/:chatId/participants', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if user is participant in chat
    const participants = await database.query(
      'SELECT id FROM chat_participants WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.userId]
    );

    if (participants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Get all participants
    const chatParticipants = await database.query(`
      SELECT 
        cp.user_id,
        cp.role,
        cp.joined_at,
        u.username,
        u.avatar_path
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.chat_id = ?
      ORDER BY cp.role DESC, cp.joined_at ASC
    `, [chatId]);

    res.json({
      success: true,
      data: chatParticipants
    });

  } catch (error) {
    console.error('Get chat participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Leave chat
router.delete('/:chatId/leave', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if user is participant in chat
    const participants = await database.query(
      'SELECT id, role FROM chat_participants WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.userId]
    );

    if (participants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const participant = participants[0];

    // Check if user is owner of group chat
    if (participant.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Group owner cannot leave the chat. Transfer ownership first.'
      });
    }

    // Leave chat
    await database.query(
      'DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?',
      [chatId, req.user.userId]
    );

    res.json({
      success: true,
      message: 'Left chat successfully'
    });

  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;