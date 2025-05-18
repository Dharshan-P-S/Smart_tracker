import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Ensure this is imported (or globally in App.js)
import { FaEdit, FaTrash } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import styles from './Dashboard.module.css'; // Reusing dashboard styles

// Reusable formatCurrency function
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Reusable formatDate function
const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- State for Editing ---
    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null); // Stores tx._id of active picker or null

    // --- State for Balance (for deletion validation) ---
    const [currentBalance, setCurrentBalance] = useState(null);

    // --- Fetch Balance ---
    const fetchBalance = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn("Authentication token not found for balance check.");
            setCurrentBalance(null); // Explicitly set to null if no token
            return null;
        }
        try {
            const response = await fetch('/api/transactions/dashboard', {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 const errorText = await response.text();
                 console.error(`HTTP error fetching balance! status: ${response.status}. ${errorText}`);
                 setCurrentBalance(null); // Set to null on error
                 return null;
            }
            const data = await response.json();
            const balance = (data.totalIncome || 0) - (data.totalExpense || 0);
            setCurrentBalance(balance);
            return balance;
        } catch (err) {
             console.error("Error fetching balance for Transactions page:", err);
             setCurrentBalance(null); // Set to null on catch
             return null;
        }
    }, []); // No dependencies, so it's stable

    // --- Fetch All Transactions ---
    const fetchAllTransactions = useCallback(async (isRetry = false) => {
        if (!isRetry) setLoading(true); // Only full loading on initial fetch
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication token not found. Please log in to view transactions.");
            setTransactions([]);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/transactions/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }

            const data = await response.json();
            const sortedData = (data || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sortedData);

        } catch (err) {
            console.error("Error fetching all transactions:", err);
            setError(err.message || 'Failed to fetch transactions.');
            setTransactions([]);
        } finally {
            if (!isRetry) setLoading(false);
        }
    }, []); // Stable function


    useEffect(() => {
        fetchAllTransactions();
        fetchBalance();
    }, [fetchAllTransactions, fetchBalance]); // Initial fetch

    // --- Effect for listening to external updates ---
    useEffect(() => {
        const handleExternalUpdate = (event) => {
            console.log("TransactionsPage received an update event, re-fetching...", event.type);
            fetchAllTransactions(true); // Pass true to indicate it's a retry/refresh
            fetchBalance();
        };

        window.addEventListener('transactions-updated', handleExternalUpdate);
        window.addEventListener('transaction-deleted', handleExternalUpdate);

        return () => {
            window.removeEventListener('transactions-updated', handleExternalUpdate);
            window.removeEventListener('transaction-deleted', handleExternalUpdate);
        };
    }, [fetchAllTransactions, fetchBalance]);


    // --- Edit Handlers ---
    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({ description: tx.description, category: tx.category, emoji: tx.emoji || '' });
        setShowEditEmojiPicker(null); // Close any open picker
    };

    const handleCancelEdit = () => {
        setEditingTxId(null);
        setShowEditEmojiPicker(null);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async (txId) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            toast.error("Authentication token not found. Please log in.");
            return;
        }
        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            toast.error("Description and Category cannot be empty.");
            return;
        }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description: editFormData.description.trim(),
                    category: editFormData.category.trim(),
                    emoji: editFormData.emoji,
                    // Backend should preserve amount, type, date if not sent
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }
            const updatedTxData = await response.json();

            setTransactions(prevTxs =>
                prevTxs.map(tx =>
                    tx._id === txId ? { ...tx, ...updatedTxData.transaction } : tx
                )
            );
            toast.success("Transaction updated successfully!");
            handleCancelEdit();
            fetchBalance(); // Balance might be affected if categories influence summaries elsewhere
            window.dispatchEvent(new CustomEvent('transactions-updated', { detail: { type: 'any', id: txId } }));

        } catch (err) {
            console.error("Error updating transaction:", err);
            toast.error(`Update Error: ${err.message}`);
        }
    };

    // --- Delete Handler ---
    const handleDelete = async (txId) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            toast.error("Authentication token not found. Please log in.");
            return;
        }

        const transactionToDelete = transactions.find(tx => tx._id === txId);
        if (!transactionToDelete) {
            toast.error("Could not find the transaction to delete.");
            return;
        }
        const { amount, type } = transactionToDelete;

        // Balance Check for INCOME deletion
        if (type === 'income') {
            const fetchedBalance = await fetchBalance(); // Fetch fresh balance
            if (fetchedBalance === null) { // Check if balance fetch failed
                toast.error("Could not verify balance. Deletion aborted.");
                return;
            }
            if ((fetchedBalance - amount) < 0) {
                toast.error(`Cannot delete this income. Deleting ${formatCurrency(amount)} would result in a negative balance (${formatCurrency(fetchedBalance - amount)}).`);
                return;
            }
        }

        if (!window.confirm(`Are you sure you want to delete this ${type} transaction? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Deletion failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to delete transaction: ${response.statusText}`);
            }

            setTransactions(prevTxs => prevTxs.filter(tx => tx._id !== txId));

            // Update balance state locally
            if (type === 'income' && currentBalance !== null) {
                setCurrentBalance(prevBalance => prevBalance - amount);
            } else if (type === 'expense' && currentBalance !== null) {
                setCurrentBalance(prevBalance => prevBalance + amount);
            } else {
                fetchBalance(); // Refetch if currentBalance was null or for safety
            }

            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} transaction deleted successfully!`);
            window.dispatchEvent(new CustomEvent('transaction-deleted', { detail: { type, amount, id: txId } }));
            window.dispatchEvent(new CustomEvent('transactions-updated', { detail: { type: 'any', id: txId } })); // General update

        } catch (err) {
            console.error("Error deleting transaction:", err);
            toast.error(`Delete Error: ${err.message}`);
        }
    };

    return (
        <div className={styles.transactionsPageContainer}>
            <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>All Transactions</h1>
                   <Link to="/dashboard" className={styles.seeAllButton} style={{fontSize: '1rem'}}>Back to Dashboard</Link>
                </div>

                {loading && <div className={styles.placeholderContent}>Loading transactions...</div>}
                {error && !loading && <div className={styles.errorBanner}>Error: {error}</div>}

                {!loading && !error && (
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`}>
                        {transactions.length > 0 ? (
                            <div className={styles.transactionList} style={{borderTop: 'none'}}>
                                {transactions.map((tx) => (
                                    <div
                                        key={tx._id}
                                        className={`${styles.transactionItem} ${ // Ensure transactionItem in CSS is a grid
                                            tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder
                                        }`}
                                        // Add inline styles for grid layout - ideally move to CSS
                                        // style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto auto', alignItems: 'center', gap: '0.5rem 1rem' }}
                                    >
                                        {/* Date: Column 1, Row 1 */}
                                        <span className={styles.transactionDate} style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}>
                                            {formatDate(tx.date)}
                                        </span>

                                        {editingTxId === tx._id ? (
                                            <>
                                                {/* Edit Inputs: Description (Col 2, Row 1), Category (Col 3, Row 1) */}
                                                <input
                                                    type="text" name="description" value={editFormData.description}
                                                    onChange={handleEditFormChange} className={styles.formInput}
                                                    style={{ gridColumn: '2 / 3', gridRow: '1 / 2', fontSize: '0.9rem', padding: '0.4rem' }}
                                                    placeholder="Description"
                                                    required
                                                />
                                                <input
                                                    type="text" name="category" value={editFormData.category}
                                                    onChange={handleEditFormChange} className={styles.formInput}
                                                    style={{ gridColumn: '3 / 4', gridRow: '1 / 2', fontSize: '0.9rem', padding: '0.4rem' }}
                                                    placeholder="Category"
                                                    required
                                                />
                                                {/* Emoji Picker Button: Col 1, Row 2 (below date) */}
                                                <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3', marginTop: '0.5rem', position: 'relative', justifySelf:'start' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEditEmojiPicker(prev => prev === tx._id ? null : tx._id)}
                                                        className={styles.emojiButton} // Use existing styles.emojiButton
                                                        style={{fontSize: '1.2rem', padding: '0.4rem'}}
                                                        aria-label="Select icon"
                                                    >
                                                        {editFormData.emoji || '🙂'} {/* Default/Current emoji */}
                                                    </button>
                                                    {showEditEmojiPicker === tx._id && (
                                                        <div className={styles.emojiPickerContainer} style={{top: '100%', left: 0, zIndex: 10, position: 'absolute', minWidth: '280px'}}>
                                                            <Picker
                                                                onEmojiClick={(emojiData) => {
                                                                    setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
                                                                    setShowEditEmojiPicker(null); // Close picker
                                                                }}
                                                                pickerStyle={{ width: '100%' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            // Display Text: Description, Category, Emoji (Col 2-3, Row 1)
                                            <span className={styles.transactionDesc} style={{ gridColumn: '2 / 4', gridRow: '1 / 2' }}>
                                                {tx.emoji && <span className={styles.transactionEmoji} style={{marginRight: '0.5em'}}>{tx.emoji}</span>}
                                                {tx.description} ({tx.category})
                                            </span>
                                        )}

                                        {/* Amount: Column 4, Row 1 */}
                                        <span
                                            className={`${styles.transactionAmount} ${tx.type === 'income' ? styles.income : styles.expense}`}
                                            style={{ gridColumn: '4 / 5', gridRow: '1 / 2', justifySelf: 'end' }}
                                        >
                                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                        </span>

                                        {/* Action Buttons: Column 5, Row 1 (and Row 2 if editing for alignment) */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '0.5rem',
                                            justifyContent: 'flex-end',
                                            gridColumn: '5 / 6',
                                            gridRow: editingTxId === tx._id ? '1 / span 2' : '1 / 2', // Span rows if edit form is active
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