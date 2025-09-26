const {
  SecretsManagerClient,
  GetSecretValueCommand
} = require('@aws-sdk/client-secrets-manager');

// Initialize Secrets Manager client
const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

// Cache for secrets to avoid repeated API calls
const secretsCache = new Map();

/**
 * Retrieve a secret from AWS Secrets Manager with caching
 * @param {string} secretName - The name or ARN of the secret
 * @param {boolean} forceRefresh - Force refresh from AWS (bypass cache)
 * @returns {Promise<Object>} Parsed secret object
 */
async function getSecret(secretName, forceRefresh = false) {
  // Check cache first unless force refresh
  if (!forceRefresh && secretsCache.has(secretName)) {
    console.log(`📋 Using cached secret: ${secretName}`);
    return secretsCache.get(secretName);
  }

  try {
    console.log(`🔐 Retrieving secret from AWS: ${secretName}`);

    const command = new GetSecretValueCommand({
      SecretId: secretName
    });

    const response = await secretsManagerClient.send(command);

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} does not contain a string value`);
    }

    // Parse the secret string as JSON
    const secretObject = JSON.parse(response.SecretString);

    // Cache the secret for future use
    secretsCache.set(secretName, secretObject);

    console.log(`✅ Secret retrieved successfully: ${secretName}`);
    return secretObject;

  } catch (error) {
    console.error(`❌ Failed to retrieve secret ${secretName}:`, error.message);

    // Re-throw with more context
    throw new Error(`Failed to retrieve secret ${secretName}: ${error.message}`);
  }
}

/**
 * Retrieve Cognito configuration from Secrets Manager
 * @returns {Promise<Object>} Cognito configuration object
 */
async function getCognitoSecrets() {
  const secretName = process.env.COGNITO_SECRETS_NAME || 'cab432/cognito-config';

  try {
    const secrets = await getSecret(secretName);

    // Validate required fields
    const requiredFields = ['clientId', 'clientSecret', 'userPoolId'];
    const missingFields = requiredFields.filter(field => !secrets[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required Cognito secrets: ${missingFields.join(', ')}`);
    }

    console.log('🔑 Cognito secrets loaded from Secrets Manager');
    return secrets;

  } catch (error) {
    console.error('❌ Failed to load Cognito secrets from Secrets Manager:', error.message);
    console.log('🔄 Falling back to environment variables');

    // Fallback to environment variables if Secrets Manager fails
    return {
      clientId: process.env.COGNITO_CLIENT_ID,
      clientSecret: process.env.COGNITO_CLIENT_SECRET,
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      region: process.env.COGNITO_REGION
    };
  }
}

/**
 * Clear the secrets cache (useful for testing or forced refresh)
 */
function clearSecretsCache() {
  secretsCache.clear();
  console.log('🗑️ Secrets cache cleared');
}

/**
 * Get database secrets from Secrets Manager
 * @returns {Promise<Object>} Database configuration object
 */
async function getDatabaseSecrets() {
  const secretName = process.env.DATABASE_SECRETS_NAME || 'cab432/database-config';

  try {
    return await getSecret(secretName);
  } catch (error) {
    console.warn('⚠️ Database secrets not found in Secrets Manager, using defaults');
    return {};
  }
}

module.exports = {
  getSecret,
  getCognitoSecrets,
  getDatabaseSecrets,
  clearSecretsCache,
  secretsManagerClient
};