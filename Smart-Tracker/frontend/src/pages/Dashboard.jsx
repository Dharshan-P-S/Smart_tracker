import React from 'react';
import styles from './Dashboard.module.css'; // Import the styles
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'; // Import Recharts components
import { FaWallet, FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6"; // Import react-icons

// --- Inline Icon Components ---

const BalanceIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.summaryIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
  </svg>
);

const IncomeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.summaryIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>
);

const ExpenseIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${styles.summaryIcon} ${className || ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
  </svg>
);

function Dashboard() {
  // Hardcoded dummy data
  const totalIncome = 1500;
  const totalExpense = 900;
  const totalBalance = totalIncome - totalExpense; // 600

  // Format currency function (basic example)
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    // Replace 'en-US' and 'USD' with appropriate locale/currency if needed
  };

  // --- Data for 3-Slice Pie Chart ---
  const pieChartData = [
    { name: 'Income', value: totalIncome || 1 },        // Use 1 if zero
    { name: 'Expenses', value: totalExpense || 1 },      // Use 1 if zero
    { name: 'Balance', value: totalBalance >= 0 ? totalBalance : 1 }, // Use 1 if zero/negative
  ];
  // Colors: Green for Income, Red for Expense, Blue for Balance
  const PIE_COLORS = ['#34D399', '#F87171', '#7091E6'];

  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

      {/* Summary Section */}
      <section className={styles.summarySection}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>
             <FaWallet className={styles.summaryIcon} /> {/* Use react-icon component */}
             Total Balance
          </div>
          <div className={styles.summaryValue}>{formatCurrency(totalBalance)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>
            <FaArrowTrendUp className={`${styles.summaryIcon} ${styles.incomeIconColor}`} /> {/* Use react-icon component */}
            Total Income
          </div>
          <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}>
            <FaArrowTrendDown className={`${styles.summaryIcon} ${styles.expenseIconColor}`} /> {/* Use react-icon component */}
            Total Expense
          </div>
          <div className={`${styles.summaryValue} ${styles.expense}`}>{formatCurrency(totalExpense)}</div>
        </div>
      </section>

      {/* Main Content Area (Transactions + Chart) */}
      <div className={styles.mainArea}>
        {/* Recent Transactions Section (Left) */}
        <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
          <h2 className={styles.sectionTitle}>Recent Transactions</h2>
          {/* Placeholder - Add TransactionList component later */}
          <div className={styles.placeholderContent}>
            Recent transactions list will go here...
          </div>
        </section>

        {/* Updated 3-Slice Pie Chart Section */}
        <section className={`${styles.sectionBox} ${styles.chartSection}`}>
          <h2 className={styles.sectionTitle}>Financial Overview</h2>
           <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

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