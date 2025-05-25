// src/components/Header/Header.js (or your path to Header.js)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBan } from 'react-icons/fa';
import styles from './Header.module.css';

// --- Icon Components ---
// ... (ProfileIcon, MenuIcon, CloseIcon, DashboardIcon, IncomeIcon, etc. - keep all your existing icons)

const ProfileIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
</svg>
);

const MenuIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.icon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
</svg>
);
const CloseIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.icon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
);

const DashboardIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 8.25 20.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
</svg>
);

const IncomeIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
</svg>
);

const OldTransactionsIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>
);

const SavingsIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 11.25c-4.56 0-8.25-3.69-8.25-8.25S7.44 2.75 12 2.75s8.25 3.69 8.25 8.25S16.56 19.25 12 19.25zM12 6.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-.75-.75z" />
<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12h-9" />
</svg>
);

const ExpenseIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="down-trend" data-name="Flat Line" className={`${styles.navIcon} ${className || ''}`}>
<polyline
id="primary"
points="3 6 11 14 14 11 21 18"
stroke="currentColor"
fill="none"
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
/>
<polyline
id="primary-2"
data-name="primary"
points="17 18 21 18 21 14"
stroke="currentColor"
fill="none"
strokeWidth="2"
strokeLinecap="round"
strokeLinejoin="round"
/>
</svg>
);

const GoalsIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
</svg>
);

// --- NEW: Smart Assistant Icon (Sparkles) ---
const SmartAssistantIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L24 5.25l-.813 2.846a4.5 4.5 0 0 0-3.09 3.09L18.25 12ZM18.25 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09L12 18.75l.813-2.846a4.5 4.5 0 0 0 3.09-3.09L18.25 12Z" />
  </svg>
);

const LogoutIcon = ({ className }) => (
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
<path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
</svg>
);

// --- Header Component ---
function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsMenuOpen(false);
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className={styles.header}>
        <button onClick={toggleMenu} className={styles.menuToggle} aria-label="Toggle menu">
          {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div className={styles.logoContainer}>
          <Link to="/dashboard" className={styles.logoLink} onClick={closeMenu}>
            <h1 className={styles.logo}>Smart Finance Tracker</h1>
          </Link>
        </div>
      </header>

      <nav className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}>
        <div className={styles.menuHeader}>
          <button onClick={closeMenu} className={styles.closeMenuButton} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>
        <div className={styles.navLinksSection}>
          <Link to="/dashboard" className={styles.navLink} onClick={closeMenu}>
            <DashboardIcon /> <span>Dashboard</span>
          </Link>
          <Link to="/income" className={styles.navLink} onClick={closeMenu}>
            <IncomeIcon /> <span>Income</span>
          </Link>
          <Link to="/expense" className={styles.navLink} onClick={closeMenu}>
            <ExpenseIcon /> <span>Expense</span>
          </Link>
          <Link to="/goals" className={styles.navLink} onClick={closeMenu}>
            <GoalsIcon /> <span>Goals</span>
          </Link>
          <Link to="/limits" className={styles.navLink} onClick={closeMenu}>
            <FaBan className={styles.navIcon} /> <span>Limits</span>
          </Link>
          <Link to="/old-transactions" className={styles.navLink} onClick={closeMenu}>
            <OldTransactionsIcon /> <span>Old Transactions</span>
          </Link>
          <Link to="/savings" className={styles.navLink} onClick={closeMenu}>
            <SavingsIcon /> <span>Savings</span>
          </Link>
          {/* --- NEW: AI Assistant Link --- */}
          <Link to="/smart-assistant" className={styles.navLink} onClick={closeMenu}>
            <SmartAssistantIcon /> <span>AI Assistant</span>
          </Link>
          <Link to="/profile" className={styles.navLink} onClick={closeMenu}>
            <ProfileIcon /> <span>Profile</span>
          </Link>
        </div>
        <div className={styles.logoutAreaInMenu}>
          <button onClick={handleLogout} className={styles.logoutButton}>
            <LogoutIcon /> <span>Logout</span>
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div
          className={styles.menuBackdrop}
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
}

export default Header;