# CAB432 Assignment 2 - Cloud Services Development Guide

## Overview

This guide provides a comprehensive roadmap for transforming the current **Video Transcoding Service** (Assignment 1 project) into a full-featured cloud services application that meets all Assignment 2 criteria. The current project provides an excellent foundation with its video transcoding capabilities, RESTful API, and containerized architecture.

## Current Project Analysis

### ✅ **Existing Strengths**
- **Solid Foundation**: Node.js + Express.js architecture
- **Video Processing**: FFmpeg-based transcoding pipeline
- **API Design**: Well-structured RESTful endpoints
- **Authentication**: JWT-based auth (needs migration to Cognito)
- **Containerization**: Docker-ready with health checks
- **Real-time Features**: Server-Sent Events for progress tracking
- **Database**: SQLite (needs migration to cloud services)
- **File Storage**: Local filesystem with S3 abstraction layer

### 🔄 **Required Transformations**
- Migrate from local SQLite to multiple AWS data services
- Replace JWT auth with AWS Cognito
- Implement S3 for file storage with pre-signed URLs
- Add ElastiCache for performance optimization
- Ensure stateless architecture
- Add Route53 DNS configuration
- Implement secure configuration management

---

## Assignment 2 Criteria Mapping

### **Core Requirements (Must Complete All) - 14 Points**

#### 1. **Data Persistence Services (6 points)**
**First Service: S3 (3 points)**
- **Purpose**: Store original and transcoded video files
- **Why S3**: Large video files require blob storage; S3 provides scalable, durable storage
- **Implementation**: Migrate `utils/storage.js` from local filesystem to S3

**Second Service: DynamoDB (3 points)**
- **Purpose**: Store video metadata, transcoding jobs, user sessions
- **Why DynamoDB**: Fast NoSQL queries for real-time job status, scales automatically
- **Implementation**: Replace SQLite tables with DynamoDB tables

#### 2. **Authentication with Cognito (3 points)**
- **Requirements**: User registration, email confirmation, login with JWT
- **Implementation**: Create Cognito User Pool, migrate existing users
- **Integration**: Update frontend to use Cognito SDK

#### 3. **Statelessness (3 points)**
- **Current Issue**: Local file processing creates temporary state
- **Solution**: Process files directly from S3, store all state in DynamoDB
- **Validation**: Application works after container restart

#### 4. **DNS with Route53 (2 points)**
- **Purpose**: Custom subdomain preparation for Assignment 3 HTTPS
- **Implementation**: Configure `videotranscoder.cab432.com` CNAME to EC2

### **Enhanced Features (Target: 18 points from Strategy A)**

#### **🟢 Easy Wins - Already Mostly Done (6 points, 2 days)**

**1. Graceful Handling of Persistent Connections (2 points)**
- **Current Advantage**: SSE already implemented in `routes/transcode.js:274-323` ✅
- **Enhancement**: Add reconnection logic and heartbeat monitoring
- **Evidence**: Connection recovery demonstrations

**2. Cognito User Groups (2 points)**
- **Current Advantage**: Admin/user roles already implemented ✅
- **Enhancement**: Map existing `requireAdmin` middleware to Cognito groups
- **Evidence**: Role-based access control working

**3. S3 Pre-signed URLs (2 points)**
- **Current Advantage**: S3 abstraction layer ready in `utils/storage.js` ✅
- **Enhancement**: Add presigned URL generation methods
- **Evidence**: Direct client upload/download functionality

#### **🟡 Quick Configuration (4 points, 2 days)**

**4. Parameter Store (2 points)**
- **Purpose**: Move configuration from environment variables
- **Implementation**: Store API endpoints, FFmpeg settings, application URLs
- **Evidence**: Configuration loaded from Parameter Store

**5. Secrets Manager (2 points)**
- **Purpose**: Secure storage of sensitive data
- **Implementation**: Move JWT_SECRET, database credentials
- **Evidence**: Secure credential management working

#### **🔴 Medium Effort, High Value (8 points, 4 days)**

**6. In-memory Caching: ElastiCache (3 points)**
- **Cache Strategy**: Video metadata (1hr TTL), job status (5min TTL), user sessions (24hr TTL)
- **Implementation**: Redis cluster for performance optimization
- **Evidence**: Performance improvements, cache hit ratio metrics

**7. Additional Persistence Service (3 points)**
- **Service**: RDS for complex video metadata queries
- **Justification**: Advanced search/filtering requires SQL capabilities
- **Implementation**: Migrate video analytics and search data to RDS

**8. Upon Request (2 points - if time permits)**
- **Option**: Advanced video analytics dashboard
- **Requires**: Coordinator approval before implementation

---

## Development Roadmap - Strategy A (8 Days to 18 Points)

### **Week 1: Core Infrastructure + Easy Wins (Days 1-4)**

#### Days 1-2: Core AWS Setup + Easy Wins (6 points)
**Day 1: AWS Infrastructure Setup**
```bash
# Create core AWS resources
- S3 buckets for video storage
- DynamoDB tables (Videos, TranscodeJobs, UserSessions)
- Cognito User Pool with groups
- Route53 hosted zone
```

**Day 1 Evening: Graceful Persistent Connections (2 points) - EASIEST WIN!**
- [ ] **Enhance Existing SSE Implementation**
  - Add heartbeat mechanism to existing `routes/transcode.js:274-323`
  - Improve reconnection logic in `public/app.js`
  - Add connection health monitoring
  - **Already 90% implemented!** ✅

**Day 2: Cognito User Groups (2 points) - SECOND EASIEST!**
- [ ] **Map Existing Roles to Cognito**
  - Create 'admin' and 'user' groups in Cognito User Pool
  - Update existing `requireAdmin` middleware in `utils/auth.js`
  - Migrate existing users with correct group membership
  - **Leverage existing role logic!** ✅

#### Days 3-4: Data Migration (6 points)
**Day 3: S3 Integration (3 points)**
- [ ] **Migrate Storage Layer**
  - Update `utils/storage.js` to use AWS S3 SDK
  - Implement multipart uploads for large files
  - Test with existing video files
  - **Build on existing abstraction!** ✅

**Day 4: DynamoDB Migration (3 points)**
- [ ] **Database Migration**
  - Create DynamoDB table schemas
  - Migrate data from SQLite tables
  - Update all database queries in `utils/database.js`
  - Test data integrity and queries

### **Week 2: Authentication + Configuration (Days 5-6)**

#### Days 5-6: Cognito + Quick Config (7 points)
**Day 5: Cognito Authentication (3 points)**
- [ ] **Auth System Migration**
  - Configure Cognito User Pool settings
  - Implement user registration with email confirmation
  - Update frontend to use Cognito SDK
  - Test login/logout flows with JWT tokens

**Day 6 Morning: Parameter Store (2 points)**
- [ ] **Configuration Migration**
```javascript
// Move to Parameter Store:
- /videotranscoder/port → PORT
- /videotranscoder/api/base_url → API endpoints
- /videotranscoder/ffmpeg/threads → FFmpeg settings
```

**Day 6 Afternoon: Secrets Manager (2 points)**
- [ ] **Secure Credential Storage**
```javascript
// Move to Secrets Manager:
- videotranscoder/jwt-secret → JWT_SECRET
- videotranscoder/db-creds → Database credentials
```

### **Week 2: Advanced Features (Days 7-8)**

#### Day 7: S3 Pre-signed URLs + Cache Setup (5 points)
**Day 7 Morning: S3 Pre-signed URLs (2 points)**
- [ ] **Direct Upload/Download**
  - Add presigned URL methods to existing `utils/storage.js`
  - Implement direct client uploads in frontend
  - Add download URL generation for processed videos
  - **Extend existing S3 code!** ✅

**Day 7 Afternoon: ElastiCache Setup (3 points)**
- [ ] **Redis Cache Implementation**
  - Set up ElastiCache Redis cluster
  - Create caching service abstraction
  - Begin cache integration planning

#### Day 8: Complete Enhanced Features (3 points)
**Day 8: Finalize Caching + Additional Service (3 points)**
- [ ] **Complete ElastiCache (3 points)**
```javascript
// Cache Strategy:
- Video metadata: Cache results from routes/videos.js:96-124
- Job status: Cache for real-time polling optimization
- User sessions: Store Cognito session data
- Performance metrics: Track cache hit ratios
```

**Day 8 Bonus: Additional Persistence Service (3 points)**
- [ ] **RDS for Analytics (if time permits)**
  - Quick RDS setup for video analytics
  - Migrate search/filter functionality
  - Implement complex query capabilities

### **Final Tasks: Statelessness + DNS (Ongoing)**

#### Statelessness Implementation (3 points) - Integrated throughout
- [ ] **Eliminate Local State**
  - Process videos directly from S3 streams (Day 3-4)
  - Store all job state in DynamoDB (Day 4)
  - Validate application restart scenarios (Day 6)

#### DNS with Route53 (2 points) - Final step
- [ ] **Domain Configuration**
  - Set up `videotranscoder.cab432.com` CNAME
  - Point to EC2 instance
  - Test domain access (Day 8)

---

## Technical Implementation Details

### **File Structure Updates**

```
CAB432_Video_Transcoder/
├── lib/
│   ├── aws/
│   │   ├── s3.js              # S3 operations
│   │   ├── dynamodb.js        # DynamoDB operations
│   │   ├── cognito.js         # Cognito authentication
│   │   ├── elasticache.js     # Redis caching
│   │   └── config.js          # AWS configuration
│   └── services/
│       ├── video-service.js   # Video processing logic
│       ├── auth-service.js    # Authentication service
│       └── cache-service.js   # Caching abstraction
├── infrastructure/
│   ├── cloudformation/        # CloudFormation templates
│   └── cdk/                   # CDK stack definitions
└── documentation/
    ├── architecture.md        # System architecture
    └── api-documentation.md   # API reference
```

### **Key Code Changes**

#### S3 Integration Example
```javascript
// lib/aws/s3.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

class S3Service {
  async uploadVideo(buffer, key, metadata) {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: metadata.contentType,
      Metadata: metadata
    };
    return await s3.upload(params).promise();
  }

  async generatePresignedUrl(key, expires = 3600) {
    return s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Expires: expires
    });
  }
}
```

#### DynamoDB Integration Example
```javascript
// lib/aws/dynamodb.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

class DynamoDBService {
  async saveTranscodeJob(job) {
    const params = {
      TableName: 'TranscodeJobs',
      Item: {
        id: job.id,
        userId: job.userId,
        status: job.status,
        createdAt: new Date().toISOString(),
        // ... other job properties
      }
    };
    return await dynamodb.put(params).promise();
  }

  async getJobsByUser(userId) {
    const params = {
      TableName: 'TranscodeJobs',
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };
    return await dynamodb.query(params).promise();
  }
}
```

#### Cognito Integration Example
```javascript
// lib/aws/cognito.js
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');

class CognitoService {
  constructor() {
    this.userPool = new AmazonCognitoIdentity.CognitoUserPool({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      ClientId: process.env.COGNITO_CLIENT_ID
    });
  }

  async authenticateUser(username, password) {
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
      Username: username,
      Password: password
    });

    const userData = {
      Username: username,
      Pool: this.userPool
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err)
      });
    });
  }
}
```

---

## Success Criteria Checklist

### **Core Requirements (Must Complete)**
- [ ] **First Data Service**: S3 for video file storage
- [ ] **Second Data Service**: DynamoDB for metadata and jobs
- [ ] **Third Data Service**: ElastiCache for performance optimization
- [ ] **Cognito Authentication**: Replace JWT with Cognito
- [ ] **Route53 DNS**: Custom domain configuration
- [ ] **Statelessness**: No persistent local state

### **Enhanced Features (Choose 3+)**
- [ ] **S3 Pre-signed URLs**: Secure direct file access
- [ ] **ElastiCache Implementation**: Redis-based caching
- [ ] **Persistent Connections**: Improved SSE handling
- [ ] **Cognito MFA**: Multi-factor authentication
- [ ] **Cognito Federated**: Social login integration
- [ ] **Cognito Groups**: Role-based permissions
- [ ] **Parameter Store**: Configuration management
- [ ] **Secrets Manager**: Secure credential storage
- [ ] **Infrastructure as Code**: Automated deployment

---

## Risk Mitigation

### **Technical Risks**
1. **Large File Handling**: Test S3 multipart uploads thoroughly
2. **DynamoDB Costs**: Implement efficient querying and pagination
3. **Authentication Migration**: Maintain user sessions during transition
4. **Performance**: Monitor cache hit ratios and optimize

### **Timeline Risks**
1. **AWS Setup Delays**: Start with AWS account setup immediately
2. **Migration Complexity**: Implement feature flags for gradual rollout
3. **Testing Time**: Allocate 25% of time for testing and debugging

---

## Conclusion

This project transformation will showcase advanced cloud computing concepts while building upon the solid foundation of the existing video transcoding service. The modular approach allows for incremental development and testing, reducing risk while ensuring all assignment criteria are met.

**Key Success Factors:**
1. Start with core AWS services setup
2. Maintain working application throughout development
3. Test each component thoroughly before integration
4. Document all architectural decisions and trade-offs
5. Plan for demonstration and video recording early

The resulting application will demonstrate enterprise-level cloud architecture patterns and serve as an excellent portfolio piece for cloud development skills.