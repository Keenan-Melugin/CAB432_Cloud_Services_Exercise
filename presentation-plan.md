# CAB432 Assignment 2 - Presentation Plan
## Infrastructure as Code Implementation

**Student:** n10992511
**Application:** Video Transcoding Service
**Domain:** mytranscoder.cab432.com
**Infrastructure:** Terraform-managed AWS services

---

## Core Requirements Demonstration Strategy

### 1. Core - First Data Persistence Service (S3)
**Service:** Amazon S3
**Implementation:** Two buckets for video file storage

**Demonstration Method:**
- **AWS Console:** Show both S3 buckets created via Terraform
  - `n10992511-videotranscoder-original` (source videos)
  - `n10992511-videotranscoder-processed` (transcoded outputs)
- **Functional Demo:** Upload video → show file in original bucket → trigger transcoding → show result in processed bucket
- **Code Reference:** `terraform/main.tf` lines 25-35 (S3 bucket definitions)

**Key Points to Highlight:**
- Large video files require blob storage (no size restrictions)
- Automatic encryption enabled (AES256)
- Versioning enabled for data protection
- Integration with application upload/download functionality

---

### 2. Core - Second Data Persistence Service (DynamoDB)
**Service:** Amazon DynamoDB
**Implementation:** Three tables for structured data

**Demonstration Method:**
- **AWS Console:** Show DynamoDB tables with sample data
  - `videotranscoder-users` (user profiles)
  - `videotranscoder-videos` (video metadata with UserIdIndex GSI)
  - `videotranscoder-transcode-jobs` (job status with UserIdIndex and StatusIndex GSIs)
- **Functional Demo:** User registration → show user record → video upload → show metadata → transcoding job → show job status
- **Code Reference:** `terraform/main.tf` lines 72-160 (DynamoDB table definitions)

**Key Points to Highlight:**
- Fast NoSQL queries for user sessions and video listings
- Global Secondary Indexes for efficient querying by user_id and status
- Provisioned capacity for predictable performance
- Why DynamoDB over RDS (simpler schema, better scalability for this use case)

---

### 3. Core - Statelessness
**Implementation:** All persistent data stored in AWS services

**Demonstration Method:**
- **Code Walkthrough:** Show application doesn't store files locally
- **Process Demo:** Restart application → all data persists → no local state lost
- **Architecture Explanation:** Temporary files in `/tmp` only, all persistent data in S3/DynamoDB

**Key Points to Highlight:**
- No local file storage for videos (all S3)
- No local database (all DynamoDB)
- Session state managed via JWT tokens
- Temporary processing files are recreatable from source

---

### 4. Core - Authentication with Cognito
**Service:** Amazon Cognito User Pool
**Implementation:** JWT-based authentication system

**Demonstration Method:**
- **AWS Console:** Show Cognito User Pool `n10992511-videotranscoder`
- **Functional Demo:** User registration → email verification → login → JWT token → authenticated API calls
- **Code Reference:** `terraform/main.tf` lines 163-230 (Cognito configuration)
- **Application Code:** JWT handling in `index.js`

**Key Points to Highlight:**
- Secure password policy (8 chars, mixed case, numbers, symbols)
- Email verification workflow
- JWT token management in client
- User groups (admin/user) with different precedence

---

### 5. Core - DNS with Route53
**Service:** Amazon Route53
**Implementation:** Custom subdomain pointing to EC2 instance

**Demonstration Method:**
- **DNS Resolution:** `nslookup mytranscoder.cab432.com` shows EC2 IP (3.106.226.221)
- **Browser Access:** Navigate to https://mytranscoder.cab432.com:8443
- **SSL Certificate:** Show HTTPS working with custom domain
- **Code Reference:** Route53 configuration in infrastructure

**Key Points to Highlight:**
- Custom subdomain instead of raw EC2 IP
- Professional URL for application access
- Integration with SSL/TLS certificates
- DNS managed through AWS Route53

---

### 6. Infrastructure as Code (3 Marks)
**Technology:** Terraform
**Implementation:** Complete infrastructure automation

**Demonstration Method:**
- **Terraform Files:** Show complete infrastructure as code
  - `terraform/main.tf` (286 lines of infrastructure)
  - `terraform/outputs.tf` (177 lines of outputs)
  - `terraform/variables.tf` (187 lines of configuration)
- **Deployment Process:** Show `terraform plan` and `terraform apply`
- **Resource Creation:** Demonstrate infrastructure created from code
- **State Management:** Show Terraform state tracks all resources

**Services Deployed via Terraform:**
- S3 Buckets (3) with encryption and versioning
- DynamoDB Tables (3) with GSIs
- Cognito User Pool with client and groups
- ECR Repository for container images
- CloudWatch Log Groups
- Parameter Store (6 parameters)
- Secrets Manager (Cognito config)

**Key Points to Highlight:**
- Complete infrastructure reproducibility
- Version control for infrastructure changes
- Automated deployment and teardown
- Enterprise-grade infrastructure management

---

## Bonus Implementations - Detailed Demonstration Plan

### 1. S3 Pre-signed URLs
**Implementation:** Direct S3 access without server proxy

**Demonstration Method:**
- **Browser Network Tab:** Show direct S3 URLs during upload/download (not going through server)
- **Code Walkthrough:** Show `utils/storage.js` pre-signed URL generation functions
- **Functional Demo:**
  - Upload large video → show progress bar → inspect network requests showing direct S3 POST
  - Download video → show pre-signed URL in network tab with S3 domain
  - Stream video → show temporary S3 URL for video playback
- **Security Benefits:** Explain reduced server load and secure time-limited access

**Key Points to Highlight:**
- No server bandwidth usage for file transfers
- Time-limited security (1-2 hours expiry)
- Three types: upload, download, streaming URLs

### 2. Cognito Groups
**Implementation:** Admin and user groups with different access levels

**Demonstration Method:**
- **AWS Console:** Show Cognito User Pool groups (admin precedence 1, user precedence 2)
- **User Creation:** Create test user and assign to group
- **Access Control Demo:**
  - Login as admin → show additional features/permissions
  - Login as regular user → show restricted access
- **Code Reference:** Show group checking in authentication middleware

**Key Points to Highlight:**
- Precedence-based access control
- Scalable permission management
- Integration with JWT token claims

### 3. Cognito Multi-Factor Authentication
**Implementation:** Complete MFA system with TOTP and SMS

**Demonstration Method:**
- **MFA Setup Demo:**
  - Access `/mfa-demo.html` page
  - Setup authenticator app with QR code
  - Verify TOTP code completion
- **Login Flow Demo:**
  - Login with MFA-enabled user
  - Show MFA challenge modal
  - Enter authenticator code → successful login
- **Management Features:**
  - Show MFA status check
  - Demonstrate disable/enable functionality
- **Test Suite:** Run `npm run test-mfa` to show automated testing

**Key Points to Highlight:**
- Two-factor security enhancement
- Industry-standard TOTP support (Google Authenticator, Authy)
- SMS backup option
- Complete challenge-response flow

### 4. Cognito Federated Identities
**Implementation:** Google OAuth integration

**Demonstration Method:**
- **Social Login Demo:**
  - Click "Login with Google" button
  - Show redirect to Google OAuth
  - Complete Google authentication
  - Return to application with JWT token
- **AWS Console:** Show federated identity group creation
- **Code Walkthrough:** Show `/auth/google` endpoint and Hosted UI integration

**Key Points to Highlight:**
- Seamless social authentication
- No password management required
- Automatic user provisioning
- Enterprise-grade OAuth 2.0 flow

### 5. Parameter Store
**Implementation:** Centralized configuration management

**Demonstration Method:**
- **AWS Console:** Show 6 parameters in Systems Manager Parameter Store
  - `/videotranscoder/s3/original-bucket`
  - `/videotranscoder/s3/processed-bucket`
  - `/videotranscoder/dynamodb/table-prefix`
  - `/videotranscoder/cognito/user-pool-id`
  - `/videotranscoder/cognito/client-id`
  - `/videotranscoder/ecr/repository-uri`
- **Application Integration:** Show how app reads configuration at runtime
- **Code Reference:** Show parameter creation in `terraform/main.tf` lines 269-286
- **Environment Benefits:** Explain configuration without code changes

**Key Points to Highlight:**
- No hardcoded configuration values
- Environment-specific settings
- Centralized configuration management
- Runtime configuration updates

### 6. Secrets Manager
**Implementation:** Secure credential storage

**Demonstration Method:**
- **AWS Console:** Show `n10992511-cognito-config` secret (values hidden for security)
- **Secret Structure:** Explain JSON structure containing:
  - User Pool ID
  - Client ID
  - Client Secret
  - AWS Region
- **Application Usage:** Show how app retrieves secrets securely
- **Security Benefits:** Explain automatic rotation capability

**Key Points to Highlight:**
- Secure credential storage (encrypted at rest)
- Automatic rotation support
- No credentials in code or environment variables
- Audit trail for secret access

### 7. Infrastructure as Code (Already Detailed Above)
**Complete Terraform automation for all AWS resources**

---

## Presentation Flow Recommendation

1. **Overview** (2 minutes)
   - Project architecture diagram
   - Core vs bonus requirements achieved

2. **Infrastructure as Code Demo** (4 minutes)
   - Show Terraform code structure
   - Demonstrate infrastructure deployment
   - Highlight automation benefits

3. **Core Services Walkthrough** (6 minutes)
   - S3: File upload/storage demo
   - DynamoDB: Data queries demo
   - Cognito: Authentication flow demo
   - Route53: DNS resolution demo
   - Statelessness: Architecture explanation

4. **Application Integration** (3 minutes)
   - End-to-end user workflow
   - Show all services working together
   - Demonstrate production readiness

**Total Time:** ~15 minutes

---

## Technical Artifacts for Submission

- **Code Repository:** Complete Terraform infrastructure
- **Response Criteria:** Filled A2_response_Criteria.md
- **Video Demo:** Screen recording of functionality
- **Documentation:** This presentation plan

---

## Key Success Messages

1. **Complete Requirements:** All 6 core requirements implemented
2. **Enterprise Grade:** Production-ready infrastructure with automation
3. **Bonus Features:** Parameter Store and Secrets Manager implemented
4. **Professional Deployment:** Custom domain with HTTPS
5. **Reproducible:** Full Infrastructure as Code implementation