const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const database = require('../database/connection');
const auth = require('../middleware/auth');
const config = require('../../config/config');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const baseUploads = path.resolve(config.storage.uploads);
    const uploadPath = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') 
      ? path.join(baseUploads, 'media')
      : path.join(baseUploads, 'files');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.storage.allowedTypes;
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.mimetype.startsWith(type.slice(0, -1));
      }
      return file.mimetype === type;
    });
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// Get chat messages
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

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

    // Get chat file path
    const chatFile = path.join(path.resolve(config.storage.chats), `chat_${chatId}.json`);
    
    let messages = [];
    try {
      const chatData = await fs.readFile(chatFile, 'utf8');
      messages = JSON.parse(chatData);
    } catch (error) {
      // Chat file doesn't exist yet, return empty array
      messages = [];
    }

    // Sort messages by timestamp (newest first)
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedMessages = messages.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        messages: paginatedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: messages.length,
          pages: Math.ceil(messages.length / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send text message
router.post('/:chatId/text', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
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

    const message = {
      id: uuidv4(),
      type: 'text',
      text: text.trim(),
      senderId: req.user.userId,
      senderUsername: req.user.username,
      timestamp: new Date().toISOString()
    };

    // Save message to chat file
    await saveMessageToChat(chatId, message);

    // Update chat timestamp
    await database.query(
      'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [chatId]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send text message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send file message
router.post('/:chatId/file', auth, upload.single('file'), async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
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

    // Determine file type and path
    const isMedia = req.file.mimetype.startsWith('image/') || req.file.mimetype.startsWith('video/');
    const filePath = isMedia ? `media/${req.file.filename}` : `files/${req.file.filename}`;

    // Save file info to database
    const fileResult = await database.query(
      'INSERT INTO files (filename, original_name, file_path, file_size, mime_type, uploaded_by, chat_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.file.filename, req.file.originalname, filePath, req.file.size, req.file.mimetype, req.user.userId, chatId]
    );

    const message = {
      id: uuidv4(),
      type: isMedia ? (req.file.mimetype.startsWith('image/') ? 'image' : 'video') : 'file',
      file: {
        id: fileResult.insertId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      },
      senderId: req.user.userId,
      senderUsername: req.user.username,
      timestamp: new Date().toISOString()
    };

    // Save message to chat file
    await saveMessageToChat(chatId, message);

    // Update chat timestamp
    await database.query(
      'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [chatId]
    );

    res.status(201).json({
      success: true,
      message: 'File message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Send file message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Pin/unpin message
router.patch('/:chatId/:messageId/pin', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
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

    if (isPinned) {
      // Check if message is already pinned
      const existingPins = await database.query(
        'SELECT id FROM pinned_messages WHERE chat_id = ? AND message_id = ?',
        [chatId, messageId]
      );

      if (existingPins.length === 0) {
        // Pin message
        await database.query(
          'INSERT INTO pinned_messages (chat_id, message_id, pinned_by) VALUES (?, ?, ?)',
          [chatId, messageId, req.user.userId]
        );
      }
    } else {
      // Unpin message
      await database.query(
        'DELETE FROM pinned_messages WHERE chat_id = ? AND message_id = ?',
        [chatId, messageId]
      );
    }

    res.json({
      success: true,
      message: `Message ${isPinned ? 'pinned' : 'unpinned'} successfully`
    });

  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get pinned messages
router.get('/:chatId/pinned', auth, async (req, res) => {
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

    // Get pinned messages
    const pinnedMessages = await database.query(`
      SELECT 
        pm.message_id,
        pm.pinned_at,
        u.username as pinned_by_username
      FROM pinned_messages pm
      JOIN users u ON pm.pinned_by = u.id
      WHERE pm.chat_id = ?
      ORDER BY pm.pinned_at DESC
    `, [chatId]);

    // Get actual message content from chat file
    const chatFile = path.join(path.resolve(config.storage.chats), `chat_${chatId}.json`);
    let messages = [];
    
    try {
      const chatData = await fs.readFile(chatFile, 'utf8');
      messages = JSON.parse(chatData);
    } catch (error) {
      messages = [];
    }

    // Match pinned messages with content
    const pinnedMessagesWithContent = pinnedMessages.map(pin => {
      const message = messages.find(m => m.id === pin.message_id);
      return {
        ...pin,
        message: message || null
      };
    }).filter(pin => pin.message !== null);

    res.json({
      success: true,
      data: pinnedMessagesWithContent
    });

  } catch (error) {
    console.error('Get pinned messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Helper function to save message to chat file
async function saveMessageToChat(chatId, message) {
  const chatFile = path.join(config.storage.chats, `chat_${chatId}.json`);
  
  let messages = [];
  try {
    const chatData = await fs.readFile(chatFile, 'utf8');
    messages = JSON.parse(chatData);
  } catch (error) {
    // Chat file doesn't exist yet, start with empty array
    messages = [];
  }

  messages.push(message);

  // Keep only last 1000 messages to prevent file from growing too large
  if (messages.length > 1000) {
    messages = messages.slice(-1000);
  }

  await fs.writeFile(chatFile, JSON.stringify(messages, null, 2));
}

module.exports = router;