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

- **Name:** Keenan Melugin
- **Student number:** n10992511
- **Partner name (if applicable):** Chiran Walisundara
- **Application name:** Video Transcoding Service
- **Two line description:** A cloud-based video transcoding service that allows users to upload videos and convert them to different formats and resolutions. Features include real-time progress tracking, user authentication, and admin management capabilities.
- **EC2 instance name or ID:**  i-084cade87a94aa3d5

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** S3
- **What data is being stored?:** Video files (original uploads and transcoded outputs)
- **Why is this service suited to this data?:** Object storage designed for large files with unlimited capacity and high availability
- **Why is are the other services used not suitable for this data?:** DynamoDB has 400KB item size limit, RDS not designed for binary file storage
- **Bucket/instance/table name:** videotranscoder-original, videotranscoder-processed
- **Video timestamp:** 00:10
- **Relevant files:**
    - utils/storage.js
    - utils/aws-config.js
    - routes/videos.js

### Core - Second data persistence service

- **AWS service name:** DynamoDB
- **What data is being stored?:** User accounts, video metadata, transcoding job status and progress
- **Why is this service suited to this data?:** NoSQL database optimized for fast lookups and real-time updates
- **Why is are the other services used not suitable for this data?:** S3 not designed for structured data queries, requires fast read/write for job progress updates
- **Bucket/instance/table name:** videotranscoder-users, videotranscoder-videos, videotranscoder-transcode-jobs
- **Video timestamp:** 00:200
- **Relevant files:**
    - utils/dynamodb.js
    - utils/dynamodb-config.js
    - utils/database-abstraction.js

### Third data service

- **AWS service name:** ElastiCache (Redis)
- **What data is being stored?:** User session data and frequently accessed user information
- **Why is this service suited to this data?:** In-memory storage provides fast access for session management and caching
- **Why is are the other services used not suitable for this data?:** DynamoDB slower for frequent session lookups, S3 not designed for session data
- **Bucket/instance/table name:** videotranscoder-cache
- **Video timestamp:** 00:50
- **Relevant files:**
    - utils/cache.js

### S3 Pre-signed URLs

- **S3 Bucket names:** videotranscoder-original, videotranscoder-processed
- **Video timestamp:** 00:40
- **Relevant files:**
    - utils/storage.js
    - routes/videos.js
    - public/app.js (uploadDirectToS3 function)

### In-memory cache

- **ElastiCache instance name:** videotranscoder-cache
- **What data is being cached?:** User session information and authentication data
- **Why is this data likely to be accessed frequently?:** User sessions accessed on every authenticated request for authorization
- **Video timestamp:** 00:50
- **Relevant files:**
    - utils/cache.js
    - routes/auth.js

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary files during transcoding process and application logs
- **Why is this data not considered persistent state?:** Temporary transcoding files are intermediate processing artifacts that can be regenerated from source videos
- **How does your application ensure data consistency if the app suddenly stops?:** Job status tracking in DynamoDB allows recovery of incomplete transcoding jobs on restart
- **Relevant files:**
    - routes/transcode.js
    - utils/database-abstraction.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:** Server-Sent Events (SSE) for real-time transcoding progress updates
- **Method for handling lost connections:** Client automatically reconnects on connection loss and displays connection status to user
- **Relevant files:**
    - routes/transcode.js (SSE endpoint)
    - public/app.js (startJobUpdates function)

### Core - Authentication with Cognito

- **User pool name:** videotranscoder-users
- **How are authentication tokens handled by the client?:** JWT tokens stored in localStorage and sent in Authorization header for API requests
- **Video timestamp:** 01:10
- **Relevant files:**
    - routes/auth.js
    - utils/auth.js
    - public/app.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password and TOTP (authenticator app) or SMS codes
- **Video timestamp:** 01:20
- **Relevant files:**
    - utils/cognito.js
    - routes/auth.js
    - public/index.html (MFA modal)

### Cognito federated identities

- **Identity providers used:** Google OAuth,  this is partically implemented, continuous frontend issues
- **Video timestamp:** 02:10
- **Relevant files:**
    - routes/auth.js (Google OAuth endpoints)
    - utils/cognito.js

### Cognito groups

- **How are groups used to set permissions?:** 'admin' group members can view all users' data and access system statistics
- **Video timestamp:** 02:35
- **Relevant files:**
    - utils/auth.js (requireGroups middleware)
    - utils/database-abstraction.js
    - public/app.js (admin UI)

### Core - DNS with Route53

- **Subdomain:** Https://mytranscoder.cab432.com
- **Video timestamp:** 00:00

### Parameter store

- **Parameter names:** /videotranscoder/config/dynamodb-table-prefix, /videotranscoder/config/s3-buckets
- **Video timestamp:** 02:55
- **Relevant files:**
    - utils/parameter-store.js

### Secrets manager

- **Secrets names:** videotranscoder-cognito-secrets
- **Video timestamp:** 03:30
- **Relevant files:**
    - utils/parameter-store.js

### Infrastructure as code

- **Technology used:** Terraform
- **Services deployed:** EC2, Auto Scaling, Load Balancer, S3, DynamoDB, Cognito, Route53, ElastiCache
- **Video timestamp:** 00:00
- **Relevant files:**
    - terraform/main.tf
    - terraform/deploy.sh
    - terraform/destroy.sh