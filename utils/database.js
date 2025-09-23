const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Check if we should use PostgreSQL or SQLite
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

if (DB_TYPE === 'postgres') {
  module.exports = require('./postgres-database');
} else {
  // SQLite implementation (default for local development)
  const DB_PATH = path.join(__dirname, '..', 'data', 'videos.db');

  class Database {
    constructor() {
      this.db = null;
    }

    async init() {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
          if (err) {
            console.error('Error opening database:', err);
            reject(err);
          } else {
            console.log('Connected to SQLite database');
            this.createTables().then(resolve).catch(reject);
          }
        });
      });
    }

  async createTables() {
    const tables = [
      // Videos table (unstructured data metadata)
      `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size_mb REAL NOT NULL,
        duration_seconds INTEGER,
        format TEXT,
        storage_key TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Transcode jobs table (structured data)
      `CREATE TABLE IF NOT EXISTS transcode_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        target_resolution TEXT NOT NULL,
        target_format TEXT NOT NULL,
        quality_preset TEXT DEFAULT 'medium',
        bitrate TEXT DEFAULT '1000k',
        repeat_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        output_path TEXT,
        output_storage_key TEXT,
        storage_key TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        processing_time_seconds INTEGER,
        FOREIGN KEY (video_id) REFERENCES videos(id)
      )`,

      // Users table (for authentication)
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Run migrations for existing databases
    await this.runMigrations();

    // Insert default users if they don't exist
    await this.insertDefaultUsers();
  }

  async runMigrations() {
    try {
      // Check if repeat_count column exists
      const tableInfo = await this.all("PRAGMA table_info(transcode_jobs)");
      const hasRepeatCount = tableInfo.some(column => column.name === 'repeat_count');
      
      if (!hasRepeatCount) {
        await this.run('ALTER TABLE transcode_jobs ADD COLUMN repeat_count INTEGER DEFAULT 1');
      }
      
      // Check if YouTube columns exist in videos table
      const videoTableInfo = await this.all("PRAGMA table_info(videos)");
      const hasYouTubeUrl = videoTableInfo.some(column => column.name === 'youtube_url');
      
      if (!hasYouTubeUrl) {
        await this.run('ALTER TABLE videos ADD COLUMN youtube_url TEXT');
        await this.run('ALTER TABLE videos ADD COLUMN youtube_title TEXT');
        await this.run('ALTER TABLE videos ADD COLUMN youtube_uploader TEXT');
      }
    } catch (error) {
      console.error('Migration error:', error);
      // Don't fail the entire app if migration fails
    }
  }

  async insertDefaultUsers() {
    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');

    const users = [
      { username: 'user1', password: 'password', role: 'user' },
      { username: 'admin1', password: 'password', role: 'admin' },
      { username: 'user2', password: 'password', role: 'user' }
    ];

    for (const user of users) {
      try {
        const existingUser = await this.get('SELECT * FROM users WHERE username = ?', [user.username]);
        
        if (!existingUser) {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          await this.run(
            'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [uuidv4(), user.username, hashedPassword, user.role]
          );
          console.log(`Created user: ${user.username} (${user.role})`);
        }
      } catch (error) {
        console.error(`Error creating user ${user.username}:`, error);
      }
    }
  }

  // Promise wrapper for database operations
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
  }

  // Create global database instance
  const database = new Database();
  module.exports = database;
}