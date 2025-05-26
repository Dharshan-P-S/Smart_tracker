// frontend/src/pages/SmartAssistantPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios'; // For backend API calls
import { toast } from 'react-toastify';
import { sendToWit } from '../utils/witClient';
import styles from './SmartAssistantPage.module.css';

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const formatDateForDisplay = (dateString) => {
  if (!dateString) return 'today';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'an unspecified date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inputDateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (inputDateObj.getTime() === today.getTime()) return 'today';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
};

const parseWitDateTimeToQueryParams = (dateTimeEntity, isTotalQueryHint = false) => {
    if (!dateTimeEntity || !dateTimeEntity.values || dateTimeEntity.values.length === 0) {
        if (isTotalQueryHint) {
            return { description: "of all time" }; 
        }
        return { periodKeyword: 'current_month', description: "the current month" };
    }

    const value = dateTimeEntity.values[0];
    const toYMD = (dateStr) => new Date(dateStr).toISOString().split('T')[0];
    let queryParams = {};
    let description = "";

    if (value.to && value.from) {
        const fromDate = new Date(value.from);
        const toDate = new Date(value.to); 
        queryParams.startDate = toYMD(value.from);
        queryParams.endDate = toYMD(value.to); 
        let toDateForDisplay = new Date(toDate.getTime());
        if ((value.grain === 'month' || value.grain === 'day' || value.grain === 'year') &&
            toDate.getUTCDate() === 1 && toDate.getUTCHours() === 0 &&
            toDate.getUTCMinutes() === 0 && toDate.getUTCSeconds() === 0) {
            if (value.grain === 'month' && fromDate.getUTCMonth() === new Date(new Date(value.to).getTime() - (24*60*60*1000)).getUTCMonth() ) {
                 toDateForDisplay = new Date(toDate.getTime() - (24 * 60 * 60 * 1000));
            } else if (value.grain === 'year' && fromDate.getUTCFullYear() === new Date(new Date(value.to).getTime() - (24*60*60*1000)).getUTCFullYear() ) {
                 toDateForDisplay = new Date(toDate.getTime() - (24 * 60 * 60 * 1000));
            } else if (value.grain === 'day') {
                 // No adjustment
            } else if (toDate.getUTCDate() === 1 && (value.grain === 'month' || value.grain === 'year')) {
                 toDateForDisplay = new Date(toDate.getTime() - (24 * 60 * 60 * 1000));
            }
        }
        const fromStr = formatDateForDisplay(value.from);
        const toStr = formatDateForDisplay(toDateForDisplay);
        if (value.grain === 'day' && toYMD(value.from) === toYMD(toDateForDisplay)) {
            description = `for ${fromStr}`;
        } else if (value.grain === 'month' && 
                   fromDate.getUTCDate() === 1 && 
                   (new Date(toDateForDisplay).getTime() - fromDate.getTime() < 31 * 24 * 60 * 60 * 1000) &&
                   fromDate.getUTCMonth() === toDateForDisplay.getUTCMonth() &&
                   fromDate.getUTCFullYear() === toDateForDisplay.getUTCFullYear()) {
            description = `for ${fromDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
        } else if (value.grain === 'year' && 
                   fromDate.getUTCDate() === 1 && fromDate.getUTCMonth() === 0 &&
                   (new Date(toDateForDisplay).getTime() - fromDate.getTime() < 366 * 24 * 60 * 60 * 1000) &&
                   fromDate.getUTCFullYear() === toDateForDisplay.getUTCFullYear()) {
            description = `for ${fromDate.getUTCFullYear()}`;
        } else {
            description = `from ${fromStr} to ${toStr}`;
        }
    } else if (value.value) { 
        queryParams.startDate = toYMD(value.value);
        queryParams.endDate = toYMD(value.value); 
        description = `for ${formatDateForDisplay(value.value)}`;
    } else {
        if (isTotalQueryHint) {
            return { description: "of all time" };
        }
        queryParams.periodKeyword = 'current_month';
        description = "the current month";
    }
    return { ...queryParams, description };
};


const SmartAssistantPage = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([
    { id: generateId(), sender: 'assistant', text: "Hello! How can I assist you? Try 'Earned $500 from Freelance last week', 'Set goal for Vacation $500 by December', 'Add $20 to Vacation goal', 'Show my expenses', 'Total expenses for food?', 'My total income', 'How much salary last month?', 'What is my goal for New Car?', or 'Limit for Groceries?'" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [limits, setLimits] = useState([]); 
  const [limitsLoading, setLimitsLoading] = useState(true); 
  const [currentUserCumulativeSavings, setCurrentUserCumulativeSavings] = useState(0);
  const [loadingCumulativeSavings, setLoadingCumulativeSavings] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

    const fetchGoals = useCallback(async () => {
        setGoalsLoading(true);
        setFetchError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setFetchError('Please log in to manage goals.');
                setGoals([]);
                return;
            }
            const response = await axios.get('/api/goals', { headers: { Authorization: `Bearer ${token}` } });
            setGoals(response.data || []);
        } catch (err) {
            console.error('Error fetching goals for assistant:', err);
            setFetchError(err.response?.data?.message || 'Failed to load goals.');
            setGoals([]);
        } finally {
            setGoalsLoading(false);
        }
    }, []);

    const fetchLimits = useCallback(async () => {
        setLimitsLoading(true);
        setFetchError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setFetchError('Please log in to manage limits.');
                setLimits([]);
                return;
            }
            const response = await axios.get('/api/limits', { headers: { Authorization: `Bearer ${token}` } });
            setLimits(response.data || []);
        } catch (err) {
            console.error('Error fetching limits for assistant:', err);
            setFetchError(err.response?.data?.message || 'Failed to load limits.');
            setLimits([]);
        } finally {
            setLimitsLoading(false);
        }
    }, []);


    const fetchUserCumulativeSavings = useCallback(async () => {
        setLoadingCumulativeSavings(true);
        setFetchError('');
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setFetchError('Please log in to view savings data.');
                setCurrentUserCumulativeSavings(0);
                return;
            }
            const { data: monthlySavingsRaw } = await axios.get('/api/transactions/savings/monthly', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (monthlySavingsRaw && monthlySavingsRaw.length > 0) {
                let cumulativeTotal = 0;
                monthlySavingsRaw.forEach(item => {
                    cumulativeTotal += (item.savings || 0);
                });
                setCurrentUserCumulativeSavings(cumulativeTotal);
            } else {
                setCurrentUserCumulativeSavings(0);
            }
        } catch (err) {
            console.error('Error fetching cumulative savings for assistant:', err);
            setFetchError(err.response?.data?.message || 'Failed to load savings data.');
            setCurrentUserCumulativeSavings(0);
        } finally {
            setLoadingCumulativeSavings(false);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            fetchGoals();
            fetchLimits(); 
            fetchUserCumulativeSavings();
        } else {
            setGoalsLoading(false);
            setLimitsLoading(false); 
            setLoadingCumulativeSavings(false);
        }
        const handleDataUpdate = () => {
            if (localStorage.getItem('authToken')) {
                fetchGoals();
                fetchLimits(); 
                fetchUserCumulativeSavings();
            }
        };
        window.addEventListener('transactions-updated', handleDataUpdate);
        window.addEventListener('goals-updated', handleDataUpdate);
        window.addEventListener('limits-updated', handleDataUpdate);

        return () => {
            window.removeEventListener('transactions-updated', handleDataUpdate);
            window.removeEventListener('goals-updated', handleDataUpdate);
            window.removeEventListener('limits-updated', handleDataUpdate);
        };
    }, [fetchGoals, fetchLimits, fetchUserCumulativeSavings]);


  const addMessage = (sender, text, actionDetails = null, isError = false, rawData = null) => {
    setMessages(prev => [...prev, { id: generateId(), sender, text, actionDetails, isError, rawData }]);
  };

  const handleInputChange = (e) => setInputValue(e.target.value);

    const executeAddTransaction = async (transactionData) => {
        setIsLoading(true);
        const transactionType = capitalizeFirstLetter(transactionData.type);
        try {
        const response = await axios.post('/api/transactions', transactionData);
        toast.success(`${transactionType} "${transactionData.description}" of ${formatCurrency(transactionData.amount)} added!`);
        addMessage('assistant', `Great! I've added the ${transactionData.type}: ${formatCurrency(transactionData.amount)} for ${transactionData.description}.`);
        window.dispatchEvent(new CustomEvent('transactions-updated'));
        fetchUserCumulativeSavings();
        return response.data;
        } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || `Failed to add ${transactionData.type}.`;
        toast.error(`Error: ${errorMessage}`);
        addMessage('assistant', `Sorry, I couldn't add the ${transactionData.type}. ${errorMessage}`, null, true);
        throw error; 
        } finally {
            setIsLoading(false);
        }
    };

    const executeAddGoal = async (goalData) => {
        setIsLoading(true);
        try {
        const response = await axios.post('/api/goals', goalData);
        toast.success(`Goal "${goalData.description}" set successfully!`);
        addMessage('assistant', `Okay, I've set a new goal: ${goalData.description} for ${formatCurrency(goalData.targetAmount)} by ${formatDateForDisplay(goalData.targetDate)}.`);
        fetchGoals();
        window.dispatchEvent(new CustomEvent('goals-updated'));
        return response.data;
        } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to set goal.';
        toast.error(`Error: ${errorMessage}`);
        addMessage('assistant', `Sorry, I couldn't set the goal. ${errorMessage}`, null, true);
        throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const executeSetLimit = async (limitData) => {
        setIsLoading(true);
        try {
        const response = await axios.post('/api/limits', limitData);
        toast.success(`Limit for "${limitData.category}" set to ${formatCurrency(limitData.amount)} successfully!`);
        addMessage('assistant', `Alright, I've set a spending limit for ${limitData.category} at ${formatCurrency(limitData.amount)}.`);
        fetchLimits(); 
        window.dispatchEvent(new CustomEvent('limits-updated'));
        return response.data;
        } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to set limit.';
        toast.error(`Error: ${errorMessage}`);
        addMessage('assistant', `Sorry, I couldn't set the limit. ${errorMessage}`, null, true);
        throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const executeContributeToGoal = async (goalId, amount, goalDescription) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            await axios.post(`/api/goals/${goalId}/contribute`, { amount }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(`Contribution of ${formatCurrency(amount)} to "${goalDescription}" successful!`);
            addMessage('assistant', `Successfully added ${formatCurrency(amount)} to your "${goalDescription}" goal!`);
            fetchGoals();
            fetchUserCumulativeSavings();
            window.dispatchEvent(new CustomEvent('transactions-updated'));
            window.dispatchEvent(new CustomEvent('goals-updated'));
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to contribute to goal.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I couldn't contribute to the goal "${goalDescription}". ${errorMessage}`, null, true);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const executeGetExpenseDetails = async (dateTimeEntity, isTotalQuery = false) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const { description: initialPeriodDescription, ...apiParams } = parseWitDateTimeToQueryParams(dateTimeEntity, isTotalQuery);
            
            const response = await axios.get('/api/transactions/expenses/summary', {
                headers: { Authorization: `Bearer ${token}` },
                params: apiParams,
            });
            const data = response.data;
            const finalPeriodDescription = data.period || initialPeriodDescription;

            if (data.totalExpenses > 0) {
                let summaryText = `Okay, here's your expense summary ${finalPeriodDescription}:\n- Total Spent: ${formatCurrency(data.totalExpenses)}\n- Number of Transactions: ${data.count}`;
                if (data.breakdown && data.breakdown.length > 0) {
                    summaryText += "\n\nTop Categories (up to 3):";
                    data.breakdown.slice(0, 3).forEach(item => {
                        summaryText += `\n- ${capitalizeFirstLetter(item.category)}: ${formatCurrency(item.total)} (${item.percentage ? item.percentage.toFixed(1) + '%' : 'N/A'})`;
                    });
                } else if (data.transactions && data.transactions.length > 0) {
                    summaryText += "\n\nRecent Expenses (up to 3):";
                     data.transactions.slice(0,3).forEach(tx => {
                        summaryText += `\n- ${formatDateForDisplay(tx.date)}: ${tx.description} (${formatCurrency(tx.amount)})`;
                     });
                }
                addMessage('assistant', summaryText);
            } else {
                addMessage('assistant', data.message || `No expenses found ${finalPeriodDescription}.`);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch expense summary.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I couldn't fetch the expense summary. ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
    };
    
    const executeGetExpenseByCategory = async (categoryName, dateTimeEntity, isTotalQuery = false) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const { description: initialPeriodDescription, ...apiParams } = parseWitDateTimeToQueryParams(dateTimeEntity, isTotalQuery);
            apiParams.category = categoryName;
            const response = await axios.get('/api/transactions/expenses/summary', {
                headers: { Authorization: `Bearer ${token}` },
                params: apiParams,
            });
            const data = response.data;
            const finalPeriodDescription = data.period || initialPeriodDescription;
            if (data.totalExpenses > 0) {
                let summaryText = `For "${capitalizeFirstLetter(data.category || categoryName)}" ${finalPeriodDescription}:\n- Total Spent: ${formatCurrency(data.totalExpenses)}\n- Number of Transactions: ${data.count}`;
                if (data.averageMonthly) { summaryText += `\n- Average Monthly Spending: ${formatCurrency(data.averageMonthly)}`; }
                if (data.transactions && data.transactions.length > 0) {
                    summaryText += `\n\nRecent Expenses in this category (up to 3):`;
                     data.transactions.slice(0,3).forEach(tx => { summaryText += `\n- ${formatDateForDisplay(tx.date)}: ${tx.description} (${formatCurrency(tx.amount)})`; });
                }
                addMessage('assistant', summaryText);
            } else {
                addMessage('assistant', data.message || `No expenses found for "${capitalizeFirstLetter(categoryName)}" ${finalPeriodDescription}.`);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch category expense summary.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I couldn't fetch the summary for "${capitalizeFirstLetter(categoryName)}". ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
    };

    const executeGetIncomeDetails = async (dateTimeEntity, isTotalQuery = false) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const { description: initialPeriodDescription, ...apiParams } = parseWitDateTimeToQueryParams(dateTimeEntity, isTotalQuery);
            const response = await axios.get('/api/transactions/income/summary', {
                headers: { Authorization: `Bearer ${token}` },
                params: apiParams,
            });
            const data = response.data;
            const finalPeriodDescription = data.period || initialPeriodDescription;
            if (data.totalIncome > 0) { 
                let summaryText = `Okay, here's your income summary ${finalPeriodDescription}:\n- Total Received: ${formatCurrency(data.totalIncome)}\n- Number of Transactions: ${data.count}`;
                if (data.breakdown && data.breakdown.length > 0) {
                    summaryText += "\n\nTop Sources (up to 3):";
                    data.breakdown.slice(0, 3).forEach(item => { summaryText += `\n- ${capitalizeFirstLetter(item.category)}: ${formatCurrency(item.total)} (${item.percentage ? item.percentage.toFixed(1) + '%' : 'N/A'})`; });
                } else if (data.transactions && data.transactions.length > 0) {
                    summaryText += "\n\nRecent Income (up to 3):";
                     data.transactions.slice(0,3).forEach(tx => { summaryText += `\n- ${formatDateForDisplay(tx.date)}: ${tx.description} (${formatCurrency(tx.amount)})`; });
                }
                addMessage('assistant', summaryText);
            } else {
                addMessage('assistant', data.message || `No income found ${finalPeriodDescription}.`);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch income summary.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I couldn't fetch the income summary. ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
      };
    
      const executeGetIncomeByCategory = async (categoryName, dateTimeEntity, isTotalQuery = false) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const { description: initialPeriodDescription, ...apiParams } = parseWitDateTimeToQueryParams(dateTimeEntity, isTotalQuery);
            apiParams.category = categoryName;
            const response = await axios.get('/api/transactions/income/summary', {
                headers: { Authorization: `Bearer ${token}` },
                params: apiParams,
            });
            const data = response.data;
            const finalPeriodDescription = data.period || initialPeriodDescription;
            if (data.totalIncome > 0) { 
                let summaryText = `For income source "${capitalizeFirstLetter(data.category || categoryName)}" ${finalPeriodDescription}:\n- Total Received: ${formatCurrency(data.totalIncome)}\n- Number of Transactions: ${data.count}`;
                if (data.averageMonthly) {  summaryText += `\n- Average Monthly Received: ${formatCurrency(data.averageMonthly)}`; }
                if (data.transactions && data.transactions.length > 0) {
                    summaryText += `\n\nRecent Income from this source (up to 3):`;
                     data.transactions.slice(0,3).forEach(tx => { summaryText += `\n- ${formatDateForDisplay(tx.date)}: ${tx.description} (${formatCurrency(tx.amount)})`; });
                }
                addMessage('assistant', summaryText);
            } else {
                addMessage('assistant', data.message || `No income found from source "${capitalizeFirstLetter(categoryName)}" ${finalPeriodDescription}.`);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch income summary by source.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I couldn't fetch the income summary for "${capitalizeFirstLetter(categoryName)}". ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
      };

    const executeGetGoalDetailsByName = async (witCategoryEntities) => {
        setIsLoading(true);
        let foundGoal = null;
        let searchedCategory = "";

        if (!witCategoryEntities || witCategoryEntities.length === 0) {
            addMessage('assistant', "I couldn't determine the goal name from your query. Please try again specifying the goal name.");
            setIsLoading(false);
            return;
        }
        
        for (const entity of witCategoryEntities) {
            const goalName = capitalizeFirstLetter(entity.value.trim());
            searchedCategory = goalName; 
            foundGoal = goals.find(g => g.description.toLowerCase() === goalName.toLowerCase());
            if (foundGoal) break; 
        }

        if (!foundGoal) {
            for (const entity of witCategoryEntities) {
                const goalNamePart = entity.value.trim().toLowerCase();
                searchedCategory = capitalizeFirstLetter(entity.value.trim()); 
                foundGoal = goals.find(g => g.description.toLowerCase().includes(goalNamePart));
                if (foundGoal) break; 
            }
        }
        
        try { 
            if (foundGoal) {
                 let goalText = `Goal: ${capitalizeFirstLetter(foundGoal.description)}\n- Target: ${formatCurrency(foundGoal.targetAmount)}\n- Saved: ${formatCurrency(foundGoal.savedAmount)} (${foundGoal.progress ? foundGoal.progress.toFixed(1) : '0.0'}%)\n- Remaining: ${formatCurrency(foundGoal.remainingAmount)}\n- Target Date: ${formatDateForDisplay(foundGoal.targetDate)}\n- Status: ${capitalizeFirstLetter(foundGoal.status)}`;
                 addMessage('assistant', goalText);
            } else {
                 addMessage('assistant', `I couldn't find a goal related to "${searchedCategory || 'the specified term'}". You can ask me to "set a new goal" or "show my goals".`);
            }
        } catch (error) { 
            const errorMessage = error.response?.data?.message || error.message || 'Failed to process goal details.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I had trouble processing details for goal related to "${searchedCategory}". ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
    };

    const executeGetLimitDetailsByCategory = async (witCategoryEntities) => {
        setIsLoading(true);
        let foundLimit = null;
        let searchedCategory = "";

        if (!witCategoryEntities || witCategoryEntities.length === 0) {
            addMessage('assistant', "I couldn't determine the limit category from your query. Please try again specifying the category.");
            setIsLoading(false);
            return;
        }

        for (const entity of witCategoryEntities) {
            const categoryName = capitalizeFirstLetter(entity.value.trim());
            searchedCategory = categoryName;
            foundLimit = limits.find(l => l.category.toLowerCase() === categoryName.toLowerCase());
            if (foundLimit) break;
        }

        if (!foundLimit) {
            for (const entity of witCategoryEntities) {
                const categoryNamePart = entity.value.trim().toLowerCase();
                searchedCategory = capitalizeFirstLetter(entity.value.trim());
                foundLimit = limits.find(l => l.category.toLowerCase().includes(categoryNamePart));
                if (foundLimit) break;
            }
        }

        try { 
            if (foundLimit) {
                let limitText = `Limit for ${capitalizeFirstLetter(foundLimit.category)}:\n- Amount: ${formatCurrency(foundLimit.amount)}\n- Spent this month: ${formatCurrency(foundLimit.currentSpending)}\n- Remaining: ${formatCurrency(foundLimit.remainingAmount)}`;
                if (foundLimit.exceeded) {
                    limitText += `\n\nWarning: You have exceeded this limit by ${formatCurrency(foundLimit.currentSpending - foundLimit.amount)}!`;
                }
                addMessage('assistant', limitText);
            } else {
                addMessage('assistant', `No spending limit found for a category related to "${searchedCategory || 'the specified term'}". You can ask me to "set a limit" or "show my limits".`);
            }
        } catch (error) { 
            const errorMessage = error.response?.data?.message || error.message || 'Failed to process limit details.';
            toast.error(`Error: ${errorMessage}`);
            addMessage('assistant', `Sorry, I had trouble processing the limit for "${searchedCategory}". ${errorMessage}`, null, true);
        } finally {
            setIsLoading(false);
        }
    };


  const processWitResponseAndTakeAction = (witData, originalQuery) => {
    if (!localStorage.getItem('authToken')) {
        addMessage('assistant', "You need to be logged in to perform financial actions. Please log in first.", null, true);
        setIsLoading(false); return;
    }
    if (!witData) { 
        addMessage('assistant', "Sorry, I didn't receive a valid response from the AI. Please try again.", null, true); 
        setIsLoading(false); return; 
    }
    if (process.env.NODE_ENV === 'development') console.log("Raw Wit.ai Response:", witData);
    
    if (!witData.intents || witData.intents.length === 0) { 
        addMessage('assistant', "I'm not quite sure what you mean. Could you try rephrasing?", null, false, witData); 
        setIsLoading(false); return; 
    }

    const intent = witData.intents[0];
    const entities = witData.entities;
    let actionDetailsForConfirmation = null;
    let confirmationMessage = "";
    const confidenceThreshold = 0.7; 

    if (intent.confidence < confidenceThreshold) { 
        addMessage('assistant', `I think you might mean "${intent.name}", but I'm not very confident. Could you clarify? (Confidence: ${(intent.confidence*100).toFixed(1)}%)`, null, false, witData); 
        setIsLoading(false); return; 
    }

    const isTotalQuery = intent.name.startsWith('get_total_');

    if (intent.name === 'add_expense') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0];
      const descriptionEntity = entities['description:description']?.[0];
      const dateEntity = entities['wit$datetime:datetime']?.[0];

      if (!amountEntity || !categoryEntity) {
        addMessage('assistant', "To add an expense, I need at least an amount and a category. For example, 'add $10 for coffee'.");
        setIsLoading(false);
        return;
      }
      const amount = parseFloat(amountEntity.value);
      const rawCategoryFromWit = categoryEntity.value;
      const transactionCategory = capitalizeFirstLetter(rawCategoryFromWit);
      const dateValue = dateEntity?.values?.[0]?.value || dateEntity?.value || new Date().toISOString();
      const providedDescriptionFromWit = descriptionEntity?.value;
      let finalUserFacingDescription = providedDescriptionFromWit ? capitalizeFirstLetter(providedDescriptionFromWit) : transactionCategory;
      
      const expenseData = { type: 'expense', amount, category: transactionCategory, description: finalUserFacingDescription.trim(), date: new Date(dateValue).toISOString().split('T')[0] };
      actionDetailsForConfirmation = { type: 'confirm_action', intent: 'add_expense', data: expenseData, confirmationId: generateId(), originalQuery };
      confirmationMessage = `Sure! Add an expense:\n- Amount: ${formatCurrency(amount)}\n- Category: ${transactionCategory}\n- Description: ${finalUserFacingDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
    }
    else if (intent.name === 'add_income') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0];
      const descriptionEntity = entities['description:description']?.[0];
      const dateEntity = entities['wit$datetime:datetime']?.[0];

      if (!amountEntity) {
        addMessage('assistant', "To add income, I need at least an amount. For example, 'add $1000 income'.");
        setIsLoading(false);
        return;
      }
      const amount = parseFloat(amountEntity.value);
      const rawCategoryFromWit = categoryEntity?.value;
      const transactionCategory = capitalizeFirstLetter(rawCategoryFromWit || 'Income'); 
      const dateValue = dateEntity?.values?.[0]?.value || dateEntity?.value || new Date().toISOString();
      const providedDescriptionFromWit = descriptionEntity?.value;
      let finalUserFacingDescription = providedDescriptionFromWit ? capitalizeFirstLetter(providedDescriptionFromWit) : (rawCategoryFromWit ? capitalizeFirstLetter(rawCategoryFromWit) : 'Income');

      const incomeData = { type: 'income', amount, category: transactionCategory, description: finalUserFacingDescription.trim(), date: new Date(dateValue).toISOString().split('T')[0] };
      actionDetailsForConfirmation = { type: 'confirm_action', intent: 'add_income', data: incomeData, confirmationId: generateId(), originalQuery };
      confirmationMessage = `Great! Add income:\n- Amount: ${formatCurrency(amount)}\n- Category: ${transactionCategory}\n- Source/Description: ${finalUserFacingDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
    }
    else if (intent.name === 'add_goal') {
        const categoryAsGoalDescEntity = entities['category:category']?.[0]; 
        const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
        const dateEntity = entities['wit$datetime:datetime']?.[0];

        if (!categoryAsGoalDescEntity || !amountEntity || !dateEntity) {
            addMessage('assistant', "To set a goal, I need its purpose (e.g., Vacation), a target amount, and a target date. For example, 'Set goal for Vacation $1200 by next year'.");
            setIsLoading(false);
            return;
        }
        const goalDescription = capitalizeFirstLetter(categoryAsGoalDescEntity.value);
        const targetAmount = parseFloat(amountEntity.value);
        const targetDateValue = dateEntity?.values?.[0]?.value || dateEntity?.value;
        if (!targetDateValue) {
            addMessage('assistant', "I couldn't understand the target date for the goal. Please try specifying a clear date like 'by December' or 'by next year'.");
            setIsLoading(false);
            return;
        }
        const targetDate = new Date(targetDateValue).toISOString().split('T')[0];

        if (goals.some(g => g.description.toLowerCase() === goalDescription.toLowerCase())) {
            addMessage('assistant', `A goal named "${goalDescription}" already exists. Please choose a different name or manage the existing one.`);
            setIsLoading(false);
            return;
        }

        actionDetailsForConfirmation = { type: 'confirm_action', intent: 'add_goal', data: { description: goalDescription, targetAmount, targetDate }, confirmationId: generateId(), originalQuery };
        confirmationMessage = `Okay, let's set a new goal:\n- For: ${goalDescription}\n- Target Amount: ${formatCurrency(targetAmount)}\n- Target Date: ${formatDateForDisplay(targetDate)}\n\nIs this correct? (yes/no)`;
    }
    else if (intent.name === 'add_to_goal') {
        const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
        const goalNameEntities = entities['category:category']; 

        if (!amountEntity || !goalNameEntities || goalNameEntities.length === 0) { 
            addMessage('assistant', "To add to a goal, I need the amount and the goal's name. For example, 'add $50 to Vacation goal'."); 
            setIsLoading(false);
            return; 
        }
        if (goalsLoading || loadingCumulativeSavings) { 
            addMessage('assistant', "I'm still loading your financial data. Please try again in a moment."); 
            setIsLoading(false);
            return; 
        }
        if (fetchError) { 
            addMessage('assistant', `There was an issue fetching your data: ${fetchError}. Please try again after resolving.`, null, true); 
            setIsLoading(false);
            return; 
        }

        const amountToContribute = parseFloat(amountEntity.value);
        let foundGoal = null;
        let searchedGoalName = "";

        for (const entity of goalNameEntities) {
            const currentSearch = capitalizeFirstLetter(entity.value.trim());
            searchedGoalName = currentSearch; 
            foundGoal = goals.find(g => g.description.toLowerCase() === currentSearch.toLowerCase());
            if (foundGoal) break;
        }
        if (!foundGoal) { 
            for (const entity of goalNameEntities) {
                const currentSearchPart = entity.value.trim().toLowerCase();
                searchedGoalName = capitalizeFirstLetter(entity.value.trim());
                foundGoal = goals.find(g => g.description.toLowerCase().includes(currentSearchPart));
                if (foundGoal) break;
            }
        }

        if (!foundGoal) { 
            addMessage('assistant', `I couldn't find an active goal related to "${searchedGoalName || goalNameEntities[0].value}". You can view active goals or create a new one.`); 
            setIsLoading(false);
            return; 
        }
        if (foundGoal.status !== 'active') { 
            addMessage('assistant', `The goal "${foundGoal.description}" is not active (status: ${foundGoal.status}). Contributions can only be made to active goals.`); 
            setIsLoading(false);
            return; 
        }
        const remainingNeeded = foundGoal.targetAmount - foundGoal.savedAmount;
        if (remainingNeeded <= 0) { 
            addMessage('assistant', `The goal "${foundGoal.description}" is already fully funded! No more contributions are needed.`); 
            setIsLoading(false);
            return; 
        }
        if (amountToContribute <=0) { 
            addMessage('assistant', "Contribution amount must be positive. Please specify a valid amount."); 
            setIsLoading(false);
            return; 
        }
        if (amountToContribute > currentUserCumulativeSavings) { 
            addMessage('assistant', `You're trying to contribute ${formatCurrency(amountToContribute)}, but your total available savings is ${formatCurrency(currentUserCumulativeSavings)}. Please ensure you have enough savings.`); 
            setIsLoading(false);
            return; 
        }
        
        let contributionWarning = amountToContribute > remainingNeeded ? `\nNote: You're adding ${formatCurrency(amountToContribute)}, but only ${formatCurrency(remainingNeeded)} is needed. The contribution will be capped at ${formatCurrency(remainingNeeded)}.` : "";
        actionDetailsForConfirmation = { type: 'confirm_action', intent: 'add_to_goal', data: { goalId: foundGoal._id, amount: amountToContribute, goalDescription: foundGoal.description }, confirmationId: generateId(), originalQuery };
        confirmationMessage = `Okay, add ${formatCurrency(amountToContribute)} to your "${foundGoal.description}" goal?${contributionWarning}\n(Currently Saved: ${formatCurrency(foundGoal.savedAmount)}, Target: ${formatCurrency(foundGoal.targetAmount)})\n\nIs this correct? (yes/no)`;
    }
    else if (intent.name === 'set_limit') {
        const categoryEntity = entities['category:category']?.[0];
        const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
        if (!categoryEntity || !amountEntity) { 
            addMessage('assistant', "To set a limit, I need a category and an amount. For example, 'set limit for food $200'."); 
            setIsLoading(false);
            return; 
        }
        const category = capitalizeFirstLetter(categoryEntity.value);
        const amount = parseFloat(amountEntity.value);
        actionDetailsForConfirmation = { type: 'confirm_action', intent: 'set_limit', data: { category, amount }, confirmationId: generateId(), originalQuery };
        confirmationMessage = `Alright, set a spending limit:\n- Category: ${category}\n- Amount: ${formatCurrency(amount)}\n\nIs this correct? (yes/no)`;
    }
    else if (intent.name === 'get_expense_details' || intent.name === 'get_total_expense') {
        const dateTimeEntity = entities['wit$datetime:datetime']?.[0];
        executeGetExpenseDetails(dateTimeEntity, isTotalQuery); 
        return; 
    }
    else if (intent.name === 'get_expense_by_category' || intent.name === 'get_total_expense_by_category') {
        const categoryEntities = entities['category:category']; 
        const dateTimeEntity = entities['wit$datetime:datetime']?.[0];
        if (!categoryEntities || categoryEntities.length === 0) {
            addMessage('assistant', "Please specify a category to get the expense summary. For example, 'how much did I spend on food?'.");
            setIsLoading(false); return;
        }
        const categoryName = capitalizeFirstLetter(categoryEntities[0].value); 
        executeGetExpenseByCategory(categoryName, dateTimeEntity, isTotalQuery);
        return;
    }
    else if (intent.name === 'get_income_details' || intent.name === 'get_total_income') {
        const dateTimeEntity = entities['wit$datetime:datetime']?.[0];
        executeGetIncomeDetails(dateTimeEntity, isTotalQuery);
        return; 
    }
    else if (intent.name === 'get_income_by_category' || intent.name === 'get_total_income_by_category') {
        const categoryEntities = entities['category:category']; 
        const dateTimeEntity = entities['wit$datetime:datetime']?.[0];
        if (!categoryEntities || categoryEntities.length === 0) {
            addMessage('assistant', "Please specify an income source to get the summary. For example, 'how much income from salary?'.");
            setIsLoading(false); return;
        }
        const sourceName = capitalizeFirstLetter(categoryEntities[0].value); 
        executeGetIncomeByCategory(sourceName, dateTimeEntity, isTotalQuery);
        return;
    }
    else if (intent.name === 'get_goal_details') {
        const goalNameEntities = entities['category:category']; 
        if (!goalNameEntities || goalNameEntities.length === 0) {
            addMessage('assistant', "Please specify the goal name. For example, 'What is my goal for Vacation?'.");
            setIsLoading(false); return;
        }
        if (goalsLoading) {
            addMessage('assistant', "I'm still loading your goals data. Please try again in a moment.");
            setIsLoading(false); return;
        }
        executeGetGoalDetailsByName(goalNameEntities); 
        return;
    }
    else if (intent.name === 'get_limit_details') {
        const categoryEntities = entities['category:category']; 
        if (!categoryEntities || categoryEntities.length === 0) {
            addMessage('assistant', "Please specify the category for the limit. For example, 'What is the limit for Groceries?'.");
            setIsLoading(false); return;
        }
         if (limitsLoading) {
            addMessage('assistant', "I'm still loading your limits data. Please try again in a moment.");
            setIsLoading(false); return;
        }
        executeGetLimitDetailsByCategory(categoryEntities); 
        return;
    }
    else {
      addMessage('assistant', `I understood the intent as "${intent.name}" (${(intent.confidence*100).toFixed(1)}%), but I'm not programmed for that specific action yet.`, null, false, witData);
      setIsLoading(false);
      return;
    }

    if (actionDetailsForConfirmation && confirmationMessage) {
      setPendingAction(actionDetailsForConfirmation);
      addMessage('assistant', confirmationMessage, actionDetailsForConfirmation, false, witData);
      setIsLoading(false); 
    } else if (!actionDetailsForConfirmation && (intent.name.startsWith('get_'))) { 
      // Already handled by return statements for 'get_' intents
    } else if (!actionDetailsForConfirmation) {
        setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    const lowerQuery = query.toLowerCase();
    if (!query) return;

    addMessage('user', query);
    setInputValue('');

    if (pendingAction) {
      if (pendingAction.type === 'confirm_action') {
        if (lowerQuery === 'yes' || lowerQuery === 'y') {
          setIsLoading(true); 
          try {
            if (pendingAction.intent === 'add_expense' || pendingAction.intent === 'add_income') {
              await executeAddTransaction(pendingAction.data);
            } else if (pendingAction.intent === 'add_goal') {
              await executeAddGoal(pendingAction.data);
            } else if (pendingAction.intent === 'set_limit') {
              await executeSetLimit(pendingAction.data);
            } else if (pendingAction.intent === 'add_to_goal') {
              await executeContributeToGoal(pendingAction.data.goalId, pendingAction.data.amount, pendingAction.data.goalDescription);
            } else {
              addMessage('assistant', `Action for "${pendingAction.intent}" confirmed, but execution isn't fully implemented.`);
              setIsLoading(false); 
            }
          } catch (apiError) { 
            if (isLoading) setIsLoading(false); 
          }
          finally { 
            setPendingAction(null); 
            if (isLoading) setIsLoading(false); 
          }
        } else if (lowerQuery === 'no' || lowerQuery === 'n') {
          addMessage('assistant', 'Okay, I won\'t do that. What would you like to do instead?');
          setPendingAction(null);
          setIsLoading(false); 
        } else {
          addMessage('assistant', "Please respond with 'yes' or 'no' to confirm or cancel.");
        }
      } else { 
         setPendingAction(null);
         setIsLoading(false);
      }
      return;
    }

    setIsLoading(true); 
    try {
      const witResponse = await sendToWit(query);
      processWitResponseAndTakeAction(witResponse, query);
    } catch (error) {
      toast.error(error.message || 'An error occurred with the AI assistant.');
      addMessage('assistant', `Sorry, I encountered an error: ${error.message}`, null, true);
      setIsLoading(false); 
    } 
  };

  return (
    <div className={styles.pageContainer}>
      <h2 className={styles.pageTitle}>AI Assistant</h2>
      <p className={styles.pageDescription}>
        I can help manage finances. Try "add $20 expense for food today", "show total expenses", "how much for groceries this year?", "my total income", or "my income from salary this month".
      </p>

      <div className={styles.chatArea}>
        <div className={styles.messageList}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.sender]} ${msg.isError ? styles.errorMessageBubble : ''}`}>
              <p className={styles.messageText} dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }}></p>
              {msg.sender === 'assistant' && msg.rawData && process.env.NODE_ENV === 'development' && (
                <details className={styles.rawDataDetails}>
                  <summary>Wit.ai Raw (Dev)</summary>
                  <pre>{JSON.stringify(msg.rawData, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
          {isLoading && 
            <div className={`${styles.message} ${styles.assistant}`}>
                <p className={styles.messageText}>
                    <i>
                        {pendingAction && (messages[messages.length-1]?.sender === 'user' && (messages[messages.length-1].text.toLowerCase() === 'yes' || messages[messages.length-1].text.toLowerCase() === 'y')) 
                            ? "Processing..." 
                            : "Thinking..."}
                    </i>
                </p>
            </div>
          }
          {(goalsLoading || loadingCumulativeSavings || limitsLoading) && !isLoading && 
            <div className={`${styles.message} ${styles.assistant}`}>
                <p className={styles.messageText}><i>Loading your financial data...</i></p>
            </div>
          }
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className={styles.inputForm}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
                pendingAction ? "Type 'yes' or 'no'..."
                : (goalsLoading || loadingCumulativeSavings || limitsLoading) ? "Loading data..." : "Ask or tell me something..."
            }
            className={styles.chatInput}
            disabled={isLoading || goalsLoading || loadingCumulativeSavings || limitsLoading}
            autoFocus
          />
          <button type="submit" className={styles.sendButton} disabled={isLoading || goalsLoading || loadingCumulativeSavings || limitsLoading || !inputValue.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
export default SmartAssistantPage;