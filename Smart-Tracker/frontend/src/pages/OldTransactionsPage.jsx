import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import Picker from 'emoji-picker-react';
import styles from './OldTransactionsPage.module.css';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';

const getLastDayOfPreviousMonth = () => {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayPreviousMonth = new Date(firstDayCurrentMonth);
    lastDayPreviousMonth.setDate(0);
    const year = lastDayPreviousMonth.getFullYear();
    const month = lastDayPreviousMonth.getMonth() + 1;
    const day = lastDayPreviousMonth.getDate();
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedDay = day < 10 ? `0${day}` : day;
    return `${year}-${formattedMonth}-${formattedDay}`;
};

const formatDateDisplay = (dateString) => {
    const date = new Date(dateString);
    const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    if (isNaN(localDate.getTime())) { return 'Invalid Date'; }
    return localDate.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const OldTransactionsPage = () => {
    const [oldTransactions, setOldTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [formType, setFormType] = useState('expense');
    const [formAmount, setFormAmount] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formCategory, setFormCategory] = useState(''); // User types this manually
    const [formSelectedEmoji, setFormSelectedEmoji] = useState('');
    const [formShowEmojiPicker, setFormShowEmojiPicker] = useState(false);
    const [formDate, setFormDate] = useState(getLastDayOfPreviousMonth());
    const [formFrequency, setFormFrequency] = useState('once');
    const [formIsSubmitting, setFormIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    // const [allCategories, setAllCategories] = useState([]); // REMOVED - No longer fetching

    const [monthlySavings, setMonthlySavings] = useState({});
    const [loadingSavings, setLoadingSavings] = useState(true);

    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '', type: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    const maxDateForForm = useMemo(() => getLastDayOfPreviousMonth(), []);

    const formatMonthYearDisplay = (dateString) => {
        const date = new Date(dateString);
        const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        return localDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const fetchOldTransactions = async () => {
        try {
            setLoading(true); setError('');
            const token = localStorage.getItem('token');
            if (!token) { setError('Please log in to view transactions.'); setLoading(false); return; }
            const response = await axios.get('/api/transactions/old', { headers: { Authorization: `Bearer ${token}` } });
            setOldTransactions(response.data);
        } catch (err) {
            console.error("Error fetching old transactions:", err);
            const errorMessage = err.response?.data?.message || 'Failed to load old transactions. Please try again later.';
            setError(errorMessage);
            if (err.response && err.response.status === 401) { setError('Unauthorized. Please log in again.'); }
        } finally { setLoading(false); }
    };

    const fetchMonthlySavings = async () => {
        try {
            setLoadingSavings(true);
            const token = localStorage.getItem('token');
            if (!token) { setLoadingSavings(false); return; }
            const response = await axios.get('/api/transactions/savings/monthly', { headers: { Authorization: `Bearer ${token}` } });
            const savingsData = response.data.reduce((acc, item) => { acc[item.month] = item.savings; return acc; }, {});
            setMonthlySavings(savingsData);
        } catch (err) {
            console.error("Error fetching monthly savings:", err);
            toast.warn("Could not load monthly savings data. Expense validation might be affected.");
        } finally { setLoadingSavings(false); }
    };

    // REMOVED fetchAllCategories function

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchOldTransactions();
            fetchMonthlySavings();
        } else {
            setError("Please log in to view transactions.");
            setLoading(false);
            setLoadingSavings(false);
        }
        // No longer calling fetchAllCategories
    }, []);

    const groupedTransactions = useMemo(() => {
        return oldTransactions.reduce((acc, transaction) => {
            const monthYearKey = formatMonthYearDisplay(transaction.date);
            if (!acc[monthYearKey]) { acc[monthYearKey] = []; }
            acc[monthYearKey].push(transaction);
            return acc;
        }, {});
    }, [oldTransactions]);

    const sortedMonthKeys = useMemo(() => {
       return Object.keys(groupedTransactions).sort((a, b) => {
           const dateA = new Date(`01 ${a}`); const dateB = new Date(`01 ${b}`);
           return dateB - dateA;
       });
    }, [groupedTransactions]);

    const handleAddOldTransaction = async (event) => {
        event.preventDefault();
        setFormError('');
        const token = localStorage.getItem('token');
        if (!token) { toast.error("You must be logged in to add transactions."); return; }
        if (formIsSubmitting || loadingSavings) { if(loadingSavings) toast.info("Savings data is loading, please wait..."); return; }
        if (!formDate) { toast.error("Please select a date."); setFormError("Please select a date."); return; }
        if (formDate > maxDateForForm) { toast.error(`Date cannot be in the current or a future month. Max allowed date is ${maxDateForForm}.`); setFormError(`Date cannot be in the current or a future month. Max allowed date is ${maxDateForForm}.`); return; }
        if (!formAmount || parseFloat(formAmount) <= 0) { toast.error("Please enter a valid positive amount."); setFormError("Please enter a valid positive amount."); return; }
        const transactionAmountNum = parseFloat(formAmount);
        if (!formDescription.trim()) { toast.error("Please enter a description."); setFormError("Please enter a description."); return; }
        if (!formCategory.trim()) { toast.error("Please enter a category."); setFormError("Please enter a category."); return; } // Still validate if it's entered

        if (formType === 'expense') {
            const transactionMonthYear = formDate.substring(0, 7);
            const savingsForMonth = monthlySavings[transactionMonthYear] === undefined ? 0 : monthlySavings[transactionMonthYear];
            if (transactionAmountNum > savingsForMonth) {
                const monthName = new Date(formDate + "T00:00:00").toLocaleString('default', { month: 'long', year: 'numeric' });
                toast.error(`Adding this expense of $${transactionAmountNum.toFixed(2)} would exceed the savings of $${savingsForMonth.toFixed(2)} for ${monthName}.`);
                setFormError(`Expense ($${transactionAmountNum.toFixed(2)}) exceeds savings ($${savingsForMonth.toFixed(2)}) for ${monthName}.`);
                return;
            }
        }
        setFormIsSubmitting(true);
        const newTransactionData = { type: formType, amount: transactionAmountNum, description: formDescription.trim(), category: formCategory.trim(), emoji: formSelectedEmoji, date: formDate, recurrence: formFrequency, };
        try {
            await axios.post('/api/transactions', newTransactionData, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Old transaction added successfully!");
            setFormType('expense'); setFormAmount(''); setFormDescription(''); setFormCategory(''); setFormSelectedEmoji(''); setFormDate(getLastDayOfPreviousMonth()); setFormFrequency('once'); setFormShowEmojiPicker(false);
            fetchOldTransactions(); fetchMonthlySavings();
            // No need to update allCategories state
        } catch (err) {
            console.error("Error adding old transaction:", err);
            const message = err.response?.data?.message || "Failed to add transaction.";
            toast.error(message); setFormError(message);
        } finally { setFormIsSubmitting(false); }
    };

    const handleEditClick = (transaction) => {
        setEditingTransactionId(transaction._id);
        setEditFormData({
            description: transaction.description,
            category: transaction.category, // Category is still part of edit form
            emoji: transaction.emoji || '',
            amount: transaction.amount.toString(),
            type: transaction.type
        });
        setShowEditEmojiPicker(null);
    };

    const handleCancelEdit = () => { setEditingTransactionId(null); setShowEditEmojiPicker(null); };
    const handleEditFormChange = (e) => { const { name, value } = e.target; setEditFormData(prev => ({ ...prev, [name]: value })); };

    const handleSaveEdit = async (transactionId) => {
        const token = localStorage.getItem('token');
        if (!token) { toast.error("You must be logged in to edit transactions."); return; }
        const originalTransaction = oldTransactions.find(tx => tx._id === transactionId);
        if (!originalTransaction) { toast.error("Original transaction not found for edit."); return; }
        if (!editFormData.description.trim() || !editFormData.category.trim()) { toast.error("Description and Category cannot be empty."); return; } // Still validate if category input is empty
        if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) { toast.error("Please enter a valid positive amount."); return; }
        const newAmount = parseFloat(editFormData.amount);

        if (editFormData.type === 'expense') {
            const transactionDate = originalTransaction.date;
            const transactionMonthYear = transactionDate.substring(0, 7);
            let currentSavingsForMonth = monthlySavings[transactionMonthYear] === undefined ? 0 : monthlySavings[transactionMonthYear];
            let savingsWithoutOriginalTx = currentSavingsForMonth;
            if (originalTransaction.type === 'expense') { savingsWithoutOriginalTx += originalTransaction.amount; }
            else if (originalTransaction.type === 'income') { savingsWithoutOriginalTx -= originalTransaction.amount; }
            if (newAmount > savingsWithoutOriginalTx) {
                 const monthName = new Date(transactionDate + "T00:00:00").toLocaleString('default', { month: 'long', year: 'numeric' });
                 toast.error(`Editing this expense to $${newAmount.toFixed(2)} would exceed available funds for ${monthName}.`);
                 return;
            }
        }
        const updatePayload = { description: editFormData.description.trim(), category: editFormData.category.trim(), emoji: editFormData.emoji, amount: newAmount, };
        try {
            const response = await axios.put(`/api/transactions/${transactionId}`, updatePayload, { headers: { Authorization: `Bearer ${token}` } });
            setOldTransactions(prev => prev.map(tx => tx._id === transactionId ? response.data : tx));
            toast.success("Transaction updated successfully!");
            handleCancelEdit();
            if (newAmount !== originalTransaction.amount || editFormData.type !== originalTransaction.type) { fetchMonthlySavings(); }
        } catch (err) {
            console.error("Error updating transaction:", err);
            toast.error(err.response?.data?.message || "Failed to update transaction.");
        }
    };

    const handleDeleteTransaction = async (transactionId) => {
        const token = localStorage.getItem('token');
        if (!token) { toast.error("You must be logged in to delete transactions."); return; }
        if (!window.confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) { return; }
        try {
            await axios.delete(`/api/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } });
            setOldTransactions(prev => prev.filter(tx => tx._id !== transactionId));
            toast.success("Transaction deleted successfully!");
            fetchMonthlySavings(); 
        } catch (err) {
            console.error("Error deleting transaction:", err);
            toast.error(err.response?.data?.message || "Failed to delete transaction.");
        }
    };

    const currentToken = localStorage.getItem('token');

    return (
        <div className={styles.container}>
            <h2>Old Transactions</h2>

            <section className={`${styles.sectionBox} ${styles.addOldTransactionSection}`}>
                <h3 className={styles.sectionTitle}>Add a Past Transaction</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to add transactions.</p>}
                <form onSubmit={handleAddOldTransaction} className={styles.transactionForm}>
                    {formError && <p className={`${styles.formError}`}>{formError}</p>}
                    {/* ... Form groups ... */}
                    <div className={styles.formGroup}>
                        <label htmlFor="form-emoji">Icon:</label>
                        <div className={styles.emojiSelectorContainer}>
                            <button id="form-emoji" type="button" className={styles.emojiButton} onClick={() => setFormShowEmojiPicker(!formShowEmojiPicker)} disabled={!currentToken || formIsSubmitting || loadingSavings}>
                                {formSelectedEmoji ? formSelectedEmoji : '➕'}
                            </button>
                            {formShowEmojiPicker && ( <div className={styles.emojiPickerContainer}><Picker onEmojiClick={(emojiData) => { setFormSelectedEmoji(emojiData.emoji); setFormShowEmojiPicker(false); }} /></div> )}
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-type">Type:</label>
                        <select id="form-type" value={formType} onChange={(e) => setFormType(e.target.value)} required className={styles.formInput} disabled={!currentToken || formIsSubmitting || loadingSavings}>
                            <option value="expense">Expense</option><option value="income">Income</option>
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-date">Date:</label>
                        <input type="date" id="form-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={styles.formInput} max={maxDateForForm} disabled={!currentToken || formIsSubmitting || loadingSavings} />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-amount">Amount:</label>
                        <input type="number" id="form-amount" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={!currentToken || formIsSubmitting || loadingSavings} />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-description">Description:</label>
                        <input type="text" id="form-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g., Old bill, Past income" required className={styles.formInput} disabled={!currentToken || formIsSubmitting || loadingSavings} autoComplete="off" />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-category">Category:</label>
                        <input
                            type="text"
                            id="form-category"
                            value={formCategory}
                            onChange={(e) => setFormCategory(e.target.value)}
                            placeholder="e.g., Utilities, Old Salary"
                            required
                            className={styles.formInput}
                            disabled={!currentToken || formIsSubmitting || loadingSavings}
                            // REMOVED: list="form-category-suggestions"
                        />
                        {/* REMOVED: <datalist id="form-category-suggestions">...</datalist> */}
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="form-frequency">Frequency:</label>
                        <select id="form-frequency" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} required className={styles.formInput} disabled={!currentToken || formIsSubmitting || loadingSavings}>
                            <option value="once">One-time</option><option value="daily">Daily (Informational)</option><option value="weekly">Weekly (Informational)</option><option value="monthly">Monthly (Informational)</option>
                        </select>
                    </div>
                    <button type="submit" className={styles.submitButton} disabled={!currentToken || formIsSubmitting || loadingSavings}>
                        {formIsSubmitting ? 'Adding...' : (loadingSavings ? 'Loading Savings...' : 'Add Past Transaction')}
                    </button>
                </form>
            </section>

            <section className={`${styles.sectionBox} ${styles.displayOldTransactionsSection}`}>
                <h3 className={styles.sectionTitle}>Transaction History</h3>
                { (loading && !currentToken && !error) && <p className={styles.loginPrompt}>Please log in to view transactions.</p> }
                { (loading && currentToken) && <p>Loading transactions...</p>}
                { !loading && error && <p className={`${styles.pageError}`}>{error}</p>}
                { !loading && !error && currentToken && (
                    sortedMonthKeys.length > 0 ? (
                        sortedMonthKeys.map(monthYearKey => (
                            <div key={monthYearKey} className={styles.monthGroup}>
                                <h3 className={styles.monthHeading}>{monthYearKey}</h3>
                                <ul className={styles.transactionList}>
                                    {groupedTransactions[monthYearKey].map(transaction => (
                                        <li key={transaction._id} className={`${styles.transactionItem} ${styles[transaction.type]}`}>
                                            {editingTransactionId === transaction._id ? (
                                                <>
                                                    <span className={styles.transactionDateDisplay}>{formatDateDisplay(transaction.date)}</span>
                                                    <div className={styles.editInputsContainer}>
                                                        <input type="text" name="description" value={editFormData.description} onChange={handleEditFormChange} className={styles.editInput} placeholder="Description" />
                                                        <input
                                                            type="text" name="category" value={editFormData.category}
                                                            onChange={handleEditFormChange} className={styles.editInput}
                                                            placeholder="Category"
                                                            // REMOVED: list="form-category-suggestions"
                                                        />
                                                        <input type="number" name="amount" value={editFormData.amount} onChange={handleEditFormChange} className={styles.editInput} placeholder="Amount" step="0.01" min="0.01" disabled={editFormData.type === 'income'} />
                                                         <div className={styles.editEmojiContainer}>
                                                            <button type="button" className={styles.emojiButtonSmall} onClick={() => setShowEditEmojiPicker(prev => prev === transaction._id ? null : transaction._id)}> {editFormData.emoji || '✏️'} </button>
                                                            {showEditEmojiPicker === transaction._id && ( <div className={styles.editEmojiPicker}><Picker onEmojiClick={(emojiData) => { setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji })); setShowEditEmojiPicker(null); }} /></div> )}
                                                        </div>
                                                    </div>
                                                    <span className={styles.transactionTypeStatic}>{editFormData.type}</span>
                                                    <div className={styles.actionButtons}>
                                                        <button onClick={() => handleSaveEdit(transaction._id)} className={`${styles.actionButton} ${styles.saveButton}`} title="Save"><FaSave /></button>
                                                        <button onClick={handleCancelEdit} className={`${styles.actionButton} ${styles.cancelButton}`} title="Cancel"><FaTimes /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <span className={styles.transactionDateDisplay}>{formatDateDisplay(transaction.date)}</span>
                                                    <span className={styles.transactionDetails}> {transaction.emoji && <span className={styles.transactionEmoji}>{transaction.emoji}</span>} {transaction.description} ({transaction.category}) </span>
                                                    <span className={styles.transactionAmount}>{transaction.type === 'expense' ? '-' : ''}${transaction.amount.toFixed(2)}</span>
                                                    <div className={styles.actionButtons}>
                                                        <button onClick={() => handleEditClick(transaction)} className={`${styles.actionButton} ${styles.editButton}`} title="Edit"><FaEdit /></button>
                                                        <button onClick={() => handleDeleteTransaction(transaction._id)} className={`${styles.actionButton} ${styles.deleteButton}`} title="Delete"><FaTrash /></button>
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    ) : ( <p>No old transactions found.</p> )
                )}
                 { !loading && !error && !currentToken && <p className={styles.loginPrompt}>Please log in to view and manage transactions.</p>}
            </section>
        </div>
    );
};

export default OldTransactionsPage;