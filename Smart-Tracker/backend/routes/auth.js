const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Create new user instance (password will be hashed by pre-save hook)
    user = new User({
      name,
      email,
      password,
    });

    await user.save();

    // Create JWT Payload
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Need to add JWT_SECRET to .env
      { expiresIn: 3600 }, // Expires in 1 hour (adjust as needed)
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token (Login)
// @access  Public
router.post('/login', async (req, res) => {
  // Destructure username and password from request body
  const { username, password } = req.body;

  try {
    // Find user by username (name field in DB)
    let user = await User.findOne({ name: username }).select('+password');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Compare password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Create JWT Payload
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 3600 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, username: user.name });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router; 