import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Header.module.css';

// Placeholder Icons (replace later)
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.icon}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const CloseIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={styles.icon}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
);
const PlaceholderIcon = () => <span>□</span>;

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsMenuOpen(false); // Close menu on logout
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        {/* Link logo to dashboard */}
        <Link to="/dashboard" className={styles.logoLink} onClick={closeMenu}>
            <h1 className={styles.logo}>Smart Tracker</h1>
        </Link>
      </div>

      <nav className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}>
         {/* Navigation Links */}
         <Link to="/dashboard" className={styles.navLink} onClick={closeMenu}>
            <PlaceholderIcon /> <span>Dashboard</span>
         </Link>
         <Link to="/reports" className={styles.navLink} onClick={closeMenu}>
            <PlaceholderIcon /> <span>Reports</span>
         </Link>
         <Link to="/goals" className={styles.navLink} onClick={closeMenu}>
            <PlaceholderIcon /> <span>Goals</span>
         </Link>
         <Link to="/settings" className={styles.navLink} onClick={closeMenu}>
            <PlaceholderIcon /> <span>Settings</span>
         </Link>

         {/* Logout Button */}
         <button onClick={handleLogout} className={styles.logoutButton}>
           <PlaceholderIcon /> <span>Logout</span>
         </button>
      </nav>

      <button onClick={toggleMenu} className={styles.menuToggle} aria-label="Toggle menu">
        {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
    </header>
  );
}

export default Header; 