import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// You can reuse the dashboard CSS module or create a new one
import styles from './Dashboard.module.css'; // Reusing dashboard styles for now

// Reusable formatCurrency function (consider moving to a utils file later)
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllTransactions = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch from the new backend endpoint
                // No need for auth token while using TEMP_USER_ID
                const response = await fetch('/api/transactions/all');

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
                }

                const data = await response.json();
                setTransactions(data || []);

            } catch (err) {
                console.error("Error fetching all transactions:", err);
                setError(err.message || 'Failed to fetch transactions.');
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAllTransactions();
    }, []); // Fetch only once on component mount

    return (
        <div className={styles.transactionsPageContainer}>
            <div className={styles.dashboardPageContent}>
                <div className={styles.sectionHeader}> {/* Reusing header style */}
                   <h1 className={styles.pageTitle}>All Transactions</h1>
                   <Link to="/dashboard" className={styles.seeAllButton} style={{fontSize: '1rem'}}>Back to Dashboard</Link> {/* Back button */}
                </div>

                {loading && <p>Loading transactions...</p>}
                {error && <div style={{ color: 'red', marginBottom: '1rem' }}>Error: {error}</div>}

                {!loading && !error && (
                     <section className={`${styles.sectionBox} ${styles.transactionsSection}`}> {/* Reuse section box */}
                        {transactions.length > 0 ? (
                            <div className={styles.transactionList} style={{borderTop: 'none'}}> {/* Reuse list style, remove top border */}
                                {transactions.map((tx) => (
                                    <div
                                        key={tx._id} // Use _id from MongoDB
                                        className={`${styles.transactionItem} ${
                                            tx.type === 'income' ? styles.incomeBorder : styles.expenseBorder
                                        }`}
                                    >
                                        <span className={styles.transactionDate}>
                                            {new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} {/* Show year */}
                                        </span>
                                        <span className={styles.transactionDesc}>
                                            {tx.description} ({tx.category})
                                        </span>
                                        <span className={`${styles.transactionAmount} ${tx.type === 'income' ? styles.income : styles.expense}`}>
                                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.placeholderContent}>
                                No transactions found.
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

export default TransactionsPage; 