// src/pages/AboutPage/AboutPage.jsx
import React from 'react';
import styles from './AboutPage.module.css'; // We'll create this next
import Header from '../components/Header'; // Adjust path if needed

function AboutPage() {
  return (
    <>
      <Header />
      <div className={styles.aboutContainer}>
        <header className={styles.aboutHeader}>
          <h1 style={{marginTop:'50px'}}><span role="img" aria-label="brain emoji">🧠</span> About Smart Tracker</h1>
        </header>
        <section className={styles.aboutSection}>
          <p>
            Smart Tracker is your all-in-one personal finance manager. It helps you track your income, expenses, savings, goals, and spending limits with a monthly focus. You can review old transactions, analyze your savings trends, and even interact with an AI assistant to manage your finances using natural language.
          </p>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="folder emoji">📂</span> Navigation</h2>
          <p>
            Smart Tracker features a user-friendly left-side menu bar that lets you easily navigate between all major sections of the app. Each page is just a click away:
          </p>
          <ul className={styles.navList}>
            <li>Dashboard</li>
            <li>Transactions</li>
            <li>Income</li>
            <li>Expenses</li>
            <li>Goals</li>
            <li>Limits</li>
            <li>Old Transactions</li>
            <li>Savings</li>
            <li>AI Assistant</li>
            <li>Profile</li>
          </ul>
          <p>
            The layout is designed for simplicity and speed, allowing you to jump between views and manage your finances effortlessly.
          </p>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="chart increasing emoji">📊</span> Dashboard</h2>
          <p>
            The Dashboard gives a quick overview of your current month’s finances. It contains 10 sections, laid out as 5 rows with 2 sections per row:
          </p>
          <ul className={styles.featureList}>
            <li>Recent Transactions (Latest 5)</li>
            <li>Current Month Financial Overview (Pie Chart)</li>
            <li>Add New Transaction (Form)</li>
            <li>Spending Limits (Up to 4)</li>
            <li>Active Goals (Up to 3)</li>
            <li>Monthly Savings Trend (Line Chart)</li>
            <li>Recent Income (Latest 5)</li>
            <li>Monthly Income Breakdown (Donut Chart)</li>
            <li>Recent Expenses (Latest 5)</li>
            <li>Monthly Expense Breakdown (Horizontal Bar Chart)</li>
          </ul>
          <p>
            Each section includes a button to view full details on its respective page.
          </p>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="folder emoji">📁</span> Transactions Page</h2>
          <p>View all transactions across every month. Features include:</p>
          <ul className={styles.featureList}>
            <li>Complete transaction list (income + expense)</li>
            <li>Download as PDF</li>
            <li>Edit/Delete each transaction</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="money bag emoji">💰</span> Income Page</h2>
          <p>Track your monthly income:</p>
          <ul className={styles.featureList}>
            <li>Bar Chart showing income trends (newest to the right)</li>
            <li>Full list of this month’s income</li>
            <li>Download as PDF</li>
            <li>Edit/Delete entries</li>
            <li>Edits prevent cumulative savings from going negative</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="money with wings emoji">💸</span> Expense Page</h2>
          <p>Monitor your spending:</p>
          <ul className={styles.featureList}>
            <li>Line Chart of this month's expenses</li>
            <li>Complete list of this month’s expenses</li>
            <li>Download as PDF</li>
            <li>Edit/Delete entries</li>
            <li>Savings integrity is maintained during edits</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="target emoji">🎯</span> Goals Page</h2>
          <p>Set and manage your financial goals:</p>
          <ul className={styles.featureList}>
            <li>Add goals with description, target amount, target date</li>
            <li>Goal categories: Active, Achieved, Archived</li>
            <li>Active goals support Add to Savings (tracked as expense under “Goal Savings”)</li>
            <li>Edit/Delete available; changes reflect in Expense page</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="no entry sign emoji">🚧</span> Limits Page</h2>
          <p>Control category-wise spending:</p>
          <ul className={styles.featureList}>
            <li>Add a limit with category and amount</li>
            <li>View all limits below the form</li>
            <li>Edit/Delete each limit</li>
            <li>Smart warnings when a transaction exceeds the set limit</li>
            <li>Limits update automatically when transactions match the category</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="calendar emoji">🗓️</span> Old Transactions Page</h2>
          <p>Add past financial data:</p>
          <ul className={styles.featureList}>
            <li>Form 1: Add total savings (if individual transactions are unknown)</li>
            <li>Form 2: Add past transactions (cannot be for the current month)</li>
            <li>Cannot use both forms for the same month</li>
            <li>Transactions shown month-wise</li>
            <li>Edit/Delete supported with savings checks</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="chart increasing with yen emoji">💹</span> Savings Page</h2>
          <p>Visualize monthly savings:</p>
          <ul className={styles.featureList}>
            <li>Shaded Line Chart showing savings per month</li>
            <li>Below: monthly savings with cumulative totals</li>
          </ul>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="robot emoji">🤖</span> AI Assistant Page</h2>
          <p>Powered by Wit.ai, this page lets you manage finances by chatting in plain English:</p>
          <p>You can:</p>
          <ul className={styles.featureList}>
            <li>Add income, expense, goal, or limit</li>
            <li>Add savings to a goal</li>
            <li>Fetch all income or expenses</li>
            <li>Get details of a goal or limit</li>
          </ul>
          <p className={styles.commandHeader}>💬 Example Commands:</p>
          <ul className={styles.commandList}>
            <li>"Earned $500 from freelance yesterday for logo design"</li>
            <li>"Spent $400 on food last week for dining out"</li>
            <li>"Set a goal of $1000 for Bike on the next month"</li>
            <li>"Set a limit of $500 on food"</li>
            <li>"What is the goal details of Bike?"</li>
          </ul>
          <p>Smart Tracker will extract and process your input automatically.</p>
        </section>

        <section className={styles.aboutSection}>
          <h2><span role="img" aria-label="person emoji">👤</span> Profile Page</h2>
          <p>Manage and personalize your account:</p>
          <ul className={styles.featureList}>
            <li>Profile Picture, Username, Email — all editable</li>
            <li>Unique usernames and email enforcement</li>
            <li>Email verification is sent when you update your email</li>
            <li>Savings Bar Chart displays monthly savings (same as Savings page but as bars)</li>
          </ul>
        </section>

        <footer className={styles.aboutFooter}>
          <h3><span role="img" aria-label="rocket emoji">🚀</span> Why Smart Tracker?</h3>
          <p>
            Smart Tracker isn't just another finance app — it's an intelligent, organized, and powerful companion that helps you plan, track, and grow your money smartly. With clear insights, flexible controls, and AI-powered interactions, it’s designed to help you master your monthly finances with ease and confidence.
          </p>
        </footer>
      </div>
    </>
  );
}

export default AboutPage;