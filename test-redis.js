#!/usr/bin/env node
// Redis Connection Test Script
// CAB432 Assignment 2 - ElastiCache Troubleshooting

const { initializeRedis, getRedisStatus } = require('./utils/redis-config');

async function testRedisConnection() {
  console.log('Redis Connection Test');
  console.log('========================');

  console.log('\nEnvironment Variables:');
  console.log(`REDIS_HOST: ${process.env.REDIS_HOST || 'not set'}`);
  console.log(`REDIS_ENDPOINT: ${process.env.REDIS_ENDPOINT || 'not set'}`);
  console.log(`REDIS_PORT: ${process.env.REDIS_PORT || 'not set'}`);

  console.log('\nAttempting Redis connection...');

  try {
    const client = await initializeRedis();
    const status = getRedisStatus();

    console.log('\nConnection Status:');
    console.log(`Connected: ${status.connected}`);
    console.log(`Is Mock: ${status.isMock}`);
    console.log(`Error: ${status.error || 'none'}`);

    if (!status.isMock) {
      console.log('\nTesting Redis operations...');

      // Test basic operations
      await client.set('test:connection', 'success', 'EX', 60);
      const result = await client.get('test:connection');
      console.log(`Set/Get test: ${result === 'success' ? 'PASS' : 'FAIL'}`);

      // Test ping
      const pong = await client.ping();
      console.log(`Ping test: ${pong === 'PONG' ? 'PASS' : 'FAIL'}`);

      console.log('\nRedis is working correctly!');
      console.log('Performance benefits: cache operations will be fast');

    } else {
      console.log('\nUsing mock Redis client');
      console.log('Cache operations will be no-ops');
      console.log('Application will still function but without performance benefits');
    }

  } catch (error) {
    console.error('\nRedis test failed:', error.message);
  }

  console.log('\nTroubleshooting Tips:');
  console.log('- For local testing: sudo apt install redis-server && sudo systemctl start redis-server');
  console.log('- Set environment: export REDIS_HOST="127.0.0.1"');
  console.log('- For ElastiCache: check security groups allow port 6379');
  console.log('- QUT AWS may block ElastiCache - mock client provides graceful degradation');
}

if (require.main === module) {
  testRedisConnection().catch(console.error);
}

module.exports = { testRedisConnection };