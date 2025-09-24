// DynamoDB service layer - provides same interface as PostgreSQL database
const { docClient, tableNames } = require('./dynamodb-config');
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class DynamoDBService {
  constructor() {
    this.client = docClient;
    this.tables = tableNames;
  }

  // Initialize database with default users (equivalent to init-db.sql)
  async init() {
    console.log('Initializing DynamoDB with default users...');

    try {
      // Check if users already exist
      const existingUsers = await this.scanTable('users', {}, 3);

      if (existingUsers.length === 0) {
        console.log('Creating default users...');

        // Create default users with same IDs as PostgreSQL for JWT compatibility
        const defaultUsers = [
          {
            id: '5f91b320-7de6-48e1-a1d5-6ed3c04b1d08',
            username: 'user1',
            password_hash: '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu',
            role: 'user',
            created_at: new Date().toISOString()
          },
          {
            id: 'a8d2c4e6-1b3f-4567-8901-234567890abc',
            username: 'admin1',
            password_hash: '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu',
            role: 'admin',
            created_at: new Date().toISOString()
          },
          {
            id: 'b9e3d5f7-2c4f-5678-9012-345678901bcd',
            username: 'user2',
            password_hash: '$2b$10$GsoEAmMHwht0U3bpBX.SbeVoax0eyOBPNlZv88Wo4I70L32XjG4pu',
            role: 'user',
            created_at: new Date().toISOString()
          }
        ];

        for (const user of defaultUsers) {
          await this.putItem('users', user);
        }

        console.log('Database initialized with 3 users');
      } else {
        console.log(`Database already initialized with ${existingUsers.length} users`);
      }

    } catch (error) {
      console.error('Error initializing DynamoDB:', error);
      throw error;
    }
  }

  // Generic DynamoDB operations
  async putItem(tableName, item) {
    const command = new PutCommand({
      TableName: this.tables[tableName],
      Item: item
    });
    return await this.client.send(command);
  }

  async getItem(tableName, key) {
    const command = new GetCommand({
      TableName: this.tables[tableName],
      Key: key
    });
    const result = await this.client.send(command);
    return result.Item || null;
  }

  async updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames = null) {
    const command = new UpdateCommand({
      TableName: this.tables[tableName],
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ...(expressionAttributeNames && { ExpressionAttributeNames: expressionAttributeNames }),
      ReturnValues: 'ALL_NEW'
    });
    const result = await this.client.send(command);
    return result.Attributes;
  }

  async deleteItem(tableName, key) {
    const command = new DeleteCommand({
      TableName: this.tables[tableName],
      Key: key
    });
    return await this.client.send(command);
  }

  async scanTable(tableName, filterExpression = {}, limit = null) {
    const command = new ScanCommand({
      TableName: this.tables[tableName],
      ...(Object.keys(filterExpression).length > 0 && filterExpression),
      ...(limit && { Limit: limit })
    });
    const result = await this.client.send(command);
    return result.Items || [];
  }

  async queryTable(tableName, keyCondition, filterExpression = {}, indexName = null, limit = null) {
    const command = new QueryCommand({
      TableName: this.tables[tableName],
      KeyConditionExpression: keyCondition.expression,
      ExpressionAttributeValues: keyCondition.values,
      ...(keyCondition.names && { ExpressionAttributeNames: keyCondition.names }),
      ...(Object.keys(filterExpression).length > 0 && filterExpression),
      ...(indexName && { IndexName: indexName }),
      ...(limit && { Limit: limit })
    });
    const result = await this.client.send(command);
    return result.Items || [];
  }

  // PostgreSQL-compatible interface methods

  // Equivalent to database.get() - returns single row
  async get(query, params = []) {
    // This is a compatibility method - in practice, we'll use specific methods below
    throw new Error('get() method should be replaced with specific DynamoDB operations');
  }

  // Equivalent to database.all() - returns array of rows
  async all(query, params = []) {
    // This is a compatibility method - in practice, we'll use specific methods below
    throw new Error('all() method should be replaced with specific DynamoDB operations');
  }

  // Equivalent to database.run() - executes insert/update/delete
  async run(query, params = []) {
    // This is a compatibility method - in practice, we'll use specific methods below
    throw new Error('run() method should be replaced with specific DynamoDB operations');
  }

  // Specific methods for application needs

  // User operations
  async getUserById(userId) {
    return await this.getItem('users', { id: userId });
  }

  async getUserByUsername(username) {
    // Since we don't have GSI set up, we'll scan for now (not ideal for production)
    const users = await this.scanTable('users', {
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: { ':username': username }
    });
    return users.length > 0 ? users[0] : null;
  }

  // Video operations
  async createVideo(videoData) {
    const video = {
      id: uuidv4(),
      uploaded_at: new Date().toISOString(),
      ...videoData
    };
    await this.putItem('videos', video);
    return video;
  }

  async getVideoById(videoId) {
    return await this.getItem('videos', { id: videoId });
  }

  async getVideosByUserId(userId) {
    // Scan with filter (would use GSI in production)
    return await this.scanTable('videos', {
      FilterExpression: 'user_id = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
  }

  async getAllVideos() {
    return await this.scanTable('videos');
  }

  // Transcode job operations
  async createTranscodeJob(jobData) {
    const job = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      status: 'pending',
      ...jobData
    };
    await this.putItem('transcodeJobs', job);
    return job;
  }

  async getTranscodeJobById(jobId) {
    return await this.getItem('transcodeJobs', { id: jobId });
  }

  async getTranscodeJobsByUserId(userId) {
    // Scan with filter (would use GSI in production)
    return await this.scanTable('transcodeJobs', {
      FilterExpression: 'user_id = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
  }

  async getAllTranscodeJobs() {
    return await this.scanTable('transcodeJobs');
  }

  async updateTranscodeJob(jobId, updates) {
    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (key === 'status' || key === 'output_path' || key === 'error_message' ||
          key === 'processing_time_seconds' || key === 'output_storage_key') {
        const valueKey = `:val${index}`;
        const nameKey = `#name${index}`;

        updateExpressions.push(`#name${index} = :val${index}`);
        expressionAttributeValues[valueKey] = value;
        expressionAttributeNames[nameKey] = key;
      }
    });

    // Add timestamp updates
    if (updates.started_at !== undefined) {
      updateExpressions.push(`started_at = :started_at`);
      expressionAttributeValues[':started_at'] = new Date().toISOString();
    }

    if (updates.completed_at !== undefined) {
      updateExpressions.push(`completed_at = :completed_at`);
      expressionAttributeValues[':completed_at'] = new Date().toISOString();
    }

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return await this.updateItem('transcodeJobs', { id: jobId }, updateExpression,
                                 expressionAttributeValues, expressionAttributeNames);
  }
}

// Export singleton instance
const dynamoDB = new DynamoDBService();
module.exports = dynamoDB;