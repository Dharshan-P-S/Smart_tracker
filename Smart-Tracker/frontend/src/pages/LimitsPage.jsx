// frontend/src/pages/LimitsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaExclamationTriangle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import styles from './LimitsPage.module.css';

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
    const [error, setError] = useState(null); // For general fetch/delete/critical errors
    const [addFormData, setAddFormData] = useState({ category: '', amount: '' });
    const [isAdding, setIsAdding] = useState(false);
    const [editingLimitId, setEditingLimitId] = useState(null);
    const [editFormData, setEditFormData] = useState({ category: '', amount: '' });
    const [isSaving, setIsSaving] = useState(false);

    const fetchLimits = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found. Please log in.");

            const response = await fetch('/api/limits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setLimits(data);
        } catch (err) {
            console.error("Error fetching limits:", err);
            setError(err.message || 'Failed to fetch limits.');
            toast.error(err.message || 'Failed to fetch limits.'); // Also toast fetch errors
            setLimits([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLimits();
    }, [fetchLimits]);

    useEffect(() => {
        const handleDataUpdate = () => {
            console.log('Data update detected (transactions, goals, or limits), refetching limits...');
            fetchLimits();
        };

        window.addEventListener('transactions-updated', handleDataUpdate);
        window.addEventListener('goals-updated', handleDataUpdate);
        window.addEventListener('limits-updated', handleDataUpdate);

        return () => {
            window.removeEventListener('transactions-updated', handleDataUpdate);
            window.removeEventListener('goals-updated', handleDataUpdate);
            window.removeEventListener('limits-updated', handleDataUpdate);
        };
    }, [fetchLimits]);


    const handleAddFormChange = (e) => {
        const { name, value } = e.target;
        setAddFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        // Clear only critical add-related errors, not the toast one
        setError(prev => (prev && (prev.startsWith('Critical Add Error:'))) ? null : prev);


        const { category, amount } = addFormData;
        const trimmedCategory = category.trim();

        if (!trimmedCategory || !amount) {
            // Use toast for validation errors as well, if preferred, or keep as page error
            toast.error("Category and Amount are required.");
            // setError("Add Error: Category and Amount are required."); // Keep or remove based on preference
            setIsAdding(false);
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            toast.error("Amount must be a valid non-negative number.");
            // setError("Add Error: Amount must be a valid non-negative number."); // Keep or remove
            setIsAdding(false);
            return;
        }

        // --- CHECK FOR EXISTING LIMIT CATEGORY (Client-side) ---
        const existingCategory = limits.find(
            limit => limit.category.toLowerCase() === trimmedCategory.toLowerCase()
        );
        if (existingCategory) {
            toast.error(`A limit for category "${trimmedCategory}" already exists with an amount of ${formatCurrency(existingCategory.amount)}. You can edit the existing limit.`);
            setIsAdding(false);
            return; // Stop submission
        }
        // --- END CHECK ---


        try {
            const token = localStorage.getItem('authToken');
            if (!token) { // This should ideally be caught by a route guard or global error handler
                 toast.error("Authentication token not found. Please log in.");
                 setIsAdding(false);
                 return;
            }


            const response = await fetch('/api/limits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ category: trimmedCategory, amount: numericAmount }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `Failed to add limit: ${response.statusText}`);
            }
            
            setLimits(prevLimits => [...prevLimits, responseData].sort((a, b) => a.category.localeCompare(b.category)));
            setAddFormData({ category: '', amount: '' });
            toast.success(`Limit for "${responseData.category}" added!`);
            window.dispatchEvent(new CustomEvent('limits-updated'));

        } catch (err) {
            console.error("Error adding limit:", err);
            toast.error(`Add Error: ${err.message}`);
            // Optionally set a critical error state if needed for on-page display for severe issues
            // setError(`Critical Add Error: ${err.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleEditClick = (limit) => {
        setEditingLimitId(limit._id);
        setEditFormData({ category: limit.category, amount: limit.amount.toString() });
        setError(null);
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCancelClick = () => {
        setEditingLimitId(null);
        setEditFormData({ category: '', amount: '' });
        setError(null);
    };

    const handleSaveClick = async (limitId) => {
        setIsSaving(true);
        setError(null);

        const { category, amount } = editFormData;
        const trimmedCategory = category.trim();

        if (!trimmedCategory || !amount) {
            toast.error("Edit Error: Category and Amount are required.");
            setIsSaving(false);
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            toast.error("Edit Error: Amount must be a valid non-negative number.");
            setIsSaving(false);
            return;
        }

        const originalLimitData = limits.find(l => l._id === limitId);

        // Check if the category name is being changed to one that already exists (excluding itself)
        if (originalLimitData && originalLimitData.category.toLowerCase() !== trimmedCategory.toLowerCase()) {
            const conflictingLimit = limits.find(
                limit => limit._id !== limitId && limit.category.toLowerCase() === trimmedCategory.toLowerCase()
            );
            if (conflictingLimit) {
                 toast.warn(`Edit conflict: Another limit for category "${trimmedCategory}" already exists. The backend will attempt to merge these if amounts differ, or update if amounts are the same. If this was not intended, please cancel and adjust.`);
                // Note: We proceed here because the backend's PUT /api/limits/:id is designed to handle merges.
                // If you don't want to allow the PUT to proceed in this case, return here.
            }
        }
        

        try {
            const token = localStorage.getItem('authToken');
             if (!token) {
                 toast.error("Authentication token not found. Please log in.");
                 setIsSaving(false);
                 return;
            }

            const response = await fetch(`/api/limits/${limitId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ category: trimmedCategory, amount: numericAmount }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `Failed to update limit: ${response.statusText}`);
            }
            
            await fetchLimits(); 
            setEditingLimitId(null);
            setEditFormData({ category: '', amount: '' });
            toast.success(responseData.message || "Limit updated successfully!");
            window.dispatchEvent(new CustomEvent('limits-updated'));

        } catch (err) {
            console.error("Error saving limit:", err);
            toast.error(`Edit Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = async (limitId) => {
        if (!window.confirm("Are you sure you want to delete this limit?")) return;

        setError(prev => (prev && prev.startsWith('Delete Error:')) ? null : prev); // Clear only specific on-page delete errors
        try {
             const token = localStorage.getItem('authToken');
            if (!token) {
                 toast.error("Authentication token not found. Please log in.");
                 return;
            }


             const response = await fetch(`/api/limits/${limitId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

             const responseData = await response.json();

             if (!response.ok) {
                throw new Error(responseData.message || `Failed to delete limit: ${response.statusText}`);
            }

            setLimits(prevLimits => prevLimits.filter(l => l._id !== limitId));
            toast.success(responseData.message || "Limit deleted successfully.");
            window.dispatchEvent(new CustomEvent('limits-updated'));

        } catch (err) {
            console.error("Error deleting limit:", err);
            toast.error(`Delete Error: ${err.message}`);
            // setError(`Delete Error: ${err.message}`); // Optionally set on-page error for critical delete issues
        }
    };

    if (loading && limits.length === 0) {
        return <div className={styles.limitsPageContainer}><p>Loading limits...</p></div>;
    }

    return (
        <div className={styles.limitsPageContainer}>
            <h1 className={styles.pageTitle}>Spending Limits</h1>

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
                            disabled={isAdding}
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
                            disabled={isAdding}
                        />
                    </div>
                    <button type="submit" className={styles.addButton} disabled={isAdding}>
                        {isAdding ? 'Adding...' : <><FaPlus /> Add Limit</>}
                    </button>
                </form>
                 {/* Display only critical on-page errors for Add section, if any */}
                 {error && error.startsWith('Critical Add Error:') && (
                    <p className={styles.errorMessage}>{error}</p>
                )}
            </section>

            <section className={`${styles.sectionBox} ${styles.limitsListSection}`}>
                <h2 className={styles.sectionTitle}>Your Limits</h2>
                 {/* Display general fetch/delete errors or critical edit errors */}
                 {error && !error.startsWith('Critical Add Error:') && (
                    <p className={styles.errorMessage}>{error}</p>
                )}


                {limits.length > 0 ? (
                    <div className={styles.limitsList}>
                        {limits.map((limit) => (
                            <div key={limit._id} className={`${styles.limitItem} ${limit.exceeded ? styles.exceeded : ''}`}>
                                {editingLimitId === limit._id ? (
                                    <div className={styles.editLimitForm}>
                                        <div className={styles.formGroup}>
                                            <label htmlFor={`edit-category-${limit._id}`}>Category:</label>
                                            <input
                                                type="text"
                                                id={`edit-category-${limit._id}`}
                                                name="category"
                                                value={editFormData.category}
                                                onChange={handleEditFormChange}
                                                required
                                                className={styles.formInput}
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label htmlFor={`edit-amount-${limit._id}`}>Limit Amount ($):</label>
                                            <input
                                                type="number"
                                                id={`edit-amount-${limit._id}`}
                                                name="amount"
                                                value={editFormData.amount}
                                                onChange={handleEditFormChange}
                                                required
                                                min="0"
                                                step="0.01"
                                                className={styles.formInput}
                                                disabled={isSaving}
                                            />
                                        </div>
                                        <div className={styles.editActions}>
                                            <button onClick={() => handleSaveClick(limit._id)} className={`${styles.actionButton} ${styles.saveButton}`} aria-label="Save limit" disabled={isSaving}>
                                                {isSaving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button onClick={handleCancelClick} className={`${styles.actionButton} ${styles.cancelButton}`} aria-label="Cancel edit" disabled={isSaving}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.limitInfo}>
                                            <span className={styles.limitCategory}>{limit.category}</span>
                                            <span className={styles.limitAmount}>Limit: {formatCurrency(limit.amount)}</span>
                                            <span className={styles.limitSpending}>Spent: {formatCurrency(limit.currentSpending)}</span>
                                            <span className={`${styles.limitRemaining} ${limit.remainingAmount < 0 ? styles.negativeRemaining : ''}`}>
                                                Remaining: {formatCurrency(limit.remainingAmount)}
                                            </span>
                                            <div className={styles.progressBarContainer}>
                                                <div
                                                    className={styles.progressBarFill}
                                                    style={{ width: `${Math.min(100, (limit.amount > 0 && limit.currentSpending > 0 ? (limit.currentSpending / limit.amount) * 100 : 0))}%` }}
                                                    title={`Spent ${((limit.amount > 0 && limit.currentSpending > 0 ? (limit.currentSpending / limit.amount) * 100 : 0)).toFixed(1)}%`}
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
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                     !error && !loading && <p>No spending limits set yet. Add one above!</p>
                )}
                 {loading && limits.length > 0 && <p className={styles.subtleLoading}>Refreshing limits...</p>}
            </section>
        </div>
    );
}

export default LimitsPage;