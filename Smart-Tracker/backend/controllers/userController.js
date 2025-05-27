const User = require('../models/User');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// OTP storage (in-memory, consider a more persistent solution for production)
const otpStorage = {};

const getUserProfile = async (req, res) => {
  console.log("Attempting to fetch user profile for logged-in user...");
  try {
    // req.user is populated by the 'protect' middleware
    if (!req.user || !req.user._id) {
      console.error("User not authenticated or user ID missing from request");
      return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id; // Use ID from authenticated user
    console.log("Using authenticated User ID for profile:", userId);

    // Fetch user details. Ensure 'name' is selected if your User model uses 'name'.
    const user = await User.findById(userId).select('name email createdAt profilePicture');

    if (user) {
      console.log("User profile fetched successfully:", user.email);
      res.json({
        _id: user._id,
        name: user.name, // Ensure your user model has 'name'
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
      });
    } else {
      console.error(`User not found with authenticated ID: ${userId}`);
      // This case implies the token is valid, but the user ID in token doesn't exist in DB.
      // This could happen if a user was deleted after the token was issued.
      res.status(404).json({ message: 'User associated with token not found' });
    }
  } catch (error) {
    console.error('Error fetching user profile in Controller:', error);
    res.status(500).json({ message: 'Server error while fetching user profile.' });
  }
};

const updateProfilePicture = async (req, res) => {
  console.log("Attempting to update user profile picture for authenticated user...");
  try {
    if (!req.user || !req.user._id) {
      console.error("User not authenticated or user ID missing from request");
      return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id; // Use ID from authenticated user
    console.log("Using authenticated User ID for profile picture update:", userId);

    const user = await User.findById(userId);

    if (user) {
      if (req.body.hasOwnProperty('profilePicture')) {
        user.profilePicture = req.body.profilePicture;
      }
      // else if no profilePicture in body, do nothing to the picture

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
      console.error(`User not found with authenticated ID: ${userId}`);
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user profile picture in Controller:', error);
    res.status(500).json({ message: 'Server error while updating user profile picture.' });
  }
};

const updateUserName = async (req, res) => {
  console.log("Attempting to update user name for authenticated user...");
  try {
    if (!req.user || !req.user._id) {
      console.error("User not authenticated or user ID missing from request");
      return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id; // Use ID from authenticated user
    console.log("Using authenticated User ID for name update:", userId);

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
        return res.status(400).json({ message: 'Name field is required for update.' });
      }
      // If newName is the same as current name, or if newName is not provided and not caught by above,
      // the save operation will proceed. Mongoose unique index on UserSchema for 'name' is the final guard.

      const updatedUser = await user.save();
      console.log("User name updated successfully for user:", updatedUser.email);
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        createdAt: updatedUser.createdAt,
        message: "Username updated successfully."
      });
    } else {
      console.error(`User not found with authenticated ID: ${userId}`);
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user name in Controller:', error);
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

    console.log("OTP Email Message sent to", email);
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
    // Do not delete OTP here if it's a two-step process (e.g., verify then update)
    // It will be deleted upon successful completion of the action (e.g., email update)
    res.json({ message: "OTP verified successfully" });
  } else if (storedOtpData && storedOtpData.otp === otp && storedOtpData.expires <= Date.now()) {
    console.log(`OTP expired for ${email}`);
    delete otpStorage[email.toLowerCase()]; // Clean up expired OTP
    res.status(400).json({ message: "OTP has expired. Please request a new one." });
  } else {
    console.log(`Invalid OTP attempt for ${email}`);
    res.status(400).json({ message: "Invalid or expired OTP." });
  }
};

const updateEmail = async (req, res) => {
  const { newEmail, otp } = req.body; // Client sends the new email and the OTP it received for that new email
  console.log(`Attempting to update email to ${newEmail} for authenticated user...`);

  if (!newEmail || !otp) {
    return res.status(400).json({ message: "New email and OTP are required." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ message: "Invalid new email format." });
  }

  try {
    if (!req.user || !req.user._id) {
      console.error("User not authenticated or user ID missing from request for email update");
      return res.status(401).json({ message: 'Not authorized, user information missing.' });
    }
    const userId = req.user._id; // Use ID from authenticated user
    console.log("Using authenticated User ID for email update:", userId);

    // OTP should have been sent to 'newEmail' and stored against 'newEmail'
    const storedOtpData = otpStorage[newEmail.toLowerCase()];
    if (!storedOtpData || storedOtpData.otp !== otp) {
      console.log(`Invalid OTP for new email ${newEmail}. OTP provided: ${otp}, Stored: ${storedOtpData ? storedOtpData.otp : 'N/A'}`);
      return res.status(400).json({ message: "Invalid OTP provided for the new email address." });
    }
    if (storedOtpData.expires <= Date.now()) {
      console.log(`OTP expired for new email ${newEmail}`);
      delete otpStorage[newEmail.toLowerCase()]; // Clean up expired OTP
      return res.status(400).json({ message: "OTP has expired. Please request a new one to change your email." });
    }

    // Check if the new email is already used by ANOTHER user
    const existingUserWithNewEmail = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUserWithNewEmail && existingUserWithNewEmail._id.toString() !== userId.toString()) {
      return res.status(400).json({ message: "This email address is already in use by another account." });
    }

    const user = await User.findById(userId);

    if (user) {
      if (user.email.toLowerCase() === newEmail.toLowerCase()) {
        delete otpStorage[newEmail.toLowerCase()]; // OTP was valid, clean it up
        return res.status(400).json({ message: "This is already your current email address." });
      }
      user.email = newEmail.toLowerCase(); // Store email in lowercase
      const updatedUser = await user.save();
      delete otpStorage[newEmail.toLowerCase()]; // Clean up OTP after successful update

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
      console.error(`User not found with authenticated ID: ${userId} during email update`);
      // This should ideally not happen if protect middleware ran correctly and user exists
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error updating user email in Controller:', error);
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      // This handles the race condition where another user might take the email
      // between the findOne check and save, or if the findOne check fails for some reason.
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