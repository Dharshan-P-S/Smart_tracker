import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Picker from 'emoji-picker-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaEdit, FaTrash } from 'react-icons/fa';
import axios from 'axios';

import styles from './Dashboard.module.css'; // Assuming this CSS module is shared

const GOAL_SAVINGS_CATEGORY_NAME = 'Goal Savings';
const GOAL_SAVINGS_DESCRIPTION_PREFIX = "Saving for: "; // Define the prefix

const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
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

// Helper function to extract goal name from expense description
const extractGoalNameFromExpenseDescription = (description) => {
    const prefix = GOAL_SAVINGS_DESCRIPTION_PREFIX.toLowerCase();
    const lowerDesc = description.trim().toLowerCase();
    if (lowerDesc.startsWith(prefix)) {
        return description.trim().substring(GOAL_SAVINGS_DESCRIPTION_PREFIX.length).trim();
    }
    return null; // Or return description if no prefix, depending on how you want to handle non-prefixed descriptions
};


function ExpensePage() {
    const [allExpenseTransactions, setAllExpenseTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

    const [goals, setGoals] = useState([]);
    const [loadingGoals, setLoadingGoals] = useState(true);
    
    const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0);
    const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);

    const [currentMonthIncomeTotalForDisplay, setCurrentMonthIncomeTotalForDisplay] = useState(0);
    const [currentMonthExpenseTotalForDisplay, setCurrentMonthExpenseTotalForDisplay] = useState(0);

    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);

    const fetchAllTransactions = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found for transactions.");
            const response = await fetch('/api/transactions/current-month/expense', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Fetching expense list: ${response.status} ${errorText.substring(0,100)}`);
            }
            const expenseData = await response.json();
            expenseData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAllExpenseTransactions(expenseData);
        } catch (err) {
            console.error("Error fetching transactions for Expense page:", err);
            setError(prev => prev ? `${prev}\nTransactions: ${err.message}` : `Transactions: ${err.message}`);
            setAllExpenseTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchFinancialSummary = async () => {
        setLoadingFinancialSummary(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Authentication token not found for summary.` : `Auth: Authentication token not found for summary.`);
            setCurrentCumulativeSavings(0);
            setCurrentMonthIncomeTotalForDisplay(0);
            setCurrentMonthExpenseTotalForDisplay(0);
            setLoadingFinancialSummary(false);
            return;
        }
        try {
            const savingsResponse = await axios.get('/api/transactions/savings/monthly', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const fetchedMonthlyNetSavings = savingsResponse.data || [];
            const calculatedTotalCumulativeSavings = fetchedMonthlyNetSavings.reduce(
                (sum, monthData) => sum + (monthData.savings || 0), 0
            );
            setCurrentCumulativeSavings(calculatedTotalCumulativeSavings);

            const dashboardResponse = await fetch('/api/transactions/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!dashboardResponse.ok) {
                const errorText = await dashboardResponse.text();
                throw new Error(`Dashboard API for month summary: ${errorText.substring(0,100)}`);
            }
            const dashboardData = await dashboardResponse.json();
            setCurrentMonthIncomeTotalForDisplay(dashboardData.totalIncome || 0);
            setCurrentMonthExpenseTotalForDisplay(dashboardData.totalExpense || 0);

        } catch (err) {
             console.error("Error fetching financial summary for Expense page:", err);
             const errMsg = err.response?.data?.message || err.message || "Failed to fetch financial summary.";
             setError(prev => prev ? `${prev}\nSummary: ${errMsg}` : `Summary: ${errMsg}`);
             setCurrentCumulativeSavings(0);
             setCurrentMonthIncomeTotalForDisplay(0);
             setCurrentMonthExpenseTotalForDisplay(0);
        } finally {
            setLoadingFinancialSummary(false);
        }
    };

    const fetchGoals = async () => {
        setLoadingGoals(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setError(prev => prev ? `${prev}\nAuth: Authentication token not found for goals.` : `Auth: Authentication token not found for goals.`);
                setGoals([]);
                setLoadingGoals(false);
                return;
            }
            const response = await axios.get('/api/goals', { headers: { Authorization: `Bearer ${token}` } });
            setGoals(response.data || []);
        } catch (err) {
            console.error("Error fetching goals for Expense page:", err);
            const errMsg = err.response?.data?.message || err.message || "Failed to fetch goals.";
            setError(prev => prev ? `${prev}\nGoals: ${errMsg}` : `Goals: ${errMsg}`);
            setGoals([]);
        } finally {
            setLoadingGoals(false);
        }
    };


    useEffect(() => {
        setError(null);
        fetchAllTransactions();
        fetchFinancialSummary();
        fetchGoals();
    }, []);

    useEffect(() => {
        const handleUpdate = () => {
            console.log("ExpensePage received update event, re-fetching all data...");
            setError(null);
            fetchAllTransactions();
            fetchFinancialSummary();
            fetchGoals();
        };
        window.addEventListener('expense-updated', handleUpdate);
        window.addEventListener('transaction-deleted', handleUpdate);
        window.addEventListener('transactions-updated', handleUpdate);
        return () => {
            window.removeEventListener('expense-updated', handleUpdate);
            window.removeEventListener('transaction-deleted', handleUpdate);
            window.removeEventListener('transactions-updated', handleUpdate);
        };
    }, []);

    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({
            description: tx.description,
            category: tx.category,
            emoji: tx.emoji || '',
            amount: tx.amount !== undefined ? tx.amount.toString() : ''
        });
        setShowEditEmojiPicker(false);
    };

    const handleCancelEdit = () => {
        setEditingTxId(null);
        setShowEditEmojiPicker(false);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const currentMonthBalance = useMemo(() => {
        return currentMonthIncomeTotalForDisplay - currentMonthExpenseTotalForDisplay;
    }, [currentMonthIncomeTotalForDisplay, currentMonthExpenseTotalForDisplay]);

    const projections = useMemo(() => {
        if (!editingTxId || loadingFinancialSummary || loadingGoals) {
            return { currentMonthBalanceEffect: null, totalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }
        const originalTx = allExpenseTransactions.find(tx => tx._id === editingTxId);
        if (!originalTx) {
            return { currentMonthBalanceEffect: null, totalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        const newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount)) {
             return { currentMonthBalanceEffect: null, totalCumulativeSavings: null, isValidAmount: false, goalConstraint: { applicable: false } };
        }
        
        const amountDifference = newAmount - originalAmount;
        const projectedCurrentMonthBalance = currentMonthBalance - amountDifference;
        const projectedTotalCumulativeSavings = currentCumulativeSavings - amountDifference;
        
        let goalConstraint = { applicable: false, limit: 0, goalName: '', isExceeded: false };
        if (editFormData.category.trim().toLowerCase() === GOAL_SAVINGS_CATEGORY_NAME.toLowerCase() && goals && goals.length > 0) {
            const extractedGoalName = extractGoalNameFromExpenseDescription(editFormData.description);
            if (extractedGoalName) {
                const matchedGoal = goals.find(g =>
                    g.description.trim().toLowerCase() === extractedGoalName.toLowerCase() && // Compare extracted name
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
                        goalName: matchedGoal.description, // Use the goal's actual description for display
                        isExceeded: newAmount > 0 && newAmount > remainingNeeded
                    };
                }
            }
        }
        
        return {
            currentMonthBalanceEffect: projectedCurrentMonthBalance,
            totalCumulativeSavings: projectedTotalCumulativeSavings,
            isValidAmount: newAmount > 0 && !isNaN(newAmount),
            goalConstraint
        };
    }, [
        editingTxId, editFormData.amount, editFormData.category, editFormData.description,
        allExpenseTransactions, currentCumulativeSavings, currentMonthBalance, 
        loadingFinancialSummary, loadingGoals, goals
    ]);

    const handleSaveEdit = async (txId) => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found for update."); toast.error("Authentication token not found."); return; }

        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            toast.error("Description and Category cannot be empty.");
            return;
        }
        const newAmount = parseFloat(editFormData.amount);
        if (isNaN(newAmount) || newAmount <= 0) {
            toast.error("Please enter a valid positive amount for the expense.");
            return;
        }

        if (loadingFinancialSummary || loadingGoals) {
            toast.info("Financial or goal data is still loading. Please try again shortly to save.");
            return;
        }

        const originalTx = allExpenseTransactions.find(tx => tx._id === txId);
        if (!originalTx) {
            toast.error("Original transaction not found for update.");
            setError("Update Error: Original transaction not found.");
            return;
        }

        // --- Goal Savings Category Check ---
        if (editFormData.category.trim().toLowerCase() === GOAL_SAVINGS_CATEGORY_NAME.toLowerCase()) {
            console.log("--- Goal Savings Check ---");
            console.log("Attempting to save expense under 'Goal Savings'");
            console.log("Current editFormData.category:", `"${editFormData.category.trim()}"`);
            console.log("Current editFormData.description:", `"${editFormData.description.trim()}"`);
            
            const extractedGoalName = extractGoalNameFromExpenseDescription(editFormData.description);
            console.log("Extracted Goal Name from expense description:", `"${extractedGoalName}"`);
            console.log("Current editFormData.amount (parsed as newAmount):", newAmount);
            console.log("Is goals array loaded and non-empty?", goals && goals.length > 0);
            console.log("Full goals list:", JSON.parse(JSON.stringify(goals)));

            if (!extractedGoalName) {
                toast.error(
                    `For the "${GOAL_SAVINGS_CATEGORY_NAME}" category, the expense description ` +
                    `"${editFormData.description.trim()}" does not follow the expected format: ` +
                    `"${GOAL_SAVINGS_DESCRIPTION_PREFIX}Your Goal Name".`
                );
                console.log("--- End Goal Savings Check (Description format incorrect) ---");
                return;
            }

            if (!goals || goals.length === 0) {
                toast.warn(`Expense categorized as "${GOAL_SAVINGS_CATEGORY_NAME}", but no goals are loaded/defined. Proceeding without goal-specific validation for spending limit.`);
            } else {
                const matchedGoal = goals.find(g =>
                    g.description.trim().toLowerCase() === extractedGoalName.toLowerCase() && // Match with extracted name
                    g.status === 'active'
                );

                console.log("Matched active goal (using extracted name):", matchedGoal ? JSON.parse(JSON.stringify(matchedGoal)) : null);

                if (!matchedGoal) {
                    toast.error(
                        `For the "${GOAL_SAVINGS_CATEGORY_NAME}" category, the goal name "${extractedGoalName}" ` +
                        `(extracted from description "${editFormData.description.trim()}") ` +
                        `must exactly match the description of an *active* financial goal. No such active goal found.`
                    );
                    console.log("--- End Goal Savings Check (No matched goal) ---");
                    return;
                }

                const goalTargetAmount = Number(matchedGoal.targetAmount) || 0;
                const goalSavedAmount = Number(matchedGoal.savedAmount) || 0;
                let remainingNeededForGoal = goalTargetAmount - goalSavedAmount;
                if (remainingNeededForGoal < 0) remainingNeededForGoal = 0;
                
                console.log(`Details for matched goal "${matchedGoal.description}":`);
                console.log(`  - Target Amount (numeric): ${goalTargetAmount}`);
                console.log(`  - Saved Amount (numeric): ${goalSavedAmount}`);
                console.log(`  - Calculated Remaining Needed: ${remainingNeededForGoal}`);
                console.log(`Comparing New Expense Amount (${newAmount}) > Remaining Needed (${remainingNeededForGoal}): ${newAmount > remainingNeededForGoal}`);

                if (newAmount > remainingNeededForGoal) {
                    toast.error(
                        `Expense amount ${formatCurrency(newAmount)} for goal "${matchedGoal.description}" ` +
                        `exceeds the remaining amount needed (${formatCurrency(remainingNeededForGoal)}). ` +
                        `You can spend at most ${formatCurrency(remainingNeededForGoal)} for this goal item.`
                    );
                    console.log("--- End Goal Savings Check (Amount exceeds limit) ---");
                    return;
                }
                console.log("Goal spending limit check passed.");
            }
            console.log("--- End Goal Savings Check ---");
        }
        // --- End Goal Savings Category Check ---

        if (projections.totalCumulativeSavings < 0) {
            toast.error(
                `Cannot save this expense amount (${formatCurrency(newAmount)}). Doing so ` +
                `would result in an overall negative net savings of ${formatCurrency(projections.totalCumulativeSavings)}. ` +
                `Your current total savings are ${formatCurrency(currentCumulativeSavings)}.`
            );
            return;
        }

        if (projections.currentMonthBalanceEffect < 0 && currentMonthBalance >=0 ) {
             const proceed = window.confirm(
                `Warning: This new expense amount (${formatCurrency(newAmount)}) will make your current month's balance negative (${formatCurrency(projections.currentMonthBalanceEffect)}). ` +
                `It will be covered by your total savings. Do you want to proceed?`
            );
            if (!proceed) {
                return;
            }
        } else if (newAmount > currentMonthIncomeTotalForDisplay && currentMonthIncomeTotalForDisplay >=0) {
             const proceed = window.confirm(
                `Warning: This new expense amount (${formatCurrency(newAmount)}) exceeds your total income for the current month (${formatCurrency(currentMonthIncomeTotalForDisplay)}). ` +
                `It will be covered by your total savings. Do you want to proceed?`
            );
            if (!proceed) {
                return;
            }
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
                    type: 'expense'
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }
            
            window.dispatchEvent(new CustomEvent('transactions-updated'));
            toast.success("Expense updated successfully!");
            handleCancelEdit();

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
            toast.error(`Update Error: ${err.message}`);
        }
    };

    const handleDelete = async (txId) => {
        setError(null);
        const transactionToDelete = allExpenseTransactions.find(tx => tx._id === txId);
        if (!transactionToDelete) {
            toast.error("Could not find the transaction to delete.");
            setError("Delete Error: Could not find the transaction to delete.");
            return;
        }
        
        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found for delete."); toast.error("Authentication token not found."); return; }
        
        if (!window.confirm(`Are you sure you want to delete this expense transaction of ${formatCurrency(transactionToDelete.amount)}?`)) { return; }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Deletion failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`);
            }
            window.dispatchEvent(new CustomEvent('transactions-updated', { detail: { type: 'expense', amount: transactionToDelete.amount, id: txId } }));
            toast.success('Expense Deleted Successfully!');
        } catch (err) {
            console.error("Error deleting transaction:", err);
            setError(`Delete Error: ${err.message}`);
            toast.error(`Delete Error: ${err.message}`);
        }
    };

    const chartData = allExpenseTransactions.map((tx) => ({
        dateValue: tx.date ? new Date(tx.date) : new Date(0),
        dateLabel: tx.date ? new Date(tx.date).toLocaleDateString('en-CA') : `tx_${tx._id}`,
        amount: tx.amount || 0,
        description: tx.description || "N/A"
    }))
    .sort((a, b) => a.dateValue - b.dateValue);

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Date", "Description", "Category", "Amount"];
        const tableRows = [];
        doc.setFontSize(18);
        doc.text(`Expense Transactions (Current Month) for ${username}`, 14, 22);
        allExpenseTransactions.forEach(tx => {
            tableRows.push([
                formatDate(tx.date), tx.description, tx.category, formatCurrency(tx.amount)
            ]);
        });
        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 30, theme: 'grid',
            styles: { fontSize: 10 }, headStyles: { fillColor: [220, 53, 69] }, margin: { top: 30 }
        });
        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`expense-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };

    const pageIsLoading = loading || loadingFinancialSummary || loadingGoals;
    const initialDataLoadError = error && (error.includes("Transactions:") || error.includes("Summary:") || error.includes("Auth:") || error.includes("Goals:"));

    return (
        <div className={styles.transactionsPageContainer}>
             <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Expense Overview</h1>
                    <button 
                        onClick={handleDownloadPDF} 
                        className={styles.pdfButton} 
                        style={{fontSize: '1rem'}}
                        disabled={pageIsLoading || allExpenseTransactions.length === 0 || !!initialDataLoadError}
                    >
                       Download PDF
                    </button>
                </div>
                
                {pageIsLoading && <div className={styles.dashboardPageContent}><p>Loading expense data, financial summary, and goals...</p></div>}

                {!pageIsLoading && initialDataLoadError && (
                    <div className={styles.pageErrorBanner}>
                        Error loading page data:
                        {error.split('\n').filter(e => e.trim() !== "").map((e, i) => {
                            const cleanError = e.replace(/(Transactions: |Summary: |Auth: |Goals: )/g, '');
                            return <div key={i}>{cleanError}</div>;
                        })}
                    </div>
                )}
                
                {!pageIsLoading && !initialDataLoadError && error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:')) && (
                    <p className={styles.formErrorBanner} style={{marginBottom: '1rem'}}>{error.replace(/(Update Error: |Delete Error: )/g, '')}</p>
                 )}


                 {!pageIsLoading && !initialDataLoadError && (
                    <>
                     <section className={`${styles.sectionBox} ${styles.chartSection}`}>
                         <h2 className={styles.sectionTitle}>Expense Trend by Date (Current Month)</h2>
                         <div className={styles.chartContainer}>
                             {chartData.length > 0 ? (
                                 <ResponsiveContainer width="100%" height={300}>
                                     <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                         <CartesianGrid strokeDasharray="3 3" />
                                         <XAxis dataKey="dateLabel" name="Date" />
                                         <YAxis tickFormatter={formatCurrency} width={80} />
                                         <Tooltip formatter={(value, name, props) => [formatCurrency(value), `Amount (${props.payload.description})`]}/>
                                         <Legend />
                                         <Line type="monotone" dataKey="amount" stroke="#F87171" name="Expense Amount" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                     </LineChart>
                                 </ResponsiveContainer>
                             ) : (
                                 <div className={styles.placeholderContent}>No expense data for the current month to display chart.</div>
                             )}
                         </div>
                     </section>

                     <div className={styles.mainArea}>
                         <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}>
                             <div className={styles.sectionHeader}>
                                 <h2 className={styles.sectionTitle}>Expense Transactions (Current Month)</h2>
                             </div>
                             
                             {allExpenseTransactions.length === 0 && (
                                <div className={styles.placeholderContent}>
                                    No expense transactions found for the current month.
                                </div>
                             )}
                             {allExpenseTransactions.length > 0 && (
                                 <div className={styles.transactionList}>
                                     {allExpenseTransactions.map((tx) => (
                                         <React.Fragment key={tx._id}>
                                         <div className={`${styles.transactionItem} ${styles.expenseBorder}`}>
                                             <span style={{ gridColumn: '1 / 2' }} className={styles.transactionDate}>
                                                 {formatDate(tx.date)}
                                             </span>
                                             {editingTxId === tx._id ? (
                                                 <>
                                                     <div style={{ gridColumn: '2 / 5', display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                                                         <input
                                                             type="text" name="description" value={editFormData.description}
                                                             onChange={handleEditFormChange} className={styles.formInput}
                                                             style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                             required
                                                         />
                                                         <input
                                                             type="text" name="category" value={editFormData.category}
                                                             onChange={handleEditFormChange} className={styles.formInput}
                                                             style={{ fontSize: '0.9rem', padding: '0.4rem' }}
                                                             list="expense-categories"
                                                             required
                                                         />
                                                         <datalist id="expense-categories">
                                                            <option value="Food & Drink" />
                                                            <option value="Transportation" />
                                                            <option value="Housing" />
                                                            <option value="Utilities" />
                                                            <option value="Entertainment" />
                                                            <option value={GOAL_SAVINGS_CATEGORY_NAME} /> 
                                                         </datalist>
                                                         <input
                                                             type="number" name="amount" value={editFormData.amount}
                                                             onChange={handleEditFormChange} className={styles.formInput}
                                                             style={{ fontSize: '0.9rem', padding: '0.4rem', textAlign: 'right' }}
                                                             step="0.01" min="0.01"
                                                             required
                                                         />
                                                          <div style={{ position: 'relative', justifySelf:'start' }}>
                                                            <button
                                                              type="button"
                                                              onClick={() => setShowEditEmojiPicker(prev => !prev)}
                                                              className={styles.emojiButton}
                                                              style={{fontSize: '1.2rem', padding: '0.4rem'}}
                                                              aria-label="Select icon"
                                                            >
                                                              {editFormData.emoji || '+'}
                                                            </button>
                                                            {showEditEmojiPicker && editingTxId === tx._id && (
                                                              <div className={styles.emojiPickerContainer} style={{top: '100%', left: 0, zIndex: 10}}>
                                                                <Picker
                                                                  onEmojiClick={(emojiData) => {
                                                                    setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
                                                                    setShowEditEmojiPicker(false);
                                                                  }}
                                                                  pickerStyle={{ width: '250px' }}
                                                                />
                                                              </div>
                                                            )}
                                                          </div>
                                                     </div>
                                                 </>
                                             ) : (
                                                 <>
                                                    <span style={{ gridColumn: '2 / 4' }} className={styles.transactionDesc}>
                                                        {tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}
                                                        {tx.description} ({tx.category})
                                                    </span>
                                                    <span style={{ gridColumn: '4 / 5' }} className={`${styles.transactionAmount} ${styles.expense}`}>
                                                        {'-'} {formatCurrency(tx.amount)}
                                                    </span>
                                                 </>
                                             )}
                                             <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', gridColumn: '5 / 6', alignItems: 'center' }}>
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
                                            <div className={styles.editProjections}>
                                                <p>
                                                    If saved, this month's balance will become: <strong>{formatCurrency(projections.currentMonthBalanceEffect)}</strong>
                                                </p>
                                                <p>
                                                    Your total cumulative savings will become: <strong>{formatCurrency(projections.totalCumulativeSavings)}</strong>
                                                </p>
                                                {projections.goalConstraint && projections.goalConstraint.applicable && (
                                                    <p style={projections.goalConstraint.isExceeded ? {color: 'red', fontWeight: 'bold'} : {color: 'darkgreen'}}>
                                                        For goal "<strong>{projections.goalConstraint.goalName}</strong>":
                                                        Max spend for this item is <strong>{formatCurrency(projections.goalConstraint.limit)}</strong>.
                                                        {projections.goalConstraint.isExceeded && (
                                                            <em> Current amount exceeds this limit!</em>
                                                        )}
                                                    </p>
                                                )}
                                                 {projections.totalCumulativeSavings < 0 && (
                                                    <p style={{color: 'red', fontWeight: 'bold'}}>
                                                        Warning: This change will result in overall negative savings!
                                                    </p>
                                                )}
                                                { projections.currentMonthBalanceEffect < 0 && currentMonthBalance >= 0 && (
                                                    <p style={{color: 'orange', fontWeight: 'bold'}}>
                                                        Note: This change will make your current month's balance negative.
                                                    </p>
                                                )}
                                            </div>
                                         )}
                                         </React.Fragment>
                                     ))}
                                 </div>
                             )}
                         </section>
                     </div>
                    </>
                 )}
            </div>
        </div>
    );
}

export default ExpensePage;