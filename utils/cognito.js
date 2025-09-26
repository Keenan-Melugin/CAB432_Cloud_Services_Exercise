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

const cognitoConfig = {
  region: process.env.COGNITO_REGION || 'ap-southeast-2',
  userPoolId: process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_NxyJMYl5Z',
  clientId: process.env.COGNITO_CLIENT_ID || '7n4paksk83ssgneufvkvo0m3qa',
  clientSecret: process.env.COGNITO_CLIENT_SECRET || 'j851eik75aqeho124e4ogkl390kuu0i3gper5bgf5ce54tp4ugc',
  // Federated Identity Configuration
  hostedUIUrl: process.env.COGNITO_HOSTED_UI_URL || 'https://ap-southeast-2nxyjmyl5z.auth.ap-southeast-2.amazoncognito.com',
  redirectUri: process.env.NODE_ENV === 'production'
    ? process.env.COGNITO_REDIRECT_URI || 'https://mytranscoder.cab432.com/auth/callback'
    : 'http://localhost:3000/auth/callback'
};

// Calculate SECRET_HASH as required by Cognito when client secret is used
function calculateSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region
});

// Sign up new user
async function signUpUser(email, password) {
  const secretHash = calculateSecretHash(email, cognitoConfig.clientId, cognitoConfig.clientSecret);

  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
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
async function confirmSignUp(email, confirmationCode) {
  const secretHash = calculateSecretHash(email, cognitoConfig.clientId, cognitoConfig.clientSecret);

  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
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
  const secretHash = calculateSecretHash(email, cognitoConfig.clientId, cognitoConfig.clientSecret);

  const params = {
    ClientId: cognitoConfig.clientId,
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
  const params = {
    GroupName: groupName,
    UserPoolId: cognitoConfig.userPoolId,
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
  const params = {
    Username: username,
    GroupName: groupName,
    UserPoolId: cognitoConfig.userPoolId
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
  const params = {
    Username: username,
    GroupName: groupName,
    UserPoolId: cognitoConfig.userPoolId
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
  const params = {
    Username: username,
    UserPoolId: cognitoConfig.userPoolId
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
  const secretHash = calculateSecretHash(username, cognitoConfig.clientId, cognitoConfig.clientSecret);

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
    ClientId: cognitoConfig.clientId,
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
  const params = {
    Username: username,
    UserPoolId: cognitoConfig.userPoolId,
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
  const params = {
    UserPoolId: cognitoConfig.userPoolId,
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

  const tokenEndpoint = `${cognitoConfig.hostedUIUrl}/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cognitoConfig.clientId,
    client_secret: cognitoConfig.clientSecret,
    code: authCode,
    redirect_uri: cognitoConfig.redirectUri
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
  cognitoConfig,
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