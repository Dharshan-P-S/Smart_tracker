// frontend/src/utils/witClient.js
import axios from "axios";

// For Vite, environment variables are accessed via import.meta.env
const tokenFromEnv = import.meta.env.VITE_WIT_AI_TOKEN;

// This forms the complete Authorization header value
const WIT_TOKEN = `Bearer ${tokenFromEnv}`;

export const sendToWit = async (message) => {
  // This is the crucial check: Is the tokenFromEnv actually set?
  if (!tokenFromEnv) {
    console.error(
      "Wit.ai token is not configured. Please set VITE_WIT_AI_TOKEN in your .env file (frontend root) and restart the dev server."
    );
    throw new Error("Wit.ai token is not configured. Please check your setup.");
  }

  // If we reach here, tokenFromEnv has a value, and WIT_TOKEN is formed correctly.
  try {
    const response = await axios.get("https://api.wit.ai/message", {
      params: {
        v: '20240110', // Use a recent API version
        q: message,
      },
      headers: {
        Authorization: WIT_TOKEN, // This will be "Bearer YOUR_TOKEN_FROM_ENV"
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    // ... (error handling as before)
    console.error(
      "Wit.ai API error:",
      error.response ? error.response.data : error.message
    );
    const errorMessage = error.response?.data?.error || error.message || "Failed to connect to Wit.ai";
    throw new Error(`Wit.ai Error: ${errorMessage}`);
  }
};