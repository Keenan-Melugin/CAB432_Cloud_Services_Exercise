# Outputs for Video Transcoding Service Terraform Configuration
# CAB432 Assignment 2 - Infrastructure as Code

# Application URLs
output "application_url" {
  description = "Application load balancer URL"
  value       = "http://${aws_lb.app.dns_name}"
}

output "domain_url" {
  description = "Application domain URL"
  value       = "http://${var.domain_name}"
}

output "health_check_url" {
  description = "Health check endpoint"
  value       = "http://${aws_lb.app.dns_name}/health"
}

# Load Balancer
output "load_balancer_arn" {
  description = "ARN of the application load balancer"
  value       = aws_lb.app.arn
}

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.app.dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.app.zone_id
}

# Auto Scaling Group
output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.name
}

output "autoscaling_group_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.app.arn
}

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
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.app.arn
}

# Route53
output "route53_record_fqdn" {
  description = "FQDN of the Route53 record"
  value       = aws_route53_record.app.fqdn
}

# Secrets Manager
output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.cognito_config.arn
}

output "secrets_manager_secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.cognito_config.name
}

# CloudWatch
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.arn
}

# Launch Template
output "launch_template_id" {
  description = "ID of the launch template"
  value       = aws_launch_template.app.id
}

output "launch_template_latest_version" {
  description = "Latest version of the launch template"
  value       = aws_launch_template.app.latest_version
}

# Parameter Store
output "parameter_store_keys" {
  description = "Parameter Store configuration keys"
  value = [
    "/videotranscoder/s3/original-bucket",
    "/videotranscoder/s3/processed-bucket",
    "/videotranscoder/dynamodb/table-prefix",
    "/videotranscoder/cognito/user-pool-id",
    "/videotranscoder/cognito/client-id",
    "/videotranscoder/ecr/repository-uri",
    "/videotranscoder/alb/dns-name"
  ]
}

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
    S3_ORIGINAL_BUCKET   = aws_s3_bucket.original_videos.id
    S3_PROCESSED_BUCKET  = aws_s3_bucket.processed_videos.id
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.main.id
    DYNAMODB_TABLE_PREFIX = "videotranscoder"
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
  description = "Summary of created resources"
  value = {
    s3_buckets          = 3
    dynamodb_tables     = 3
    cognito_user_pools  = 1
    ecr_repositories    = 1
    autoscaling_groups  = 1
    load_balancers      = 1
    route53_records     = 1
    secrets             = 1
    parameter_store_params = 7
    log_groups          = 1
  }
}