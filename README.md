# Video Transcoding Service

A scalable cloud-based video transcoding service built with AWS microservices architecture. Users can upload videos and convert them to different formats and resolutions through a web interface.

## What It Does

- Upload videos to the cloud (S3)
- Convert videos to different formats (MP4, WebM) and resolutions (1080p, 720p, 480p, 360p)
- Automatic scaling based on workload
- Real-time progress tracking
- User authentication and authorization

## Architecture

**Microservices:**
- **API Service** - EC2 instance serving React frontend and REST API
- **Worker Service** - ECS Fargate tasks performing CPU-intensive video transcoding with FFmpeg
- **DLQ Handler** - Lambda function processing failed jobs

**AWS Services Used:**
- EC2, ECS Fargate, Lambda
- S3 (storage), DynamoDB (database), SQS (queuing)
- Cognito (authentication), ElastiCache Redis (caching)
- Application Load Balancer, CloudFront CDN, Route 53
- CloudWatch, IAM, Secrets Manager, ACM

**Infrastructure:**
- Core services provisioned with Terraform
- Auto-scaling ECS workers (1-3 tasks based on CPU/memory)
- Dead letter queue for failed job handling

## How to Run

### Prerequisites
- AWS Account with appropriate permissions
- Terraform installed
- Node.js 18+ and npm
- Docker (for worker deployment)

### Local Development (API Service)

```bash
# Install dependencies
npm install

# Set environment variables
export AWS_REGION=ap-southeast-2
export SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/[account]/[queue]
export REDIS_HOST=[elasticache-endpoint]

# Start API server
npm start

# Access at http://localhost:3000
```

### Infrastructure Deployment

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Deploy core infrastructure (S3, DynamoDB, Cognito, Redis, SQS)
terraform apply

# Outputs will show resource details
terraform output
```

### ECS Worker Deployment

```bash
# Build worker container
docker build -f Dockerfile.worker -t transcoding-worker .

# Tag for ECR
docker tag transcoding-worker:latest [account].dkr.ecr.ap-southeast-2.amazonaws.com/[repo]:latest

# Push to ECR
docker push [account].dkr.ecr.ap-southeast-2.amazonaws.com/[repo]:latest

# Deploy ECS service via AWS Console or CLI
```

### Lambda DLQ Handler Deployment

```bash
# Navigate to lambda directory
cd lambda

# Create deployment package
zip -r dlq-handler.zip dlq-handler.js node_modules/

# Upload to Lambda via AWS Console
```

## Configuration

Key environment variables:

```bash
# Required for API Service
AWS_REGION=ap-southeast-2
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/...
REDIS_HOST=your-redis-endpoint.cache.amazonaws.com

# Optional
PORT=3000
NODE_ENV=production
```

## Project Structure

```
CAB432/
├── index.js                 # API server entry point
├── routes/                  # API endpoints
│   ├── auth.js             # Authentication
│   ├── videos.js           # Video management
│   └── transcode.js        # Job creation & status
├── worker/
│   └── transcode-worker.js # ECS worker service
├── lambda/
│   └── dlq-handler.js      # Dead letter queue handler
├── utils/                  # Shared utilities
├── terraform/              # Infrastructure as Code
│   ├── main.tf            # Core infrastructure
│   ├── sqs.tf             # Message queues
│   └── variables.tf       # Configuration
└── public/                # React frontend
```

## API Endpoints

```
Authentication:
  POST   /auth/login
  POST   /auth/register

Videos:
  GET    /videos
  POST   /videos/upload
  GET    /videos/:id

Transcoding:
  POST   /transcode/jobs
  GET    /transcode/jobs
  POST   /transcode/start/:jobId
  GET    /transcode/download/:jobId
  GET    /transcode/progress/:jobId
```

## Troubleshooting

**Redis connection failed:**
- Application uses graceful degradation and continues without caching
- Check ElastiCache security groups allow connections from EC2/ECS

**SQS messages not processing:**
- Verify ECS tasks are running: `aws ecs list-tasks --cluster transcoding`
- Check CloudWatch logs: `/ecs/n10992511-transcoding-worker`

**Lambda not processing DLQ:**
- Verify SQS trigger is configured and enabled
- Check CloudWatch logs: `/aws/lambda/n10992511-dlq-handler`

## Documentation

- `/documents/Report/` - Architecture justifications and analysis
- `/documents/assessment_3/` - Implementation evidence
- `/terraform/` - Infrastructure as Code documentation
