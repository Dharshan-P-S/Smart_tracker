import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Picker from 'emoji-picker-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaEdit, FaTrash } from 'react-icons/fa';
import axios from 'axios';

import styles from './IncomePage.module.css';

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

function IncomePage() {
    const [allIncomeTransactions, setAllIncomeTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');
    
    // Overall financial summary
    const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0); // All-time net savings
    const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);

    // Current month's specific financial summary (for projection display)
    const [currentMonthIncomeTotalForDisplay, setCurrentMonthIncomeTotalForDisplay] = useState(0);
    const [currentMonthExpenseTotalForDisplay, setCurrentMonthExpenseTotalForDisplay] = useState(0);

    // Editing state
    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);

    // Fetches ONLY current month's income transactions for display in the list
    const fetchAllTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found for transactions.");
            const response = await fetch('/api/transactions/current-month/income', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Fetching income list: ${response.status} ${errorText.substring(0,100)}`);
            }
            const incomeData = await response.json();
            incomeData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAllIncomeTransactions(incomeData);
        } catch (err) {
            console.error("Error fetching transactions for Income page:", err);
            setError(prev => prev ? `${prev}\nTransactions: ${err.message}` : `Transactions: ${err.message}`);
            setAllIncomeTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetches data for ALL-TIME cumulative savings AND CURRENT MONTH's income/expense totals
    const fetchFinancialSummary = async () => {
        setLoadingFinancialSummary(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Authentication token not found for summary.` : `Auth: Authentication token not found for summary.`);
            setLoadingFinancialSummary(false);
            return;
        }
        try {
            // 1. Fetch ALL-TIME cumulative savings (from monthly net savings)
            const savingsResponse = await axios.get('/api/transactions/savings/monthly', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const fetchedMonthlyNetSavings = savingsResponse.data || [];
            const calculatedTotalCumulativeSavings = fetchedMonthlyNetSavings.reduce(
                (sum, monthData) => sum + (monthData.savings || 0), 0
            );
            setCurrentCumulativeSavings(calculatedTotalCumulativeSavings);

            // 2. Fetch CURRENT MONTH's income and expense totals (from dashboard endpoint)
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
             console.error("Error fetching financial summary for Income page:", err);
             const errMsg = err.response?.data?.message || err.message || "Failed to fetch financial summary.";
             setError(prev => prev ? `${prev}\nSummary: ${errMsg}` : `Summary: ${errMsg}`);
             setCurrentCumulativeSavings(0);
             setCurrentMonthIncomeTotalForDisplay(0);
             setCurrentMonthExpenseTotalForDisplay(0);
        } finally {
            setLoadingFinancialSummary(false);
        }
    };

    useEffect(() => {
        setError(null);
        fetchAllTransactions();
        fetchFinancialSummary();
    }, []);

    useEffect(() => {
        const handleUpdate = () => {
            console.log("IncomePage received update event, re-fetching...");
            setError(null);
            fetchAllTransactions();
            fetchFinancialSummary();
        };
        window.addEventListener('income-updated', handleUpdate);
        window.addEventListener('transaction-deleted', handleUpdate);
        window.addEventListener('transactions-updated', handleUpdate);
        return () => {
            window.removeEventListener('income-updated', handleUpdate);
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

    // --- Calculate projections for display using useMemo ---
    const projections = useMemo(() => {
        if (!editingTxId || loadingFinancialSummary) {
            return { currentMonthSavings: null, totalCumulativeSavings: null };
        }

        const originalTx = allIncomeTransactions.find(tx => tx._id === editingTxId);
        if (!originalTx) {
            return { currentMonthSavings: null, totalCumulativeSavings: null };
        }

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const newAmount = parseFloat(editFormData.amount) || 0; // Use 0 if amount is empty or invalid for projection
        const amountDifference = newAmount - originalAmount;

        // Projected Current Month's Savings:
        // (Current Month Income + Change due to edit) - Current Month Expense
        const projectedCurrentMonthSavings = (currentMonthIncomeTotalForDisplay + amountDifference) - currentMonthExpenseTotalForDisplay;

        // Projected Total Cumulative Savings:
        // Current Total Savings + Change due to edit
        const projectedTotalCumulativeSavings = currentCumulativeSavings + amountDifference;
        
        return {
            currentMonthSavings: projectedCurrentMonthSavings,
            totalCumulativeSavings: projectedTotalCumulativeSavings,
            isValidAmount: newAmount > 0 // Check if the entered new amount is valid for display
        };
    }, [editingTxId, editFormData.amount, allIncomeTransactions, currentCumulativeSavings, currentMonthIncomeTotalForDisplay, currentMonthExpenseTotalForDisplay, loadingFinancialSummary]);


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
            toast.error("Please enter a valid positive amount.");
            return;
        }

        if (loadingFinancialSummary) { // Redundant check if projections are used, but good for safety
            toast.info("Financial summary is still loading. Please try again shortly to save.");
            return;
        }
        
        // Use the calculated projection for validation (already available from useMemo)
        if (projections.totalCumulativeSavings < 0) {
            toast.error(
                `Cannot save this amount (${formatCurrency(newAmount)}). Doing so ` +
                `would result in an overall negative net savings of ${formatCurrency(projections.totalCumulativeSavings)}. ` +
                `Your current total savings are ${formatCurrency(currentCumulativeSavings)}.`
            );
            return;
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
                    type: 'income' 
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }
            
            window.dispatchEvent(new CustomEvent('income-updated'));
            toast.success("Income updated successfully!");
            handleCancelEdit();

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
            toast.error(`Update Error: ${err.message}`);
        }
    };

    const handleDelete = async (txId) => {
        // ... (handleDelete logic remains the same as your last verified version)
        setError(null);
        const transactionToDelete = allIncomeTransactions.find(tx => tx._id === txId);
        if (!transactionToDelete) {
            toast.error("Could not find the transaction to delete.");
            setError("Delete Error: Could not find the transaction to delete.");
            return;
        }
        const incomeAmountToDecrease = transactionToDelete.amount;
        if (loadingFinancialSummary) {
            toast.info("Financial summary is still loading. Please try again shortly to delete.");
            return;
        }
        const projectedNewOverallNetSavings = currentCumulativeSavings - incomeAmountToDecrease;
        if (projectedNewOverallNetSavings < 0) {
            toast.error(
                `Cannot delete this income of ${formatCurrency(incomeAmountToDecrease)}. Doing so ` +
                `would result in an overall negative net savings of ${formatCurrency(projectedNewOverallNetSavings)}. ` +
                `This implies your total lifetime expenses would exceed your total lifetime income.`
            );
            return;
        }
        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found for delete."); toast.error("Authentication token not found."); return; }
        let confirmMessage = `Are you sure you want to delete this income transaction of ${formatCurrency(incomeAmountToDecrease)}?`;
        if (projectedNewOverallNetSavings < currentCumulativeSavings) {
            confirmMessage += ` Your overall net savings will be reduced to ${formatCurrency(projectedNewOverallNetSavings)}.`;
        }
        if (!window.confirm(confirmMessage)) { return; }
        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Deletion failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`);
            }
            window.dispatchEvent(new CustomEvent('transaction-deleted', { detail: { type: 'income', amount: incomeAmountToDecrease, id: txId } }));
            window.dispatchEvent(new CustomEvent('transactions-updated'));
            toast.success('Income Deleted Successfully!');
        } catch (err) {
            console.error("Error deleting transaction:", err);
            setError(`Delete Error: ${err.message}`);
            toast.error(`Delete Error: ${err.message}`);
        }
    };

    const chartData = allIncomeTransactions.map((tx) => ({
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
        doc.text(`Income Transactions (Current Month) for ${username}`, 14, 22);
        allIncomeTransactions.forEach(tx => {
            tableRows.push([
                formatDate(tx.date), tx.description, tx.category, formatCurrency(tx.amount)
            ]);
        });
        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 30, theme: 'grid',
            styles: { fontSize: 10 }, headStyles: { fillColor: [22, 160, 133] }, margin: { top: 30 }
        });
        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`income-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };

    const pageIsLoading = loading || loadingFinancialSummary;

    if (pageIsLoading) {
        return <div className={styles.dashboardPageContent}><p>Loading income data and financial summary...</p></div>;
    }
    
    const pageLoadError = error && (error.includes("Transactions:") || error.includes("Summary:") || error.includes("Auth:"));

    return (
        <div className={styles.transactionsPageContainer}>
             <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Income Overview</h1>
                    <button onClick={handleDownloadPDF} className={styles.pdfButton} style={{fontSize: '1rem'}}>
                       Download PDF
                    </button>
                </div>
                
                {pageLoadError &&
                    <div className={styles.pageErrorBanner}>
                        Error loading page data:
                        {error.split('\n').map((e, i) => <div key={i}>{e.replace(/(Transactions: |Summary: |Auth: )/g, '')}</div>)}
                    </div>
                }

                 <section className={`${styles.sectionBox} ${styles.chartSection}`}>
                     <h2 className={styles.sectionTitle}>Income Trend by Date (Current Month)</h2>
                     <div className={styles.chartContainer}>
                         {chartData.length > 0 ? (
                             <ResponsiveContainer width="100%" height={300}>
                                 <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" />
                                     <XAxis dataKey="dateLabel" name="Date" />
                                     <YAxis tickFormatter={formatCurrency} width={80} />
                                     <Tooltip formatter={(value, name, props) => [formatCurrency(value), `Amount (${props.payload.description})`]}/>
                                     <Legend />
                                     <Bar dataKey="amount" fill="#34D399" name="Income Amount" barSize={30} radius={[4, 4, 0, 0]}/>
                                 </BarChart>
                             </ResponsiveContainer>
                         ) : (
                             <div className={styles.placeholderContent}>No income data for the current month to display chart.</div>
                         )}
                     </div>
                 </section>

                 <div className={styles.mainArea}>
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}>
                         <div className={styles.sectionHeader}>
                             <h2 className={styles.sectionTitle}>Income Transactions (Current Month)</h2>
                         </div>
                          {(error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:'))) && (
                           <p className={styles.formErrorBanner} style={{marginBottom: '1rem'}}>{error}</p>
                         )}
                         {!loading && !pageLoadError && allIncomeTransactions.length === 0 && (
                            <div className={styles.placeholderContent}>
                                No income transactions found for the current month.
                            </div>
                         )}
                         {!loading && !pageLoadError && allIncomeTransactions.length > 0 && (
                             <div className={styles.transactionList}>
                                 {allIncomeTransactions.map((tx) => (
                                     <React.Fragment key={tx._id}> {/* Use Fragment for key */}
                                     <div
                                         className={`${styles.transactionItem} ${styles.incomeBorder}`}
                                     >
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
                                                         required
                                                     />
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
                                                <span style={{ gridColumn: '4 / 5' }} className={`${styles.transactionAmount} ${styles.income}`}>
                                                    {'+'} {formatCurrency(tx.amount)}
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
                                     {/* Display Projections when editing this transaction */}
                                     {editingTxId === tx._id && projections.isValidAmount && (
                                        <div className={styles.editProjections}>
                                            <p>
                                                If saved, this month's savings will become: <strong>{formatCurrency(projections.currentMonthSavings)}</strong>
                                            </p>
                                            <p>
                                                Your total cumulative savings will become: <strong>{formatCurrency(projections.totalCumulativeSavings)}</strong>
                                            </p>
                                             {projections.totalCumulativeSavings < 0 && (
                                                <p style={{color: 'red', fontWeight: 'bold'}}>
                                                    Warning: This change will result in overall negative savings!
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
            </div>
        </div>
    );
}

export default IncomePage;