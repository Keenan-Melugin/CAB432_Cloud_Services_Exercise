const { S3Client } = require('@aws-sdk/client-s3');

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

const buckets = {
  original: process.env.S3_ORIGINAL_BUCKET || 'n10992511-videotranscoder-original',
  processed: process.env.S3_PROCESSED_BUCKET || 'n10992511-videotranscoder-processed'
};

module.exports = {
  s3Client,
  buckets
};