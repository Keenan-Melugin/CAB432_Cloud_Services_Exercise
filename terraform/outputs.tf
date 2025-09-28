# Simplified Outputs for Core Infrastructure
# CAB432 Assignment 2 - Infrastructure as Code

# S3 Buckets
output "s3_original_bucket_name" {
  description = "Name of the S3 bucket for original videos"
  value       = aws_s3_bucket.original_videos.id
}

output "s3_processed_bucket_name" {
  description = "Name of the S3 bucket for processed videos"
  value       = aws_s3_bucket.processed_videos.id
}

output "s3_frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "s3_original_bucket_arn" {
  description = "ARN of the S3 bucket for original videos"
  value       = aws_s3_bucket.original_videos.arn
}

output "s3_processed_bucket_arn" {
  description = "ARN of the S3 bucket for processed videos"
  value       = aws_s3_bucket.processed_videos.arn
}

# DynamoDB Tables
output "dynamodb_users_table_name" {
  description = "Name of the DynamoDB users table"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_videos_table_name" {
  description = "Name of the DynamoDB videos table"
  value       = aws_dynamodb_table.videos.name
}

output "dynamodb_jobs_table_name" {
  description = "Name of the DynamoDB transcode jobs table"
  value       = aws_dynamodb_table.transcode_jobs.name
}

output "dynamodb_users_table_arn" {
  description = "ARN of the DynamoDB users table"
  value       = aws_dynamodb_table.users.arn
}

output "dynamodb_videos_table_arn" {
  description = "ARN of the DynamoDB videos table"
  value       = aws_dynamodb_table.videos.arn
}

output "dynamodb_jobs_table_arn" {
  description = "ARN of the DynamoDB transcode jobs table"
  value       = aws_dynamodb_table.transcode_jobs.arn
}

# Cognito
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_endpoint" {
  description = "Endpoint of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "cognito_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
  sensitive   = true
}

output "cognito_client_secret" {
  description = "Secret of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.client_secret
  sensitive   = true
}

# ECR Repository
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10992511-video-transcoding-service"
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = "arn:aws:ecr:ap-southeast-2:901444280953:repository/n10992511-video-transcoding-service"
}

# ElastiCache
output "elasticache_redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "elasticache_redis_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "elasticache_redis_arn" {
  description = "ARN of the ElastiCache Redis replication group"
  value       = aws_elasticache_replication_group.redis.arn
}

# Secrets Manager, CloudWatch, and Parameter Store outputs removed
# These services are restricted by QUT AWS policies
# Application should use existing Parameter Store values: /n10992511/videotranscoder/dev/...
# Or use Terraform outputs directly for resource discovery

# Application Configuration for Environment Variables
output "application_environment_variables" {
  description = "Environment variables for the application"
  value = {
    NODE_ENV              = var.environment
    AWS_REGION           = var.aws_region
    PORT                 = var.app_port
    DATABASE_PROVIDER    = "dynamodb"
    STORAGE_PROVIDER     = "s3"
    CONFIG_PROVIDER      = "parameter-store"
    CACHE_PROVIDER       = "elasticache"
    S3_ORIGINAL_BUCKET   = aws_s3_bucket.original_videos.id
    S3_PROCESSED_BUCKET  = aws_s3_bucket.processed_videos.id
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
    DYNAMODB_TABLE_PREFIX = "videotranscoder"
    REDIS_ENDPOINT       = aws_elasticache_replication_group.redis.primary_endpoint_address
    REDIS_PORT           = tostring(aws_elasticache_replication_group.redis.port)
  }
  sensitive = true
}

# Terraform State Information
output "terraform_workspace" {
  description = "Current Terraform workspace"
  value       = terraform.workspace
}

output "deployment_timestamp" {
  description = "Timestamp of the deployment"
  value       = timestamp()
}

# Resource Counts for Monitoring
output "resource_summary" {
  description = "Summary of Terraform-managed resources"
  value = {
    s3_buckets              = 3
    dynamodb_tables         = 3
    cognito_user_pools      = 1
    elasticache_clusters    = 1
    # Note: ECR, secrets, logs, and parameter store exist but managed externally due to QUT restrictions
  }
}