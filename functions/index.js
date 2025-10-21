const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

exports.initiateThetellerPayment = onCall(
  {timeoutSeconds: 120},
  async ({data, context}) => {
    const {
      merchant_id,
      transaction_id,
      desc,
      amount,
      subscriber_number,
      r_switch,
      email,
      isCallback = false,
      isAgentSignup = false,
    } = data;

    const processing_code = "000200";

    // *** INITIATION (NO REDIRECT) ***
    if (!isCallback) {
      // *** FOR AGENT SIGNUP - CREATE USER IMMEDIATELY ***
      let agentUid = null;
      if (isAgentSignup) {
        try {
          const agentData = JSON.parse(desc);
          const userCredential = await auth.createUser({
            email: agentData.email,
            password: agentData.password,
          });
          agentUid = userCredential.uid;

          await db.collection("lords-agents").doc(userCredential.uid).set({
            fullName: agentData.fullName,
            phone: agentData.phone,
            username: agentData.username,
            email: agentData.email,
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: false, // Will be activated after payment
          });

          logger.info(
            `AGENT USER CREATED (PENDING PAYMENT): ${userCredential.uid}`
          );
        } catch (error) {
          logger.error("Agent user creation failed:", error);
          throw new HttpsError(
            "internal",
            `Failed to create agent account: ${error.message}`
          );
        }
      }

      // Validation
      if (!merchant_id || typeof merchant_id !== "string") {
        throw new HttpsError("invalid-argument", "Merchant ID required");
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
      if (!subscriber_number || !/^\d{10,13}$/.test(subscriber_number)) {
        throw new HttpsError("invalid-argument", "Valid phone number required");
      }

      if (!isAgentSignup) {
        const allowed_r_switches = ["MTN", "VDF", "ATL", "TGO", "ZPY", "GMY"];
        if (!r_switch || !allowed_r_switches.includes(r_switch)) {
          throw new HttpsError(
            "invalid-argument",
            `Valid r_switch required: ${allowed_r_switches.join(", ")}`
          );
        }
      }

      const formattedAmount = parseFloat(amount).toFixed(0).padStart(12, "0");

      const requestBody = {
        amount: formattedAmount,
        processing_code,
        transaction_id,
        desc,
        merchant_id,
        subscriber_number,
        "r-switch": r_switch || "MTN",
      };

      try {
        const response = await axios.post(
          "https://prod.theteller.net/v1.1/transaction/process",
          requestBody,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: "Basic eXVzc2lmNjcwZDM4M2NhZjU0NDpaV0kxWWpOallURmhOMk5qTTJFME5HRmpPVFJtWWpreU5UZzNaVGxtTjJNPQ==",
              "Cache-Control": "no-cache",
            },
          }
        );

        const responseData = response.data;

        if (responseData.status !== "approved" || responseData.code !== "000") {
          // *** IF AGENT - DELETE USER ON PAYMENT FAILURE ***
          if (isAgentSignup && agentUid) {
            try {
              await auth.deleteUser(agentUid);
              await db.collection("lords-agents").doc(agentUid).delete();
              logger.info(`AGENT USER DELETED (PAYMENT FAILED): ${agentUid}`);
            } catch (cleanupError) {
              logger.error("Cleanup failed:", cleanupError);
            }
          }
          throw new HttpsError(
            "internal",
            `Payment initiation failed: ${responseData.reason}`
          );
        }

        // *** STORE PENDING TRANSACTION ***
        await db
          .collection("theteller-transactions")
          .doc(transaction_id)
          .set({
            merchant_id,
            transaction_id,
            amount: parseFloat(amount),
            status: "pending_pin",
            code: "001",
            reason: "Awaiting PIN confirmation",
            desc,
            subscriber_number,
            r_switch: r_switch || "MTN",
            email: email || "customer@lordsdata.com",
            isAgentSignup,
            agentUid, // Store agent UID if created
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        logger.info(
          `Transaction INITIATED: ${transaction_id} | Type: ${
            isAgentSignup ? "AGENT" : "DATA"
          }`
        );

        return {
          status: "initiated",
          message: "Check your phone for PIN prompt",
          transaction_id,
        };
      } catch (error) {
        logger.error("Theteller initiation error:", error);
        throw new HttpsError(
          "internal",
          `Failed to initiate payment: ${error.message}`
        );
      }
    } else {
      try {
        const doc = await db
          .collection("theteller-transactions")
          .doc(transaction_id)
          .get();
        if (!doc.exists) {
          return {status: "error", message: "Transaction not found"};
        }

        const transaction = doc.data();

        // Update with FINAL result
        await db
          .collection("theteller-transactions")
          .doc(transaction_id)
          .update({
            status: data.status || "unknown",
            code: data.code || "999",
            reason: data.reason || "Callback received",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            exported: data.status === "approved" ? false : null,
          });

        // *** ACTIVATE AGENT ON SUCCESS ***
        if (
          transaction.isAgentSignup &&
          data.status === "approved" &&
          transaction.agentUid
        ) {
          await db.collection("lords-agents").doc(transaction.agentUid).update({
            isActive: true,
          });
          logger.info(`AGENT ACTIVATED: ${transaction.agentUid}`);
        }

        logger.info(`Transaction CALLBACK: ${transaction_id} - ${data.status}`);
        return {
          status: "callback_processed",
          final_status: data.status,
          final_code: data.code,
          reason: data.reason,
        };
      } catch (error) {
        logger.error("Callback error:", error);
        return {status: "error", message: error.message};
      }
    }
  }
);
