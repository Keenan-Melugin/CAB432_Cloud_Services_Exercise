const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const parameterStore = require('./parameter-store');

// Configure AWS DynamoDB Client
const dynamodbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

// Create document client for easier operations
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

// Initialize table prefix with fallback to environment variable
let tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder';

let tableNames = {
  users: `${tablePrefix}-users`,
  videos: `${tablePrefix}-videos`,
  transcodeJobs: `${tablePrefix}-transcode-jobs`
};

// Load table configuration from Parameter Store
async function loadTableConfig() {
  try {
    const config = await parameterStore.getAppConfig();
    tablePrefix = config.dynamoTablePrefix;

    // Update table names with new prefix
    tableNames = {
      users: `${tablePrefix}-users`,
      videos: `${tablePrefix}-videos`,
      transcodeJobs: `${tablePrefix}-transcode-jobs`
    };

    console.log('DynamoDB table configuration loaded from Parameter Store');
  } catch (error) {
    console.warn('Using environment variables for DynamoDB table configuration:', error.message);
  }
}

// Load configuration on module initialization
loadTableConfig().catch(console.warn);

module.exports = {
  dynamodbClient,
  docClient,
  tableNames,
  loadTableConfig
};