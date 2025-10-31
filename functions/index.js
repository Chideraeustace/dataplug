const {
  onCall,
  HttpsError,
  onRequest,
} = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const MOOLRE_USERNAME = "eustace"
const MOOLRE_PUBKEY ="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjEwNzI4MiwiZXhwIjoxOTI1MDA5OTk5fQ.3MxVZrp6g3HMToSVxXPQmYn4-iv7MgiEaefRusLt-WU";

// Phone number formatting function
/*const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  if (phone.startsWith("0") && phone.length === 10) {
    return `233${phone.slice(1)}`;
  }
  if (phone.startsWith("233") && phone.length === 12) {
    return phone;
  }
  return `233${phone}`;
};

exports.startThetellerPayment = onCall(
  { timeoutSeconds: 120 },
  async ({ data, auth }) => {
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
      agentDetails, // Optional field for agent details
    } = data;

    const userId = auth?.uid;

    // Handle transaction status check
    if (isCallback) {
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

        const { status, code, reason } = response.data;
        logger.info("Theteller status check response:", {
          status,
          code,
          reason,
          transaction_id,
        });

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
          response: error.response?.data,
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
      throw new HttpsError(
        "invalid-argument",
        `Description must be a string, received: ${desc}`
      );
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new HttpsError("invalid-argument", "Valid amount required");
    }
    if (!subscriber_number || !/^\d{10,12}$/.test(subscriber_number)) {
      throw new HttpsError(
        "invalid-argument",
        `Valid MoMo number (10 or 12 digits) required, received: ${subscriber_number}`
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
        `Valid recipient number (10 or 12 digits) required for data purchase, received: ${
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

    // Extract agent details from desc or agentDetails for agent signup
    let parsedAgentDetails = {};
    let thetellerDesc = desc; // Default desc for Theteller
    if (isAgentSignup) {
      try {
        // Try parsing desc as JSON for agent details
        parsedAgentDetails = JSON.parse(desc);
        const {
          email,
          password,
          fullName,
          phone,
          momoNumber,
          paymentNetwork,
          username,
        } = parsedAgentDetails;
        if (
          !email ||
          !password ||
          !fullName ||
          !phone ||
          !momoNumber ||
          !paymentNetwork ||
          !username
        ) {
          throw new HttpsError(
            "invalid-argument",
            "Agent details in desc must include email, password, fullName, phone, momoNumber, paymentNetwork, and username"
          );
        }
        // Craft a new, short desc for Theteller
        thetellerDesc = `Agent Signup for ${fullName}`.substring(0, 100);
      } catch (error) {
        // If desc parsing fails, check for agentDetails
        if (!agentDetails) {
          throw new HttpsError(
            "invalid-argument",
            `Invalid desc format or missing agentDetails for agent signup: ${error.message}`
          );
        }
        try {
          parsedAgentDetails =
            typeof agentDetails === "string"
              ? JSON.parse(agentDetails)
              : agentDetails;
          const {
            email,
            password,
            fullName,
            phone,
            momoNumber,
            paymentNetwork,
            username,
          } = parsedAgentDetails;
          if (
            !email ||
            !password ||
            !fullName ||
            !phone ||
            !momoNumber ||
            !paymentNetwork ||
            !username
          ) {
            throw new HttpsError(
              "invalid-argument",
              "Agent details must include email, password, fullName, phone, momoNumber, paymentNetwork, and username"
            );
          }
          // Use provided desc or craft a new one
          thetellerDesc =
            desc.length <= 100
              ? desc
              : `Agent Signup for ${fullName}`.substring(0, 100);
        } catch (agentError) {
          throw new HttpsError(
            "invalid-argument",
            `Invalid agent details format: ${agentError.message}`
          );
        }
      }
      // Validate thetellerDesc length
      if (thetellerDesc.length > 100) {
        throw new HttpsError(
          "invalid-argument",
          `Theteller description must be ≤100 characters, received: ${thetellerDesc} (${thetellerDesc.length} characters)`
        );
      }
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
        message: isAgentSignup
          ? "Agent registration payment already processed"
          : "Data purchase payment already processed",
        transaction_id,
      };
    }

    // Convert amount (in GHS) to pesewas and pad to 12 digits
    const formattedAmount = (parseFloat(amount) * 100)
      .toFixed(0)
      .padStart(12, "0");

    const requestBody = {
      amount: formattedAmount,
      processing_code: "000200",
      transaction_id,
      desc: thetellerDesc, // Use new desc for Theteller
      merchant_id,
      subscriber_number: formatPhoneNumber(subscriber_number),
      "r-switch": r_switch,
    };

    try {
      logger.info("Sending to Theteller:", { requestBody });
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

      if (isAgentSignup) {
        try {
          const {
            email,
            password,
            fullName,
            phone,
            momoNumber,
            paymentNetwork,
            username,
          } = parsedAgentDetails;
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
            username,
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
          desc, // Store original desc
          subscriber_number: formatPhoneNumber(subscriber_number),
          recipient_number: isAgentSignup
            ? null
            : formatPhoneNumber(recipient_number || subscriber_number),
          r_switch,
          email: email || "customer@data.com",
          isAgentSignup,
          exported: false,
          userId: userId || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          agentDetails: isAgentSignup ? parsedAgentDetails : null,
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
        message: isAgentSignup
          ? "Agent registration payment approved"
          : "Data purchase payment approved",
        transaction_id,
      };
    } catch (error) {
      logger.error("Theteller initiation error:", {
        message: error.message,
        response: error.response?.data,
        transaction_id,
      });
      throw new HttpsError(
        "internal",
        `Failed to initiate payment: ${error.message}`
      );
    }
  }
);*/

exports.moolreWebhook = onRequest(
  { cors: true, timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const payload = req.body;
    logger.info("Moolre webhook received:", JSON.stringify(payload, null, 2));

    const moolreData = payload.data;
    if (!moolreData) {
      logger.warn("Missing 'data' field");
      return res.status(400).send("Invalid payload: missing data");
    }

    const {
      externalref,
      transactionid: moolreTransactionId,
      txstatus,
      metadata,
      amount,
      payee,
    } = moolreData;

    if (!externalref || !metadata || txstatus === undefined) {
      logger.warn("Missing required fields", {
        externalref,
        txstatus,
        metadata,
      });
      return res.status(400).send("Missing required fields");
    }

    const moolreTxRef = db.collection("moolre_transactions").doc(externalref);

    try {
      const txDoc = await moolreTxRef.get();
      if (!txDoc.exists) {
        logger.warn("Transaction not found:", externalref);
        return res.status(404).send("Transaction not found");
      }

      const txData = txDoc.data();

      // Prevent re-processing
      if (txData.final_status) {
        logger.info("Already processed:", externalref);
        return res.status(200).send("Already processed");
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const isSuccess = txstatus === 1;

      // === 1. Update moolre_transactions ===
      await moolreTxRef.update({
        final_status: isSuccess ? "success" : "failed",
        moolre_transaction_id: moolreTransactionId?.toString(),
        webhook_payload: payload,
        status_checked_at: now,
        amount_paid: amount,
        payee_number: payee,
      });

      // === 2. Handle SUCCESS ===
      if (isSuccess) {
        if (metadata.type === "data_bundle") {
          await saveDataPurchase(
            {
              externalRef: externalref,
              moolreTransactionId: moolreTransactionId?.toString(),
              amount: parseFloat(amount),
              phoneNumber: payee,
              serviceId: metadata.service_id || `D${metadata.gb}`,
              serviceName: `${metadata.provider} ${metadata.gb}GB Plan`,
              transactionId: externalref,
              ussdSessionId: metadata.ussd_session_id || null,
            },
            now
          );
        } else if (metadata.type === "agent_signup") {
          await createAgentAccount(metadata, externalref, now);
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Webhook processing error:", error);
      res.status(500).send("Internal error");
    }
  }
);

/**
 * Save data purchase to `webite_purchase`
 */
async function saveDataPurchase(purchase, now) {
  const docRef = db.collection("webite_purchase").doc(purchase.externalRef);

  await docRef.set({
    amount: purchase.amount,
    createdAt: now,
    exported: false,
    externalRef: purchase.externalRef,
    moolreTransactionId: purchase.moolreTransactionId,
    paymentMethod: "Mobile Money",
    phoneNumber: purchase.phoneNumber,
    serviceId: purchase.serviceId,
    serviceName: purchase.serviceName,
    status: "approved",
    statusCheckedAt: now,
    transactionId: purchase.transactionId,
    ussdSessionId: purchase.ussdSessionId,
  });

  logger.info(`Data purchase saved: ${purchase.externalRef}`);
}

/**
 * Create Firebase Auth user + dataplug-agents record
 */
async function createAgentAccount(metadata, externalref, now) {
  const { fullName, phone, momoNumber, email, username, password } = metadata;

  try {
    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    // Save to dataplug-agents
    await db
      .collection("dataplug-agents")
      .doc(userRecord.uid)
      .set({
        fullName,
        phone: formatPhoneNumber(phone),
        momoNumber: formatPhoneNumber(momoNumber),
        email,
        username,
        createdAt: now,
        moolre_externalref: externalref,
        status: "active",
      });

    // Update moolre_transactions
    await db.collection("moolre_transactions").doc(externalref).update({
      agent_created: true,
      firebase_uid: userRecord.uid,
      agent_created_at: now,
    });

    logger.info(`Agent created: ${email} (${userRecord.uid})`);
  } catch (err) {
    logger.error("Agent creation failed:", err);
    await db.collection("moolre_transactions").doc(externalref).update({
      agent_creation_error: err.message,
    });
  }
}

// Helper
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  if (phone.startsWith("0") && phone.length === 10)
    return `233${phone.slice(1)}`;
  if (phone.startsWith("233") && phone.length === 12) return phone;
  return `233${phone.replace(/\D/g, "")}`;
};


const { v4: uuidv4 } = require("uuid");
const MOOLRE_ACCOUNT_NUMBER = "10728206057130";

exports.startMoolrePayment = onCall(
  { timeoutSeconds: 120 },
  async ({ data, auth }) => {
    logger.info("startMoolrePayment payload:", { ...data });

    const {
      amount,
      email,
      desc = "Payment via Moolre",
      externalref,
      metadata = {},
      reusable = false,
    } = data;

    const userId = auth?.uid;

    /* -------------------------- Validation --------------------------- */
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new HttpsError("invalid-argument", "Valid amount required");
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Valid email required");
    }

    const ref = externalref || uuidv4();
    const currency = "GHS";
    const type = reusable ? 2 : 1;

    const defaultCallback =
      "https://us-central1-eustech-c4332.cloudfunctions.net/moolreWebhook";

    /* ---------------------- Duplicate check ----------------------- */
    const existing = await db.collection("moolre_transactions").doc(ref).get();
    if (existing.exists) {
      const cached = existing.data();
      logger.warn(`Moolre transaction ${ref} already exists`);
      return {
        status: "already_exists",
        reference: ref,
        authorization_url: cached.authorization_url,
        message: "Payment link already generated",
      };
    }

    /* ----------------------- Build payload ------------------------ */
    const payload = {
      type,
      amount: parseFloat(amount).toFixed(2),
      email,
      reusable,
      redirect: "https://www.rickysdata.xyz",
      currency,
      externalref: ref,
      callback: defaultCallback,
      accountnumber: MOOLRE_ACCOUNT_NUMBER, // ← ALWAYS INCLUDED
      metadata: {
        ...metadata,
        ...(userId && { firebase_uid: userId }),
        description: desc,
      },
    };

    /* -------------------------- Call Moolre ----------------------- */
    try {
      const response = await axios.post(
        "https://api.moolre.com/embed/link",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-USER": MOOLRE_USERNAME,
            "X-API-PUBKEY": MOOLRE_PUBKEY,
          },
        }
      );

      const { status, code, message, data } = response.data;

      if (status !== 1 || code !== "POS09") {
        logger.error("Moolre error response:", response.data);
        throw new HttpsError(
          "internal",
          `Moolre returned error: ${message} (code ${code})`
        );
      }

      const { authorization_url, reference: moolreRef } = data;

      /* ---------------------- Persist result ---------------------- */
      await db
        .collection("moolre_transactions")
        .doc(ref)
        .set({
          externalref: ref,
          moolre_reference: moolreRef,
          authorization_url,
          amount: parseFloat(amount),
          email,
          reusable,
          type,
          accountnumber: MOOLRE_ACCOUNT_NUMBER,
          callback: payload.callback,
          metadata,
          userId: userId || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "link_generated",
        });

      logger.info(
        `Moolre link generated → externalref: ${ref}, moolre_ref: ${moolreRef}`
      );

      return {
        status: "link_generated",
        reference: ref,
        authorization_url,
        moolre_reference: moolreRef,
        message: "POS payment link successfully generated.",
      };
    } catch (err) {
      logger.error("Moolre request failed:", {
        message: err.message,
        response: err.response?.data,
      });
      throw new HttpsError(
        "internal",
        `Failed to generate Moolre link: ${err.message}`
      );
    }
  }
);