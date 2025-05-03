import React from 'react';
import styles from './Dashboard.module.css'; // Import the styles

function Dashboard() {
  // Dummy data - replace with actual state/props later
  const totalBalance = 0;
  const totalIncome = 0;
  const totalExpense = 0;

  // Format currency function (basic example)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    // Replace 'en-US' and 'USD' with appropriate locale/currency if needed
  };

  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

      {/* Summary Section */}
      <section className={styles.summarySection}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>Total Balance</div>
          <div className={styles.summaryValue}>{formatCurrency(totalBalance)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>Total Income</div>
          <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>Total Expense</div>
          <div className={`${styles.summaryValue} ${styles.expense}`}>{formatCurrency(totalExpense)}</div>
        </div>
      </section>

      {/* Add other dashboard sections below later */}
      {/* 
      <section className={styles.section}>
        <h2>Income/Expense Overview</h2>
        <p>Transaction components placeholder...</p>
      </section>
       */}

    </div>
  );
}

export default Dashboard; 