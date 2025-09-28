# Terraform Variables for Video Transcoding Service
# CAB432 Assignment 2 - Infrastructure as Code
# Student: n10992511

# Environment Configuration
environment = "prod"
aws_region  = "ap-southeast-2"

# Student Information
student_number = "n10992511"

# Existing QUT Infrastructure
subnet_id             = "subnet-075811427d5564cf9"
secondary_subnet_id   = "subnet-05a3b8177138c8b14"
vpc_security_group_id = "sg-078997505ad1c6bbc"
ec2_security_group_id = "sg-032bd1ff8cf77dbb9"

# ElastiCache Configuration
elasticache_node_type             = "cache.t3.micro"
elasticache_num_nodes             = 2
elasticache_backup_retention_days = 5

# Application Configuration
app_port = 3000