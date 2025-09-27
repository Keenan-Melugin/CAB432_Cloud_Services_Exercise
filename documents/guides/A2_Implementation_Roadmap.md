# CAB432 Assignment 2 - Implementation Roadmap & Priorities

## Executive Summary

This roadmap provides a structured approach to transforming the current Video Transcoding Service into a comprehensive cloud services application. The plan prioritizes core requirements first, followed by enhanced features that maximize assignment marks.

---

## Priority Matrix - Strategy A (Corrected Points)

### **🔴 Core Requirements (Must Complete) - 14 Points**
These features are mandatory for assignment completion:

| Feature | Points | Effort | Dependencies | Timeline |
|---------|--------|--------|--------------|----------|
| **Data Persistence: S3** | 3 | Medium | AWS Account Setup | Day 3 |
| **Data Persistence: DynamoDB** | 3 | Medium | S3 Complete | Day 4 |
| **Cognito Authentication** | 3 | Medium | DynamoDB Complete | Day 5 |
| **Statelessness** | 3 | Low | S3 + DynamoDB | Days 3-6 |
| **Route53 DNS** | 2 | Low | None | Day 8 |

### **🟢 Enhanced Features - Strategy A Selection (18 points)**
Optimized for maximum efficiency with existing codebase:

| Feature | Points | Effort | Current Advantage | Priority |
|---------|--------|--------|-------------------|----------|
| **Graceful Persistent Connections** | 2 | **Very Low** | **90% Done - SSE exists!** ✅ | Day 1 |
| **Cognito User Groups** | 2 | **Very Low** | **Admin/user roles exist!** ✅ | Day 2 |
| **S3 Pre-signed URLs** | 2 | **Low** | **S3 abstraction ready!** ✅ | Day 7 |
| **Parameter Store** | 2 | Low | Have config to migrate | Day 6 |
| **Secrets Manager** | 2 | Low | Have secrets to migrate | Day 6 |
| **In-memory Caching** | 3 | Medium | Good caching opportunities | Days 7-8 |
| **Additional Persistence Service** | 3 | Medium | RDS for video analytics | Day 8 |

**Total: 18 points (exceeds 16-point requirement)**

### **🔵 Features NOT Selected (Reasons)**

| Feature | Points | Why Not Selected |
|---------|--------|------------------|
| **Infrastructure as Code** | 3 | High effort, low current advantage |
| **Identity: MFA** | 2 | Medium effort, not critical path |
| **Identity: Federated** | 2 | High complexity, limited benefit |
| **Upon Request** | 3-6 | Requires coordinator approval |

---

## 8-Day Implementation Plan - Strategy A

### **Days 1-2: AWS Setup + Immediate Wins (6 points)**

#### **Day 1: AWS Infrastructure + Graceful Connections (2 points)**
**Morning: AWS Account Setup**
- [ ] **AWS Infrastructure Setup**
  - Set up QUT AWS access and configure CLI
  - Create S3 buckets: `n[student-number]-videotranscoder-original`, `n[student-number]-videotranscoder-processed`
  - Create DynamoDB tables: Videos, TranscodeJobs, UserSessions
  - Set up Cognito User Pool with 'admin' and 'user' groups
  - Create Route53 hosted zone for custom domain

**Afternoon: Graceful Persistent Connections (2 points) - EASIEST WIN!**
- [ ] **Enhance Existing SSE Implementation**
  ```javascript
  // Already have in routes/transcode.js:274-323:
  ✅ SSE endpoint with authentication
  ✅ Connection storage (sseConnections Map)
  ✅ Real-time job updates
  ✅ Connection cleanup

  // Add (1-2 hours work):
  - Heartbeat mechanism every 30 seconds
  - Client reconnection logic in public/app.js
  - Connection health monitoring
  - Graceful error handling for lost connections
  ```

#### **Day 2: Cognito User Groups (2 points) - SECOND EASIEST!**
- [ ] **Map Existing Roles to Cognito Groups**
  ```javascript
  // Already have in utils/auth.js:
  ✅ requireAdmin middleware
  ✅ Role checking logic
  ✅ User roles in database

  // Migrate (4-6 hours work):
  - Create Cognito groups: 'admin', 'user'
  - Update requireAdmin to check Cognito groups
  - Migrate existing users with correct group membership
  - Test role-based access control
  ```

### **Days 3-4: Core Data Migration (6 points)**

#### **Day 3: S3 Integration (3 points)**
- [ ] **Storage Layer Migration**
  ```javascript
  // Build on existing utils/storage.js:
  ✅ Storage abstraction already exists
  ✅ Upload/download methods defined

  // Implement S3 (6-8 hours):
  - Replace local filesystem with S3 SDK
  - Implement multipart uploads for large files
  - Add retry logic and error handling
  - Test with existing video files
  - Update all file references in routes
  ```

#### **Day 4: DynamoDB Migration (3 points)**
- [ ] **Database Migration**
  ```javascript
  // Replace SQLite with DynamoDB:
  - Videos table: PK=id, GSI=userId
  - TranscodeJobs table: PK=id, GSI=userId, GSI=status
  - UserSessions table: PK=sessionId, TTL enabled

  // Update utils/database.js:
  - Replace SQLite operations with DynamoDB
  - Implement pagination for large datasets
  - Add proper error handling
  - Migrate existing data
  ```

### **Days 5-6: Authentication + Configuration (7 points)**

#### **Day 5: Cognito Authentication (3 points)**
- [ ] **Complete Auth Migration**
  ```javascript
  // Core requirements:
  - User registration with email confirmation
  - Login with username/password → JWT
  - Integration with existing user functionality

  // Implementation:
  - Configure Cognito User Pool settings
  - Update frontend to use Cognito SDK
  - Replace routes/auth.js with Cognito calls
  - Test complete auth flow
  ```

#### **Day 6: Quick Configuration (4 points)**
**Morning: Parameter Store (2 points)**
- [ ] **Configuration Migration**
  ```javascript
  // Move to Parameter Store:
  /videotranscoder/port → process.env.PORT
  /videotranscoder/api/base_url → API endpoints
  /videotranscoder/ffmpeg/threads → FFmpeg settings
  /videotranscoder/upload/max_size → File size limits
  ```

**Afternoon: Secrets Manager (2 points)**
- [ ] **Secure Credential Storage**
  ```javascript
  // Move to Secrets Manager:
  videotranscoder/jwt-secret → JWT_SECRET
  videotranscoder/cognito-config → Cognito credentials
  videotranscoder/aws-keys → AWS access keys (if needed)
  ```

### **Days 7-8: Advanced Features (5 points)**

#### **Day 7: S3 Pre-signed URLs + Cache Setup (5 points)**
**Morning: S3 Pre-signed URLs (2 points)**
- [ ] **Direct Upload/Download Implementation**
  ```javascript
  // Extend existing utils/storage.js:
  ✅ S3 service already configured

  // Add methods (3-4 hours):
  - generatePresignedUploadUrl(filename, contentType)
  - generatePresignedDownloadUrl(key, expires)
  - Update frontend for direct uploads
  - Add progress tracking for uploads
  ```

**Afternoon: ElastiCache Setup (3 points)**
- [ ] **Redis Cache Implementation**
  ```javascript
  // Set up ElastiCache Redis cluster
  - Create cache service abstraction
  - Plan cache integration points:
    * Video metadata from routes/videos.js:96-124
    * Job status from routes/transcode.js:182-203
    * User session data
  ```

#### **Day 8: Finalize + Bonus Features (3+ points)**
**Morning: Complete Caching (3 points)**
- [ ] **Implement Cache Integration**
  ```javascript
  // Cache Strategy:
  - Video metadata: 1 hour TTL
  - Job status: 5 minute TTL
  - User sessions: 24 hour TTL
  - Performance metrics tracking
  ```

**Afternoon: Additional Service (3 points) + DNS (2 points)**
- [ ] **RDS for Analytics (Bonus)**
  - Quick RDS setup for video search/analytics
  - Migrate complex query functionality

- [ ] **Route53 DNS Configuration**
  - Set up `videotranscoder.cab432.com` CNAME
  - Point to EC2 instance
  - Test domain access

### **Ongoing: Statelessness Validation (3 points)**
- [ ] **Integrated Throughout Days 3-6**
  - Process videos directly from S3 (Day 3)
  - Store all state in DynamoDB (Day 4)
  - Validate application restart scenarios (Day 6)
  - No local file dependencies (Day 7)

---

## Risk Management

### **High Risk Items**
1. **DynamoDB Migration Complexity**
   - **Mitigation**: Start early, implement data validation
   - **Fallback**: Keep SQLite as backup during transition

2. **Cognito Authentication Integration**
   - **Mitigation**: Use feature flags for gradual rollout
   - **Fallback**: Maintain JWT as backup during transition

3. **S3 Large File Handling**
   - **Mitigation**: Test with various file sizes early
   - **Fallback**: Implement file size limits

### **Medium Risk Items**
1. **ElastiCache Setup Complexity**
   - **Mitigation**: Use AWS documentation and examples
   - **Fallback**: Simple in-memory caching if needed

2. **Infrastructure as Code Learning Curve**
   - **Mitigation**: Start with simple templates
   - **Fallback**: Manual resource creation

### **Timeline Risks**
1. **AWS Account Setup Delays**
   - **Mitigation**: Start immediately, have backup account

2. **Feature Scope Creep**
   - **Mitigation**: Strict priority adherence, time-box features

---

## Success Metrics - Strategy A

### **Core Requirements (14 points - Must Achieve 100%)**
- [ ] **S3 Storage (3 pts)**: All video uploads/downloads work via S3
- [ ] **DynamoDB (3 pts)**: All metadata stored in DynamoDB (no SQLite)
- [ ] **Cognito Auth (3 pts)**: User registration, email confirmation, JWT login
- [ ] **Statelessness (3 pts)**: Application works after container restart
- [ ] **Route53 DNS (2 pts)**: Application accessible via custom domain

### **Enhanced Features (Target: 18 points)**
- [ ] **Graceful Connections (2 pts)**: SSE reconnection and heartbeat working
- [ ] **Cognito Groups (2 pts)**: Admin/user role-based access control
- [ ] **S3 Pre-signed URLs (2 pts)**: Direct client upload/download working
- [ ] **Parameter Store (2 pts)**: Configuration loaded from Parameter Store
- [ ] **Secrets Manager (2 pts)**: Sensitive data stored securely
- [ ] **ElastiCache (3 pts)**: Redis caching improving response times >30%
- [ ] **Additional Service (3 pts)**: RDS for video analytics functionality

**Total Target: 32 points (14 core + 18 enhanced)**

### **Quality Metrics**
- [ ] Application loads in <3 seconds
- [ ] Video transcoding success rate >95%
- [ ] Authentication response time <1 second
- [ ] Cache hit ratio >70% for video metadata
- [ ] No data loss during migration
- [ ] Zero downtime during AWS service integration

---

## Resource Requirements

### **AWS Services Costs (Estimated Monthly)**
- **S3**: $10-20 (depending on video storage)
- **DynamoDB**: $5-15 (on-demand pricing)
- **ElastiCache**: $15-30 (t3.micro instances)
- **Cognito**: $0-5 (first 50,000 MAU free)
- **Route53**: $0.50 per hosted zone
- **Parameter Store**: Free tier
- **Secrets Manager**: $0.40 per secret per month

**Total Estimated Cost**: $30-70/month

### **Development Tools**
- AWS CLI
- AWS SDK for JavaScript
- CloudFormation/CDK (if using IaC)
- Postman/Hoppscotch for API testing

---

## Final Checklist Before Submission

### **Technical Verification**
- [ ] All AWS services deployed and working
- [ ] Application accessible via custom domain
- [ ] Load testing completed successfully
- [ ] Security testing passed
- [ ] Backup and recovery procedures tested

### **Documentation**
- [ ] A2_response_Criteria.md completed
- [ ] All code commented and clean
- [ ] README updated with new architecture
- [ ] API documentation current
- [ ] Deployment guide updated

### **Demonstration Video**
- [ ] Shows all implemented features
- [ ] Demonstrates AWS integrations
- [ ] Includes performance metrics
- [ ] Shows failure handling
- [ ] Clear audio and visual quality

## Strategy A Summary

### **Why This Strategy Wins**
1. **Leverages Existing Code**: 90% of graceful connections already implemented
2. **Quick Wins First**: 6 points in first 2 days builds momentum
3. **Realistic Timeline**: 8 days vs original 5-week plan
4. **Low Risk**: Builds on working features, multiple safety nets
5. **Exceeds Requirements**: 18 points vs 16 required

### **Key Advantages**
- **SSE Implementation**: Already have routes/transcode.js:274-323 ✅
- **Role System**: Already have admin/user roles in utils/auth.js ✅
- **S3 Abstraction**: Already have utils/storage.js ready ✅
- **Configuration**: Already have environment variables to migrate ✅

### **Daily Progress Tracking**
```
Day 1: 2 points (Graceful connections)     → Total: 2
Day 2: 2 points (Cognito groups)          → Total: 4
Day 3: 3 points (S3 storage)              → Total: 7
Day 4: 3 points (DynamoDB)                → Total: 10
Day 5: 3 points (Cognito auth)            → Total: 13
Day 6: 4 points (Config management)       → Total: 17
Day 7: 2 points (Pre-signed URLs)         → Total: 19
Day 8: 3+ points (Caching + bonus)        → Total: 22+
```

**Result: 32 total points (14 core + 18 enhanced) achieved in 8 days**

This roadmap provides a structured, low-risk path to assignment success while maximizing the value of your existing excellent codebase.