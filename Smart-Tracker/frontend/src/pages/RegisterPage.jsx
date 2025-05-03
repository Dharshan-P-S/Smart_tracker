import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; // Import Link
import styles from './RegisterPage.module.css'; // Use new CSS module

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '', // Changed from 'username' in label to 'name' for state/backend
    email: '',
    password: '',
    password2: '' // Confirm password field
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // Add success message state
  const [loading, setLoading] = useState(false);

  const { name, email, password, password2 } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear errors on change
    setSuccess(''); // Clear success message on change
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    // Basic Validation
    if (!name || !email || !password || !password2) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== password2) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const newUser = {
        name,
        email,
        password
      };

      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const body = JSON.stringify(newUser);

      // IMPORTANT: Replace with your actual backend URL if needed
      const res = await axios.post('http://localhost:5000/api/auth/register', body, config);

      console.log('Registration successful:', res.data); // res.data contains the JWT token
      setSuccess('Registration successful! You can now log in.'); // Set success message
      // Optionally clear form or redirect after a delay
      setFormData({ name: '', email: '', password: '', password2: '' });

    } catch (err) {
      console.error('Registration error:', err.response?.data || err.message);
      setError(err.response?.data?.msg || 'Registration failed. Please try again.');
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
          {success && <p className={styles.successMessage}>{success}</p>} {/* Display Success Message */}

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
            />
            <label htmlFor="password2" className={styles.label}>Confirm Password</label>
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        {/* Use Link for navigation */}
        <p className={styles.loginLink}>
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage; 