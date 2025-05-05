const User = require('../models/User');
const mongoose = require('mongoose');

// --- INSECURE PLACEHOLDER ---
// Reusing the placeholder logic from other controllers for consistency.
// In a real app, req.user.id would come from authentication middleware.
const getPlaceholderUserId = async () => {
    if (!User) {
        throw new Error("User model not available.");
    }
    const firstUser = await User.findOne().select('_id').lean();
    if (!firstUser) {
        throw new Error("No users found in the database to use as a placeholder.");
    }
    return firstUser._id;
};
// --- END INSECURE PLACEHOLDER ---

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private (using placeholder ID for now)
const getUserProfile = async (req, res) => {
    console.log("Attempting to fetch user profile...");
    try {
        const userId = await getPlaceholderUserId(); // Use placeholder
        console.log("Using placeholder User ID for profile:", userId);

        // Find user by the placeholder ID
        // Select necessary fields, including createdAt and profilePicture
        const user = await User.findById(userId).select('name email createdAt profilePicture');

        if (user) {
            console.log("User profile fetched successfully:", user.email);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture, // Include profile picture
                createdAt: user.createdAt, // Include registration date
            });
        } else {
            // This case should ideally not happen with the placeholder if a user exists
            console.error(`User not found with placeholder ID: ${userId}`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error fetching user profile in Controller:');
        console.error('!!! Error:', error);
        if (error.message.includes("No users found")) {
             console.error('!!! Placeholder User ID issue.');
             return res.status(500).json({ message: error.message });
        }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while fetching user profile.' });
    }
};

// @desc    Update user profile picture
// @route   PUT /api/users/me/profile-picture
// @access  Private (using placeholder ID for now)
const updateProfilePicture = async (req, res) => {
    console.log("Attempting to update user profile picture...");
    try {
        const userId = await getPlaceholderUserId(); // Use placeholder
        console.log("Using placeholder User ID for profile picture update:", userId);

        const user = await User.findById(userId);

        if (user) {
            user.profilePicture = req.body.profilePicture || user.profilePicture;

            const updatedUser = await user.save();

            console.log("User profile picture updated successfully for user:", updatedUser.email);
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                profilePicture: updatedUser.profilePicture,
                createdAt: updatedUser.createdAt,
            });
        } else {
            console.error(`User not found with placeholder ID: ${userId}`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error updating user profile picture in Controller:');
        console.error('!!! Error:', error);
        if (error.message.includes("No users found")) {
             console.error('!!! Placeholder User ID issue.');
             return res.status(500).json({ message: error.message });
        }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while updating user profile picture.' });
    }
};


module.exports = {
    getUserProfile,
    updateProfilePicture,
};
