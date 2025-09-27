# Video Transcoding Service - Terraform Infrastructure
# CAB432 Assignment 2 - Infrastructure as Code (3 marks)
# Student: n10992511

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider Configuration
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

# Data sources for existing QUT-managed resources
data "aws_vpc" "existing" {
  id = var.vpc_id
}

data "aws_subnet" "existing" {
  id = var.subnet_id
}

data "aws_security_group" "existing" {
  name = "CAB432SG"
}

data "aws_iam_role" "existing" {
  name = "CAB432-Instance-Role"
}

data "aws_iam_instance_profile" "existing" {
  name = "CAB432-Instance-Role"
}

data "aws_key_pair" "existing" {
  key_name = var.key_pair_name
}

# S3 Buckets (import existing)
resource "aws_s3_bucket" "original_videos" {
  bucket = "${var.student_number}-videotranscoder-original"
}

resource "aws_s3_bucket" "processed_videos" {
  bucket = "${var.student_number}-videotranscoder-processed"
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.student_number}-mytranscoder-frontend"
}

# S3 Bucket Configuration
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

# S3 Bucket Policies for secure access
resource "aws_s3_bucket_policy" "original_videos" {
  bucket = aws_s3_bucket.original_videos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyPublicAccess"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.original_videos.arn,
          "${aws_s3_bucket.original_videos.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# DynamoDB Tables (import existing)
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

# ECR Repository
resource "aws_ecr_repository" "app" {
  name                 = "${var.student_number}-video-transcoding-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Launch Template for EC2 instances
resource "aws_launch_template" "app" {
  name_prefix   = "videotranscoder-"
  image_id      = var.ami_id
  instance_type = var.instance_type
  key_name      = data.aws_key_pair.existing.key_name

  vpc_security_group_ids = [data.aws_security_group.existing.id]

  iam_instance_profile {
    name = data.aws_iam_instance_profile.existing.name
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    ecr_repository_uri     = aws_ecr_repository.app.repository_url
    aws_region            = var.aws_region
    student_number        = var.student_number
    s3_original_bucket    = aws_s3_bucket.original_videos.id
    s3_processed_bucket   = aws_s3_bucket.processed_videos.id
    cognito_user_pool_id  = aws_cognito_user_pool.main.id
    cognito_client_id     = aws_cognito_user_pool_client.main.id
    dynamodb_table_prefix = "videotranscoder"
    domain_name           = var.domain_name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "VideoTranscoder-Instance"
      Type = "Application"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "videotranscoder-asg"
  vpc_zone_identifier = [data.aws_subnet.existing.id]
  min_size            = 1
  max_size            = 3
  desired_capacity    = 1

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "VideoTranscoder-ASG"
    propagate_at_launch = true
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }
}

# Application Load Balancer
resource "aws_lb" "app" {
  name               = "${var.student_number}-videotranscoder-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [data.aws_security_group.existing.id]
  subnets            = [data.aws_subnet.existing.id, var.secondary_subnet_id]

  enable_deletion_protection = false

  tags = {
    Name = "VideoTranscoder-ALB"
  }
}

# ALB Target Group
resource "aws_lb_target_group" "app" {
  name     = "${var.student_number}-videotranscoder-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.existing.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "VideoTranscoder-TargetGroup"
  }
}

# ALB Listener
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.app.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# Auto Scaling Group Attachment
resource "aws_autoscaling_attachment" "app" {
  autoscaling_group_name = aws_autoscaling_group.app.id
  lb_target_group_arn    = aws_lb_target_group.app.arn
}

# Route53 Record
data "aws_route53_zone" "main" {
  name = "cab432.com"
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "mytranscoder.cab432.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.app.dns_name]
}

# Parameter Store Configuration
resource "aws_ssm_parameter" "app_config" {
  for_each = {
    "/videotranscoder/s3/original-bucket"    = aws_s3_bucket.original_videos.id
    "/videotranscoder/s3/processed-bucket"   = aws_s3_bucket.processed_videos.id
    "/videotranscoder/dynamodb/table-prefix" = "videotranscoder"
    "/videotranscoder/cognito/user-pool-id"  = aws_cognito_user_pool.main.id
    "/videotranscoder/cognito/client-id"     = aws_cognito_user_pool_client.main.id
    "/videotranscoder/ecr/repository-uri"    = aws_ecr_repository.app.repository_url
    "/videotranscoder/alb/dns-name"          = aws_lb.app.dns_name
  }

  name  = each.key
  type  = "String"
  value = each.value

  tags = {
    Name = "VideoTranscoder-Config"
  }
}

# Secrets Manager for sensitive configuration
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

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ec2/videotranscoder"
  retention_in_days = 7

  tags = {
    Name = "VideoTranscoder-Logs"
  }
}