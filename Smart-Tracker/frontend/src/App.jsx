import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/TransactionsPage';
import IncomePage from './pages/IncomePage';
import ExpensePage from './pages/ExpensePage';
import LimitsPage from './pages/LimitsPage'; // Import the new LimitsPage
import OldTransactionsPage from './pages/OldTransactionsPage'; // Import the new OldTransactionsPage
import SavingsPage from './pages/SavingsPage'; // Import the new SavingsPage
import ProtectedRoute from './routing/ProtectedRoute';
import Layout from './components/Layout';
import './App.css';

function App() {
  // Basic Routing Setup
  // Later, we can add protected routes based on authentication state
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
            <Route path="/limits" element={<LimitsPage />} /> {/* Add route for LimitsPage */}
            <Route path="/old-transactions" element={<OldTransactionsPage />} /> {/* Add route for OldTransactionsPage */}
            <Route path="/savings" element={<SavingsPage />} /> {/* Add route for SavingsPage */}
          </Route>
        </Route>

        <Route path="/transactions" element={<TransactionsPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
