import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import styles from './Layout.module.css'; // Create this CSS module

function Layout() {
  return (
    <div className={styles.layoutContainer}>
      <Header />
      <main className={styles.mainContent}>
        <Outlet /> {/* Child routes (like Dashboard) will render here */}
      </main>
    </div>
  );
}

export default Layout; 