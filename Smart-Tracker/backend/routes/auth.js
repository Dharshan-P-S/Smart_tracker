const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, profilePicture } = req.body;

  try {
    let userByEmail = await User.findOne({ email });
    if (userByEmail) {
      return res.status(400).json({ msg: 'User already exists with this email address.' });
    }

    let userByName = await User.findOne({ name });
    if (userByName) {
      return res.status(400).json({ msg: 'This username is already taken. Please choose another.' });
    }

    user = new User({
      name,
      email,
      password,
      profilePicture: profilePicture || null,
    });

    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 3600 },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );

  } catch (err) {
    console.error('Registration Server Error:', err.message);
    if (err.code === 11000) {
        if (err.keyPattern && err.keyPattern.email) {
            return res.status(400).json({ msg: 'Email already in use (controller fallback).' });
        }
        if (err.keyPattern && err.keyPattern.name) {
            return res.status(400).json({ msg: 'Username already taken (controller fallback).' });
        }
    }
    res.status(500).send('Server error during registration');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token (Login)
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    let user = await User.findOne({ name: username }).select('+password');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

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

// @route   POST api/auth/check-availability
// @desc    Check if email or username is already taken
// @access  Public
router.post('/check-availability', async (req, res) => {
  const { email, name } = req.body;

  try {
    let emailExists = false;
    let nameExists = false;

    if (email) {
      const userByEmail = await User.findOne({ email: email.toLowerCase() }); // Case-insensitive email check
      if (userByEmail) {
        emailExists = true;
      }
    }

    if (name) {
      // Usernames are often case-sensitive, but if you want case-insensitive check:
      // const userByName = await User.findOne({ name: new RegExp(`^${name}$`, 'i') });
      const userByName = await User.findOne({ name });
      if (userByName) {
        nameExists = true;
      }
    }

    res.json({ emailExists, nameExists });

  } catch (err) {
    console.error('Check availability error:', err.message);
    res.status(500).send('Server error checking availability');
  }
});

module.exports = router;