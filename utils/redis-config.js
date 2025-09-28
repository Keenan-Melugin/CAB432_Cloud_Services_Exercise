// Redis configuration for ElastiCache
const Redis = require('ioredis');
const { getSecretValue } = require('./secrets-manager');
const parameterStore = require('./parameter-store');

let redisClient = null;
let isConnected = false;
let connectionError = null;

// Cache TTL values (in seconds)
const TTL = {
  USER_SESSION: 3600,      // 1 hour for user session data
  VIDEO_METADATA: 1800,    // 30 minutes for video metadata
  JOB_PROGRESS: 300,       // 5 minutes for transcode progress
  API_RESPONSE: 600,       // 10 minutes for API responses
  RATE_LIMIT: 60          // 1 minute for rate limiting
};

async function initializeRedis() {
  try {
    // Try to get Redis configuration from environment first
    const localRedisHost = process.env.REDIS_HOST || process.env.REDIS_ENDPOINT;
    const localRedisPort = process.env.REDIS_PORT || 6379;

    if (localRedisHost) {
      // Redis configuration from environment variables
      console.log('🔧 Connecting to Redis using environment variables...');
      console.log(`📍 Target: ${localRedisHost}:${localRedisPort}`);

      redisClient = new Redis({
        host: localRedisHost,
        port: parseInt(localRedisPort),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000
      });
    } else {
      // AWS ElastiCache configuration (production)
      console.log('☁️  Connecting to AWS ElastiCache Redis...');

      let redisConfig;
      try {
        // Try to get configuration from Secrets Manager first
        redisConfig = await getSecretValue('redis-config');
      } catch (error) {
        console.log('📋 Secrets Manager not available, using Parameter Store...');
        // Fallback to Parameter Store
        const endpoint = await parameterStore.getParameter('redis/endpoint');
        const port = await parameterStore.getParameter('redis/port');

        redisConfig = {
          host: endpoint,
          port: parseInt(port) || 6379,
          tls_enabled: false
        };
      }

      // Create Redis client with ElastiCache configuration
      const clientConfig = {
        host: redisConfig.host,
        port: redisConfig.port,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        family: 4, // Use IPv4
      };

      // Add TLS configuration for ElastiCache
      if (redisConfig.tls_enabled) {
        clientConfig.tls = {
          rejectUnauthorized: false
        };
      }

      // Add authentication if provided
      if (redisConfig.auth_token) {
        clientConfig.password = redisConfig.auth_token;
      }

      redisClient = new Redis(clientConfig);
    }

    // Set up event handlers
    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
      isConnected = true;
      connectionError = null;
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis connection error:', error.message);
      isConnected = false;
      connectionError = error;
    });

    redisClient.on('close', () => {
      console.log('🔌 Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    // Test the connection
    await redisClient.ping();
    console.log('🏓 Redis ping successful');

    return redisClient;

  } catch (error) {
    console.error('Failed to initialize Redis:', error.message);

    // Provide specific guidance for common connection issues
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 DNS resolution failed - check endpoint hostname');
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      console.log('💡 Connection blocked - likely network/security group issue');
      console.log('   • For QUT AWS: ElastiCache may be blocked by institutional firewall');
      console.log('   • Try: export REDIS_HOST="127.0.0.1" for local Redis testing');
    } else if (error.message.includes('ECONNRESET')) {
      console.log('💡 Connection reset - check authentication or encryption settings');
    }

    connectionError = error;

    // Create a mock client that gracefully degrades
    redisClient = createMockRedis();
    return redisClient;
  }
}

// Mock Redis client for graceful degradation
function createMockRedis() {
  console.log('⚠️  Creating mock Redis client - cache operations will be no-ops');

  return {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    exists: async () => 0,
    expire: async () => 1,
    incr: async () => 1,
    decr: async () => 0,
    hget: async () => null,
    hset: async () => 0,
    hdel: async () => 0,
    hgetall: async () => ({}),
    ping: async () => 'PONG',
    quit: async () => 'OK',
    disconnect: () => {},
    isConnected: () => false,
    isMock: true
  };
}

// Get or initialize Redis client
async function getRedisClient() {
  if (!redisClient) {
    await initializeRedis();
  }
  return redisClient;
}

// Health check for Redis
function isRedisHealthy() {
  return isConnected && !connectionError;
}

// Get connection status
function getRedisStatus() {
  return {
    connected: isConnected,
    error: connectionError?.message || null,
    isMock: redisClient?.isMock || false
  };
}

// Graceful shutdown
async function closeRedis() {
  if (redisClient && !redisClient.isMock) {
    try {
      await redisClient.quit();
      console.log('🔌 Redis connection closed gracefully');
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }
  }
}

module.exports = {
  initializeRedis,
  getRedisClient,
  isRedisHealthy,
  getRedisStatus,
  closeRedis,
  TTL
};