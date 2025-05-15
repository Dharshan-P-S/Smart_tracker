import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link } from 'react-router-dom'; // Link is unused, consider removing if not needed elsewhere
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Picker from 'emoji-picker-react'; // Import Picker
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import icons

// Import the SAME CSS module used by Dashboard
import styles from './Dashboard.module.css';

// Reusable formatCurrency function
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Helper function to format date string
const formatDate = (dateString) => {
     // Add check for invalid date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

function ExpensePage() {
    const [allExpenseTransactions, setAllExpenseTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');
    const [currentBalance, setCurrentBalance] = useState(null); // Keep track of balance for validation (though not needed for expense delete)

    // --- State for Editing ---
    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false); // State for edit picker visibility

    // --- Fetch Transactions ---
    const fetchAllTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");
            const response = await fetch('/api/transactions/current-month/expense', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }
            const expenseData = await response.json();
            expenseData.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending
            setAllExpenseTransactions(expenseData);
            setError(null);
        } catch (err) {
            console.error("Error fetching transactions for Expense page:", err);
            setError(err.message || 'Failed to fetch transactions.');
            setAllExpenseTransactions([]);
        } finally {
            setLoading(false);
        }
    };

     // --- Fetch Balance (Optional - can be removed if not needed for expense page logic) ---
    const fetchBalance = async () => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            // Don't necessarily set error, might just not display balance info
            // setError("Authentication token not found for balance check.");
            return null;
        }
        try {
            const response = await fetch('/api/transactions/dashboard', {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 // Don't throw page-level error for balance fetch failure here
                 console.error(`HTTP error fetching balance! status: ${response.status}. ${errorText}`);
                 return null;
            }
            const data = await response.json();
            const balance = (data.totalIncome || 0) - (data.totalExpense || 0);
            setCurrentBalance(balance);
            return balance;
        } catch (err) {
             console.error("Error fetching balance for Expense page:", err);
             // Don't set page-level error
             // setError(err.message || 'Failed to fetch current balance.');
             setCurrentBalance(null);
             return null;
        }
    };

    // --- Effects ---
    useEffect(() => {
        fetchAllTransactions();
        fetchBalance(); // Fetch initial balance (optional)
    }, []); // Initial fetch

    useEffect(() => {
        const handleUpdate = () => {
            console.log("ExpensePage received update event, re-fetching...");
            fetchAllTransactions();
            fetchBalance(); // Re-fetch balance on any transaction update (optional)
        };
        // Listen to multiple events
        window.addEventListener('expense-updated', handleUpdate); // Less common, but maybe useful
        window.addEventListener('transaction-deleted', handleUpdate);
        window.addEventListener('transactions-updated', handleUpdate); // General update from dashboard

        return () => {
            window.removeEventListener('expense-updated', handleUpdate);
            window.removeEventListener('transaction-deleted', handleUpdate);
            window.removeEventListener('transactions-updated', handleUpdate);
        };
    }, []); // Listener setup runs once

    // --- Edit Handlers ---
    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({ description: tx.description, category: tx.category, emoji: tx.emoji || '' });
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

    const handleSaveEdit = async (txId) => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found."); return; }
        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            toast.error("Description and Category cannot be empty."); return;
        }

        const originalTx = allExpenseTransactions.find(tx => tx._id === txId);
         if (!originalTx) { setError("Original transaction not found for update."); return;}

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    description: editFormData.description.trim(),
                    category: editFormData.category.trim(),
                    emoji: editFormData.emoji,
                    // IMPORTANT: Send original amount and type if backend needs them for validation/updates
                    // amount: originalTx.amount,
                    // type: originalTx.type
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }

            setAllExpenseTransactions(prevTxs =>
                prevTxs.map(tx =>
                    tx._id === txId ? { ...tx,
                       description: editFormData.description.trim(),
                       category: editFormData.category.trim(),
                       emoji: editFormData.emoji
                      } : tx
                )
            );
            fetchBalance(); // Refetch balance (optional)
            handleCancelEdit();

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
        }
    };

    // --- Delete Handler ---
    const handleDelete = async (txId) => {
        setError(null);

        const transactionToDelete = allExpenseTransactions.find(tx => tx._id === txId);
        if (!transactionToDelete) { setError("Could not find the transaction to delete."); return; }
        const transactionAmount = transactionToDelete.amount;

        // No balance check needed for deleting expenses

        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found."); return; }
        if (!window.confirm("Are you sure you want to delete this expense transaction?")) { return; }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Deletion failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`);
            }

            setAllExpenseTransactions(prevTxs => prevTxs.filter(tx => tx._id !== txId));
            // Update balance state locally (add back the expense amount)
            setCurrentBalance(prevBalance => prevBalance !== null ? prevBalance + transactionAmount : null);
            // Notify other components
            window.dispatchEvent(new CustomEvent('transaction-deleted', { detail: { type: 'expense', amount: transactionAmount, id: txId } }));
             // Dispatch general update too
             window.dispatchEvent(new CustomEvent('transactions-updated'));

        } catch (err) {
            console.error("Error deleting transaction:", err);
            setError(`Delete Error: ${err.message}`);
        }
    };

    // --- Chart Data Prep ---
    const chartData = allExpenseTransactions.map((tx) => ({
        dateValue: tx.date ? new Date(tx.date) : new Date(0),
        dateLabel: tx.date ? new Date(tx.date).toLocaleDateString('en-CA') : `tx_${tx._id}`, // Use ID for unique key
        amount: tx.amount,
        description: tx.description
    }))
    .sort((a, b) => a.dateValue - b.dateValue); // Sort ascending for chart

    // --- PDF Download Handler ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Date", "Description", "Category", "Amount"];
        const tableRows = [];
        doc.setFontSize(18);
        doc.text(`Expense Transactions for ${username}`, 14, 22);
        // Use sorted transactions if needed for PDF consistency
        [...allExpenseTransactions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(tx => {
            tableRows.push([
                formatDate(tx.date), tx.description, tx.category, formatCurrency(tx.amount)
            ]);
        });
        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 30, theme: 'grid',
            styles: { fontSize: 10 }, headStyles: { fillColor: [220, 53, 69] }, margin: { top: 30 } // Red header
        });
        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);
        doc.save(`expense-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };

    // --- Loading/Error States ---
    if (loading) {
        return <div className={styles.dashboardPageContent}><p>Loading expense data...</p></div>;
    }
    if (error && !error.startsWith('Update Error:') && !error.startsWith('Delete Error:')) {
        return <div className={styles.dashboardPageContent}><p style={{ color: 'red' }}>Error: {error}</p></div>;
    }

    // --- Component Render ---
    return (
        <div className={styles.transactionsPageContainer}>
             <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Expense Overview</h1>
                    <button onClick={handleDownloadPDF} className={styles.pdfButton} style={{fontSize: '1rem'}}>
                       Download PDF
                    </button>
                </div>

                {/* Line Chart Section */}
                 <section className={`${styles.sectionBox} ${styles.chartSection}`}>
                     <h2 className={styles.sectionTitle}>Expense Trend by Date</h2>
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
                             <div className={styles.placeholderContent}>No expense data available to display chart.</div>
                         )}
                     </div>
                 </section>

                 <div className={styles.mainArea}>
                     {/* All Expense Transactions Section */}
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}>
                         <div className={styles.sectionHeader}>
                             <h2 className={styles.sectionTitle}>Expense Transactions (Current Month)</h2>
                         </div>
                         {(error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:'))) && (
                           <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
                         )}
                         {allExpenseTransactions.length > 0 ? (
                             <div className={styles.transactionList}>
                                 {allExpenseTransactions.map((tx) => (
                                     <div
                                         key={tx._id}
                                         className={`${styles.transactionItem} ${styles.expenseBorder}`}
                                     >
                                         {/* Date */}
                                         <span style={{ gridColumn: '1 / 2' }} className={styles.transactionDate}>
                                             {formatDate(tx.date)}
                                         </span>

                                         {editingTxId === tx._id ? (
                                            <>
                                                {/* Edit Inputs */}
                                                <input
                                                    type="text" name="description" value={editFormData.description}
                                                    onChange={handleEditFormChange} className={styles.formInput}
                                                    style={{ gridColumn: '2 / 3', fontSize: '0.9rem', padding: '0.4rem' }}
                                                    required
                                                />
                                                <input
                                                    type="text" name="category" value={editFormData.category}
                                                    onChange={handleEditFormChange} className={styles.formInput}
                                                    style={{ gridColumn: '3 / 4', fontSize: '0.9rem', padding: '0.4rem' }}
                                                    required
                                                />
                                                 {/* Edit Emoji Picker Button and Container */}
                                                 <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3', marginTop: '0.5rem', position: 'relative', justifySelf:'start' }}>
                                                   <button
                                                     type="button"
                                                     onClick={() => setShowEditEmojiPicker(prev => !prev)} // Toggle only this picker
                                                     // ****** APPLY THE CSS CLASS HERE ******
                                                     className={styles.emojiButton}
                                                     // ************************************
                                                     style={{fontSize: '1.2rem', padding: '0.4rem'}} // Keep inline style overrides if needed
                                                     aria-label="Select icon"
                                                   >
                                                     {editFormData.emoji || '+'} {/* Default emoji */}
                                                   </button>
                                                   {showEditEmojiPicker && editingTxId === tx._id && ( // Show only if this row is editing AND picker toggled
                                                     <div className={styles.emojiPickerContainer} style={{top: '100%', left: 0, right: 'auto'}}>
                                                       <Picker
                                                         onEmojiClick={(emojiData) => { // Renamed param
                                                           setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
                                                           setShowEditEmojiPicker(false); // Close picker on selection
                                                         }}
                                                         pickerStyle={{ width: '100%' }}
                                                       />
                                                     </div>
                                                   )}
                                                 </div>
                                            </>
                                         ) : (
                                            // Display Text
                                             <span style={{ gridColumn: '2 / 4' }} className={styles.transactionDesc}>
                                                 {tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}
                                                 {tx.description} ({tx.category})
                                             </span>
                                         )}

                                         {/* Amount */}
                                         <span style={{ gridColumn: '4 / 5' }} className={`${styles.transactionAmount} ${styles.expense}`}>
                                             {'-'} {formatCurrency(tx.amount)}
                                         </span>

                                         {/* Action Buttons */}
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
                                 ))}
                             </div>
                         ) : (
                             <div className={styles.placeholderContent}>
                                 No expense transactions found for the current month.
                             </div>
                         )}
                     </section>
                 </div>
            </div>
        </div>
    );
}

export default ExpensePage;
