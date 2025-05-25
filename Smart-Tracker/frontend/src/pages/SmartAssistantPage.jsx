// frontend/src/pages/SmartAssistantPage.js
import React, { useState, useEffect, useRef } from 'react';
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

const SmartAssistantPage = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([
    { id: generateId(), sender: 'assistant', text: "Hello! How can I assist you with your finances today? Try 'add $100 income from salary for monthly paycheck on this month' or 'Set a goal for Vacation $1200 by the December'." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const addMessage = (sender, text, actionDetails = null, isError = false, rawData = null) => {
    setMessages(prev => [...prev, { id: generateId(), sender, text, actionDetails, isError, rawData }]);
  };

  const handleInputChange = (e) => setInputValue(e.target.value);

  const executeAddTransaction = async (transactionData) => {
    const transactionType = capitalizeFirstLetter(transactionData.type);
    try {
      const response = await axios.post('/api/transactions', transactionData);
      toast.success(`${transactionType} "${transactionData.description}" of $${transactionData.amount.toFixed(2)} added!`);
      addMessage('assistant', `Great! I've added the ${transactionData.type}: $${transactionData.amount.toFixed(2)} for ${transactionData.description}.`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || `Failed to add ${transactionData.type}.`;
      toast.error(`Error: ${errorMessage}`);
      addMessage('assistant', `Sorry, I couldn't add the ${transactionData.type}. ${errorMessage}`, null, true);
      throw error;
    }
  };

  const executeAddGoal = async (goalData) => {
    try {
      const response = await axios.post('/api/goals', goalData);
      toast.success(`Goal "${goalData.description}" set successfully!`);
      addMessage('assistant', `Okay, I've set a new goal: ${goalData.description} for $${goalData.targetAmount.toFixed(2)} by ${formatDateForDisplay(goalData.targetDate)}.`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to set goal.';
      toast.error(`Error: ${errorMessage}`);
      addMessage('assistant', `Sorry, I couldn't set the goal. ${errorMessage}`, null, true);
      throw error;
    }
  };
  const executeSetLimit = async (limitData) => {
    try {
      const response = await axios.post('/api/limits', limitData);
      toast.success(`Limit for "${limitData.category}" set to $${limitData.amount.toFixed(2)} successfully!`);
      addMessage('assistant', `Alright, I've set a spending limit for ${limitData.category} at $${limitData.amount.toFixed(2)}.`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to set limit.';
      toast.error(`Error: ${errorMessage}`);
      addMessage('assistant', `Sorry, I couldn't set the limit. ${errorMessage}`, null, true);
      throw error;
    }
  };

  const processWitResponseAndTakeAction = (witData, originalQuery) => {
    if (!witData) {
      addMessage('assistant', "Sorry, I didn't receive a valid response from the AI. Please try again.", null, true);
      return;
    }
    if (process.env.NODE_ENV === 'development') console.log("Raw Wit.ai Response:", witData);
    if (!witData.intents || witData.intents.length === 0) {
      addMessage('assistant', "I'm not quite sure what you mean. Could you try rephrasing?", null, false, witData);
      return;
    }

    const intent = witData.intents[0];
    const entities = witData.entities;
    let actionDetailsForConfirmation = null;
    let confirmationMessage = "";
    const confidenceThreshold = 0.7;

    if (intent.confidence < confidenceThreshold) {
        addMessage('assistant', `I think you might mean "${intent.name}", but I'm not very confident. Could you clarify? (Confidence: ${(intent.confidence*100).toFixed(1)}%)`, null, false, witData);
        return;
    }

    // --- ADD EXPENSE INTENT ---
    if (intent.name === 'add_expense') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0];
      const descriptionEntity = entities['description:description']?.[0]; // Updated entity name
      const dateEntity = entities['wit$datetime:datetime']?.[0];

      if (!amountEntity || !categoryEntity) {
        addMessage('assistant', "To add an expense, I need at least an amount and a category. For example, 'add $10 for coffee'.");
        return;
      }

      const amount = parseFloat(amountEntity.value);
      const rawCategoryFromWit = categoryEntity.value; // Known to exist due to check above
      const transactionCategory = capitalizeFirstLetter(rawCategoryFromWit);
      const dateValue = dateEntity?.value || new Date().toISOString();
      const providedDescriptionFromWit = descriptionEntity?.value;

      let finalUserFacingDescription;

      if (providedDescriptionFromWit) {
        finalUserFacingDescription = capitalizeFirstLetter(providedDescriptionFromWit);
      } else {
        // No specific 'description:description' entity, fallback to 'category:category' value for the description.
        finalUserFacingDescription = transactionCategory; // which is capitalizeFirstLetter(rawCategoryFromWit)
      }

      const expenseData = { 
        type: 'expense', 
        amount, 
        category: transactionCategory, 
        description: finalUserFacingDescription.trim(), 
        date: new Date(dateValue).toISOString().split('T')[0] 
      };
      
      actionDetailsForConfirmation = {
        type: 'confirm_action',
        intent: 'add_expense',
        data: expenseData,
        confirmationId: generateId(), originalQuery,
      };
      confirmationMessage = `Sure! Add an expense:\n- Amount: $${amount.toFixed(2)}\n- Category: ${transactionCategory}\n- Description: ${finalUserFacingDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
    }
    // --- ADD INCOME INTENT ---
    else if (intent.name === 'add_income') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0];
      const descriptionEntity = entities['description:description']?.[0]; // Updated entity name
      const dateEntity = entities['wit$datetime:datetime']?.[0];

      if (!amountEntity) {
        addMessage('assistant', "To add income, I need at least an amount. For example, 'add $1000 income'.");
        return;
      }

      const amount = parseFloat(amountEntity.value);
      const rawCategoryFromWit = categoryEntity?.value;
      const transactionCategory = capitalizeFirstLetter(rawCategoryFromWit || 'Income'); 
      const dateValue = dateEntity?.value || new Date().toISOString();
      const providedDescriptionFromWit = descriptionEntity?.value;

      let finalUserFacingDescription;

      if (providedDescriptionFromWit) {
        finalUserFacingDescription = capitalizeFirstLetter(providedDescriptionFromWit);
      } else if (rawCategoryFromWit) {
        finalUserFacingDescription = capitalizeFirstLetter(rawCategoryFromWit);
      } else {
        finalUserFacingDescription = 'Income'; 
      }
      
      const incomeData = { 
          type: 'income', 
          amount, 
          category: transactionCategory,
          description: finalUserFacingDescription.trim(), 
          date: new Date(dateValue).toISOString().split('T')[0] 
      };

      actionDetailsForConfirmation = {
        type: 'confirm_action',
        intent: 'add_income',
        data: incomeData,
        confirmationId: generateId(), originalQuery,
      };
      confirmationMessage = `Great! Add income:\n- Amount: $${amount.toFixed(2)}\n- Category: ${transactionCategory}\n- Source/Description: ${finalUserFacingDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
    }
    // --- ADD GOAL INTENT ---
    else if (intent.name === 'add_goal') {
        const categoryAsGoalDescEntity = entities['category:category']?.[0];
        const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
        const dateEntity = entities['wit$datetime:datetime']?.[0];

        if (!categoryAsGoalDescEntity || !amountEntity || !dateEntity) {
            addMessage('assistant', "To set a goal, I need its purpose (as a category), a target amount, and a target date. For example, 'Set goal for Vacation $1200 by next year'.");
            return;
        }

        const rawGoalPurpose = categoryAsGoalDescEntity.value;
        const goalPurposeFromCategory = capitalizeFirstLetter(rawGoalPurpose);
        const targetAmount = parseFloat(amountEntity.value);
        const targetDate = new Date(dateEntity.value).toISOString().split('T')[0];

        actionDetailsForConfirmation = {
            type: 'confirm_action',
            intent: 'add_goal',
            data: {
                description: goalPurposeFromCategory,
                targetAmount,
                targetDate
            },
            confirmationId: generateId(),
            originalQuery,
        };
        confirmationMessage = `Okay, let's set a new goal:\n- For: ${goalPurposeFromCategory}\n- Target Amount: $${targetAmount.toFixed(2)}\n- Target Date: ${formatDateForDisplay(targetDate)}\n\nIs this correct? (yes/no)`;
    }
    // --- SET LIMIT INTENT ---
    else if (intent.name === 'set_limit') {
        const categoryEntity = entities['category:category']?.[0];
        const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];

        if (!categoryEntity || !amountEntity) {
            addMessage('assistant', "To set a limit, I need a category and an amount. E.g., 'Set $100 limit for groceries'.");
            return;
        }
        const rawCategory = categoryEntity.value;
        const category = capitalizeFirstLetter(rawCategory);
        const amount = parseFloat(amountEntity.value);

        actionDetailsForConfirmation = {
            type: 'confirm_action',
            intent: 'set_limit',
            data: { category, amount },
            confirmationId: generateId(), originalQuery,
        };
        confirmationMessage = `Alright, set a spending limit:\n- Category: ${category}\n- Amount: $${amount.toFixed(2)}\n\nIs this correct? (yes/no)`;
    }
    // --- UNHANDLED/UNKNOWN INTENT ---
    else {
      addMessage('assistant', `I understood the intent as "${intent.name}", but I'm not programmed to perform that action yet. (Confidence: ${(intent.confidence*100).toFixed(1)}%)`, null, false, witData);
      return;
    }

    if (actionDetailsForConfirmation && confirmationMessage) {
      setPendingAction(actionDetailsForConfirmation);
      addMessage('assistant', confirmationMessage, actionDetailsForConfirmation, false, witData);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    const lowerQuery = query.toLowerCase();
    if (!query) return;

    addMessage('user', query);
    setInputValue('');
    setIsLoading(true);

    if (pendingAction) {
      // This 'get_description' block is now less likely to be hit for expense/income,
      // but kept for potential other uses or if a description prompt is re-introduced.
      if (pendingAction.type === 'get_description') {
        let userProvidedDescription = capitalizeFirstLetter(query);
        const baseData = pendingAction.data;
        let finalDescriptionForConfirmation = "";
        let dataForConfirmation = { ...baseData };

        if (pendingAction.intent === 'add_expense') {
            if (lowerQuery === 'none' || lowerQuery === 'skip') {
                finalDescriptionForConfirmation = baseData.category; 
            } else {
                if (baseData.category.toLowerCase() !== userProvidedDescription.toLowerCase()) {
                    finalDescriptionForConfirmation = `${baseData.category}: ${userProvidedDescription}`;
                } else {
                    finalDescriptionForConfirmation = userProvidedDescription;
                }
            }
            dataForConfirmation.description = finalDescriptionForConfirmation.trim();
            const confirmText = `Sure! Add an expense:\n- Amount: $${dataForConfirmation.amount.toFixed(2)}\n- Category: ${dataForConfirmation.category}\n- Description: ${dataForConfirmation.description}\n- Date: ${formatDateForDisplay(dataForConfirmation.date)}\n\nIs this correct? (yes/no)`;
            
            setPendingAction({
                type: 'confirm_action', intent: 'add_expense', data: dataForConfirmation,
                confirmationId: generateId(), originalQuery: pendingAction.originalQuery
            });
            addMessage('assistant', confirmText);

        } else if (pendingAction.intent === 'add_income') {
            if (lowerQuery === 'none' || lowerQuery === 'skip') {
                finalDescriptionForConfirmation = baseData.category; 
            } else {
                if (baseData.category !== 'Income' && baseData.category.toLowerCase() !== userProvidedDescription.toLowerCase()) {
                    finalDescriptionForConfirmation = `${baseData.category}: ${userProvidedDescription}`;
                } else {
                    finalDescriptionForConfirmation = userProvidedDescription;
                }
            }
            dataForConfirmation.description = finalDescriptionForConfirmation.trim();
            const confirmText = `Great! Add income:\n- Amount: $${dataForConfirmation.amount.toFixed(2)}\n- Category: ${dataForConfirmation.category}\n- Source/Description: ${dataForConfirmation.description}\n- Date: ${formatDateForDisplay(dataForConfirmation.date)}\n\nIs this correct? (yes/no)`;

            setPendingAction({
                type: 'confirm_action', intent: 'add_income', data: dataForConfirmation,
                confirmationId: generateId(), originalQuery: pendingAction.originalQuery
            });
            addMessage('assistant', confirmText);
        }
      } else if (pendingAction.type === 'confirm_action') {
        if (lowerQuery === 'yes' || lowerQuery === 'y') {
          try {
            if (pendingAction.intent === 'add_expense' || pendingAction.intent === 'add_income') {
              await executeAddTransaction(pendingAction.data);
            } else if (pendingAction.intent === 'add_goal') {
              await executeAddGoal(pendingAction.data);
            } else if (pendingAction.intent === 'set_limit') {
              await executeSetLimit(pendingAction.data);
            } else {
              addMessage('assistant', `Action for "${pendingAction.intent}" confirmed, but execution isn't fully implemented.`);
            }
          } catch (apiError) { /* API errors are handled within execute functions by adding a message */ }
          finally { setPendingAction(null); }
        } else if (lowerQuery === 'no' || lowerQuery === 'n') {
          addMessage('assistant', 'Okay, I won\'t do that. What would you like to do instead?');
          setPendingAction(null);
        } else {
          addMessage('assistant', "Please respond with 'yes' or 'no' to confirm or cancel.");
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      const witResponse = await sendToWit(query);
      processWitResponseAndTakeAction(witResponse, query);
    } catch (error) {
      toast.error(error.message || 'An error occurred with the AI assistant.');
      addMessage('assistant', `Sorry, I encountered an error: ${error.message}`, null, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <h2 className={styles.pageTitle}>Smart Assistant</h2>
      <p className={styles.pageDescription}>
        I can help you manage your finances. Try "Spent $20 for snacks on groceries today" or "Set a goal of $500 for Vacation by December".
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
          {isLoading && !pendingAction && <div className={`${styles.message} ${styles.assistant}`}><p className={styles.messageText}><i>Thinking...</i></p></div>}
          {isLoading && pendingAction && <div className={`${styles.message} ${styles.assistant}`}><p className={styles.messageText}><i>Processing your confirmation...</i></p></div>}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className={styles.inputForm}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={
                pendingAction ? 
                    (pendingAction.type === 'get_description' ? "Enter description (or 'none')..." : "Type 'yes' or 'no'...") 
                    : "Ask or tell me something..."
            }
            className={styles.chatInput}
            disabled={isLoading}
            autoFocus
          />
          <button type="submit" className={styles.sendButton} disabled={isLoading || !inputValue.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
export default SmartAssistantPage;