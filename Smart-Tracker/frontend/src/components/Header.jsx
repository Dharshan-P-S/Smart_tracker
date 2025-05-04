import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBan } from 'react-icons/fa'; // Import the FaBan icon
import styles from './Header.module.css';

// --- Icon Components ---

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

// --- Navigation Icons ---

const DashboardIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 8.25 20.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
);

// --- Define Income Icon (ArrowTrendingUpIcon) ---
const IncomeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.navIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
);

// --- Define Expense Icon (User provided SVG - Down Trend) ---
const ExpenseIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="down-trend" data-name="Flat Line" className={`${styles.navIcon} ${className || ''}`}>
    {/* Rely on CSS class for styling polylines */}
    <polyline
      id="primary"
      points="3 6 11 14 14 11 21 18"
      stroke="currentColor" // Explicitly set stroke to inherit color
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      id="primary-2"
      data-name="primary"
      points="17 18 21 18 21 14"
      stroke="currentColor" // Explicitly set stroke to inherit color
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

// Removed SettingsIcon component

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
    <>
      <header className={styles.header}>
        {/* Hamburger Toggle */}
        <button onClick={toggleMenu} className={styles.menuToggle} aria-label="Toggle menu">
          {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {/* Logo Container - Now after toggle */}
        <div className={styles.logoContainer}>
          <Link to="/dashboard" className={styles.logoLink} onClick={closeMenu}>
              <h1 className={styles.logo}>Dashboard</h1>
          </Link>
        </div>
      </header>

      {/* Collapsible Menu Area */}
      <nav className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}>
         {/* Add Close Button inside the menu */}
         <div className={styles.menuHeader}>
            {/* Optional: Add title or logo inside menu here */}
            <button onClick={closeMenu} className={styles.closeMenuButton} aria-label="Close menu">
              <CloseIcon />
            </button>
         </div>

         {/* Navigation Links Section */}
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
            {/* Changed Settings to Limits */}
            <Link to="/limits" className={styles.navLink} onClick={closeMenu}>
               <FaBan className={styles.navIcon} /> <span>Limits</span>
            </Link>
          </div>

         {/* Logout Button Section */}
         <div className={styles.logoutAreaInMenu}>
             <button onClick={handleLogout} className={styles.logoutButton}>
               <LogoutIcon /> <span>Logout</span>
             </button>
         </div>
      </nav>

      {/* Backdrop Overlay */}
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
