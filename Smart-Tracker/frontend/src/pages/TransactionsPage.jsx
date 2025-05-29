import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEdit, FaTrash } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './TransactionsPage.module.css'; // Assuming TransactionsPage uses these styles as per your original code.
import Header from '../components/Header'; // Path to your Header component

// --- Constants for Goal Savings ---
const GOAL_SAVINGS_CATEGORY_NAME = 'Goal Savings';
const GOAL_SAVINGS_DESCRIPTION_PREFIX = "Saving for: "; // Ensure this matches your expense description prefix

const formatCurrency = (value, type) => {
    const numValue = parseFloat(value);
    let prefix = '';
    if (type === 'income') prefix = '+ ';
    else if (type === 'expense') prefix = '- ';

    if (isNaN(numValue)) {
        return prefix + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return prefix + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

const isDateInCurrentMonth = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
};

// --- Helper function for Goal Savings ---
const extractGoalNameFromExpenseDescription = (description) => {
    const prefix = GOAL_SAVINGS_DESCRIPTION_PREFIX.toLowerCase();
    const lowerDesc = description.trim().toLowerCase();
    if (lowerDesc.startsWith(prefix)) {
        return description.trim().substring(GOAL_SAVINGS_DESCRIPTION_PREFIX.length).trim();
    }
    return null;
};


function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    // Financial Summary State
    const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0);
    const [currentMonthIncomeTotal, setCurrentMonthIncomeTotal] = useState(0);
    const [currentMonthExpenseTotal, setCurrentMonthExpenseTotal] = useState(0);
    const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);

    // Goals State
    const [goals, setGoals] = useState([]);
    const [loadingGoals, setLoadingGoals] = useState(true);


    const fetchFinancialSummary = useCallback(async () => {
        setLoadingFinancialSummary(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Token not found for summary.` : `Auth: Token not found for summary.`);
            setCurrentCumulativeSavings(0);
            setCurrentMonthIncomeTotal(0);
            setCurrentMonthExpenseTotal(0);
            setLoadingFinancialSummary(false);
            return;
        }
        try {
            const savingsPromise = axios.get('/api/transactions/savings/monthly', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dashboardPromise = fetch('/api/transactions/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const [savingsResponse, dashboardResponseHttp] = await Promise.all([savingsPromise, dashboardPromise]);

            const fetchedMonthlyNetSavings = savingsResponse.data || [];
            const calculatedTotalCumulativeSavings = fetchedMonthlyNetSavings.reduce(
                (sum, monthData) => sum + (monthData.savings || 0), 0
            );
            setCurrentCumulativeSavings(calculatedTotalCumulativeSavings);

            if (!dashboardResponseHttp.ok) {
                const errorText = await dashboardResponseHttp.text();
                throw new Error(`Dashboard API for month summary: ${errorText.substring(0,100)}`);
            }
            const dashboardData = await dashboardResponseHttp.json();
            setCurrentMonthIncomeTotal(dashboardData.totalIncome || 0);
            setCurrentMonthExpenseTotal(dashboardData.totalExpense || 0);

        } catch (err) {
             console.error("Error fetching financial summary for Transactions page:", err);
             const errMsg = err.response?.data?.message || err.message || "Failed to fetch financial summary.";
             setError(prev => prev ? `${prev}\nSummary: ${errMsg}` : `Summary: ${errMsg}`);
             setCurrentCumulativeSavings(0);
             setCurrentMonthIncomeTotal(0);
             setCurrentMonthExpenseTotal(0);
        } finally {
            setLoadingFinancialSummary(false);
        }
    }, []);


    const fetchAllTransactions = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication token not found. Please log in.");
            setTransactions([]);
            if (!isRefresh) setLoading(false);
            return;
        }
        try {
            const response = await fetch('/api/transactions/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText.substring(0,100)}`);
            }
            const data = await response.json();
            const sortedData = (data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sortedData);
        } catch (err) {
            console.error("Error fetching all transactions:", err);
            setError(prev => prev ? `${prev}\nTransactions List: ${err.message}` : `Transactions List: ${err.message}`);
            setTransactions([]);
        } finally {
            if (!isRefresh) setLoading(false);
        }
    }, []);

    const fetchGoals = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoadingGoals(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Token not found for goals.` : `Auth: Token not found for goals.`);
            setGoals([]);
            if (!isRefresh) setLoadingGoals(false);
            return;
        }
        try {
            const response = await axios.get('/api/goals', { headers: { Authorization: `Bearer ${token}` } });
            setGoals(response.data || []);
        } catch (err) {
            console.error("Error fetching goals for Transactions page:", err);
            const errMsg = err.response?.data?.message || err.message || "Failed to fetch goals.";
            setError(prev => prev ? `${prev}\nGoals: ${errMsg}` : `Goals: ${errMsg}`);
            setGoals([]);
        } finally {
            if (!isRefresh) setLoadingGoals(false);
        }
    }, []);


    useEffect(() => {
        setError(null);
        fetchAllTransactions();
        fetchFinancialSummary();
        fetchGoals();
    }, [fetchAllTransactions, fetchFinancialSummary, fetchGoals]);

    useEffect(() => {
        const handleExternalUpdate = (event) => {
            console.log("TransactionsPage received an update event, re-fetching...", event.type);
            setError(null);
            fetchAllTransactions(true);
            fetchFinancialSummary();
            fetchGoals(true); // Refresh goals too
        };
        window.addEventListener('transactions-updated', handleExternalUpdate);
        return () => {
            window.removeEventListener('transactions-updated', handleExternalUpdate);
        };
    }, [fetchAllTransactions, fetchFinancialSummary, fetchGoals]);

    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({
            description: tx.description,
            category: tx.category,
            emoji: tx.emoji || '',
            amount: tx.amount !== undefined ? tx.amount.toString() : ''
        });
        setShowEditEmojiPicker(null);
    };

    const handleCancelEdit = () => {
        setEditingTxId(null);
        setShowEditEmojiPicker(null);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const currentMonthNetBalance = useMemo(() => {
        return currentMonthIncomeTotal - currentMonthExpenseTotal;
    }, [currentMonthIncomeTotal, currentMonthExpenseTotal]);

    const projections = useMemo(() => {
        if (!editingTxId || loadingFinancialSummary || loadingGoals) { // Added loadingGoals
            return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }
        const originalTx = transactions.find(tx => tx._id === editingTxId);
        if (!originalTx) {
            return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const txType = originalTx.type;
        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        const newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount)) {
             return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }

        const amountDifference = newAmount - originalAmount;
        let projectedTotalCumulativeSavings;
        let projectedCurrentMonthBalance = currentMonthNetBalance;

        if (txType === 'income') {
            projectedTotalCumulativeSavings = currentCumulativeSavings + amountDifference;
            if (isDateInCurrentMonth(originalTx.date)) {
                 projectedCurrentMonthBalance += amountDifference;
            }
        } else { // expense
            projectedTotalCumulativeSavings = currentCumulativeSavings - amountDifference;
            if (isDateInCurrentMonth(originalTx.date)) {
                projectedCurrentMonthBalance -= amountDifference;
            }
        }

        let goalConstraint = { applicable: false, limit: 0, goalName: '', isExceeded: false };
        if (txType === 'expense' && editFormData.category.trim().toLowerCase() === GOAL_SAVINGS_CATEGORY_NAME.toLowerCase() && goals && goals.length > 0) {
            const extractedGoalName = extractGoalNameFromExpenseDescription(editFormData.description);
            if (extractedGoalName) {
                const matchedGoal = goals.find(g =>
                    g.description.trim().toLowerCase() === extractedGoalName.toLowerCase() &&
                    g.status === 'active'
                );
                if (matchedGoal) {
                    const goalTarget = Number(matchedGoal.targetAmount) || 0;
                    const goalSaved = Number(matchedGoal.savedAmount) || 0;
                    let remainingNeeded = goalTarget - goalSaved;
                    if (remainingNeeded < 0) remainingNeeded = 0;
                    goalConstraint = {
                        applicable: true,
                        limit: remainingNeeded,
                        goalName: matchedGoal.description,
                        isExceeded: newAmount > 0 && newAmount > remainingNeeded
                    };
                }
            }
        }

        return {
            projectedCurrentMonthBalance: isDateInCurrentMonth(originalTx.date) ? projectedCurrentMonthBalance : null,
            projectedTotalCumulativeSavings: projectedTotalCumulativeSavings,
            isValidAmount: newAmount > 0 && !isNaN(newAmount),
            txType: txType,
            isCurrentMonthTx: isDateInCurrentMonth(originalTx.date),
            goalConstraint // Added goalConstraint
        };
    }, [
        editingTxId, editFormData.amount, editFormData.category, editFormData.description, // Added category & description
        transactions, currentCumulativeSavings, currentMonthNetBalance,
        loadingFinancialSummary, loadingGoals, goals // Added goals related states
    ]);


    const handleSaveEdit = async (txId) => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("Authentication token not found."); return; }

        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            toast.error("Description and Category cannot be empty."); return;
        }
        const newAmount = parseFloat(editFormData.amount);
        if (isNaN(newAmount) || newAmount <= 0) {
            toast.error("Please enter a valid positive amount."); return;
        }

        if (loadingFinancialSummary || loadingGoals) { // Added loadingGoals
            toast.info("Financial or goal data is still loading. Please try again."); return;
        }

        const originalTx = transactions.find(tx => tx._id === txId);
        if (!originalTx) {
            toast.error("Original transaction not found."); setError("Update Error: Original transaction not found."); return;
        }

        // --- Goal Savings Category Check (Only for expenses) ---
        if (originalTx.type === 'expense' && editFormData.category.trim().toLowerCase() === GOAL_SAVINGS_CATEGORY_NAME.toLowerCase()) {
            console.log("--- TxPage: Goal Savings Check ---");
            const extractedGoalName = extractGoalNameFromExpenseDescription(editFormData.description);
            console.log("Extracted Goal Name:", `"${extractedGoalName}"`, "from desc:", `"${editFormData.description}"`);


            if (!extractedGoalName) {
                toast.error(
                    `For the "${GOAL_SAVINGS_CATEGORY_NAME}" category, the expense description ` +
                    `"${editFormData.description.trim()}" does not follow the expected format: ` +
                    `"${GOAL_SAVINGS_DESCRIPTION_PREFIX}Your Goal Name".`
                );
                return;
            }

            if (!goals || goals.length === 0) {
                toast.warn(`Expense categorized as "${GOAL_SAVINGS_CATEGORY_NAME}", but no goals are loaded/defined. Proceeding without goal-specific validation.`);
            } else {
                const matchedGoal = goals.find(g =>
                    g.description.trim().toLowerCase() === extractedGoalName.toLowerCase() &&
                    g.status === 'active'
                );
                console.log("Matched active goal:", matchedGoal ? matchedGoal.description : "None");

                if (!matchedGoal) {
                    toast.error(
                        `For the "${GOAL_SAVINGS_CATEGORY_NAME}" category, the goal name "${extractedGoalName}" ` +
                        `(from description "${editFormData.description.trim()}") ` +
                        `must match an *active* financial goal. No such active goal found.`
                    );
                    return;
                }

                const goalTargetAmount = Number(matchedGoal.targetAmount) || 0;
                const goalSavedAmount = Number(matchedGoal.savedAmount) || 0;
                let remainingNeededForGoal = goalTargetAmount - goalSavedAmount;
                if (remainingNeededForGoal < 0) remainingNeededForGoal = 0;
                 console.log(`Goal "${matchedGoal.description}": Target=${goalTargetAmount}, Saved=${goalSavedAmount}, Remaining=${remainingNeededForGoal}, NewExpense=${newAmount}`);


                if (newAmount > remainingNeededForGoal) {
                    toast.error(
                        `Expense amount ${formatCurrency(newAmount, null)} for goal "${matchedGoal.description}" ` +
                        `exceeds the remaining amount needed (${formatCurrency(remainingNeededForGoal, null)}). ` +
                        `Max spend for this item is ${formatCurrency(remainingNeededForGoal, null)}.`
                    );
                    return;
                }
            }
        }
        // --- End Goal Savings Category Check ---


        if (projections.projectedTotalCumulativeSavings < 0) {
            toast.error(
                `Cannot save. This change would result in an overall negative net savings of ${formatCurrency(projections.projectedTotalCumulativeSavings, null)}.` +
                ` Current total savings: ${formatCurrency(currentCumulativeSavings, null)}.`
            );
            return;
        }

        if (projections.isCurrentMonthTx && projections.projectedCurrentMonthBalance < 0 && currentMonthNetBalance >=0) {
            const proceed = window.confirm(
                `Warning: This change will make your current month's balance negative (${formatCurrency(projections.projectedCurrentMonthBalance, null)}). ` +
                `It will be covered by your total savings. Do you want to proceed?`
            );
            if (!proceed) return;
        }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    description: editFormData.description.trim(),
                    category: editFormData.category.trim(),
                    emoji: editFormData.emoji,
                    amount: newAmount,
                    type: originalTx.type
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }

            window.dispatchEvent(new CustomEvent('transactions-updated'));
            toast.success("Transaction updated successfully!");
            handleCancelEdit();

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
            toast.error(`Update Error: ${err.message}`);
        }
    };

    const handleDelete = async (txId) => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("Authentication token not found."); return; }

        const transactionToDelete = transactions.find(tx => tx._id === txId);
        if (!transactionToDelete) {
            toast.error("Could not find the transaction to delete.");
            setError("Delete Error: Transaction not found.");
            return;
        }
        const { amount: amountToDelete, type: txType } = transactionToDelete;

        if (loadingFinancialSummary) { // No need to check loadingGoals here, as delete logic primarily affects overall savings
            toast.info("Financial summary is loading. Please try again to delete.");
            return;
        }

        let projectedNewOverallNetSavings;
        if (txType === 'income') {
            projectedNewOverallNetSavings = currentCumulativeSavings - amountToDelete;
        } else {
            projectedNewOverallNetSavings = currentCumulativeSavings + amountToDelete;
        }

        if (txType === 'income' && projectedNewOverallNetSavings < 0) {
            toast.error(
                `Cannot delete this income of ${formatCurrency(amountToDelete, 'income')}. Doing so ` +
                `would result in an overall negative net savings of ${formatCurrency(projectedNewOverallNetSavings, null)}.`
            );
            return;
        }

        let confirmMessage = `Are you sure you want to delete this ${txType} of ${formatCurrency(amountToDelete, txType)}?`;
        if (txType === 'income' && projectedNewOverallNetSavings < currentCumulativeSavings) {
            confirmMessage += ` Your overall net savings will be reduced to ${formatCurrency(projectedNewOverallNetSavings, null)}.`;
        } else if (txType === 'expense' && projectedNewOverallNetSavings > currentCumulativeSavings ) {
            confirmMessage += ` Your overall net savings will increase to ${formatCurrency(projectedNewOverallNetSavings, null)}.`;
        }
        if (!window.confirm(confirmMessage)) { return; }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Deletion failed' }));
                throw new Error(errorData.message || `Failed to delete transaction`);
            }

            window.dispatchEvent(new CustomEvent('transactions-updated'));
            toast.success(`${txType.charAt(0).toUpperCase() + txType.slice(1)} deleted successfully!`);

        } catch (err) {
            console.error("Error deleting transaction:", err);
            setError(`Delete Error: ${err.message}`);
            toast.error(`Delete Error: ${err.message}`);
        }
    };

    const handleDownloadAllPDF = () => {
        if (transactions.length === 0) {
            toast.info("No transactions to download.");
            return;
        }
        const doc = new jsPDF();
        const tableColumn = ["Date", "Type", "Description", "Category", "Amount"];
        // const tableRows = []; // This variable was declared but not used, removed.

        doc.setFontSize(18);
        doc.text(`All Transactions for ${username}`, 14, 22);

        // For PDF amount, we want the raw value without +/- from formatCurrency if we handle color/prefix in PDF
        const pdfTransactions = transactions.map(tx => [
            formatDate(tx.date),
            tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
            tx.description,
            tx.category,
            (tx.type === 'income' ? '+ ' : '- ') + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount)
        ]);


        autoTable(doc, {
            head: [tableColumn],
            body: pdfTransactions, // Use the specially formatted data for PDF
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                4: { halign: 'right' }
            },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 4) { // Amount column
                    const rawAmountText = data.cell.raw.toString(); // Get the raw string e.g., "+ $100.00"
                    if (rawAmountText.startsWith('+')) {
                        doc.setTextColor(34, 139, 34); // Dark Green for income
                    } else if (rawAmountText.startsWith('-')) {
                        doc.setTextColor(220, 20, 60); // Crimson for expense
                    }
                }
            },
            willDrawCell: (data) => { // Reset text color for other cells
                if (data.column.index !== 4) {
                    doc.setTextColor(40); // Default text color
                }
            }
        });

        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.setTextColor(40); // Reset text color for footer
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`all-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };

    const pageIsLoading = loading || loadingFinancialSummary || loadingGoals; // Added loadingGoals

    if (pageIsLoading) {
        return (
            <>
                <Header />
                <div className={styles.dashboardPageContent}><p>Loading transactions, financial summary, and goals...</p></div>
            </>
        );
    }

    const pageLoadError = error && (error.includes("Transactions List:") || error.includes("Summary:") || error.includes("Auth:") || error.includes("Goals:"));

    return (
        <>
            <Header /> {/* --- Header Component Added Here --- */}
            <div className={styles.transactionsPageContainer}> {/* Ensure this class exists or use a general one like styles.pageContainer */}
                <div className={styles.dashboardPageContent}>
                    <div className={styles.sectionHeader}>
                       <h1 style={{marginTop:'100px'}} className={styles.pageTitle}>All Transactions</h1>
                       <div>
                           <button
                               onClick={handleDownloadAllPDF}
                               className={styles.pdfButton}
                               style={{fontSize: '1rem', marginRight: '1rem',marginTop:'100px'}}
                               disabled={pageIsLoading || transactions.length === 0 || !!pageLoadError}
                           >
                               Download All PDF
                           </button>
                           <Link to="/dashboard" className={styles.seeAllButton} style={{fontSize: '1rem', marginTop:'100px'}}>Back to Dashboard</Link>
                       </div>
                    </div>

                    {pageLoadError &&
                        <div className={styles.pageErrorBanner}>
                            Error loading page data:
                            {error.split('\n').filter(e => e.trim()).map((e, i) => <div key={i}>{e.replace(/(Transactions List: |Summary: |Auth: |Goals: )/g, '')}</div>)}
                        </div>
                    }
                    {(!pageLoadError && error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:'))) && (
                        <p className={styles.formErrorBanner} style={{marginBottom: '1rem'}}>{error.replace(/(Update Error: |Delete Error: )/g, '')}</p>
                    )}


                    {!loading && !pageLoadError && (
                         <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
                            {transactions.length > 0 ? (
                                <div className={styles.transactionList} style={{borderTop: 'none'}}>
                                    {transactions.map((tx) => (
                                        <React.Fragment key={tx._id}>
                                        <div
                                            className={`${styles.transactionItem} ${
                                                tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder
                                            }`}
                                        >
                                            <span className={styles.transactionDate} style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}>
                                                {formatDate(tx.date)}
                                            </span>

                                            {editingTxId === tx._id ? (
                                                <>
                                                    <div style={{ gridColumn: '2 / 5', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: '0.5rem', alignItems: 'center', gridRow: '1 / 2' }}>
                                                        <input
                                                            type="text" name="description" value={editFormData.description}
                                                            onChange={handleEditFormChange} className={styles.formInput}
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            placeholder="Description" required
                                                        />
                                                        <input
                                                            type="text" name="category" value={editFormData.category}
                                                            onChange={handleEditFormChange} className={styles.formInput}
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                            placeholder="Category"
                                                            list="transaction-categories"
                                                            required
                                                        />
                                                        <datalist id="transaction-categories">
                                                            {/* You can populate this dynamically or have common ones */}
                                                            <option value="Salary" />
                                                            <option value="Freelance" />
                                                            <option value="Food & Drink" />
                                                            <option value="Transportation" />
                                                            <option value={GOAL_SAVINGS_CATEGORY_NAME} />
                                                        </datalist>
                                                        <input
                                                            type="number" name="amount" value={editFormData.amount}
                                                            onChange={handleEditFormChange} className={styles.formInput}
                                                            style={{ fontSize: '0.9rem', padding: '0.4rem', textAlign: 'right' }}
                                                            step="0.01" min="0.01" required
                                                        />
                                                          <div style={{ position: 'relative', justifySelf:'start' }}>
                                                            <button
                                                              type="button"
                                                              onClick={() => setShowEditEmojiPicker(prev => prev === tx._id ? null : tx._id)}
                                                              className={styles.emojiButton}
                                                              style={{fontSize: '1.2rem', padding: '0.4rem'}}
                                                              aria-label="Select icon"
                                                            >
                                                              {editFormData.emoji || '+'}
                                                            </button>
                                                            {showEditEmojiPicker === tx._id && (
                                                              <div className={styles.emojiPickerContainer} style={{top: '100%', left: 0, zIndex: 10, position: 'absolute', minWidth: '280px'}}>
                                                                <Picker
                                                                    onEmojiClick={(emojiData) => {
                                                                        setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
                                                                        setShowEditEmojiPicker(null);
                                                                    }}
                                                                    pickerStyle={{ width: '100%' }}
                                                                />
                                                              </div>
                                                            )}
                                                          </div>
                                                     </div>
                                                </>
                                            ) : (
                                                <>
                                                <span className={styles.transactionDesc} style={{ gridColumn: '2 / 4', gridRow: '1 / 2' }}>
                                                    {tx.emoji && <span className={styles.transactionEmoji} style={{marginRight: '0.5em'}}>{tx.emoji}</span>}
                                                    {tx.description} ({tx.category})
                                                </span>
                                                <span
                                                    className={`${styles.transactionAmount} ${tx.type === 'income' ? styles.income : styles.expense}`}
                                                    style={{ gridColumn: '4 / 5', gridRow: '1 / 2', justifySelf: 'end' }}
                                                >
                                                    {formatCurrency(tx.amount, tx.type)} {/* Pass type for +/- prefix */}
                                                </span>
                                                </>
                                            )}
                                            <div style={{
                                                display: 'flex', gap: '0.5rem', justifyContent: 'flex-end',
                                                gridColumn: '5 / 6', gridRow: '1 / span 2',
                                                alignItems: 'center'
                                            }}>
                                                {editingTxId === tx._id ? (
                                                    <>
                                                        <button onClick={() => handleSaveEdit(tx._id)} className={`${styles.actionButton} ${styles.saveButton}`}>Save</button>
                                                        <button onClick={handleCancelEdit} className={`${styles.actionButton} ${styles.cancelButton}`}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleEditClick(tx)} className={`${styles.actionButton} ${styles.editButton}`} aria-label="Edit transaction">
                                                            <FaEdit />
                                                        </button>
                                                        <button onClick={() => handleDelete(tx._id)} className={`${styles.actionButton} ${styles.deleteButton}`} aria-label="Delete transaction">
                                                            <FaTrash />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {editingTxId === tx._id && projections.isValidAmount && (
                                            <div className={styles.editProjections} style={{gridColumn: '1 / -1'}}>
                                                {projections.isCurrentMonthTx && projections.projectedCurrentMonthBalance !== null && (
                                                    <p>
                                                        If saved, this month's balance will become: <strong>{formatCurrency(projections.projectedCurrentMonthBalance, null)}</strong>
                                                    </p>
                                                )}
                                                <p>
                                                    Your total cumulative savings will become: <strong>{formatCurrency(projections.projectedTotalCumulativeSavings, null)}</strong>
                                                </p>
                                                {/* Goal Constraint Projection */}
                                                {projections.txType === 'expense' && projections.goalConstraint && projections.goalConstraint.applicable && (
                                                    <p style={projections.goalConstraint.isExceeded ? {color: 'red', fontWeight: 'bold'} : {color: 'darkgreen'}}>
                                                        For goal "<strong>{projections.goalConstraint.goalName}</strong>":
                                                        Max spend for this item is <strong>{formatCurrency(projections.goalConstraint.limit, null)}</strong>.
                                                        {projections.goalConstraint.isExceeded && (
                                                            <em> Current amount exceeds this limit!</em>
                                                        )}
                                                    </p>
                                                )}
                                                 {projections.projectedTotalCumulativeSavings < 0 && (
                                                    <p style={{color: 'red', fontWeight: 'bold'}}>
                                                        Warning: This change will result in overall negative savings!
                                                    </p>
                                                )}
                                                {projections.isCurrentMonthTx && projections.projectedCurrentMonthBalance !== null && projections.projectedCurrentMonthBalance < 0 && currentMonthNetBalance >= 0 && (
                                                    <p style={{color: 'orange', fontWeight: 'bold'}}>
                                                        Note: This change will make your current month's balance negative.
                                                    </p>
                                                )}
                                            </div>
                                         )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.placeholderContent}>
                                    No transactions found. {localStorage.getItem('authToken') ? '' : 'Please log in to view transactions.'}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </>
    );
}

export default TransactionsPage;