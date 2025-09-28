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

variable "subnet_id" {
  description = "Existing subnet ID (QUT-managed)"
  type        = string
  default     = "subnet-075811427d5564cf9"
}

variable "secondary_subnet_id" {
  description = "Secondary subnet ID for ElastiCache (must be in different AZ)"
  type        = string
  default     = "subnet-05a3b8177138c8b14"
}

variable "vpc_security_group_id" {
  description = "Default VPC security group ID"
  type        = string
  default     = "sg-078997505ad1c6bbc"
}

variable "ec2_security_group_id" {
  description = "EC2 security group ID for ElastiCache access"
  type        = string
  default     = "sg-032bd1ff8cf77dbb9"
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

# Application Configuration
variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}