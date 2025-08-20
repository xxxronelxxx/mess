require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'messenger_db',
    connectionLimit: 10
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: '7d'
  },
  storage: {
    uploads: process.env.UPLOADS_PATH || './uploads',
    chats: process.env.CHATS_PATH || './chats',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['image/*', 'video/*', 'application/*', 'text/*']
  },
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true
  }
};