// Database abstraction layer - switches between PostgreSQL and DynamoDB
const postgresDB = require('./database');
const dynamoDB = require('./dynamodb');

class DatabaseAbstraction {
  constructor() {
    // Choose database provider based on environment variable
    this.provider = process.env.DB_PROVIDER || 'postgres';
    this.db = this.provider === 'dynamodb' ? dynamoDB : postgresDB;

    console.log(`Database provider: ${this.provider}`);
  }

  // Initialize database
  async init() {
    return await this.db.init();
  }

  // Generic methods that route to appropriate database
  async get(query, params = []) {
    if (this.provider === 'dynamodb') {
      throw new Error('DynamoDB: Use specific methods instead of generic get()');
    }
    return await this.db.get(query, params);
  }

  async all(query, params = []) {
    if (this.provider === 'dynamodb') {
      throw new Error('DynamoDB: Use specific methods instead of generic all()');
    }
    return await this.db.all(query, params);
  }

  async run(query, params = []) {
    if (this.provider === 'dynamodb') {
      throw new Error('DynamoDB: Use specific methods instead of generic run()');
    }
    return await this.db.run(query, params);
  }

  // Application-specific methods (works with both databases)

  // User operations
  async getUserById(userId) {
    if (this.provider === 'dynamodb') {
      return await this.db.getUserById(userId);
    } else {
      const result = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
      return result;
    }
  }

  async getUserByUsername(username) {
    if (this.provider === 'dynamodb') {
      return await this.db.getUserByUsername(username);
    } else {
      const result = await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
      return result;
    }
  }

  // Video operations
  async createVideo(videoData) {
    if (this.provider === 'dynamodb') {
      return await this.db.createVideo(videoData);
    } else {
      const { user_id, filename, original_name, file_path, size_mb, format, storage_key } = videoData;
      const videoId = require('uuid').v4();

      await this.db.run(
        `INSERT INTO videos (id, user_id, filename, original_name, file_path, size_mb, format, storage_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [videoId, user_id, filename, original_name, file_path, size_mb, format, storage_key]
      );

      return { id: videoId, ...videoData };
    }
  }

  async getVideoById(videoId) {
    if (this.provider === 'dynamodb') {
      return await this.db.getVideoById(videoId);
    } else {
      return await this.db.get('SELECT * FROM videos WHERE id = ?', [videoId]);
    }
  }

  async getVideosByUser(userId, userRole) {
    if (this.provider === 'dynamodb') {
      if (userRole === 'admin') {
        return await this.db.getAllVideos();
      } else {
        return await this.db.getVideosByUserId(userId);
      }
    } else {
      let query = 'SELECT * FROM videos';
      let params = [];

      if (userRole !== 'admin') {
        query += ' WHERE user_id = ?';
        params = [userId];
      }

      query += ' ORDER BY uploaded_at DESC';
      return await this.db.all(query, params);
    }
  }

  // Transcode job operations
  async createTranscodeJob(jobData) {
    if (this.provider === 'dynamodb') {
      return await this.db.createTranscodeJob(jobData);
    } else {
      const { user_id, video_id, original_filename, target_resolution, target_format, quality_preset, bitrate, repeat_count } = jobData;
      const jobId = require('uuid').v4();

      await this.db.run(
        `INSERT INTO transcode_jobs (id, user_id, video_id, original_filename, target_resolution, target_format, quality_preset, bitrate, repeat_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [jobId, user_id, video_id, original_filename, target_resolution, target_format, quality_preset, bitrate, repeat_count]
      );

      return { id: jobId, ...jobData, status: 'pending' };
    }
  }

  async getTranscodeJobById(jobId) {
    if (this.provider === 'dynamodb') {
      return await this.db.getTranscodeJobById(jobId);
    } else {
      return await this.db.get('SELECT * FROM transcode_jobs WHERE id = ?', [jobId]);
    }
  }

  async getTranscodeJobsByUser(userId, userRole) {
    if (this.provider === 'dynamodb') {
      if (userRole === 'admin') {
        return await this.db.getAllTranscodeJobs();
      } else {
        return await this.db.getTranscodeJobsByUserId(userId);
      }
    } else {
      let query = 'SELECT * FROM transcode_jobs';
      let params = [];

      if (userRole !== 'admin') {
        query += ' WHERE user_id = ?';
        params = [userId];
      }

      query += ' ORDER BY created_at DESC';
      return await this.db.all(query, params);
    }
  }

  async updateTranscodeJob(jobId, updates) {
    if (this.provider === 'dynamodb') {
      return await this.db.updateTranscodeJob(jobId, updates);
    } else {
      // Handle PostgreSQL updates
      const setClause = [];
      const values = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'status') {
          setClause.push('status = ?');
          values.push(value);
        } else if (key === 'output_path') {
          setClause.push('output_path = ?');
          values.push(value);
        } else if (key === 'output_storage_key') {
          setClause.push('output_storage_key = ?');
          values.push(value);
        } else if (key === 'processing_time_seconds') {
          setClause.push('processing_time_seconds = ?');
          values.push(value);
        } else if (key === 'error_message') {
          setClause.push('error_message = ?');
          values.push(value);
        }
      });

      if (updates.started_at !== undefined) {
        setClause.push('started_at = CURRENT_TIMESTAMP');
      }

      if (updates.completed_at !== undefined) {
        setClause.push('completed_at = CURRENT_TIMESTAMP');
      }

      values.push(jobId);

      const query = `UPDATE transcode_jobs SET ${setClause.join(', ')} WHERE id = ?`;
      return await this.db.run(query, values);
    }
  }

  async getTranscodeJobWithVideo(jobId, userId, userRole) {
    if (this.provider === 'dynamodb') {
      const job = await this.db.getTranscodeJobById(jobId);
      if (!job) return null;

      // Check permissions
      if (userRole !== 'admin' && job.user_id !== userId) {
        return null;
      }

      return job;
    } else {
      let query = 'SELECT tj.*, v.file_path, v.original_name, v.storage_key FROM transcode_jobs tj JOIN videos v ON tj.video_id = v.id WHERE tj.id = ?';
      let params = [jobId];

      if (userRole !== 'admin') {
        query += ' AND tj.user_id = ?';
        params.push(userId);
      }

      return await this.db.get(query, params);
    }
  }
}

// Export singleton instance
const database = new DatabaseAbstraction();
module.exports = database;