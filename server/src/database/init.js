const database = require('./connection');
const fs = require('fs');
const path = require('path');

const createTables = async () => {
  try {
    await database.connect();

    // Users table
    await database.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Contacts table
    await database.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        contact_user_id INT NOT NULL,
        is_blocked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_contact (user_id, contact_user_id)
      )
    `);

    // Chats table
    await database.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        type ENUM('private', 'group', 'favorites') DEFAULT 'private',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Chat participants table
    await database.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('member', 'admin', 'owner') DEFAULT 'member',
        is_pinned BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_participant (chat_id, user_id)
      )
    `);

    // Pinned messages table
    await database.query(`
      CREATE TABLE IF NOT EXISTS pinned_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT NOT NULL,
        message_id VARCHAR(100) NOT NULL,
        pinned_by INT NOT NULL,
        pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Files table
    await database.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by INT NOT NULL,
        chat_id INT,
        message_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);

    // Create default favorites chat
    await database.query(`
      INSERT IGNORE INTO chats (id, name, type) VALUES (1, 'Избранное', 'favorites')
    `);

    console.log('✅ Database tables created successfully');

    // Create storage directories
    const config = require('../../config/config');
    const baseUploads = path.resolve(config.storage.uploads);
    const baseChats = path.resolve(config.storage.chats);
    const dirs = [
      baseUploads,
      baseChats,
      path.join(baseUploads, 'avatars'),
      path.join(baseUploads, 'files'),
      path.join(baseUploads, 'media')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    }

    await database.close();
    console.log('✅ Database initialization completed');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

createTables();