import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaBullseye, FaCalendarAlt, FaDollarSign, FaInfoCircle } from 'react-icons/fa';
import Picker from 'emoji-picker-react'; // Assuming you want an icon picker
import styles from './GoalsPage.module.css'; // We'll create this CSS file

// Helper to format currency (can be imported from a utils file)
const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

// Helper to format date for display
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

// Helper to format date for input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateStringOrDate) => {
    if (!dateStringOrDate) return '';
    const date = new Date(dateStringOrDate);
     // Adjust for timezone offset to get correct YYYY-MM-DD for local date
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};


function GoalsPage() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state for adding a new goal
    const [showAddForm, setShowAddForm] = useState(false);
    const [newGoalDescription, setNewGoalDescription] = useState('');
    const [newGoalTargetAmount, setNewGoalTargetAmount] = useState('');
    const [newGoalTargetDate, setNewGoalTargetDate] = useState('');
    const [newGoalIcon, setNewGoalIcon] = useState('🎯');
    const [showNewGoalEmojiPicker, setShowNewGoalEmojiPicker] = useState(false);
    const [isSubmittingNewGoal, setIsSubmittingNewGoal] = useState(false);

    // Form state for editing a goal
    const [editingGoal, setEditingGoal] = useState(null); // Stores the goal object being edited
    const [editDescription, setEditDescription] = useState('');
    const [editTargetAmount, setEditTargetAmount] = useState('');
    const [editTargetDate, setEditTargetDate] = useState('');
    const [editSavedAmount, setEditSavedAmount] = useState('');
    const [editStatus, setEditStatus] = useState('active');
    const [editIcon, setEditIcon] = useState('🎯');
    const [showEditGoalEmojiPicker, setShowEditGoalEmojiPicker] = useState(false);
    const [isSubmittingEditGoal, setIsSubmittingEditGoal] = useState(false);

    const minDateForInput = formatDateForInput(new Date(new Date().setDate(new Date().getDate() + 1))); // Tomorrow

    const fetchGoals = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setError('Please log in to manage goals.');
                setLoading(false);
                return;
            }
            const response = await axios.get('/api/goals', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setGoals(response.data || []);
        } catch (err) {
            console.error('Error fetching goals:', err);
            setError(err.response?.data?.message || 'Failed to load goals.');
            toast.error(err.response?.data?.message || 'Failed to load goals.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    const handleAddNewGoal = async (e) => {
        e.preventDefault();
        if (!newGoalDescription.trim() || !newGoalTargetAmount || !newGoalTargetDate) {
            toast.error('Please fill in description, target amount, and target date.');
            return;
        }
        if (parseFloat(newGoalTargetAmount) <= 0) {
            toast.error('Target amount must be positive.');
            return;
        }
        if (new Date(newGoalTargetDate) <= new Date()) {
            toast.error('Target date must be in the future.');
            return;
        }

        setIsSubmittingNewGoal(true);
        try {
            const token = localStorage.getItem('authToken');
            const payload = {
                description: newGoalDescription.trim(),
                targetAmount: parseFloat(newGoalTargetAmount),
                targetDate: newGoalTargetDate,
                icon: newGoalIcon,
            };
            await axios.post('/api/goals', payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Goal added successfully!');
            fetchGoals(); // Refresh goals list
            // Reset form
            setShowAddForm(false);
            setNewGoalDescription('');
            setNewGoalTargetAmount('');
            setNewGoalTargetDate('');
            setNewGoalIcon('🎯');
            setShowNewGoalEmojiPicker(false);
        } catch (err) {
            console.error('Error adding goal:', err);
            toast.error(err.response?.data?.message || 'Failed to add goal.');
        } finally {
            setIsSubmittingNewGoal(false);
        }
    };

    const handleEditGoal = (goal) => {
        setEditingGoal(goal);
        setEditDescription(goal.description);
        setEditTargetAmount(goal.targetAmount.toString());
        setEditTargetDate(formatDateForInput(goal.targetDate));
        setEditSavedAmount(goal.savedAmount.toString());
        setEditStatus(goal.status);
        setEditIcon(goal.icon || '🎯');
        setShowAddForm(false); // Hide add form if open
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!editingGoal) return;

        if (!editDescription.trim() || !editTargetAmount || !editTargetDate || editSavedAmount === '') {
            toast.error('Please fill in all fields for editing.');
            return;
        }
        if (parseFloat(editTargetAmount) <= 0) {
            toast.error('Target amount must be positive.');
            return;
        }
         if (parseFloat(editSavedAmount) < 0) {
            toast.error('Saved amount cannot be negative.');
            return;
        }
        if (new Date(editTargetDate) <= new Date() && editStatus !== 'achieved') {
             toast.error('Target date must be in the future for active goals.');
             return;
        }


        setIsSubmittingEditGoal(true);
        try {
            const token = localStorage.getItem('authToken');
            const payload = {
                description: editDescription.trim(),
                targetAmount: parseFloat(editTargetAmount),
                targetDate: editTargetDate,
                savedAmount: parseFloat(editSavedAmount),
                status: editStatus,
                icon: editIcon,
            };
            await axios.put(`/api/goals/${editingGoal._id}`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Goal updated successfully!');
            fetchGoals();
            setEditingGoal(null); // Close edit form
        } catch (err) {
            console.error('Error updating goal:', err);
            toast.error(err.response?.data?.message || 'Failed to update goal.');
        } finally {
            setIsSubmittingEditGoal(false);
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm('Are you sure you want to delete this goal?')) return;
        try {
            const token = localStorage.getItem('authToken');
            await axios.delete(`/api/goals/${goalId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Goal deleted successfully!');
            fetchGoals();
            if (editingGoal && editingGoal._id === goalId) {
                setEditingGoal(null); // Close edit form if the deleted goal was being edited
            }
        } catch (err) {
            console.error('Error deleting goal:', err);
            toast.error(err.response?.data?.message || 'Failed to delete goal.');
        }
    };


    if (loading) {
        return <div className={styles.container}><p className={styles.loadingText}>Loading goals...</p></div>;
    }
    if (error) {
        return <div className={styles.container}><p className={styles.errorText}>{error}</p></div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1><FaBullseye /> Financial Goals</h1>
                <button
                    onClick={() => { setShowAddForm(!showAddForm); setEditingGoal(null); }}
                    className={styles.addButton}
                >
                    {showAddForm ? <FaTimes /> : <FaPlus />} {showAddForm ? 'Cancel' : 'Add New Goal'}
                </button>
            </div>

            {/* Add New Goal Form */}
            {showAddForm && (
                <div className={styles.formContainer}>
                    <h3>Add New Goal</h3>
                    <form onSubmit={handleAddNewGoal} className={styles.goalForm}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup} style={{ flexBasis: '10%'}}>
                                <label htmlFor="newGoalIcon">Icon</label>
                                <button
                                    type="button" id="newGoalIcon"
                                    className={styles.emojiButton}
                                    onClick={() => setShowNewGoalEmojiPicker(!showNewGoalEmojiPicker)}
                                >
                                    {newGoalIcon}
                                </button>
                                {showNewGoalEmojiPicker && (
                                    <div className={styles.emojiPickerPopover}>
                                        <Picker onEmojiClick={(emojiData) => { setNewGoalIcon(emojiData.emoji); setShowNewGoalEmojiPicker(false); }} />
                                    </div>
                                )}
                            </div>
                            <div className={styles.formGroup} style={{ flexBasis: '85%'}}>
                                <label htmlFor="newGoalDescription"><FaInfoCircle /> Description</label>
                                <input
                                    type="text"
                                    id="newGoalDescription"
                                    value={newGoalDescription}
                                    onChange={(e) => setNewGoalDescription(e.target.value)}
                                    placeholder="e.g., Save for Vacation"
                                    required
                                />
                            </div>
                        </div>
                         <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="newGoalTargetAmount"><FaDollarSign /> Target Amount</label>
                                <input
                                    type="number"
                                    id="newGoalTargetAmount"
                                    value={newGoalTargetAmount}
                                    onChange={(e) => setNewGoalTargetAmount(e.target.value)}
                                    placeholder="e.g., 1000"
                                    min="0.01"
                                    step="0.01"
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="newGoalTargetDate"><FaCalendarAlt /> Target Date</label>
                                <input
                                    type="date"
                                    id="newGoalTargetDate"
                                    value={newGoalTargetDate}
                                    onChange={(e) => setNewGoalTargetDate(e.target.value)}
                                    min={minDateForInput}
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" className={styles.submitButton} disabled={isSubmittingNewGoal}>
                            {isSubmittingNewGoal ? 'Adding...' : 'Add Goal'}
                        </button>
                    </form>
                </div>
            )}

            {/* Edit Goal Form */}
            {editingGoal && (
                 <div className={styles.formContainer} style={{ borderColor: 'var(--accent-color-edit, #ffc107)'}}>
                    <h3>Edit Goal: {editingGoal.icon} {editingGoal.description.substring(0,30)}{editingGoal.description.length > 30 ? '...' : ''}</h3>
                    <form onSubmit={handleUpdateGoal} className={styles.goalForm}>
                        <div className={styles.formRow}>
                             <div className={styles.formGroup} style={{ flexBasis: '10%'}}>
                                <label htmlFor="editGoalIcon">Icon</label>
                                <button
                                    type="button" id="editGoalIcon"
                                    className={styles.emojiButton}
                                    onClick={() => setShowEditGoalEmojiPicker(!showEditGoalEmojiPicker)}
                                >
                                    {editIcon}
                                </button>
                                {showEditGoalEmojiPicker && (
                                    <div className={styles.emojiPickerPopover}>
                                        <Picker onEmojiClick={(emojiData) => { setEditIcon(emojiData.emoji); setShowEditGoalEmojiPicker(false); }} />
                                    </div>
                                )}
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
                                <input type="date" id="editTargetDate" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} min={minDateForInput} required />
                            </div>
                        </div>
                         <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="editSavedAmount">Saved Amount</label>
                                <input type="number" id="editSavedAmount" value={editSavedAmount} onChange={(e) => setEditSavedAmount(e.target.value)} min="0" step="0.01" required />
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
                            <button type="button" onClick={() => setEditingGoal(null)} className={styles.cancelButton}>
                                <FaTimes /> Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}


            {/* Goals List */}
            <div className={styles.goalsList}>
                {goals.length === 0 && !showAddForm && (
                    <p className={styles.noGoalsText}>No goals set yet. Click "Add New Goal" to start!</p>
                )}
                {goals.map((goal) => (
                    <div key={goal._id} className={`${styles.goalItem} ${styles[goal.status]}`}>
                        <div className={styles.goalHeader}>
                           <span className={styles.goalIcon}>{goal.icon || '🎯'}</span>
                           <h4 className={styles.goalDescription}>{goal.description}</h4>
                           <div className={styles.goalActions}>
                                <button onClick={() => handleEditGoal(goal)} className={styles.actionButton} title="Edit Goal"><FaEdit /></button>
                                <button onClick={() => handleDeleteGoal(goal._id)} className={styles.actionButton} title="Delete Goal"><FaTrash /></button>
                            </div>
                        </div>
                        <div className={styles.goalDetails}>
                            <p>Target: <strong>{formatCurrency(goal.targetAmount)}</strong></p>
                            <p>Saved: <strong>{formatCurrency(goal.savedAmount)}</strong> ({goal.progress.toFixed(1)}%)</p>
                            <p>Remaining: <strong>{formatCurrency(goal.remainingAmount)}</strong></p>
                            <p>Deadline: <strong>{formatDateDisplay(goal.targetDate)}</strong></p>
                            <p>Status: <span className={`${styles.statusBadge} ${styles['status' + goal.status.charAt(0).toUpperCase() + goal.status.slice(1)]}`}>{goal.status}</span></p>
                        </div>
                        <div className={styles.progressBarContainer}>
                            <div
                                className={styles.progressBar}
                                style={{ width: `${goal.progress}%` }}
                                title={`${goal.progress.toFixed(1)}% Complete`}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GoalsPage;