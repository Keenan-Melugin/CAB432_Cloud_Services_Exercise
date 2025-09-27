# Terraform Variables for Video Transcoding Service
# CAB432 Assignment 2 - Infrastructure as Code
# Student: n10992511

# Environment Configuration
environment = "prod"
aws_region  = "ap-southeast-2"

# Student Information
student_number = "n10992511"

# Existing QUT Infrastructure (Do not modify)
vpc_id                = "vpc-007bab53289655834"
subnet_id             = "subnet-075811427d5564cf9"
secondary_subnet_id   = "subnet-04ca053dcbe5f49cc"  # aws-controltower-PublicSubnet3 (ap-southeast-2c)
key_pair_name         = "KeenanMelugin"

# EC2 Configuration
instance_type = "t3.micro"
ami_id        = "ami-0279a86684f669718"  # Ubuntu 24.04 LTS

# Domain Configuration
domain_name = "mytranscoder.cab432.com"

# Auto Scaling Configuration
enable_auto_scaling = true
min_capacity        = 1
max_capacity        = 3
desired_capacity    = 1

# Application Configuration
app_port          = 3000
health_check_path = "/health"
container_image_tag = "latest"

# Monitoring Configuration
enable_monitoring    = true
log_retention_days   = 7

# Security Configuration
enable_deletion_protection = false

# DynamoDB Configuration
dynamodb_billing_mode   = "PROVISIONED"
dynamodb_read_capacity  = 5
dynamodb_write_capacity = 5

# S3 Configuration
s3_versioning_enabled = true
s3_encryption_enabled = true

# Cognito Configuration
cognito_password_min_length      = 8
cognito_token_validity_hours     = 1
cognito_refresh_token_validity_days = 30

# Backup Configuration
backup_retention_days = 7

# Additional Tags
additional_tags = {
  Course      = "CAB432"
  Assignment  = "A2"
  Semester    = "2025-S2"
  University  = "QUT"
}