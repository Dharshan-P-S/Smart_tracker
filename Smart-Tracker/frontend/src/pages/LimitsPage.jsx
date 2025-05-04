import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa'; // Icons
import styles from './LimitsPage.module.css'; // We'll create this CSS module next

// Reusable formatCurrency function (assuming it's available or define it here)
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

function LimitsPage() {
    const [limits, setLimits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addFormData, setAddFormData] = useState({ category: '', amount: '' });
    const [isAdding, setIsAdding] = useState(false); // State for add form visibility/loading

    // --- Fetch Limits ---
    const fetchLimits = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");

            const response = await fetch('/api/limits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }
            const data = await response.json();
            setLimits(data);
        } catch (err) {
            console.error("Error fetching limits:", err);
            setError(err.message || 'Failed to fetch limits.');
            setLimits([]); // Clear limits on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLimits();
    }, []); // Fetch on component mount

    // --- Add Limit Handlers ---
    const handleAddFormChange = (e) => {
        const { name, value } = e.target;
        setAddFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null); // Clear previous add errors

        const { category, amount } = addFormData;
        if (!category.trim() || !amount) {
            setError("Category and Amount are required.");
            setIsAdding(false);
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            setError("Amount must be a valid non-negative number.");
            setIsAdding(false);
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");

            const response = await fetch('/api/limits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ category: category.trim(), amount: numericAmount }),
            });

            const responseData = await response.json(); // Read response body regardless of status

            if (!response.ok) {
                 // Use message from backend if available, otherwise generic error
                throw new Error(responseData.message || `Failed to add limit: ${response.statusText}`);
            }

            // Add the new limit (with spending info from backend) to the state
            setLimits(prevLimits => [...prevLimits, responseData]);
            setAddFormData({ category: '', amount: '' }); // Reset form

        } catch (err) {
            console.error("Error adding limit:", err);
            setError(`Add Error: ${err.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    // --- TODO: Edit and Delete Handlers ---
    const handleEditClick = (limit) => {
        // Placeholder for edit functionality
        console.log("Edit limit:", limit);
        alert("Edit functionality not yet implemented.");
    };

    const handleDeleteClick = async (limitId) => {
        // Placeholder for delete functionality
        console.log("Delete limit ID:", limitId);
        if (!window.confirm("Are you sure you want to delete this limit?")) return;

        setError(null);
        try {
             const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");

             const response = await fetch(`/api/limits/${limitId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

             const responseData = await response.json();

             if (!response.ok) {
                throw new Error(responseData.message || `Failed to delete limit: ${response.statusText}`);
            }

             // Remove limit from state
            setLimits(prevLimits => prevLimits.filter(l => l._id !== limitId));
            alert(responseData.message || "Limit deleted successfully."); // Show success

        } catch (err) {
            console.error("Error deleting limit:", err);
            setError(`Delete Error: ${err.message}`);
        }
    };


    // --- Render Logic ---
    if (loading) {
        return <div className={styles.limitsPageContainer}><p>Loading limits...</p></div>;
    }

    // Display general fetch error, but allow adding even if fetch failed initially
    // Specific add/delete errors are shown near the form/list

    return (
        <div className={styles.limitsPageContainer}>
            <h1 className={styles.pageTitle}>Spending Limits</h1>

            {/* Add Limit Form */}
            <section className={`${styles.sectionBox} ${styles.addLimitSection}`}>
                <h2 className={styles.sectionTitle}>Add New Limit</h2>
                <form onSubmit={handleAddSubmit} className={styles.addForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="category">Category:</label>
                        <input
                            type="text"
                            id="category"
                            name="category"
                            value={addFormData.category}
                            onChange={handleAddFormChange}
                            placeholder="e.g., Groceries, Dining Out"
                            required
                            className={styles.formInput}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="amount">Limit Amount ($):</label>
                        <input
                            type="number"
                            id="amount"
                            name="amount"
                            value={addFormData.amount}
                            onChange={handleAddFormChange}
                            placeholder="e.g., 500"
                            required
                            min="0"
                            step="0.01"
                            className={styles.formInput}
                        />
                    </div>
                    <button type="submit" className={styles.addButton} disabled={isAdding}>
                        {isAdding ? 'Adding...' : <><FaPlus /> Add Limit</>}
                    </button>
                </form>
                 {error && (error.startsWith('Add Error:') || error === "Category and Amount are required." || error === "Amount must be a valid non-negative number.") && (
                    <p className={styles.errorMessage}>{error}</p>
                )}
            </section>

            {/* Display Existing Limits */}
            <section className={`${styles.sectionBox} ${styles.limitsListSection}`}>
                <h2 className={styles.sectionTitle}>Your Limits</h2>
                 {error && !error.startsWith('Add Error:') && !error.startsWith('Delete Error:') && ( // Show general fetch error here
                    <p className={styles.errorMessage}>{error}</p>
                )}
                 {error && error.startsWith('Delete Error:') && ( // Show delete error here
                    <p className={styles.errorMessage}>{error}</p>
                )}

                {limits.length > 0 ? (
                    <div className={styles.limitsList}>
                        {limits.map((limit) => (
                            <div key={limit._id} className={`${styles.limitItem} ${limit.exceeded ? styles.exceeded : ''}`}>
                                <div className={styles.limitInfo}>
                                    <span className={styles.limitCategory}>{limit.category}</span>
                                    <span className={styles.limitAmount}>Limit: {formatCurrency(limit.amount)}</span>
                                    <span className={styles.limitSpending}>Spent: {formatCurrency(limit.currentSpending)}</span>
                                     <span className={`${styles.limitRemaining} ${limit.remainingAmount < 0 ? styles.negativeRemaining : ''}`}>
                                        Remaining: {formatCurrency(limit.remainingAmount)}
                                     </span>
                                     {/* Progress Bar */}
                                     <div className={styles.progressBarContainer}>
                                         <div
                                             className={styles.progressBarFill}
                                             style={{ width: `${Math.min(100, (limit.amount > 0 ? (limit.currentSpending / limit.amount) * 100 : 0))}%` }}
                                             title={`Spent ${((limit.amount > 0 ? (limit.currentSpending / limit.amount) * 100 : 0)).toFixed(1)}%`}
                                         ></div>
                                     </div>
                                 </div>
                                 <div className={styles.limitStatus}>
                                      {limit.exceeded && (
                                         <FaExclamationTriangle className={styles.warningIcon} title="Limit Exceeded!" />
                                     )}
                                </div>
                                <div className={styles.limitActions}>
                                    <button onClick={() => handleEditClick(limit)} className={`${styles.actionButton} ${styles.editButton}`} aria-label="Edit limit">
                                        <FaEdit />
                                    </button>
                                    <button onClick={() => handleDeleteClick(limit._id)} className={`${styles.actionButton} ${styles.deleteButton}`} aria-label="Delete limit">
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                     !error && <p>No spending limits set yet. Add one above!</p> // Show only if no error and no limits
                )}
            </section>
        </div>
    );
}

export default LimitsPage;
