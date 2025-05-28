import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import { FaBullseye, FaPiggyBank } from 'react-icons/fa';

const INCOME_CATEGORY_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A230ED',
  '#FF5733', '#33FF57', '#3357FF', '#FF33A8', '#A833FF',
  '#FF6666', '#66FF66', '#6666FF', '#FFFF66', '#FF66FF',
];
const EXPENSE_CATEGORY_COLORS = [
  '#FF8042', '#FFBB28', '#FF5733', '#A230ED', '#00C49F',
  '#F87171', '#DC2626', '#B91C1C', '#7F1D1D', '#FCA5A5'
];

const formatCurrency = (value) => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!dateString) return "Invalid Date";
  if (typeof dateString === 'string' && /^\d{4}-\d{2}$/.test(dateString)) {
    dateString += '-01';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  const dateToFormat = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00Z');
  return dateToFormat.toLocaleDateString('en-US', options);
};

const getDisplayDateString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function Dashboard() {
  console.log("--- Dashboard Component Render Start ---");

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allCategories, setAllCategories] = useState(() => {
    const savedCategories = localStorage.getItem('allCategories');
    try {
      return savedCategories ? JSON.parse(savedCategories) : [];
    } catch (e) {
      console.error("Error parsing categories from localStorage:", e);
      localStorage.removeItem('allCategories'); // Clear corrupted data
      return [];
    }
  });
  const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const todayDateString = getDisplayDateString(new Date());
  const [date, setDate] = useState(todayDateString);
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
  const [recentGoals, setRecentGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [currentMonthIncomeTransactions, setCurrentMonthIncomeTransactions] = useState([]);
  const [loadingCurrentMonthIncome, setLoadingCurrentMonthIncome] = useState(true);
  const [currentMonthExpenseTransactions, setCurrentMonthExpenseTransactions] = useState([]);
  const [loadingCurrentMonthExpenses, setLoadingCurrentMonthExpenses] = useState(true);

  const addTransactionSectionRef = useRef(null);

  const handleScrollToAddTransaction = () => {
    if (addTransactionSectionRef.current) {
      addTransactionSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Auth token not found for dashboard.");
      const response = await axios.get('/api/transactions/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
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

  // This function definition is kept for potential future use or if other parts rely on its structure,
  // but it is NOT CALLED during initial data load to prevent the 404 error.
  // Categories are now primarily managed locally and loaded from localStorage.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchAllCategoriesFromAPI = useCallback(async () => {
    console.warn("fetchAllCategoriesFromAPI is defined but should not be called in the current configuration to avoid 404 errors for /api/categories/all. Categories are loaded from localStorage.");
    try {
      const token = localStorage.getItem('authToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      // The following line would make the problematic API call:
      // const response = await axios.get('/api/categories/all', { headers });
      // const categoriesData = response.data;
      // if (Array.isArray(categoriesData)) {
      //   setAllCategories(categoriesData);
      //   localStorage.setItem('allCategories', JSON.stringify(categoriesData));
      // } else { console.error("Fetched categories is not an array:", categoriesData); }
    } catch (err) {
        // This error handling is for if the call were to be re-enabled.
        console.error("Error during (currently disabled) fetchAllCategoriesFromAPI call:", err);
    }
  }, []);

  const fetchFinancialSummaryAndSavings = useCallback(async () => {
    setLoadingFinancialSummary(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError(prev => prev ? `${prev}\nAuth: Auth token required for savings.` : `Auth: Auth token required for savings.`);
      setLoadingFinancialSummary(false);
      setCurrentCumulativeSavings(0); setMonthlySavingsData([]);
      return;
    }
    try {
      const savingsResponse = await axios.get('/api/transactions/savings/monthly', { headers: { 'Authorization': `Bearer ${token}` } });
      const fetchedMonthlyNetSavings = savingsResponse.data || [];
      let cumulativeTotal = 0;
      const processedData = fetchedMonthlyNetSavings.map(item => {
        const monthlySavings = parseFloat(item.savings) || 0;
        cumulativeTotal += monthlySavings;
        return { ...item, savings: monthlySavings, cumulativeSavings: cumulativeTotal };
      });
      setMonthlySavingsData(processedData);
      setCurrentCumulativeSavings(cumulativeTotal);
    } catch (err) {
      console.error("Error fetching financial summary/savings data:", err.response?.data || err);
      const errMsg = (err.response?.data?.message || err.message || "Failed to fetch summary/savings.").substring(0, 150);
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
      const msg = (err.response?.data?.message || err.message || "Failed to load limits.").substring(0, 150);
      setError(prev => prev ? `${prev}\nLimits: ${msg}` : `Limits: ${msg}`);
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
      const response = await axios.get('/api/goals', { headers: { 'Authorization': `Bearer ${token}` } });
      const sortedGoals = (response.data || [])
        .filter(goal => goal.status === 'active')
        .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
      setRecentGoals(sortedGoals.slice(0, 3));
    } catch (err) {
      console.error("Error fetching recent goals for Dashboard:", err.response?.data || err);
      const msg = (err.response?.data?.message || err.message || "Failed to load goals.").substring(0, 150);
      setError(prev => prev ? `${prev}\nGoals: ${msg}` : `Goals: ${msg}`);
      setRecentGoals([]);
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  const fetchCurrentMonthIncomeData = useCallback(async () => {
    setLoadingCurrentMonthIncome(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Auth token not found for current month income.");
      const response = await axios.get('/api/transactions/current-month/income', { headers: { 'Authorization': `Bearer ${token}` } });
      const incomeData = response.data || [];
      incomeData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setCurrentMonthIncomeTransactions(incomeData);
    } catch (err) {
      console.error("Error fetching current month income data:", err.response?.data || err);
      const msg = (err.response?.data?.message || err.message || "Failed to load current month income.").substring(0, 150);
      setError(prev => prev ? `${prev}\nMonthIncome: ${msg}` : `MonthIncome: ${msg}`);
      setCurrentMonthIncomeTransactions([]);
    } finally {
      setLoadingCurrentMonthIncome(false);
    }
  }, []);

  const fetchCurrentMonthExpenseData = useCallback(async () => {
    setLoadingCurrentMonthExpenses(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Auth token not found for current month expenses.");
      const response = await axios.get('/api/transactions/current-month/expense', { headers: { 'Authorization': `Bearer ${token}` } });
      const expenseData = response.data || [];
      expenseData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setCurrentMonthExpenseTransactions(expenseData);
    } catch (err) {
      console.error("Error fetching current month expense data:", err.response?.data || err);
      const msg = (err.response?.data?.message || err.message || "Failed to load current month expenses.").substring(0, 150);
      setError(prev => prev ? `${prev}\nMonthExpense: ${msg}` : `MonthExpense: ${msg}`);
      setCurrentMonthExpenseTransactions([]);
    } finally {
      setLoadingCurrentMonthExpenses(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    const token = localStorage.getItem('authToken');

    const fetchUserProfile = async (authToken) => {
        try {
            const profileResponse = await axios.get('/api/users/me', { headers: { 'Authorization': `Bearer ${authToken}` } });
            if (profileResponse.data.name) {
                setUsername(profileResponse.data.name);
                localStorage.setItem('username', profileResponse.data.name);
            }
            if (profileResponse.data.createdAt) {
                const regDate = new Date(profileResponse.data.createdAt);
                setRegistrationDate(getDisplayDateString(regDate));
            }
        } catch (err) {
            console.error("Error fetching user profile:", err.response?.data || err.message, err);
            const profileErrorMsg = (err.response?.data?.message || err.message || "Failed to load user profile.").substring(0, 150);
            setError(prev => prev ? `${prev}\nProfile: ${profileErrorMsg}` : `Profile: ${profileErrorMsg}`);
            if (err.response?.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('username');
                // Consider redirecting to login here
            }
        }
    };

    if (token) {
        fetchUserProfile(token);
        fetchDashboardData();
        fetchFinancialSummaryAndSavings();
        fetchLimitsFromAPI();
        fetchRecentGoalsFromAPI();
        fetchCurrentMonthIncomeData();
        fetchCurrentMonthExpenseData();
        // fetchAllCategoriesFromAPI(); // <<<< CRITICAL CHANGE: This call is COMMENTED OUT to prevent the 404 error.
                                      // Categories are loaded from localStorage at state initialization.
    } else {
        setError("Please log in to view the dashboard.");
        setLoading(false); setLoadingLimits(false); setLoadingFinancialSummary(false); setLoadingGoals(false); setLoadingCurrentMonthIncome(false); setLoadingCurrentMonthExpenses(false);
        setTotalIncome(0); setTotalExpense(0); setTransactions([]); setLimits([]); setMonthlySavingsData([]); setCurrentCumulativeSavings(0); setRecentGoals([]); setCurrentMonthIncomeTransactions([]); setCurrentMonthExpenseTransactions([]);
        setAllCategories([]); // Reset categories if not logged in
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // The dependencies for this useEffect are effectively empty `[]` because:
  // 1. `token` is a primitive derived from localStorage (not reactive state itself for this effect's trigger).
  // 2. All `fetch...` functions called within are wrapped in `useCallback` with empty dependency arrays,
  //    making them stable references that don't change across renders.
  // 3. `fetchAllCategoriesFromAPI` is no longer called here.
  }, []);

  useEffect(() => {
    const handleDataUpdate = () => {
      console.log('Dashboard received transactions-updated event, re-fetching relevant data...');
      const token = localStorage.getItem('authToken');
      if (token) {
        fetchDashboardData();
        fetchFinancialSummaryAndSavings();
        fetchLimitsFromAPI();
        fetchCurrentMonthIncomeData();
        fetchCurrentMonthExpenseData();
      }
    };
    window.addEventListener('transactions-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('transactions-updated', handleDataUpdate);
    };
  }, [fetchDashboardData, fetchFinancialSummaryAndSavings, fetchLimitsFromAPI, fetchCurrentMonthIncomeData, fetchCurrentMonthExpenseData]);

  useEffect(() => {
    if (type === 'expense' && category.trim() !== '' && limits.length > 0) {
      const categoryTrimmed = category.trim().toLowerCase();
      const relevantLimit = limits.find(limit => limit.category.toLowerCase() === categoryTrimmed);
      if (relevantLimit && (relevantLimit.exceeded || (relevantLimit.amount > 0 && relevantLimit.remainingAmount <= 0))) {
        setCategoryLimitWarning(`Limit for "${relevantLimit.category}" is nearly or already exceeded.`);
      } else { setCategoryLimitWarning(null); }
    } else { setCategoryLimitWarning(null); }
  }, [category, type, limits]);

  const dateInputProps = useMemo(() => {
    const today = new Date();
    const currentMonthFirstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const minDate = getDisplayDateString(currentMonthFirstDay);
    const maxDate = getDisplayDateString(today);
    return { min: minDate, max: maxDate };
  }, []);

  const currentMonthBalanceForDisplay = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);
  const recentIncomeForDisplay = useMemo(() => currentMonthIncomeTransactions.slice(0, 5), [currentMonthIncomeTransactions]);
  const recentExpensesForDisplay = useMemo(() => currentMonthExpenseTransactions.slice(0, 5), [currentMonthExpenseTransactions]);

  const incomeByCategoryPieData = useMemo(() => {
    if (!currentMonthIncomeTransactions || currentMonthIncomeTransactions.length === 0) return [];
    const categoryMap = currentMonthIncomeTransactions.reduce((acc, tx) => {
      const cat = tx.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + (parseFloat(tx.amount) || 0);
      return acc;
    }, {});
    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .filter(item => item.value > 0);
  }, [currentMonthIncomeTransactions]);

  const expenseByCategoryBarData = useMemo(() => {
    if (!currentMonthExpenseTransactions || currentMonthExpenseTransactions.length === 0) return [];
    const categoryMap = currentMonthExpenseTransactions.reduce((acc, tx) => {
      const cat = tx.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + (parseFloat(tx.amount) || 0);
      return acc;
    }, {});
    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, amount: parseFloat(value.toFixed(2)) }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthExpenseTransactions]);

  const pieChartDataForRender = useMemo(() => {
    const data = [];
    if (totalIncome > 0) data.push({ name: 'Income', value: totalIncome });
    if (totalExpense > 0) data.push({ name: 'Expenses', value: totalExpense });
    if (currentMonthBalanceForDisplay > 0 && (totalIncome > 0 || totalExpense > 0)) data.push({ name: 'Balance', value: currentMonthBalanceForDisplay });
    return data;
  }, [totalIncome, totalExpense, currentMonthBalanceForDisplay]);

  const colorMapping = { 'Income': '#34D399', 'Expenses': '#F87171', 'Balance': '#7091E6' };
  const filteredPieData = pieChartDataForRender.filter(item => item.value > 0);
  const hasChartData = filteredPieData.length > 0;

  const savingsChartData = useMemo(() => {
    if (!monthlySavingsData || monthlySavingsData.length === 0) return [];
    const dataSlice = monthlySavingsData.slice(-12);
    return dataSlice.map(item => ({
      name: formatDate(item.month, { month: 'short', year: '2-digit' }),
      Savings: parseFloat(item.savings?.toFixed(2) || 0),
    }));
  }, [monthlySavingsData]);

  const handleAddTransaction = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!date) { toast.error("Please select a date."); return; }

    const [selectedYear, selectedMonthNum, selectedDayNum] = date.split('-').map(Number);
    const selectedJsMonth = selectedMonthNum - 1;
    const todayForValidation = new Date();
    const currentYear = todayForValidation.getFullYear();
    const currentJsMonth = todayForValidation.getMonth();
    const currentDay = todayForValidation.getDate();

    if (selectedYear > currentYear || (selectedYear === currentYear && selectedJsMonth > currentJsMonth) || (selectedYear === currentYear && selectedJsMonth === currentJsMonth && selectedDayNum > currentDay)) {
      toast.error("Cannot add a transaction with a future date."); return;
    }
    if (selectedYear !== currentYear || selectedJsMonth !== currentJsMonth) {
      toast.error("Please select a date within the current month."); return;
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
    const transactionYearForFreq = selectedYear;
    const transactionMonthForFreq = selectedJsMonth;
    if (frequency === 'daily') {
      const daysInSelectedMonth = new Date(Date.UTC(transactionYearForFreq, transactionMonthForFreq + 1, 0)).getUTCDate();
      finalAmount = baseAmount * daysInSelectedMonth;
    } else if (frequency === 'weekly') {
      if (selectedDayOfWeek === '') { toast.error("Please select a day of the week for weekly frequency."); setIsSubmitting(false); return; }
      finalAmount = baseAmount * countDaysInMonth(transactionYearForFreq, transactionMonthForFreq, parseInt(selectedDayOfWeek, 10));
    }
    finalAmount = Math.round(finalAmount * 100) / 100;

    if (type === 'expense') {
      const balanceForCurrentMonthOps = totalIncome - totalExpense;
      const availableBalance = Math.max(0, balanceForCurrentMonthOps);
      if (finalAmount > availableBalance && finalAmount > currentCumulativeSavings) {
        toast.error(`Insufficient funds. Expense (${formatCurrency(finalAmount)}) exceeds current month's available balance (${formatCurrency(availableBalance)}) and total savings (${formatCurrency(currentCumulativeSavings)}).`);
        setIsSubmitting(false); return;
      } else if (finalAmount > availableBalance && finalAmount <= currentCumulativeSavings) {
        const proceed = window.confirm(`Expense (${formatCurrency(finalAmount)}) exceeds current month's available balance (${formatCurrency(availableBalance)}) but will be covered by total savings (${formatCurrency(currentCumulativeSavings)}). Proceed?`);
        if (!proceed) { setIsSubmitting(false); return; }
      }
    }

    const newTransaction = { type, amount: finalAmount, description: description.trim(), category: category.trim(), emoji: selectedEmoji, date, frequency };
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error("Auth token not found.");
      await axios.post('/api/transactions', newTransaction, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      setType('expense'); setAmount(''); setDescription(''); setCategory(''); setSelectedEmoji(''); setFrequency('once');
      setDate(todayDateString); setSelectedDayOfWeek('');
      window.dispatchEvent(new CustomEvent('transactions-updated'));
      toast.success("Transaction added successfully.");

      const newCategoryTrimmed = newTransaction.category.trim();
      const newCategoryLower = newCategoryTrimmed.toLowerCase();
      if (newCategoryTrimmed && !allCategories.some(cat => cat.toLowerCase() === newCategoryLower)) {
        const updatedCategories = [...new Set([...allCategories, newCategoryTrimmed])];
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

  const overallPageLoading = loading || loadingFinancialSummary || loadingLimits || loadingGoals || loadingCurrentMonthIncome || loadingCurrentMonthExpenses;

  if (overallPageLoading && !localStorage.getItem('authToken') && !error) {
    return <div className={styles.dashboardPageContent}><p className={styles.loadingMessage}>Checking authentication...</p></div>;
  }
  if (overallPageLoading && !error) {
    return <div className={styles.dashboardPageContent}><p className={styles.loadingMessage}>Loading dashboard data...</p></div>;
  }
  if (error && !localStorage.getItem('authToken')) {
    return (
      <div className={styles.dashboardPageContent}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <div className={styles.pageErrorBanner}>
          Please <Link to="/login">log in</Link> to view your dashboard.
          {error && (error.includes("Auth token") || error.includes("Authentication token") || error.includes("Profile:")) && <><br /><small>Details: {error.split('\n').map((e, i) => <span key={i}>{e}<br /></span>)}</small></>}
        </div>
      </div>
    );
  }
  const isDataEmpty = transactions.length === 0 && limits.length === 0 && recentGoals.length === 0 && currentMonthIncomeTransactions.length === 0 && currentMonthExpenseTransactions.length === 0 && monthlySavingsData.length === 0;
  if (error && isDataEmpty) {
    return (
      <div className={styles.dashboardPageContent}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <div className={styles.pageErrorBanner}>
          Failed to load essential dashboard components. Please try refreshing.
          <br />
          <small>Details: {error.split('\n').map((e, i) => <span key={i}>{e.replace(/(Dashboard: |Profile: |Limits: |Summary\/Savings: |Goals: |Auth: |Submit: |MonthIncome: |MonthExpense: )/g, '')}<br /></span>)}</small>
        </div>
      </div>
    );
  }

  const showRecentTransactionsList = transactions.length > 0;
  const showFinancialOverviewPieChart = hasChartData;
  const showSpendingLimits = limits.length > 0;
  const showActiveGoals = recentGoals.length > 0;
  const showMonthlySavingsLineChart = savingsChartData.length > 0;
  const showRecentIncomeList = recentIncomeForDisplay.length > 0;
  const showIncomeBreakdownPieChart = incomeByCategoryPieData.length > 0;
  const showRecentExpensesList = recentExpensesForDisplay.length > 0;
  const showExpenseBreakdownBarChart = expenseByCategoryBarData.length > 0;

  return (
    <div className={styles.dashboardPageContent}>
      <h1 className={styles.pageTitle}>Welcome back, {username}!</h1>

      {error && !isDataEmpty && (
        <div className={`${styles.pageErrorBanner} ${styles.nonCriticalError}`}>
          Some data might be unavailable: {error.split('\n').map((e, i) => <span key={i}>{e.replace(/(Dashboard: |Profile: |Limits: |Summary\/Savings: |Goals: |Submit: |Auth: |Delete: |MonthIncome: |MonthExpense: )/g, '')}<br /></span>)}
        </div>
      )}

      <section className={styles.summarySection}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}><img src="https://cdn-icons-png.flaticon.com/128/869/869067.png" alt="" className={styles.summaryIcon} />Current Month Balance</div>
          <div className={styles.summaryValue}>{formatCurrency(currentMonthBalanceForDisplay)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}><img src="https://cdn-icons-png.flaticon.com/128/10365/10365322.png" alt="" className={`${styles.summaryIcon} ${styles.incomeIconColor}`} />Current Month Income</div>
          <div className={`${styles.summaryValue} ${styles.income}`}>{formatCurrency(totalIncome)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}><img src="https://cdn-icons-png.flaticon.com/128/8733/8733406.png" alt="" className={`${styles.summaryIcon} ${styles.expenseIconColor}`} />Current Month Expense</div>
          <div className={`${styles.summaryValue} ${styles.expense}`}>{formatCurrency(totalExpense)}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryTitle}><FaPiggyBank className={`${styles.summaryIcon} ${styles.savingsIconColor || ''}`} />Total Cumulative Savings</div>
          <div className={`${styles.summaryValue} ${currentCumulativeSavings >= 0 ? styles.income : styles.expense}`}>
            {loadingFinancialSummary ? "Loading..." : formatCurrency(currentCumulativeSavings)}
          </div>
        </div>
      </section>

      <div className={styles.scrollToFormContainer}>
        <button type="button" className={styles.scrollToFormTrigger} onClick={handleScrollToAddTransaction}>
          Go to Add Transaction Form
        </button>
      </div>

      {(showRecentTransactionsList || showFinancialOverviewPieChart) && (
        <div className={styles.dashboardRow} style={ !(showRecentTransactionsList && showFinancialOverviewPieChart) ? { gridTemplateColumns: '1fr' } : {} }>
          {showRecentTransactionsList && (
            <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Recent Transactions (This Month)</h2>
                <Link to="/transactions" className={styles.seeAllButton}>See All</Link>
              </div>
              {(loading && transactions.length === 0 && !error) ? <div className={styles.placeholderContent}>Loading transactions...</div> :
                transactions.length > 0 ? (
                  <div className={styles.transactionList}>
                    {transactions.slice(0, 5).map((tx) => (
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
                ) : (<div className={styles.placeholderContent}>No transactions recorded this month yet. <span onClick={handleScrollToAddTransaction} style={{color: 'var(--primary-accent-light)', cursor:'pointer', textDecoration:'underline'}}>Add one!</span></div>)}
            </section>
          )}
          {showFinancialOverviewPieChart && (
            <section className={`${styles.sectionBox} ${styles.chartSection}`}>
              <h2 style={{marginBottom:'30px'}} className={styles.sectionTitle}>Current Month Financial Overview</h2>
              <div className={styles.chartContainer} style={{ height: '300px' }}>
                {(loading && !hasChartData && !error) ? <div className={styles.placeholderContent}>Loading chart data...</div> :
                  hasChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={filteredPieData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                          {filteredPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={colorMapping[entry.name] || '#8884d8'} />))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (<div className={styles.placeholderContent}>No income or expense data to display overview for the current month.</div>)}
              </div>
            </section>
          )}
        </div>
      )}

      <div className={styles.dashboardRow} style={ !showSpendingLimits ? { gridTemplateColumns: '1fr' } : {} }>
        <section ref={addTransactionSectionRef} className={`${styles.sectionBox} ${styles.addTransactionSection}`}>
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
                    <Picker onEmojiClick={(emojiData) => { setSelectedEmoji(emojiData.emoji); setShowEmojiPicker(false); }} theme="auto" pickerStyle={{ width: '100%' }} />
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
              <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} required className={styles.formInput} disabled={isSubmitting} min={dateInputProps.min} max={dateInputProps.max} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="amount">Amount:</label>
              <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={isSubmitting} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="description">Description:</label>
              <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Coffee, Salary" required className={styles.formInput} disabled={isSubmitting} autoComplete="off" />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="category">Category:</label>
              <input type="text" id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Food, Bills, Paycheck" required className={styles.formInput} disabled={isSubmitting} list="category-suggestions" />
              <datalist id="category-suggestions">
                {allCategories.map((cat, index) => (<option key={index} value={cat} />))}
              </datalist>
              {categoryLimitWarning && type === 'expense' && (<div className={styles.categoryWarningMessage}>{categoryLimitWarning}</div>)}
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
                <select id="dayOfWeek" value={selectedDayOfWeek} onChange={(e) => setSelectedDayOfWeek(e.target.value)} required={frequency === 'weekly'} className={styles.formInput} disabled={isSubmitting}>
                  <option value="">Select Day</option>
                  <option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option>
                  <option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </form>
        </section>

        {showSpendingLimits && (
          <section className={`${styles.sectionBox} ${styles.limitsSection}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Spending Limits</h2>
              <Link to="/limits" className={`${styles.seeAllButton} ${styles.limitsSeeAll}`}>Manage Limits</Link>
            </div>
            {loadingLimits && limits.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading limits...</div>)
              : limits.length > 0 ? (
                <div className={styles.limitList}>
                  {limits.slice(0, 4).map((limit) => {
                    const { amount: limitAmount, currentSpending: spentAmount, remainingAmount } = limit;
                    const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : (spentAmount > 0 ? 101 : 0);
                    const isOverspent = limit.exceeded || (limitAmount > 0 && spentAmount > limitAmount);
                    const progressPercentage = limitAmount > 0 ? Math.min(percentage, 100) : (spentAmount > 0 ? 100 : 0);
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
                          <div className={styles.progressBar} style={{ width: `${progressPercentage}%`, backgroundColor: isOverspent ? '#EF4444' : (percentage >= 90 ? '#F59E0B' : '#4299e1') }} title={`${percentage.toFixed(1)}% Used`}></div>
                        </div>
                        {isOverspent && (<div className={styles.limitExceededMessageSmall}>Limit Exceeded!</div>)}
                        {(remainingAmount === 0 && limitAmount > 0 && !isOverspent) && (<div className={styles.limitExceededMessageSmall} style={{ color: '#D97706' }}>Limit Reached!</div>)}
                      </div>
                    );
                  })}
                </div>
              ) : (<div className={styles.placeholderContent}>No spending limits set. <Link style={{textDecoration:'underline', color:'var(--primary-accent-light)'}} to="/limits">Set one now!</Link></div>)}
          </section>
        )}
      </div>

      {(showActiveGoals || showMonthlySavingsLineChart) && (
        <div className={styles.dashboardRow} style={ !(showActiveGoals && showMonthlySavingsLineChart) ? { gridTemplateColumns: '1fr' } : {} }>
          {showActiveGoals && (
            <section className={`${styles.sectionBox} ${styles.goalsSection}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}><FaBullseye style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }} />Active Goals</h2>
                <Link to="/goals" className={styles.seeAllButton}>Manage Goals</Link>
              </div>
              {loadingGoals && recentGoals.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading goals...</div>)
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
                          <div className={styles.progressBarSmall} style={{ width: `${goal.progress ? Math.min(goal.progress, 100) : 0}%` }} title={`${goal.progress ? goal.progress.toFixed(1) : '0.0'}% Complete`}></div>
                        </div>
                        <div className={styles.goalDeadlineDashboard}>Due: {formatDate(goal.targetDate, { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                      </div>
                    ))}
                  </div>
                ) : (<div className={styles.placeholderContent}>No active goals found. <Link style={{textDecoration:'underline', color:'var(--primary-accent-light)'}} to="/goals">Set a new goal!</Link></div>)}
            </section>
          )}
          {showMonthlySavingsLineChart && (
            <section className={`${styles.sectionBox} ${styles.savingsChartSection}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Monthly Savings Trend</h2>
                <Link to="/savings" className={styles.seeAllButton}>Full Report</Link>
              </div>
              <div className={styles.chartContainer} style={{ height: '250px' }}>
                {loadingFinancialSummary && savingsChartData.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading savings trend...</div>)
                  : savingsChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={savingsChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="name" stroke="#666" fontSize="10px" />
                        <YAxis stroke="#666" tickFormatter={(value) => formatCurrency(value).replace('$', '')} fontSize="10px" width={70} />
                        <RechartsTooltip formatter={(value, name) => [formatCurrency(value), name]} contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '5px' }} />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="Savings" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (<div className={styles.placeholderContent}>No savings data to display trend. <span onClick={handleScrollToAddTransaction} style={{color: 'var(--primary-accent-light)', cursor:'pointer', textDecoration:'underline'}}>Add transactions.</span></div>)}
              </div>
            </section>
          )}
        </div>
      )}

      {(showRecentIncomeList || showIncomeBreakdownPieChart) && (
        <div className={styles.dashboardRow} style={ !(showRecentIncomeList && showIncomeBreakdownPieChart) ? { gridTemplateColumns: '1fr' } : {} }>
          {showRecentIncomeList && (
            <section className={`${styles.sectionBox} ${styles.recentIncomeSection}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Recent Income (This Month)</h2>
                <Link to="/income" className={styles.seeAllButton}>See All Income</Link>
              </div>
              {loadingCurrentMonthIncome && recentIncomeForDisplay.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading recent income...</div>)
                : recentIncomeForDisplay.length > 0 ? (
                  <div className={styles.transactionList}>
                    {recentIncomeForDisplay.map((tx) => (
                      <div key={tx._id} className={`${styles.transactionItem} ${styles.incomeBorder}`}>
                        <span className={styles.transactionDate}>{formatDate(tx.date, { month: 'short', day: 'numeric' })}</span>
                        <span className={styles.transactionDesc}>{tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}{tx.description} ({tx.category})</span>
                        <span className={`${styles.transactionAmount} ${styles.income}`}>+ {formatCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (<div className={styles.placeholderContent}>No income transactions recorded this month.</div>)}
            </section>
          )}
          {showIncomeBreakdownPieChart && (
            <section className={`${styles.sectionBox} ${styles.incomeCategoryChartSection}`}>
              <h2 className={styles.sectionTitle}>Monthly Income Breakdown</h2>
              <div className={styles.chartContainer} style={{ height: '300px' }}>
                {loadingCurrentMonthIncome && incomeByCategoryPieData.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading income breakdown...</div>)
                  : incomeByCategoryPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={incomeByCategoryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {incomeByCategoryPieData.map((entry, index) => (<Cell key={`cell-income-cat-${index}`} fill={INCOME_CATEGORY_COLORS[index % INCOME_CATEGORY_COLORS.length]} />))}
                        </Pie>
                        <RechartsTooltip formatter={(value, name) => [formatCurrency(value), name]} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (<div className={styles.placeholderContent}>No income data this month to display breakdown.</div>)}
              </div>
            </section>
          )}
        </div>
      )}

      {(showRecentExpensesList || showExpenseBreakdownBarChart) && (
        <div className={styles.dashboardRow} style={ !(showRecentExpensesList && showExpenseBreakdownBarChart) ? { gridTemplateColumns: '1fr' } : {} }>
          {showRecentExpensesList && (
            <section className={`${styles.sectionBox} ${styles.recentExpenseSection}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Recent Expenses (This Month)</h2>
                <Link to="/expense" className={styles.seeAllButton}>See All Expenses</Link>
              </div>
              {loadingCurrentMonthExpenses && recentExpensesForDisplay.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading recent expenses...</div>)
                : recentExpensesForDisplay.length > 0 ? (
                  <div className={styles.transactionList}>
                    {recentExpensesForDisplay.map((tx) => (
                      <div key={tx._id} className={`${styles.transactionItem} ${styles.expenseBorder}`}>
                        <span className={styles.transactionDate}>{formatDate(tx.date, { month: 'short', day: 'numeric' })}</span>
                        <span className={styles.transactionDesc}>{tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}{tx.description} ({tx.category})</span>
                        <span className={`${styles.transactionAmount} ${styles.expense}`}>- {formatCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (<div className={styles.placeholderContent}>No expense transactions recorded this month.</div>)}
            </section>
          )}
          {showExpenseBreakdownBarChart && (
            <section className={`${styles.sectionBox} ${styles.expenseCategoryChartSection}`}>
              <h2 className={styles.sectionTitle} style={{marginBottom:'70px'}}>Monthly Expense Breakdown</h2>
              <div className={styles.chartContainer} style={{ height: '300px' }}>
                {loadingCurrentMonthExpenses && expenseByCategoryBarData.length === 0 && !error ? (<div className={styles.placeholderContent}>Loading expense breakdown...</div>)
                  : expenseByCategoryBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expenseByCategoryBarData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#666' }} label={{ value: 'Amount', position: 'insideBottom', offset: -15, style: { fill: '#666', fontSize: '14px' } }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#666' }} interval={0} label={{ value: 'Categories', angle: -90, position: 'insideLeft', offset: -25, style: { textAnchor: 'middle', fill: '#666', fontSize: '14px' } }} />
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="amount" barSize={20} radius={[0, 4, 4, 0]}>
                          {expenseByCategoryBarData.map((entry, index) => (<Cell key={`cell-expense-cat-${index}`} fill={EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (<div className={styles.placeholderContent}>No expense data this month to display breakdown.</div>)}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}

export default Dashboard;