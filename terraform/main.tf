# Simplified Terraform for core infrastructure only
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "CAB432-VideoTranscoder"
      Student     = var.student_number
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# S3 Buckets
resource "aws_s3_bucket" "original_videos" {
  bucket = "${var.student_number}-videotranscoder-original"
}

resource "aws_s3_bucket" "processed_videos" {
  bucket = "${var.student_number}-videotranscoder-processed"
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.student_number}-mytranscoder-frontend"
}

# S3 Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "original_videos" {
  bucket = aws_s3_bucket.original_videos.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "processed_videos" {
  bucket = aws_s3_bucket.processed_videos.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Versioning
resource "aws_s3_bucket_versioning" "original_videos" {
  bucket = aws_s3_bucket.original_videos.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "processed_videos" {
  bucket = aws_s3_bucket.processed_videos.id
  versioning_configuration {
    status = "Enabled"
  }
}

# DynamoDB Tables
resource "aws_dynamodb_table" "users" {
  name           = "videotranscoder-users"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "VideoTranscoder-Users"
  }
}

resource "aws_dynamodb_table" "videos" {
  name           = "videotranscoder-videos"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name     = "UserIdIndex"
    hash_key = "user_id"
    read_capacity  = 5
    write_capacity = 5
    projection_type = "ALL"
  }

  tags = {
    Name = "VideoTranscoder-Videos"
  }
}

resource "aws_dynamodb_table" "transcode_jobs" {
  name           = "videotranscoder-transcode-jobs"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name     = "UserIdIndex"
    hash_key = "user_id"
    read_capacity  = 5
    write_capacity = 5
    projection_type = "ALL"
  }

  global_secondary_index {
    name     = "StatusIndex"
    hash_key = "status"
    read_capacity  = 5
    write_capacity = 5
    projection_type = "ALL"
  }

  tags = {
    Name = "VideoTranscoder-TranscodeJobs"
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.student_number}-videotranscoder"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "VideoTranscoder Account Verification"
    email_message        = "Your verification code is {####}"
  }

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true
  }

  tags = {
    Name = "VideoTranscoder-UserPool"
  }
}

# Cognito User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "videotranscoder-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret     = true
  explicit_auth_flows = [
    "ADMIN_NO_SRP_AUTH",
    "USER_PASSWORD_AUTH"
  ]

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# Cognito User Groups
resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users with full access"
  precedence   = 1
}

resource "aws_cognito_user_group" "user" {
  name         = "user"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Regular users with limited access"
  precedence   = 2
}

# ECR Repository exists but cannot be managed due to QUT AWS tagging restrictions
# Repository URL: 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10992511-video-transcoding-service

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.student_number}-videotranscoder-cache"
  subnet_ids = [var.subnet_id, var.secondary_subnet_id]

  tags = {
    Name = "VideoTranscoder-CacheSubnetGroup"
  }
}

# ElastiCache Parameter Group for Redis
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis6.x"
  name   = "${var.student_number}-videotranscoder-redis"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name = "VideoTranscoder-RedisParams"
  }
}

# Use existing CAB432SG security group instead of creating new one
# QUT AWS restrictions prevent creating security groups

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = "${var.student_number}-videotranscoder"
  description                  = "Redis cluster for video transcoding service"

  node_type                    = var.elasticache_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.main.name
  security_group_ids           = ["sg-078997505ad1c6bbc"]  # Use default VPC security group

  num_cache_clusters           = var.elasticache_num_nodes

  engine_version               = "6.2"
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                   = random_password.redis_auth.result

  automatic_failover_enabled   = var.elasticache_num_nodes > 1
  multi_az_enabled            = var.elasticache_num_nodes > 1

  maintenance_window          = "sun:05:00-sun:06:00"
  snapshot_retention_limit    = var.elasticache_backup_retention_days
  snapshot_window            = "03:00-04:00"

  final_snapshot_identifier  = "${var.student_number}-videotranscoder-final-snapshot"

  tags = {
    Name = "VideoTranscoder-Redis"
  }
}

# Random password for Redis authentication
resource "random_password" "redis_auth" {
  length  = 32
  special = true
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ec2/videotranscoder"
  retention_in_days = 7

  tags = {
    Name = "VideoTranscoder-Logs"
  }
}

# Secrets Manager
resource "aws_secretsmanager_secret" "cognito_config" {
  name = "${var.student_number}-cognito-config"
  description = "Cognito configuration for VideoTranscoder"
}

resource "aws_secretsmanager_secret_version" "cognito_config" {
  secret_id = aws_secretsmanager_secret.cognito_config.id
  secret_string = jsonencode({
    userPoolId   = aws_cognito_user_pool.main.id
    clientId     = aws_cognito_user_pool_client.main.id
    clientSecret = aws_cognito_user_pool_client.main.client_secret
    region       = var.aws_region
  })
}

# ElastiCache Redis configuration in Secrets Manager
resource "aws_secretsmanager_secret" "redis_config" {
  name = "${var.student_number}-redis-config"
  description = "Redis configuration for VideoTranscoder caching"
}

resource "aws_secretsmanager_secret_version" "redis_config" {
  secret_id = aws_secretsmanager_secret.redis_config.id
  secret_string = jsonencode({
    host        = aws_elasticache_replication_group.redis.primary_endpoint_address
    port        = aws_elasticache_replication_group.redis.port
    auth_token  = random_password.redis_auth.result
    tls_enabled = true
  })
}

# Parameter Store Configuration
resource "aws_ssm_parameter" "app_config" {
  for_each = {
    "/videotranscoder/s3/original-bucket"    = aws_s3_bucket.original_videos.id
    "/videotranscoder/s3/processed-bucket"   = aws_s3_bucket.processed_videos.id
    "/videotranscoder/dynamodb/table-prefix" = "videotranscoder"
    "/videotranscoder/cognito/user-pool-id"  = aws_cognito_user_pool.main.id
    "/videotranscoder/cognito/client-id"     = aws_cognito_user_pool_client.main.id
    "/videotranscoder/ecr/repository-uri"    = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10992511-video-transcoding-service"
    "/videotranscoder/redis/endpoint"        = aws_elasticache_replication_group.redis.primary_endpoint_address
    "/videotranscoder/redis/port"            = tostring(aws_elasticache_replication_group.redis.port)
  }

  name  = each.key
  type  = "String"
  value = each.value

  tags = {
    Name = "VideoTranscoder-Config"
  }
}