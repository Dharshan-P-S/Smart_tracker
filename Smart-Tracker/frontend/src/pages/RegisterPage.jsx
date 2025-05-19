import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import styles from './RegisterPage.module.css';

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    password2: ''
  });
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false); // Covers checking availability + sending OTP
  const [profilePicture, setProfilePicture] = useState(null); // Base64 string
  const [profilePictureFile, setProfilePictureFile] = useState(null); // File object for display

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false); // For final registration loading

  const fileInputRef = useRef(null);
  const { name, email, password, password2 } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const onOtpChange = (e) => {
    setOtp(e.target.value);
    setError('');
    setSuccess('');
  };

  const handleProfilePicChange = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setProfilePicture(null);
      setProfilePictureFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError("Please select an image file (e.g., JPG, PNG).");
      setProfilePicture(null);
      setProfilePictureFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setError("Image size should be less than 2MB.");
      setProfilePicture(null);
      setProfilePictureFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setProfilePictureFile(file);
    setError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setProfilePicture(reader.result);
    };
    reader.onerror = () => {
      console.error("Error reading file for profile picture.");
      setError('Failed to read profile picture.');
      setProfilePicture(null);
      setProfilePictureFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
  };

  const handleSendOtp = async () => {
    // Client-side validation before hitting the backend
    if (!name.trim()) {
        setError('Please enter a username.');
        return;
    }
    if (!email) {
      setError('Please enter your email address to receive an OTP.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
     if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== password2) {
      setError('Passwords do not match.');
      return;
    }


    setIsSendingOtp(true);
    setError('');
    setSuccess('');

    try {
      // Step 1: Check username and email availability simultaneously
      // IMPORTANT: Replace with your actual backend URL if needed
      const availabilityRes = await axios.post('http://localhost:5000/api/auth/check-availability', { email, name });

      if (availabilityRes.data.nameExists) {
        setError('This username is already taken. Please choose another.');
        setIsOtpSent(false);
        setIsSendingOtp(false);
        return;
      }
      if (availabilityRes.data.emailExists) {
        setError('This email address is already registered. Please log in or use a different email.');
        setIsOtpSent(false);
        setIsSendingOtp(false);
        return;
      }

      // Step 2: Send OTP if both username and email are available
      // IMPORTANT: Replace with your actual backend URL if needed
      await axios.post('http://localhost:5000/api/users/send-otp', { email });
      setSuccess('OTP sent to your email. Please check your inbox (and spam).');
      setIsOtpSent(true);
    } catch (err) {
      console.error('Send OTP or Availability Check error:', err.response?.data || err.message);
      setError(err.response?.data?.message || err.response?.data?.msg || 'Failed to process verification. Please try again.');
      setIsOtpSent(false);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Basic client-side validation (some already covered in handleSendOtp logic)
    if (!name || !email || !password || !password2) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== password2) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isOtpSent) {
      setError('Please verify your email address first by requesting and entering an OTP.');
      return;
    }
    if (!otp) {
      setError('Please enter the OTP sent to your email.');
      return;
    }
    if (otp.length !== 6) {
      setError('OTP must be 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Step 1: Verify OTP
      try {
        // IMPORTANT: Replace with your actual backend URL if needed
        await axios.post('http://localhost:5000/api/users/verify-otp', { email, otp });
      } catch (otpError) {
        console.error('OTP Verification error:', otpError.response?.data || otpError.message);
        setError(otpError.response?.data?.message || 'OTP verification failed. Please check the OTP or request a new one.');
        setLoading(false);
        return;
      }

      // Step 2: Register User
      const newUser = {
        name,
        email,
        password,
        profilePicture: profilePicture
      };

      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const body = JSON.stringify(newUser);

      // IMPORTANT: Replace with your actual backend URL if needed
      const res = await axios.post('http://localhost:5000/api/auth/register', body, config);

      console.log('Registration successful:', res.data);
      setSuccess('Registration successful! You can now log in.');
      setFormData({ name: '', email: '', password: '', password2: '' });
      setOtp('');
      setProfilePicture(null);
      setProfilePictureFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsOtpSent(false);

    } catch (err) {
      console.error('Registration error:', err.response?.data || err.message);
      setError(err.response?.data?.msg || err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registerContainer}>
      <div className={styles.registerBox}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Start tracking your finances today!</p>
        <form onSubmit={onSubmit} className={styles.registerForm}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          {success && <p className={styles.successMessage}>{success}</p>}

          {/* Profile Picture Upload Section - CORRECTED JSX */}
          <div className={styles.profilePicUploadContainer}>
            <label htmlFor="profilePicInput" className={styles.profilePicLabel}>
              {profilePicture ? (
                <img src={profilePicture} alt="Preview" className={styles.profilePreviewImage} />
              ) : (
                <span className={styles.profilePicPlaceholderText}>
                  Upload Picture (Optional)
                </span>
              )}
            </label>
            <input
              type="file"
              id="profilePicInput" // ID must match htmlFor
              accept="image/*"
              onChange={handleProfilePicChange}
              className={styles.inputFileHidden} // Keep it hidden
              ref={fileInputRef}
              disabled={isSendingOtp || loading}
            />
            {profilePictureFile && (
                <p className={styles.fileNameDisplay}>
                    {profilePictureFile.name.length > 25 
                        ? profilePictureFile.name.substring(0, 22) + "..." 
                        : profilePictureFile.name}
                </p>
            )}
          </div>


          {/* Username Input */}
          <div className={styles.inputGroup}>
            <input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={onChange}
              required
              className={styles.input}
              placeholder=" "
              disabled={isOtpSent || isSendingOtp || loading}
            />
            <label htmlFor="name" className={styles.label}>Username</label>
          </div>

          {/* Email Input */}
          <div className={styles.inputGroup}>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={onChange}
              required
              className={styles.input}
              placeholder=" "
              disabled={isOtpSent || isSendingOtp || loading}
            />
            <label htmlFor="email" className={styles.label}>Email Address</label>
          </div>

          {/* Password Input */}
          <div className={styles.inputGroup}>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={onChange}
              required
              className={styles.input}
              placeholder=" "
              disabled={isSendingOtp || loading}
            />
            <label htmlFor="password" className={styles.label}>Password</label>
          </div>

          {/* Confirm Password Input */}
          <div className={styles.inputGroup}>
            <input
              type="password"
              id="password2"
              name="password2"
              value={password2}
              onChange={onChange}
              required
              className={styles.input}
              placeholder=" "
              disabled={isSendingOtp || loading}
            />
            <label htmlFor="password2" className={styles.label}>Confirm Password</label>
          </div>

          {!isOtpSent ? (
            <button
              type="button"
              onClick={handleSendOtp}
              className={`${styles.button} ${styles.otpButton}`}
              disabled={isSendingOtp || loading || !name.trim() || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || !password || password.length < 6 || password !== password2}
              title={(!name.trim() || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || !password || password.length < 6 || password !== password2) ? "Please fill all fields correctly first" : "Verify & Send OTP"}
            >
              {isSendingOtp ? 'Verifying...' : 'Verify & Send OTP'}
            </button>
          ) : (
            <div className={styles.inputGroup}>
              <input
                type="text"
                id="otp"
                name="otp"
                value={otp}
                onChange={onOtpChange}
                required={isOtpSent}
                className={styles.input}
                placeholder=" "
                maxLength="6"
                disabled={loading}
              />
              <label htmlFor="otp" className={styles.label}>Enter 6-digit OTP</label>
            </div>
          )}

          <button
            type="submit"
            className={`${styles.button} ${styles.submitButton}`} // Added specific class for main submit
            disabled={loading || isSendingOtp || !isOtpSent || !otp || otp.length !== 6}
            title={!isOtpSent ? "Please verify email with OTP first" : (!otp || otp.length !== 6) ? "Please enter a valid 6-digit OTP" : "Register"}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className={styles.loginLink}>
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;