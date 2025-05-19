import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { Link } from 'react-router-dom'; // No longer used in this snippet
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEdit, FaTrash, FaSave, FaTimes, FaCalculator } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './OldTransactionsPage.module.css';

// Reusable formatCurrency function
const formatCurrency = (value, type = null) => {
    const numValue = parseFloat(value);
    let prefix = '';
    if (type === 'income' || (type === 'monthly_savings' && numValue > 0)) prefix = '+ ';
    else if (type === 'expense' || (type === 'monthly_savings' && numValue < 0)) prefix = '- ';

    if (isNaN(numValue)) {
        return (prefix) + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return (prefix) + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(numValue));
};

// Reusable formatDate function for display (MM/DD/YYYY)
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Invalid Date';
    const dateParts = dateString.split('T')[0].split('-');
    const date = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
    if (isNaN(date.getTime())) { return 'Invalid Date'; }
    return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

// Helper to get YYYY-MM key for monthlyFinancialData and form inputs
const formatMonthYearKey = (dateStringOrDate) => {
    if (!dateStringOrDate) return 'unknown-month';
    const date = (typeof dateStringOrDate === 'string' && dateStringOrDate.includes('T')) 
                 ? new Date(dateStringOrDate) 
                 : (typeof dateStringOrDate === 'string' ? new Date(dateStringOrDate + "T00:00:00Z") : dateStringOrDate);

    if (isNaN(date.getTime())) return 'unknown-month-invalid';
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return `${year}-${month < 10 ? '0' + month : month}`;
};

// Helper function to format month and year for display (e.g., "January 2023")
const formatMonthYearDisplay = (dateString) => {
    if (!dateString) return "Invalid Date";
    const dateParts = dateString.split('T')[0].split('-'); // Handles full ISO strings
    const date = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// Helper function to get the last day of the previous month in YYYY-MM-DD format
const getLastDayOfPreviousMonth = () => {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayPreviousMonth = new Date(firstDayCurrentMonth);
    lastDayPreviousMonth.setDate(0); // Sets to the last day of the previous month
    return lastDayPreviousMonth.toISOString().split('T')[0];
};


function OldTransactionsPage() {
    const [oldTransactions, setOldTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

    // State for "Add Past Transaction" (Individual Income/Expense)
    const [formType, setFormType] = useState('expense');
    const [formAmount, setFormAmount] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formSelectedEmoji, setFormSelectedEmoji] = useState('');
    const [formShowEmojiPicker, setFormShowEmojiPicker] = useState(false);
    const [formDate, setFormDate] = useState(getLastDayOfPreviousMonth());
    const [formFrequency, setFormFrequency] = useState('once'); // Should be 'once' for old tx
    const [formIsSubmitting, setFormIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // State for "Add Monthly Total Savings"
    const [monthlySavingsFormMonth, setMonthlySavingsFormMonth] = useState(formatMonthYearKey(getLastDayOfPreviousMonth()));
    const [monthlySavingsFormAmount, setMonthlySavingsFormAmount] = useState('');
    const [monthlySavingsFormError, setMonthlySavingsFormError] = useState('');
    const [monthlySavingsFormIsSubmitting, setMonthlySavingsFormIsSubmitting] = useState(false);

    const [monthlyFinancialData, setMonthlyFinancialData] = useState({});
    const [loadingSavings, setLoadingSavings] = useState(true);

    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '', type: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    const maxDateForForm = useMemo(() => getLastDayOfPreviousMonth(), []); // YYYY-MM-DD
    const maxMonthForMonthlySavingsForm = useMemo(() => maxDateForForm.substring(0, 7), [maxDateForForm]); // YYYY-MM

    const fetchOldTransactions = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { setError('Please log in to view transactions.'); setLoading(false); return; }
            const response = await axios.get('/api/transactions/old', { headers: { Authorization: `Bearer ${token}` } });
            const sortedData = (response.data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setOldTransactions(sortedData);
        } catch (err) {
            console.error("Error fetching old transactions:", err);
            const errorMessage = err.response?.data?.message || 'Failed to load old transactions.';
            setError(errorMessage);
        } finally { setLoading(false); }
    }, []);

    const fetchMonthlyFinancialData = useCallback(async () => {
        setLoadingSavings(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { setLoadingSavings(false); return; }
            const response = await axios.get('/api/transactions/savings/monthly', { headers: { Authorization: `Bearer ${token}` } });

            let runningCumulative = 0;
            const processedData = (response.data || []).reduce((acc, item) => {
                const netSavingsForMonth = item.savings || 0; // 'savings' is now directly from backend
                runningCumulative += netSavingsForMonth;
                acc[item.month] = {
                    netSavings: netSavingsForMonth,
                    cumulativeSavingsUpToMonth: runningCumulative
                };
                return acc;
            }, {});
            setMonthlyFinancialData(processedData);
        } catch (err) {
            console.error("Error fetching monthly financial data:", err);
            toast.warn("Could not load monthly financial data. Validations may be affected.");
            setMonthlyFinancialData({});
        } finally { setLoadingSavings(false); }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            fetchOldTransactions();
            fetchMonthlyFinancialData();
        } else {
            setError("Please log in to view and manage transactions.");
            setLoading(false); setLoadingSavings(false);
        }
    }, [fetchOldTransactions, fetchMonthlyFinancialData]);

    useEffect(() => {
        const handleDataUpdate = () => {
            fetchOldTransactions();
            fetchMonthlyFinancialData();
        };
        window.addEventListener('transactions-updated', handleDataUpdate);
        return () => window.removeEventListener('transactions-updated', handleDataUpdate);
    }, [fetchOldTransactions, fetchMonthlyFinancialData]);

    const groupedTransactions = useMemo(() => {
        return oldTransactions.reduce((acc, transaction) => {
            const monthYearDisplayKey = formatMonthYearDisplay(transaction.date);
            if (!acc[monthYearDisplayKey]) { acc[monthYearDisplayKey] = []; }
            acc[monthYearDisplayKey].push(transaction);
            return acc;
        }, {});
    }, [oldTransactions]);

    const sortedMonthKeys = useMemo(() => {
        return Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));
    }, [groupedTransactions]);

    const handleAddOldTransaction = async (event) => {
        event.preventDefault();
        setFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in to add transactions."); return; }
        if (formIsSubmitting || loadingSavings) { if (loadingSavings) toast.info("Financial data is loading, please wait..."); return; }

        if (!formDate) { toast.error("Please select a date."); setFormError("Date is required."); return; }
        if (formDate > maxDateForForm) {
            toast.error(`Date must be in a past month. Max allowed date is ${formatDateDisplay(maxDateForForm)}.`);
            setFormError(`Date must be in a past month. Max allowed date is ${formatDateDisplay(maxDateForForm)}.`);
            return;
        }
        if (!formAmount || parseFloat(formAmount) <= 0) { toast.error("Please enter a valid positive amount."); setFormError("Valid positive amount is required."); return; }
        const transactionAmountNum = parseFloat(formAmount);
        if (!formDescription.trim()) { toast.error("Please enter a description."); setFormError("Description is required."); return; }
        if (!formCategory.trim()) { toast.error("Please enter a category."); setFormError("Category is required."); return; }

        // Check if a monthly total savings entry exists for this month
        const transactionMonthKey = formDate.substring(0, 7); // YYYY-MM
        const hasMonthlyTotalForThisMonth = oldTransactions.some(
            tx => tx.type === 'monthly_savings' && formatMonthYearKey(tx.date) === transactionMonthKey
        );
        if (hasMonthlyTotalForThisMonth) {
            const monthName = new Date(formDate + "T12:00:00Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            toast.error(`Cannot add individual transaction. A monthly total savings entry already exists for ${monthName}.`);
            setFormError(`A monthly total already exists for ${monthName}. Delete it to add individual transactions.`);
            return;
        }
        
        // Cumulative savings validation (for expense only)
        if (formType === 'expense') {
            const financialDataForMonth = monthlyFinancialData[transactionMonthKey];
            const netSavingsForMonth = financialDataForMonth ? financialDataForMonth.netSavings : 0; // This should be from income-expense as no monthly_total exists

            // This validation needs to consider cumulative savings.
            // If adding this expense makes CUMULATIVE savings for THIS month negative, block.
            const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
            const currentMonthIndex = sortedMonthKeysFromData.indexOf(transactionMonthKey);
            const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0 
                ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
                : 0;
            
            const projectedNetForThisMonth = netSavingsForMonth - transactionAmountNum;
            const projectedCumulativeForThisMonth = cumulativeSavingsUpToPreviousMonth + projectedNetForThisMonth;

            if (projectedCumulativeForThisMonth < 0) {
                 const monthName = new Date(formDate + "T12:00:00Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                 toast.error(`Adding this expense of ${formatCurrency(transactionAmountNum)} would make cumulative savings for ${monthName} negative (${formatCurrency(projectedCumulativeForThisMonth)}). Current net for month: ${formatCurrency(netSavingsForMonth)}`);
                 setFormError(`Expense (${formatCurrency(transactionAmountNum)}) would make cumulative savings for ${monthName} negative.`);
                 return;
            }
        }

        setFormIsSubmitting(true);
        const newTransactionData = { type: formType, amount: transactionAmountNum, description: formDescription.trim(), category: formCategory.trim(), emoji: formSelectedEmoji, date: formDate, recurrence: 'once' }; // recurrence is 'once'
        try {
            await axios.post('/api/transactions', newTransactionData, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Past transaction added successfully!");
            setFormType('expense'); setFormAmount(''); setFormDescription(''); setFormCategory(''); setFormSelectedEmoji(''); setFormDate(getLastDayOfPreviousMonth()); setFormFrequency('once'); setFormShowEmojiPicker(false);
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to add transaction.";
            toast.error(message); setFormError(message);
        } finally { setFormIsSubmitting(false); }
    };

    const handleAddMonthlySavings = async (event) => {
        event.preventDefault();
        setMonthlySavingsFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in."); return; }
        if (monthlySavingsFormIsSubmitting || loadingSavings) { if (loadingSavings) toast.info("Financial data is loading, please wait..."); return; }

        if (!monthlySavingsFormMonth) { toast.error("Please select a month."); setMonthlySavingsFormError("Month is required."); return; }
        if (monthlySavingsFormAmount.trim() === '' || isNaN(parseFloat(monthlySavingsFormAmount))) {
            toast.error("Please enter a valid amount.");
            setMonthlySavingsFormError("Valid amount is required.");
            return;
        }
        const savingsAmountNum = parseFloat(monthlySavingsFormAmount);

        // Check 1: Are there any individual transactions for this month?
        const hasIndividualTransactions = oldTransactions.some(
            tx => (tx.type === 'income' || tx.type === 'expense') && formatMonthYearKey(tx.date) === monthlySavingsFormMonth
        );
        if (hasIndividualTransactions) {
            const monthName = formatMonthYearDisplay(monthlySavingsFormMonth + "-01T00:00:00Z");
            toast.error(`Cannot add monthly total. Individual transactions exist for ${monthName}.`);
            setMonthlySavingsFormError(`Individual transactions exist for ${monthName}. Delete them first.`);
            return;
        }

        // Check 2: Does a monthly total already exist? (Should be caught by backend too)
        const hasExistingMonthlyTotal = oldTransactions.some(
            tx => tx.type === 'monthly_savings' && formatMonthYearKey(tx.date) === monthlySavingsFormMonth
        );
        if (hasExistingMonthlyTotal) {
            const monthName = formatMonthYearDisplay(monthlySavingsFormMonth + "-01T00:00:00Z");
            toast.error(`A monthly total already exists for ${monthName}.`);
            setMonthlySavingsFormError(`A monthly total already exists for ${monthName}.`);
            return;
        }

        // Check 3: Cumulative savings validation (especially for negative monthly savings)
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        // Find key for month *before* monthlySavingsFormMonth
        let cumulativeSavingsUpToPreviousMonth = 0;
        let previousMonthKeyFound = null;
        for (let i = sortedMonthKeysFromData.length - 1; i >= 0; i--) {
            if (sortedMonthKeysFromData[i] < monthlySavingsFormMonth) {
                previousMonthKeyFound = sortedMonthKeysFromData[i];
                break;
            }
        }
        if (previousMonthKeyFound) {
            cumulativeSavingsUpToPreviousMonth = monthlyFinancialData[previousMonthKeyFound]?.cumulativeSavingsUpToMonth || 0;
        }
        
        const projectedCumulativeForThisMonth = cumulativeSavingsUpToPreviousMonth + savingsAmountNum;

        if (projectedCumulativeForThisMonth < 0) {
            const monthName = formatMonthYearDisplay(monthlySavingsFormMonth + "-01T00:00:00Z");
            toast.error(`This total saving would make cumulative savings for ${monthName} negative (${formatCurrency(projectedCumulativeForThisMonth)}).`);
            setMonthlySavingsFormError(`Cumulative savings would become ${formatCurrency(projectedCumulativeForThisMonth)}.`);
            return;
        }

        setMonthlySavingsFormIsSubmitting(true);
        const payload = { monthYear: monthlySavingsFormMonth, amount: savingsAmountNum };
        try {
            await axios.post('/api/transactions/monthly-savings', payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Monthly total savings added successfully!");
            setMonthlySavingsFormMonth(formatMonthYearKey(getLastDayOfPreviousMonth()));
            setMonthlySavingsFormAmount('');
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to add monthly savings.";
            toast.error(message); setMonthlySavingsFormError(message);
        } finally { setMonthlySavingsFormIsSubmitting(false); }
    };


    const handleEditClick = (transaction) => {
        setEditingTransactionId(transaction._id);
        setEditFormData({
            description: transaction.description,
            category: transaction.category,
            emoji: transaction.emoji || '',
            amount: transaction.amount.toString(),
            type: transaction.type // Store original type
        });
        setShowEditEmojiPicker(null);
    };

    const handleCancelEdit = () => { setEditingTransactionId(null); setShowEditEmojiPicker(null); };
    const handleEditFormChange = (e) => { const { name, value } = e.target; setEditFormData(prev => ({ ...prev, [name]: value })); };

    const projections = useMemo(() => {
        if (!editingTransactionId || loadingSavings || Object.keys(monthlyFinancialData).length === 0) {
            return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
        }
        const originalTx = oldTransactions.find(tx => tx._id === editingTransactionId);
        if (!originalTx) return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const txType = originalTx.type; // Use originalTx.type which is set on edit click
        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        let newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount) || ( (txType === 'income' || txType === 'expense') && newAmount < 0 ) ){ // Income/Expense can't be negative, monthly_savings can.
             return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
        }
        if (txType === 'income' || txType === 'expense') { // Enforce positive for these types
            if (newAmount <= 0 && newAmountInput.trim() !== '') { // Allow typing '0' but mark invalid if not empty
                 return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
            }
        }


        const txMonthKey = formatMonthYearKey(originalTx.date);
        const monthDataForTx = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        let currentNetSavingsForTxMonth = monthDataForTx.netSavings;

        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;

        let projectedNetSavingsForTxMonth;

        if (txType === 'monthly_savings') {
            projectedNetSavingsForTxMonth = newAmount; // The new amount IS the net savings
        } else { // income or expense
            // If we are editing an income/expense, and a monthly_savings exists for this month,
            // this scenario should ideally not happen or be blocked.
            // For calculation: change from original amount reflects on current net savings
            const amountDifference = newAmount - originalAmount;
            if (txType === 'income') {
                projectedNetSavingsForTxMonth = currentNetSavingsForTxMonth + amountDifference;
            } else { // expense
                projectedNetSavingsForTxMonth = currentNetSavingsForTxMonth - amountDifference;
            }
        }
        
        const projectedCumulativeAfterMonth = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonth;

        const isValidForProjection = (txType === 'monthly_savings' && !isNaN(newAmount)) || 
                                     ((txType === 'income' || txType === 'expense') && newAmount > 0 && !isNaN(newAmount));

        return {
            projectedMonthNetSavings: projectedNetSavingsForTxMonth,
            projectedCumulativeAfterMonth: projectedCumulativeAfterMonth,
            isValidAmount: isValidForProjection,
        };
    }, [editingTransactionId, editFormData.amount, oldTransactions, monthlyFinancialData, loadingSavings]);


    const handleSaveEdit = async (transactionId) => {
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in to edit transactions."); return; }

        const originalTransaction = oldTransactions.find(tx => tx._id === transactionId);
        if (!originalTransaction) { toast.error("Original transaction not found for edit."); return; }

        const txType = originalTransaction.type;

        if (txType === 'income' || txType === 'expense') {
            if (!editFormData.description.trim() || !editFormData.category.trim()) {
                toast.error("Description and Category cannot be empty."); return;
            }
            if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) {
                toast.error("Please enter a valid positive amount for income/expense."); return;
            }
        } else if (txType === 'monthly_savings') {
            if (editFormData.amount.trim() === '' || isNaN(parseFloat(editFormData.amount))) {
                toast.error("Please enter a valid amount for monthly savings."); return;
            }
        }
        const newAmount = parseFloat(editFormData.amount);

        if (loadingSavings) { toast.info("Financial data is loading, please wait to save."); return; }

        // Use projections for validation, which should now be accurate due to backend changes
        if (projections.projectedCumulativeAfterMonth < 0 && projections.isValidAmount) {
            const txMonthForDisplay = formatMonthYearDisplay(originalTransaction.date);
            toast.error(
                `Cannot save. This change would make cumulative savings up to ${txMonthForDisplay} negative (${formatCurrency(projections.projectedCumulativeAfterMonth)}).`
            );
            return;
        }

        let updatePayload = { amount: newAmount };
        if (txType === 'income' || txType === 'expense') {
            updatePayload.description = editFormData.description.trim();
            updatePayload.category = editFormData.category.trim();
            updatePayload.emoji = editFormData.emoji;
        }
        // For monthly_savings, backend will set desc/cat/emoji

        try {
            await axios.put(`/api/transactions/${transactionId}`, updatePayload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Transaction updated successfully!");
            handleCancelEdit();
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            console.error("Error updating transaction:", err);
            toast.error(err.response?.data?.message || "Failed to update transaction.");
        }
    };

    const handleDeleteTransaction = async (transactionId) => {
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in to delete transactions."); return; }

        const txToDelete = oldTransactions.find(tx => tx._id === transactionId);
        if (!txToDelete) { toast.error("Transaction not found for deletion."); return; }
        if (loadingSavings) { toast.info("Financial data is loading, please wait to delete."); return; }

        // Calculate projected cumulative after deletion
        const txMonthKey = formatMonthYearKey(txToDelete.date);
        const monthData = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;

        let projectedNetSavingsForTxMonthAfterDelete;
        if (txToDelete.type === 'monthly_savings') {
            projectedNetSavingsForTxMonthAfterDelete = 0; // Deleting summary means net savings for month is 0 (as no other txns should exist)
        } else if (txToDelete.type === 'income') {
            projectedNetSavingsForTxMonthAfterDelete = monthData.netSavings - txToDelete.amount;
        } else { // expense
            projectedNetSavingsForTxMonthAfterDelete = monthData.netSavings + txToDelete.amount;
        }
        const projectedCumulativeAfterMonthAfterDelete = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonthAfterDelete;

        // Check subsequent months as well due to ripple effect (Backend handles the definitive check)
        // For client-side, this is a good first-pass check.
        if (projectedCumulativeAfterMonthAfterDelete < 0) {
             // Check if any *subsequent* month's cumulative also goes negative if this one doesn't
            let tempCumulative = projectedCumulativeAfterMonthAfterDelete;
            let subsequentNegative = false;
            const txMonthDate = new Date(txToDelete.date);
            
            for (let i = currentMonthIndex + 1; i < sortedMonthKeysFromData.length; i++) {
                const nextMonthKey = sortedMonthKeysFromData[i];
                const nextMonthData = monthlyFinancialData[nextMonthKey];
                if (nextMonthData) {
                     // Adjust the net savings of subsequent months based on the change
                    // This is simplified; the backend re-evaluates properly.
                    // This check should mainly focus on the immediate month of deletion.
                    // If deleting makes THIS month's cumulative negative, that's the primary concern.
                }
            }
            // The backend will perform the more rigorous check across all months.
            // This client-side check is a strong indicator.
             const txMonthForDisplay = formatMonthYearDisplay(txToDelete.date);
             toast.error(
                 `Cannot delete. This would make cumulative savings up to ${txMonthForDisplay} negative (${formatCurrency(projectedCumulativeAfterMonthAfterDelete)}).`
             );
             return;
        }


        if (!window.confirm(`Are you sure you want to delete this ${txToDelete.type === 'monthly_savings' ? 'monthly total' : txToDelete.type} of ${formatCurrency(txToDelete.amount, txToDelete.type)}? This action cannot be undone.`)) { return; }

        try {
            await axios.delete(`/api/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Transaction deleted successfully!");
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            console.error("Error deleting transaction:", err);
            toast.error(err.response?.data?.message || "Failed to delete transaction.");
        }
    };


    const handleDownloadPDF = () => {
        if (oldTransactions.length === 0) {
            toast.info("No old transactions to download.");
            return;
        }
        const doc = new jsPDF();
        const tableColumn = ["Date", "Type", "Description", "Category", "Amount"];
        const tableRows = [];
        doc.setFontSize(18);
        doc.text(`Old Transactions (Before Current Month) for ${username}`, 14, 22);
        
        // Create a flat list of transactions, sorted by date for the PDF
        const flatSortedTransactions = [...oldTransactions].sort((a,b) => new Date(a.date) - new Date(b.date));

        flatSortedTransactions.forEach(tx => {
            let displayType = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
            if (tx.type === 'monthly_savings') displayType = 'Monthly Total';

            tableRows.push([
                tx.type === 'monthly_savings' ? formatMonthYearDisplay(tx.date) : formatDateDisplay(tx.date),
                displayType,
                (tx.emoji && tx.type !== 'monthly_savings' ? tx.emoji + " " : "") + tx.description,
                tx.category,
                formatCurrency(tx.amount, tx.type)
            ]);
        });
        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 30, theme: 'grid',
            styles: { fontSize: 10, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 4: { halign: 'right' } },
        });
        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`old-transactions-${username}-${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("PDF of old transactions downloaded!");
    };

    const currentToken = localStorage.getItem('authToken');

    if (!currentToken && error && !loading) { // If not logged in and there's a relevant error (e.g. "please log in")
        return (
            <div className={styles.container}>
                <h2>Old Transactions Management</h2>
                <p className={styles.loginPrompt}>{error}</p>
            </div>
        );
    }
    if (loading || loadingSavings) {
        return <div className={styles.container}><p>Loading data...</p></div>;
    }
    

    return (
        <div className={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Old Transactions Management</h2>
                <div>
                    <button onClick={handleDownloadPDF} className={styles.pdfButtonOld} style={{ marginRight: '10px' }}>
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Section for Adding Monthly Total Savings */}
            <section className={`${styles.sectionBox} ${styles.addMonthlySavingsSection}`}>
                <h3 className={styles.sectionTitle}><FaCalculator style={{ marginRight: '8px' }} /> Add Monthly Total Savings</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to add monthly savings.</p>}
                {currentToken && (
                    <form onSubmit={handleAddMonthlySavings} className={styles.transactionForm}>
                        {monthlySavingsFormError && <p className={`${styles.formErrorBanner}`}>{monthlySavingsFormError}</p>}
                        <div className={styles.formGroup}>
                            <label htmlFor="monthly-savings-month">Month (Past Months Only):</label>
                            <input
                                type="month"
                                id="monthly-savings-month"
                                value={monthlySavingsFormMonth}
                                onChange={(e) => setMonthlySavingsFormMonth(e.target.value)}
                                required
                                className={styles.formInput}
                                max={maxMonthForMonthlySavingsForm}
                                disabled={monthlySavingsFormIsSubmitting || loadingSavings}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="monthly-savings-amount">Total Net Savings for Month:</label>
                            <input
                                type="number"
                                id="monthly-savings-amount"
                                value={monthlySavingsFormAmount}
                                onChange={(e) => setMonthlySavingsFormAmount(e.target.value)}
                                placeholder="e.g., 500.00 or -150.00"
                                required
                                step="0.01"
                                className={styles.formInput}
                                disabled={monthlySavingsFormIsSubmitting || loadingSavings}
                            />
                             <small className={styles.formHelpText}>Enter positive for net income, negative for net expense/loss.</small>
                        </div>
                        <button type="submit" className={styles.submitButtonWide} disabled={monthlySavingsFormIsSubmitting || loadingSavings}>
                            {monthlySavingsFormIsSubmitting ? 'Adding...' : (loadingSavings ? 'Loading Data...' : 'Add Monthly Total')}
                        </button>
                    </form>
                )}
            </section>

            {/* Section for Adding Individual Past Transaction */}
            <section className={`${styles.sectionBox} ${styles.addOldTransactionSection}`}>
                <h3 className={styles.sectionTitle}>Add an Individual Past Transaction</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to add transactions.</p>}
                {currentToken && (
                    <form onSubmit={handleAddOldTransaction} className={styles.transactionForm}>
                        {formError && <p className={`${styles.formErrorBanner}`}>{formError}</p>}
                        <div className={styles.formRow}>
                            <div className={styles.formGroup} style={{ flex: '0 0 70px' }}>
                                <label htmlFor="form-emoji">Icon:</label>
                                <div className={styles.emojiSelectorContainer}>
                                    <button id="form-emoji" type="button" className={styles.emojiButton} style={{ marginBottom: "20px" }} onClick={() => setFormShowEmojiPicker(!formShowEmojiPicker)} disabled={formIsSubmitting || loadingSavings}>
                                        {formSelectedEmoji ? formSelectedEmoji : '➕'}
                                    </button>
                                    {formShowEmojiPicker && (<div className={styles.emojiPickerContainer}><Picker onEmojiClick={(emojiData) => { setFormSelectedEmoji(emojiData.emoji); setFormShowEmojiPicker(false); }} /></div>)}
                                </div>
                            </div>
                            <div className={styles.formGroup} style={{ flex: '1' }}>
                                <label htmlFor="form-type">Type:</label>
                                <select id="form-type" value={formType} onChange={(e) => setFormType(e.target.value)} required className={styles.formInput} disabled={formIsSubmitting || loadingSavings}>
                                    <option value="expense">Expense</option><option value="income">Income</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="form-date">Date (Past Months Only):</label>
                            <input type="date" id="form-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={styles.formInput} max={maxDateForForm} disabled={formIsSubmitting || loadingSavings} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="form-amount">Amount (Positive):</label>
                            <input type="number" id="form-amount" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={formIsSubmitting || loadingSavings} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="form-description">Description:</label>
                            <input type="text" id="form-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g., Old bill" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings} autoComplete="off" />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="form-category">Category:</label>
                            <input type="text" id="form-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g., Utilities" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings} />
                        </div>
                        <input type="hidden" id="form-frequency" value={formFrequency} /> {/* Frequency is always 'once' */}

                        <button type="submit" className={styles.submitButtonWide} disabled={formIsSubmitting || loadingSavings}>
                            {formIsSubmitting ? 'Adding...' : (loadingSavings ? 'Loading Data...' : 'Add Individual Past Transaction')}
                        </button>
                    </form>
                )}
            </section>

            <section className={`${styles.sectionBox} ${styles.displayOldTransactionsSection}`}>
                <h3 className={styles.sectionTitle}>Transaction History (Older than Current Month)</h3>
                {!error && !currentToken && <p className={styles.loginPrompt}>Please log in to view and manage transactions.</p>}
                {error && !loading && <p className={`${styles.pageErrorBanner}`}>{error.split('\n').map((e, i) => <span key={i}>{e.replace(/(Transactions: |Summary: |Auth: )/g, '')}<br /></span>)}</p>}

                {!loading && !error && currentToken && (
                    sortedMonthKeys.length > 0 ? (
                        sortedMonthKeys.map(monthYearDisplayKey => (
                            <div key={monthYearDisplayKey} className={styles.monthGroup}>
                                <h4 className={styles.monthHeading}>{monthYearDisplayKey}</h4>
                                <div className={styles.transactionList}>
                                    {groupedTransactions[monthYearDisplayKey].map(transaction => (
                                        <React.Fragment key={transaction._id}>
                                            <div className={`${styles.transactionItemOldPage} ${styles[transaction.type]} ${transaction.type === 'monthly_savings' ? styles.monthlySavingsItem : ''}`}>
                                                <div className={styles.dateAndEmoji}>
                                                    <span className={styles.transactionDateDisplay}>
                                                        {transaction.type === 'monthly_savings' ? 'Month Total' : formatDateDisplay(transaction.date)}
                                                    </span>
                                                    {editingTransactionId !== transaction._id && transaction.emoji && transaction.type !== 'monthly_savings' &&
                                                        <span className={styles.transactionEmoji}>{transaction.emoji}</span>}
                                                </div>

                                                {editingTransactionId === transaction._id ? (
                                                    <div className={styles.editFormContainerOld}>
                                                        {transaction.type !== 'monthly_savings' && (
                                                            <>
                                                                <input type="text" name="description" value={editFormData.description} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Description" />
                                                                <input type="text" name="category" value={editFormData.category} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Category" />
                                                            </>
                                                        )}
                                                        <input type="number" name="amount" value={editFormData.amount} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Amount" step="0.01" min={transaction.type !== 'monthly_savings' ? "0.01" : undefined} />
                                                        {transaction.type !== 'monthly_savings' && (
                                                            <div className={styles.editEmojiPickerContainerOld}>
                                                                <button type="button" className={styles.emojiButtonSmallOld} onClick={() => setShowEditEmojiPicker(prev => prev === transaction._id ? null : transaction._id)}>
                                                                    {editFormData.emoji || '✏️'}
                                                                </button>
                                                                {showEditEmojiPicker === transaction._id && (
                                                                    <div className={styles.emojiPickerPopoverOld}>
                                                                        <Picker onEmojiClick={(emojiData) => { setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji })); setShowEditEmojiPicker(null); }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={styles.transactionDetailsOld}>
                                                        {transaction.type === 'monthly_savings' 
                                                          ? transaction.description // e.g. "Total Savings for January 2023"
                                                          : `${transaction.description} (${transaction.category})`
                                                        }
                                                    </span>
                                                )}

                                                {editingTransactionId !== transaction._id && (
                                                    <span className={`${styles.transactionAmountOld} ${transaction.type === 'income' ? styles.incomeOld : (transaction.type === 'expense' ? styles.expenseOld : (parseFloat(transaction.amount) >= 0 ? styles.incomeOld : styles.expenseOld)) }`}>
                                                        {formatCurrency(transaction.amount, transaction.type)}
                                                    </span>
                                                )}
                                                {editingTransactionId === transaction._id && (
                                                    <span className={styles.transactionAmountOld} style={{ visibility: 'hidden' }}>{formatCurrency(0)}</span>
                                                )}

                                                <div className={styles.actionButtonsOld}>
                                                    {editingTransactionId === transaction._id ? (
                                                        <>
                                                            <button onClick={() => handleSaveEdit(transaction._id)} className={`${styles.actionButtonOld} ${styles.saveButtonOld}`} title="Save"><FaSave /></button>
                                                            <button onClick={handleCancelEdit} className={`${styles.actionButtonOld} ${styles.cancelButtonOld}`} title="Cancel"><FaTimes /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEditClick(transaction)} className={`${styles.actionButtonOld} ${styles.editButtonOld}`} title="Edit"><FaEdit /></button>
                                                            <button onClick={() => handleDeleteTransaction(transaction._id)} className={`${styles.actionButtonOld} ${styles.deleteButtonOld}`} title="Delete"><FaTrash /></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {editingTransactionId === transaction._id && projections.isValidAmount && (
                                                <div className={`${styles.editProjectionsOld} ${styles.projectionBox}`}>
                                                    <p>Effect on <strong>{formatMonthYearDisplay(transaction.date)}</strong>:</p>
                                                    <p>Net Savings for this month would become: <strong>{formatCurrency(projections.projectedMonthNetSavings, null)}</strong></p>
                                                    <p>Cumulative Savings up to end of this month would become: <strong>{formatCurrency(projections.projectedCumulativeAfterMonth, null)}</strong></p>
                                                    {projections.projectedCumulativeAfterMonth < 0 && (
                                                        <p className={styles.warningText}>This change would make cumulative savings negative by the end of this month!</p>
                                                    )}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (<p>No transactions found for previous months.</p>)
                )}
                {!loading && !error && !currentToken && <p className={styles.loginPrompt}>Log in to manage past financial records.</p>}
            </section>
        </div>
    );
}

export default OldTransactionsPage;