import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/TransactionsPage';
import IncomePage from './pages/IncomePage';
import ExpensePage from './pages/ExpensePage';
import LimitsPage from './pages/LimitsPage';
import OldTransactionsPage from './pages/OldTransactionsPage';
import SavingsPage from './pages/SavingsPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './routing/ProtectedRoute';
import Layout from './components/Layout';
import './App.css';

function App() {
  // State to hold the current theme for ToastContainer
  const [toastTheme, setToastTheme] = useState('light'); // Default to light

  useEffect(() => {
    // Function to check and set the theme
    const checkTheme = () => {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setToastTheme('dark');
      } else {
        setToastTheme('light');
      }
    };

    // Check theme on initial load
    checkTheme();

    // Listen for changes in the system's color scheme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setToastTheme(e.matches ? 'dark' : 'light');
    };

    // Add listener - newer browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) { // Deprecated but for older browser compatibility
      mediaQuery.addListener(handleChange);
    }

    // Cleanup listener on component unmount
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/expense" element={<ExpensePage />} />
            <Route path="/limits" element={<LimitsPage />} />
            <Route path="/old-transactions" element={<OldTransactionsPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="/transactions" element={<TransactionsPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme={toastTheme} // Use the dynamic theme state here
        />
    </Router>
  );
}

export default App;