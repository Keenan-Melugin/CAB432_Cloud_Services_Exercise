const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const cognitoConfig = {
  region: 'ap-southeast-2',
  userPoolId: 'ap-southeast-2_NxyJMYl5Z',
  clientId: '7n4paksk83ssgneufvkvo0m3qa',
  clientSecret: 'j851eik75aqeho124e4ogkl390kuu0i3gper5bgf5ce54tp4ugc',
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

module.exports = {
  cognitoClient,
  cognitoConfig,
  signUpUser,
  confirmSignUp,
  signInUser
};