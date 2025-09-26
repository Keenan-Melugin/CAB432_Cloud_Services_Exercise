const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Cognito JWKS client for token verification
const cognitoJwksClient = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_NxyJMYl5Z'}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

function getKey(header, callback) {
  cognitoJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('JWKS key retrieval error:', err);
      return callback(err);
    }

    if (!key) {
      console.error('No key found for kid:', header.kid);
      return callback(new Error('Unable to find a signing key that matches'));
    }

    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Middleware to verify JWT token (supports both Cognito and legacy tokens)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // First check if this looks like a Cognito JWT (has 3 parts)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.error('Malformed JWT token: expected 3 parts, got', tokenParts.length);
    return res.status(403).json({ error: 'Malformed token' });
  }

  // Try to verify as Cognito token first
  jwt.verify(token, getKey, {
    issuer: `https://cognito-idp.${process.env.COGNITO_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_NxyJMYl5Z'}`,
    algorithms: ['RS256']
  }, (err, decoded) => {
    if (!err) {
      // Cognito token verified successfully
      console.log('Cognito token verified for user:', decoded.email || decoded.username);
      req.user = {
        sub: decoded.sub,
        email: decoded.email || decoded.username,
        username: decoded['cognito:username'],
        tokenUse: decoded.token_use,
        groups: decoded['cognito:groups'] || [],
        isCognito: true
      };
      return next();
    }

    console.error('Cognito JWT verification failed:', err.message);

    // Fallback to legacy JWT verification for backward compatibility
    jwt.verify(token, JWT_SECRET, (legacyErr, user) => {
      if (legacyErr) {
        console.error('Legacy JWT verification also failed:', legacyErr.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      console.log('Legacy token verified for user:', user.username);
      req.user = user;
      req.user.isCognito = false;
      next();
    });
  });
}

// Group-based authorization middleware
function requireGroups(...requiredGroups) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.isCognito) {
      const userGroups = req.user.groups || [];
      const hasRequiredGroup = requiredGroups.some(group => userGroups.includes(group));

      if (!hasRequiredGroup) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredGroups,
          userGroups: userGroups
        });
      }
    } else {
      // Legacy role checking for backward compatibility
      if (req.user.role !== 'admin' && requiredGroups.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    next();
  };
}

// Middleware to check admin role (updated for Cognito Groups)
function requireAdmin(req, res, next) {
  return requireGroups('admin')(req, res, next);
}

// Helper function to get user ID and role for both Cognito and legacy users
function getUserIdAndRole(user) {
  if (user.isCognito) {
    return {
      userId: user.sub,
      userRole: user.groups?.includes('admin') ? 'admin' : 'user'
    };
  } else {
    return {
      userId: user.id,
      userRole: user.role
    };
  }
}

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireGroups,
  generateToken,
  getUserIdAndRole,
  JWT_SECRET
};