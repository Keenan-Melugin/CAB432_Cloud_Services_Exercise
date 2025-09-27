# CAB432 Assignment 2 - Cloud Services Exercises
## Criteria Implementation Status

**Project**: Video Transcoding Service
**Student**: n10992511
**Domain**: mytranscoder.cab432.com
**Last Updated**: September 27, 2025

---

## Core Criteria (14/14 marks) ✅

### ✅ Data Persistence Services (6 marks)
**Status**: COMPLETED
**Implementation**:
- **S3 Object Storage (3 marks)**:
  - Original videos: `n10992511-videotranscoder-original`
  - Processed videos: `n10992511-videotranscoder-processed`
  - Pre-signed URLs for secure client upload/download
  - No public bucket access (as required)
- **DynamoDB NoSQL (3 marks)**:
  - `videotranscoder-users` - User authentication data
  - `videotranscoder-videos` - Video metadata
  - `videotranscoder-transcode-jobs` - Job tracking
  - Fully stateless operation

### ✅ Authentication with Cognito (3 marks)
**Status**: COMPLETED
**Implementation**:
- ✅ User registration with username, email, password
- ✅ Email-based confirmation of registration
- ✅ User login returning JWT tokens
- ✅ Integrated with existing user functionality
- ✅ Automatic user sync between Cognito and DynamoDB
- **Evidence**: Application logs show successful Cognito token verification

### ✅ Statelessness (3 marks)
**Status**: COMPLETED
**Implementation**:
- ✅ All persistent data stored in cloud services (S3 + DynamoDB)
- ✅ No local database dependencies (PostgreSQL completely removed)
- ✅ Application tolerates connection loss
- ✅ State remains consistent if application restarts
- ✅ Progress tracking via polling (graceful handling)
- **Migration**: Successfully migrated from PostgreSQL to DynamoDB

### ✅ DNS with Route53 (2 marks)
**Status**: COMPLETED
**Implementation**:
- ✅ Subdomain configured: `mytranscoder.cab432.com`
- ✅ CNAME points to EC2 instance: `ec2-3-106-226-221.ap-southeast-2.compute.amazonaws.com`
- ✅ HTTP access verified: `curl http://mytranscoder.cab432.com:3000/health` returns 200 OK
- ✅ Prepared for Assessment 3 HTTPS implementation

---

## Additional Criteria (8/16 marks) ✅

### ✅ Parameter Store (2 marks)
**Status**: FULLY IMPLEMENTED
**Implementation**:
- Comprehensive Parameter Store service (`utils/parameter-store.js`)
- **Parameters stored**:
  - `app/base_url` - Application URL configuration
  - `s3/original_bucket` & `s3/processed_bucket` - S3 bucket names
  - `dynamodb/table_prefix` - DynamoDB table configuration
  - `transcoding/default_quality` & `transcoding/supported_formats` - App config
- **Usage**: DynamoDB and S3 configurations loaded from Parameter Store with environment fallbacks
- **Evidence**: Logs confirm "DynamoDB table configuration loaded from Parameter Store"

### ✅ Secrets Manager (2 marks)
**Status**: FULLY IMPLEMENTED
**Implementation**:
- Complete Secrets Manager service (`utils/secrets-manager.js`) with caching
- **Secrets stored**: Cognito configuration in `n10992511-cognito-config`
  - `clientId`, `clientSecret`, `userPoolId`, `region`
- **Features**: Automatic caching, error handling, environment fallbacks
- **Evidence**: Logs confirm "🔑 Cognito secrets loaded from Secrets Manager"

### ✅ S3 Pre-signed URLs (2 marks)
**Status**: FULLY IMPLEMENTED
**Implementation**:
- Direct client upload via pre-signed POST URLs
- Direct client download via pre-signed GET URLs
- No public bucket access (secure implementation)
- **Evidence**: Logs show "Generated presigned upload URL" for client uploads

### ✅ Identity Management: User Groups (2 marks)
**Status**: FULLY IMPLEMENTED ✅
**Implementation**:
- **Cognito Groups Created**: `admin` (precedence 1), `user` (precedence 2), `ap-southeast-2_NxyJMYl5Z_Google` (federated)
- **User Assignment**: Test users created and assigned to appropriate groups
- **Middleware Implementation**: `requireGroups()` function in `utils/auth.js:84-110`
- **Admin Protection**: `requireAdmin` middleware in `utils/auth.js:113-114`
- **JWT Integration**: Reads `cognito:groups` from tokens in `utils/auth.js:60`
- **Protected Endpoints**:
  - `/auth/admin-test` - Admin-only test endpoint
  - `/transcode/stats` - System statistics (admin only)
- **Role-based Database Access**: Admin users see all data, regular users see only their own
- **Evidence**:
  - Cognito Console shows groups with users assigned
  - Login returns JWT tokens with group claims
  - Unauthorized access returns 401/403 errors
  - Code implementation verified in `utils/auth.js` and route handlers

---

## Remaining Opportunities (8 marks available)

### Infrastructure as Code (3 marks)
**Status**: NOT IMPLEMENTED
**Opportunity**: Deploy AWS services (DynamoDB, S3, Cognito, Route53) via Terraform/CDK/CloudFormation

### In-memory Caching (3 marks)
**Status**: NOT IMPLEMENTED
**Opportunity**: Implement ElastiCache with memcached for database queries or API responses

### Identity Management: MFA (2 marks)
**Status**: NOT IMPLEMENTED
**Opportunity**: Multi-factor authentication via Cognito (SMS, TOTP, Email)

### Identity Management: Federated Identities (2 marks)
**Status**: NOT IMPLEMENTED
**Opportunity**: Google/Facebook login integration via Cognito

### Additional Persistence Service (3 marks)
**Status**: NOT APPLICABLE
**Reason**: Already using 2 distinct services (S3 + DynamoDB) as required

---

## Technical Implementation Details

### Architecture
- **Deployment**: Docker containers on EC2
- **Database**: DynamoDB (migrated from PostgreSQL for full statelessness)
- **Storage**: S3 with pre-signed URLs
- **Authentication**: AWS Cognito with JWT
- **DNS**: Route53 with custom domain
- **Configuration**: Parameter Store + Secrets Manager

### Key Services Used
- **Core AWS Services**: EC2, S3, DynamoDB, Cognito, Route53
- **Configuration**: Parameter Store, Secrets Manager
- **Deployment**: Docker, Docker Compose

### Application Features
- Video upload and transcoding
- Real-time progress tracking
- User authentication and authorization
- Role-based access control (admin/user)
- Cloud-native stateless design

---

## Current Score: 22/30 marks

**Breakdown**:
- Core Criteria: 14/14 marks ✅
- Additional Criteria: 8/16 marks ✅

**Next Steps**: Consider implementing Infrastructure as Code (3 marks) or In-memory Caching (3 marks) to maximize score.