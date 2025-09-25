const express = require('express');
const jwt = require('jsonwebtoken');
const { signUpUser, confirmSignUp, signInUser } = require('../utils/cognito');

const router = express.Router();

// POST /auth/signup - User registration with Cognito
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Register user with Cognito
    const result = await signUpUser(email, password);

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

// POST /auth/login - User login with Cognito
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Authenticate with Cognito
    const result = await signInUser(email, password);

    const accessToken = result.AuthenticationResult.AccessToken;
    const idToken = result.AuthenticationResult.IdToken;
    const refreshToken = result.AuthenticationResult.RefreshToken;

    // Decode the ID token to get user information
    const decodedToken = jwt.decode(idToken);

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

// GET /auth/callback - OAuth callback (for hosted UI integration)
router.get('/callback', (req, res) => {
  // This endpoint will handle OAuth callbacks from Cognito hosted UI
  const { code, state } = req.query;

  if (code) {
    // In a full implementation, you would exchange the code for tokens here
    res.json({ message: 'OAuth callback received', code, state });
  } else {
    res.status(400).json({ error: 'No authorization code received' });
  }
});

module.exports = router;