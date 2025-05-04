import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Import PDF generation libraries
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import autoTable function explicitly

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
    const [username, setUsername] = useState('CurrentUser'); // Placeholder - How do we get the real username?

    // --- State for Editing ---
    const [editingTxId, setEditingTxId] = useState(null); // ID of the transaction being edited
    const [editFormData, setEditFormData] = useState({ description: '', category: '' });

    // TODO: Replace placeholder logic with actual username retrieval
    // useEffect(() => {
    //     const storedUsername = localStorage.getItem('username'); // Example
    //     if (storedUsername) {
    //         setUsername(storedUsername);
    //     }
    //     // Or fetch from an API endpoint like /api/users/me
    // }, []);

    useEffect(() => {
        const fetchAllTransactions = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('authToken');
                if (!token) {
                    throw new Error("Authentication token not found.");
                }
                const response = await fetch('/api/transactions/all', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
                }
                const allData = await response.json();
                const incomeData = (allData || []).filter(tx => tx.type === 'income');
                incomeData.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first
                setAllIncomeTransactions(incomeData);
            } catch (err) {
                console.error("Error fetching transactions for Income page:", err);
                setError(err.message || 'Failed to fetch transactions.');
                setAllIncomeTransactions([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAllTransactions();
    }, []); // Fetch only once on component mount

    // --- Effect to listen for updates triggered by Dashboard ---
    useEffect(() => {
        const handleIncomeUpdate = () => {
            console.log("IncomePage received income-updated event, re-fetching..."); // For debugging
            fetchAllTransactions(); // Re-fetch data when event is heard
        };

        console.log("IncomePage setting up event listener for income-updated"); // For debugging
        window.addEventListener('income-updated', handleIncomeUpdate);

        // Cleanup function to remove the listener when the component unmounts
        return () => {
            console.log("IncomePage cleaning up event listener for income-updated"); // For debugging
            window.removeEventListener('income-updated', handleIncomeUpdate);
        };
    }, []); // Empty dependency array means this setup runs only once on mount

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
        setError(null); // Clear previous errors
        const token = localStorage.getItem('authToken');
        if (!token) {
            setError("Authentication token not found.");
            return;
        }

        // Basic validation
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
                    // Include other fields if the backend expects them, otherwise backend should ignore
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Update failed with non-JSON response' }));
                throw new Error(errorData.message || `Failed to update transaction: ${response.statusText}`);
            }

            // Option 1: Re-fetch all data (simpler)
            // fetchAllTransactions(); 

            // Option 2: Update local state (more performant)
            setAllIncomeTransactions(prevTxs => 
                prevTxs.map(tx => 
                    tx._id === txId ? { ...tx, ...editFormData } : tx
                )
            );

            handleCancelEdit(); // Exit editing mode

        } catch (err) {
            console.error("Error updating transaction:", err);
            setError(`Update Error: ${err.message}`);
            // Optionally keep editing mode open on error?
        }
    };

    // --- Chart Data Prep (existing) ---
    // Map each transaction to a chart data point
    const chartData = allIncomeTransactions.map((tx, index) => ({
        // Use date for the axis, maybe add index if dates clash visually?
        // Formatting date for display on axis
        date: tx.date ? new Date(tx.date).toLocaleDateString('en-CA') : `tx_${index}`,
        amount: tx.amount,
        // Include description for tooltip
        description: tx.description
    })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

    // --- PDF Download Handler ---
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Date", "Description", "Category", "Amount"];
        const tableRows = [];

        // Add Title
        doc.setFontSize(18);
        doc.text(`Income Transactions for ${username}`, 14, 22);

        // Prepare table data
        allIncomeTransactions.forEach(tx => {
            const transactionData = [
                formatDate(tx.date),
                tx.description,
                tx.category,
                formatCurrency(tx.amount)
            ];
            tableRows.push(transactionData);
        });

        // Add table to PDF using the imported function
        autoTable(doc, { // Call autoTable explicitly
            head: [tableColumn],
            body: tableRows,
            startY: 30, // Start table below title
            theme: 'grid', // Options: 'striped', 'grid', 'plain'
            styles: { fontSize: 10 },
            headStyles: { fillColor: [22, 160, 133] }, // Green header
            margin: { top: 30 }
         });

        // Add timestamp
        const date = new Date();
        const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        doc.setFontSize(10);
        doc.text(`Generated on: ${dateStr}`, 14, doc.internal.pageSize.height - 10);

        // Save the PDF
        doc.save(`income-transactions-${username}-${new Date().toISOString().slice(0,10)}.pdf`);
    };


    if (loading) {
        return <div className={styles.dashboardPageContent}><p>Loading income data...</p></div>;
    }
    if (error && !error.startsWith('Update Error:')) { // Don't show page-level error for update failures, handle inline
        return <div className={styles.dashboardPageContent}><p style={{ color: 'red' }}>Error: {error}</p></div>;
    }

    // --- Component Render ---
    return (
        <div className={styles.transactionsPageContainer}>
             <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}>
                   <h1 className={styles.pageTitle}>Income Overview</h1>
                   {/* Download Button */}
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
                                     <Bar dataKey="amount" fill="#34D399" name="Income Amount" barSize={15}/>
                                 </BarChart>
                             </ResponsiveContainer>
                         ) : (
                             <div className={styles.placeholderContent}>No income data available to display chart.</div>
                         )}
                     </div>
                 </section>

                 <div className={styles.mainArea}>
                     {/* All Income Transactions Section */}
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`} style={{gridColumn: '1 / -1'}}> {/* Make section span both columns */}
                         <div className={styles.sectionHeader}>
                             <h2 className={styles.sectionTitle}>All Income Transactions</h2>
                         </div>
                          {/* Display Update Error here */} 
                         {error && error.startsWith('Update Error:') && (
                           <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
                         )}
                         {allIncomeTransactions.length > 0 ? (
                             <div className={styles.transactionList}>
                                 {/* Map over ALL income transactions */}
                                 {allIncomeTransactions.map((tx) => (
                                     <div
                                         key={tx._id}
                                         className={`${styles.transactionItem} ${styles.incomeBorder}`}
                                     >
                                         <span className={styles.transactionDate}>
                                             {formatDate(tx.date)}
                                         </span>
                                         {/* Conditional Rendering for Edit Mode */} 
                                         {editingTxId === tx._id ? (
                                             <>
                                                 {/* Edit Form Inputs */}
                                                 <input 
                                                     type="text"
                                                     name="description"
                                                     value={editFormData.description}
                                                     onChange={handleEditFormChange}
                                                     className={styles.formInput} // Reuse form styles?
                                                     style={{fontSize: '0.9rem', padding: '0.4rem'}} // Basic inline styles
                                                 />
                                                 <input 
                                                     type="text"
                                                     name="category"
                                                     value={editFormData.category}
                                                     onChange={handleEditFormChange}
                                                     className={styles.formInput} 
                                                      style={{fontSize: '0.9rem', padding: '0.4rem'}}
                                                 />
                                                 <span className={`${styles.transactionAmount} ${styles.income}`}> 
                                                     {/* Amount not editable */} 
                                                    {'+'} {formatCurrency(tx.amount)}
                                                 </span>
                                             </>
                                         ) : (
                                             <>
                                                 {/* Display Spans */}
                                                 <span className={styles.transactionDesc}>
                                                     {tx.description} ({tx.category})
                                                 </span>
                                                 <span className={`${styles.transactionAmount} ${styles.income}`}> 
                                                    {'+'} {formatCurrency(tx.amount)}
                                                 </span>
                                             </>
                                         )}

                                         {/* Conditional Buttons */} 
                                         <div style={{ display: 'flex', gap: '0.5rem', gridColumn: '1 / -1', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                             {editingTxId === tx._id ? (
                                                 <>
                                                     <button onClick={() => handleSaveEdit(tx._id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#34D399', color: 'white', border:'none' }}>Save</button>
                                                     <button onClick={handleCancelEdit} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Cancel</button>
                                                 </>
                                             ) : (
                                                 <>
                                                     <button onClick={() => handleEditClick(tx)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Edit</button>
                                                     <button style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#F87171', color: 'white', border:'none' }}>Delete</button>
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