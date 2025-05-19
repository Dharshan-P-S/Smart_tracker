import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEdit, FaTrash, FaSave, FaTimes, FaStickyNote } from 'react-icons/fa'; // Added FaStickyNote for override
import Picker from 'emoji-picker-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './OldTransactionsPage.module.css';

const OVERRIDE_DESCRIPTION = "Monthly Net Savings Override";
const OVERRIDE_CATEGORY = "Adjustment";
const OVERRIDE_EMOJI = "💾";

// Reusable formatCurrency function
const formatCurrency = (value, type = null, isOverride = false) => {
    const numValue = parseFloat(value);
    let prefix = '';
    if (isOverride) { // For overrides, value can be negative directly
        // Prefix determined by value itself, not type
    } else if (type === 'income') {
        prefix = '+ ';
    } else if (type === 'expense') {
        prefix = '- ';
    }

    if (isNaN(numValue)) {
        return (prefix) + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return (prefix) + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Reusable formatDate function for display (MM/DD/YYYY)
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'Invalid Date';
    const dateParts = dateString.split('T')[0].split('-');
    const date = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
    if (isNaN(date.getTime())) { return 'Invalid Date'; }
    return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Helper to get YYYY-MM key
const formatMonthYearKey = (dateString) => {
    if (!dateString) return 'unknown-month';
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return `${year}-${month < 10 ? '0' + month : month}`;
};

// Helper function to format month and year for display (e.g., "January 2023")
const formatMonthYearDisplay = (dateString) => {
    if (!dateString) return "Invalid Date";
    const date = new Date(dateString.includes('T') ? dateString : `${dateString}-01T00:00:00Z`); // Handle YYYY-MM or full ISO
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const getFirstDayOfMonth = (yyyyMmString) => {
    if (!yyyyMmString || yyyyMmString.length !== 7) return getLastDayOfPreviousMonth(); // Fallback
    return `${yyyyMmString}-01`;
}

// Helper function to get the last day of the previous month in YYYY-MM-DD format
const getLastDayOfPreviousMonth = () => {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayPreviousMonth = new Date(firstDayCurrentMonth);
    lastDayPreviousMonth.setDate(0);
    return lastDayPreviousMonth.toISOString().split('T')[0];
};

// Helper to get YYYY-MM for the previous month
const getPreviousMonthYYYYMM = () => {
    const today = new Date();
    today.setDate(0); // Goes to last day of previous month
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return `${year}-${month < 10 ? '0' + month : month}`;
}

function OldTransactionsPage() {
    const [oldTransactions, setOldTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

    // Regular Transaction Form State
    const [formType, setFormType] = useState('expense');
    const [formAmount, setFormAmount] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formSelectedEmoji, setFormSelectedEmoji] = useState('');
    const [formShowEmojiPicker, setFormShowEmojiPicker] = useState(false);
    const [formDate, setFormDate] = useState(getLastDayOfPreviousMonth());
    const [formFrequency, setFormFrequency] = useState('once');
    const [formIsSubmitting, setFormIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Monthly Override Form State
    const [overrideFormMonth, setOverrideFormMonth] = useState(getPreviousMonthYYYYMM());
    const [overrideFormAmount, setOverrideFormAmount] = useState('');
    const [overrideFormError, setOverrideFormError] = useState('');
    const [overrideFormIsSubmitting, setOverrideFormIsSubmitting] = useState(false);

    const [monthlyFinancialData, setMonthlyFinancialData] = useState({});
    const [loadingSavings, setLoadingSavings] = useState(true);

    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '', type: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    const maxDateForForm = useMemo(() => getLastDayOfPreviousMonth(), []);
    const maxMonthForOverride = useMemo(() => getPreviousMonthYYYYMM(), []);

    const fetchOldTransactions = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { setError('Please log in to view transactions.'); setLoading(false); return; }
            const response = await axios.get('/api/transactions/old', { headers: { Authorization: `Bearer ${token}` } });
            const sortedData = (response.data || []).sort((a, b) => {
                if (a.description === OVERRIDE_DESCRIPTION && b.description !== OVERRIDE_DESCRIPTION) return -1; // Override first
                if (a.description !== OVERRIDE_DESCRIPTION && b.description === OVERRIDE_DESCRIPTION) return 1;  // Override first
                return new Date(b.date) - new Date(a.date);
            });
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
                const netSavingsForMonth = item.savings || 0;
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
            setLoading(false);
            setLoadingSavings(false);
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

    const { hasMonthlyOverride, hasRegularTransactions } = useMemo(() => {
        const overrides = {};
        const regulars = {};
        oldTransactions.forEach(tx => {
            const monthKey = formatMonthYearKey(tx.date);
            if (tx.description === OVERRIDE_DESCRIPTION) {
                overrides[monthKey] = true;
            } else {
                regulars[monthKey] = true;
            }
        });
        return {
            hasMonthlyOverride: (monthKey) => !!overrides[monthKey],
            hasRegularTransactions: (monthKey) => !!regulars[monthKey],
        };
    }, [oldTransactions]);

    const groupedTransactions = useMemo(() => {
        return oldTransactions.reduce((acc, transaction) => {
            const monthYearDisplayKey = formatMonthYearDisplay(transaction.date);
            if (!acc[monthYearDisplayKey]) { acc[monthYearDisplayKey] = []; }
            acc[monthYearDisplayKey].push(transaction);
            return acc;
        }, {});
    }, [oldTransactions]);

    const sortedMonthKeys = useMemo(() => {
        return Object.keys(groupedTransactions).sort((a, b) => new Date(b.split(" ")[1], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(b.split(" ")[0]), 1) - new Date(a.split(" ")[1], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(a.split(" ")[0]), 1));
    }, [groupedTransactions]);


    // --- Regular Transaction Logic ---
    const handleAddOldTransaction = async (event) => {
        event.preventDefault();
        setFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in."); return; }
        if (formIsSubmitting || loadingSavings) { if (loadingSavings) toast.info("Financial data loading..."); return; }

        const transactionMonthKey = formatMonthYearKey(formDate);
        if (hasMonthlyOverride(transactionMonthKey)) {
            toast.error(`Cannot add transaction. ${formatMonthYearDisplay(formDate)} has a Net Savings Override. Please remove it first.`);
            setFormError(`Month has an Override. Remove it to add individual transactions.`);
            return;
        }

        if (!formDate) { toast.error("Please select a date."); setFormError("Date is required."); return; }
        if (formDate > maxDateForForm) {
            toast.error(`Date must be in a past month. Max allowed date is ${formatDateDisplay(maxDateForForm)}.`);
            setFormError(`Date must be in a past month. Max allowed: ${formatDateDisplay(maxDateForForm)}.`);
            return;
        }
        if (!formAmount || parseFloat(formAmount) <= 0) { toast.error("Valid positive amount required."); setFormError("Valid positive amount required."); return; }
        const transactionAmountNum = parseFloat(formAmount);
        if (!formDescription.trim()) { toast.error("Description required."); setFormError("Description required."); return; }
        if (!formCategory.trim()) { toast.error("Category required."); setFormError("Category required."); return; }

        if (formType === 'expense') {
            const financialDataForMonth = monthlyFinancialData[transactionMonthKey];
            const netSavingsForMonth = financialDataForMonth ? financialDataForMonth.netSavings : 0;
            if (transactionAmountNum > netSavingsForMonth && netSavingsForMonth >= 0) {
                const monthName = formatMonthYearDisplay(formDate);
                toast.error(`Expense of ${formatCurrency(transactionAmountNum)} exceeds net savings of ${formatCurrency(netSavingsForMonth)} for ${monthName}.`);
                setFormError(`Expense would make ${monthName}'s savings negative.`);
                return;
            }
        }
        setFormIsSubmitting(true);
        const newTransactionData = { type: formType, amount: transactionAmountNum, description: formDescription.trim(), category: formCategory.trim(), emoji: formSelectedEmoji, date: formDate, recurrence: formFrequency };
        try {
            await axios.post('/api/transactions', newTransactionData, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Past transaction added!");
            setFormType('expense'); setFormAmount(''); setFormDescription(''); setFormCategory(''); setFormSelectedEmoji(''); setFormDate(getLastDayOfPreviousMonth()); setFormFrequency('once'); setFormShowEmojiPicker(false);
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to add transaction.";
            toast.error(message); setFormError(message);
        } finally { setFormIsSubmitting(false); }
    };

    // --- Monthly Override Logic ---
    const handleAddOrUpdateMonthlyOverride = async (event) => {
        event.preventDefault();
        setOverrideFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in."); return; }
        if (overrideFormIsSubmitting || loadingSavings) { if (loadingSavings) toast.info("Financial data loading..."); return; }

        if (!overrideFormMonth) { toast.error("Please select a month."); setOverrideFormError("Month is required."); return; }
        if (overrideFormAmount.trim() === '' || isNaN(parseFloat(overrideFormAmount))) {
             toast.error("Please enter a valid amount for savings override (can be 0 or negative).");
             setOverrideFormError("Valid amount required (can be 0 or negative)."); return;
        }
        const overrideAmountNum = parseFloat(overrideFormAmount);

        if (hasRegularTransactions(overrideFormMonth)) {
            toast.error(`Cannot set override for ${formatMonthYearDisplay(overrideFormMonth)}. Regular transactions exist. Delete them first or clear override.`);
            setOverrideFormError(`Regular transactions exist for this month. Clear them to set an override.`);
            return;
        }
        
        // Cumulative Savings Check if overrideAmountNum is negative
        const financialDataForMonth = monthlyFinancialData[overrideFormMonth] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(overrideFormMonth);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;
        
        const projectedCumulativeAfterMonth = cumulativeSavingsUpToPreviousMonth + overrideAmountNum;

        if (projectedCumulativeAfterMonth < 0) {
            toast.error(`This override would make cumulative savings up to ${formatMonthYearDisplay(overrideFormMonth)} negative (${formatCurrency(projectedCumulativeAfterMonth)}).`);
            setOverrideFormError(`Override makes cumulative savings negative.`);
            return;
        }

        setOverrideFormIsSubmitting(true);
        try {
            // Assumed endpoint, backend handles deleting other tx for the month and creating/updating override tx
            await axios.post('/api/transactions/monthly-override',
                { monthYear: overrideFormMonth, amount: overrideAmountNum },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`Monthly Net Savings Override for ${formatMonthYearDisplay(overrideFormMonth)} ${overrideAmountNum === null ? 'cleared' : 'set/updated'}!`);
            setOverrideFormAmount(''); // Clear amount after successful submission
            // setOverrideFormMonth(getPreviousMonthYYYYMM()); // Optionally reset month
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to set/update override.";
            toast.error(message); setOverrideFormError(message);
        } finally { setOverrideFormIsSubmitting(false); }
    };
    
    const handleClearMonthlyOverride = async () => {
        if (!overrideFormMonth) {
            toast.warn("Please select a month to clear its override.");
            return;
        }
        if (!window.confirm(`Are you sure you want to clear the Net Savings Override for ${formatMonthYearDisplay(overrideFormMonth)}? This will delete the override and allow adding individual transactions.`)) {
            return;
        }
        setOverrideFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in."); return; }
        setOverrideFormIsSubmitting(true);
        try {
            // Backend handles deletion of the specific override transaction
            await axios.delete(`/api/transactions/monthly-override/${overrideFormMonth}`, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Monthly Net Savings Override for ${formatMonthYearDisplay(overrideFormMonth)} cleared!`);
            setOverrideFormAmount('');
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to clear override.";
            toast.error(message); setOverrideFormError(message);
        } finally {
            setOverrideFormIsSubmitting(false);
        }
    };


    // --- Edit/Delete Common Logic ---
    const handleEditClick = (transaction) => {
        setEditingTransactionId(transaction._id);
        if (transaction.description === OVERRIDE_DESCRIPTION) {
            setEditFormData({
                description: transaction.description,
                category: transaction.category,
                emoji: transaction.emoji,
                amount: transaction.actualAmount !== undefined ? transaction.actualAmount.toString() : transaction.amount.toString(), // Assuming backend might send actual signed amount
                type: transaction.type
            });
        } else {
            setEditFormData({
                description: transaction.description,
                category: transaction.category,
                emoji: transaction.emoji || '',
                amount: transaction.amount.toString(),
                type: transaction.type
            });
        }
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

        const isOverrideTx = originalTx.description === OVERRIDE_DESCRIPTION;
        const originalAmount = parseFloat(isOverrideTx && originalTx.actualAmount !== undefined ? originalTx.actualAmount : originalTx.amount) || 0;
        const originalTypeEffect = isOverrideTx ? (originalAmount >= 0 ? 1 : -1) : (originalTx.type === 'income' ? 1 : -1);

        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        const newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount) || (newAmount <= 0 && !isOverrideTx)) { // Override can be 0 or negative
            return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
        }

        const txMonthKey = formatMonthYearKey(originalTx.date);
        const monthDataForTx = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;
        
        let projectedNetSavingsForTxMonth;
        if (isOverrideTx) {
            // For override, the newAmount IS the new net savings for the month
            projectedNetSavingsForTxMonth = newAmount;
        } else {
            // For regular transactions, adjust based on difference
            const amountDifference = newAmount - originalAmount;
            projectedNetSavingsForTxMonth = monthDataForTx.netSavings + (originalTx.type === 'income' ? amountDifference : -amountDifference);
        }
        
        const projectedCumulativeAfterMonth = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonth;

        return {
            projectedMonthNetSavings: projectedNetSavingsForTxMonth,
            projectedCumulativeAfterMonth: projectedCumulativeAfterMonth,
            isValidAmount: !isNaN(newAmount) && (isOverrideTx || newAmount > 0)
        };
    }, [editingTransactionId, editFormData.amount, oldTransactions, monthlyFinancialData, loadingSavings]);


    const handleSaveEdit = async (transactionId) => {
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in."); return; }

        const originalTransaction = oldTransactions.find(tx => tx._id === transactionId);
        if (!originalTransaction) { toast.error("Original transaction not found."); return; }

        const isOverrideTx = originalTransaction.description === OVERRIDE_DESCRIPTION;

        if (!isOverrideTx && (!editFormData.description.trim() || !editFormData.category.trim())) {
            toast.error("Description and Category cannot be empty."); return;
        }
        if (editFormData.amount.trim() === '' || isNaN(parseFloat(editFormData.amount))) {
            toast.error("Please enter a valid amount."); return;
        }
        const newAmountNum = parseFloat(editFormData.amount);
        if (!isOverrideTx && newAmountNum <= 0) {
            toast.error("Amount must be positive for regular transactions."); return;
        }

        if (loadingSavings) { toast.info("Financial data loading, please wait."); return; }

        if (projections.projectedCumulativeAfterMonth < 0) {
            const txMonthForDisplay = formatMonthYearDisplay(originalTransaction.date);
            toast.error(`Change makes cumulative savings for ${txMonthForDisplay} negative (${formatCurrency(projections.projectedCumulativeAfterMonth)}).`);
            return;
        }
        
        let updatePayload;
        if (isOverrideTx) {
            // Backend expects the actual override amount (can be negative)
            // The PUT /api/transactions/:id might need to know it's an override to handle it.
            // Or, a dedicated PUT /api/transactions/monthly-override/:monthYear
            updatePayload = {
                amount: newAmountNum, // This is the direct override value
                // Potentially send a flag: isOverride: true
            };
             // For override, we are essentially re-setting it. Using the override endpoint might be cleaner.
            try {
                await axios.post('/api/transactions/monthly-override', // Use POST to update/set
                    { monthYear: formatMonthYearKey(originalTransaction.date), amount: newAmountNum },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success("Monthly Override updated successfully!");
                handleCancelEdit();
                window.dispatchEvent(new CustomEvent('transactions-updated'));
            } catch (err) {
                console.error("Error updating override:", err);
                toast.error(err.response?.data?.message || "Failed to update override.");
            }
            return; // Exit after override update

        } else {
            updatePayload = {
                description: editFormData.description.trim(),
                category: editFormData.category.trim(),
                emoji: editFormData.emoji,
                amount: newAmountNum, // For regular tx, amount is positive
            };
        }

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
        if (!token) { toast.error("You must be logged in."); return; }

        const txToDelete = oldTransactions.find(tx => tx._id === transactionId);
        if (!txToDelete) { toast.error("Transaction not found."); return; }
        if (loadingSavings) { toast.info("Financial data loading, please wait."); return; }

        const isOverrideTx = txToDelete.description === OVERRIDE_DESCRIPTION;
        const txMonthKey = formatMonthYearKey(txToDelete.date);
        
        // Cumulative Savings Check for deletion
        const monthData = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;

        let projectedNetSavingsForTxMonthAfterDelete;
        const txAmountEffect = txToDelete.actualAmount !== undefined ? txToDelete.actualAmount : (txToDelete.type === 'income' ? txToDelete.amount : -txToDelete.amount);

        if (isOverrideTx) {
            // Deleting an override means the month's net savings becomes 0 (or recalculates from other tx if any were allowed, but our rule prevents that)
            // For this check, assume it goes to 0 if no other tx.
            // A more robust backend would recalculate based on any remaining transactions.
            // For simplicity, if an override is deleted, the savings for that month becomes derived from other transactions (which should be none).
            // So, the net effect on cumulative is simply removing the override's contribution.
             projectedNetSavingsForTxMonthAfterDelete = 0; // Placeholder as other txs would define it
        } else {
            projectedNetSavingsForTxMonthAfterDelete = monthData.netSavings - txAmountEffect;
        }
        
        const projectedCumulativeAfterMonthAfterDelete = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonthAfterDelete;

        if (projectedCumulativeAfterMonthAfterDelete < 0 && !isOverrideTx) { // Override deletion should generally be allowed, it uncovers underlying state.
            const txMonthForDisplay = formatMonthYearDisplay(txToDelete.date);
            toast.error(`Deletion makes cumulative savings for ${txMonthForDisplay} negative (${formatCurrency(projectedCumulativeAfterMonthAfterDelete)}).`);
            return;
        }
        
        const confirmMessage = isOverrideTx
            ? `Clear Net Savings Override for ${formatMonthYearDisplay(txToDelete.date)}? This allows adding individual transactions.`
            : `Delete this ${txToDelete.type} of ${formatCurrency(txToDelete.amount, null)}? This cannot be undone.`;

        if (!window.confirm(confirmMessage)) { return; }

        try {
            if (isOverrideTx) {
                 // Use specific endpoint if available, or ensure general delete handles override type
                await axios.delete(`/api/transactions/monthly-override/${txMonthKey}`, { 
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.delete(`/api/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } });
            }
            toast.success(`Transaction ${isOverrideTx ? 'Override ' : ''}deleted successfully!`);
            window.dispatchEvent(new CustomEvent('transactions-updated'));
        } catch (err) {
            console.error("Error deleting transaction:", err);
            toast.error(err.response?.data?.message || "Failed to delete transaction.");
        }
    };

    const handleDownloadPDF = () => { /* ... (no change here, but ensure override tx are included) ... */ };
    
    const currentToken = localStorage.getItem('authToken');
    const regularTxFormDisabled = !!formDate && hasMonthlyOverride(formatMonthYearKey(formDate));
    const overrideFormDisabled = !!overrideFormMonth && hasRegularTransactions(overrideFormMonth);


    if (loading && !currentToken && error) {
      return ( <div className={styles.container}><h2>Old Transactions Management</h2><p className={styles.loginPrompt}>{error}</p></div> );
    }
    if (loading || loadingSavings) {
        return <div className={styles.container}><p>Loading data...</p></div>;
    }

    return (
        <div className={styles.container}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>Old Transactions Management</h2>
                <div><button onClick={handleDownloadPDF} className={styles.pdfButtonOld} style={{marginRight: '10px'}}>Download PDF</button></div>
            </div>

            {/* Section: Add Past Regular Transaction */}
            <section className={`${styles.sectionBox} ${styles.addOldTransactionSection}`}>
                <h3 className={styles.sectionTitle}>Add a Past Transaction (Income/Expense)</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to add transactions.</p>}
                {currentToken && (
                  <form onSubmit={handleAddOldTransaction} className={styles.transactionForm}>
                    {formError && <p className={`${styles.formErrorBanner}`}>{formError}</p>}
                    {regularTxFormDisabled && <p className={`${styles.formInfoBanner}`}>Adding individual transactions is disabled for {formatMonthYearDisplay(formDate)} because a Net Savings Override is set. Clear the override to enable.</p>}
                    
                    {/* ... (rest of the regular transaction form: emoji, type, date, amount, description, category, frequency) ... */}
                    <div className={styles.formRow}>
                        <div className={styles.formGroup} style={{ flex: '0 0 70px' }}>
                            <label htmlFor="form-emoji">Icon:</label>
                            <div className={styles.emojiSelectorContainer}>
                                <button id="form-emoji" type="button" className={styles.emojiButton} style={{marginBottom:"20px"}} onClick={() => setFormShowEmojiPicker(!formShowEmojiPicker)} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled}>
                                    {formSelectedEmoji ? formSelectedEmoji : '➕'}
                                </button>
                                {formShowEmojiPicker && ( <div className={styles.emojiPickerContainer}><Picker onEmojiClick={(emojiData) => { setFormSelectedEmoji(emojiData.emoji); setFormShowEmojiPicker(false); }} /></div> )}
                            </div>
                        </div>
                        <div className={styles.formGroup} style={{ flex: '1' }}>
                            <label htmlFor="form-type">Type:</label>
                            <select id="form-type" value={formType} onChange={(e) => setFormType(e.target.value)} required className={styles.formInput} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled}>
                                <option value="expense">Expense</option><option value="income">Income</option>
                            </select>
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-date">Date (Past Months Only):</label>
                        <input type="date" id="form-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={styles.formInput} max={maxDateForForm} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled} />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-amount">Amount:</label>
                        <input type="number" id="form-amount" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled} />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-description">Description:</label>
                        <input type="text" id="form-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g., Old bill" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled} autoComplete="off" />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-category">Category:</label>
                        <input type="text" id="form-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g., Utilities" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled}/>
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-frequency">Frequency:</label>
                        <select id="form-frequency" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} required className={styles.formInput} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled}>
                            <option value="once">One-time</option>
                        </select>
                    </div>
                    <button type="submit" className={styles.submitButtonWide} disabled={formIsSubmitting || loadingSavings || regularTxFormDisabled}>
                        {formIsSubmitting ? 'Adding...' : (loadingSavings ? 'Loading Data...' : 'Add Past Transaction')}
                    </button>
                  </form>
                )}
            </section>

            {/* Section: Add/Override Monthly Net Savings */}
            <section className={`${styles.sectionBox} ${styles.addMonthlyOverrideSection}`}>
                <h3 className={styles.sectionTitle}>Add/Override Monthly Net Savings</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to manage monthly savings.</p>}
                {currentToken && (
                    <form onSubmit={handleAddOrUpdateMonthlyOverride} className={styles.transactionForm}>
                        {overrideFormError && <p className={`${styles.formErrorBanner}`}>{overrideFormError}</p>}
                        {overrideFormDisabled && <p className={`${styles.formInfoBanner}`}>Setting an override is disabled for {formatMonthYearDisplay(overrideFormMonth)} because regular transactions exist. Clear transactions or the override to enable.</p>}
                        
                        <div className={styles.formGroup}>
                            <label htmlFor="override-month">Month (Past Months Only):</label>
                            <input 
                                type="month" 
                                id="override-month" 
                                value={overrideFormMonth} 
                                onChange={(e) => { setOverrideFormMonth(e.target.value); setOverrideFormError('');}} // Clear error on change
                                required 
                                className={styles.formInput} 
                                max={maxMonthForOverride}
                                disabled={overrideFormIsSubmitting || loadingSavings } // Not disabled by overrideFormDisabled as you might want to select a month to clear it
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="override-amount">Net Savings Amount for Month:</label>
                            <input 
                                type="number" 
                                id="override-amount" 
                                value={overrideFormAmount} 
                                onChange={(e) => setOverrideFormAmount(e.target.value)} 
                                placeholder="e.g., 500 or -150" 
                                step="0.01" 
                                className={styles.formInput} 
                                disabled={overrideFormIsSubmitting || loadingSavings || overrideFormDisabled} 
                            />
                             <small>Enter the total net savings for the month. Can be positive or negative. This will replace any individual transactions for the selected month.</small>
                        </div>
                        <div className={styles.formRow} style={{gap: '10px', marginTop: '10px'}}>
                            <button 
                                type="submit" 
                                className={styles.submitButtonWide} 
                                style={{flex: 1}}
                                disabled={overrideFormIsSubmitting || loadingSavings || overrideFormDisabled || !overrideFormMonth || overrideFormAmount.trim() === ''}>
                                {overrideFormIsSubmitting ? 'Saving...' : (loadingSavings ? 'Loading Data...' : 'Set/Update Override')}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleClearMonthlyOverride}
                                className={`${styles.actionButtonOld} ${styles.deleteButtonOld}`} 
                                style={{flex: 1, padding: '12px 20px', border: '1px solid', fontSize: '1rem'}}
                                title={`Clear override for ${formatMonthYearDisplay(overrideFormMonth)}`}
                                disabled={overrideFormIsSubmitting || loadingSavings || !overrideFormMonth || !hasMonthlyOverride(overrideFormMonth) }>
                                Clear Override for Month
                            </button>
                        </div>
                    </form>
                )}
            </section>

            {/* Section: Transaction History Display */}
            <section className={`${styles.sectionBox} ${styles.displayOldTransactionsSection}`}>
                <h3 className={styles.sectionTitle}>Transaction History (Older than Current Month)</h3>
                {/* ... (error/login prompts) ... */}
                 { !error && !currentToken && <p className={styles.loginPrompt}>Please log in to view and manage transactions.</p>}
                { error && !loading && <p className={`${styles.pageErrorBanner}`}>{error.split('\n').map((e,i) => <span key={i}>{e.replace(/(Transactions: |Summary: |Auth: )/g, '')}<br/></span>)}</p>}

                { !loading && !error && currentToken && (
                    sortedMonthKeys.length > 0 ? (
                        sortedMonthKeys.map(monthYearDisplayKey => (
                            <div key={monthYearDisplayKey} className={styles.monthGroup}>
                                <h4 className={styles.monthHeading}>{monthYearDisplayKey}</h4>
                                <div className={styles.transactionList}>
                                    {groupedTransactions[monthYearDisplayKey].map(transaction => {
                                      const isOverride = transaction.description === OVERRIDE_DESCRIPTION;
                                      return (
                                      <React.Fragment key={transaction._id}>
                                        <div className={`${styles.transactionItemOldPage} ${isOverride ? styles.monthlyOverrideItem : styles[transaction.type]}`}>
                                            <div className={styles.dateAndEmoji}>
                                                <span className={styles.transactionDateDisplay}>{isOverride ? "Month Summary" : formatDateDisplay(transaction.date)}</span>
                                                {editingTransactionId !== transaction._id && (isOverride ? OVERRIDE_EMOJI : transaction.emoji) && 
                                                    <span className={styles.transactionEmoji}>{isOverride ? OVERRIDE_EMOJI : transaction.emoji}</span>}
                                            </div>

                                            {editingTransactionId === transaction._id ? (
                                                <div className={styles.editFormContainerOld}> 
                                                    {!isOverride && <input type="text" name="description" value={editFormData.description} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Description" />}
                                                    {!isOverride && <input type="text" name="category" value={editFormData.category} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Category" />}
                                                    {isOverride && <span className={styles.overrideLabel}>Override Amount:</span>}
                                                    <input type="number" name="amount" value={editFormData.amount} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Amount" step="0.01" min={isOverride ? undefined : "0.01"} />
                                                    
                                                    {!isOverride && 
                                                        <div className={styles.editEmojiPickerContainerOld}>
                                                            <button type="button" className={styles.emojiButtonSmallOld} onClick={() => setShowEditEmojiPicker(prev => prev === transaction._id ? null : transaction._id)}>
                                                                {editFormData.emoji || '✏️'}
                                                            </button>
                                                            {showEditEmojiPicker === transaction._id && (
                                                                <div className={styles.emojiPickerPopoverOld}><Picker onEmojiClick={(emojiData) => { setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji })); setShowEditEmojiPicker(null); }} /></div>
                                                            )}
                                                        </div>
                                                    }
                                                </div>
                                            ) : (
                                                <span className={styles.transactionDetailsOld}>
                                                    {isOverride ? `${OVERRIDE_DESCRIPTION} (${OVERRIDE_CATEGORY})` : `${transaction.description} (${transaction.category})`}
                                                </span>
                                            )}
                                            
                                            {editingTransactionId !== transaction._id && (
                                                <span className={`${styles.transactionAmountOld} ${isOverride ? (transaction.actualAmount >= 0 ? styles.incomeOld : styles.expenseOld) : (transaction.type === 'income' ? styles.incomeOld : styles.expenseOld)}`}>
                                                    {isOverride ? formatCurrency(transaction.actualAmount, null, true) : formatCurrency(transaction.amount, transaction.type)}
                                                </span>
                                            )}
                                            {editingTransactionId === transaction._id && ( <span className={styles.transactionAmountOld} style={{visibility: 'hidden'}}>{formatCurrency(0)}</span> )}

                                            <div className={styles.actionButtonsOld}>
                                                {editingTransactionId === transaction._id ? (
                                                    <>
                                                        <button onClick={() => handleSaveEdit(transaction._id)} className={`${styles.actionButtonOld} ${styles.saveButtonOld}`} title="Save"><FaSave /></button>
                                                        <button onClick={handleCancelEdit} className={`${styles.actionButtonOld} ${styles.cancelButtonOld}`} title="Cancel"><FaTimes /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={() => handleEditClick(transaction)} 
                                                            className={`${styles.actionButtonOld} ${styles.editButtonOld}`} 
                                                            title="Edit"
                                                            disabled={isOverride && hasRegularTransactions(formatMonthYearKey(transaction.date))} // Disable edit override if somehow regular tx exist
                                                            >
                                                            <FaEdit />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTransaction(transaction._id)} 
                                                            className={`${styles.actionButtonOld} ${styles.deleteButtonOld}`} 
                                                            title={isOverride ? "Clear Override" : "Delete"}
                                                            disabled={isOverride && hasRegularTransactions(formatMonthYearKey(transaction.date))} // Disable delete override if somehow regular tx exist
                                                            >
                                                            <FaTrash />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {editingTransactionId === transaction._id && projections.isValidAmount && (
                                            <div className={`${styles.editProjectionsOld} ${styles.projectionBox}`}>
                                                <p>Effect on <strong>{formatMonthYearDisplay(transaction.date)}</strong>:</p>
                                                <p>Net Savings for this month would become: <strong>{formatCurrency(projections.projectedMonthNetSavings, null, isOverride)}</strong></p>
                                                <p>Cumulative Savings up to end of this month would become: <strong>{formatCurrency(projections.projectedCumulativeAfterMonth, null, true)}</strong></p>
                                                {projections.projectedCumulativeAfterMonth < 0 && (
                                                    <p className={styles.warningText}>This change would make cumulative savings negative!</p>
                                                )}
                                            </div>
                                        )}
                                      </React.Fragment>
                                    )})}
                                </div>
                            </div>
                        ))
                    ) : ( <p>No transactions found for previous months.</p> )
                )}
                 { !loading && !error && !currentToken && <p className={styles.loginPrompt}>Log in to manage past financial records.</p>}
            </section>
        </div>
    );
}

export default OldTransactionsPage;