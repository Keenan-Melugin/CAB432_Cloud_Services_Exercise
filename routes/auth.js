const express = require('express');
const bcrypt = require('bcrypt');
const database = require('../utils/database');
const { generateToken } = require('../utils/auth');

const router = express.Router();

// POST /auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user in database
    const user = await database.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return success response
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

    console.log(`User logged in: ${username} (${user.role})`);
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;