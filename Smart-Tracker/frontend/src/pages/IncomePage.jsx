import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

function IncomePage() {
    const [allIncomeTransactions, setAllIncomeTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [username, setUsername] = useState('CurrentUser'); // Placeholder

    // --- State for Editing ---
    const [editingTxId, setEditingTxId] = useState(null);
    const [editFormData, setEditFormData] = useState({ description: '', category: '' });

    // --- Fetch Transactions Effect ---
    const fetchAllTransactions = async () => {
        setLoading(true); // Set loading true at the start of fetch
        // setError(null); // Clear previous fetch errors here if preferred
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");

            const response = await fetch('/api/transactions/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }
            const allData = await response.json();
            const incomeData = (allData || []).filter(tx => tx.type === 'income');
            incomeData.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAllIncomeTransactions(incomeData);
            setError(null); // Clear error only on successful fetch
        } catch (err) {
            console.error("Error fetching transactions for Income page:", err);
            setError(err.message || 'Failed to fetch transactions.');
            setAllIncomeTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllTransactions();
    }, []); // Initial fetch

    // --- Event Listener Effect ---
    useEffect(() => {
        const handleIncomeUpdate = () => {
            console.log("IncomePage received income-updated event, re-fetching...");
            fetchAllTransactions();
        };
        window.addEventListener('income-updated', handleIncomeUpdate);
        return () => {
            window.removeEventListener('income-updated', handleIncomeUpdate);
        };
    }, []); // Listener setup runs once

    // --- Edit Handlers ---
    const handleEditClick = (tx) => {
        setEditingTxId(tx._id);
        setEditFormData({ description: tx.description, category: tx.category });
    };

    const handleCancelEdit = () => {
        setEditingTxId(null);
        setEditFormData({ description: '', category: '' });
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async (txId) => {
        setError(null);
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication token not found.");
            return;
        }
        if (!editFormData.description.trim() || !editFormData.category.trim()) {
            alert("Description and Category cannot be empty.");
            return;
        }
        try {
            const response = await fetch(`/api/transactions/${txId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    description: editFormData.description,
                    category: editFormData.category,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }
            // Update local state optimistically
            setAllIncomeTransactions(prevTxs =>
                prevTxs.map(tx =>
                    tx._id === txId ? { ...tx, ...editFormData } : tx
                )
            );
            handleCancelEdit(); // Exit editing mode
        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
        }
    };

    // --- Chart Data Prep ---
    const chartData = allIncomeTransactions.map((tx, index) => ({
        date: tx.date ? new Date(tx.date).toLocaleDateString('en-CA') : `tx_${index}`,
        amount: tx.amount,
        description: tx.description
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // --- PDF Download Handler ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Date", "Description", "Category", "Amount"];
        const tableRows = [];
        doc.setFontSize(18);
        doc.text(`Income Transactions for ${username}`, 14, 22);
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

    // --- Loading/Error States ---
    if (loading) {
        return <div className={styles.dashboardPageContent}><p>Loading income data...</p></div>;
    }
    // Don't show page-level error for update failures, handle inline
    if (error && !error.startsWith('Update Error:')) {
        return <div className={styles.dashboardPageContent}><p style={{ color: 'red' }}>Error: {error}</p></div>;
    }

    // --- Component Render ---
    return (
        <div className={styles.transactionsPageContainer}>
             <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Income Overview</h1>
                    <button onClick={handleDownloadPDF} className={styles.seeAllButton} style={{fontSize: '1rem'}}>
                       Download PDF
                    </button>
                </div>

                {/* Bar Chart Section */}
                 <section className={`${styles.sectionBox} ${styles.chartSection}`}>
                     <h2 className={styles.sectionTitle}>Income Trend by Date</h2>
                     <div className={styles.chartContainer}>
                         {chartData.length > 0 ? (
                             <ResponsiveContainer width="100%" height={300}>
                                 <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                     <CartesianGrid strokeDasharray="3 3" />
                                     <XAxis dataKey="date" />
                                     <YAxis tickFormatter={formatCurrency} width={80} />
                                     <Tooltip formatter={(value, name, props) => [formatCurrency(value), `Amount (${props.payload.description})`]} />
                                     <Legend />
                                     <Bar dataKey="amount" fill="#34D399" name="Income Amount" barSize={50}/>
                                 </BarChart>
                             </ResponsiveContainer>
                         ) : (
                             <div className={styles.placeholderContent}>No income data available to display chart.</div>
                         )}
                     </div>
                 </section>

                 <div className={styles.mainArea}>
                     {/* All Income Transactions Section */}
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}>
                         <div className={styles.sectionHeader}>
                             <h2 className={styles.sectionTitle}>All Income Transactions</h2>
                         </div>
                          {error && error.startsWith('Update Error:') && (
                           <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
                         )}
                         {allIncomeTransactions.length > 0 ? (
                             <div className={styles.transactionList}>
                                 {allIncomeTransactions.map((tx) => (
                                     <div
                                         key={tx._id}
                                         className={`${styles.transactionItem} ${styles.incomeBorder}`}
                                     >
                                         {/* Column 1: Date */}
                                         <span style={{ gridColumn: '1 / 2' }} className={styles.transactionDate}>
                                             {formatDate(tx.date)}
                                         </span>

                                         {/* Columns 2 & 3: Description and Category (Inputs or Spans) */}
                                         {editingTxId === tx._id ? (
                                             <>
                                                 <input
                                                     type="text" name="description" value={editFormData.description}
                                                     onChange={handleEditFormChange} className={styles.formInput}
                                                     style={{ gridColumn: '2 / 3', fontSize: '0.9rem', padding: '0.4rem' }}
                                                 />
                                                 <input
                                                     type="text" name="category" value={editFormData.category}
                                                     onChange={handleEditFormChange} className={styles.formInput}
                                                     style={{ gridColumn: '3 / 4', fontSize: '0.9rem', padding: '0.4rem' }}
                                                 />
                                             </>
                                         ) : (
                                             <span style={{ gridColumn: '2 / 4' }} className={styles.transactionDesc}>
                                                 {tx.description} ({tx.category})
                                             </span>
                                         )}

                                         {/* Column 4: Amount */}
                                         <span style={{ gridColumn: '4 / 5' }} className={`${styles.transactionAmount} ${styles.income}`}>
                                             {'+'} {formatCurrency(tx.amount)}
                                         </span>

                                         {/* Column 5: Action Buttons */}
                                         <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', gridColumn: '5 / 6', alignItems: 'center' }}>
                                             {editingTxId === tx._id ? (
                                                 <>
                                                     <button onClick={() => handleSaveEdit(tx._id)} className={`${styles.actionButton} ${styles.saveButton}`}>Save</button>
                                                     <button onClick={handleCancelEdit} className={`${styles.actionButton} ${styles.cancelButton}`}>Cancel</button>
                                                 </>
                                             ) : (
                                                 <>
                                                     <button onClick={() => handleEditClick(tx)} className={`${styles.actionButton} ${styles.editButton}`}>Edit</button>
                                                     <button className={`${styles.actionButton} ${styles.deleteButton}`}>Delete</button>
                                                 </>
                                             )}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <div className={styles.placeholderContent}>
                                 No income transactions found. Add some on the Dashboard!
                             </div>
                         )}
                     </section>
                 </div>
            </div>
        </div>
    );
}

export default IncomePage;