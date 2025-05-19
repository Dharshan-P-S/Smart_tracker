const User = require('../models/User');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// --- INSECURE PLACEHOLDER ---
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

const otpStorage = {};

const getUserProfile = async (req, res) => {
  console.log("Attempting to fetch user profile...");
  try {
    const userId = await getPlaceholderUserId(); // Use placeholder / In real app: req.user.id
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
    console.error('Error fetching user profile in Controller:', error);
    if (error.message.includes("No users found")) {
      return res.status(500).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error while fetching user profile.' });
  }
};

const updateProfilePicture = async (req, res) => {
  console.log("Attempting to update user profile picture...");
  try {
    const userId = await getPlaceholderUserId(); // In real app: req.user.id
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
    console.error('Error updating user profile picture in Controller:', error);
    if (error.message.includes("No users found")) {
      return res.status(500).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error while updating user profile picture.' });
  }
};

const updateUserName = async (req, res) => {
  console.log("Attempting to update user name...");
  try {
    const userId = await getPlaceholderUserId(); // In real app: req.user.id
    console.log("Using placeholder User ID for name update:", userId);

    const user = await User.findById(userId);

    if (user) {
      const newName = req.body.name;

      if (newName && newName.trim() !== '' && newName !== user.name) {
        // Check if the new name is already taken by another user
        const existingUserWithNewName = await User.findOne({ name: newName });
        if (existingUserWithNewName && existingUserWithNewName._id.toString() !== userId.toString()) {
          return res.status(400).json({ message: 'This username is already taken by another account.' });
        }
        user.name = newName;
      } else if (newName && newName.trim() === '') {
        return res.status(400).json({ message: 'Name cannot be empty.' });
      } else if (!req.body.hasOwnProperty('name')) {
         // If 'name' is not in the body, do nothing or return current state
         // For this PUT request, it's implied 'name' should be there if an update is intended
        return res.status(400).json({ message: 'Name field is required for update.' });
      }
      // If newName is same as current name, or if newName is not provided but field exists (e.g. empty string not caught above)
      // the save operation will proceed. The Mongoose unique index on UserSchema for 'name' is the final guard.

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
    console.error('Error updating user name in Controller:', error);
    if (error.message.includes("No users found")) {
      return res.status(500).json({ message: error.message });
    }
    // Handle potential duplicate key error from Mongoose (though explicit check is preferred)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
        return res.status(400).json({ message: 'This username is already taken (DB constraint).' });
    }
    res.status(500).json({ message: 'Server error while updating user name.' });
  }
};

const sendOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStorage[email.toLowerCase()] = { // Store OTP against lowercase email
      otp: otp,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    };
    console.log(`OTP generated for ${email}: ${otp}`);

    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || "smartfinancetracker@gmail.com",
        pass: process.env.EMAIL_PASS || "qfes ezlr asgy kufc",
      },
    });

    await transporter.sendMail({
      from: `"Smart Tracker" <${process.env.EMAIL_USER || "smartfinancetracker@gmail.com"}>`,
      to: email,
      subject: "Your OTP for Smart Tracker",
      text: `Your One-Time Password (OTP) is: ${otp}. It is valid for 5 minutes.`,
      html: `<p>Your One-Time Password (OTP) is: <b>${otp}</b>.</p><p>It is valid for 5 minutes.</p>`,
    });

    console.log("OTP Email Message sent");
    res.json({ message: "OTP sent successfully to your email address." });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Server error while sending OTP. Please try again later.' });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const storedOtpData = otpStorage[email.toLowerCase()]; // Check against lowercase email

  if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expires > Date.now()) {
    console.log(`OTP verified successfully for ${email}`);
    res.json({ message: "OTP verified successfully" });
  } else if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expires <= Date.now()) {
    console.log(`OTP expired for ${email}`);
    delete otpStorage[email.toLowerCase()];
    res.status(400).json({ message: "OTP has expired. Please request a new one." });
  } else {
    console.log(`Invalid OTP attempt for ${email}`);
    res.status(400).json({ message: "Invalid or expired OTP." });
  }
};

const updateEmail = async (req, res) => {
  const { newEmail, otp } = req.body;
  console.log(`Attempting to update email to ${newEmail}...`);

  if (!newEmail || !otp) {
    return res.status(400).json({ message: "New email and OTP are required." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ message: "Invalid new email format." });
    }

  try {
    const userId = await getPlaceholderUserId(); // In real app: req.user.id
    console.log("Using placeholder User ID for email update:", userId);

    const storedOtpData = otpStorage[newEmail.toLowerCase()]; // Check against lowercase email
    if (!storedOtpData || storedOtpData.otp !== otp) {
      console.log(`Invalid OTP for new email ${newEmail}`);
      return res.status(400).json({ message: "Invalid OTP provided." });
    }
    if (storedOtpData.expires <= Date.now()) {
      console.log(`OTP expired for new email ${newEmail}`);
      delete otpStorage[newEmail.toLowerCase()];
      return res.status(400).json({ message: "OTP has expired. Please request a new one to change your email." });
    }

    const existingUserWithNewEmail = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUserWithNewEmail && existingUserWithNewEmail._id.toString() !== userId.toString()) {
      return res.status(400).json({ message: "This email address is already in use by another account." });
    }

    const user = await User.findById(userId);

    if (user) {
      user.email = newEmail.toLowerCase(); // Store email in lowercase
      const updatedUser = await user.save();
      delete otpStorage[newEmail.toLowerCase()];

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
    console.error('Error updating user email in Controller:', error);
    if (error.message.includes("No users found")) {
      return res.status(500).json({ message: error.message });
    }
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({ message: "This email address is already in use (DB constraint)." });
    }
    res.status(500).json({ message: 'Server error while updating user email.' });
  }
};

module.exports = {
  getUserProfile,
  updateProfilePicture,
  updateUserName,
  sendOTP,
  verifyOTP,
  updateEmail,
};