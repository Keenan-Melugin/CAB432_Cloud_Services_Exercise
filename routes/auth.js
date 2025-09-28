const express = require('express');
const jwt = require('jsonwebtoken');
const {
  signUpUser,
  confirmSignUp,
  signInUser,
  respondToMFAChallenge,
  associateSoftwareToken,
  verifySoftwareToken,
  setMFAPreference,
  updateUserPhoneNumber,
  getUserDetails,
  exchangeCodeForTokens,
  getCognitoConfig
} = require('../utils/cognito');
const { authenticateToken, requireGroups, getUserIdAndRole } = require('../utils/auth');
const cache = require('../utils/cache');

const router = express.Router();

// POST /auth/signup - User registration with Cognito
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password required' });
    }

    // Register user with Cognito
    const result = await signUpUser(username, email, password);

    res.json({
      message: 'User registered successfully. Please check your email for verification code.',
      userSub: result.UserSub,
      codeDeliveryDetails: result.CodeDeliveryDetails
    });

    console.log(`User registered: ${email}`);

  } catch (error) {
    console.error('Signup error:', error);

    // Handle Cognito-specific errors
    if (error.name === 'UsernameExistsException') {
      return res.status(400).json({ error: 'User already exists' });
    } else if (error.name === 'InvalidPasswordException') {
      return res.status(400).json({ error: 'Password does not meet requirements' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/confirm - Email confirmation
router.post('/confirm', async (req, res) => {
  try {
    const { email, confirmationCode } = req.body;

    if (!email || !confirmationCode) {
      return res.status(400).json({ error: 'Email and confirmation code required' });
    }

    // Confirm user registration
    await confirmSignUp(email, confirmationCode);

    res.json({
      message: 'Email confirmed successfully. You can now log in.'
    });

    console.log(`Email confirmed for user: ${email}`);

  } catch (error) {
    console.error('Confirmation error:', error);

    if (error.name === 'CodeMismatchException') {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    } else if (error.name === 'ExpiredCodeException') {
      return res.status(400).json({ error: 'Confirmation code has expired' });
    }

    res.status(500).json({ error: 'Email confirmation failed' });
  }
});

// POST /auth/login - User login with Cognito (now supports MFA challenges)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Authenticate with Cognito
    const result = await signInUser(email, password);

    // Check if MFA challenge is required
    if (result.ChallengeName) {
      return res.json({
        challengeName: result.ChallengeName,
        session: result.Session,
        challengeParameters: result.ChallengeParameters,
        message: 'MFA challenge required',
        requiresMFA: true
      });
    }

    // No MFA challenge - proceed with normal login
    const accessToken = result.AuthenticationResult.AccessToken;
    const idToken = result.AuthenticationResult.IdToken;
    const refreshToken = result.AuthenticationResult.RefreshToken;

    // Decode the ID token to get user information
    const decodedToken = jwt.decode(idToken);

    // Invalidate any existing cached user session (fresh login)
    await cache.invalidateUserSession(decodedToken.sub);

    // Return success response with tokens
    res.json({
      message: 'Login successful',
      accessToken,
      idToken,
      refreshToken,
      user: {
        sub: decodedToken.sub,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      }
    });

    console.log(`User logged in: ${email}`);

  } catch (error) {
    console.error('Login error:', error);

    if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ error: 'Invalid email or password' });
    } else if (error.name === 'UserNotConfirmedException') {
      return res.status(400).json({ error: 'Please confirm your email before logging in' });
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/google - Redirect to Google OAuth
router.get('/google', async (req, res) => {
  try {
    const cognitoConfig = await getCognitoConfig();

    const googleAuthUrl = `${cognitoConfig.hostedUIUrl}/oauth2/authorize` +
      `?identity_provider=Google` +
      `&redirect_uri=${encodeURIComponent(cognitoConfig.redirectUri)}` +
      `&response_type=code` +
      `&client_id=${cognitoConfig.clientId}` +
      `&scope=email+openid+profile`;

    console.log('Redirecting to Google OAuth:', googleAuthUrl);
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Failed to get Cognito config for Google OAuth:', error);
    res.status(500).json({ error: 'OAuth configuration failed' });
  }
});

// GET /auth/callback - OAuth callback (for hosted UI integration)
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    console.log('OAuth callback received:', { code: code ? 'present' : 'missing', error });

    if (error) {
      console.error('OAuth error:', error);
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }

    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    console.log('Token exchange successful');

    // Decode the ID token to get user information
    const idToken = tokenData.id_token;
    const decodedToken = jwt.decode(idToken);

    console.log('Federated user logged in:', decodedToken.email);

    // Return success response with tokens (similar to regular login)
    res.json({
      message: 'Federated login successful',
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      refreshToken: tokenData.refresh_token,
      user: {
        sub: decodedToken.sub,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        givenName: decodedToken.given_name,
        familyName: decodedToken.family_name,
        provider: 'Google',
        isFederated: true
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth callback failed: ' + error.message });
  }
});

// GET /auth/me - Get current user info including groups
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.username;

    // Try cache first
    let userInfo = await cache.getUserSession(userId);

    if (!userInfo) {
      // Cache miss - build user info
      const { userRole } = getUserIdAndRole(req.user);
      userInfo = {
        sub: req.user.sub,
        email: req.user.email,
        username: req.user.username,
        groups: req.user.groups,
        role: userRole,  // Add role field for frontend
        isCognito: req.user.isCognito,
        lastAccess: new Date().toISOString()
      };

      // Cache for 1 hour
      await cache.cacheUserSession(userId, userInfo);
    } else {
      // Update last access time
      userInfo.lastAccess = new Date().toISOString();
      await cache.cacheUserSession(userId, userInfo);
    }

    res.json(userInfo);
  } catch (error) {
    console.error('Error in /auth/me:', error);
    // Fallback to basic response
    const { userRole } = getUserIdAndRole(req.user);
    res.json({
      sub: req.user.sub,
      email: req.user.email,
      username: req.user.username,
      groups: req.user.groups,
      role: userRole,  // Add role field for frontend
      isCognito: req.user.isCognito
    });
  }
});

// GET /auth/admin-test - Test admin-only endpoint
router.get('/admin-test', authenticateToken, requireGroups('admin'), (req, res) => {
  res.json({
    message: 'Admin access granted!',
    user: req.user.email,
    groups: req.user.groups
  });
});

// POST /auth/mfa/challenge - Respond to MFA challenge
router.post('/mfa/challenge', async (req, res) => {
  try {
    const { session, challengeName, challengeResponse, username } = req.body;

    if (!session || !challengeName || !challengeResponse || !username) {
      return res.status(400).json({
        error: 'Session, challenge name, challenge response, and username are required'
      });
    }

    // Respond to the MFA challenge
    const result = await respondToMFAChallenge(session, challengeName, challengeResponse, username);

    if (result.AuthenticationResult) {
      const accessToken = result.AuthenticationResult.AccessToken;
      const idToken = result.AuthenticationResult.IdToken;
      const refreshToken = result.AuthenticationResult.RefreshToken;

      // Decode the ID token to get user information
      const decodedToken = jwt.decode(idToken);

      res.json({
        message: 'MFA verification successful',
        accessToken,
        idToken,
        refreshToken,
        user: {
          sub: decodedToken.sub,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified
        }
      });

      console.log(`MFA completed for user: ${username}`);
    } else {
      // Another challenge might be required
      res.json({
        challengeName: result.ChallengeName,
        session: result.Session,
        challengeParameters: result.ChallengeParameters,
        message: 'Additional challenge required'
      });
    }

  } catch (error) {
    console.error('MFA challenge error:', error);

    if (error.name === 'CodeMismatchException') {
      return res.status(400).json({ error: 'Invalid MFA code' });
    } else if (error.name === 'ExpiredCodeException') {
      return res.status(400).json({ error: 'MFA code has expired' });
    } else if (error.name === 'NotAuthorizedException') {
      return res.status(401).json({ error: 'MFA verification failed' });
    }

    res.status(500).json({ error: 'MFA challenge failed' });
  }
});

// POST /auth/mfa/setup/totp - Start TOTP setup
router.post('/mfa/setup/totp', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isCognito) {
      return res.status(400).json({ error: 'TOTP setup only available for Cognito users' });
    }

    // Get access token from request headers
    const accessToken = req.headers.authorization.split(' ')[1];

    // Associate software token
    const result = await associateSoftwareToken(accessToken);

    res.json({
      message: 'TOTP setup initiated',
      secretCode: result.SecretCode,
      qrCodeData: `otpauth://totp/VideoTranscoder:${req.user.email}?secret=${result.SecretCode}&issuer=VideoTranscoder`,
      setupInstructions: [
        '1. Install an authenticator app (Google Authenticator, Authy, Microsoft Authenticator)',
        '2. Scan the QR code or manually enter the secret code',
        '3. Enter the 6-digit code from your authenticator app to complete setup'
      ]
    });

    console.log(`TOTP setup initiated for user: ${req.user.email}`);

  } catch (error) {
    console.error('TOTP setup error:', error);

    if (error.name === 'InvalidParameterException') {
      return res.status(400).json({ error: 'TOTP already set up for this user' });
    }

    res.status(500).json({ error: 'TOTP setup failed' });
  }
});

// POST /auth/mfa/setup/totp/verify - Complete TOTP setup
router.post('/mfa/setup/totp/verify', authenticateToken, async (req, res) => {
  try {
    const { userCode } = req.body;

    if (!userCode || userCode.length !== 6) {
      return res.status(400).json({ error: '6-digit verification code required' });
    }

    if (!req.user.isCognito) {
      return res.status(400).json({ error: 'TOTP verification only available for Cognito users' });
    }

    // Get access token from request headers
    const accessToken = req.headers.authorization.split(' ')[1];

    // Verify the software token
    const result = await verifySoftwareToken(accessToken, userCode);

    if (result.Status === 'SUCCESS') {
      // Set TOTP as preferred MFA method
      await setMFAPreference(accessToken, 'DISABLED', 'PREFERRED');

      res.json({
        message: 'TOTP setup completed successfully',
        status: result.Status,
        mfaEnabled: true,
        preferredMethod: 'TOTP'
      });

      console.log(`TOTP setup completed for user: ${req.user.email}`);
    } else {
      res.status(400).json({
        error: 'TOTP verification failed',
        status: result.Status
      });
    }

  } catch (error) {
    console.error('TOTP verification error:', error);

    if (error.name === 'CodeMismatchException') {
      return res.status(400).json({ error: 'Invalid verification code' });
    } else if (error.name === 'EnableSoftwareTokenMFAException') {
      return res.status(400).json({ error: 'Invalid verification code or token expired' });
    }

    res.status(500).json({ error: 'TOTP verification failed' });
  }
});

// POST /auth/mfa/setup/sms - Setup SMS MFA
router.post('/mfa/setup/sms', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be in international format (+1234567890)' });
    }

    if (!req.user.isCognito) {
      return res.status(400).json({ error: 'SMS MFA only available for Cognito users' });
    }

    // Update user's phone number
    await updateUserPhoneNumber(req.user.username, phoneNumber);

    // Get access token and set SMS as preferred MFA
    const accessToken = req.headers.authorization.split(' ')[1];
    await setMFAPreference(accessToken, 'PREFERRED', 'DISABLED');

    res.json({
      message: 'SMS MFA setup completed',
      phoneNumber: phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, '$1****$2'), // Mask phone number
      mfaEnabled: true,
      preferredMethod: 'SMS'
    });

    console.log(`SMS MFA setup completed for user: ${req.user.email}`);

  } catch (error) {
    console.error('SMS MFA setup error:', error);

    if (error.name === 'InvalidParameterException') {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    res.status(500).json({ error: 'SMS MFA setup failed' });
  }
});

// GET /auth/mfa/status - Get MFA status for current user
router.get('/mfa/status', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isCognito) {
      return res.json({
        mfaEnabled: false,
        message: 'MFA only available for Cognito users'
      });
    }

    // Get access token from request headers
    const accessToken = req.headers.authorization.split(' ')[1];

    // Get user details to check MFA preferences
    const userDetails = await getUserDetails(accessToken);

    const mfaOptions = userDetails.MFAOptions || [];
    const preferredMfa = userDetails.PreferredMfaSetting;
    const userMfaSettings = userDetails.UserMFASettingList || [];

    res.json({
      mfaEnabled: mfaOptions.length > 0 || userMfaSettings.length > 0,
      preferredMfaMethod: preferredMfa,
      enabledMfaMethods: userMfaSettings,
      mfaOptions: mfaOptions.map(option => ({
        deliveryMedium: option.DeliveryMedium,
        attributeName: option.AttributeName
      }))
    });

  } catch (error) {
    console.error('MFA status check error:', error);
    res.status(500).json({ error: 'Failed to check MFA status' });
  }
});

// POST /auth/mfa/disable - Disable MFA for user
router.post('/mfa/disable', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isCognito) {
      return res.status(400).json({ error: 'MFA management only available for Cognito users' });
    }

    // Get access token from request headers
    const accessToken = req.headers.authorization.split(' ')[1];

    // Disable both SMS and TOTP MFA
    await setMFAPreference(accessToken, 'DISABLED', 'DISABLED');

    res.json({
      message: 'MFA disabled successfully',
      mfaEnabled: false
    });

    console.log(`MFA disabled for user: ${req.user.email}`);

  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

module.exports = router;