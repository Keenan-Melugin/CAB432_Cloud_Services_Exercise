const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class PostgresDatabase {
  constructor() {
    this.pool = null;
  }

  async init() {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'video_transcoding',
      user: process.env.DB_USER || 'transcoder',
      password: process.env.DB_PASSWORD || 'transcoder123',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(config);

    try {
      const client = await this.pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();
      
      // Test the connection and ensure tables exist
      await this.ensureTablesExist();
      return Promise.resolve();
    } catch (error) {
      console.error('Error connecting to PostgreSQL:', error);
      throw error;
    }
  }

  async ensureTablesExist() {
    // The init-db.sql file handles table creation during container startup
    // This method just verifies the connection works
    const result = await this.query('SELECT COUNT(*) as user_count FROM users');
    console.log(`Database initialized with ${result.rows[0].user_count} users`);
  }

  async query(text, params = []) {
    const client = await this.pool.connect();
    let convertedQuery = text;
    try {
      // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
      let paramIndex = 1;
      convertedQuery = convertedQuery.replace(/\?/g, () => `$${paramIndex++}`);
      
      const result = await client.query(convertedQuery, params);
      
      return result;
    } catch (error) {
      throw error;
    } finally {
      client.release();
    }
  }

  async run(sql, params = []) {
    const result = await this.query(sql, params);
    return {
      rowCount: result.rowCount,
      rows: result.rows
    };
  }

  async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows[0] || null;
  }

  async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('PostgreSQL connection pool closed');
    }
  }
}

// Export singleton instance
const postgresDatabase = new PostgresDatabase();
module.exports = postgresDatabase;