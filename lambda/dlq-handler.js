/**
 * Dead Letter Queue Handler Lambda Function
 *
 * Purpose: Process failed transcoding jobs from SQS DLQ
 * Trigger: SQS Dead Letter Queue (n10992511-transcode-dlq)
 *
 * This Lambda function handles messages that failed processing after 3 retry attempts.
 * It updates the job status in DynamoDB and logs failure details for debugging.
 *
 * Assessment 3 - Additional Criteria: Dead Letter Queue (2 marks)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// DynamoDB table name
const TRANSCODE_JOBS_TABLE = process.env.DYNAMODB_TABLE || 'videotranscoder-transcode-jobs';

/**
 * Lambda handler function
 * @param {Object} event - SQS event containing DLQ messages
 * @param {Object} context - Lambda context
 */
exports.handler = async (event, context) => {
  console.log('DLQ Handler triggered');
  console.log(`   Processing ${event.Records.length} failed message(s)`);

  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };

  // Process each failed message from the DLQ
  for (const record of event.Records) {
    try {
      console.log(`\nProcessing DLQ message: ${record.messageId}`);

      // Parse the original job data from message body
      const jobData = JSON.parse(record.body);
      const jobId = jobData.id || jobData.jobId;

      if (!jobId) {
        throw new Error('Message missing job ID');
      }

      console.log(`   Job ID: ${jobId}`);
      console.log(`   User ID: ${jobData.user_id || 'unknown'}`);
      console.log(`   Target: ${jobData.target_resolution || 'N/A'} ${jobData.target_format || 'N/A'}`);

      // Determine failure reason from message attributes or approximateReceiveCount
      const receiveCount = parseInt(record.attributes.ApproximateReceiveCount || '0');
      const firstReceivedTimestamp = parseInt(record.attributes.ApproximateFirstReceiveTimestamp || Date.now());

      const failureReason = determineFailureReason(record, jobData);
      const errorDetails = {
        reason: failureReason,
        receiveCount: receiveCount,
        messageId: record.messageId,
        timestamp: new Date().toISOString(),
        originalMessage: record.body.substring(0, 500) // Truncate for logging
      };

      console.log(`   Failure reason: ${failureReason}`);
      console.log(`   Retry attempts: ${receiveCount}`);

      // Update job status in DynamoDB
      await updateJobStatus(jobId, failureReason, errorDetails);

      console.log(`   Job ${jobId} marked as failed in database`);
      results.successful++;

    } catch (error) {
      console.error(`   Failed to process DLQ message:`, error.message);
      results.failed++;
      results.errors.push({
        messageId: record.messageId,
        error: error.message
      });
    }
  }

  // Log summary
  console.log(`\nDLQ Processing Summary:`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log(`   Errors:`, JSON.stringify(results.errors, null, 2));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'DLQ processing complete',
      results: results
    })
  };
};

/**
 * Update job status to 'failed' in DynamoDB
 * @param {string} jobId - The transcoding job ID
 * @param {string} failureReason - Human-readable failure reason
 * @param {Object} errorDetails - Additional error metadata
 */
async function updateJobStatus(jobId, failureReason, errorDetails) {
  const updateCommand = new UpdateCommand({
    TableName: TRANSCODE_JOBS_TABLE,
    Key: { id: jobId },
    UpdateExpression: 'SET #status = :status, error_message = :errorMessage, completed_at = :completedAt, dlq_processed_at = :dlqProcessedAt, dlq_details = :dlqDetails',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'failed',
      ':errorMessage': failureReason,
      ':completedAt': new Date().toISOString(),
      ':dlqProcessedAt': new Date().toISOString(),
      ':dlqDetails': errorDetails
    },
    ReturnValues: 'ALL_NEW'
  });

  const result = await docClient.send(updateCommand);
  return result.Attributes;
}

/**
 * Determine the reason for job failure based on message attributes
 * @param {Object} record - SQS record
 * @param {Object} jobData - Original job data
 * @returns {string} Human-readable failure reason
 */
function determineFailureReason(record, jobData) {
  // Check for common failure patterns
  const receiveCount = parseInt(record.attributes.ApproximateReceiveCount || '0');

  // If the message was retried multiple times, it's likely a persistent failure
  if (receiveCount >= 3) {
    return 'Job failed after 3 retry attempts. Possible causes: corrupted input file, unsupported format, insufficient resources, or worker errors.';
  }

  // Check job data for specific error indicators
  if (jobData.storage_key && jobData.storage_key.includes('corrupt')) {
    return 'Failed: Input file may be corrupted or inaccessible';
  }

  if (jobData.target_format && !['mp4', 'webm', 'avi', 'mov'].includes(jobData.target_format)) {
    return 'Failed: Unsupported target format';
  }

  // Default failure message
  return 'Job failed: Unable to complete transcoding. Please check input file and try again.';
}

/**
 * Additional helper: Parse error from message body if available
 * (For future enhancement - if workers start including error details in message)
 */
function extractErrorFromMessage(body) {
  try {
    const data = JSON.parse(body);
    if (data.error || data.error_message) {
      return data.error || data.error_message;
    }
  } catch (e) {
    // Body not parseable or no error field
  }
  return null;
}
