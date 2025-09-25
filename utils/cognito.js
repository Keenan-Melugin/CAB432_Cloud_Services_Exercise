const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoConfig = {
  region: 'ap-southeast-2',
  userPoolId: 'ap-southeast-2_WgItmnqik',
  clientId: '6eu5j1rkaejas7s4cd1qkrgepb',
};

const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region
});

// Sign up new user
async function signUpUser(email, password) {
  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
    Password: password,
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
  const params = {
    ClientId: cognitoConfig.clientId,
    Username: email,
    ConfirmationCode: confirmationCode
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
  const params = {
    ClientId: cognitoConfig.clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password
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