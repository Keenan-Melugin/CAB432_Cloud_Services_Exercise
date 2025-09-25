const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Cognito JWKS client for token verification
const cognitoJwksClient = jwksClient({
  jwksUri: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_WgItmnqik/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

function getKey(header, callback) {
  cognitoJwksClient.getSigningKey(header.kid, (err, key) => {
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

  // Try to verify as Cognito token first
  jwt.verify(token, getKey, {
    issuer: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_WgItmnqik',
    algorithms: ['RS256']
  }, (err, decoded) => {
    if (!err) {
      // Cognito token verified successfully
      req.user = {
        sub: decoded.sub,
        email: decoded.email || decoded.username,
        tokenUse: decoded.token_use,
        isCognito: true
      };
      return next();
    }

    // Fallback to legacy JWT verification for backward compatibility
    jwt.verify(token, JWT_SECRET, (legacyErr, user) => {
      if (legacyErr) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      req.user = user;
      req.user.isCognito = false;
      next();
    });
  });
}

// Middleware to check admin role (updated for Cognito)
function requireAdmin(req, res, next) {
  if (req.user.isCognito) {
    // For Cognito users, check if email contains 'admin' or implement proper group checking
    // This is a temporary solution - Phase 3 will implement proper user groups
    if (!req.user.email || !req.user.email.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } else {
    // Legacy role checking
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  }
  next();
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
  generateToken,
  JWT_SECRET
};