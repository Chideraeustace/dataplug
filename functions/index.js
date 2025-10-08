const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Hardcoded Theteller credentials for testing purposes
// const THETELLER_APIUSER = "YourAPIUsername"; // Replace with your Theteller API Username
// const THETELLER_APIKEY = "YourAPIKey"; // Replace with your Theteller API Key

exports.initiateThetellerPayment = onCall(
  {timeoutSeconds: 60},
  async ({data, context}) => {
    const {merchant_id, transaction_id, desc, amount, redirect_url, email} =
      data;

    // Input validation
    if (!merchant_id || typeof merchant_id !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Merchant ID must be a non-empty string."
      );
    }
    if (!transaction_id || !/^\d{12}$/.test(transaction_id)) {
      throw new HttpsError(
        "invalid-argument",
        "Transaction ID must be a 12-digit string."
      );
    }
    if (!desc || typeof desc !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Description must be a non-empty string."
      );
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Amount must be a positive number."
      );
    }
    if (!redirect_url || typeof redirect_url !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Redirect URL must be a non-empty string."
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError(
        "invalid-argument",
        "Email must be a valid email address."
      );
    }

    // Prepare the request payload
    const requestBody = {
      merchant_id,
      transaction_id,
      desc,
      amount: parseFloat(amount).toString().padStart(12, "0"), // Ensure amount is formatted as 12-digit string
      redirect_url,
      email,
    };

    try {
      // Make POST request to Theteller's initiate endpoint
      const response = await axios.post(
        "https://checkout-test.theteller.net/initiate",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic eXVzc2lmNjcwZDM4M2NhZjU0NDpObVk0TkdOa056RmhNRGs1WldJM01tTmlObUZsWVdJek16WXhNVGxoT1RZPQ==",
            "Cache-Control": "no-cache",
          },
        }
      );

      const responseData = response.data;

      if (responseData.status !== "success" || !responseData.checkout_url) {
        throw new HttpsError(
          "internal",
          `Theteller API error: ${responseData.reason || "Unknown error"}`
        );
      }

      // Write transaction to Firestore at initiation
      await db.collection("theteller-transactions").doc(transaction_id).set({
        merchant_id,
        transaction_id,
        amount,
        checkout_url: responseData.checkout_url,
        token: responseData.token,
        status: "initiated",
        email,
        redirect_url,
        desc,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`Transaction document created for ID: ${transaction_id}`);
      return {
        status: "success",
        checkout_url: responseData.checkout_url,
        token: responseData.token,
      };
    } catch (error) {
      logger.error("Error in initiateThetellerPayment:", error);
      throw new HttpsError(
        "internal",
        `Failed to initiate payment: ${error.message}`
      );
    }
  }
);
