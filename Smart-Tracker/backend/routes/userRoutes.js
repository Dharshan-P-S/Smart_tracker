const express = require('express');
const { getUserProfile } = require('../controllers/userController');
// const { protect } = require('../middleware/authMiddleware'); // Assuming protect middleware exists

const router = express.Router();

// Apply authentication middleware (using placeholder logic in controller for now)
// router.use(protect); // Uncomment when real auth is implemented

// GET /api/users/me - Get current user's profile
router.get('/me', getUserProfile);

module.exports = router;
