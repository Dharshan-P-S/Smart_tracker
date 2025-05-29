// App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Page Imports
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
import GoalsPage from './pages/Goalspage'; // Note: 'Goalspage' filename might be a typo for 'GoalsPage'
import AboutPage from './pages/AboutPage';
import SmartAssistantPage from './pages/SmartAssistantPage';

// Routing & Layout Components
import ProtectedRoute from './routing/ProtectedRoute';
import Layout from './components/Layout'; // This Layout includes the main Header
import './App.css'; // Global styles

function App() {
  const [toastTheme, setToastTheme] = useState('light');

  useEffect(() => {
    const checkTheme = () => {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setToastTheme('dark');
      } else {
        setToastTheme('light');
      }
    };

    checkTheme(); // Set initial theme

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setToastTheme(e.matches ? 'dark' : 'light');
    };

    // Add listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) { // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup listener
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* --- Public Routes --- */}
        {/* These routes do not require authentication and do not use the main Layout */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/about" element={<AboutPage />} /> {/* AboutPage is public and has its own Header */}

        {/* --- Protected Routes using the Main Application Layout --- */}
        {/* These routes require authentication and will render inside the <Layout> component */}
        <Route element={<ProtectedRoute />}> {/* Parent route for protection */}
          <Route element={<Layout />}> {/* Parent route for common UI layout (Header, Sidebar etc.) */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/expense" element={<ExpensePage />} />
            <Route path="/limits" element={<LimitsPage />} />
            <Route path="/old-transactions" element={<OldTransactionsPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/smart-assistant" element={<SmartAssistantPage />} />
            
            {/* Default route for authenticated users if they land on a path matching this group's base */}
            {/* For example, if the ProtectedRoute was at path="/app", then /app would go to /app/dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>

        {/* --- Protected Route NOT using the Main Layout (Example: TransactionsPage) --- */}
        {/* This route requires authentication but renders without the common <Layout> */}
        {/* If TransactionsPage *should* use the main Layout, move it into the group above. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/transactions" element={<TransactionsPage />} />
        </Route>
        
        {/* --- Fallback and Redirect Routes --- */}
        {/* Redirects the root path. If user is authenticated, ProtectedRoute might handle redirection */}
        {/* to dashboard. If not, they'll be sent to login from here or by ProtectedRoute. */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Catch-all for any undefined routes, redirects to login */}
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
        theme={toastTheme}
      />
    </Router>
  );
}

export default App;