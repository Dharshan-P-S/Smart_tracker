import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css'; // Make sure this path is correct
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Picker from 'emoji-picker-react'; // Emoji picker library
import axios from 'axios'; // Import axios

// -- Inline Icon Components -- (This should be your original icon setup)
// For this example, I'm using the placeholder comments to represent
// YOUR ORIGINAL ICON COMPONENTS. I will not change them.
// const BalanceIcon = ({ className }) => ( ... your original SVG ... );
// const IncomeIcon = ({ className }) => ( ... your original SVG ... );
// const ExpenseIcon = ({ className }) => ( ... your original SVG ... );
// If you were using <img> tags, those would be here.

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
  const [selectedEmoji, setSelectedEmoji] = useState(''); // New state for selected emoji
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // State to control emoji picker visibility
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]); // Default to today
  const [frequency, setFrequency] = useState('once');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(''); // New state for selected day of week
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limits, setLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [categoryLimitWarning, setCategoryLimitWarning] = useState(null);
  const [registrationDate, setRegistrationDate] = useState(null); // State for user registration date

  // State for monthly savings data with cumulative calculation
  const [monthlySavingsData, setMonthlySavingsData] = useState([]);
  const [loadingMonthlySavings, setLoadingMonthlySavings] = useState(true);


  // --- Fetch initial dashboard data ---
  const fetchDashboardData = async () => {
    setLoading(true);
    // setError(null); // Cleared globally at the start of multi-fetch useEffect
    let response;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token not found.");
      }
      response = await fetch('/api/transactions/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
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
      console.error("Detailed fetch error (dashboard):", err);
      setError(prev => prev ? `${prev}\nDashboard: ${err.message}` : `Dashboard: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

   // --- Fetch shared categories ---
  const fetchAllCategories = async () => {
    try {
      const response = await fetch('/api/categories/all');
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

    const fetchMonthlySavingsData = async () => {
        setLoadingMonthlySavings(true);
        try {
          const token = localStorage.getItem('authToken');
          if (!token) throw new Error("Auth token not found for monthly savings.");
          const { data } = await axios.get('/api/transactions/savings/monthly', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let cumulativeTotal = 0;
          const processedData = (data || []).map(item => {
            cumulativeTotal += (item.savings || 0);
            return { ...item, cumulativeSavings: cumulativeTotal };
          });
          setMonthlySavingsData(processedData);
        } catch (err) {
          console.error('Error fetching monthly savings data:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch monthly savings.';
          setError(prev => prev ? `${prev}\nMonthly Savings: ${errorMessage}` : `Monthly Savings: ${errorMessage}`);
          setMonthlySavingsData([]);
        } finally {
          setLoadingMonthlySavings(false);
        }
    };

  useEffect(() => {
    setError(null);
    fetchDashboardData();
    fetchMonthlySavingsData();

    const storedCategories = localStorage.getItem('allCategories');
    if (storedCategories) {
        try { setAllCategories(JSON.parse(storedCategories)); }
        catch (e) { console.error("Error parsing stored categories:", e); localStorage.removeItem('allCategories'); fetchAllCategories(); }
    } else { fetchAllCategories(); }

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Auth token not found for profile fetch.");
            const response = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error fetching profile! status: ${response.status}. ${errorText.substring(0,100)}`); }
            const profileData = await response.json();
            if (profileData.createdAt) {
                const regDate = new Date(profileData.createdAt);
                setRegistrationDate(regDate.toISOString().split('T')[0]);
                console.log("User registration date set:", regDate.toISOString().split('T')[0]);
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            setError(prev => prev ? `${prev}\nProfile: ${err.message}` : `Profile: ${err.message}`);
        }
    };
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      const groupedByCategory = transactions.reduce((acc, tx) => {
        const categoryKey = tx.category || 'Uncategorized';
        if (!acc[categoryKey]) acc[categoryKey] = [];
        acc[categoryKey].push(tx);
        return acc;
      }, {});
    }
  }, [transactions]);

  const fetchLimits = async () => {
    setLoadingLimits(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Authentication token not found for limits fetch.");
      const response = await fetch('/api/limits', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Failed to fetch limits: ${response.statusText}`); }
      const data = await response.json();
      const validatedLimits = (data || []).map(limit => ({
        ...limit,
        amount: (typeof limit.amount === 'number' && !isNaN(limit.amount)) ? limit.amount : 0,
        currentSpending: (typeof limit.currentSpending === 'number' && !isNaN(limit.currentSpending)) ? limit.currentSpending : 0,
        remainingAmount: (typeof limit.remainingAmount === 'number' && !isNaN(limit.remainingAmount)) ? limit.remainingAmount : 0,
      }));
      setLimits(validatedLimits);
    } catch (err) {
      console.error("Error fetching limits:", err);
      setError(prev => prev ? `${prev}\nLimits: ${err.message}` : `Limits: ${err.message}`);
      setLimits([]);
    } finally { setLoadingLimits(false); }
  };

  useEffect(() => { fetchLimits(); }, []);

  useEffect(() => {
    const handleTransactionsUpdate = () => {
        console.log('Transaction update detected by Dashboard, refetching relevant data...');
        fetchDashboardData();
        fetchLimits();
        fetchMonthlySavingsData();
    };
    window.addEventListener('transactions-updated', handleTransactionsUpdate);
    return () => window.removeEventListener('transactions-updated', handleTransactionsUpdate);
  }, []);

  useEffect(() => {
    if (type === 'expense' && category.trim() !== '') {
      const categoryTrimmed = category.trim().toLowerCase();
      const relevantLimit = limits.find(limit => limit.category.toLowerCase() === categoryTrimmed);
      if (relevantLimit && (relevantLimit.exceeded || relevantLimit.remainingAmount <= 0)) {
        setCategoryLimitWarning(`Limit exceeded for "${relevantLimit.category}". Consider spending less for ${relevantLimit.category}.`);
      } else { setCategoryLimitWarning(null); }
    } else { setCategoryLimitWarning(null); }
  }, [category, type, limits]);

  const totalBalance = totalIncome - totalExpense;

  // --- Handle Add Transaction ---
  const handleAddTransaction = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

     if (!date) { toast.error("Please select a date."); return; }
    const [year, monthNum, day] = date.split('-').map(Number);
    const selectedDateObj = new Date(year, monthNum - 1, day);
    const today = new Date();
    const todayDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (selectedDateObj > todayDateObj) { toast.error("Cannot add a transaction with a future date."); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Please enter a valid positive amount."); return; }
    if (!description.trim()) { toast.error("Please enter a description."); return; }
     if (!category.trim()) { toast.error("Please enter a category."); return; }

    setIsSubmitting(true);
    setError(null); // Clear only submit-specific errors

    let finalAmount = parseFloat(amount);
    const baseAmount = parseFloat(amount);
    // isNaN check for baseAmount was removed in your original, so keeping it that way.
    // parseFloat(amount) <= 0 covers it if amount is not a positive number.

    const countDaysInMonth = (yearFreq, monthFreq, dayOfWeek) => {
        let count = 0;
        const dateCounter = new Date(yearFreq, monthFreq, 1);
        while (dateCounter.getMonth() === monthFreq) {
            if (dateCounter.getDay() === dayOfWeek) count++;
            dateCounter.setDate(dateCounter.getDate() + 1);
        }
        return count;
    };

    switch (frequency) {
        case 'daily':
            const nowDaily = new Date();
            finalAmount = baseAmount * new Date(nowDaily.getFullYear(), nowDaily.getMonth() + 1, 0).getDate();
            break;
        case 'weekly':
            if (selectedDayOfWeek === '') {
                 toast.error("Please select a day of the week for weekly frequency.");
                 setIsSubmitting(false); return;
            }
            const todayFreqWeekly = new Date();
            finalAmount = baseAmount * countDaysInMonth(todayFreqWeekly.getFullYear(), todayFreqWeekly.getMonth(), parseInt(selectedDayOfWeek, 10));
            break;
        case 'once':
        default:
            // finalAmount is already baseAmount
            break;
    }
    finalAmount = Math.round(finalAmount * 100) / 100;

    // =======================================================================
    // START OF THE ONLY MODIFIED SECTION FOR EXPENSE VALIDATION
    // =======================================================================
    if (type === 'expense') {
        const currentMonthCashFlowBalance = totalIncome - totalExpense; // Balance from current period's income/expense

        let availableFundsFromSavings = 0;
        let hasSavingsData = monthlySavingsData.length > 0;

        if (hasSavingsData) {
            availableFundsFromSavings = monthlySavingsData[monthlySavingsData.length - 1].cumulativeSavings;
        }

        // Scenario 1: User has positive cumulative savings.
        // They can spend up to this amount.
        if (hasSavingsData && availableFundsFromSavings >= 0) {
            if (finalAmount > availableFundsFromSavings) {
                toast.error(`Insufficient funds. This expense (${formatCurrency(finalAmount)}) exceeds your total available savings of ${formatCurrency(availableFundsFromSavings)}.`);
                setIsSubmitting(false);
                return;
            }
            // If expense is <= cumulative savings but > current month's cash flow, it means dipping into savings.
            if (finalAmount > currentMonthCashFlowBalance) {
                const proceed = window.confirm(
                    `This expense (${formatCurrency(finalAmount)}) will use your past savings as it exceeds your current month's balance. Do you want to proceed?`
                );
                if (!proceed) {
                    setIsSubmitting(false);
                    return;
                }
            }
        }
        // Scenario 2: User has no cumulative savings data OR cumulative savings is negative.
        // They can only spend if their current month's cash flow balance can cover it.
        else {
            if (finalAmount > currentMonthCashFlowBalance) {
                 toast.error(`Insufficient funds. This expense (${formatCurrency(finalAmount)}) exceeds your current month's balance of ${formatCurrency(currentMonthCashFlowBalance > 0 ? currentMonthCashFlowBalance : 0)}, and no past savings are available.`);
                 setIsSubmitting(false);
                 return;
            }
             // If finalAmount <= currentMonthCashFlowBalance, it's fine, no warning needed as it's covered by current month's positive flow.
        }
    }
    // =======================================================================
    // END OF THE ONLY MODIFIED SECTION FOR EXPENSE VALIDATION
    // =======================================================================

    const newTransaction = {
      type, amount: finalAmount, description, category,
      emoji: selectedEmoji, date, frequency,
    };

    try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error("Authentication token not found.");
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify(newTransaction),
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorData = { message: `Failed to add transaction: ${response.statusText}` };
            try { errorData = JSON.parse(errorText); } catch (e) {/* ignore */}
            throw new Error(errorData.message || `Failed to add transaction: ${response.statusText}`);
        }
        setType('expense'); setAmount(''); setDescription(''); setCategory('');
        setSelectedEmoji(''); setFrequency('once');
        setDate(() => new Date().toISOString().split('T')[0]);
        setSelectedDayOfWeek('');
        console.log("Dispatching transactions-updated event after add");
        window.dispatchEvent(new CustomEvent('transactions-updated'));
        toast.success("Transaction added successfully.");
        if (!allCategories.some(cat => cat.toLowerCase() === newTransaction.category.toLowerCase())) {
            const updatedCategories = [...allCategories, newTransaction.category];
            setAllCategories(updatedCategories);
            localStorage.setItem('allCategories', JSON.stringify(updatedCategories));
        }
        if (newTransaction.type === 'income') {
            console.log("Dispatching income-updated event");
            window.dispatchEvent(new CustomEvent('income-updated'));
        }
    } catch (err) {
        console.error("Error adding transaction:", err);
        setError(`Submit Error: ${err.message}`);
        // toast.error(`Submit Error: ${err.message}`); // This was in your original code for toast
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
      if (!window.confirm("Are you sure you want to delete this transaction?")) return;
      setError(null);
      try {
          const token = localStorage.getItem('authToken');
          if (!token) throw new Error("Authentication token not found.");
          const response = await fetch(`/api/transactions/${transactionId}`, {
              method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`); }
          console.log("Dispatching transactions-updated event after delete");
          window.dispatchEvent(new CustomEvent('transactions-updated'));
          toast.success("Transaction deleted successfully.");
      } catch (err) {
          console.error("Error deleting transaction:", err);
          setError(`Delete Error: ${err.message}`);
      }
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    // Assuming your original formatCurrency was USD as per the provided 850 lines
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
  };

  const pieChartData = [
    { name: 'Income', value: totalIncome > 0 ? totalIncome : 0 },
    { name: 'Expenses', value: totalExpense > 0 ? totalExpense : 0 },
    { name: 'Balance', value: totalBalance > 0 ? totalBalance : 0 },
  ];
  const colorMapping = { 'Income': '#34D399', 'Expenses': '#F87171', 'Balance': '#7091E6'};
  const filteredPieData = pieChartData.filter(item => item.value > 0);
  const hasChartData = filteredPieData.length > 0;

  const isPageLoading = loading || loadingLimits || loadingMonthlySavings;

  if (isPageLoading) {
      return <div className={styles.dashboardPageContent}><p>Loading dashboard data...</p></div>;
  }

  // The rest of your return JSX (summary, recent transactions, chart, form, limits)
  // remains exactly as it was in your original "850 lines" version.
  // I am not reproducing it here to keep the response focused on the change,
  // but assume it starts from: return ( <div className={styles.dashboardPageContent}> ...
  // and includes your original icon rendering (e.g., <img> tags or SVG components).

  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

       {/* Display general fetch/delete error messages */}
       {/* This error display should be as per your original file */}
       {error && !error.startsWith('Submit Error:') && !error.startsWith('Delete Error:') &&
         <div className={styles.pageErrorBanner}> {/* Assuming you had a class like this or similar styling */}
            {error.split('\n').map((e,i)=>
                <div key={i}>{e.replace(/(Dashboard: |Profile: |Limits: |Monthly Savings: )/g, '')}</div>
            )}
         </div>
       }
       {error && error.startsWith('Delete Error:') && /* Specific display for delete error if needed */
         <div className={styles.pageErrorBanner}>{error.replace('Delete Error: ', '')}</div>
       }


      {/* Summary Section - This should use your original icon rendering method */}
      <section className={styles.summarySection}>
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
              {/* YOUR ORIGINAL BALANCE ICON RENDERING (e.g., <img /> or <BalanceIcon />) */}
              <img src="https://cdn-icons-png.flaticon.com/128/869/869067.png" alt="Balance icon" className={styles.summaryIcon} /> Total Balance
           </div>
           <div className={styles.summaryValue}>{formatCurrency(totalBalance)}</div>
         </div>
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
             {/* YOUR ORIGINAL INCOME ICON RENDERING (e.g., <img /> or <IncomeIcon />) */}
             <img src="https://cdn-icons-png.flaticon.com/128/10365/10365322.png" alt="Income icon" className={`${styles.summaryIcon} ${styles.incomeIconColor}`} /> Total Income
           </div>
           <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
         </div>
         <div className={styles.summaryItem}>
           <div className={styles.summaryTitle}>
             {/* YOUR ORIGINAL EXPENSE ICON RENDERING (e.g., <img /> or <ExpenseIcon />) */}
             <img src="https://cdn-icons-png.flaticon.com/128/8733/8733406.png" alt="Expense icon" className={`${styles.summaryIcon} ${styles.expenseIconColor}`} /> Total Expense
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
                 <div key={tx._id || tx.id} className={`${styles.transactionItem} ${tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder}`}>
                   <span className={styles.transactionDate}>{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                   <span className={styles.transactionDesc}>
                     {tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}
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
           ) : ( <div className={styles.placeholderContent}> No recent transactions. Add one below! </div> )}
        </section>

        {/* Financial Overview Chart */}
        <section className={`${styles.sectionBox} ${styles.chartSection}`}>
           <h2 className={styles.sectionTitle}>Financial Overview</h2>
            <div className={styles.chartContainer}>
             {hasChartData ? (
               <ResponsiveContainer width="100%" height={300}>
                 <PieChart>
                   <Pie data={filteredPieData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                     {filteredPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={colorMapping[entry.name]} />))}
                   </Pie>
                   <Tooltip formatter={(value) => formatCurrency(value)} />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
              ) : ( <div className={styles.placeholderContent} style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}> No income, expense, or balance data yet. </div> )}
           </div>
       </section>
      </div>

       {/* Container for Form and Limits */}
       <div className={styles.formAndLimitsContainer}>
         {/* Add New Transaction Form Section */}
         <section className={`${styles.sectionBox} ${styles.addTransactionSection}`}>
           <h2 className={styles.sectionTitle}>Add New Transaction</h2>
            {/* Display submission errors specifically here */}
           {error && error.startsWith('Submit Error:') &&
             <div className={styles.formErrorBanner}>{error.replace('Submit Error: ', '')}</div>
           }
           <form onSubmit={handleAddTransaction} className={styles.transactionForm}>
              <div className={styles.formGroup}>
                <label htmlFor="emoji-picker-button">Icon:</label>
                <div className={styles.emojiSelectorContainer}>
                  <button id="emoji-picker-button" type="button" className={styles.emojiButton} onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={isSubmitting}>
                    {selectedEmoji ? selectedEmoji : '+'}
                  </button>
                  {showEmojiPicker && (
                    <div className={styles.emojiPickerContainer}>
                      <Picker onEmojiClick={(emojiData) => { setSelectedEmoji(emojiData.emoji); setShowEmojiPicker(false); }} />
                    </div>
                  )}
                </div>
              </div>
               <div className={styles.formGroup}>
               <label htmlFor="type">Type:</label>
               <select id="type" value={type} onChange={(e) => setType(e.target.value)} required className={styles.formInput} disabled={isSubmitting}>
                 <option value="expense">Expense</option>
                 <option value="income">Income</option>
               </select>
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="date">Date:</label>
               <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required className={styles.formInput} disabled={isSubmitting}
                 min={registrationDate ? registrationDate : (() => {
                   const todayForMin = new Date();
                   const firstDayOfCurrentMonth = new Date(Date.UTC(todayForMin.getUTCFullYear(), todayForMin.getUTCMonth(), 1));
                   return firstDayOfCurrentMonth.toISOString().split('T')[0];
                 })()}
                 max={new Date().toISOString().split('T')[0]}
               />
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="amount">Amount:</label>
               <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={isSubmitting}/>
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="description">Description:</label>
               <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Coffee, Salary" required className={styles.formInput} disabled={isSubmitting} autoComplete="off"/>
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="category">Category:</label>
               <input type="text" id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Food, Bills, Paycheck" required className={styles.formInput} disabled={isSubmitting} list="category-suggestions"/>
               <datalist id="category-suggestions">
                 {allCategories.map((cat, index) => (<option key={index} value={cat} />))}
               </datalist>
               {categoryLimitWarning && type === 'expense' && (
                 <div className={styles.categoryWarningMessage}>{categoryLimitWarning}</div>
               )}
             </div>
             <div className={styles.formGroup}>
               <label htmlFor="frequency">Frequency:</label>
               <select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} required className={styles.formInput} disabled={isSubmitting}>
                 <option value="once">One-time</option>
                 <option value="daily">Daily</option>
                 <option value="weekly">Weekly</option>
               </select>
             </div>
             {frequency === 'weekly' && (
               <div className={styles.formGroup}>
                 <label htmlFor="dayOfWeek">Day of Week:</label>
                 <select id="dayOfWeek" value={selectedDayOfWeek} onChange={(e) => setSelectedDayOfWeek(e.target.value)} required className={styles.formInput} disabled={isSubmitting}>
                   <option value="">Select Day</option>
                   <option value="0">Sunday</option> <option value="1">Monday</option> <option value="2">Tuesday</option>
                   <option value="3">Wednesday</option> <option value="4">Thursday</option> <option value="5">Friday</option>
                   <option value="6">Saturday</option>
                 </select>
               </div>
             )}
             <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
               {isSubmitting ? 'Adding...' : 'Add Transaction'}
             </button>
           </form>
         </section>

         {/* Spending Limits Section - Use limits state directly */}
         <section className={`${styles.sectionBox} ${styles.limitsSection}`}>
            <h2 className={styles.sectionTitle}>Spending Limits</h2>
            {loadingLimits ? (
              <div className={styles.placeholderContent}>Loading limits...</div>
            ) : limits.length > 0 ? (
              <>
                <div className={styles.limitList}>
                    {limits.slice(0, 4).map((limit) => {
                        const { amount: limitAmount, currentSpending: spentAmount, remainingAmount } = limit;
                        const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : (spentAmount > 0 ? 101 : 0);
                        const isOverspent = remainingAmount < 0 || limit.exceeded;
                        return (
                            <div key={limit._id || limit.category} className={styles.limitItem}>
                                <div className={styles.limitDetails}>
                                    <span className={styles.limitCategory}>{limit.category}</span>
                                    <div className={styles.limitAmounts}>
                                        <span className={styles.limitSpent}>Spent: {formatCurrency(spentAmount)}</span>
                                        <span className={styles.limitRemaining} style={{ color: isOverspent ? '#EF4444' : (remainingAmount === 0 && limitAmount > 0 ? '#D97706' : '#10B981') }}>
                                            {isOverspent ? `Overspent: ${formatCurrency(Math.abs(remainingAmount))}` : `Remaining: ${formatCurrency(remainingAmount)}`}
                                        </span>
                                    </div>
                                </div>
                                {remainingAmount === 0 && limitAmount > 0 && !isOverspent && (<div className={styles.limitExceededMessage} style={{color: '#D97706'}}>Limit Reached!</div>)}
                                {isOverspent && (<div className={styles.limitExceededMessage}>Limit Crossed!</div> )}
                                <div className={styles.limitTotal}>Limit: {formatCurrency(limitAmount)}</div>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar} style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: isOverspent ? '#EF4444' : '#4299e1' }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Link to="/limits" className={`${styles.seeAllButton} ${styles.limitsSeeAll}`}>See All Limits</Link>
              </>
            ) : ( <div className={styles.placeholderContent}> No spending limits set yet. <Link to="/limits">Set one now!</Link> </div> )}
         </section>
       </div>
    </div>
  );
}

export default Dashboard;