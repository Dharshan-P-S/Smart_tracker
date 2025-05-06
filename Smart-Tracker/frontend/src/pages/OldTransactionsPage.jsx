import React, { useState, useEffect, useMemo } from 'react'; // Corrected imports
import axios from 'axios';
import styles from './OldTransactionsPage.module.css';

const OldTransactionsPage = () => {
    const [oldTransactions, setOldTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Helper function to format month and year
    const formatMonthYear = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    useEffect(() => {
        const fetchOldTransactions = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                // TODO: Update endpoint when created/modified
                const response = await axios.get('/api/transactions/old', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Data is already sorted descending by date from backend
                setOldTransactions(response.data);
                setError('');
            } catch (err) {
                console.error("Error fetching old transactions:", err);
                setError('Failed to load old transactions. Please try again later.');
                // Handle specific errors (e.g., unauthorized) if needed
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in again.');
                    // Optionally redirect to login
                }
            } finally {
                setLoading(false);
            }
        };

        fetchOldTransactions();
    }, []);

    // Group transactions by month using useMemo for efficiency
    const groupedTransactions = useMemo(() => {
        return oldTransactions.reduce((acc, transaction) => {
            const monthYear = formatMonthYear(transaction.date);
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(transaction);
            return acc;
        }, {});
    }, [oldTransactions]);

    // Get sorted month keys (most recent month first)
    const sortedMonthKeys = useMemo(() => {
       return Object.keys(groupedTransactions).sort((a, b) => {
           // Convert "Month YYYY" back to a date for sorting
           const dateA = new Date(a);
           const dateB = new Date(b);
           return dateB - dateA; // Sort descending
       });
    }, [groupedTransactions]);


    return (
        <div className={styles.container}>
            <h2>Old Transactions</h2>
            {loading && <p>Loading transactions...</p>}
            {error && <p className={styles.error}>{error}</p>}
            {!loading && !error && (
                sortedMonthKeys.length > 0 ? (
                    // Iterate through each month group
                    sortedMonthKeys.map(monthYear => (
                        <div key={monthYear} className={styles.monthGroup}>
                            <h3 className={styles.monthHeading}>{monthYear}</h3>
                            <ul className={styles.transactionList}>
                                {groupedTransactions[monthYear].map(transaction => (
                                    <li key={transaction._id} className={`${styles.transactionItem} ${styles[transaction.type]}`}>
                                        <span>{new Date(transaction.date).toLocaleDateString()}</span>
                                        {/* Add emoji span */}
                                        <span className={styles.transactionDetails}>
                                            {transaction.emoji && <span className={styles.transactionEmoji}>{transaction.emoji}</span>}
                                            {transaction.description} ({transaction.category})
                                        </span>
                                        {/* Conditionally add '-' for expenses */}
                                        <span className={styles.transactionAmount}>{transaction.type === 'expense' ? '-' : ''}${transaction.amount.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                ) : (
                    <p>No old transactions found.</p>
                )
            )}
        </div>
    );
};

export default OldTransactionsPage;
