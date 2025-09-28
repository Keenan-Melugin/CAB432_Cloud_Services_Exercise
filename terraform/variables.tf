# Variables for Video Transcoding Service Terraform Configuration
# CAB432 Assignment 2 - Infrastructure as Code

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "student_number" {
  description = "QUT student number for resource naming"
  type        = string
  default     = "n10992511"
}

variable "vpc_id" {
  description = "Existing VPC ID (QUT-managed)"
  type        = string
  default     = "vpc-007bab53289655834"
}

variable "subnet_id" {
  description = "Existing subnet ID (QUT-managed)"
  type        = string
  default     = "subnet-075811427d5564cf9"
}

variable "secondary_subnet_id" {
  description = "Secondary subnet ID for ALB (must be in different AZ)"
  type        = string
  default     = "subnet-0123456789abcdef0"  # Update with actual secondary subnet
}

variable "key_pair_name" {
  description = "EC2 Key Pair name"
  type        = string
  default     = "KeenanMelugin"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ami_id" {
  description = "AMI ID for Ubuntu 24.04 LTS"
  type        = string
  default     = "ami-0279a86684f669718"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "mytranscoder.cab432.com"
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling for the application"
  type        = bool
  default     = true
}

variable "min_capacity" {
  description = "Minimum number of instances in Auto Scaling Group"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of instances in Auto Scaling Group"
  type        = number
  default     = 3
}

variable "desired_capacity" {
  description = "Desired number of instances in Auto Scaling Group"
  type        = number
  default     = 1
}

variable "enable_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 7
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = false
}

# DynamoDB Configuration
variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PROVISIONED or PAY_PER_REQUEST)"
  type        = string
  default     = "PROVISIONED"
}

variable "dynamodb_read_capacity" {
  description = "DynamoDB read capacity units"
  type        = number
  default     = 5
}

variable "dynamodb_write_capacity" {
  description = "DynamoDB write capacity units"
  type        = number
  default     = 5
}

# S3 Configuration
variable "s3_versioning_enabled" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "s3_encryption_enabled" {
  description = "Enable S3 bucket encryption"
  type        = bool
  default     = true
}

# Cognito Configuration
variable "cognito_password_min_length" {
  description = "Minimum password length for Cognito"
  type        = number
  default     = 8
}

variable "cognito_token_validity_hours" {
  description = "Token validity period in hours"
  type        = number
  default     = 1
}

variable "cognito_refresh_token_validity_days" {
  description = "Refresh token validity period in days"
  type        = number
  default     = 30
}

# Application Configuration
variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

variable "container_image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

# ElastiCache Configuration
variable "elasticache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "elasticache_num_nodes" {
  description = "Number of cache nodes in the replication group"
  type        = number
  default     = 2
}

variable "elasticache_backup_retention_days" {
  description = "Number of days to retain ElastiCache snapshots"
  type        = number
  default     = 5
}

# Tagging
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}