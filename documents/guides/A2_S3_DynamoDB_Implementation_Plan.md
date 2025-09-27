# CAB432 Assignment 2 - S3 + DynamoDB + Pre-signed URLs + Statelessness Implementation Plan

## Overview

This comprehensive plan covers the implementation of 4 core AWS services that work together as an integrated cloud storage system for the Video Transcoding Service. These tasks are designed to be implemented together for maximum efficiency and architectural coherence.

**Total Points: 11 marks**
- S3 Integration (3 points)
- DynamoDB Migration (3 points)
- S3 Pre-signed URLs (2 points)
- Statelessness (3 points)

**Timeline: 5-6 days**

---

## System Architecture

### Current State
```
Video Upload → Local Filesystem (./uploads/original/, ./uploads/processed/)
Metadata → SQLite Database (./data/videos.db)
Authentication → JWT with local user storage
```

### Target State
```
Video Upload → S3 Buckets (original/processed)
Metadata → DynamoDB Tables (Videos, TranscodeJobs, UserSessions)
File Access → S3 Pre-signed URLs (direct client access)
Application → Stateless (no local storage dependencies)
```

### Data Flow Integration
```
User Request → Pre-signed Upload URL → Direct S3 Upload
                                    ↓
Server Notification → DynamoDB Metadata Record → Processing Job
                                                ↓
FFmpeg Process (S3→S3) → Update DynamoDB → Pre-signed Download URL
```

---

## Phase 1: AWS Infrastructure Setup (Day 1)

### AWS Resources to Create

#### S3 Buckets
```bash
# Naming convention: n[student-number]-videotranscoder-[type]
Original Files Bucket: n[your-number]-videotranscoder-original
Processed Files Bucket: n[your-number]-videotranscoder-processed

# Configuration:
- Private buckets (no public access)
- Versioning enabled
- Server-side encryption
- Lifecycle policies for cost optimization
```

#### DynamoDB Tables

**1. Videos Table**
```json
{
  "TableName": "Videos",
  "KeySchema": [
    {"AttributeName": "id", "KeyType": "HASH"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "id", "AttributeType": "S"},
    {"AttributeName": "userId", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "UserIdIndex",
      "KeySchema": [
        {"AttributeName": "userId", "KeyType": "HASH"}
      ]
    }
  ]
}
```

**2. TranscodeJobs Table**
```json
{
  "TableName": "TranscodeJobs",
  "KeySchema": [
    {"AttributeName": "id", "KeyType": "HASH"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "id", "AttributeType": "S"},
    {"AttributeName": "userId", "AttributeType": "S"},
    {"AttributeName": "status", "AttributeType": "S"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "UserIdIndex",
      "KeySchema": [
        {"AttributeName": "userId", "KeyType": "HASH"}
      ]
    },
    {
      "IndexName": "StatusIndex",
      "KeySchema": [
        {"AttributeName": "status", "KeyType": "HASH"}
      ]
    }
  ]
}
```

**3. UserSessions Table** (for stateless session management)
```json
{
  "TableName": "UserSessions",
  "KeySchema": [
    {"AttributeName": "sessionId", "KeyType": "HASH"}
  ],
  "AttributeDefinitions": [
    {"AttributeName": "sessionId", "AttributeType": "S"}
  ],
  "TimeToLiveSpecification": {
    "AttributeName": "expiresAt",
    "Enabled": true
  }
}
```

### Environment Configuration
```bash
# Add to .env or Parameter Store later
AWS_REGION=us-east-1
S3_ORIGINAL_BUCKET=n[your-number]-videotranscoder-original
S3_PROCESSED_BUCKET=n[your-number]-videotranscoder-processed
DYNAMODB_VIDEOS_TABLE=Videos
DYNAMODB_JOBS_TABLE=TranscodeJobs
DYNAMODB_SESSIONS_TABLE=UserSessions
```

---

## Phase 2: S3 Service Implementation (Days 2-3)

### File Structure Updates
```
utils/
├── aws-config.js          # Shared AWS configuration
├── s3-service.js          # S3 operations + pre-signed URLs
├── dynamodb-service.js    # DynamoDB operations
├── storage.js             # Updated abstraction layer
└── database.js            # Updated to use DynamoDB service
```

### S3 Service Implementation

**utils/aws-config.js**
```javascript
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

module.exports = { s3, dynamodb };
```

**utils/s3-service.js**
```javascript
const { s3 } = require('./aws-config');
const { v4: uuidv4 } = require('uuid');

class S3Service {
  constructor() {
    this.originalBucket = process.env.S3_ORIGINAL_BUCKET;
    this.processedBucket = process.env.S3_PROCESSED_BUCKET;
  }

  // Upload video file to S3
  async uploadVideo(buffer, filename, contentType) {
    const key = `${uuidv4()}-${filename}`;
    const params = {
      Bucket: this.originalBucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    };

    try {
      const result = await s3.upload(params).promise();
      return {
        key: key,
        location: result.Location,
        bucket: this.originalBucket,
        size: buffer.length
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  // Generate pre-signed URL for upload
  async generatePresignedUploadUrl(filename, contentType, expiresIn = 3600) {
    const key = `${uuidv4()}-${filename}`;
    const params = {
      Bucket: this.originalBucket,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn
    };

    try {
      const url = await s3.getSignedUrlPromise('putObject', params);
      return { url, key };
    } catch (error) {
      throw new Error(`Pre-signed upload URL generation failed: ${error.message}`);
    }
  }

  // Generate pre-signed URL for download
  async generatePresignedDownloadUrl(key, bucket = null, expiresIn = 3600) {
    const targetBucket = bucket || this.processedBucket;
    const params = {
      Bucket: targetBucket,
      Key: key,
      Expires: expiresIn
    };

    try {
      const url = await s3.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      throw new Error(`Pre-signed download URL generation failed: ${error.message}`);
    }
  }

  // Copy object between buckets (for processing pipeline)
  async copyObject(sourceKey, destinationKey, sourceBucket = null, destBucket = null) {
    const source = sourceBucket || this.originalBucket;
    const dest = destBucket || this.processedBucket;

    const params = {
      Bucket: dest,
      CopySource: `${source}/${sourceKey}`,
      Key: destinationKey
    };

    try {
      const result = await s3.copyObject(params).promise();
      return result;
    } catch (error) {
      throw new Error(`S3 copy failed: ${error.message}`);
    }
  }

  // Delete object
  async deleteObject(key, bucket = null) {
    const targetBucket = bucket || this.originalBucket;
    const params = {
      Bucket: targetBucket,
      Key: key
    };

    try {
      await s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  // Get object stream for processing
  async getObjectStream(key, bucket = null) {
    const targetBucket = bucket || this.originalBucket;
    const params = {
      Bucket: targetBucket,
      Key: key
    };

    try {
      return s3.getObject(params).createReadStream();
    } catch (error) {
      throw new Error(`S3 stream failed: ${error.message}`);
    }
  }
}

module.exports = new S3Service();
```

---

## Phase 3: DynamoDB Migration (Days 3-4)

### DynamoDB Service Implementation

**utils/dynamodb-service.js**
```javascript
const { dynamodb } = require('./aws-config');

class DynamoDBService {
  constructor() {
    this.videosTable = process.env.DYNAMODB_VIDEOS_TABLE || 'Videos';
    this.jobsTable = process.env.DYNAMODB_JOBS_TABLE || 'TranscodeJobs';
    this.sessionsTable = process.env.DYNAMODB_SESSIONS_TABLE || 'UserSessions';
  }

  // Video operations
  async saveVideo(videoData) {
    const params = {
      TableName: this.videosTable,
      Item: {
        id: videoData.id,
        userId: videoData.userId,
        filename: videoData.filename,
        originalName: videoData.originalName,
        s3Key: videoData.s3Key,
        s3Bucket: videoData.s3Bucket,
        fileSize: videoData.fileSize,
        contentType: videoData.contentType,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      }
    };

    try {
      await dynamodb.put(params).promise();
      return params.Item;
    } catch (error) {
      throw new Error(`DynamoDB video save failed: ${error.message}`);
    }
  }

  async getVideosByUser(userId) {
    const params = {
      TableName: this.videosTable,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    try {
      const result = await dynamodb.query(params).promise();
      return result.Items;
    } catch (error) {
      throw new Error(`DynamoDB video query failed: ${error.message}`);
    }
  }

  async getVideoById(videoId) {
    const params = {
      TableName: this.videosTable,
      Key: { id: videoId }
    };

    try {
      const result = await dynamodb.get(params).promise();
      return result.Item;
    } catch (error) {
      throw new Error(`DynamoDB video get failed: ${error.message}`);
    }
  }

  // Transcode job operations
  async saveTranscodeJob(jobData) {
    const params = {
      TableName: this.jobsTable,
      Item: {
        id: jobData.id,
        userId: jobData.userId,
        videoId: jobData.videoId,
        status: jobData.status || 'pending',
        inputS3Key: jobData.inputS3Key,
        outputS3Key: jobData.outputS3Key,
        settings: jobData.settings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    try {
      await dynamodb.put(params).promise();
      return params.Item;
    } catch (error) {
      throw new Error(`DynamoDB job save failed: ${error.message}`);
    }
  }

  async updateJobStatus(jobId, status, outputKey = null) {
    const updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };

    if (outputKey) {
      updateExpression += ', outputS3Key = :outputKey';
      expressionAttributeValues[':outputKey'] = outputKey;
    }

    const params = {
      TableName: this.jobsTable,
      Key: { id: jobId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await dynamodb.update(params).promise();
      return result.Attributes;
    } catch (error) {
      throw new Error(`DynamoDB job update failed: ${error.message}`);
    }
  }

  async getJobsByUser(userId) {
    const params = {
      TableName: this.jobsTable,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    try {
      const result = await dynamodb.query(params).promise();
      return result.Items;
    } catch (error) {
      throw new Error(`DynamoDB jobs query failed: ${error.message}`);
    }
  }
}

module.exports = new DynamoDBService();
```

### Updated Storage Abstraction

**utils/storage.js** (Updated to orchestrate S3 and DynamoDB)
```javascript
const s3Service = require('./s3-service');
const dynamodbService = require('./dynamodb-service');
const { v4: uuidv4 } = require('uuid');

class CloudStorage {
  // Upload workflow with metadata storage
  async uploadVideo(buffer, originalName, contentType, userId) {
    try {
      // Upload to S3
      const s3Result = await s3Service.uploadVideo(buffer, originalName, contentType);

      // Save metadata to DynamoDB
      const videoData = {
        id: uuidv4(),
        userId: userId,
        filename: s3Result.key,
        originalName: originalName,
        s3Key: s3Result.key,
        s3Bucket: s3Result.bucket,
        fileSize: s3Result.size,
        contentType: contentType
      };

      const video = await dynamodbService.saveVideo(videoData);

      return {
        videoId: video.id,
        s3Key: s3Result.key,
        location: s3Result.location,
        metadata: video
      };
    } catch (error) {
      throw new Error(`Upload workflow failed: ${error.message}`);
    }
  }

  // Get pre-signed upload URL with metadata preparation
  async getPresignedUploadUrl(originalName, contentType, userId) {
    try {
      const { url, key } = await s3Service.generatePresignedUploadUrl(originalName, contentType);

      // Pre-create metadata record
      const videoData = {
        id: uuidv4(),
        userId: userId,
        filename: key,
        originalName: originalName,
        s3Key: key,
        s3Bucket: process.env.S3_ORIGINAL_BUCKET,
        fileSize: null, // Will be updated after upload
        contentType: contentType
      };

      const video = await dynamodbService.saveVideo(videoData);

      return {
        uploadUrl: url,
        videoId: video.id,
        s3Key: key
      };
    } catch (error) {
      throw new Error(`Pre-signed upload preparation failed: ${error.message}`);
    }
  }

  // Get download URL for processed video
  async getDownloadUrl(videoId, userId) {
    try {
      const video = await dynamodbService.getVideoById(videoId);

      if (!video || video.userId !== userId) {
        throw new Error('Video not found or access denied');
      }

      // Get processed version key (assumes job completed)
      const jobs = await dynamodbService.getJobsByUser(userId);
      const completedJob = jobs.find(job => job.videoId === videoId && job.status === 'completed');

      if (!completedJob || !completedJob.outputS3Key) {
        throw new Error('Processed video not available');
      }

      const downloadUrl = await s3Service.generatePresignedDownloadUrl(completedJob.outputS3Key);
      return downloadUrl;
    } catch (error) {
      throw new Error(`Download URL generation failed: ${error.message}`);
    }
  }
}

module.exports = new CloudStorage();
```

---

## Phase 4: Route Updates and Integration (Day 4-5)

### Updated Routes

**routes/videos.js** (Key sections to update)
```javascript
const cloudStorage = require('../utils/storage');

// Upload endpoint using pre-signed URLs
router.post('/upload-url', auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const userId = req.user.id;

    const result = await cloudStorage.getPresignedUploadUrl(filename, contentType, userId);

    res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      videoId: result.videoId,
      s3Key: result.s3Key
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's videos
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const videos = await dynamodbService.getVideosByUser(userId);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get download URL
router.get('/:id/download', auth, async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.user.id;

    const downloadUrl = await cloudStorage.getDownloadUrl(videoId, userId);
    res.json({ downloadUrl });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});
```

**routes/transcode.js** (Updated for S3 processing)
```javascript
// Create job with S3 integration
router.post('/jobs', auth, async (req, res) => {
  try {
    const { videoId, settings } = req.body;
    const userId = req.user.id;

    // Get video metadata
    const video = await dynamodbService.getVideoById(videoId);
    if (!video || video.userId !== userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Create transcode job
    const jobData = {
      id: uuidv4(),
      userId: userId,
      videoId: videoId,
      inputS3Key: video.s3Key,
      settings: settings,
      status: 'pending'
    };

    const job = await dynamodbService.saveTranscodeJob(jobData);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process job (S3 to S3)
router.post('/start/:id', auth, async (req, res) => {
  try {
    const jobId = req.params.id;

    // Update job status
    await dynamodbService.updateJobStatus(jobId, 'processing');

    // Start processing (implement S3 stream processing)
    processVideoFromS3(jobId); // Async function

    res.json({ message: 'Processing started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Phase 5: Statelessness Implementation (Day 5-6)

### Key Statelessness Requirements

1. **No Local File Storage**
   - Remove all `./uploads/` dependencies
   - Process files directly from S3 streams
   - Output directly to S3

2. **Session Management in DynamoDB**
   - Store session data in UserSessions table
   - Implement TTL for automatic cleanup

3. **FFmpeg S3 Integration**
   - Stream input from S3
   - Stream output to S3
   - No intermediate local files

### FFmpeg S3 Processing
```javascript
const ffmpeg = require('fluent-ffmpeg');

async function processVideoFromS3(jobId) {
  try {
    const job = await dynamodbService.getJobById(jobId);
    const inputStream = await s3Service.getObjectStream(job.inputS3Key);

    const outputKey = `processed-${job.id}-${Date.now()}.mp4`;

    // Create S3 upload stream
    const uploadParams = {
      Bucket: process.env.S3_PROCESSED_BUCKET,
      Key: outputKey,
      ContentType: 'video/mp4'
    };

    const passThrough = new PassThrough();
    const uploadPromise = s3Service.s3.upload({
      ...uploadParams,
      Body: passThrough
    }).promise();

    // FFmpeg processing
    ffmpeg(inputStream)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .on('start', () => {
        console.log(`Started processing job ${jobId}`);
      })
      .on('progress', async (progress) => {
        // Update job progress in DynamoDB
        await dynamodbService.updateJobProgress(jobId, progress.percent);
      })
      .on('end', async () => {
        await dynamodbService.updateJobStatus(jobId, 'completed', outputKey);
        console.log(`Completed job ${jobId}`);
      })
      .on('error', async (err) => {
        await dynamodbService.updateJobStatus(jobId, 'failed');
        console.error(`Failed job ${jobId}:`, err);
      })
      .pipe(passThrough);

    await uploadPromise;
  } catch (error) {
    console.error('Processing failed:', error);
    await dynamodbService.updateJobStatus(jobId, 'failed');
  }
}
```

### Frontend Updates for Pre-signed URLs
```javascript
// Upload using pre-signed URL
async function uploadVideo(file) {
  try {
    // Get pre-signed URL
    const response = await fetch('/videos/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type
      })
    });

    const { uploadUrl, videoId } = await response.json();

    // Upload directly to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (uploadResponse.ok) {
      console.log('Upload successful, video ID:', videoId);
      // Notify server that upload is complete
      await notifyUploadComplete(videoId);
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

---

## Phase 6: Testing and Validation (Day 6)

### Statelessness Testing Checklist

1. **Container Restart Test**
   ```bash
   # Upload video and start processing
   # Kill container: docker kill <container>
   # Restart container: docker run ...
   # Verify: jobs continue, data persists, no local files
   ```

2. **Data Integrity Validation**
   ```bash
   # Verify all video metadata in DynamoDB
   # Verify all files in S3 buckets
   # Verify no data in ./uploads/
   # Test job recovery after restart
   ```

3. **Pre-signed URL Testing**
   ```bash
   # Test upload URLs expire correctly
   # Test download URLs work for authorized users
   # Test unauthorized access fails
   ```

### Performance Testing
```javascript
// Test concurrent uploads
// Test large file handling
// Test S3 transfer speeds
// Test DynamoDB query performance
```

---

## Integration with Teammate's Cognito Work

### Coordination Points

1. **User ID Handling**
   - Your DynamoDB records use `userId` field
   - Teammate's Cognito integration must provide consistent user IDs

2. **Authentication Middleware**
   - Your routes expect `req.user.id` from auth middleware
   - Teammate updates auth middleware to work with Cognito tokens

3. **Shared DynamoDB Tables**
   - UserSessions table may be managed by Cognito integration
   - Coordinate table schemas and access patterns

### Interface Agreement
```javascript
// Expected interface from Cognito integration
req.user = {
  id: 'cognito-user-id',
  username: 'user@example.com',
  groups: ['user'] // or ['admin']
};
```

---

## Success Criteria

### Technical Validation
- [ ] All video files stored in S3 buckets
- [ ] All metadata stored in DynamoDB tables
- [ ] Pre-signed URLs working for upload/download
- [ ] No local files in ./uploads/ directory
- [ ] Application works after container restart
- [ ] FFmpeg processes S3-to-S3 without local storage

### Performance Metrics
- [ ] Upload speeds comparable to local storage
- [ ] Processing works with large video files (>100MB)
- [ ] DynamoDB queries respond in <100ms
- [ ] Pre-signed URLs generate in <50ms

### Security Validation
- [ ] S3 buckets are private (no public access)
- [ ] Pre-signed URLs expire correctly
- [ ] Users can only access their own videos
- [ ] No sensitive data in logs or error messages

---

## Risk Mitigation

### High Risk Items
1. **Large File Upload/Download**
   - **Risk**: S3 transfer timeouts, memory issues
   - **Mitigation**: Implement multipart uploads, streaming
   - **Fallback**: File size limits, chunked transfers

2. **DynamoDB Query Costs**
   - **Risk**: Expensive scan operations
   - **Mitigation**: Use GSI for user queries, pagination
   - **Fallback**: Query optimization, caching

3. **FFmpeg S3 Integration**
   - **Risk**: Streaming processing complexity
   - **Mitigation**: Thoroughly test with various file types
   - **Fallback**: Temporary local processing with cleanup

### Medium Risk Items
1. **AWS Service Limits**
   - **Risk**: Hitting service quotas during development
   - **Mitigation**: Monitor usage, implement exponential backoff
   - **Fallback**: Request limit increases

2. **Concurrent Processing**
   - **Risk**: Multiple jobs overwhelming resources
   - **Mitigation**: Job queuing, rate limiting
   - **Fallback**: Sequential processing

---

## Next Steps After Core Implementation

Once your 4 core tasks are complete (11 points), consider these additional features:

1. **ElastiCache (3 points)** - Cache DynamoDB metadata queries
2. **Cognito User Groups (2 points)** - If teammate hasn't implemented
3. **Parameter Store (2 points)** - Move configuration to AWS
4. **Additional Persistence Service (3 points)** - RDS for advanced querying

**Priority**: Focus on completing your core 4 tasks first, then evaluate time for additional features.

---

## Files to Create/Modify

### New Files
- `utils/aws-config.js`
- `utils/s3-service.js`
- `utils/dynamodb-service.js`

### Files to Update
- `utils/storage.js` - Cloud integration
- `utils/database.js` - DynamoDB migration
- `routes/videos.js` - Pre-signed URL endpoints
- `routes/transcode.js` - S3 processing integration
- `public/app.js` - Frontend upload logic
- `package.json` - Add AWS SDK dependency

### Configuration
- Update `.env` with AWS settings
- Remove SQLite dependencies
- Add AWS IAM permissions for EC2 instance

This comprehensive plan provides a structured approach to implementing your integrated S3 + DynamoDB + Pre-signed URLs + Statelessness system. The modular design allows for parallel development with your teammate while maintaining clean interfaces and architectural coherence.