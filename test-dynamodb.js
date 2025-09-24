// Simple DynamoDB connectivity test
const { dynamodbClient, docClient, tableNames } = require('./utils/dynamodb-config');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function testDynamoDBConnection() {
  console.log('🔍 Testing DynamoDB Connection...');
  console.log('Region:', process.env.AWS_REGION || 'ap-southeast-2');
  console.log('Table prefix:', process.env.DYNAMODB_TABLE_PREFIX || 'videotranscoder');
  console.log('Expected table names:', tableNames);

  try {
    // Test basic connection
    const listCommand = new ListTablesCommand({});
    const result = await dynamodbClient.send(listCommand);

    console.log('\n✅ DynamoDB connection successful!');
    console.log('📋 Existing tables:', result.TableNames || []);

    // Check if our expected tables exist
    const ourTables = Object.values(tableNames);
    const existingTables = result.TableNames || [];

    console.log('\n📊 Table Status:');
    ourTables.forEach(tableName => {
      const exists = existingTables.includes(tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName} ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    });

    return true;

  } catch (error) {
    console.error('\n❌ DynamoDB connection failed:');
    console.error('Error:', error.message);

    if (error.name === 'CredentialsProviderError') {
      console.error('💡 Hint: Check AWS credentials and permissions');
    } else if (error.name === 'NetworkingError') {
      console.error('💡 Hint: Check internet connectivity');
    }

    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDynamoDBConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDynamoDBConnection };