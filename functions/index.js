const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Phone number formatting function
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  if (phone.startsWith("0") && phone.length === 10) {
    return `233${phone.slice(1)}`;
  }
  if (phone.startsWith("233") && phone.length === 13) {
    return phone;
  }
  return `233${phone}`;
};

exports.startThetellerPayment = onCall(
  {timeoutSeconds: 120},
  async ({data, auth}) => {
    logger.info("Received payload:", {
      ...data,
      recipient_number: data.recipient_number || "none",
      subscriber_number: data.subscriber_number || "none",
    });

    const {
      merchant_id,
      transaction_id,
      desc,
      amount,
      subscriber_number,
      recipient_number,
      r_switch,
      email,
      isAgentSignup = false,
      isCallback = false,
    } = data;

    const userId = auth?.uid; // Get userId from auth context

    // Handle transaction status check
    if (isCallback) {
      // Check Firestore cache first
      const statusDoc = await db
        .collection("transaction_status_cache")
        .doc(transaction_id)
        .get();
      if (statusDoc.exists) {
        const cachedStatus = statusDoc.data();
        logger.info("Using cached status:", {
          transaction_id,
          status: cachedStatus.status,
          code: cachedStatus.code,
          reason: cachedStatus.reason,
        });
        return {
          final_status: cachedStatus.status,
          code: cachedStatus.code,
          reason: cachedStatus.reason,
          transaction_id,
        };
      }

      try {
        const response = await axios.get(
          `https://prod.theteller.net/v1.1/users/transactions/${transaction_id}/status`,
          {
            headers: {
              "Content-Type": "application/json",
              "Merchant-Id": "TTM-00009769",
              "Cache-Control": "no-cache",
            },
          }
        );

        const {status, code, reason} = response.data;
        logger.info("Theteller status check response:", {
          status,
          code,
          reason,
          transaction_id,
        });

        // Cache the status in Firestore (only for approved or declined)
        if (status === "approved" || status === "declined") {
          await db
            .collection("transaction_status_cache")
            .doc(transaction_id)
            .set({
              status,
              code,
              reason,
              transaction_id,
              cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        return {
          final_status: status,
          code,
          reason,
          transaction_id,
        };
      } catch (error) {
        logger.error("Theteller status check error:", {
          message: error.message,
          transaction_id,
        });
        throw new HttpsError(
          "internal",
          `Failed to check transaction status: ${error.message}`
        );
      }
    }

    // Validation for payment initiation
    if (!merchant_id || typeof merchant_id !== "string") {
      throw new HttpsError(
        "invalid-argument",
        `Merchant ID required, received: ${JSON.stringify(merchant_id)}`
      );
    }
    if (!transaction_id || !/^\d{12}$/.test(transaction_id)) {
      throw new HttpsError(
        "invalid-argument",
        "Transaction ID must be 12 digits"
      );
    }
    if (!desc || typeof desc !== "string") {
      throw new HttpsError("invalid-argument", "Description required");
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new HttpsError("invalid-argument", "Valid amount required");
    }
    if (!subscriber_number || !/^\d{10,12}$/.test(subscriber_number)) {
      throw new HttpsError(
        "invalid-argument",
        `Valid MoMo number (10 or 13 digits) required, received: ${subscriber_number}`
      );
    }
    if (
      !isAgentSignup &&
      (!recipient_number ||
        (!/^\d{10}$/.test(recipient_number) &&
          !/^\d{12}$/.test(recipient_number)))
    ) {
      throw new HttpsError(
        "invalid-argument",
        `Valid recipient number (10 or 13 digits) required for data purchase, received: ${
          recipient_number || "none"
        }`
      );
    }
    const allowed_r_switches = ["MTN", "VDF", "ATL", "TGO", "ZPY", "GMY"];
    if (!r_switch || !allowed_r_switches.includes(r_switch)) {
      throw new HttpsError(
        "invalid-argument",
        `Valid payment network required: ${allowed_r_switches.join(
          ", "
        )}, received: ${r_switch}`
      );
    }

    // Check for duplicate transaction
    const existingDoc = await db
      .collection("data_approve_teller_transaction")
      .doc(transaction_id)
      .get();
    if (existingDoc.exists) {
      logger.warn(`Transaction ${transaction_id} already exists`);
      return {
        status: "approved",
        message: isAgentSignup ?
          "Agent registration payment already processed" :
          "Data purchase payment already processed",
        transaction_id,
      };
    }

    const formattedAmount = parseFloat(amount).toFixed(0).padStart(12, "0");

    const requestBody = {
      amount: formattedAmount,
      processing_code: "000200",
      transaction_id,
      desc,
      merchant_id,
      subscriber_number,
      "r-switch": r_switch,
    };

    try {
      const response = await axios.post(
        "https://prod.theteller.net/v1.1/transaction/process",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Basic eXVzc2lmNjcwZDM4M2NhZjU0NDpaV0kxWWpOallURmhOMk5qTTJFME5HRmpPVFJtWWpreU5UZzNaVGxtTjJNPQ==",
            "Cache-Control": "no-cache",
          },
        }
      );

      logger.info("Theteller full response:", {
        status: response.data.status,
        code: response.data.code,
        reason: response.data.reason,
        transaction_id: response.data.transaction_id,
      });

      const responseData = response.data;

      if (responseData.status !== "approved" || responseData.code !== "000") {
        throw new HttpsError(
          "internal",
          `Payment initiation failed: ${responseData.reason}`
        );
      }

      let agentDetails = {};
      if (isAgentSignup) {
        try {
          agentDetails = JSON.parse(desc);
          const {
            email,
            password,
            fullName,
            phone,
            momoNumber,
            paymentNetwork,
          } = agentDetails;

          // Format phone number for agent
          const formattedAgentPhone = formatPhoneNumber(phone);

          // Create Firebase Auth user
          const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: fullName,
          });

          // Store agent details in Firestore
          await db.collection("dataplug-agents").doc(userRecord.uid).set({
            fullName,
            phone: formattedAgentPhone,
            momoNumber,
            paymentNetwork,
            email,
            username: agentDetails.username,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`Agent created: ${userRecord.uid}`);
        } catch (authError) {
          logger.error("Agent creation error:", {
            message: authError.message,
          });
          throw new HttpsError(
            "internal",
            `Agent creation failed: ${authError.message}`
          );
        }
      }

      // Store approved transaction in Firestore
      await db
        .collection("data_approve_teller_transaction")
        .doc(transaction_id)
        .set({
          merchant_id,
          transaction_id,
          amount: parseFloat(amount),
          status: responseData.status,
          code: responseData.code,
          reason: responseData.reason,
          desc,
          subscriber_number,
          recipient_number: isAgentSignup ?
            null :
            formatPhoneNumber(recipient_number || subscriber_number),
          r_switch,
          email: email || "customer@data.com",
          isAgentSignup,
          exported: false,
          userId: userId || null, // Add userId
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      logger.info(
        `Transaction APPROVED: ${transaction_id} | Type: ${
          isAgentSignup ? "AGENT" : "DATA"
        } | Recipient: ${recipient_number || "none"} | UserId: ${
          userId || "none"
        }`
      );

      return {
        status: "approved",
        message: isAgentSignup ?
          "Agent registration payment approved" :
          "Data purchase payment approved",
        transaction_id,
      };
    } catch (error) {
      logger.error("Theteller initiation error:", {
        message: error.message,
        transaction_id,
      });
      throw new HttpsError(
        "internal",
        `Failed to initiate payment: ${error.message}`
      );
    }
  }
);
