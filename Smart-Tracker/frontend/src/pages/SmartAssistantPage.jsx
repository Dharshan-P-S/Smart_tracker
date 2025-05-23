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
    { id: generateId(), sender: 'assistant', text: "Hello! How can I assist you with your finances today? Try 'add $100 income from salary on this month' or 'set a goal for Vacation $1200 by the December'." }
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

  const executeAddGoal = async (goalData) => { /* ... same as before ... */ 
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
  const executeSetLimit = async (limitData) => { /* ... same as before ... */
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
    if (!witData) { /* ... */ 
        addMessage('assistant', "Sorry, I didn't receive a valid response from the AI. Please try again.", null, true);
        return;
    }
    if (process.env.NODE_ENV === 'development') console.log("Raw Wit.ai Response:", witData);
    if (!witData.intents || witData.intents.length === 0) { /* ... */
        addMessage('assistant', "I'm not quite sure what you mean. Could you try rephrasing?", null, false, witData);
        return;
    }

    const intent = witData.intents[0];
    const entities = witData.entities;
    let actionDetailsForConfirmation = null;
    let confirmationMessage = "";
    const confidenceThreshold = 0.7;

    if (intent.confidence < confidenceThreshold) { /* ... */ 
        addMessage('assistant', `I think you might mean "${intent.name}", but I'm not very confident. Could you clarify? (Confidence: ${(intent.confidence*100).toFixed(1)}%)`, null, false, witData);
        return;
    }

    // --- ADD EXPENSE INTENT ---
    if (intent.name === 'add_expense') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0];
      const dateEntity = entities['wit$datetime:datetime']?.[0];
      const descriptionEntity = entities['description_text:description_text']?.[0];

      if (!amountEntity || !categoryEntity) {
        addMessage('assistant', "To add an expense, I need at least an amount and a category. For example, 'add $10 for coffee'.");
        return;
      }

      const amount = parseFloat(amountEntity.value);
      const rawCategory = categoryEntity.value;
      const category = capitalizeFirstLetter(rawCategory);
      const dateValue = dateEntity?.value || new Date().toISOString();
      const providedDescription = descriptionEntity?.value;
      const baseExpenseData = { type: 'expense', amount, category, date: new Date(dateValue).toISOString().split('T')[0] };

      if (providedDescription) {
        let finalDescription = capitalizeFirstLetter(providedDescription);
        if (rawCategory.toLowerCase() !== providedDescription.toLowerCase()) {
          finalDescription = `${category}: ${finalDescription}`;
        }
        actionDetailsForConfirmation = {
          type: 'confirm_action',
          intent: 'add_expense',
          data: { ...baseExpenseData, description: finalDescription.trim() },
          confirmationId: generateId(), originalQuery,
        };
        confirmationMessage = `Sure! Add an expense:\n- Amount: $${amount.toFixed(2)}\n- Category: ${category}\n- Description: ${finalDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
      } else {
        setPendingAction({
            type: 'get_description',
            intent: 'add_expense',
            data: baseExpenseData,
            originalQuery
        });
        addMessage('assistant', `Okay, an expense of $${amount.toFixed(2)} for ${category}. What's a more specific description? (eg: "Bought Shoes", "Tea and biscuits", "Dining Out" or type "none")`);
        return;
      }
    }
    // --- ADD INCOME INTENT (MODIFIED TO ALWAYS ASK FOR DESCRIPTION IF NOT PROVIDED BY description_text) ---
    else if (intent.name === 'add_income') {
      const amountEntity = entities['wit$amount_of_money:amount_of_money']?.[0];
      const categoryEntity = entities['category:category']?.[0]; // e.g., "Salary", "Freelance"
      const descriptionEntity = entities['description_text:description_text']?.[0]; // e.g., "Monthly paycheck"
      const dateEntity = entities['wit$datetime:datetime']?.[0];

      if (!amountEntity) {
        addMessage('assistant', "To add income, I need at least an amount. For example, 'add $1000 income from salary'.");
        return;
      }
      // If category is also missing (along with description_text), it's harder to form a good prompt/default.
      // For now, we'll prioritize getting a description_text.
      // If category is also missing, 'Income' will be the default category.

      const amount = parseFloat(amountEntity.value);
      const rawCategory = categoryEntity?.value || 'Income'; // Default if category not specified
      const category = capitalizeFirstLetter(rawCategory);
      const dateValue = dateEntity?.value || new Date().toISOString();
      const providedDescription = descriptionEntity?.value;

      const baseIncomeData = { 
          type: 'income', 
          amount, 
          category, // Store the determined category (could be "Income")
          date: new Date(dateValue).toISOString().split('T')[0] 
      };

      if (providedDescription) {
        let finalDescription = capitalizeFirstLetter(providedDescription);
        // If category is specific (not just "Income") and different from the provided description, combine them.
        if (category !== 'Income' && category.toLowerCase() !== providedDescription.toLowerCase()) {
          finalDescription = `${category}: ${finalDescription}`;
        }
        // Else, the providedDescription (capitalized) is sufficient.

        actionDetailsForConfirmation = {
          type: 'confirm_action',
          intent: 'add_income',
          data: { ...baseIncomeData, description: finalDescription.trim() },
          confirmationId: generateId(), originalQuery,
        };
        confirmationMessage = `Great! Add income:\n- Amount: $${amount.toFixed(2)}\n- Source/Description: ${finalDescription.trim()}\n- Date: ${formatDateForDisplay(dateValue)}\n\nIs this correct? (yes/no)`;
      } else {
        // Ask for description, even if a category was found
        setPendingAction({
            type: 'get_description',
            intent: 'add_income',
            data: baseIncomeData, // data now includes category (even if it's the default "Income")
            originalQuery
        });
        // Prompt will use the determined category if available and specific, or just ask for source/description
        const promptCategoryPart = category !== 'Income' ? `from ${category}` : '';
        addMessage('assistant', `Okay, income of $${amount.toFixed(2)} ${promptCategoryPart}. What's a more specific source or description? (eg: "Monthly Income", "Friend gift", "Freelance work" or type "none")`);
        return; 
      }
    }
    // --- ADD GOAL INTENT ---
    else if (intent.name === 'add_goal') { /* ... same as before ... */ 
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
    else if (intent.name === 'set_limit') { /* ... same as before ... */ 
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
    else { /* ... same as before ... */ 
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
      if (pendingAction.type === 'get_description') {
        let userProvidedDescription = capitalizeFirstLetter(query);
        const baseData = pendingAction.data;
        let finalDescriptionForConfirmation = "";
        let dataForConfirmation = { ...baseData };


        if (pendingAction.intent === 'add_expense') {
            if (lowerQuery === 'none' || lowerQuery === 'skip') {
                finalDescriptionForConfirmation = baseData.category; // Already capitalized
            } else {
                 // If baseData.category is different from userProvidedDescription (ignoring case)
                if (baseData.category.toLowerCase() !== userProvidedDescription.toLowerCase()) {
                    finalDescriptionForConfirmation = `${baseData.category}: ${userProvidedDescription}`;
                } else {
                    finalDescriptionForConfirmation = userProvidedDescription;
                }
            }
            dataForConfirmation.description = finalDescriptionForConfirmation.trim();
            // Now construct confirmation message for expense
            const confirmText = `Sure! Add an expense:\n- Amount: $${dataForConfirmation.amount.toFixed(2)}\n- Category: ${dataForConfirmation.category}\n- Description: ${dataForConfirmation.description}\n- Date: ${formatDateForDisplay(dataForConfirmation.date)}\n\nIs this correct? (yes/no)`;
            
            setPendingAction({
                type: 'confirm_action', intent: 'add_expense', data: dataForConfirmation,
                confirmationId: generateId(), originalQuery: pendingAction.originalQuery
            });
            addMessage('assistant', confirmText);

        } else if (pendingAction.intent === 'add_income') {
             // For income, baseData already has a 'category' (defaulted to "Income" if none was parsed)
            if (lowerQuery === 'none' || lowerQuery === 'skip') {
                finalDescriptionForConfirmation = baseData.category; // Use the (possibly default) category
            } else {
                // If the existing category (e.g. "Salary") is different from the user's new description, combine them.
                // Or if category was just "Income", use the user's specific description.
                if (baseData.category !== 'Income' && baseData.category.toLowerCase() !== userProvidedDescription.toLowerCase()) {
                    finalDescriptionForConfirmation = `${baseData.category}: ${userProvidedDescription}`;
                } else {
                    finalDescriptionForConfirmation = userProvidedDescription;
                }
            }
            dataForConfirmation.description = finalDescriptionForConfirmation.trim();
            // Now construct confirmation message for income
            const confirmText = `Great! Add income:\n- Amount: $${dataForConfirmation.amount.toFixed(2)}\n- Source/Description: ${dataForConfirmation.description}\n- Date: ${formatDateForDisplay(dataForConfirmation.date)}\n\nIs this correct? (yes/no)`;

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
          } catch (apiError) { /* Handled */ }
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

  return ( /* ... JSX remains the same ... */ 
    <div className={styles.pageContainer}>
      <h2 className={styles.pageTitle}>Smart Assistant</h2>
      <p className={styles.pageDescription}>
        I can help you manage your finances. Try "Spent $20 for snacks today" or "Set a goal of $500 for Vacation by the December".
      </p>

      <div className={styles.chatArea}>
        <div className={styles.messageList}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.sender]} ${msg.isError ? styles.errorMessageBubble : ''}`}>
              <p className={styles.messageText}>{msg.text}</p>
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