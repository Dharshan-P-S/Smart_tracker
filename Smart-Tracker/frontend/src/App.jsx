// App.js
import React, { useState, useEffect } from 'react';
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
import GoalsPage from './pages/Goalspage';
// --- IMPORT THE NEW PAGE ---
import SmartAssistantPage from './pages/SmartAssistantPage'; // Adjust path if you placed it elsewhere

import ProtectedRoute from './routing/ProtectedRoute';
import Layout from './components/Layout';
import './App.css';

function App() {
  const [toastTheme, setToastTheme] = useState('light');

  useEffect(() => {
    // ... (your existing useEffect for theme handling)
    const checkTheme = () => {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setToastTheme('dark');
      } else {
        setToastTheme('light');
      }
    };

    checkTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setToastTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

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
            <Route path="/goals" element={<GoalsPage />} />
            {/* --- ADDED SMART ASSISTANT PAGE ROUTE --- */}
            <Route path="/smart-assistant" element={<SmartAssistantPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}> {/* Assuming TransactionsPage is also protected but might not use Layout */}
          <Route path="/transactions" element={<TransactionsPage />} />
        </Route>

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
        theme={toastTheme}
      />
    </Router>
  );
}

export default App;