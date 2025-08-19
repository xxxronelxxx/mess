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
    cb(null, path.join(config.storage.uploads, 'avatars'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const users = await database.query(
      'SELECT id, username, avatar_path, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user avatar
router.put('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Avatar file is required'
      });
    }

    // Get current avatar path
    const users = await database.query(
      'SELECT avatar_path FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentAvatarPath = users[0].avatar_path;

    // Delete old avatar if exists
    if (currentAvatarPath) {
      try {
        await fs.unlink(path.join(config.storage.uploads, 'avatars', path.basename(currentAvatarPath)));
      } catch (error) {
        console.log('Old avatar file not found, skipping deletion');
      }
    }

    // Update avatar path in database
    const avatarPath = `avatars/${req.file.filename}`;
    await database.query(
      'UPDATE users SET avatar_path = ? WHERE id = ?',
      [avatarPath, req.user.userId]
    );

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        avatar_path: avatarPath
      }
    });

  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete user avatar
router.delete('/avatar', auth, async (req, res) => {
  try {
    // Get current avatar path
    const users = await database.query(
      'SELECT avatar_path FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentAvatarPath = users[0].avatar_path;

    if (!currentAvatarPath) {
      return res.status(400).json({
        success: false,
        message: 'No avatar to delete'
      });
    }

    // Delete avatar file
    try {
      await fs.unlink(path.join(config.storage.uploads, 'avatars', path.basename(currentAvatarPath)));
    } catch (error) {
      console.log('Avatar file not found, skipping deletion');
    }

    // Update database
    await database.query(
      'UPDATE users SET avatar_path = NULL WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users (for contacts)
router.get('/all', auth, async (req, res) => {
  try {
    const users = await database.query(
      'SELECT id, username, avatar_path FROM users WHERE id != ?',
      [req.user.userId]
    );

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Export user data
router.get('/export', auth, async (req, res) => {
  try {
    // Get user data
    const users = await database.query(
      'SELECT id, username, avatar_path, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Get user's chats
    const chats = await database.query(`
      SELECT c.id, c.name, c.type, c.created_at
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = ?
      ORDER BY c.updated_at DESC
    `, [req.user.userId]);

    // Get user's contacts
    const contacts = await database.query(`
      SELECT u.id, u.username, u.avatar_path, c.is_blocked
      FROM contacts c
      JOIN users u ON c.contact_user_id = u.id
      WHERE c.user_id = ?
    `, [req.user.userId]);

    const exportData = {
      user,
      chats,
      contacts,
      exportDate: new Date().toISOString()
    };

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;