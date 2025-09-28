// Cache abstraction layer with ElastiCache Redis integration
const { getRedisClient, TTL, isRedisHealthy } = require('./redis-config');

class CacheManager {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      this.client = await getRedisClient();
      this.initialized = true;
    }
    return this.client;
  }

  // Generate cache keys with consistent naming
  generateKey(type, id, ...parts) {
    const keyParts = ['videotranscoder', type, id, ...parts].filter(Boolean);
    return keyParts.join(':');
  }

  // Basic cache operations
  async get(key) {
    try {
      await this.init();
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn(`Cache GET error for key ${key}:`, error.message);
      return null; // Graceful degradation
    }
  }

  async set(key, value, ttl = TTL.API_RESPONSE) {
    try {
      await this.init();
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, 'EX', ttl);
      return true;
    } catch (error) {
      console.warn(`Cache SET error for key ${key}:`, error.message);
      return false; // Graceful degradation
    }
  }

  async del(key) {
    try {
      await this.init();
      await this.client.del(key);
      return true;
    } catch (error) {
      console.warn(`Cache DELETE error for key ${key}:`, error.message);
      return false;
    }
  }

  async exists(key) {
    try {
      await this.init();
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn(`Cache EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  // Application-specific cache methods

  // User session caching
  async cacheUserSession(userId, userData) {
    const key = this.generateKey('user', 'session', userId);
    return await this.set(key, userData, TTL.USER_SESSION);
  }

  async getUserSession(userId) {
    const key = this.generateKey('user', 'session', userId);
    return await this.get(key);
  }

  async invalidateUserSession(userId) {
    const key = this.generateKey('user', 'session', userId);
    return await this.del(key);
  }

  // Video metadata caching
  async cacheVideoMetadata(videoId, videoData) {
    const key = this.generateKey('video', 'metadata', videoId);
    return await this.set(key, videoData, TTL.VIDEO_METADATA);
  }

  async getVideoMetadata(videoId) {
    const key = this.generateKey('video', 'metadata', videoId);
    return await this.get(key);
  }

  async invalidateVideoMetadata(videoId) {
    const key = this.generateKey('video', 'metadata', videoId);
    return await this.del(key);
  }

  // User's video list caching
  async cacheUserVideos(userId, videos) {
    const key = this.generateKey('user', 'videos', userId);
    return await this.set(key, videos, TTL.API_RESPONSE);
  }

  async getUserVideos(userId) {
    const key = this.generateKey('user', 'videos', userId);
    return await this.get(key);
  }

  async invalidateUserVideos(userId) {
    const key = this.generateKey('user', 'videos', userId);
    return await this.del(key);
  }

  // Transcode job progress caching
  async cacheJobProgress(jobId, progressData) {
    const key = this.generateKey('job', 'progress', jobId);
    return await this.set(key, progressData, TTL.JOB_PROGRESS);
  }

  async getJobProgress(jobId) {
    const key = this.generateKey('job', 'progress', jobId);
    return await this.get(key);
  }

  async invalidateJobProgress(jobId) {
    const key = this.generateKey('job', 'progress', jobId);
    return await this.del(key);
  }

  // User's transcode jobs caching
  async cacheUserJobs(userId, jobs) {
    const key = this.generateKey('user', 'jobs', userId);
    return await this.set(key, jobs, TTL.API_RESPONSE);
  }

  async getUserJobs(userId) {
    const key = this.generateKey('user', 'jobs', userId);
    return await this.get(key);
  }

  async invalidateUserJobs(userId) {
    const key = this.generateKey('user', 'jobs', userId);
    return await this.del(key);
  }

  // Rate limiting
  async checkRateLimit(identifier, maxRequests = 100, windowSeconds = 60) {
    try {
      await this.init();
      const key = this.generateKey('ratelimit', identifier);

      const current = await this.client.incr(key);

      // Set expiration only on first request
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }

      return {
        count: current,
        limit: maxRequests,
        allowed: current <= maxRequests,
        resetTime: Date.now() + (windowSeconds * 1000)
      };
    } catch (error) {
      console.warn(`Rate limit check error for ${identifier}:`, error.message);
      // On error, allow the request (graceful degradation)
      return {
        count: 0,
        limit: maxRequests,
        allowed: true,
        resetTime: Date.now() + 60000
      };
    }
  }

  // Cache invalidation patterns
  async invalidateUserData(userId) {
    // Invalidate all user-related cache entries
    const patterns = [
      this.generateKey('user', 'session', userId),
      this.generateKey('user', 'videos', userId),
      this.generateKey('user', 'jobs', userId)
    ];

    const promises = patterns.map(key => this.del(key));
    await Promise.all(promises);
  }

  async invalidateVideoData(videoId, userId) {
    // Invalidate video and related user data
    await this.invalidateVideoMetadata(videoId);
    if (userId) {
      await this.invalidateUserVideos(userId);
    }
  }

  async invalidateJobData(jobId, userId) {
    // Invalidate job progress and related user data
    await this.invalidateJobProgress(jobId);
    if (userId) {
      await this.invalidateUserJobs(userId);
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.init();

      if (this.client.isMock) {
        return {
          status: 'degraded',
          message: 'Using mock Redis client',
          connected: false
        };
      }

      await this.client.ping();
      return {
        status: 'healthy',
        message: 'Redis connection is healthy',
        connected: isRedisHealthy()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        connected: false
      };
    }
  }

  // Cache statistics
  async getStats() {
    try {
      await this.init();

      if (this.client.isMock) {
        return {
          type: 'mock',
          connected: false,
          keys: 0
        };
      }

      // Get basic Redis info
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');

      return {
        type: 'redis',
        connected: isRedisHealthy(),
        memory: this.parseMemoryInfo(info),
        keyspace: this.parseKeyspaceInfo(keyspace)
      };
    } catch (error) {
      return {
        type: 'redis',
        connected: false,
        error: error.message
      };
    }
  }

  parseMemoryInfo(info) {
    const lines = info.split('\r\n');
    const memory = {};

    lines.forEach(line => {
      if (line.includes('used_memory_human:')) {
        memory.used = line.split(':')[1];
      }
      if (line.includes('used_memory_peak_human:')) {
        memory.peak = line.split(':')[1];
      }
    });

    return memory;
  }

  parseKeyspaceInfo(info) {
    const lines = info.split('\r\n');
    let totalKeys = 0;

    lines.forEach(line => {
      if (line.startsWith('db')) {
        const match = line.match(/keys=(\d+)/);
        if (match) {
          totalKeys += parseInt(match[1]);
        }
      }
    });

    return { totalKeys };
  }
}

// Export singleton instance
const cache = new CacheManager();
module.exports = cache;