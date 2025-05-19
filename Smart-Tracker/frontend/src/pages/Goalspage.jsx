import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaBullseye, FaCalendarAlt, FaDollarSign, FaInfoCircle, FaPiggyBank } from 'react-icons/fa';
import Picker from 'emoji-picker-react';
import styles from './GoalsPage.module.css';

// Helper to format currency
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00'; // Or your preferred currency symbol
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Helper to format date for display
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

// Helper to format date for input type="date"
const formatDateForInput = (dateStringOrDate) => {
    if (!dateStringOrDate) return '';
    const date = new Date(dateStringOrDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


function GoalsPage() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Add New Goal Form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newGoalDescription, setNewGoalDescription] = useState('');
    const [newGoalTargetAmount, setNewGoalTargetAmount] = useState('');
    const [newGoalTargetDate, setNewGoalTargetDate] = useState('');
    const [newGoalIcon, setNewGoalIcon] = useState('🎯');
    const [showNewGoalEmojiPicker, setShowNewGoalEmojiPicker] = useState(false);
    const [isSubmittingNewGoal, setIsSubmittingNewGoal] = useState(false);

    // Edit Goal Form
    const [editingGoal, setEditingGoal] = useState(null);
    const [editDescription, setEditDescription] = useState('');
    const [editTargetAmount, setEditTargetAmount] = useState('');
    const [editTargetDate, setEditTargetDate] = useState('');
    const [editSavedAmount, setEditSavedAmount] = useState('');
    const [editStatus, setEditStatus] = useState('active');
    const [editIcon, setEditIcon] = useState('🎯');
    const [showEditGoalEmojiPicker, setShowEditGoalEmojiPicker] = useState(false);
    const [isSubmittingEditGoal, setIsSubmittingEditGoal] = useState(false);

    // Contribution Modal/Form
    const [showContributeModal, setShowContributeModal] = useState(false);
    const [contributionGoal, setContributionGoal] = useState(null);
    const [contributionAmount, setContributionAmount] = useState('');
    const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
    const [currentUserCumulativeSavings, setCurrentUserCumulativeSavings] = useState(0);
    const [loadingCumulativeSavings, setLoadingCumulativeSavings] = useState(true);


    const minDateForInput = formatDateForInput(new Date(new Date().setDate(new Date().getDate() + 1)));

    const fetchUserCumulativeSavings = useCallback(async () => {
        setLoadingCumulativeSavings(true);
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                // No error toast here, just won't fetch
                setLoadingCumulativeSavings(false);
                setCurrentUserCumulativeSavings(0); // Reset if no token
                return;
            }
            const { data: monthlySavingsRaw } = await axios.get('/api/transactions/savings/monthly', {
                 headers: { Authorization: `Bearer ${token}` },
            });

            if (monthlySavingsRaw && monthlySavingsRaw.length > 0) {
                let cumulativeTotal = 0;
                monthlySavingsRaw.forEach(item => {
                    cumulativeTotal += (item.savings || 0); // Ensure item.savings is a number
                });
                setCurrentUserCumulativeSavings(cumulativeTotal);
            } else {
                setCurrentUserCumulativeSavings(0);
            }
        } catch (err) {
            console.error('Error fetching cumulative savings for GoalsPage:', err);
            // Optionally, set an error state for cumulative savings or a soft toast
            // toast.warn('Could not refresh cumulative savings data.');
            setCurrentUserCumulativeSavings(0); // Reset on error
        } finally {
            setLoadingCumulativeSavings(false);
        }
    }, []);

    const fetchGoals = useCallback(async () => {
        setLoading(true); 
        // setError(''); // Clear previous page-level errors before fetching goals
        try {
            const token = localStorage.getItem('authToken');
            if (!token) { 
                setError('Please log in to manage goals.'); 
                setLoading(false); 
                setGoals([]); // Clear goals if not logged in
                return; 
            }
            const response = await axios.get('/api/goals', { headers: { Authorization: `Bearer ${token}` } });
            setGoals(response.data || []);
            setError(''); // Clear error on successful fetch
        } catch (err) {
            console.error('Error fetching goals:', err);
            const msg = err.response?.data?.message || 'Failed to load goals.';
            setError(msg); 
            // toast.error(msg); // Toasting here might be too much for a background refresh
            setGoals([]); // Clear goals on error
        } finally { 
            setLoading(false); 
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if(token){
            fetchGoals();
            fetchUserCumulativeSavings();
        } else {
            setError("Please log in to access goals.");
            setLoading(false);
            setLoadingCumulativeSavings(false);
            setGoals([]);
            setCurrentUserCumulativeSavings(0);
        }

        // --- EVENT LISTENER FOR EXTERNAL DATA UPDATES ---
        const handleExternalDataUpdate = () => {
            console.log("GoalsPage received transactions-updated event, re-fetching data...");
            if (localStorage.getItem('authToken')) {
                fetchGoals();
                fetchUserCumulativeSavings();
            }
        };

        window.addEventListener('transactions-updated', handleExternalDataUpdate);
        // Listen for a more specific event if you add one after goal contribution
        // window.addEventListener('goal-contribution-made', handleExternalDataUpdate); 

        return () => {
            window.removeEventListener('transactions-updated', handleExternalDataUpdate);
            // window.removeEventListener('goal-contribution-made', handleExternalDataUpdate);
        };
        // --- END OF EVENT LISTENER ---

    }, [fetchGoals, fetchUserCumulativeSavings]); // Dependencies

    const handleAddNewGoal = async (e) => {
        e.preventDefault();
        if (!newGoalDescription.trim() || !newGoalTargetAmount || !newGoalTargetDate) {
            toast.error('Description, target amount, and target date are required.'); return;
        }
        if (parseFloat(newGoalTargetAmount) <= 0) { toast.error('Target amount must be positive.'); return; }
        if (new Date(newGoalTargetDate + "T00:00:00.000Z") <= new Date(new Date().setUTCHours(0,0,0,0))) {
            toast.error('Target date must be in the future.'); return;
        }
        setIsSubmittingNewGoal(true);
        try {
            const token = localStorage.getItem('authToken');
            const payload = { description: newGoalDescription.trim(), targetAmount: parseFloat(newGoalTargetAmount), targetDate: newGoalTargetDate, icon: newGoalIcon };
            await axios.post('/api/goals', payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Goal added!'); 
            fetchGoals(); // Refresh goals list
            // No need to call fetchUserCumulativeSavings here as adding a goal doesn't change it
            setShowAddForm(false); setNewGoalDescription(''); setNewGoalTargetAmount(''); setNewGoalTargetDate(''); setNewGoalIcon('🎯'); setShowNewGoalEmojiPicker(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add goal.');
        } finally { setIsSubmittingNewGoal(false); }
    };

    const handleEditGoalClick = (goal) => {
        setEditingGoal(goal);
        setEditDescription(goal.description);
        setEditTargetAmount(goal.targetAmount.toString());
        setEditTargetDate(formatDateForInput(goal.targetDate));
        setEditSavedAmount(goal.savedAmount.toString());
        setEditStatus(goal.status);
        setEditIcon(goal.icon || '🎯');
        setShowAddForm(false);
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;
        if (!editDescription.trim() || !editTargetAmount || !editTargetDate || editSavedAmount === '') {
            toast.error('All fields are required for editing.'); return;
        }
        if (parseFloat(editTargetAmount) <= 0) { toast.error('Target amount must be positive.'); return; }
        if (parseFloat(editSavedAmount) < 0) { toast.error('Saved amount cannot be negative.'); return; }

        const targetDateObj = new Date(editTargetDate + "T00:00:00.000Z");
        const todayStartDate = new Date(new Date().setUTCHours(0,0,0,0));

        if (targetDateObj <= todayStartDate && editStatus !== 'achieved') {
             toast.error('Target date must be in the future for active goals.'); return;
        }
        setIsSubmittingEditGoal(true);
        try {
            const token = localStorage.getItem('authToken');
            const payload = { description: editDescription.trim(), targetAmount: parseFloat(editTargetAmount), targetDate: editTargetDate, savedAmount: parseFloat(editSavedAmount), status: editStatus, icon: editIcon };
            await axios.put(`/api/goals/${editingGoal._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Goal updated!'); 
            fetchGoals(); 
            // If savedAmount changed, cumulative might be affected IF goal contributions were the only source.
            // However, savedAmount here is a direct edit, not necessarily a transaction.
            // So, re-fetching cumulative savings might not be strictly needed unless other logic depends on it immediately.
            // For safety, or if other components rely on this being super fresh:
            // fetchUserCumulativeSavings(); 
            setEditingGoal(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update goal.');
        } finally { setIsSubmittingEditGoal(false); }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm('Delete this goal? This action cannot be undone.')) return;
        try {
            const token = localStorage.getItem('authToken');
            await axios.delete(`/api/goals/${goalId}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Goal deleted!'); 
            fetchGoals();
            // Deleting a goal definition doesn't directly affect past transactions or cumulative savings.
            if (editingGoal?._id === goalId) setEditingGoal(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete goal.');
        }
    };

    const openContributeModal = (goal) => {
        if (loadingCumulativeSavings && !currentUserCumulativeSavings) { // Check if not yet loaded
            toast.info("Loading your savings data, please wait a moment...");
            fetchUserCumulativeSavings(); // Attempt to re-fetch if it wasn't loaded
            return;
        }
        setContributionGoal(goal);
        setContributionAmount('');
        setShowContributeModal(true);
    };

    const handleContributeToGoal = async (e) => {
        e.preventDefault();
        if (!contributionGoal || !contributionAmount) {
            toast.error('Please enter an amount to contribute.'); return;
        }
        const amountToContribute = parseFloat(contributionAmount);
        if (amountToContribute <= 0) { toast.error('Contribution amount must be positive.'); return; }
        
        const remainingNeeded = contributionGoal.targetAmount - contributionGoal.savedAmount;
        if (amountToContribute > remainingNeeded) {
            toast.warn(`Amount exceeds remaining needed (${formatCurrency(remainingNeeded)}). Contribution will be capped if necessary by the backend.`);
            // Allow to proceed, backend will cap if needed and update goal status.
        }
        if (amountToContribute > currentUserCumulativeSavings) {
            toast.error(`Cannot contribute ${formatCurrency(amountToContribute)}. Your current total cumulative savings is only ${formatCurrency(currentUserCumulativeSavings)}.`); return;
        }

        setIsSubmittingContribution(true);
        try {
            const token = localStorage.getItem('authToken');
            await axios.post(`/api/goals/${contributionGoal._id}/contribute`, { amount: amountToContribute }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Successfully contributed to "${contributionGoal.description}"!`);
            fetchGoals(); // Refresh goals to show updated savedAmount & progress
            fetchUserCumulativeSavings(); // ESSENTIAL: Refresh cumulative savings as a transaction was made
            setShowContributeModal(false);
            setContributionGoal(null);
            setContributionAmount(''); // Reset amount
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to contribute to goal.');
        } finally {
            setIsSubmittingContribution(false);
        }
    };


    // Initial loading state for the whole page (goals mainly)
    if (loading && goals.length === 0) return <div className={styles.container}><p className={styles.loadingText}>Loading goals...</p></div>;
    // Show page-level error if initial goal fetch failed and no goals are loaded
    if (error && goals.length === 0 && !loading) return <div className={styles.container}><p className={styles.errorText}>{error}</p></div>;


    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1><FaBullseye /> Financial Goals</h1>
                <button onClick={() => { setShowAddForm(!showAddForm); setEditingGoal(null); }} className={styles.addButton}>
                    {showAddForm ? <FaTimes /> : <FaPlus />} {showAddForm ? 'Cancel' : 'Add New Goal'}
                </button>
            </div>
            {/* Show error if it exists, even if some goals are loaded (e.g., from a failed refresh) */}
            {error && <p className={`${styles.errorText} ${styles.errorTextSmall}`}>{error}</p>}


            {showAddForm && (
                <div className={styles.formContainer}>
                    <h3>Add New Goal</h3>
                    <form onSubmit={handleAddNewGoal} className={styles.goalForm}>
                         <div className={styles.formRow}>
                            <div className={styles.formGroup} style={{ flexBasis: '10%', minWidth: '60px' }}>
                                <label htmlFor="newGoalIcon">Icon</label>
                                <button type="button" id="newGoalIcon" className={styles.emojiButton} onClick={() => setShowNewGoalEmojiPicker(prev => !prev)} > {newGoalIcon} </button>
                                {showNewGoalEmojiPicker && (<div className={styles.emojiPickerPopover}><Picker onEmojiClick={(e) => { setNewGoalIcon(e.emoji); setShowNewGoalEmojiPicker(false);}} theme="auto" pickerStyle={{ width: '100%' }} /></div>)}
                            </div>
                            <div className={styles.formGroup} style={{ flexBasis: '85%'}}>
                                <label htmlFor="newGoalDescription"><FaInfoCircle /> Description</label>
                                <input type="text" id="newGoalDescription" value={newGoalDescription} onChange={(e) => setNewGoalDescription(e.target.value)} placeholder="e.g., Save for Vacation" required />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="newGoalTargetAmount"><FaDollarSign /> Target Amount</label>
                                <input type="number" id="newGoalTargetAmount" value={newGoalTargetAmount} onChange={(e) => setNewGoalTargetAmount(e.target.value)} placeholder="e.g., 1000" min="0.01" step="0.01" required />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="newGoalTargetDate"><FaCalendarAlt /> Target Date</label>
                                <input type="date" id="newGoalTargetDate" value={newGoalTargetDate} onChange={(e) => setNewGoalTargetDate(e.target.value)} min={minDateForInput} required />
                            </div>
                        </div>
                        <button type="submit" className={styles.submitButton} disabled={isSubmittingNewGoal}>
                            {isSubmittingNewGoal ? 'Adding...' : 'Add Goal'}
                        </button>
                    </form>
                </div>
            )}

            {editingGoal && (
                 <div className={styles.formContainer} style={{ borderColor: 'var(--edit-accent-light, #ffc107)'}}>
                    <h3>Edit Goal: {editingGoal.icon} {editingGoal.description.substring(0,30)}{editingGoal.description.length > 30 ? '...' : ''}</h3>
                    <form onSubmit={handleUpdateGoal} className={styles.goalForm}>
                        <div className={styles.formRow}>
                             <div className={styles.formGroup} style={{ flexBasis: '10%', minWidth: '60px'}}>
                                <label htmlFor="editGoalIcon">Icon</label>
                                <button type="button" id="editGoalIcon" className={styles.emojiButton} onClick={() => setShowEditGoalEmojiPicker(prev => !prev)} > {editIcon} </button>
                                {showEditGoalEmojiPicker && (<div className={styles.emojiPickerPopover}><Picker onEmojiClick={(e) => { setEditIcon(e.emoji); setShowEditGoalEmojiPicker(false);}} theme="auto" pickerStyle={{ width: '100%' }}/></div>)}
                            </div>
                            <div className={styles.formGroup} style={{ flexBasis: '85%'}}>
                                <label htmlFor="editDescription"><FaInfoCircle /> Description</label>
                                <input type="text" id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} required />
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="editTargetAmount"><FaDollarSign /> Target Amount</label>
                                <input type="number" id="editTargetAmount" value={editTargetAmount} onChange={(e) => setEditTargetAmount(e.target.value)} min="0.01" step="0.01" required />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="editTargetDate"><FaCalendarAlt /> Target Date</label>
                                <input type="date" id="editTargetDate" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} min={editingGoal.status === 'achieved' ? undefined : minDateForInput} required />
                            </div>
                        </div>
                         <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="editSavedAmount">Saved Amount</label>
                                <input type="number" id="editSavedAmount" value={editSavedAmount} onChange={(e) => setEditSavedAmount(e.target.value)} min="0" step="0.01" max={editTargetAmount} required />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="editStatus">Status</label>
                                <select id="editStatus" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                                    <option value="active">Active</option>
                                    <option value="achieved">Achieved</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.editActions}>
                            <button type="submit" className={styles.submitButton} disabled={isSubmittingEditGoal}>
                                {isSubmittingEditGoal ? 'Saving...' : <><FaSave /> Save Changes</>}
                            </button>
                            <button type="button" onClick={() => setEditingGoal(null)} className={styles.cancelButton}> <FaTimes /> Cancel </button>
                        </div>
                    </form>
                </div>
            )}

            {showContributeModal && contributionGoal && (
                <div className={styles.modalOverlay} onClick={() => setShowContributeModal(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Contribute to: {contributionGoal.icon} {contributionGoal.description}</h3>
                        <p>Target: {formatCurrency(contributionGoal.targetAmount)} | Saved: {formatCurrency(contributionGoal.savedAmount)}</p>
                        <p>Remaining to Save: <strong style={{color: 'var(--primary-accent-light)'}}>{formatCurrency(contributionGoal.remainingAmount)}</strong></p>
                        <hr className={styles.modalHr}/>
                        <p className={styles.cumulativeSavingsInfo}>
                            Your Current Total Cumulative Savings: 
                            {loadingCumulativeSavings ? ' Loading...' : <strong> {formatCurrency(currentUserCumulativeSavings)}</strong>}
                        </p>
                        <form onSubmit={handleContributeToGoal} className={styles.goalForm} style={{gap: '15px', marginTop: '15px'}}>
                            <div className={styles.formGroup}>
                                <label htmlFor="contributionAmount"><FaDollarSign /> Amount to Add to Goal Savings</label>
                                <input
                                    type="number"
                                    id="contributionAmount"
                                    value={contributionAmount}
                                    onChange={(e) => setContributionAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0.01"
                                    step="0.01"
                                    max={Math.min(contributionGoal.remainingAmount, currentUserCumulativeSavings > 0 ? currentUserCumulativeSavings : 0).toFixed(2)} // Ensure max is not negative
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className={styles.editActions} style={{justifyContent: 'flex-end'}}>
                                <button type="button" onClick={() => setShowContributeModal(false)} className={`${styles.cancelButton} ${styles.modalButton}`}>
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`${styles.submitButton} ${styles.modalButton}`} 
                                    disabled={
                                        isSubmittingContribution || 
                                        loadingCumulativeSavings || 
                                        parseFloat(contributionAmount) <= 0 || // Must be positive
                                        isNaN(parseFloat(contributionAmount)) || // Must be a number
                                        parseFloat(contributionAmount) > currentUserCumulativeSavings || 
                                        parseFloat(contributionAmount) > contributionGoal.remainingAmount
                                    }
                                >
                                    {isSubmittingContribution ? 'Contributing...' : 'Save to Goal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            <div className={styles.goalsList}>
                {(goals.length === 0 && !showAddForm && !editingGoal && !loading) && ( // Show no goals only if not loading and no forms open
                    <p className={styles.noGoalsText}>No goals set yet. Click "Add New Goal" to start!</p>
                )}
                {goals.map((goal) => (
                    <div key={goal._id} className={`${styles.goalItem} ${styles['status' + goal.status.charAt(0).toUpperCase() + goal.status.slice(1)]}`}>
                        <div className={styles.goalHeader}>
                           <span className={styles.goalIcon}>{goal.icon || '🎯'}</span>
                           <h4 className={styles.goalDescription}>{goal.description}</h4>
                           <div className={styles.goalActions}>
                                <button onClick={() => handleEditGoalClick(goal)} className={styles.actionButton} title="Edit Goal"><FaEdit /></button>
                                <button onClick={() => handleDeleteGoal(goal._id)} className={`${styles.actionButton} ${styles.deleteAction}`} title="Delete Goal"><FaTrash /></button>
                            </div>
                        </div>
                        <div className={styles.goalDetails}>
                            <p>Target: <strong>{formatCurrency(goal.targetAmount)}</strong></p>
                            <p>Saved: <strong>{formatCurrency(goal.savedAmount)}</strong> ({goal.progress ? goal.progress.toFixed(1) : '0.0'}%)</p>
                            <p className={styles.remainingAmount}>Remaining: <strong>{formatCurrency(goal.remainingAmount)}</strong></p>
                            <p>Deadline: <strong>{formatDateDisplay(goal.targetDate)}</strong></p>
                            <p>Status: <span className={`${styles.statusBadge} ${styles['badge' + goal.status.charAt(0).toUpperCase() + goal.status.slice(1)]}`}>{goal.status}</span></p>
                        </div>
                        <div className={styles.progressBarContainer}>
                            <div
                                className={styles.progressBar}
                                style={{ width: `${goal.progress ? (goal.progress > 100 ? 100 : goal.progress) : 0}%` }}
                                title={`${goal.progress ? goal.progress.toFixed(1) : '0.0'}% Complete`}
                            >
                              {goal.progress && goal.progress > 10 && `${goal.progress.toFixed(0)}%`}
                            </div>
                        </div>
                        {goal.status === 'active' && goal.remainingAmount > 0 && (
                            <button 
                                onClick={() => openContributeModal(goal)} 
                                className={styles.contributeButton}
                                disabled={loadingCumulativeSavings} // Disable if cumulative savings still loading
                            >
                                <FaPiggyBank /> Add to Savings
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GoalsPage;