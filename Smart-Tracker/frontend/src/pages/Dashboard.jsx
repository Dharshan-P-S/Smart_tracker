import React from 'react';
import styles from './Dashboard.module.css'; // Import the styles
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'; // Import Recharts components

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