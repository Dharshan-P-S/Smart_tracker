import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import { Link } from 'react-router-dom'; // Link is unused, can be removed if not used
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Picker from 'emoji-picker-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaEdit, FaTrash } from 'react-icons/fa';
import axios from 'axios'; // Using axios as per previous versions

import styles from './Dashboard.module.css'; // Assuming this CSS module is shared and styled appropriately

// Reusable formatCurrency function
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        // Assuming USD as per your ProfilePage.js example context
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Helper function to format date string
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
    const [allIncomeTransactions, setAllIncomeTransactions] = useState([]); // For current month's income display
    const [loading, setLoading] = useState(true); // For loading income transactions list
    const [error, setError] = useState(null);
    const [username, setUsername] = useState(() => localStorage.getItem('username') || 'User');
    
    // State for financial summary (all-time figures for validation)
    // currentCumulativeSavings will be (All Time Income - All Time Expenses)
    const [currentCumulativeSavings, setCurrentCumulativeSavings] = useState(0);
    const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(true);

    // State for Editing
    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '', emoji: '' });
    const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);

    // Fetches ONLY current month's income transactions for display
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
            incomeData.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending for display
            setAllIncomeTransactions(incomeData);
        } catch (err) {
            console.error("Error fetching transactions for Income page:", err);
            setError(prev => prev ? `${prev}\nTransactions: ${err.message}` : `Transactions: ${err.message}`);
            setAllIncomeTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetches data to calculate ALL-TIME cumulative savings
    const fetchFinancialSummary = async () => {
        setLoadingFinancialSummary(true);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError(prev => prev ? `${prev}\nAuth: Authentication token not found for summary.` : `Auth: Authentication token not found for summary.`);
            setLoadingFinancialSummary(false);
            return;
        }

        try {
            // Fetch monthly savings (each item is net saving for that month)
            const savingsResponse = await axios.get('/api/transactions/savings/monthly', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const fetchedMonthlyNetSavings = savingsResponse.data || [];

            // Calculate total cumulative savings by summing up net savings of each month
            const calculatedTotalCumulativeSavings = fetchedMonthlyNetSavings.reduce(
                (sum, monthData) => sum + (monthData.savings || 0), 
                0
            );
            setCurrentCumulativeSavings(calculatedTotalCumulativeSavings);

        } catch (err) {
             console.error("Error fetching financial summary for Income page:", err);
             const errMsg = err.response?.data?.message || err.message || "Failed to fetch financial summary.";
             setError(prev => prev ? `${prev}\nSummary: ${errMsg}` : `Summary: ${errMsg}`);
             setCurrentCumulativeSavings(0); // Default to 0 on error
        } finally {
            setLoadingFinancialSummary(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        setError(null); // Clear errors on mount
        fetchAllTransactions();
        fetchFinancialSummary();
    }, []);

    // Event listener for updates from other components
    useEffect(() => {
        const handleUpdate = () => {
            console.log("IncomePage received update event, re-fetching...");
            setError(null); // Clear previous errors before refetch
            fetchAllTransactions();
            fetchFinancialSummary();
        };
        window.addEventListener('income-updated', handleUpdate);
        window.addEventListener('transaction-deleted', handleUpdate);
        window.addEventListener('transactions-updated', handleUpdate); // General update

        return () => {
            window.removeEventListener('income-updated', handleUpdate);
            window.removeEventListener('transaction-deleted', handleUpdate);
            window.removeEventListener('transactions-updated', handleUpdate);
        };
    }, []);

    // --- Edit Handlers ---
    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({ description: tx.description, category: tx.category, emoji: tx.emoji || '' });
        setShowEditEmojiPicker(false); // Close picker when starting edit
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
        setError(null); // Clear specific update errors
        const token = localStorage.getItem('authToken');
        if (!token) { setError("Authentication token not found for update."); toast.error("Authentication token not found."); return; }
        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            toast.error("Description and Category cannot be empty."); return;
        }

        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ // Only send fields that can be edited
                    description: editFormData.description.trim(),
                    category: editFormData.category.trim(),
                    emoji: editFormData.emoji,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }
            
            // Let useEffect handle data refetch for consistency after event dispatch
            window.dispatchEvent(new CustomEvent('income-updated')); // Or 'transactions-updated'
            toast.success("Income updated successfully!");
            handleCancelEdit(); // Exit editing mode

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`); // Display error near the list
            toast.error(`Update Error: ${err.message}`);
        }
    };

    // --- Delete Handler ---
    const handleDelete = async (txId) => {
        setError(null); // Clear specific delete errors

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

        // currentCumulativeSavings represents: (All Historical Income - All Historical Expenses)
        // If we remove an income, this net value decreases.
        const projectedNewOverallNetSavings = currentCumulativeSavings - incomeAmountToDecrease;

        // Primary Validation:
        // If deleting this income makes your overall net financial position (all-time savings) negative, block it.
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
        if (projectedNewOverallNetSavings < currentCumulativeSavings) { // Check if it actually reduces savings
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

            // Let useEffect handle data refetch for consistency
            window.dispatchEvent(new CustomEvent('transaction-deleted', { detail: { type: 'income', amount: incomeAmountToDecrease, id: txId } }));
            window.dispatchEvent(new CustomEvent('transactions-updated')); // General update to refresh Dashboard etc.

            toast.success('Income Deleted Successfully!');

        } catch (err) {
            console.error("Error deleting transaction:", err);
            setError(`Delete Error: ${err.message}`); // Display error near list
            toast.error(`Delete Error: ${err.message}`);
        }
    };

    // --- Chart Data Prep (uses allIncomeTransactions which is current month's income) ---
    const chartData = allIncomeTransactions.map((tx) => ({
        dateValue: tx.date ? new Date(tx.date) : new Date(0), // Handle potentially missing date for robustness
        dateLabel: tx.date ? new Date(tx.date).toLocaleDateString('en-CA') : `tx_${tx._id}`, // Use ID if date missing
        amount: tx.amount || 0, // Default to 0 if amount missing
        description: tx.description || "N/A"
    }))
    .sort((a, b) => a.dateValue - b.dateValue); // Sort ascending for chart

    // --- PDF Download Handler ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Date", "Description", "Category", "Amount"];
        const tableRows = [];
        doc.setFontSize(18);
        doc.text(`Income Transactions (Current Month) for ${username}`, 14, 22);
        // Use displayed (and sorted) transactions for PDF
        allIncomeTransactions.forEach(tx => { // allIncomeTransactions is already sorted descending by date
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

    // Combined loading state for the page
    const pageIsLoading = loading || loadingFinancialSummary;

    if (pageIsLoading) {
        return <div className={styles.dashboardPageContent}><p>Loading income data and financial summary...</p></div>;
    }
    
    // Consolidate general page load errors (not action-specific ones like Update/Delete)
    const pageLoadError = error && (error.includes("Transactions:") || error.includes("Summary:") || error.includes("Auth:"));

    return (
        <div className={styles.transactionsPageContainer}> {/* Main container for the whole page */}
             <div className={styles.dashboardPageContent}> {/* Inner container matching Dashboard's structure */}
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Income Overview</h1>
                    <button onClick={handleDownloadPDF} className={styles.pdfButton} style={{fontSize: '1rem'}}>
                       Download PDF
                    </button>
                </div>
                
                {/* Display general page load errors */}
                {pageLoadError &&
                    <div className={styles.pageErrorBanner}>
                        Error loading page data:
                        {error.split('\n').map((e, i) => <div key={i}>{e.replace(/(Transactions: |Summary: |Auth: )/g, '')}</div>)}
                    </div>
                }

                 {/* Bar Chart Section - Displays current month's income */}
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

                 {/* All Income Transactions Section - Displays current month's income */}
                 <div className={styles.mainArea}> {/* This div might be for layout, ensure it's used consistently */}
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}>
                         <div className={styles.sectionHeader}>
                             <h2 className={styles.sectionTitle}>Income Transactions (Current Month)</h2>
                         </div>
                          {/* Display action-specific errors (Update/Delete) */}
                          {(error && (error.startsWith('Update Error:') || error.startsWith('Delete Error:'))) && (
                           <p className={styles.formErrorBanner} style={{marginBottom: '1rem'}}>{error}</p>
                         )}
                         {/* Show "no transactions" only if not loading and no page load error */}
                         {!loading && !pageLoadError && allIncomeTransactions.length === 0 && (
                            <div className={styles.placeholderContent}>
                                No income transactions found for the current month.
                            </div>
                         )}
                         {/* Show transaction list only if not loading, no page load error, and transactions exist */}
                         {!loading && !pageLoadError && allIncomeTransactions.length > 0 && (
                             <div className={styles.transactionList}>
                                 {allIncomeTransactions.map((tx) => (
                                     <div
                                         key={tx._id}
                                         className={`${styles.transactionItem} ${styles.incomeBorder}`} // Assuming you have specific grid styling here
                                     >
                                         {/* Date */}
                                         <span style={{ gridColumn: '1 / 2' }} className={styles.transactionDate}>
                                             {formatDate(tx.date)}
                                         </span>

                                         {editingTxId === tx._id ? (
                                             <> {/* Edit Mode Inputs */}
                                                 <input
                                                     type="text" name="description" value={editFormData.description}
                                                     onChange={handleEditFormChange} className={styles.formInput}
                                                     style={{ gridColumn: '2 / 3', fontSize: '0.9rem', padding: '0.4rem' }} // Example inline style, prefer class
                                                     required
                                                 />
                                                 <input
                                                     type="text" name="category" value={editFormData.category}
                                                     onChange={handleEditFormChange} className={styles.formInput}
                                                     style={{ gridColumn: '3 / 4', fontSize: '0.9rem', padding: '0.4rem' }} // Example inline style
                                                     required
                                                 />
                                                  {/* Edit Emoji Picker */}
                                                  <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3', marginTop: '0.5rem', position: 'relative', justifySelf:'start' }}>
                                                    <button
                                                      type="button"
                                                      onClick={() => setShowEditEmojiPicker(prev => !prev)}
                                                      className={styles.emojiButton} // Use existing class
                                                      style={{fontSize: '1.2rem', padding: '0.4rem'}} // Inline style from original
                                                      aria-label="Select icon"
                                                    >
                                                      {editFormData.emoji || '+'}
                                                    </button>
                                                    {showEditEmojiPicker && editingTxId === tx._id && (
                                                      <div className={styles.emojiPickerContainer} style={{top: '100%', left: 0, right: 'auto', zIndex: 10}}> {/* Positional styles */}
                                                        <Picker
                                                          onEmojiClick={(emojiData) => {
                                                            setEditFormData(prev => ({ ...prev, emoji: emojiData.emoji }));
                                                            setShowEditEmojiPicker(false);
                                                          }}
                                                          pickerStyle={{ width: '100%' }} // From original
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                             </>
                                         ) : (
                                             // Display Mode Text
                                             <span style={{ gridColumn: '2 / 4' }} className={styles.transactionDesc}>
                                                 {tx.emoji && <span className={styles.transactionEmoji}>{tx.emoji}</span>}
                                                 {tx.description} ({tx.category})
                                             </span>
                                         )}

                                         {/* Amount */}
                                         <span style={{ gridColumn: '4 / 5' }} className={`${styles.transactionAmount} ${styles.income}`}>
                                             {'+'} {formatCurrency(tx.amount)}
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
                         )}
                     </section>
                 </div> {/* End of mainArea */}
            </div> {/* End of dashboardPageContent */}
        </div> /* End of transactionsPageContainer */
    );
}

export default IncomePage;