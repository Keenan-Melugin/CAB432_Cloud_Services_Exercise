const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AdminGetUserCommand,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  RespondToAuthChallengeCommand,
  AdminSetUserMFAPreferenceCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  AdminUpdateUserAttributesCommand,
  GetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');
const { getCognitoSecrets } = require('./secrets-manager');

// Cache for Cognito configuration to avoid repeated Secrets Manager calls
let cognitoConfigCache = null;

/**
 * Get Cognito configuration from Secrets Manager with fallback to environment variables
 * @param {boolean} forceRefresh - Force refresh from Secrets Manager
 * @returns {Promise<Object>} Cognito configuration object
 */
async function getCognitoConfig(forceRefresh = false) {
  if (!forceRefresh && cognitoConfigCache) {
    return cognitoConfigCache;
  }

  try {
    // Load sensitive config from Secrets Manager
    const secrets = await getCognitoSecrets();

    cognitoConfigCache = {
      region: secrets.region || process.env.COGNITO_REGION || 'ap-southeast-2',
      userPoolId: secrets.userPoolId || process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_NxyJMYl5Z',
      clientId: secrets.clientId || process.env.COGNITO_CLIENT_ID,
      clientSecret: secrets.clientSecret || process.env.COGNITO_CLIENT_SECRET,
      // Federated Identity Configuration
      hostedUIUrl: secrets.hostedUIUrl || process.env.COGNITO_HOSTED_UI_URL || 'https://ap-southeast-2nxyjmyl5z.auth.ap-southeast-2.amazoncognito.com',
      redirectUri: process.env.NODE_ENV === 'production'
        ? process.env.COGNITO_REDIRECT_URI || 'https://mytranscoder.cab432.com/auth/callback'
        : 'http://localhost:3000/auth/callback'
    };

    // Validate required configuration
    if (!cognitoConfigCache.clientId || !cognitoConfigCache.clientSecret || !cognitoConfigCache.userPoolId) {
      throw new Error('Missing required Cognito configuration: clientId, clientSecret, or userPoolId');
    }

    console.log('🔑 Cognito configuration loaded successfully');
    return cognitoConfigCache;

  } catch (error) {
    console.error('❌ Failed to load Cognito configuration:', error.message);
    throw error;
  }
}

// Calculate SECRET_HASH as required by Cognito when client secret is used
function calculateSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

// Initialize Cognito client with default region (will use config region in functions)
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'ap-southeast-2'
});

// Sign up new user
async function signUpUser(username, email, password) {
  const config = await getCognitoConfig();
  const secretHash = calculateSecretHash(username, config.clientId, config.clientSecret);

  const params = {
    ClientId: config.clientId,
    Username: username,
    Password: password,
    SecretHash: secretHash,
    UserAttributes: [
      {
        Name: 'email',
        Value: email
      }
    ]
  };

  try {
    const command = new SignUpCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Confirm sign up with verification code
async function confirmSignUp(username, confirmationCode) {
  const config = await getCognitoConfig();
  const secretHash = calculateSecretHash(username, config.clientId, config.clientSecret);

  const params = {
    ClientId: config.clientId,
    Username: username,
    ConfirmationCode: confirmationCode,
    SecretHash: secretHash
  };

  try {
    const command = new ConfirmSignUpCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Sign in user
async function signInUser(email, password) {
  const config = await getCognitoConfig();
  const secretHash = calculateSecretHash(email, config.clientId, config.clientSecret);

  const params = {
    ClientId: config.clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
      SECRET_HASH: secretHash
    }
  };

  try {
    const command = new InitiateAuthCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Create a group
async function createUserGroup(groupName, description, precedence) {
  const config = await getCognitoConfig();
  const params = {
    GroupName: groupName,
    UserPoolId: config.userPoolId,
    Description: description,
    Precedence: precedence
  };

  try {
    const command = new CreateGroupCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Add user to group
async function addUserToGroup(username, groupName) {
  const config = await getCognitoConfig();
  const params = {
    Username: username,
    GroupName: groupName,
    UserPoolId: config.userPoolId
  };

  try {
    const command = new AdminAddUserToGroupCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Remove user from group
async function removeUserFromGroup(username, groupName) {
  const config = await getCognitoConfig();
  const params = {
    Username: username,
    GroupName: groupName,
    UserPoolId: config.userPoolId
  };

  try {
    const command = new AdminRemoveUserFromGroupCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Get user's groups
async function getUserGroups(username) {
  const config = await getCognitoConfig();
  const params = {
    Username: username,
    UserPoolId: config.userPoolId
  };

  try {
    const command = new AdminListGroupsForUserCommand(params);
    const result = await cognitoClient.send(command);
    return result.Groups || [];
  } catch (error) {
    throw error;
  }
}

// MFA Functions

// Handle MFA challenge response (for SMS, TOTP, and EMAIL)
async function respondToMFAChallenge(session, challengeName, challengeResponse, username) {
  const config = await getCognitoConfig();
  const secretHash = calculateSecretHash(username, config.clientId, config.clientSecret);

  // Determine the challenge response key based on challenge type
  let challengeResponseKey;
  if (challengeName === 'SMS_MFA') {
    challengeResponseKey = 'SMS_MFA_CODE';
  } else if (challengeName === 'SOFTWARE_TOKEN_MFA') {
    challengeResponseKey = 'SOFTWARE_TOKEN_MFA_CODE';
  } else if (challengeName === 'EMAIL_MFA') {
    challengeResponseKey = 'EMAIL_MFA_CODE';
  } else {
    // Fallback for other challenge types
    challengeResponseKey = `${challengeName}_CODE`;
  }

  const params = {
    ClientId: config.clientId,
    ChallengeName: challengeName, // 'SMS_MFA', 'SOFTWARE_TOKEN_MFA', or 'EMAIL_MFA'
    Session: session,
    SecretHash: secretHash,
    ChallengeResponses: {
      USERNAME: username,
      [challengeResponseKey]: challengeResponse
    }
  };

  try {
    const command = new RespondToAuthChallengeCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Associate software token (TOTP) with user
async function associateSoftwareToken(accessToken) {
  const params = {
    AccessToken: accessToken
  };

  try {
    const command = new AssociateSoftwareTokenCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Verify software token setup
async function verifySoftwareToken(accessToken, userCode) {
  const params = {
    AccessToken: accessToken,
    UserCode: userCode,
    FriendlyDeviceName: 'Mobile Authenticator'
  };

  try {
    const command = new VerifySoftwareTokenCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Set user MFA preference
async function setMFAPreference(accessToken, smsPreference = 'DISABLED', softwareTokenPreference = 'ENABLED', emailPreference = 'DISABLED') {
  const params = {
    AccessToken: accessToken,
    SMSMfaSettings: {
      Enabled: smsPreference === 'ENABLED' || smsPreference === 'PREFERRED',
      PreferredMfa: smsPreference === 'PREFERRED'
    },
    SoftwareTokenMfaSettings: {
      Enabled: softwareTokenPreference === 'ENABLED' || softwareTokenPreference === 'PREFERRED',
      PreferredMfa: softwareTokenPreference === 'PREFERRED'
    }
  };

  // Note: Email MFA is handled through Cognito's challenge system automatically
  // when enabled in the User Pool settings. No separate preference setting needed.

  try {
    const command = new SetUserMFAPreferenceCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Admin set user MFA preference (requires admin permissions)
async function adminSetMFAPreference(username, smsPreference = 'DISABLED', softwareTokenPreference = 'ENABLED') {
  const config = await getCognitoConfig();
  const params = {
    Username: username,
    UserPoolId: config.userPoolId,
    SMSMfaSettings: {
      Enabled: smsPreference === 'ENABLED',
      PreferredMfa: smsPreference === 'PREFERRED'
    },
    SoftwareTokenMfaSettings: {
      Enabled: softwareTokenPreference === 'ENABLED',
      PreferredMfa: softwareTokenPreference === 'PREFERRED'
    }
  };

  try {
    const command = new AdminSetUserMFAPreferenceCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Update user phone number for SMS MFA
async function updateUserPhoneNumber(username, phoneNumber) {
  const config = await getCognitoConfig();
  const params = {
    UserPoolId: config.userPoolId,
    Username: username,
    UserAttributes: [
      {
        Name: 'phone_number',
        Value: phoneNumber
      },
      {
        Name: 'phone_number_verified',
        Value: 'true'
      }
    ]
  };

  try {
    const command = new AdminUpdateUserAttributesCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Get user details (requires access token)
async function getUserDetails(accessToken) {
  const params = {
    AccessToken: accessToken
  };

  try {
    const command = new GetUserCommand(params);
    const result = await cognitoClient.send(command);
    return result;
  } catch (error) {
    throw error;
  }
}

// Exchange OAuth authorization code for tokens
async function exchangeCodeForTokens(authCode) {
  const axios = require('axios');
  const config = await getCognitoConfig();

  const tokenEndpoint = `${config.hostedUIUrl}/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: authCode,
    redirect_uri: config.redirectUri
  });

  try {
    const response = await axios.post(tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    throw new Error('Failed to exchange authorization code for tokens');
  }
}

module.exports = {
  cognitoClient,
  getCognitoConfig,
  signUpUser,
  confirmSignUp,
  signInUser,
  createUserGroup,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroups,
  // MFA functions
  respondToMFAChallenge,
  associateSoftwareToken,
  verifySoftwareToken,
  setMFAPreference,
  adminSetMFAPreference,
  updateUserPhoneNumber,
  getUserDetails,
  // Federated authentication
  exchangeCodeForTokens
};