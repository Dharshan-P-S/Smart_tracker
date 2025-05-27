import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const isAuthenticated = !!localStorage.getItem('authToken'); // Check if token exists

  // If authorized, return an outlet that will render child elements
  // If not, return element that will navigate to login page
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute; 