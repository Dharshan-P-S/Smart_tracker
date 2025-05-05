import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
// Assuming you have a way to get the auth token (e.g., from context or local storage)
// import { useAuth } from '../context/AuthContext'; // Example using context

// -- Inline Icon Components -- (Keep existing SVGs)
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
// (Keep other existing parts like formatCurrency, pie chart data, etc.)

function Dashboard() {
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state for initial fetch
  const [error, setError] = useState(null); // Error state
  const [allCategories, setAllCategories] = useState([]); // State for shared, persistent categories

  // Form state
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]); // Default to today
  const [frequency, setFrequency] = useState('once');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limits, setLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [categoryLimitWarning, setCategoryLimitWarning] = useState(null);
  const [registrationDate, setRegistrationDate] = useState(null); // State for user registration date


  // --- Fetch initial dashboard data ---
  const fetchDashboardData = async () => {
    // ... (keep existing fetchDashboardData logic)
        setLoading(true);
        setError(null);
        let response; // Define response outside try block to access in finally/catch

        try {
          const token = localStorage.getItem('authToken'); // Example
          if (!token) {
            throw new Error("Authentication token not found.");
          }

          response = await fetch('/api/transactions/dashboard', { // Assign to outer response variable
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Error response body (text):", errorText); // Log the raw text
            try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            } catch (parseError) {
                 throw new Error(`HTTP error! status: ${response.status}. Response was not valid JSON: ${errorText.substring(0, 100)}...`);
            }
          }

          const data = await response.json();
          setTotalIncome(data.totalIncome || 0);
          setTotalExpense(data.totalExpense || 0);
          setTransactions(data.recentTransactions || []);

        } catch (err) {
          console.error("Detailed fetch error:", err); // Log the full error object
          if (err instanceof Error && err.message.startsWith('HTTP error!')) {
             setError(err.message);
          } else {
             setError(err.message || 'Failed to fetch dashboard data. Check network connection and console.');
          }
          setTotalIncome(0);
          setTotalExpense(0);
          setTransactions([]);
        } finally {
          setLoading(false);
        }
  };

   // --- Fetch shared categories ---
  const fetchAllCategories = async () => {
    // ... (keep existing fetchAllCategories logic)
    try {
      const response = await fetch('/api/categories/all'); // Assumed endpoint
      if (!response.ok) {
        console.error("Failed to fetch all categories, status:", response.status);
        return;
      }
      const categories = await response.json();
      if (Array.isArray(categories)) {
          setAllCategories(categories);
          localStorage.setItem('allCategories', JSON.stringify(categories));
      } else {
          console.error("Fetched categories is not an array:", categories);
      }
    } catch (err) {
      console.error("Error fetching all categories:", err);
    }
  };

  useEffect(() => {
    // ... (keep existing useEffect logic for initial fetch and categories)
    fetchDashboardData();
    const storedCategories = localStorage.getItem('allCategories');
    if (storedCategories) {
        try {
            setAllCategories(JSON.parse(storedCategories));
        } catch (e) {
            console.error("Error parsing stored categories:", e);
            localStorage.removeItem('allCategories'); // Clear invalid data
            fetchAllCategories(); // Fetch fresh if parsing fails
        }
    } else {
        fetchAllCategories();
    }
    // Fetch user profile to get registration date
    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Auth token not found for profile fetch.");

            const response = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error fetching profile! status: ${response.status}. ${errorText}`);
            }
            const profileData = await response.json();
            if (profileData.createdAt) {
                // Format date to YYYY-MM-DD for the input min attribute
                const regDate = new Date(profileData.createdAt);
                const formattedDate = regDate.toISOString().split('T')[0];
                setRegistrationDate(formattedDate);
                console.log("User registration date set:", formattedDate);
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            // Don't necessarily set a page-level error, but log it.
            // The date input will just lack a 'min' attribute if this fails.
        }
    };
    fetchUserProfile(); // Call fetch profile on component mount

  }, []); // End of initial useEffect

  // --- Log transactions grouped by category ---
  useEffect(() => {
    // ... (keep existing useEffect logic for logging)
    if (transactions && transactions.length > 0) {
      console.log("Transactions fetched:", transactions); // Log raw transactions
      const groupedByCategory = transactions.reduce((acc, tx) => {
        const categoryKey = tx.category || 'Uncategorized'; // Handle potential missing category
        if (!acc[categoryKey]) {
          acc[categoryKey] = [];
        }
        acc[categoryKey].push(tx);
        return acc;
      }, {});
      console.log("Transactions Grouped by Category:");
      console.table(groupedByCategory); // Use console.table for better readability if possible
    }
  }, [transactions]);

  // --- Fetch Limits (Backend calculates spending) ---
  const fetchLimits = async () => {
    setLoadingLimits(true);
    // Keep existing errors unless this fetch specifically fails
    // setError(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Authentication token not found.");

      const response = await fetch('/api/limits', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch limits: ${response.statusText}`);
      }
      const data = await response.json();
      // Validate data structure slightly - ensure amount/spending are numbers
      const validatedLimits = data.map(limit => ({
        ...limit,
        amount: (typeof limit.amount === 'number' && !isNaN(limit.amount)) ? limit.amount : 0,
        currentSpending: (typeof limit.currentSpending === 'number' && !isNaN(limit.currentSpending)) ? limit.currentSpending : 0,
        remainingAmount: (typeof limit.remainingAmount === 'number' && !isNaN(limit.remainingAmount)) ? limit.remainingAmount : 0,
      }));
      setLimits(validatedLimits || []);
    } catch (err) {
      console.error("Error fetching limits:", err);
      setError(prev => prev ? `${prev}\nLimits Error: ${err.message}` : `Limits Error: ${err.message}`);
      setLimits([]); // Clear limits on error
    } finally {
      setLoadingLimits(false);
    }
  };

  // Fetch limits on mount
  useEffect(() => {
    fetchLimits();
  }, []);

  // Refetch limits if a transaction is added/deleted elsewhere
  useEffect(() => {
    const handleTransactionsUpdate = () => {
        console.log('Transaction update detected by Dashboard, refetching limits...');
        fetchLimits();
    };
    window.addEventListener('transactions-updated', handleTransactionsUpdate);
    return () => {
        window.removeEventListener('transactions-updated', handleTransactionsUpdate);
    };
  }, []); // Empty dependency array is fine as fetchLimits is stable within this scope now

  // --- Effect to check limit status when category or type changes ---
  useEffect(() => {
    if (type === 'expense' && category.trim() !== '') {
      const categoryTrimmed = category.trim();
      const relevantLimit = limits.find(limit => limit.category.toLowerCase() === categoryTrimmed.toLowerCase());

      if (relevantLimit && relevantLimit.exceeded) {
        setCategoryLimitWarning(`Limit exceeded for "${relevantLimit.category}". Consider spending less for ${relevantLimit.category}.`);
      } else {
        setCategoryLimitWarning(null); // Clear warning if limit not exceeded or not found
      }
    } else {
      setCategoryLimitWarning(null); // Clear warning if not an expense or category is empty
    }
  }, [category, type, limits]); // Re-run when category, type, or limits data changes


  const totalBalance = totalIncome - totalExpense;

  // --- Handle Add Transaction ---
  const handleAddTransaction = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    // ... (keep existing validation logic: date, future date, amount, description, category)
     if (!date) {
        alert("Please select a date.");
        return;
    }
    const [year, month, day] = date.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day); // Month is 0-indexed
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentDay = today.getDate();
    const todayDateObj = new Date(currentYear, currentMonth, currentDay); // Today at midnight local
    if (selectedDateObj > todayDateObj) {
        alert("Cannot add a transaction with a future date.");
        return;
    }
    if (!amount || parseFloat(amount) <= 0) {
        alert("Please enter a valid positive amount.");
        return;
    }
    if (!description.trim()) {
        alert("Please enter a description.");
        return;
    }
     if (!category.trim()) {
        alert("Please enter a category.");
        return;
    }


    setIsSubmitting(true);
    setError(null);

    // ... (keep existing frequency calculation logic)
    let finalAmount = parseFloat(amount);
    const baseAmount = parseFloat(amount);
    if (isNaN(baseAmount) || baseAmount <= 0) {
        alert("Amount must be a positive number.");
        setIsSubmitting(false);
        return;
    }
    switch (frequency) {
        case 'daily':
            const now = new Date();
            const yearFreq = now.getFullYear();
            const monthFreq = now.getMonth();
            const daysInMonth = new Date(yearFreq, monthFreq + 1, 0).getDate();
            finalAmount = baseAmount * daysInMonth;
            break;
        case 'weekly':
            const avgWeeksPerMonth = (365.25 / 7) / 12;
            finalAmount = baseAmount * avgWeeksPerMonth;
            break;
        case 'once':
        default:
            break;
    }
    finalAmount = Math.round(finalAmount * 100) / 100;

    // ... (keep existing balance check logic)
    const currentBalance = totalIncome - totalExpense;
    if (type === 'expense' && finalAmount > currentBalance) {
        alert(`Insufficient balance. Adding this expense (${formatCurrency(finalAmount)}) would exceed your current balance (${formatCurrency(currentBalance)}).`);
        setIsSubmitting(false); // Reset submitting state
        return; // Stop the function here
    }

    // Warning logic is now handled by useEffect and inline message.
    // No need to block submission here.

    const newTransaction = {
      type,
      amount: finalAmount,
      description,
      category,
      date,
      frequency,
    };

    let submitResponse;

    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error("Authentication token not found.");
        }

        submitResponse = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(newTransaction),
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            console.error("Submit Error response body (text):", errorText);
             try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.message || `Failed to add transaction: ${submitResponse.statusText}`);
             } catch (parseError) {
                 throw new Error(`Failed to add transaction: ${submitResponse.statusText}. Response was not valid JSON: ${errorText.substring(0,100)}...`);
             }
        }

        // Clear form
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('');
        setFrequency('once');
        setDate(() => new Date().toISOString().split('T')[0]); // Reset date to today

        // Refresh dashboard data
        await fetchDashboardData();

        // --- >>> Dispatch event to notify other components <<< ---
        console.log("Dispatching transactions-updated event after add");
        window.dispatchEvent(new CustomEvent('transactions-updated'));
        // --- >>> End Dispatch <<< ---

        // ... (keep existing category update logic)
        if (!allCategories.includes(newTransaction.category)) {
            const updatedCategories = [...allCategories, newTransaction.category];
            setAllCategories(updatedCategories);
            localStorage.setItem('allCategories', JSON.stringify(updatedCategories));
        }
         // Dispatch income-updated event (if needed elsewhere)
        if (newTransaction.type === 'income') {
            console.log("Dispatching income-updated event");
            window.dispatchEvent(new CustomEvent('income-updated'));
        }


    } catch (err) {
        console.error("Error adding transaction:", err);
        setError(`Submit Error: ${err.message}` || 'Failed to add transaction.');
    } finally {
        setIsSubmitting(false);
    }
  };


  // --- Handle Delete Transaction (Example - If you add delete buttons here) ---
  // You might have this logic on a different page like TransactionList,
  // but if you added delete buttons to the recent items here, you'd do this:
  const handleDeleteTransaction = async (transactionId) => {
      if (!window.confirm("Are you sure you want to delete this transaction?")) {
          return;
      }
      setError(null); // Clear previous errors
      try {
          const token = localStorage.getItem('authToken');
          if (!token) throw new Error("Authentication token not found.");

          const response = await fetch(`/api/transactions/${transactionId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`);
          }

          // Refresh dashboard data
          await fetchDashboardData();

          // --- >>> Dispatch event to notify other components <<< ---
          console.log("Dispatching transactions-updated event after delete");
          window.dispatchEvent(new CustomEvent('transactions-updated'));
          // --- >>> End Dispatch <<< ---

          alert("Transaction deleted successfully.");

      } catch (err) {
          console.error("Error deleting transaction:", err);
          setError(`Delete Error: ${err.message}`);
          // Optionally show the error in the UI near where the delete happened
      }
  };


  // Format currency function
  const formatCurrency = (value) => {
    // ... (keep existing formatCurrency logic)
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
  };

  // --- Prepare Pie Chart Data ---
  const pieChartData = [
    // ... (keep existing pieChartData logic)
    { name: 'Income', value: totalIncome > 0 ? totalIncome : 0 },
    { name: 'Expenses', value: totalExpense > 0 ? totalExpense : 0 },
    { name: 'Balance', value: totalBalance > 0 ? totalBalance : 0 },
  ];
  const colorMapping = {
    // ... (keep existing colorMapping logic)
    'Income': '#34D399',    // Green
    'Expenses': '#F87171',   // Red
    'Balance': '#7091E6',   // Blue
  };
  const hasChartData = pieChartData.some(item => item.value > 0);


  // --- Render Logic ---
  // Combine loading states for dashboard data and limits
  const isPageLoading = loading || loadingLimits;
  if (isPageLoading) {
      return <div className={styles.dashboardPageContent}><p>Loading dashboard data...</p></div>;
  }

  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

       {/* Display general fetch/delete error messages */}
       {error && !error.startsWith('Submit Error:') && <div style={{ color: 'red', marginBottom: '1rem' }}>Error: {error}</div>}

      {/* Summary Section */}
      <section className={styles.summarySection}>
         {/* ... (Keep existing summary items with icons/images) ... */}
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
              <img
                src="https://cdn-icons-png.flaticon.com/128/869/869067.png"
                alt="Balance icon"
                className={styles.summaryIcon}
              /> Total Balance
           </div>
           <div className={styles.summaryValue}>{formatCurrency(totalBalance)}</div>
         </div>
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
             <img
               src="https://cdn-icons-png.flaticon.com/128/10365/10365322.png"
               alt="Income icon"
               className={`${styles.summaryIcon} ${styles.incomeIconColor}`}
             /> Total Income
           </div>
           <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
         </div>
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
             <img
               src="https://cdn-icons-png.flaticon.com/128/8733/8733406.png"
               alt="Expense icon"
               className={`${styles.summaryIcon} ${styles.expenseIconColor}`}
             /> Total Expense
           </div>
           <div className={`${styles.summaryValue} ${styles.expense}`}>{formatCurrency(totalExpense)}</div>
         </div>
      </section>

      {/* Main Content Area */}
      <div className={styles.mainArea}>
        {/* Recent Transactions */}
        <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Transactions</h2>
            <Link to="/transactions" className={styles.seeAllButton}>See All</Link>
          </div>
           {transactions.length > 0 ? (
             <div className={styles.transactionList}>
               {transactions.slice(0, 5).map((tx) => (
                 <div
                   key={tx._id || tx.id} // Use _id from backend
                   className={`${styles.transactionItem} ${
                     tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder
                   }`}
                 >
                   <span className={styles.transactionDate}>
                      {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                   </span>
                   <span className={styles.transactionDesc}>
                     {tx.description} ({tx.category})
                   </span>
                   <span className={`${styles.transactionAmount} ${tx.type === 'income' ? styles.income : styles.expense}`}>
                     {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                   </span>
                   {/* Optional: Add a delete button here if needed */}
                   {/* <button onClick={() => handleDeleteTransaction(tx._id)} style={{marginLeft: '10px', cursor: 'pointer'}}>X</button> */}
                 </div>
               ))}
             </div>
           ) : (
             <div className={styles.placeholderContent}>
               No recent transactions. Add one below!
             </div>
           )}
        </section>

        {/* Financial Overview Chart */}
        <section className={`${styles.sectionBox} ${styles.chartSection}`}>
           <h2 className={styles.sectionTitle}>Financial Overview</h2>
            <div className={styles.chartContainer}>
              {/* ... (Keep existing chart rendering logic) ... */}
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
                       <Cell key={`cell-${index}`} fill={colorMapping[entry.name]} />
                     ))}
                   </Pie>
                   <Tooltip formatter={(value) => formatCurrency(value)} />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
              {!hasChartData && (
                 <div className={styles.placeholderContent} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>No data to display in chart.</div>
              )}
           </div>
       </section>
      </div>

       {/* Container for Form and Limits */}
       <div className={styles.formAndLimitsContainer}>
         {/* Add New Transaction Form Section */}
         <section
           className={`${styles.sectionBox} ${styles.addTransactionSection}`}
           // Removed inline style, control width via CSS module
         >
           <h2 className={styles.sectionTitle}>Add New Transaction</h2>
            {/* Display submission errors specifically here */}
           {error && error.startsWith('Submit Error:') && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
           <form onSubmit={handleAddTransaction} className={styles.transactionForm}>
              {/* ... (Keep existing form groups: type, date, amount, description, category, frequency) ... */}
               <div className={styles.formGroup}>
               <label htmlFor="type">Type:</label>
               <select id="type" value={type} onChange={(e) => setType(e.target.value)} required className={styles.formInput} disabled={isSubmitting}>
                 <option value="expense">Expense</option>
                 <option value="income">Income</option>
               </select>
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="date">Date:</label>
               <input
                 type="date" id="date" value={date}
                 onChange={(e) => setDate(e.target.value)}
                 required
                 className={styles.formInput} disabled={isSubmitting}
                 min={(() => {
                   const today = new Date();
                   const firstDayOfCurrentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
                   return firstDayOfCurrentMonth.toISOString().split('T')[0];
                 })()} // Set min date to the start of the current month (UTC)
                 max={new Date().toISOString().split('T')[0]} // Set max date to today (local)
               />
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="amount">Amount:</label>
               <input
                 type="number" id="amount" value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 placeholder="0.00" required step="0.01" min="0.01"
                 className={styles.formInput} disabled={isSubmitting}
               />
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="description">Description:</label>
               <input
                 type="text" id="description" value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 placeholder="e.g., Coffee, Salary" required
                 className={styles.formInput} disabled={isSubmitting}
                 autoComplete="off" // Disable browser autocomplete
               />
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="category">Category:</label>
               <input
                 type="text" id="category" value={category}
                 onChange={(e) => setCategory(e.target.value)}
                 placeholder="e.g., Food, Bills, Paycheck" required
                 className={styles.formInput} disabled={isSubmitting}
                 list="category-suggestions" // Link to datalist
               />
               <datalist id="category-suggestions">
                 {allCategories.map((cat, index) => (
                   <option key={index} value={cat} />
                 ))}
               </datalist>
               {/* Display inline category limit warning */}
               {categoryLimitWarning && type === 'expense' && (
                 <div className={styles.categoryWarningMessage}>{categoryLimitWarning}</div>
               )}
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="frequency">Frequency:</label>
               <select
                 id="frequency"
                 value={frequency}
                 onChange={(e) => setFrequency(e.target.value)}
                 required
                 className={styles.formInput}
                 disabled={isSubmitting}
               >
                 <option value="once">One-time</option>
                 <option value="daily">Daily</option>
                 <option value="weekly">Weekly</option>
                 {/* <option value="monthly">Monthly</option>  Consider adding monthly if backend handles it */}
               </select>
             </div>
             <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
               {isSubmitting ? 'Adding...' : 'Add Transaction'}
             </button>
           </form>
         </section>

         {/* Spending Limits Section - Use limits state directly */}
         <section className={`${styles.sectionBox} ${styles.limitsSection}`}>
            <h2 className={styles.sectionTitle}>Spending Limits</h2>
            {limits.length > 0 ? (
              <>
                <div className={styles.limitList}>
                    {limits.slice(0, 4).map((limit) => {
                        // Use fields directly from the API response (validated in fetchLimits)
                        const { amount: limitAmount, currentSpending: spentAmount, remainingAmount } = limit;
                        const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;

                        return (
                            <div key={limit._id} className={styles.limitItem}>
                                <div className={styles.limitDetails}>
                                    <span className={styles.limitCategory}>{limit.category}</span>
                                    <div className={styles.limitAmounts}>
                                        <span className={styles.limitSpent}>Spent: {formatCurrency(spentAmount)}</span>
                                        {/* Use remainingAmount directly from API */}
                                        <span className={styles.limitRemaining} style={{ color: remainingAmount < 0 ? '#EF4444' : '#10B981' }}>
                                            {remainingAmount >= 0 ? `Remaining: ${formatCurrency(remainingAmount)}` : `Overspent: ${formatCurrency(Math.abs(remainingAmount))}`}
                                        </span>
                                    </div>
                                </div>
                                {/* Message for exceeded limits */}
                                {(limit.exceeded || remainingAmount <= 0) && (
                                    <div className={styles.limitExceededMessage}>
                                        Limit Reached!
                                    </div>
                                )}
                                <div className={styles.limitTotal}>Limit: {formatCurrency(limitAmount)}</div>
                                {/* Progress Bar */}
                                <div className={styles.progressBarContainer}>
                                    <div
                                        className={styles.progressBar}
                                        style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: percentage > 100 ? '#EF4444' : '#4299e1' }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Link to="/limits" className={`${styles.seeAllButton} ${styles.limitsSeeAll}`}>See All Limits</Link>
              </>
            ) : (
                <div className={styles.placeholderContent}>
                    No spending limits set yet. <Link to="/limits">Set one now!</Link>
                </div>
            )}
         </section>
       </div> {/* End of formAndLimitsContainer */}
    </div>
  );
}

export default Dashboard;
