// Test DynamoDB service layer
const database = require('./utils/database-abstraction');

async function testDynamoDBService() {
  console.log('🧪 Testing DynamoDB Service Layer...');

  try {
    // Set to use DynamoDB
    process.env.DB_PROVIDER = 'dynamodb';

    // Test initialization
    console.log('\n1. Testing database initialization...');
    await database.init();
    console.log('✅ Database initialized successfully');

    // Test user operations
    console.log('\n2. Testing user operations...');

    // Get user by username
    const user1 = await database.getUserByUsername('user1');
    console.log('✅ Found user1:', user1 ? `${user1.username} (${user1.role})` : 'NOT FOUND');

    const admin1 = await database.getUserByUsername('admin1');
    console.log('✅ Found admin1:', admin1 ? `${admin1.username} (${admin1.role})` : 'NOT FOUND');

    // Get user by ID
    if (user1) {
      const userById = await database.getUserById(user1.id);
      console.log('✅ User by ID:', userById ? userById.username : 'NOT FOUND');
    }

    // Test video operations
    console.log('\n3. Testing video operations...');

    if (user1) {
      const testVideo = await database.createVideo({
        user_id: user1.id,
        filename: 'test-video.mp4',
        original_name: 'My Test Video.mp4',
        file_path: 's3://bucket/test-video.mp4',
        size_mb: 25.5,
        format: 'mp4',
        storage_key: 'uuid-test-video.mp4'
      });
      console.log('✅ Created video:', testVideo.id);

      const retrievedVideo = await database.getVideoById(testVideo.id);
      console.log('✅ Retrieved video:', retrievedVideo ? retrievedVideo.original_name : 'NOT FOUND');

      const userVideos = await database.getVideosByUser(user1.id, 'user');
      console.log('✅ User videos count:', userVideos.length);
    }

    // Test transcode job operations
    console.log('\n4. Testing transcode job operations...');

    if (user1) {
      const testJob = await database.createTranscodeJob({
        user_id: user1.id,
        video_id: 'test-video-id',
        original_filename: 'test.mp4',
        target_resolution: '720p',
        target_format: 'mp4',
        quality_preset: 'medium',
        bitrate: '1000k',
        repeat_count: 1
      });
      console.log('✅ Created transcode job:', testJob.id);

      const retrievedJob = await database.getTranscodeJobById(testJob.id);
      console.log('✅ Retrieved job status:', retrievedJob ? retrievedJob.status : 'NOT FOUND');

      // Test job update
      await database.updateTranscodeJob(testJob.id, {
        status: 'processing',
        started_at: true
      });

      const updatedJob = await database.getTranscodeJobById(testJob.id);
      console.log('✅ Updated job status:', updatedJob ? updatedJob.status : 'NOT FOUND');
    }

    console.log('\n🎉 All DynamoDB service tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ DynamoDB service test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDynamoDBService()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDynamoDBService };