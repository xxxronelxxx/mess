const mysql = require('mysql2/promise');
const config = require('../../config/config');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        connectionLimit: config.database.connectionLimit,
        waitForConnections: true,
        queueLimit: 0
      });

      // Test connection
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      connection.release();
      
      return this.pool;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Database query error:', error.message);
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ Database connection closed');
    }
  }
}

module.exports = new Database();