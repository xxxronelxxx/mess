const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const database = require('../database/connection');
const auth = require('../middleware/auth');
const config = require('../../config/config');
const router = express.Router();

// Download file
router.get('/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const files = await database.query(`
      SELECT f.*, u.username as uploaded_by_username
      FROM files f
      JOIN users u ON f.uploaded_by = u.id
      WHERE f.id = ?
    `, [fileId]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check if user has access to the file (is participant in the chat)
    if (file.chat_id) {
      const participants = await database.query(
        'SELECT id FROM chat_participants WHERE chat_id = ? AND user_id = ?',
        [file.chat_id, req.user.userId]
      );

      if (participants.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (file.uploaded_by !== req.user.userId) {
      // If file is not in a chat, only the uploader can access it
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filePath = path.join(config.storage.uploads, file.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Length', file.file_size);

    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get file info
router.get('/:fileId/info', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const files = await database.query(`
      SELECT f.*, u.username as uploaded_by_username
      FROM files f
      JOIN users u ON f.uploaded_by = u.id
      WHERE f.id = ?
    `, [fileId]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check if user has access to the file
    if (file.chat_id) {
      const participants = await database.query(
        'SELECT id FROM chat_participants WHERE chat_id = ? AND user_id = ?',
        [file.chat_id, req.user.userId]
      );

      if (participants.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (file.uploaded_by !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Format file size
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const fileInfo = {
      id: file.id,
      originalName: file.original_name,
      fileSize: file.file_size,
      fileSizeFormatted: formatFileSize(file.file_size),
      mimeType: file.mime_type,
      uploadedBy: file.uploaded_by_username,
      uploadedAt: file.created_at,
      chatId: file.chat_id,
      messageId: file.message_id
    };

    res.json({
      success: true,
      data: fileInfo
    });

  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete file
router.delete('/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const files = await database.query(
      'SELECT * FROM files WHERE id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Check if user can delete the file (is uploader or has admin rights)
    if (file.uploaded_by !== req.user.userId) {
      // Check if user is admin in the chat
      if (file.chat_id) {
        const participants = await database.query(
          'SELECT role FROM chat_participants WHERE chat_id = ? AND user_id = ?',
          [file.chat_id, req.user.userId]
        );

        if (participants.length === 0 || !['admin', 'owner'].includes(participants[0].role)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Delete file from disk
    const filePath = path.join(config.storage.uploads, file.file_path);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.log('File not found on disk, skipping deletion');
    }

    // Delete file record from database
    await database.query(
      'DELETE FROM files WHERE id = ?',
      [fileId]
    );

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's files
router.get('/user/files', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get user's files
    const files = await database.query(`
      SELECT 
        f.id,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.created_at,
        f.chat_id,
        c.name as chat_name,
        c.type as chat_type
      FROM files f
      LEFT JOIN chats c ON f.chat_id = c.id
      WHERE f.uploaded_by = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.userId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);

    // Get total count
    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM files WHERE uploaded_by = ?',
      [req.user.userId]
    );

    const total = countResult[0].total;

    // Format file sizes
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formattedFiles = files.map(file => ({
      ...file,
      fileSizeFormatted: formatFileSize(file.file_size)
    }));

    res.json({
      success: true,
      data: {
        files: formattedFiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get chat files
router.get('/chat/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;

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

    // Get chat files
    const files = await database.query(`
      SELECT 
        f.id,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.created_at,
        f.uploaded_by,
        u.username as uploaded_by_username
      FROM files f
      JOIN users u ON f.uploaded_by = u.id
      WHERE f.chat_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [chatId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);

    // Get total count
    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM files WHERE chat_id = ?',
      [chatId]
    );

    const total = countResult[0].total;

    // Format file sizes
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formattedFiles = files.map(file => ({
      ...file,
      fileSizeFormatted: formatFileSize(file.file_size)
    }));

    res.json({
      success: true,
      data: {
        files: formattedFiles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get chat files error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;