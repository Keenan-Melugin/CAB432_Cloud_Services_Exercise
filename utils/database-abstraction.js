// Database abstraction layer - DynamoDB only (PostgreSQL removed)
const dynamoDB = require('./dynamodb');

class DatabaseAbstraction {
  constructor() {
    // Use DynamoDB as the only database provider
    this.provider = process.env.DATABASE_PROVIDER || 'dynamodb';
    this.db = dynamoDB;

    console.log(`Database provider: ${this.provider}`);
  }

  // Initialize database
  async init() {
    return await this.db.init();
  }

  // Generic methods (not used with DynamoDB - throw errors to catch legacy usage)
  async get(query, params = []) {
    throw new Error('DynamoDB: Use specific methods instead of generic get()');
  }

  async all(query, params = []) {
    throw new Error('DynamoDB: Use specific methods instead of generic all()');
  }

  async run(query, params = []) {
    throw new Error('DynamoDB: Use specific methods instead of generic run()');
  }

  // Application-specific methods

  // User operations
  async getUserById(userId) {
    return await this.db.getUserById(userId);
  }

  async getUserByUsername(username) {
    return await this.db.getUserByUsername(username);
  }

  // Create or get a Cognito user
  async createOrGetCognitoUser(cognitoUser) {
    return await this.db.createOrGetCognitoUser(cognitoUser);
  }

  // Video operations
  async createVideo(videoData) {
    return await this.db.createVideo(videoData);
  }

  async getVideoById(videoId) {
    return await this.db.getVideoById(videoId);
  }

  async getVideosByUser(userId, userRole) {
    if (userRole === 'admin') {
      return await this.db.getAllVideos();
    } else {
      return await this.db.getVideosByUserId(userId);
    }
  }

  // Transcode job operations
  async createTranscodeJob(jobData) {
    return await this.db.createTranscodeJob(jobData);
  }

  async getTranscodeJobById(jobId) {
    return await this.db.getTranscodeJobById(jobId);
  }

  async getTranscodeJobsByUser(userId, userRole) {
    if (userRole === 'admin') {
      return await this.db.getAllTranscodeJobs();
    } else {
      return await this.db.getTranscodeJobsByUserId(userId);
    }
  }

  async updateTranscodeJob(jobId, updates) {
    return await this.db.updateTranscodeJob(jobId, updates);
  }

  // Combined job with video data (for convenience)
  async getTranscodeJobWithVideo(jobId, userId, userRole) {
    const job = await this.getTranscodeJobById(jobId);
    if (!job) return null;

    // Check access permissions
    if (userRole !== 'admin' && job.user_id !== userId) {
      return null;
    }

    return job;
  }
}

// Export singleton instance
const database = new DatabaseAbstraction();
module.exports = database;