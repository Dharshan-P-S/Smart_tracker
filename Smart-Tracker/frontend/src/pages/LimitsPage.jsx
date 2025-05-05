import React, { useState, useEffect, useCallback } from 'react'; // <-- Import useCallback
import { FaExclamationTriangle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa'; // Icons
import styles from './LimitsPage.module.css'; // We'll create this CSS module next

// Reusable formatCurrency function (keep existing)
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
    const [editingLimitId, setEditingLimitId] = useState(null); // State to track which limit is being edited
    const [editFormData, setEditFormData] = useState({ category: '', amount: '' }); // State for edit form data
    const [isSaving, setIsSaving] = useState(false); // State for save loading

    // --- Fetch Limits (wrapped in useCallback) ---
    const fetchLimits = useCallback(async () => {
        // console.log("Fetching limits..."); // Optional debug log
        // Don't set loading to true here if it's just a refresh,
        // maybe only set loading on initial mount? Or accept a parameter.
        // For simplicity, we'll keep setLoading(true) for now.
        setLoading(true);
        setError(null); // Clear previous fetch errors
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
            // console.log("Limits data received:", data); // Optional debug log
            setLimits(data);
        } catch (err) {
            console.error("Error fetching limits:", err);
            // Display fetch errors, but maybe differentiate between initial load and refresh errors?
            setError(err.message || 'Failed to fetch limits.');
            setLimits([]); // Clear limits on error
        } finally {
            setLoading(false);
        }
    // useCallback dependency array is empty because it doesn't depend on props or state
    // that would change its behavior. localStorage/fetch are stable APIs.
    }, []);

    // --- Effect for Initial Fetch ---
    useEffect(() => {
        fetchLimits();
    }, [fetchLimits]); // Depend on the stable fetchLimits function

    // --- Effect for Listening to Transaction Updates ---
    useEffect(() => {
        const handleTransactionsUpdate = () => {
            console.log('Transaction update detected by LimitsPage, refetching limits...');
            fetchLimits(); // Call the memoized fetch function
        };

        // Add event listener
        window.addEventListener('transactions-updated', handleTransactionsUpdate);

        // Cleanup: remove event listener when component unmounts
        return () => {
            window.removeEventListener('transactions-updated', handleTransactionsUpdate);
        };
    }, [fetchLimits]); // Depend on fetchLimits so the listener always calls the latest version


    // --- Add Limit Handlers ---
    const handleAddFormChange = (e) => {
        // ... (keep existing logic)
        const { name, value } = e.target;
        setAddFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        // Clear only add-related errors, keep fetch errors if any
        setError(prev => (prev && (prev.startsWith('Add Error:') || prev.includes('required') || prev.includes('number'))) ? null : prev);


        const { category, amount } = addFormData;
        if (!category.trim() || !amount) {
            setError("Add Error: Category and Amount are required.");
            setIsAdding(false);
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            setError("Add Error: Amount must be a valid non-negative number.");
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

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `Failed to add limit: ${response.statusText}`);
            }

            // --- Correct State Update ---
            // The backend now returns the new limit WITH calculated spending.
            // Simply add it to the state. No need to call fetchLimits here.
            setLimits(prevLimits => [...prevLimits, responseData]);
            setAddFormData({ category: '', amount: '' }); // Reset form

        } catch (err) {
            console.error("Error adding limit:", err);
            // Prepend "Add Error:" to differentiate from fetch/delete errors
            setError(`Add Error: ${err.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    // --- Edit Handlers ---
    const handleEditClick = (limit) => {
        setEditingLimitId(limit._id);
        setEditFormData({ category: limit.category, amount: limit.amount.toString() }); // Set initial form data
        setError(null); // Clear any previous errors when starting edit
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCancelClick = () => {
        setEditingLimitId(null);
        setEditFormData({ category: '', amount: '' });
        setError(null); // Clear errors on cancel
    };

    const handleSaveClick = async (limitId) => {
        setIsSaving(true);
        setError(null); // Clear previous save errors

        const { category, amount } = editFormData;
        if (!category.trim() || !amount) {
            setError("Edit Error: Category and Amount are required.");
            setIsSaving(false);
            return;
        }
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            setError("Edit Error: Amount must be a valid non-negative number.");
            setIsSaving(false);
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error("Authentication token not found.");

            // Call the backend update endpoint with the edited data
            const response = await fetch(`/api/limits/${limitId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ category: category.trim(), amount: numericAmount }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `Failed to update limit: ${response.statusText}`);
            }

            // Update the limits state based on the backend response
            // The backend now handles merging and returns the updated/merged limit.
            // We need to refetch the entire list to ensure the state is correct
            // if a limit was deleted and another updated.
            await fetchLimits(); // Refetch all limits to get the correct state after potential merge/delete

            setEditingLimitId(null); // Exit edit mode
            setEditFormData({ category: '', amount: '' }); // Clear edit form data

        } catch (err) {
            console.error("Error saving limit:", err);
            setError(`Edit Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };


    // --- Delete Handler ---
    const handleDeleteClick = async (limitId) => {
        // ... (keep existing logic)
        console.log("Delete limit ID:", limitId);
        if (!window.confirm("Are you sure you want to delete this limit?")) return;

        // Clear only delete-related errors
        setError(prev => (prev && prev.startsWith('Delete Error:')) ? null : prev);
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

            // Remove limit from state directly
            setLimits(prevLimits => prevLimits.filter(l => l._id !== limitId));
            alert(responseData.message || "Limit deleted successfully."); // Show success

        } catch (err) {
            console.error("Error deleting limit:", err);
            setError(`Delete Error: ${err.message}`);
        }
    };


    // --- Render Logic ---
    if (loading && limits.length === 0) { // Show loading only on initial load
        return <div className={styles.limitsPageContainer}><p>Loading limits...</p></div>;
    }

    return (
        <div className={styles.limitsPageContainer}>
            <h1 className={styles.pageTitle}>Spending Limits</h1>

            {/* Add Limit Form */}
            <section className={`${styles.sectionBox} ${styles.addLimitSection}`}>
                <h2 className={styles.sectionTitle}>Add New Limit</h2>
                <form onSubmit={handleAddSubmit} className={styles.addForm}>
                    {/* ... (keep existing form inputs) ... */}
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
                            disabled={isAdding} // Disable while adding
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
                            disabled={isAdding} // Disable while adding
                        />
                    </div>
                    <button type="submit" className={styles.addButton} disabled={isAdding}>
                        {isAdding ? 'Adding...' : <><FaPlus /> Add Limit</>}
                    </button>
                </form>
                 {/* Display only Add-related errors here */}
                 {error && error.startsWith('Add Error:') && (
                    <p className={styles.errorMessage}>{error}</p>
                )}
            </section>

            {/* Display Existing Limits */}
            <section className={`${styles.sectionBox} ${styles.limitsListSection}`}>
                <h2 className={styles.sectionTitle}>Your Limits</h2>
                 {/* Display Fetch/Delete errors here */}
                 {error && !error.startsWith('Add Error:') && (
                    <p className={styles.errorMessage}>{error}</p>
                )}

                {limits.length > 0 ? (
                    <div className={styles.limitsList}>
                        {limits.map((limit) => (
                            <div key={limit._id} className={`${styles.limitItem} ${limit.exceeded ? styles.exceeded : ''}`}>
                                {editingLimitId === limit._id ? (
                                    // Edit mode
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
                                    // View mode
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
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                     // Show only if no error preventing display and no limits loaded
                     !error && !loading && <p>No spending limits set yet. Add one above!</p>
                )}
                 {/* Optional: Show subtle loading indicator during refresh? */}
                 {loading && limits.length > 0 && <p>Refreshing limits...</p>}
            </section>
        </div>
    );
}

export default LimitsPage;
