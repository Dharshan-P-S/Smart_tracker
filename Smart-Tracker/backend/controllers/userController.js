const User = require('../models/User');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

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

// In-memory storage for OTPs (for demonstration purposes)
// WARNING: In-memory storage is not suitable for production. It will be lost on server restart
// and does not scale across multiple server instances. Consider using a database (e.g., Redis) for OTPs.
const otpStorage = {};

// @desc    Get user profile
// @route   GET /api/users/me
// @access  Private (using placeholder ID for now)
const getUserProfile = async (req, res) => {
    console.log("Attempting to fetch user profile...");
    try {
        const userId = await getPlaceholderUserId(); // Use placeholder
        console.log("Using placeholder User ID for profile:", userId);

        const user = await User.findById(userId).select('name email createdAt profilePicture');

        if (user) {
            console.log("User profile fetched successfully:", user.email);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture,
                createdAt: user.createdAt,
            });
        } else {
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
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for profile picture update:", userId);

        const user = await User.findById(userId);

        if (user) {
            if (req.body.hasOwnProperty('profilePicture')) {
                user.profilePicture = req.body.profilePicture;
            }
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

// @desc    Update user name
// @route   PUT /api/users/me/name
// @access  Private (using placeholder ID for now)
const updateUserName = async (req, res) => {
    console.log("Attempting to update user name...");
    try {
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for name update:", userId);

        const user = await User.findById(userId);

        if (user) {
            if (req.body.hasOwnProperty('name')) {
                user.name = req.body.name;
            }
            const updatedUser = await user.save();
            console.log("User name updated successfully for user:", updatedUser.email);
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
        console.error('!!! Error updating user name in Controller:');
        console.error('!!! Error:', error);
        if (error.message.includes("No users found")) {
             console.error('!!! Placeholder User ID issue.');
             return res.status(500).json({ message: error.message });
        }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while updating user name.' });
    }
};

// @desc    Send OTP to email (for email update or other purposes)
// @route   POST /api/users/send-otp
// @access  Public
const sendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    try {
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP in memory with a timeout (e.g., 5 minutes)
        otpStorage[email] = {
            otp: otp,
            expires: Date.now() + 5 * 60 * 1000 // 5 minutes
        };
        console.log(`OTP generated for ${email}: ${otp}`);


        // Create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            service: 'gmail', // Consider making this configurable
            auth: {
                user: process.env.EMAIL_USER || "smartfinancetracker@gmail.com", // Use environment variables
                pass: process.env.EMAIL_PASS || "qfes ezlr asgy kufc",       // Use environment variables
            },
        });

        // Send mail with defined transport object
        let info = await transporter.sendMail({
            from: `"Smart Tracker" <${process.env.EMAIL_USER || "smartfinancetracker@gmail.com"}>`,
            to: email,
            subject: "Your OTP for Smart Tracker",
            text: `Your One-Time Password (OTP) is: ${otp}. It is valid for 5 minutes.`,
            html: `<p>Your One-Time Password (OTP) is: <b>${otp}</b>.</p><p>It is valid for 5 minutes.</p>`,
        });

        console.log("OTP Email Message sent: %s", info.messageId);

        res.json({
            message: "OTP sent successfully to your email address.",
            // DO NOT send OTP back in production for security reasons
            // otp: otp, // For debugging only, remove in production
        });
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error sending OTP:');
        console.error('!!! Email:', email);
        console.error('!!! Error:', error);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while sending OTP. Please try again later.' });
    }
};

// @desc    Verify OTP
// @route   POST /api/users/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOtpData = otpStorage[email];

    if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expires > Date.now()) {
        // OTP is valid and not expired
        // For a simple verification endpoint, just confirm.
        // If this is part of a larger flow (like email update),
        // you might not delete it here but in the subsequent step.
        // For now, let's assume this endpoint is just for verification.
        // If it's for email change, the email change function should delete it.
        // delete otpStorage[email]; //  Consider if OTP should be single-use for this specific endpoint
        console.log(`OTP verified successfully for ${email}`);
        res.json({ message: "OTP verified successfully" });
    } else if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expires <= Date.now()) {
        console.log(`OTP expired for ${email}`);
        delete otpStorage[email]; // Remove expired OTP
        res.status(400).json({ message: "OTP has expired. Please request a new one." });
    } else {
        console.log(`Invalid OTP attempt for ${email}`);
        res.status(400).json({ message: "Invalid or expired OTP." });
    }
};

// @desc    Update user email after OTP verification
// @route   PUT /api/users/me/update-email  (Changed route to be consistent with /me/*)
// @access  Private (using placeholder ID for now, requires OTP verification)
const updateEmail = async (req, res) => {
    const { newEmail, otp } = req.body; // Renamed 'email' to 'newEmail' for clarity
    console.log(`Attempting to update email to ${newEmail}...`);

    if (!newEmail || !otp) {
        return res.status(400).json({ message: "New email and OTP are required." });
    }

    try {
        const userId = await getPlaceholderUserId();
        console.log("Using placeholder User ID for email update:", userId);

        // Verify OTP against the newEmail
        const storedOtpData = otpStorage[newEmail];
        if (!storedOtpData || storedOtpData.otp !== otp) {
            console.log(`Invalid OTP for new email ${newEmail}`);
            return res.status(400).json({ message: "Invalid OTP provided." });
        }
        if (storedOtpData.expires <= Date.now()) {
            console.log(`OTP expired for new email ${newEmail}`);
            delete otpStorage[newEmail]; // Clean up expired OTP
            return res.status(400).json({ message: "OTP has expired. Please request a new one to change your email." });
        }

        // Check if new email already exists for another user
        const existingUserWithNewEmail = await User.findOne({ email: newEmail });
        if (existingUserWithNewEmail && existingUserWithNewEmail._id.toString() !== userId.toString()) {
            return res.status(400).json({ message: "This email address is already in use by another account." });
        }

        const user = await User.findById(userId);

        if (user) {
            user.email = newEmail; // Update to the new email
            const updatedUser = await user.save();

            delete otpStorage[newEmail]; // OTP used, delete it

            console.log("User email updated successfully for user ID:", userId, "New email:", updatedUser.email);
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                profilePicture: updatedUser.profilePicture,
                createdAt: updatedUser.createdAt,
                message: "Email updated successfully."
            });
        } else {
            console.error(`User not found with placeholder ID: ${userId}`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('!!! Error updating user email in Controller:');
        console.error('!!! Error:', error);
        if (error.message.includes("No users found")) {
             console.error('!!! Placeholder User ID issue.');
             return res.status(500).json({ message: error.message });
        }
        // Handle potential duplicate key error for email if not caught above (though should be)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
            return res.status(400).json({ message: "This email address is already in use." });
        }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Server error while updating user email.' });
    }
};


module.exports = {
    getUserProfile,
    updateProfilePicture,
    updateUserName,
    sendOTP,
    verifyOTP,
    updateEmail, // Added updateEmail to exports
};