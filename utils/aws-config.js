const { S3Client } = require('@aws-sdk/client-s3');
const parameterStore = require('./parameter-store');

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

// Initialize buckets with fallback to environment variables
let buckets = {
  original: process.env.S3_ORIGINAL_BUCKET || 'n10992511-videotranscoder-original',
  processed: process.env.S3_PROCESSED_BUCKET || 'n10992511-videotranscoder-processed'
};

// Load bucket configuration from Parameter Store
async function loadBucketConfig() {
  try {
    const config = await parameterStore.getAppConfig();
    buckets.original = config.s3OriginalBucket;
    buckets.processed = config.s3ProcessedBucket;
    console.log('S3 bucket configuration loaded from Parameter Store');
  } catch (error) {
    console.warn('Using environment variables for S3 bucket configuration:', error.message);
  }
}

// Load configuration on module initialization
loadBucketConfig().catch(console.warn);

module.exports = {
  s3Client,
  buckets,
  loadBucketConfig
};