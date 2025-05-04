import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import styles from './LoginPage.module.css'; // Import CSS Module

function LoginPage() {
  const navigate = useNavigate(); // Initialize navigate hook
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { username, password } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear error on change
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const body = JSON.stringify({ username, password });

      // IMPORTANT: Replace with your actual backend URL if it's not localhost:5000
      const res = await axios.post('http://localhost:5000/api/auth/login', body, config);

      console.log('Login successful:', res.data); // res.data contains the JWT token

      // Store token in localStorage
      localStorage.setItem('token', res.data.token);
      // Store username in localStorage again
      if (res.data.username) { // Check if username exists in response
        localStorage.setItem('username', res.data.username);
      }

      // Redirect to dashboard
      navigate('/dashboard'); // Navigate to the dashboard route

    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      setError(err.response?.data?.msg || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>Log in to track your finances</p>
        <form onSubmit={onSubmit} className={styles.loginForm}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.inputGroup}>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={onChange}
              required
              className={styles.input}
              placeholder=" "
            />
            <label htmlFor="username" className={styles.label}>Username</label>
          </div>
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
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        {/* Use Link for navigation */}
        <p className={styles.signupLink}>
          Don't have an account? <Link to="/register">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage; 