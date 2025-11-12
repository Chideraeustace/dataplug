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
const MOOLRE_USERNAME = ""
const MOOLRE_PUBKEY ="";
 
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
              recipientNumber: metadata.recipient_number,
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
    recipientNumber: purchase.recipientNumber || null,
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
      redirect,
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
      redirect: redirect || "https://www.rickysdata.xyz",
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