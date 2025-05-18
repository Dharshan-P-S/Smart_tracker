import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEdit, FaTrash } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import jsPDF from 'jspdf'; // Import jsPDF
import autoTable from 'jspdf-autotable'; // Import jspdf-autotable
import styles from './Dashboard.module.css';

const formatCurrency = (value, type) => { // Added type parameter
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


function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User'); // For PDF title

    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0);
    const [currentMonthIncomeTotal, setCurrentMonthIncomeTotal] = useState(0);
    const [currentMonthExpenseTotal, setCurrentMonthExpenseTotal] = useState(0);
    const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);


    const fetchFinancialSummary = useCallback(async () => {
        setLoadingFinancialSummary(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Token not found for summary.` : `Auth: Token not found for summary.`);
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


    useEffect(() => {
        setError(null);
        fetchAllTransactions();
        fetchFinancialSummary();
    }, [fetchAllTransactions, fetchFinancialSummary]);

    useEffect(() => {
        const handleExternalUpdate = (event) => {
            console.log("TransactionsPage received an update event, re-fetching...", event.type);
            setError(null);
            fetchAllTransactions(true); 
            fetchFinancialSummary();
        };
        window.addEventListener('transactions-updated', handleExternalUpdate);
        return () => {
            window.removeEventListener('transactions-updated', handleExternalUpdate);
        };
    }, [fetchAllTransactions, fetchFinancialSummary]);

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
        if (!editingTxId || loadingFinancialSummary) {
            return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false };
        }
        const originalTx = transactions.find(tx => tx._id === editingTxId);
        if (!originalTx) {
            return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false };
        }

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const txType = originalTx.type;
        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        const newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount)) {
             return { projectedCurrentMonthBalance: null, projectedTotalCumulativeSavings: null, isValidAmount: false };
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
        
        return {
            projectedCurrentMonthBalance: isDateInCurrentMonth(originalTx.date) ? projectedCurrentMonthBalance : null,
            projectedTotalCumulativeSavings: projectedTotalCumulativeSavings,
            isValidAmount: newAmount > 0 && !isNaN(newAmount),
            txType: txType,
            isCurrentMonthTx: isDateInCurrentMonth(originalTx.date)
        };
    }, [editingTxId, editFormData.amount, transactions, currentCumulativeSavings, currentMonthNetBalance, loadingFinancialSummary]);


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

        if (loadingFinancialSummary) {
            toast.info("Financial summary is still loading. Please try again."); return;
        }

        const originalTx = transactions.find(tx => tx._id === txId);
        if (!originalTx) {
            toast.error("Original transaction not found."); setError("Update Error: Original transaction not found."); return;
        }
        
        if (projections.projectedTotalCumulativeSavings < 0) {
            toast.error(
                `Cannot save. This change would result in an overall negative net savings of ${formatCurrency(projections.projectedTotalCumulativeSavings)}.` + // No type here
                ` Current total savings: ${formatCurrency(currentCumulativeSavings)}.`
            );
            return;
        }

        if (projections.isCurrentMonthTx && projections.projectedCurrentMonthBalance < 0 && currentMonthNetBalance >=0) {
            const proceed = window.confirm(
                `Warning: This change will make your current month's balance negative (${formatCurrency(projections.projectedCurrentMonthBalance, null)}). ` + // No type here
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

        if (loadingFinancialSummary) {
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
                `would result in an overall negative net savings of ${formatCurrency(projectedNewOverallNetSavings, null)}.` // No type for net savings
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

    // --- PDF Download Handler for ALL Transactions ---
    const handleDownloadAllPDF = () => {
        if (transactions.length === 0) {
            toast.info("No transactions to download.");
            return;
        }
        const doc = new jsPDF();
        const tableColumn = ["Date", "Type", "Description", "Category", "Amount"];
        const tableRows = [];

        doc.setFontSize(18);
        doc.text(`All Transactions for ${username}`, 14, 22);

        // Use the current 'transactions' state which is already sorted by date descending
        transactions.forEach(tx => {
            tableRows.push([
                formatDate(tx.date),
                tx.type.charAt(0).toUpperCase() + tx.type.slice(1), // Capitalize type
                tx.description,
                tx.category,
                formatCurrency(tx.amount, tx.type) // Pass type for +/- prefix
            ]);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, // Example: Blue header
            columnStyles: {
                4: { halign: 'right' } // Align amount column to the right
            },
            didDrawCell: (data) => { // Optional: Custom styling for income/expense rows
                if (data.section === 'body') {
                    const txType = transactions[data.row.index]?.type;
                    if (txType === 'income') {
                        doc.setFillColor(232, 245, 233); // Light green for income rows (optional)
                    } else if (txType === 'expense') {
                        doc.setFillColor(253, 237, 237); // Light red for expense rows (optional)
                    }
                }
            }
        });

        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`all-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };


    const pageIsLoading = loading || loadingFinancialSummary;

    if (pageIsLoading) {
        return <div className={styles.dashboardPageContent}><p>Loading transactions and financial summary...</p></div>;
    }
    
    const pageLoadError = error && (error.includes("Transactions List:") || error.includes("Summary:") || error.includes("Auth:"));

    return (
        <div className={styles.transactionsPageContainer}>
            <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>All Transactions</h1>
                   <div> {/* Wrapper for buttons */}
                       <button 
                           onClick={handleDownloadAllPDF} 
                           className={styles.pdfButton} // Use existing or new specific class
                           style={{fontSize: '1rem', marginRight: '1rem'}} // Add margin if needed
                       >
                           Download All PDF
                       </button>
                       <Link to="/dashboard" className={styles.seeAllButton} style={{fontSize: '1rem'}}>Back to Dashboard</Link>
                   </div>
                </div>

                {pageLoadError && 
                    <div className={styles.pageErrorBanner}>
                        Error loading page data:
                        {error.split('\n').map((e, i) => <div key={i}>{e.replace(/(Transactions List: |Summary: |Auth: )/g, '')}</div>)}
                    </div>
                }
                {(error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:'))) && (
                    <p className={styles.formErrorBanner} style={{marginBottom: '1rem'}}>{error}</p>
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
                                                        placeholder="Category" required
                                                    />
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
                                                          {editFormData.emoji || '🙂'}
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
                                                {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount, null)} {/* Pass null for type for basic formatting */}
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
                                                    If saved, this month's balance will become: <strong>{formatCurrency(projections.projectedCurrentMonthBalance, null)}</strong> {/* No type for balance */}
                                                </p>
                                            )}
                                            <p>
                                                Your total cumulative savings will become: <strong>{formatCurrency(projections.projectedTotalCumulativeSavings, null)}</strong> {/* No type for net savings */}
                                            </p>
                                             {projections.projectedTotalCumulativeSavings < 0 && (
                                                <p style={{color: 'red', fontWeight: 'bold'}}>
                                                    Warning: This change will result in overall negative savings!
                                                </p>
                                            )}
                                            {projections.isCurrentMonthTx && projections.projectedCurrentMonthBalance < 0 && currentMonthNetBalance >= 0 && (
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
    );
}

export default TransactionsPage;