Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** [Your name]
- **Student number:** n10992511
- **Partner name (if applicable):** N/A (Individual submission)
- **Application name:** Video Transcoding Service
- **Two line description:** Enterprise-grade video transcoding platform with complete AWS cloud infrastructure. Implemented using Infrastructure as Code (Terraform) with S3 storage, DynamoDB metadata, Cognito authentication, MFA, federated identities, and comprehensive security features.
- **EC2 instance name or ID:** [To be filled - your EC2 instance ID]

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** S3 (Simple Storage Service)
- **What data is being stored?:** Original video files uploaded by users and processed/transcoded video files in multiple formats
- **Why is this service suited to this data?:** Large video files (potentially GB in size) require blob storage with unlimited capacity, high durability (99.999999999%), and global accessibility
- **Why is are the other services used not suitable for this data?:** DynamoDB has 400KB item size limit, RDS has storage limitations and high cost for large files, EC2 local storage is not persistent
- **Bucket/instance/table name:** n10992511-videotranscoder-original, n10992511-videotranscoder-processed
- **Video timestamp:** [To be added - demonstrate S3 buckets and file upload/download]
- **Relevant files:**
    - terraform/main.tf (lines 25-35: S3 bucket creation)
    - utils/storage.js (S3 operations and pre-signed URL generation)
    - routes/videos.js (video upload and download endpoints)

### Core - Second data persistence service

- **AWS service name:** DynamoDB (NoSQL Database)
- **What data is being stored?:** User profiles and authentication data, video metadata (title, description, upload date, processing status), transcoding job information and status tracking
- **Why is this service suited to this data?:** Fast NoSQL queries for user sessions, scalable for high read/write throughput, Global Secondary Indexes enable efficient queries by user_id and job status, serverless with automatic scaling
- **Why is are the other services used not suitable for this data?:** S3 is for blob storage not structured queries, RDS would be overkill for simple key-value operations and has higher latency, ElastiCache is for temporary caching not persistent storage
- **Bucket/instance/table name:** videotranscoder-users, videotranscoder-videos, videotranscoder-transcode-jobs
- **Video timestamp:** [To be added - show DynamoDB tables and data queries]
- **Relevant files:**
    - terraform/main.tf (lines 72-160: DynamoDB table definitions with GSIs)
    - utils/database.js (DynamoDB operations and query implementations)
    - routes/auth.js (user data management)
    - routes/videos.js (video metadata operations)

### Third data service

- **AWS service name:**  [eg. RDS]
- **What data is being stored?:** [eg video metadata]
- **Why is this service suited to this data?:** [eg. ]
- **Why is are the other services used not suitable for this data?:** [eg. Advanced video search requires complex querries which are not available on S3 and inefficient on DynamoDB]
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    -

### S3 Pre-signed URLs

- **S3 Bucket names:** n10992511-videotranscoder-original, n10992511-videotranscoder-processed
- **Video timestamp:** [To be added during video recording - show network tab during upload/download]
- **Relevant files:**
    - utils/storage.js (pre-signed URL generation functions)
    - routes/videos.js (upload, download, streaming endpoints)
    - public/app.js (client-side direct S3 upload implementation)

### In-memory cache

- **ElastiCache instance name:**
- **What data is being cached?:** [eg. Thumbnails from YouTube videos obatined from external API]
- **Why is this data likely to be accessed frequently?:** [ eg. Thumbnails from popular YouTube videos are likely to be shown to multiple users ]
- **Video timestamp:**
- **Relevant files:**
    -

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary transcoding files during processing (stored in /tmp), session data temporarily held in memory during request processing, application logs before they are shipped to CloudWatch
- **Why is this data not considered persistent state?:** Temporary files can be recreated from original S3 sources, session data is reconstructed from JWT tokens, logs are ephemeral and shipped to CloudWatch for persistence
- **How does your application ensure data consistency if the app suddenly stops?:** All persistent data stored in AWS services (S3, DynamoDB), transcoding jobs tracked in DynamoDB with status updates, application startup reads configuration from Parameter Store and validates all cloud service connections
- **Relevant files:**
    - index.js (stateless application startup and configuration loading)
    - utils/database.js (ensures all data operations use DynamoDB)
    - utils/storage.js (ensures all file operations use S3)
    - routes/transcode.js (job status tracking for consistency)

### Graceful handling of persistent connections

- **Type of persistent connection and use:** [eg. server-side-events for progress reporting]
- **Method for handling lost connections:** [eg. client responds to lost connection by reconnecting and indicating loss of connection to user until connection is re-established ]
- **Relevant files:**
    -


### Core - Authentication with Cognito

- **User pool name:** n10992511-videotranscoder
- **How are authentication tokens handled by the client?:** JWT tokens stored in browser localStorage after successful login, automatically included in API request headers via Authorization: Bearer token, tokens refreshed automatically before expiration, logout clears tokens from storage
- **Video timestamp:** [To be added - demonstrate login flow and JWT token management]
- **Relevant files:**
    - terraform/main.tf (lines 163-230: Cognito User Pool and Client configuration)
    - routes/auth.js (authentication endpoints and token management)
    - public/app.js (client-side token handling and API integration)
    - middleware/auth.js (JWT token validation middleware)

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password + TOTP (Time-based One-Time Password) from authenticator apps (Google Authenticator, Authy), SMS codes as backup
- **Video timestamp:** [To be added - demonstrate MFA setup via /mfa-demo.html and login flow with challenge]
- **Relevant files:**
    - routes/auth.js (MFA setup, challenge, and management endpoints)
    - public/mfa-demo.html (complete MFA demonstration interface)
    - public/app.js (MFA challenge handling in main application)
    - test-mfa.js (automated MFA testing suite)

### Cognito federated identities

- **Identity providers used:** Google OAuth 2.0 (configured through Cognito Hosted UI)
- **Video timestamp:** [To be added - demonstrate Google login flow and automatic user provisioning]
- **Relevant files:**
    - routes/auth.js (Google OAuth redirect endpoint /auth/google)
    - utils/cognito.js (Hosted UI configuration and token handling)
    - public/app.js (social login button integration)

### Cognito groups

- **How are groups used to set permissions?:** Two groups created: 'admin' (precedence 1) with full system access and user management capabilities, 'user' (precedence 2) with standard video upload/transcoding permissions. Groups automatically assigned during registration and enforced via JWT token claims.
- **Video timestamp:** [To be added - show AWS console groups and demonstrate different access levels]
- **Relevant files:**
    - terraform/main.tf (lines 217-230: Cognito group definitions)
    - routes/auth.js (group assignment logic during user creation)
    - middleware/auth.js (group-based permission checking)

### Core - DNS with Route53

- **Subdomain:** mytranscoder.cab432.com
- **Video timestamp:** [To be added - demonstrate DNS resolution and HTTPS access]

### Parameter store

- **Parameter names:** /videotranscoder/s3/original-bucket, /videotranscoder/s3/processed-bucket, /videotranscoder/dynamodb/table-prefix, /videotranscoder/cognito/user-pool-id, /videotranscoder/cognito/client-id, /videotranscoder/ecr/repository-uri
- **Video timestamp:** [To be added - show AWS Systems Manager Parameter Store with all 6 parameters]
- **Relevant files:**
    - terraform/main.tf (lines 269-286: Parameter Store resource creation)
    - terraform/outputs.tf (lines 123-133: Parameter key list output)
    - utils/config.js (runtime parameter retrieval implementation)

### Secrets manager

- **Secrets names:** n10992511-cognito-config (contains User Pool ID, Client ID, Client Secret, and AWS Region in JSON format)
- **Video timestamp:** [To be added - show AWS Secrets Manager console with secret (values masked for security)]
- **Relevant files:**
    - terraform/main.tf (lines 253-266: Secrets Manager resource and version creation)
    - utils/cognito.js (secure secret retrieval and usage)
    - routes/auth.js (integration with Cognito configuration from secrets)

### Infrastructure as code

- **Technology used:** Terraform (HashiCorp)
- **Services deployed:** S3 Buckets (3), DynamoDB Tables (3), Cognito User Pool with Client and Groups, ECR Repository, CloudWatch Log Groups, Parameter Store (6 parameters), Secrets Manager, SSL/Encryption configurations
- **Video timestamp:** [To be added during video recording]
- **Relevant files:**
    - terraform/main.tf (286 lines - complete infrastructure definition)
    - terraform/outputs.tf (177 lines - resource outputs and environment variables)
    - terraform/variables.tf (187 lines - configuration parameters)
    - terraform/terraform.tfvars (environment-specific values)
    - terraform/deploy.sh (automated deployment script)
    - terraform/destroy.sh (automated cleanup script)

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -