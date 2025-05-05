import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link
import styles from './Dashboard.module.css'; // Import the styles
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'; // Import Recharts components
// Assuming you have a way to get the auth token (e.g., from context or local storage)
// import { useAuth } from '../context/AuthContext'; // Example using context

// -- Inline Icon Components --

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
  const [date, setDate] = useState(''); // State for the date input
  const [frequency, setFrequency] = useState('once'); // State for the new frequency dropdown
  const [isSubmitting, setIsSubmitting] = useState(false); // State for submission status

  // const { token } = useAuth(); // Example: Get token from context

  // --- Fetch initial dashboard data ---
  const fetchDashboardData = async () => {
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
        // If response is not OK, try to read as text first for more helpful errors
        const errorText = await response.text();
        console.error("Error response body (text):", errorText); // Log the raw text
        try {
            // Try parsing as JSON in case the error response *is* JSON
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        } catch (parseError) {
            // If parsing failed, use the raw text (likely HTML) as the error hint
             throw new Error(`HTTP error! status: ${response.status}. Response was not valid JSON: ${errorText.substring(0, 100)}...`);
        }
      }

      // If response is OK, proceed to parse as JSON
      const data = await response.json();
      setTotalIncome(data.totalIncome || 0);
      setTotalExpense(data.totalExpense || 0);
      setTransactions(data.recentTransactions || []);

    } catch (err) {
      console.error("Detailed fetch error:", err); // Log the full error object
      // Check if the error came from our specific !response.ok block or a network/JSON parse error
      if (err instanceof Error && err.message.startsWith('HTTP error!')) {
         setError(err.message);
      } else {
         // Network errors or other issues
         setError(err.message || 'Failed to fetch dashboard data. Check network connection and console.');
      }
      // Clear data on error
      setTotalIncome(0);
      setTotalExpense(0);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch shared categories --- 
  const fetchAllCategories = async () => {
    try {
      const response = await fetch('/api/categories/all'); // Assumed endpoint
      if (!response.ok) {
        console.error("Failed to fetch all categories, status:", response.status);
        // Don't throw an error here, suggestions are just a bonus
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
      // Don't set main error state, suggestions are optional
    }
  };

  useEffect(() => {
    // Fetch user-specific data first
    fetchDashboardData();

    // Load shared categories from localStorage or fetch
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

  }, []); // Fetch data on component mount

  // --- Log transactions grouped by category ---
  useEffect(() => {
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
  }, [transactions]); // Re-run when transactions state updates

  const totalBalance = totalIncome - totalExpense;

  // --- Handle Add Transaction ---
  const handleAddTransaction = async (event) => {
    event.preventDefault();
    if (isSubmitting) return; // Prevent double submission

    // Basic client-side validation
    if (!date) {
        alert("Please select a date.");
        return;
    }

    // More robust date comparison, ignoring timezones
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
    setError(null); // Clear previous fetch errors when submitting new

    // --- Frequency Calculation ---
    let finalAmount = parseFloat(amount);
    const baseAmount = parseFloat(amount);

    if (isNaN(baseAmount) || baseAmount <= 0) {
        // Use alert for immediate user feedback on form validation
        alert("Amount must be a positive number.");
        // setError("Submit Error: Amount must be a positive number.");
        setIsSubmitting(false);
        return;
    }

    switch (frequency) {
        case 'daily':
            // Calculate days in the current month
            const now = new Date(); 
            // If a date input existed and was used, you'd use that date here:
            // const targetDate = date ? new Date(date) : new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-indexed (0 for Jan, 11 for Dec)
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            finalAmount = baseAmount * daysInMonth;
            break;
        case 'weekly':
            // Use average weeks per month multiplier (365.25 days / 7 days/week / 12 months)
            const avgWeeksPerMonth = (365.25 / 7) / 12;
            finalAmount = baseAmount * avgWeeksPerMonth;
            break;
        case 'once':
        default:
            // finalAmount is already set to baseAmount
            break;
    }
    // Round to 2 decimal places for currency
    finalAmount = Math.round(finalAmount * 100) / 100;
    // --- End Frequency Calculation ---

    // --- Check for sufficient balance AFTER calculation ---
    const currentBalance = totalIncome - totalExpense;
    if (type === 'expense' && finalAmount > currentBalance) {
        alert(`Insufficient balance. Adding this expense (${formatCurrency(finalAmount)}) would exceed your current balance (${formatCurrency(currentBalance)}).`);
        setIsSubmitting(false); // Reset submitting state
        return; // Stop the function here
    }
    // --- End of balance check ---

    const newTransaction = {
      type,
      amount: finalAmount,
      description,
      category,
      date, // Include the date in the payload
      frequency, // Include frequency in the payload
    };

    let submitResponse; // Define outside try

    try {
        const token = localStorage.getItem('authToken'); // Example
        if (!token) {
            throw new Error("Authentication token not found.");
        }

        submitResponse = await fetch('/api/transactions', { // Assign to outer variable
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(newTransaction),
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            console.error("Submit Error response body (text):", errorText); // Log raw text
             try {
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.message || `Failed to add transaction: ${submitResponse.statusText}`);
             } catch (parseError) {
                 throw new Error(`Failed to add transaction: ${submitResponse.statusText}. Response was not valid JSON: ${errorText.substring(0,100)}...`);
             }
        }

        // Clear form and refresh data on success
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('');
        setFrequency('once'); // Reset frequency on success
        await fetchDashboardData(); // Re-fetch user-specific dashboard data

        // --- Update shared categories list (Optional Enhancement) ---
        if (!allCategories.includes(newTransaction.category)) {
            const updatedCategories = [...allCategories, newTransaction.category];
            setAllCategories(updatedCategories);
            localStorage.setItem('allCategories', JSON.stringify(updatedCategories));
        }
        // --- End of Update ---

        // --- Dispatch event if income was added ---
        if (newTransaction.type === 'income') {
            console.log("Dispatching income-updated event"); // For debugging
            window.dispatchEvent(new CustomEvent('income-updated'));
        }
        // --- End of dispatch ---

    } catch (err) {
        console.error("Error adding transaction:", err);
        // Set error state specifically for the submission attempt
        setError(`Submit Error: ${err.message}` || 'Failed to add transaction.');
        // Don't automatically alert here, let the UI display the error state
    } finally {
        setIsSubmitting(false);
    }
  };


  // Format currency function
  const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
  };

  // --- Prepare Pie Chart Data (Income, Expense, Balance) ---
  // Always include all three slices. Use 0 if value is not positive.
  const pieChartData = [
    { name: 'Income', value: totalIncome > 0 ? totalIncome : 0 },
    { name: 'Expenses', value: totalExpense > 0 ? totalExpense : 0 },
    { name: 'Balance', value: totalBalance > 0 ? totalBalance : 0 },
  ];

  // Define colors based on segment names - ensure all three are mapped
  const colorMapping = {
    'Income': '#34D399',    // Green
    'Expenses': '#F87171',   // Red
    'Balance': '#7091E6',   // Blue
    // 'No Data' mapping is no longer needed as we always provide the three slices
  };

  // Check if there's any data at all to display a meaningful chart
  // If all values are 0, the chart might look empty, which is expected.
  const hasChartData = pieChartData.some(item => item.value > 0);


  // --- Render Logic ---
  if (loading) {
      return <div className={styles.dashboardPageContent}><p>Loading dashboard...</p></div>;
  }

  // Display general fetch error if not loading and not a submission error
//   if (error && !isSubmitting) {
//       return <div className={styles.dashboardPageContent}><p>Error loading data: {error}</p></div>;
//   }


  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

       {/* Display general fetch error messages (not related to submit) */}
       {error && !error.startsWith('Submit Error:') && <div style={{ color: 'red', marginBottom: '1rem' }}>Error fetching data: {error}</div>}

      {/* Summary Section */}
      <section className={styles.summarySection}>
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
                   key={tx._id || tx.id}
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
              {/* Render the chart structure even if data is all zeros */}
              {/* The visual appearance of zero-value slices depends on Recharts behavior */}
              <ResponsiveContainer width="100%" height={300}>
                 <PieChart>
                   <Pie
                     data={pieChartData} // Use the data with potentially zero values
                     cx="50%"
                     cy="50%"
                     labelLine={false}
                     outerRadius={100}
                     fill="#8884d8"
                     dataKey="value"
                     nameKey="name"
                   >
                     {pieChartData.map((entry, index) => (
                       // Use colorMapping based on entry name
                       <Cell key={`cell-${index}`} fill={colorMapping[entry.name]} />
                     ))}
                   </Pie>
                   {/* Tooltip should still show the correct value, even if 0 */}
                   <Tooltip formatter={(value) => formatCurrency(value)} />
                   {/* Legend will show all three items */}
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
              {/* Optional: Add a message if all data is zero */}
              {!hasChartData && (
                 <div className={styles.placeholderContent} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>No data to display in chart.</div>
              )}
           </div>
        </section>
      </div>

       {/* Add New Transaction Form Section */}
       <section 
         className={`${styles.sectionBox} ${styles.addTransactionSection}`}
         style={{ width: '50%', marginRight: 'auto', marginLeft: 0 }} // Explicitly set width and keep left
       >
         <h2 className={styles.sectionTitle}>Add New Transaction</h2>
          {/* Display submission errors specifically here */}
         {error && error.startsWith('Submit Error:') && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
         <form onSubmit={handleAddTransaction} className={styles.transactionForm}>
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
               max={new Date().toISOString().split('T')[0]} // Set max date to today
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
             {/* Datalist for category suggestions */}
             <datalist id="category-suggestions">
               {/* Map over the shared, persistent list */}
               {allCategories.map((cat, index) => (
                 <option key={index} value={cat} />
               ))}
             </datalist>
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
             </select>
           </div>
           <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
             {isSubmitting ? 'Adding...' : 'Add Transaction'}
           </button>
         </form>
       </section>
    </div>
  );
}

export default Dashboard;
