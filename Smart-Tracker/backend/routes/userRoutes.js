const express = require('express');
const {
    getUserProfile,
    updateProfilePicture,
    updateUserName,
    sendOTP,
    verifyOTP,
    updateEmail // This should now be correctly imported
} = require('../controllers/userController');
// const { protect } = require('../middleware/authMiddleware'); // Assuming protect middleware exists

const router = express.Router();

// --- Public Routes for OTP ---
// POST /api/users/send-otp - Send OTP to email
router.post('/send-otp', sendOTP);

// POST /api/users/verify-otp - Verify OTP (can be a standalone verification)
router.post('/verify-otp', verifyOTP);


// --- Protected Routes (using placeholder user ID for now) ---
// In a real app, you would apply 'protect' middleware here, e.g.:
// router.use(protect);

// GET /api/users/me - Get current user's profile
router.get('/me', getUserProfile);

// PUT /api/users/me/profile-picture - Update current user's profile picture
router.put('/me/profile-picture', updateProfilePicture);

// PUT /api/users/me/name - Update current user's name
router.put('/me/name', updateUserName);

// PUT /api/users/me/update-email - Update user email (requires OTP verification flow)
// Suggestion: Route changed for consistency from '/update-email' to '/me/update-email'
router.put('/me/update-email', updateEmail);


module.exports = router;