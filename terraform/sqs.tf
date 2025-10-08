# SQS Queue for transcode jobs
# Part of Assignment 3 - Microservices Architecture

# Main queue for transcode jobs
resource "aws_sqs_queue" "transcode_jobs" {
  name                       = "n10992511-transcode-jobs"
  visibility_timeout_seconds = 3600  # 1 hour (enough for complex transcoding jobs)
  message_retention_seconds  = 345600  # 4 days (keep failed jobs for debugging)
  receive_wait_time_seconds  = 20   # Long polling (20s - reduces API calls)

  # Dead Letter Queue for failed jobs
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.transcode_dlq.arn
    maxReceiveCount     = 3  # Retry 3 times before moving to DLQ
  })

  tags = {
    Name        = "Transcode Jobs Queue"
    Environment = "production"
    Student     = "n10992511"
    Assignment  = "A3"
  }
}

# Dead Letter Queue for failed transcode jobs
resource "aws_sqs_queue" "transcode_dlq" {
  name                      = "n10992511-transcode-dlq"
  message_retention_seconds = 604800  # 7 days

  tags = {
    Name        = "Transcode DLQ"
    Environment = "production"
    Student     = "n10992511"
    Assignment  = "A3"
  }
}

# Output queue URLs for application configuration
output "sqs_queue_url" {
  description = "URL of the transcode jobs SQS queue"
  value       = aws_sqs_queue.transcode_jobs.url
}

output "sqs_queue_arn" {
  description = "ARN of the transcode jobs SQS queue"
  value       = aws_sqs_queue.transcode_jobs.arn
}

output "sqs_dlq_url" {
  description = "URL of the transcode DLQ"
  value       = aws_sqs_queue.transcode_dlq.url
}
