import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './OldTransactionsPage.module.css'; // Using your dedicated CSS file

// Reusable formatCurrency function
const formatCurrency = (value, type = null) => {
    const numValue = parseFloat(value);
    let prefix = '';
    if (type === 'income') prefix = '+ ';
    else if (type === 'expense') prefix = '- ';

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

// Helper to get YYYY-MM key for monthlyFinancialData
const formatMonthYearKey = (dateString) => {
    if (!dateString) return 'unknown-month';
    const date = new Date(dateString); // Assumes dateString is parseable
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // getUTCMonth is 0-indexed
    return `${year}-${month < 10 ? '0' + month : month}`;
};

// Helper function to format month and year for display (e.g., "January 2023")
const formatMonthYearDisplay = (dateString) => {
    if (!dateString) return "Invalid Date";
    const dateParts = dateString.split('T')[0].split('-');
    const date = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// Helper function to get the last day of the previous month in YYYY-MM-DD format
const getLastDayOfPreviousMonth = () => {
    const today = new Date();
    const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayPreviousMonth = new Date(firstDayCurrentMonth);
    lastDayPreviousMonth.setDate(0);
    return lastDayPreviousMonth.toISOString().split('T')[0];
};


function OldTransactionsPage() {
    const [oldTransactions, setOldTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');

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

    const [monthlyFinancialData, setMonthlyFinancialData] = useState({});
    const [loadingSavings, setLoadingSavings] = useState(true);

    const [editingTransactionId, setEditingTransactionId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '', amount: '', type: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);

    const maxDateForForm = useMemo(() => getLastDayOfPreviousMonth(), []);

    const fetchOldTransactions = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { setError('Please log in to view transactions.'); setLoading(false); return; }
            const response = await axios.get('/api/transactions/old', { headers: { Authorization: `Bearer ${token}` } });
            const sortedData = (response.data || []).sort((a,b) => new Date(b.date) - new Date(a.date));
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
            console.log("OldTransactionsPage detected data update, re-fetching...");
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
    }, [oldTransactions]); // formatMonthYearDisplay removed from deps as it's stable

    const sortedMonthKeys = useMemo(() => {
       return Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));
    }, [groupedTransactions]);

    const handleAddOldTransaction = async (event) => {
        event.preventDefault();
        setFormError('');
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in to add transactions."); return; }
        if (formIsSubmitting || loadingSavings) { if(loadingSavings) toast.info("Financial data is loading, please wait..."); return; }
        
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

        if (formType === 'expense') {
            const transactionMonthKey = formDate.substring(0, 7); 
            const financialDataForMonth = monthlyFinancialData[transactionMonthKey];
            const netSavingsForMonth = financialDataForMonth ? financialDataForMonth.netSavings : 0;
            
            if (transactionAmountNum > netSavingsForMonth && netSavingsForMonth >= 0) {
                const monthName = new Date(formDate + "T12:00:00Z").toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                toast.error(`Adding this expense of ${formatCurrency(transactionAmountNum)} would exceed the net savings of ${formatCurrency(netSavingsForMonth)} for ${monthName}.`);
                setFormError(`Expense (${formatCurrency(transactionAmountNum)}) would make ${monthName}'s savings negative.`);
                return;
            }
        }
        setFormIsSubmitting(true);
        const newTransactionData = { type: formType, amount: transactionAmountNum, description: formDescription.trim(), category: formCategory.trim(), emoji: formSelectedEmoji, date: formDate, recurrence: formFrequency };
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

    const handleEditClick = (transaction) => {
        setEditingTransactionId(transaction._id);
        setEditFormData({
            description: transaction.description,
            category: transaction.category,
            emoji: transaction.emoji || '',
            amount: transaction.amount.toString(),
            type: transaction.type
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
        if (!originalTx) {
            return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
        }

        const originalAmount = parseFloat(originalTx.amount) || 0;
        const txType = originalTx.type;
        const newAmountInput = editFormData.amount.trim() === '' ? '0' : editFormData.amount;
        const newAmount = parseFloat(newAmountInput);

        if (isNaN(newAmount) || newAmount < 0) { // Allow 0 for typing, but isValidAmount will be false
             return { projectedMonthNetSavings: null, projectedCumulativeAfterMonth: null, isValidAmount: false };
        }
        
        const amountDifference = newAmount - originalAmount;
        const txMonthKey = formatMonthYearKey(originalTx.date);

        const monthDataForTx = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        let currentNetSavingsForTxMonth = monthDataForTx.netSavings;
        
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0 
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;

        let projectedNetSavingsForTxMonth;
        if (txType === 'income') {
            projectedNetSavingsForTxMonth = currentNetSavingsForTxMonth + amountDifference;
        } else { // expense
            projectedNetSavingsForTxMonth = currentNetSavingsForTxMonth - amountDifference;
        }
        
        const projectedCumulativeAfterMonth = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonth;
        
        return {
            projectedMonthNetSavings: projectedNetSavingsForTxMonth,
            projectedCumulativeAfterMonth: projectedCumulativeAfterMonth,
            isValidAmount: newAmount > 0 && !isNaN(newAmount), // Valid only if positive number for projections display
        };
    }, [editingTransactionId, editFormData.amount, oldTransactions, monthlyFinancialData, loadingSavings]);


    const handleSaveEdit = async (transactionId) => {
        const token = localStorage.getItem('authToken');
        if (!token) { toast.error("You must be logged in to edit transactions."); return; }

        const originalTransaction = oldTransactions.find(tx => tx._id === transactionId);
        if (!originalTransaction) { toast.error("Original transaction not found for edit."); return; }

        if (!editFormData.description.trim() || !editFormData.category.trim()) { toast.error("Description and Category cannot be empty."); return; }
        if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) { toast.error("Please enter a valid positive amount."); return; }
        
        const newAmount = parseFloat(editFormData.amount); // Already validated positive

        if (loadingSavings) {
            toast.info("Financial data is loading, please wait to save."); return;
        }
        
        if (projections.projectedCumulativeAfterMonth < 0) {
            const txMonthForDisplay = formatMonthYearDisplay(originalTransaction.date);
            toast.error(
                `Cannot save. This change would make cumulative savings up to ${txMonthForDisplay} negative (${formatCurrency(projections.projectedCumulativeAfterMonth)}).`
            );
            return;
        }

        const updatePayload = { 
            description: editFormData.description.trim(), 
            category: editFormData.category.trim(), 
            emoji: editFormData.emoji, 
            amount: newAmount,
            // type: originalTransaction.type // Type is not changed by backend based on provided controller
        };
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
        if (loadingSavings) { toast.info("Financial data is loading, please wait to delete."); return;}

        const txMonthKey = formatMonthYearKey(txToDelete.date);
        const monthData = monthlyFinancialData[txMonthKey] || { netSavings: 0, cumulativeSavingsUpToMonth: 0 };
        let currentNetSavingsForTxMonth = monthData.netSavings;
        
        const sortedMonthKeysFromData = Object.keys(monthlyFinancialData).sort();
        const currentMonthIndex = sortedMonthKeysFromData.indexOf(txMonthKey);
        const cumulativeSavingsUpToPreviousMonth = currentMonthIndex > 0 
            ? (monthlyFinancialData[sortedMonthKeysFromData[currentMonthIndex - 1]]?.cumulativeSavingsUpToMonth || 0)
            : 0;
        
        let projectedNetSavingsForTxMonthAfterDelete;
        if (txToDelete.type === 'income') {
            projectedNetSavingsForTxMonthAfterDelete = currentNetSavingsForTxMonth - txToDelete.amount;
        } else { // expense
            projectedNetSavingsForTxMonthAfterDelete = currentNetSavingsForTxMonth + txToDelete.amount;
        }
        const projectedCumulativeAfterMonthAfterDelete = cumulativeSavingsUpToPreviousMonth + projectedNetSavingsForTxMonthAfterDelete;

        if (projectedCumulativeAfterMonthAfterDelete < 0) {
            const txMonthForDisplay = formatMonthYearDisplay(txToDelete.date);
            toast.error(
                `Cannot delete. This would make cumulative savings up to ${txMonthForDisplay} negative (${formatCurrency(projectedCumulativeAfterMonthAfterDelete)}).`
            );
            return;
        }

        if (!window.confirm(`Are you sure you want to delete this ${txToDelete.type} of ${formatCurrency(txToDelete.amount, null)}? This action cannot be undone.`)) { return; }
        
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
        oldTransactions.forEach(tx => {
            tableRows.push([
                formatDateDisplay(tx.date),
                tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
                (tx.emoji ? tx.emoji + " " : "") + tx.description,
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
        doc.save(`old-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
        toast.success("PDF of old transactions downloaded!");
    };

    const currentToken = localStorage.getItem('authToken');

    if (loading && !currentToken && error) {
      return (
        <div className={styles.container}>
          <h2>Old Transactions Management</h2> {/* Changed h2 title */}
          <p className={styles.loginPrompt}>{error}</p>
        </div>
      );
    }
    if (loading || loadingSavings) {
        return <div className={styles.container}><p>Loading data...</p></div>;
    }

    return (
        <div className={styles.container}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2>Old Transactions Management</h2>
                <div>
                    <button 
                        onClick={handleDownloadPDF} 
                        className={styles.pdfButtonOld}
                        style={{marginRight: '10px'}}
                    >
                        Download PDF
                    </button>
           
                </div>
            </div>
            

            <section className={`${styles.sectionBox} ${styles.addOldTransactionSection}`}>
                <h3 className={styles.sectionTitle}>Add a Past Transaction</h3>
                {!currentToken && <p className={styles.loginPrompt}>Please log in to add transactions.</p>}
                {currentToken && (
                  <form onSubmit={handleAddOldTransaction} className={styles.transactionForm}>
                    {formError && <p className={`${styles.formErrorBanner}`}>{formError}</p>}
                    
                    <div className={styles.formRow}> {/* ICON AND TYPE ON THE SAME ROW */}
                        <div className={styles.formGroup} style={{ flex: '0 0 70px' }}> {/* Fixed base width for icon */}
                            <label htmlFor="form-emoji">Icon:</label>
                            <div className={styles.emojiSelectorContainer}>
                                <button id="form-emoji" type="button" className={styles.emojiButton} style={{marginBottom:"20px"}} onClick={() => setFormShowEmojiPicker(!formShowEmojiPicker)} disabled={formIsSubmitting || loadingSavings}>
                                    {formSelectedEmoji ? formSelectedEmoji : '➕'}
                                </button>
                                {formShowEmojiPicker && ( <div className={styles.emojiPickerContainer}><Picker onEmojiClick={(emojiData) => { setFormSelectedEmoji(emojiData.emoji); setFormShowEmojiPicker(false); }} /></div> )}
                            </div>
                        </div>
                        <div className={styles.formGroup} style={{ flex: '1' }}> {/* Type takes remaining space */}
                            <label htmlFor="form-type">Type:</label>
                            <select id="form-type" value={formType} onChange={(e) => setFormType(e.target.value)} required className={styles.formInput} disabled={formIsSubmitting || loadingSavings}>
                                <option value="expense">Expense</option><option value="income">Income</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.formGroup}> {/* DATE ON ITS OWN LINE */}
                        <label htmlFor="form-date">Date (Past Months Only):</label>
                        <input type="date" id="form-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={styles.formInput} max={maxDateForForm} disabled={formIsSubmitting || loadingSavings} />
                    </div>

                    <div className={styles.formGroup}> {/* AMOUNT ON ITS OWN LINE */}
                        <label htmlFor="form-amount">Amount:</label>
                        <input type="number" id="form-amount" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" required step="0.01" min="0.01" className={styles.formInput} disabled={formIsSubmitting || loadingSavings} />
                    </div>

                    <div className={styles.formGroup}> {/* DESCRIPTION ON ITS OWN LINE */}
                        <label htmlFor="form-description">Description:</label>
                        <input type="text" id="form-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g., Old bill" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings} autoComplete="off" />
                    </div>
                    
                    <div className={styles.formGroup}> {/* CATEGORY ON ITS OWN LINE */}
                        <label htmlFor="form-category">Category:</label>
                        <input type="text" id="form-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="e.g., Utilities" required className={styles.formInput} disabled={formIsSubmitting || loadingSavings}/>
                    </div>

                    <div className={styles.formGroup}> {/* FREQUENCY ON ITS OWN LINE */}
                        <label htmlFor="form-frequency">Frequency:</label>
                        <select id="form-frequency" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} required className={styles.formInput} disabled={formIsSubmitting || loadingSavings}>
                            <option value="once">One-time</option>
                        </select>
                    </div>

                    <button type="submit" className={styles.submitButtonWide} disabled={formIsSubmitting || loadingSavings}>
                        {formIsSubmitting ? 'Adding...' : (loadingSavings ? 'Loading Data...' : 'Add Past Transaction')}
                    </button>
                  </form>
                )}
            </section>

            <section className={`${styles.sectionBox} ${styles.displayOldTransactionsSection}`}>
                <h3 className={styles.sectionTitle}>Transaction History (Older than Current Month)</h3>
                { !error && !currentToken && <p className={styles.loginPrompt}>Please log in to view and manage transactions.</p>}
                { error && !loading && <p className={`${styles.pageErrorBanner}`}>{error.split('\n').map((e,i) => <span key={i}>{e.replace(/(Transactions: |Summary: |Auth: )/g, '')}<br/></span>)}</p>}

                { !loading && !error && currentToken && (
                    sortedMonthKeys.length > 0 ? (
                        sortedMonthKeys.map(monthYearDisplayKey => (
                            <div key={monthYearDisplayKey} className={styles.monthGroup}>
                                <h4 className={styles.monthHeading}>{monthYearDisplayKey}</h4>
                                <div className={styles.transactionList}>
                                    {groupedTransactions[monthYearDisplayKey].map(transaction => (
                                      <React.Fragment key={transaction._id}>
                                        <div className={`${styles.transactionItemOldPage} ${styles[transaction.type]}`}>
                                            <div className={styles.dateAndEmoji}> {/* Column 1: Date + Emoji (if not editing) */}
                                                <span className={styles.transactionDateDisplay}>{formatDateDisplay(transaction.date)}</span>
                                                {editingTransactionId !== transaction._id && transaction.emoji && 
                                                    <span className={styles.transactionEmoji}>{transaction.emoji}</span>}
                                            </div>

                                            {editingTransactionId === transaction._id ? (
                                                // Column 2: Edit form (spans details and amount visually)
                                                <div className={styles.editFormContainerOld}> 
                                                    <input type="text" name="description" value={editFormData.description} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Description" />
                                                    <input type="text" name="category" value={editFormData.category} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Category" />
                                                    <input type="number" name="amount" value={editFormData.amount} onChange={handleEditFormChange} className={styles.editInputOld} placeholder="Amount" step="0.01" min="0.01" />
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
                                                </div>
                                            ) : (
                                                // Column 2: Details
                                                <span className={styles.transactionDetailsOld}>
                                                    {/* Emoji is with Date now, or add here if preferred: {transaction.emoji && <span className={styles.transactionEmoji}>{transaction.emoji}</span>} */}
                                                    {transaction.description} ({transaction.category})
                                                </span>
                                            )}
                                            
                                            {/* Column 3: Amount (only in display mode, part of edit form otherwise) */}
                                            {editingTransactionId !== transaction._id && (
                                                <span className={`${styles.transactionAmountOld} ${transaction.type === 'income' ? styles.incomeOld : styles.expenseOld}`}>
                                                    {formatCurrency(transaction.amount, transaction.type)}
                                                </span>
                                            )}
                                            {/* If editing, this column might be empty or used by the edit form's last input */}
                                            {editingTransactionId === transaction._id && (
                                                <span className={styles.transactionAmountOld} style={{visibility: 'hidden'}}> {/* Placeholder to maintain grid structure */}
                                                    {formatCurrency(0)}
                                                </span>
                                            )}


                                            {/* Column 4: Action Buttons */}
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
                    ) : ( <p>No transactions found for previous months.</p> )
                )}
                 { !loading && !error && !currentToken && <p className={styles.loginPrompt}>Log in to manage past financial records.</p>}
            </section>
        </div>
    );
}

export default OldTransactionsPage;