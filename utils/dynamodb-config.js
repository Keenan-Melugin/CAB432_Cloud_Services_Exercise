const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Configure AWS DynamoDB Client
const dynamodbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

// Create document client for easier operations
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// Table names with environment prefix
const tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder';

const tableNames = {
  users: `${tablePrefix}-users`,
  videos: `${tablePrefix}-videos`,
  transcodeJobs: `${tablePrefix}-transcode-jobs`
};

module.exports = {
  dynamodbClient,
  docClient,
  tableNames
};