import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
// Updated recharts import
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import { FaBullseye, FaPiggyBank, FaEdit, FaTrash } from 'react-icons/fa';

// -- Inline Icon Components Placeholder --
// const BalanceIcon = ({ className }) => <img src="/path/to/balance-icon.svg" alt="Balance" className={className || styles.summaryIcon} />;
// const IncomeIcon = ({ className }) => <img src="/path/to/income-icon.svg" alt="Income" className={`${className || styles.summaryIcon} ${styles.incomeIconColor}`} />;
// const ExpenseIcon = ({ className }) => <img src="/path/to/expense-icon.svg" alt="Expense" className={`${className || styles.summaryIcon} ${styles.expenseIconColor}`} />;

const formatCurrency = (value) => {
const numValue = parseFloat(value);
if (isNaN(numValue)) {
return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
}
return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
if (!dateString) return "Invalid Date";
const date = new Date(dateString);
if (isNaN(date.getTime())) {
return 'Invalid Date';
}
// Ensure date is treated as UTC for formatting consistency
const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
return utcDate.toLocaleDateString('en-US', { timeZone: 'UTC', ...options });
};

function Dashboard() {
console.log("--- Dashboard Component Render Start ---");

const [totalIncome, setTotalIncome] = useState(0);
const [totalExpense, setTotalExpense] = useState(0);
const [transactions, setTransactions] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [allCategories, setAllCategories] = useState([]);
const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

const [type, setType] = useState('expense');
const [amount, setAmount] = useState('');
const [description, setDescription] = useState('');
const [category, setCategory] = useState('');
const [selectedEmoji, setSelectedEmoji] = useState('');
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
const [frequency, setFrequency] = useState('once');
const [selectedDayOfWeek, setSelectedDayOfWeek] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);

const [limits, setLimits] = useState([]);
const [loadingLimits, setLoadingLimits] = useState(true);
const [categoryLimitWarning, setCategoryLimitWarning] = useState(null);
const [registrationDate, setRegistrationDate] = useState(null);

const [monthlySavingsData, setMonthlySavingsData] = useState([]);
const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0);
const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);

const [currentMonthIncomeTotalForDisplay, setCurrentMonthIncomeTotalForDisplay] = useState(0);
const [currentMonthExpenseTotalForDisplay, setCurrentMonthExpenseTotalForDisplay] = useState(0);

const [recentGoals, setRecentGoals] = useState([]);
const [loadingGoals, setLoadingGoals] = useState(true);

const fetchDashboardData = useCallback(async () => {
setLoading(true);
try {
const token = localStorage.getItem('authToken');
if (!token) throw new Error("Auth token not found for dashboard.");
const response = await axios.get('/api/transactions/dashboard', {
headers: { 'Authorization': `Bearer ${token}` },
});
const data = response.data;
setTotalIncome(data.totalIncome || 0);
setTotalExpense(data.totalExpense || 0);
setTransactions(data.recentTransactions || []);
} catch (err) {
console.error("Error fetching dashboard data:", err.response?.data || err);
const msg = (err.response?.data?.message || err.message || "Failed to load dashboard data.").substring(0, 150);
setError(prev => prev ? `${prev}\nDashboard: ${msg}` : `Dashboard: ${msg}`);
} finally {
setLoading(false);
}
}, []);

const fetchAllCategoriesFromAPI = useCallback(async () => {
try {
const response = await axios.get('/api/categories/all');
const categories = response.data;
if (Array.isArray(categories)) {
setAllCategories(categories);
localStorage.setItem('allCategories', JSON.stringify(categories));
} else { console.error("Fetched categories is not an array:", categories); }
} catch (err) { console.error("Error fetching all categories:", err); }
}, []);

const fetchFinancialSummaryAndSavings = useCallback(async () => {
setLoadingFinancialSummary(true);
const token = localStorage.getItem('authToken');
if (!token) {
setError(prev => prev ? `${prev}\nAuth: Auth token required.` : `Auth: Auth token required.`);
setLoadingFinancialSummary(false);
setCurrentCumulativeSavings(0); setMonthlySavingsData([]);
return;
}
try {
const savingsResponse = await axios.get('/api/transactions/savings/monthly', {
headers: { 'Authorization': `Bearer ${token}` }
});
const fetchedMonthlyNetSavings = savingsResponse.data || [];
let cumulativeTotal = 0;
const processedData = fetchedMonthlyNetSavings.map(item => {
const monthlySavings = parseFloat(item.savings) || 0;
cumulativeTotal += monthlySavings;
return { ...item, savings: monthlySavings, cumulativeSavings: cumulativeTotal };
});
setMonthlySavingsData(processedData); // This data will be used for the bar chart
setCurrentCumulativeSavings(cumulativeTotal);
} catch (err) {
console.error("Error fetching financial summary/savings data:", err.response?.data || err);
const errMsg = (err.response?.data?.message || err.message || "Failed to fetch summary/savings.").substring(0,150);
setError(prev => prev ? `${prev}\nSummary/Savings: ${errMsg}` : `Summary/Savings: ${errMsg}`);
setCurrentCumulativeSavings(0); setMonthlySavingsData([]);
} finally {
setLoadingFinancialSummary(false);
}
}, []);

const fetchLimitsFromAPI = useCallback(async () => {
setLoadingLimits(true);
try {
const token = localStorage.getItem('authToken');
if (!token) throw new Error("Auth token not found for limits.");
const response = await axios.get('/api/limits', { headers: { 'Authorization': `Bearer ${token}` } });
const data = response.data;
const validatedLimits = (data || []).map(limit => ({
...limit,
amount: (typeof limit.amount === 'number' && !isNaN(limit.amount)) ? limit.amount : 0,
currentSpending: (typeof limit.currentSpending === 'number' && !isNaN(limit.currentSpending)) ? limit.currentSpending : 0,
remainingAmount: (typeof limit.remainingAmount === 'number' && !isNaN(limit.remainingAmount)) ? limit.remainingAmount : 0,
}));
setLimits(validatedLimits);
} catch (err) {
console.error("Error fetching limits:", err.response?.data || err);
setError(prev => prev ? `${prev}\nLimits: ${err.response?.data?.message || err.message}`.substring(0,150) : `Limits: ${err.response?.data?.message || err.message}`.substring(0,150));
setLimits([]);
} finally {
setLoadingLimits(false);
}
}, []);

const fetchRecentGoalsFromAPI = useCallback(async () => {
setLoadingGoals(true);
try {
const token = localStorage.getItem('authToken');
if (!token) throw new Error("Auth token not found for goals.");
const response = await axios.get('/api/goals', {
headers: { 'Authorization': `Bearer ${token}` }
});
const sortedGoals = (response.data || [])
.filter(goal => goal.status === 'active')
.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
setRecentGoals(sortedGoals.slice(0, 3));
} catch (err) {
console.error("Error fetching recent goals for Dashboard:", err.response?.data || err);
setError(prev => prev ? `${prev}\nGoals: ${err.response?.data?.message || err.message}`.substring(0,150) : `Goals: ${err.response?.data?.message || err.message}`.substring(0,150));
setRecentGoals([]);
} finally {
setLoadingGoals(false);
}
}, []);

useEffect(() => {
setError(null);
const token = localStorage.getItem('authToken');
if (token) {
fetchDashboardData();
fetchFinancialSummaryAndSavings();
fetchLimitsFromAPI();
fetchRecentGoalsFromAPI();

const storedCategories = localStorage.getItem('allCategories');
    if (storedCategories) {
        try { setAllCategories(JSON.parse(storedCategories)); }
        catch (e) { localStorage.removeItem('allCategories'); fetchAllCategoriesFromAPI(); }
    } else { fetchAllCategoriesFromAPI(); }

    const fetchUserProfile = async () => {
        try {
            const profileResponse = await axios.get('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (profileResponse.data.createdAt) {
                const regDate = new Date(profileResponse.data.createdAt);
                setRegistrationDate(regDate.toISOString().split('T')[0]);
            }
            if(profileResponse.data.username) {
                setUsername(profileResponse.data.username); // Set username from profile
                localStorage.setItem('username', profileResponse.data.username);
            }
        } catch (err) {
            console.error("Error fetching user profile:", err.response?.data || err);
            setError(prev => prev ? `${prev}\nProfile: ${err.response?.data?.message || err.message}`.substring(0,150) : `Profile: ${err.response?.data?.message || err.message}`.substring(0,150));
        }
    };
    fetchUserProfile();
} else {
    setError("Please log in to view the dashboard.");
    setLoading(false); setLoadingLimits(false); setLoadingFinancialSummary(false); setLoadingGoals(false);
    setTotalIncome(0); setTotalExpense(0); setTransactions([]); setLimits([]); setMonthlySavingsData([]); setCurrentCumulativeSavings(0); setRecentGoals([]);
}


}, [fetchDashboardData, fetchFinancialSummaryAndSavings, fetchLimitsFromAPI, fetchRecentGoalsFromAPI, fetchAllCategoriesFromAPI]);

useEffect(() => {
setCurrentMonthIncomeTotalForDisplay(totalIncome);
setCurrentMonthExpenseTotalForDisplay(totalExpense);
}, [totalIncome, totalExpense]);

useEffect(() => {
const handleDataUpdate = () => {
console.log('Dashboard received transactions-updated event, re-fetching all relevant data...');
const token = localStorage.getItem('authToken');
if (token) {
fetchDashboardData();
fetchFinancialSummaryAndSavings();
fetchLimitsFromAPI();
fetchRecentGoalsFromAPI();
}
};
window.addEventListener('transactions-updated', handleDataUpdate);
return () => {
window.removeEventListener('transactions-updated', handleDataUpdate);
};
}, [fetchDashboardData, fetchFinancialSummaryAndSavings, fetchLimitsFromAPI, fetchRecentGoalsFromAPI]);

useEffect(() => {
if (type === 'expense' && category.trim() !== '' && limits.length > 0) {
const categoryTrimmed = category.trim().toLowerCase();
const relevantLimit = limits.find(limit => limit.category.toLowerCase() === categoryTrimmed);
if (relevantLimit && (relevantLimit.exceeded || (relevantLimit.amount > 0 && relevantLimit.remainingAmount <= 0))) {
setCategoryLimitWarning(`Limit for "${relevantLimit.category}" is nearly or already exceeded.`);
} else { setCategoryLimitWarning(null); }
} else { setCategoryLimitWarning(null); }
}, [category, type, limits]);

const currentMonthBalanceForDisplay = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

const handleAddTransaction = async (event) => {
event.preventDefault();
if (isSubmitting) return;
if (!date) { toast.error("Please select a date."); return; }
const [yearStr, monthStr, dayStr] = date.split('-');
const year = parseInt(yearStr, 10);
const monthNum = parseInt(monthStr, 10);
const day = parseInt(dayStr, 10);
if (isNaN(year) || isNaN(monthNum) || isNaN(day)) { toast.error("Invalid date selected."); return; }
const selectedDateObj = new Date(Date.UTC(year, monthNum - 1, day));
const today = new Date();
const todayDateObj = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
if (selectedDateObj > todayDateObj) { toast.error("Cannot add a transaction with a future date."); return; }
if (registrationDate && selectedDateObj < new Date(registrationDate + "T00:00:00.000Z")) {
toast.error(`Transactions cannot be before registration date (${formatDate(registrationDate, {year: 'numeric', month: 'long', day: 'numeric'})}).`);
return;
}
if (!amount || parseFloat(amount) <= 0) { toast.error("Please enter a valid positive amount."); return; }
if (!description.trim()) { toast.error("Please enter a description."); return; }
if (!category.trim()) { toast.error("Please enter a category."); return; }

setIsSubmitting(true);
let finalAmount = parseFloat(amount);
const baseAmount = parseFloat(amount);
const countDaysInMonth = (yearFreq, monthFreq, dayOfWeekVal) => {
    let count = 0;
    const dateCounter = new Date(Date.UTC(yearFreq, monthFreq, 1));
    while (dateCounter.getUTCMonth() === monthFreq) {
        if (dateCounter.getUTCDay() === dayOfWeekVal) count++;
        dateCounter.setUTCDate(dateCounter.getUTCDate() + 1);
    }
    return count;
};
const currentTransactionDate = new Date(date + "T00:00:00.000Z");
if (frequency === 'daily') {
    const daysInMonth = new Date(Date.UTC(currentTransactionDate.getUTCFullYear(), currentTransactionDate.getUTCMonth() + 1, 0)).getUTCDate();
    finalAmount = baseAmount * daysInMonth;
} else if (frequency === 'weekly') {
    if (selectedDayOfWeek === '') {
         toast.error("Please select a day of the week for weekly frequency.");
         setIsSubmitting(false); return;
    }
    finalAmount = baseAmount * countDaysInMonth(currentTransactionDate.getUTCFullYear(), currentTransactionDate.getUTCMonth(), parseInt(selectedDayOfWeek, 10));
}
finalAmount = Math.round(finalAmount * 100) / 100;

if (type === 'expense') {
    const balanceForCurrentMonthOps = currentMonthIncomeTotalForDisplay - currentMonthExpenseTotalForDisplay;
    if (finalAmount > balanceForCurrentMonthOps && finalAmount > currentCumulativeSavings) {
        toast.error(`Insufficient funds. Expense (${formatCurrency(finalAmount)}) exceeds current month's balance (${formatCurrency(balanceForCurrentMonthOps > 0 ? balanceForCurrentMonthOps : 0)}) and total savings (${formatCurrency(currentCumulativeSavings > 0 ? currentCumulativeSavings : 0)}).`);
        setIsSubmitting(false); return;
    }
    if (finalAmount > balanceForCurrentMonthOps && finalAmount <= currentCumulativeSavings) {
        const proceed = window.confirm(`This expense (${formatCurrency(finalAmount)}) exceeds current month's balance but will be covered by total savings. Proceed?`);
        if (!proceed) { setIsSubmitting(false); return; }
    }
}

const newTransaction = { type, amount: finalAmount, description, category, emoji: selectedEmoji, date, frequency };
try {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error("Auth token not found.");
    await axios.post('/api/transactions', newTransaction, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
    });
    setType('expense'); setAmount(''); setDescription(''); setCategory(''); setSelectedEmoji(''); setFrequency('once');
    setDate(() => new Date().toISOString().split('T')[0]); setSelectedDayOfWeek('');
    window.dispatchEvent(new CustomEvent('transactions-updated'));
    toast.success("Transaction added successfully.");
    if (!allCategories.some(cat => cat.toLowerCase() === newTransaction.category.toLowerCase().trim())) {
        const updatedCategories = [...new Set([...allCategories, newTransaction.category.trim()])];
        setAllCategories(updatedCategories);
        localStorage.setItem('allCategories', JSON.stringify(updatedCategories));
    }
} catch (err) {
    console.error("Error adding transaction:", err.response?.data || err);
    const submitErrorMsg = err.response?.data?.message || err.message || "Failed to add transaction.";
    setError(prev => prev ? `${prev}\nSubmit: ${submitErrorMsg}` : `Submit: ${submitErrorMsg}`);
    toast.error(submitErrorMsg);
} finally {
    setIsSubmitting(false);
}
};

const handleDeleteTransaction = async (transactionId) => {
if (!window.confirm("Are you sure you want to delete this transaction?")) return;
setError(null);
try {
const token = localStorage.getItem('authToken');
if (!token) throw new Error("Authentication token not found for delete.");
// Using axios for consistency
await axios.delete(`/api/transactions/${transactionId}`, {
headers: { 'Authorization': `Bearer ${token}` }
});
window.dispatchEvent(new CustomEvent('transactions-updated'));
toast.success("Transaction deleted successfully.");
} catch (err) {
console.error("Error deleting transaction:", err.response?.data || err);
const deleteErrorMsg = err.response?.data?.message || err.message || "Failed to delete transaction.";
setError(prev => prev ? `${prev}\nDelete: ${deleteErrorMsg}` : `Delete: ${deleteErrorMsg}`);
toast.error(deleteErrorMsg);
}
};

const pieChartDataForRender = useMemo(() => {
const data = [];
if (totalIncome > 0) {
data.push({ name: 'Income', value: totalIncome });
}
if (totalExpense > 0) {
data.push({ name: 'Expenses', value: totalExpense });
}
if (currentMonthBalanceForDisplay > 0) {
data.push({ name: 'Balance', value: currentMonthBalanceForDisplay });
}
return data;
}, [totalIncome, totalExpense, currentMonthBalanceForDisplay]);

const colorMapping = {
'Income': '#34D399',      // Green
'Expenses': '#F87171',    // Red
'Balance': '#7091E6'     // Light Blue (Your primary accent light)
};

const filteredPieData = pieChartDataForRender.filter(item => item.value > 0);
const hasChartData = filteredPieData.length > 0;

// Prepare data for the Monthly Savings Bar Chart
const savingsChartData = useMemo(() => {
    if (!monthlySavingsData || monthlySavingsData.length === 0) {
        return [];
    }
    // Show up to the last 12 months of savings data
    const dataSlice = monthlySavingsData.slice(-12);
    return dataSlice.map(item => ({
        // The 'month' from backend is expected to be a string like "YYYY-MM-01"
        name: formatDate(item.month, { month: 'short', year: '2-digit' }),
        Savings: parseFloat(item.savings?.toFixed(2) || 0),
    }));
}, [monthlySavingsData]);


const pageIsLoading = loading || loadingLimits || loadingFinancialSummary || loadingGoals;
const isPageLoading = pageIsLoading; // Alias for clarity in one spot below

if (pageIsLoading && !localStorage.getItem('authToken')) {
return <div className={styles.dashboardPageContent}><p className={styles.loadingMessage}>Checking authentication...</p></div>;
}
if (pageIsLoading && !error ) {
return <div className={styles.dashboardPageContent}><p className={styles.loadingMessage}>Loading dashboard data...</p></div>;
}
if (error && !loading && !localStorage.getItem('authToken')) {
return (
<div className={styles.dashboardPageContent}>
<h1 className={styles.pageTitle}>Dashboard</h1>
<div className={styles.pageErrorBanner}>
Please <Link to="/login">log in</Link> to view your dashboard.
{(error.includes("Auth token") || error.includes("Authentication token")) && <><br/><small>Details: {error.split('\n').map((e,i)=><span key={i}>{e}<br/></span>)}</small></>}
</div>
</div>
);
}
const showMajorError = error && !loading && !loadingFinancialSummary && !loadingLimits && !loadingGoals && transactions.length === 0 && limits.length === 0 && recentGoals.length === 0;
if (showMajorError ) {
return (
<div className={styles.dashboardPageContent}>
<h1 className={styles.pageTitle}>Dashboard</h1>
<div className={styles.pageErrorBanner}>
Failed to load essential dashboard components. Please try refreshing.
<br/>
<small>Details: {error.split('\n').map((e,i)=> <span key={i}>{e.replace(/(Dashboard: |Profile: |Limits: |Monthly Savings: |Goals: |Auth: |Submit: )/g, '')}<br/></span>)}</small>
</div>
</div>
);
}

return (
<div className={styles.dashboardPageContent}>
<h1 className={styles.pageTitle}>Welcome back, {username}!</h1>


{error && !showMajorError && (
     <div className={`${styles.pageErrorBanner} ${styles.nonCriticalError}`}>
        Some data might be unavailable: {error.split('\n').map((e,i)=> <span key={i}>{e.replace(/(Dashboard: |Profile: |Limits: |Monthly Savings: |Goals: |Submit: |Auth: |Delete: )/g, '')}<br/></span>)}
     </div>
   )}
   {!localStorage.getItem('authToken') && !error && !isPageLoading && (
        <div className={styles.pageErrorBanner}> Please <Link to="/login">log in</Link> to view your dashboard. </div>
   )}

  {/* Summary Section */}
  <section className={styles.summarySection}>
     <div className={styles.summaryItem}>
       <div className={styles.summaryTitle}>
          <img src="https://cdn-icons-png.flaticon.com/128/869/869067.png" alt="Balance icon" className={styles.summaryIcon} /> Current Month Balance
       </div>
       <div className={styles.summaryValue}>{formatCurrency(currentMonthBalanceForDisplay)}</div>
     </div>
     <div className={styles.summaryItem}>
       <div className={styles.summaryTitle}>
         <img src="https://cdn-icons-png.flaticon.com/128/10365/10365322.png" alt="Income icon" className={`${styles.summaryIcon} ${styles.incomeIconColor}`} /> Current Month Income
       </div>
       <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
     </div>
     <div className={styles.summaryItem}>
       <div className={styles.summaryTitle}>
         <img src="https://cdn-icons-png.flaticon.com/128/8733/8733406.png" alt="Expense icon" className={`${styles.summaryIcon} ${styles.expenseIconColor}`} /> Current Month Expense
       </div>
       <div className={`${styles.summaryValue} ${styles.expense}`}>{formatCurrency(totalExpense)}</div>
     </div>
     <div className={styles.summaryItem}>
        <div className={styles.summaryTitle}>
            <FaPiggyBank className={`${styles.summaryIcon} ${styles.savingsIconColor || ''}`} /> Total Cumulative Savings
        </div>
        <div className={`${styles.summaryValue} ${currentCumulativeSavings >= 0 ? styles.income : styles.expense}`}>
            {loadingFinancialSummary ? "Loading..." : formatCurrency(currentCumulativeSavings)}
        </div>
    </div>
  </section>

  {/* Main Content Area Grid */}
  <div className={styles.mainArea}>
    <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Recent Transactions (Current Month)</h2>
        <Link to="/transactions" className={styles.seeAllButton}>See All</Link>
      </div>
       {loading && transactions.length === 0 ? <div className={styles.placeholderContent}>Loading transactions...</div> : 
        transactions.length > 0 ? (
         <div className={styles.transactionList}>
           {transactions.slice(0,5).map((tx) => ( // Displaying latest 5 transactions
             <div key={tx._id} className={`${styles.transactionItem} ${tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder}`}>
               <span className={styles.transactionDate}>{formatDate(tx.date, { month: 'short', day: 'numeric' })}</span>
               <span className={styles.transactionDesc}>
                 {tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}
                 {tx.description} ({tx.category})
               </span>
               <span className={`${styles.transactionAmount} ${tx.type === 'income' ? styles.income : styles.expense}`}>
                 {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
               </span>
             </div>
           ))}
         </div>
       ) : ( <div className={styles.placeholderContent}> No recent transactions this month. </div> )}
    </section>

    <section className={`${styles.sectionBox} ${styles.chartSection}`}>
       <h2 className={styles.sectionTitle}>Current Month Financial Overview</h2>
        <div className={styles.chartContainer}>
         {(loading && !hasChartData) ? <div className={styles.placeholderContent}>Loading chart data...</div> :
          hasChartData ? (
           <ResponsiveContainer width="100%" height={300}>
             <PieChart>
               <Pie 
                    data={filteredPieData} 
                    cx="50%" 
                    cy="50%" 
                    labelLine={false} 
                    outerRadius={100} 
                    fill="#8884d8" 
                    dataKey="value" 
                    nameKey="name" 
                    label={({ name, value }) => `${name}: $${value}`}
                >
                 {filteredPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colorMapping[entry.name] || '#8884d8'} />
                 ))}
               </Pie>
               <RechartsTooltip formatter={(value) => formatCurrency(value)} />
               <Legend />
             </PieChart>
           </ResponsiveContainer>
          ) : ( <div className={styles.placeholderContent} style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}> No income or expense data for the current month. </div> )}
       </div>
   </section>
  </div>

   {/* --- Bottom Row Container holds Add Transaction, Limits, Goals, and Savings Chart --- */}
   <div className={styles.bottomRowContainer}>
     <section className={`${styles.sectionBox} ${styles.addTransactionSection}`}>
       <h2 className={styles.sectionTitle}>Add New Transaction</h2>
       <form onSubmit={handleAddTransaction} className={styles.transactionForm}>
          <div className={styles.formGroup}>
            <label htmlFor="emoji-picker-button">Icon:</label>
            <div className={styles.emojiSelectorContainer}>
              <button id="emoji-picker-button" type="button" className={styles.emojiButton} onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={isSubmitting}>
                {selectedEmoji ? selectedEmoji : '+'}
              </button>
              {showEmojiPicker && (
                <div className={styles.emojiPickerContainer}>
                  <Picker onEmojiClick={(emojiData) => { setSelectedEmoji(emojiData.emoji); setShowEmojiPicker(false); }} theme="auto" pickerStyle={{width: '100%'}}/>
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
             min={registrationDate ? registrationDate : undefined }
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

     <section className={`${styles.sectionBox} ${styles.limitsSection}`}>
        <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Spending Limits</h2>
            <Link to="/limits" className={`${styles.seeAllButton} ${styles.limitsSeeAll}`}>Manage Limits</Link>
        </div>
        {loadingLimits ? (
          <div className={styles.placeholderContent}>Loading limits...</div>
        ) : limits.length > 0 ? (
          <>
            <div className={styles.limitList}>
                {limits.slice(0, 4).map((limit) => {
                    const { amount: limitAmount, currentSpending: spentAmount, remainingAmount } = limit;
                    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : (spentAmount > 0 ? 101 : 0); 
                    const isOverspent = limit.exceeded || (limitAmount > 0 && spentAmount > limitAmount);
                    const progressPercentage = Math.min(percentage, 100);

                    return (
                        <div key={limit._id} className={styles.limitItem}>
                            <div className={styles.limitDetails}>
                                <span className={styles.limitCategory}>{limit.category}</span>
                                <div className={styles.limitAmounts}>
                                    <span className={styles.limitSpent}>Spent: {formatCurrency(spentAmount)}</span>
                                    <span className={styles.limitRemaining} style={{ color: isOverspent ? '#EF4444' : ((remainingAmount === 0 && limitAmount > 0) ? '#D97706' : '#10B981') }}>
                                        {isOverspent ? `Over: ${formatCurrency(Math.abs(remainingAmount))}` : `Left: ${formatCurrency(remainingAmount)}`}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.limitTotal}>Limit: {formatCurrency(limitAmount)}</div>
                            <div className={styles.progressBarContainer}>
                                <div 
                                    className={styles.progressBar} 
                                    style={{ 
                                        width: `${progressPercentage}%`, 
                                        backgroundColor: isOverspent ? '#EF4444' : (percentage >= 90 ? '#F59E0B' : '#4299e1') 
                                    }}
                                    title={`${percentage.toFixed(1)}% Used`}
                                ></div>
                            </div>
                             {isOverspent && (<div className={styles.limitExceededMessageSmall}>Limit Exceeded!</div> )}
                             {(remainingAmount === 0 && limitAmount > 0 && !isOverspent) && (<div className={styles.limitExceededMessageSmall} style={{color: '#D97706', backgroundColor: 'rgba(217, 119, 6, 0.1)'}}>Limit Reached!</div>)}
                        </div>
                    );
                })}
            </div>
          </>
        ) : ( <div className={styles.placeholderContent}> No spending limits set. <Link to="/limits">Set one now!</Link> </div> )}
     </section>

    <section className={`${styles.sectionBox} ${styles.goalsSection}`}>
        <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}><FaBullseye style={{marginRight: '8px'}}/>Active Goals</h2>
            <Link to="/goals" className={styles.seeAllButton}>Manage Goals</Link>
        </div>
        {loadingGoals ? (<div className={styles.placeholderContent}>Loading goals...</div>)
        : recentGoals.length > 0 ? (
            <div className={styles.goalListDashboard}>
                {recentGoals.map(goal => (
                    <div key={goal._id} className={styles.goalItemDashboard}>
                        <div className={styles.goalItemHeaderDashboard}>
                            <span className={styles.goalIconDashboard}>{goal.icon || '🎯'}</span>
                            <span className={styles.goalDescriptionDashboard} title={goal.description}>{goal.description}</span>
                        </div>
                        <div className={styles.goalProgressDashboard}>
                            <span>{formatCurrency(goal.savedAmount)} / {formatCurrency(goal.targetAmount)}</span>
                            <span className={styles.goalPercentageDashboard}>({goal.progress ? goal.progress.toFixed(1) : '0.0'}%)</span>
                        </div>
                        <div className={styles.progressBarContainerSmall}>
                            <div 
                                className={styles.progressBarSmall}
                                style={{ width: `${goal.progress ? Math.min(goal.progress, 100) : 0}%`}} 
                                title={`${goal.progress ? goal.progress.toFixed(1) : '0.0'}% Complete`}
                            ></div>
                        </div>
                        <div className={styles.goalDeadlineDashboard}>
                            Due: {formatDate(goal.targetDate, {month: 'short', day: 'numeric', year: '2-digit' })}
                        </div>
                    </div>
                ))}
            </div>
        ) : ( <div className={styles.placeholderContent}> No active goals. <Link to="/goals">Set a Goal!</Link> </div>)}
    </section>

    {/* --- Monthly Savings Bar Chart Section (Moved here) --- */}
    <section className={`${styles.sectionBox} ${styles.savingsChartSection}`}> {/* Ensure it uses sectionBox */}
        <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Monthly Savings Trend</h2> {/* Shortened title for smaller space */}
            <Link to="/savings" className={styles.seeAllButton}>Full Report</Link>
        </div>
        <div className={styles.chartContainer}>
            {loadingFinancialSummary && savingsChartData.length === 0 ? (
                <div className={styles.placeholderContent}>Loading savings...</div>
            ) : savingsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}> {/* Adjusted height for bottom row */}
                    <BarChart data={savingsChartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}> {/* Adjusted margins */}
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="name" stroke="#666" fontSize="10px" />
                        <YAxis stroke="#666" tickFormatter={(value) => formatCurrency(value).replace('$', '')} fontSize="10px" width={70} />
                        <RechartsTooltip 
                            formatter={(value, name) => [formatCurrency(value), name]}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '5px' }}
                            cursor={{ fill: 'rgba(204,204,204,0.2)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}/>
                        <Bar dataKey="Savings" fill="#82ca9d" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className={styles.placeholderContent} style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    No savings data yet. <Link to="/transactions">Add transactions</Link> to see your trend.
                </div>
            )}
        </div>
    </section>
    {/* --- End Monthly Savings Bar Chart Section --- */}
   </div>
</div>
);
}

export default Dashboard;