const {
  onCall,
  HttpsError,
  onRequest,
} = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const axios = require("axios");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
admin.initializeApp();
const db = admin.firestore();
const MOOLRE_USERNAME = "eustace";
const MOOLRE_PUBKEY =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjEwNzI4MiwiZXhwIjoxOTU2NTQ1OTk5fQ.EhVSXEFO6rM2SCGI8gkkQeKUZn1UK7HH-SmcIPJYGdM";
const MOOLRE_ACCOUNT_NUMBER = "10728206057130";

exports.placeOrder = onRequest(async (req, res) => {
  // CORS Headers
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { agentId, recipient, price, size, network } = req.body;

    if (userId !== agentId)
      return res.status(403).json({ message: "ID Mismatch" });

    const packageIdMap = {
      "1GB": 20,
      "2GB": 21,
      "3GB": 22,
      "4GB": 23,
      "5GB": 24,
      "6GB": 25,
      "8GB": 27,
      "10GB": 28,
      "15GB": 29,
      "20GB": 30,
      "25GB": 31,
      "30GB": 32,
      "40GB": 33,
      "50GB": 34,
    };

    const packageId = packageIdMap[size];
    if (!packageId) throw new Error(`Invalid package size: ${size}`);

    const agentRef = db.collection("dataplug-agents").doc(userId);
    const orderRef = db.collection("webite_purchase").doc();
    const historyRef = db.collection("wallet_history").doc(); // New History Ref

    // 1. ATOMIC TRANSACTION: Deduct and Log History
    await db.runTransaction(async (transaction) => {
      const agentDoc = await transaction.get(agentRef);
      if (!agentDoc.exists) throw new Error("Agent not found");

      const balance = agentDoc.data().walletBalance || 0;
      if (balance < price) throw new Error("Insufficient Funds");

      const newBalance = balance - price;

      // Update Wallet
      transaction.update(agentRef, {
        walletBalance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log to wallet_history (DEBIT)
      transaction.set(historyRef, {
        agentId: userId,
        amount: price,
        type: "debit",
        description: `Purchase: ${size} for ${recipient}`,
        oldBalance: balance,
        newBalance: newBalance,
        orderId: orderRef.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create Order
      transaction.set(orderRef, {
        agentId: userId,
        recipientNumber: recipient,
        amount: price,
        size: size,
        provider: network.toUpperCase(),
        status: "processing",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // 2. EXTERNAL API CALL
    try {
      const apiResponse = await axios.post(
        "https://myspaceserver.com/api/external/orders",
        { package_id: packageId, customer_phone: recipient },
        {
          headers: {
            "X-API-Key":
              "sk_37f0307b219967ad569f2d45f9a1c0d72c08e166447e2f469fbeae9712fa095b",
            "Content-Type": "application/json",
          },
          timeout: 60000,
        },
      );

      await orderRef.update({
        status: "success",
        apiResponse: apiResponse.data,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res
        .status(200)
        .json({ message: "Order Delivered", orderId: orderRef.id });
    } catch (apiError) {
      console.error("[API ERROR]", apiError.message);

      // 3. REFUND TRANSACTION (If API Fails)
      const refundHistoryRef = db.collection("wallet_history").doc();

      await db.runTransaction(async (t) => {
        const agentDoc = await t.get(agentRef);
        const currentBal = agentDoc.data().walletBalance || 0;
        const refundedBal = currentBal + price;

        t.update(agentRef, { walletBalance: refundedBal });

        // Log to wallet_history (CREDIT/REFUND)
        t.set(refundHistoryRef, {
          agentId: userId,
          amount: price,
          type: "credit",
          description: `Refund: Failed delivery to ${recipient}`,
          oldBalance: currentBal,
          newBalance: refundedBal,
          orderId: orderRef.id,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        t.update(orderRef, {
          status: "failed",
          error: apiError.message,
          refunded: true,
        });
      });

      return res
        .status(502)
        .json({ message: "API failed. Funds refunded to history." });
    }
  } catch (error) {
    console.error("[CRITICAL ERROR]", error);
    return res.status(400).json({ message: error.message });
  }
});

exports.initializeAgentPayment = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).send("Unauthorized");

  try {
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { amount, email } = req.body;

    if (!amount || !email) {
      return res.status(400).json({ message: "Amount and Email are required" });
    }

    const MOOLRE_USERNAME = "eustace";
    const MOOLRE_PUBKEY =
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjEwNzI4MiwiZXhwIjoxOTU2NTQ1OTk5fQ.EhVSXEFO6rM2SCGI8gkkQeKUZn1UK7HH-SmcIPJYGdM";
    const MOOLRE_ACCOUNT_NUMBER = "10728206057130";

    const externalRef = `TOPUP_${Date.now()}_${userId.substring(0, 5)}`;

    const payload = {
      type: 1,
      amount: parseFloat(amount).toFixed(2).toString(),
      email: email.trim(),
      externalref: externalRef,
      callback:
        "https://us-central1-eustech-c4332.cloudfunctions.net/moolreWebhookAgent",
      redirect: "https://www.rickysdata.xyz/agent-portal",
      reusable: "0",
      currency: "GHS",
      accountnumber: MOOLRE_ACCOUNT_NUMBER,
      metadata: { agentId: userId },
    };

    const response = await axios.post(
      "https://api.moolre.com/embed/link",
      payload,
      {
        headers: {
          "X-API-USER": MOOLRE_USERNAME,
          "X-API-PUBKEY": MOOLRE_PUBKEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    if (response.data.status === 1) {
      // --- LOG TO WALLET_HISTORY AS PENDING ---
      await admin
        .firestore()
        .collection("wallet_history")
        .doc(externalRef)
        .set({
          agentId: userId,
          amount: parseFloat(amount),
          type: "credit",
          description: "Wallet Top-up (Initiated)",
          reference: externalRef,
          provider: "Moolre",
          status: "pending", // Will be updated to 'completed' by webhook
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      return res.status(200).json({
        checkoutUrl: response.data.data.authorization_url,
      });
    } else {
      console.error("Moolre Logic Error:", response.data);
      return res.status(400).json({
        message: "Moolre failed to initialize",
        detail: response.data,
      });
    }
  } catch (error) {
    if (error.response) {
      console.error("Moolre API Rejected Request:", error.response.data);
      return res.status(400).json({
        message: "Moolre API Error",
        detail: error.response.data,
      });
    }
    console.error("System Error:", error.message);
    return res.status(500).json({ message: error.message });
  }
});

exports.moolreWebhookAgent = onRequest(async (req, res) => {
  const body = req.body;

  // Moolre payload structure: status at top, data object contains details
  if (body.status === 1 && body.data) {
    const txData = body.data;
    const amountPaid = parseFloat(txData.amount);
    const transactionRef = txData.externalref;

    // 1. Reference the history doc using the externalref
    const historyRef = admin
      .firestore()
      .collection("wallet_history")
      .doc(transactionRef);

    try {
      await admin.firestore().runTransaction(async (t) => {
        // 2. Fetch the pending transaction log to find the agentId
        const historyDoc = await t.get(historyRef);

        if (!historyDoc.exists) {
          console.error(
            `Transaction record ${transactionRef} not found in Firestore.`,
          );
          return; // Critical: We don't know who to credit
        }

        const historyData = historyDoc.data();

        // 3. Idempotency: Stop if already completed
        if (historyData.status === "completed") {
          console.log(`Transaction ${transactionRef} already processed.`);
          return;
        }

        const agentId = historyData.agentId;
        const agentRef = admin
          .firestore()
          .collection("dataplug-agents")
          .doc(agentId);

        // 4. Get current agent balance
        const agentDoc = await t.get(agentRef);
        if (!agentDoc.exists)
          throw new Error(`Agent ${agentId} no longer exists`);

        const oldBal = agentDoc.data().walletBalance || 0;
        const newBal = oldBal + amountPaid;

        // 5. Update Agent Balance
        t.update(agentRef, {
          walletBalance: newBal,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 6. Update History Record
        t.update(historyRef, {
          status: "completed",
          oldBalance: oldBal,
          newBalance: newBal,
          moolreTransactionId: txData.transactionid, // Store Moolre's ID for support
          description: "Wallet Top-up via MoMo (Confirmed)",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`Successfully funded Agent via ref: ${transactionRef}`);
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook Error:", err.message);
      return res.status(500).send("Internal Server Error");
    }
  }

  // Handle Failures
  if (body.status === 0 || body.data?.txstatus === 0) {
    const transactionRef = body.data?.externalref;
    if (transactionRef) {
      await admin
        .firestore()
        .collection("wallet_history")
        .doc(transactionRef)
        .update({
          status: "failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  }

  res.status(200).send("Acknowledged");
});

exports.reconcilePendingAgents = onSchedule(
  "every 5 minutes",
  async (event) => {
    const db = admin.firestore();

    // Look for payments pending for more than 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

    const pendingSnap = await db
      .collection("wallet_history")
      .where("status", "==", "pending")
      .where("timestamp", "<=", tenMinsAgo)
      .limit(15)
      .get();

    if (pendingSnap.empty) return null;

    const MOOLRE_USER = "eustace";
    const MOOLRE_KEY =
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjEwNzI4MiwiZXhwIjoxOTU2NTQ1OTk5fQ.EhVSXEFO6rM2SCGI8gkkQeKUZn1UK7HH-SmcIPJYGdM";
    const MOOLRE_ACC = "10728206057130";

    const tasks = pendingSnap.docs.map(async (doc) => {
      const transaction = doc.data();
      const externalRef = transaction.reference;

      try {
        const response = await axios.post(
          "https://api.moolre.com/open/transact/status",
          {
            type: 1,
            idtype: 1, // Checking by external reference
            id: externalRef,
            accountnumber: MOOLRE_ACC,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-API-USER": MOOLRE_USER,
              "X-API-KEY": MOOLRE_KEY,
            },
            timeout: 7000,
          },
        );

        const moolreData = response.data;

        // Status 1 = Success at Moolre
        if (moolreData.status === 1 && moolreData.data?.txstatus === 1) {
          const amountPaid = parseFloat(moolreData.data.amount);
          const agentId = transaction.agentId;

          await db.runTransaction(async (t) => {
            const agentRef = db.collection("dataplug-agents").doc(agentId);
            const agentDoc = await t.get(agentRef);

            if (!agentDoc.exists) return;

            const oldBal = agentDoc.data().walletBalance || 0;
            const newBal = oldBal + amountPaid;

            t.update(agentRef, {
              walletBalance: newBal,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            t.update(doc.ref, {
              status: "completed",
              oldBalance: oldBal,
              newBalance: newBal,
              moolreTxId: moolreData.data.transactionid,
              description: "Wallet Top-up (Auto-Reconciled)",
              confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
          console.log(`[RECONCILE SUCCESS] Ref: ${externalRef}`);
        } else if (moolreData.status === 0 || moolreData.data?.txstatus === 0) {
          // Mark as failed if the API confirms the transaction failed
          await doc.ref.update({
            status: "failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[RECONCILE FAILED] Ref: ${externalRef}`);
        }
      } catch (error) {
        console.error(
          `[RECONCILE ERROR] ${externalRef}:`,
          error.response?.data || error.message,
        );
      }
    });

    await Promise.all(tasks);
    return null;
  },
);

exports.reconcileMissingWebhooks = onSchedule(
  {
    schedule: "* * * * *", // Runs every single minute
    timeoutSeconds: 120, // Protects against overlapping loops
    memory: "512MiB",
  },
  async (event) => {
    logger.info(
      "Starting rapid Moolre transaction check sweep via POST status query...",
    );

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // 1. Fetch the documents matching your exact criteria
      const pendingSnap = await db
        .collection("moolre_transactions")
        .where("status", "==", "pending")
        .where("createdAt", ">=", oneHourAgo)
        .where("createdAt", "<=", fiveMinutesAgo)
        .limit(20)
        .get();

      if (pendingSnap.empty) {
        return;
      }

      logger.info(
        `Found ${pendingSnap.size} pending transactions older than 5 mins to verify.`,
      );

      const MOOLRE_USER = "eustace";
      const MOOLRE_KEY =
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjEwNzI4MiwiZXhwIjoxOTU2NTQ1OTk5fQ.EhVSXEFO6rM2SCGI8gkkQeKUZn1UK7HH-SmcIPJYGdM";
      const MOOLRE_ACC = "10728206057130";

      // 2. Map over the documents using your tasks strategy
      const tasks = pendingSnap.docs.map(async (doc) => {
        const transaction = doc.data();
        // Matching your dynamic field pointer structure
        const externalRef = transaction.reference || transaction.externalref;

        if (!externalRef) {
          logger.warn(`Document ${doc.id} is missing a reference field value.`);
          return;
        }

        try {
          const response = await axios.post(
            "https://api.moolre.com/open/transact/status",
            {
              type: 1,
              idtype: 1, // Checking by external reference
              id: externalRef,
              accountnumber: MOOLRE_ACC,
            },
            {
              headers: {
                "Content-Type": "application/json",
                "X-API-USER": MOOLRE_USER,
                "X-API-KEY": MOOLRE_KEY,
              },
              timeout: 7000,
            },
          );

          const moolreData = response.data;

          // Status 1 = Success at Moolre API, txstatus 1 = Customer successfully completed payment
          if (moolreData.status === 1 && moolreData.data?.txstatus === 1) {
            logger.info(
              `Scheduler found paid transaction: ${externalRef}. Injecting into delivery pipeline.`,
            );

            const innerData = moolreData.data;
            const mockPayload = {
              data: {
                externalref: externalRef,
                transactionid: innerData.transactionid || innerData.reference,
                txstatus: 1,
                metadata: transaction.metadata || {},
                amount: transaction.amount || innerData.amount,
                payee:
                  innerData.payee ||
                  transaction.email ||
                  "reconciliation-fallback",
              },
            };

            await triggerInternalDeliveryPipeline(mockPayload);
          } else if (
            moolreData.status === 1 &&
            (moolreData.data?.txstatus === 0 ||
              moolreData.data?.status === "failed")
          ) {
            // If the transaction failed definitively on Moolre's side, close the local record status
            logger.info(
              `Scheduler closing dead/failed transaction log line: ${externalRef}`,
            );
            await doc.ref.update({
              final_status: "failed",
              status: "failed",
              reconciled_at: admin.firestore.FieldValue.serverTimestamp(),
              reconciliation_note:
                "Marked failed by 5-minute fallback safety task sweep.",
            });
          } else {
            logger.debug(
              `Transaction ${externalRef} is still unexecuted or pending checkout action.`,
            );
          }
        } catch (apiError) {
          logger.error(
            `Error connecting to status query endpoint for ${externalRef}:`,
            apiError.message,
          );
        }
      });

      // Execute all query instances in parallel safely within the minute execution block
      await Promise.all(tasks);
    } catch (globalErr) {
      logger.error(
        "Global crash inside the task execution reconciliation worker:",
        globalErr,
      );
    }
  },
);

/**
 * Processes a verified transaction found by the reconciliation scheduler.
 * Implements full idempotency locks and delivers bundles to JusticeDataShop or MySpaceServer.
 */
async function triggerInternalDeliveryPipeline(mockWebhookPayload) {
  const moolreData = mockWebhookPayload.data;
  const externalRef = moolreData.externalref;

  const moolreTxRef = db.collection("moolre_transactions").doc(externalRef);

  try {
    // 1. Use a Firestore Transaction to safely handle race conditions
    const result = await db.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(moolreTxRef);
      if (!txDoc.exists) {
        throw new Error(
          `Transaction document not found for ref: ${externalRef}`,
        );
      }

      const txData = txDoc.data();

      if (txData.final_status === "success" || txData.status === "success") {
        return { alreadyProcessed: true };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      transaction.update(moolreTxRef, {
        final_status: "success",
        status: "success",
        moolre_transaction_id: moolreData.transactionid?.toString(),
        status_checked_at: now,
        amount_paid: moolreData.amount,
        payee_number: moolreData.payee,
        reconciliation_processed: true,
      });

      return {
        alreadyProcessed: false,
        isSuccess: true,
        now,
        originalTxData: txData,
      };
    });

    if (result.alreadyProcessed) {
      logger.info(
        `Reconciliation safety bypass: ${externalRef} was already fulfilled by another worker.`,
      );
      return;
    }

    const metadata =
      moolreData.metadata || result.originalTxData?.metadata || {};

    const formatToLocal = (number) => {
      if (!number) return "";
      let cleanNumber = number.toString().trim();
      if (cleanNumber.startsWith("233"))
        cleanNumber = "0" + cleanNumber.slice(3);
      return cleanNumber.replace(/\D/g, "");
    };

    const recipient = formatToLocal(metadata.recipient_number);

    const providerStr = (metadata.provider || "").toUpperCase().trim();
    const isAT =
      providerStr.includes("AT") ||
      providerStr.includes("AIRTEL") ||
      providerStr.includes("TIGO");
    const isTelecel =
      providerStr.includes("TELECEL") || providerStr.includes("VODA");

    let extractedSize = parseFloat(metadata.gb);
    if (isNaN(extractedSize) && metadata.description) {
      const match = metadata.description.match(/(\d+(?:\.\d+)?)\s*GB/i);
      if (match) extractedSize = parseFloat(match[1]);
    }

    let deliveryStatus = "pending";
    let deliveryMessage = "";
    let packageId = null;
    let apiCostPrice = 0; // Initialize tracking for metrics calculation

    /* ------------------- BRANCH A: AT & TELECEL DATA PLANS ------------------- */
    if (isAT || isTelecel) {
      const finalNetwork = isAT ? "AIRTELTIGO" : "TELECEL";

      const deliveryPayload = {
        phone: recipient,
        size: extractedSize,
        network:
          finalNetwork === "AIRTELTIGO"
            ? extractedSize > 10
              ? "AIRTELTIGO_BIGTIME"
              : "AIRTELTIGO_ISHARE"
            : "TELECEL",
        callback:
          "https://us-central1-eustech-c4332.cloudfunctions.net/moolreWebhookRicky",
      };

      try {
        const apiResponse = await axios.post(
          "https://backend.justicedatashop.com/api/order",
          deliveryPayload,
          {
            headers: {
              "X-API-Key":
                "naj_live_1779152284137_g8q4dqk6fwrb2217bnl0fo_jaog684e07ioiq7zpcortr",
              "Content-Type": "application/json",
            },
            timeout: 60000,
          },
        );

        if (
          apiResponse.data?.status === true ||
          apiResponse.status === 201 ||
          apiResponse.status === 200
        ) {
          deliveryStatus = "delivered";
          deliveryMessage = `Reconciliation fixed: Data plan routed via JusticeDataShop (${deliveryPayload.network})`;

          // Map cost metrics accurately converting Pesewas to GHS units
          if (apiResponse.data?.payload?.price !== undefined) {
            apiCostPrice = parseFloat(apiResponse.data.payload.price) / 100;
          }
        }
      } catch (apiError) {
        deliveryStatus = "failed";
        deliveryMessage =
          apiError.response?.data?.message ||
          "JusticeDataShop API communication failure";
        logger.error(
          `JusticeDataShop failed during reconciliation for ${externalRef}:`,
          deliveryMessage,
        );
      }

      /* ----------------------- BRANCH B: MTN DATA PLANS ----------------------- */
    } else {
      let apiUrl = "";
      let apiPayload = {};

      if (metadata.type === "special_offer") {
        // Special Offers endpoint logic
        packageId = metadata.package_id;
        apiUrl =
          "https://myspaceserver.com/api/external/special-offers/mashup/orders";
        apiPayload = {
          special_offer_package_id: packageId,
          customer_phone: recipient,
        };
      } else {
        // Regular Bundles endpoint logic
        const packageIdMap = {
          "1GB": 20,
          "2GB": 21,
          "3GB": 22,
          "4GB": 23,
          "5GB": 24,
          "6GB": 25,
          "8GB": 27,
          "10GB": 28,
          "15GB": 29,
          "20GB": 30,
          "25GB": 31,
          "30GB": 32,
          "40GB": 33,
          "50GB": 34,
        };
        const gbKey = `${Math.round(extractedSize)}GB`;
        packageId = packageIdMap[gbKey];

        apiUrl = "https://myspaceserver.com/api/external/orders";
        apiPayload = {
          package_id: packageId,
          customer_phone: recipient,
        };
      }

      if (packageId) {
        try {
          const apiResponse = await axios.post(apiUrl, apiPayload, {
            headers: {
              "X-API-Key":
                "sk_37f0307b219967ad569f2d45f9a1c0d72c08e166447e2f469fbeae9712fa095b",
              "Content-Type": "application/json",
            },
            timeout: 60000,
          });

          const isSuccessStatus = [200, 201, 202].includes(apiResponse.status);
          const apiData = apiResponse.data || {};
          const isInternalError =
            apiData.status === "error" || apiData.success === false;

          if (isSuccessStatus && !isInternalError) {
            deliveryStatus = "delivered";
            deliveryMessage =
              metadata.type === "special_offer"
                ? `Special offer processed via MySpace Mashup API: ${apiData.message || "Success"}`
                : `Regular data plan sent via MySpaceServer API: ${apiData.message || "Success"}`;

            // Map standard layout regular bundle cost structure natively
            if (apiData.success && apiData.order?.cost_price) {
              apiCostPrice = parseFloat(apiData.order.cost_price);
            }
          } else {
            deliveryStatus = "failed";
            deliveryMessage =
              apiData.message ||
              `API returned status code: ${apiResponse.status}`;
            logger.warn(
              `MySpaceServer non-success envelope for ${externalRef}:`,
              apiData,
            );
          }
        } catch (apiError) {
          deliveryStatus = "failed";

          if (apiError.response) {
            const statusCode = apiError.response.status;
            const errorData = apiError.response.data;
            deliveryMessage = `HTTP ${statusCode}: ${typeof errorData === "object" ? JSON.stringify(errorData) : errorData}`;

            logger.error(
              `MySpaceServer REJECTED ref ${externalRef} with Status ${statusCode}. Raw Response:`,
              errorData,
            );
          } else if (apiError.request) {
            deliveryMessage =
              "No response received from MySpaceServer server (Network Drop)";
            logger.error(
              `MySpaceServer network timeout/drop for ref ${externalRef}`,
            );
          } else {
            deliveryMessage = apiError.message;
            logger.error(
              `Axios setup error for ref ${externalRef}:`,
              apiError.message,
            );
          }
        }
      } else {
        deliveryStatus = "failed";
        deliveryMessage =
          "Could not resolve a valid MySpace packageId mapping during status fallback check";
      }
    }

    /* ------------------- REVENUE & ANALYTICS UPDATE ------------------- */
    if (deliveryStatus === "delivered") {
      const amountPaid = Number(moolreData.amount || 0);
      const computedProfit = amountPaid - apiCostPrice;

      const dateOptions = {
        timeZone: "Africa/Accra",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      };
      const ghanaDateStr = new Date()
        .toLocaleDateString("en-ZA", dateOptions)
        .replace(/\//g, "-");

      const statsRef = db.collection("rickys_analytics").doc(ghanaDateStr);

      try {
        await db.runTransaction(async (analyticsTx) => {
          const statsDoc = await analyticsTx.get(statsRef);

          let currentProfit = statsDoc.exists ? statsDoc.data().profit || 0 : 0;
          let currentCount = statsDoc.exists
            ? statsDoc.data().ordercount || 0
            : 0;
          let currentSales = statsDoc.exists
            ? statsDoc.data().salestransaction || 0
            : 0;

          analyticsTx.set(
            statsRef,
            {
              profit: currentProfit + computedProfit,
              salestransaction: currentSales + amountPaid,
              ordercount: currentCount + 1,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        });
      } catch (analyticsErr) {
        logger.error(
          `[Pipeline Analytics Failure] Ref ${externalRef}:`,
          analyticsErr.message,
        );
      }
    }

    // 3. Save historical context to your records journal
    const isSpecial = metadata.type === "special_offer";
    const computedServiceId = isSpecial
      ? metadata.package_id?.toString()
      : metadata.service_id || `D${metadata.gb}`;
    const computedServiceName = isSpecial
      ? `MTN Special: ${metadata.slug || "Offer"}`
      : `${metadata.provider || "Network"} ${metadata.gb}GB Plan`;

    await saveDataPurchase(
      {
        externalRef: externalRef,
        moolreTransactionId: moolreData.transactionid?.toString(),
        amount: parseFloat(moolreData.amount),
        phoneNumber: moolreData.payee,
        recipientNumber: metadata.recipient_number,
        serviceId: computedServiceId,
        serviceName: computedServiceName,
        transactionId: externalRef,
        ussdSessionId: metadata.ussd_session_id || null,
        packageId: packageId,
        deliveryStatus: deliveryStatus,
        deliveryMessage: deliveryMessage,
        providerResponse: deliveryStatus === "delivered" ? "Success" : "Failed",
        metadata: metadata,
      },
      result.now,
    );
  } catch (err) {
    logger.error(
      `Critical execution breakdown inside internal delivery pipeline for ref ${externalRef}:`,
      err,
    );
  }
}

exports.moolreWebhookRicky = onRequest(
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

    const allowedTypes = ["data_bundle", "special_offer"];
    if (!allowedTypes.includes(metadata?.type)) {
      logger.info(`Ignoring non-supported metadata type: ${metadata?.type}`);
      return res
        .status(200)
        .send(`Ignored: Type ${metadata?.type} not processed here`);
    }

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
      // 1. Use a Transaction to handle double-processing (Idempotency)
      const result = await db.runTransaction(async (transaction) => {
        const txDoc = await transaction.get(moolreTxRef);

        if (!txDoc.exists) {
          throw new Error("Transaction not found");
        }

        const txData = txDoc.data();

        if (txData.final_status) {
          return { alreadyProcessed: true };
        }

        const isSuccess = txstatus === 1;
        const now = admin.firestore.FieldValue.serverTimestamp();

        transaction.update(moolreTxRef, {
          final_status: isSuccess ? "success" : "failed",
          moolre_transaction_id: moolreTransactionId?.toString(),
          webhook_payload: payload,
          status_checked_at: now,
          amount_paid: amount,
          payee_number: payee,
          status: isSuccess ? "delivered" : "failed",
        });

        return { alreadyProcessed: false, isSuccess, now };
      });

      if (result.alreadyProcessed) {
        logger.info("Duplicate webhook detected and ignored:", externalref);
        return res.status(200).send("Already processed");
      }

      // 2. Logic outside the transaction (API execution branch)
      if (result.isSuccess) {
        const formatToLocal = (number) => {
          if (!number) return "";
          let cleanNumber = number.toString().trim();
          if (cleanNumber.startsWith("233"))
            cleanNumber = "0" + cleanNumber.slice(3);
          return cleanNumber.replace(/\D/g, "");
        };

        const recipient = formatToLocal(metadata.recipient_number);

        // Normalize provider identifier name string
        const providerStr = (metadata.provider || "").toUpperCase().trim();
        const isAT =
          providerStr.includes("AT") ||
          providerStr.includes("AIRTEL") ||
          providerStr.includes("TIGO");
        const isTelecel =
          providerStr.includes("TELECEL") || providerStr.includes("VODA");

        // Parse explicit GB numeric value safely
        let extractedSize = parseFloat(metadata.gb);
        if (isNaN(extractedSize) && metadata.description) {
          const match = metadata.description.match(/(\d+(?:\.\d+)?)\s*GB/i);
          if (match) extractedSize = parseFloat(match[1]);
        }

        let deliveryStatus = "pending";
        let deliveryMessage = "";
        let packageId = null;
        let apiCostPrice = 0; // Initialize cost tracking

        /* ------------------ BRANCH A: AT & TELECEL ORDERS ------------------ */
        if (isAT || isTelecel) {
          const finalNetwork = isAT ? "AIRTELTIGO" : "TELECEL";

          const deliveryPayload = {
            phone: recipient,
            size: extractedSize,
            network:
              finalNetwork === "AIRTELTIGO"
                ? extractedSize > 10
                  ? "AIRTELTIGO_BIGTIME"
                  : "AIRTELTIGO_ISHARE"
                : "TELECEL",
            callback:
              "https://us-central1-eustech-c4332.cloudfunctions.net/moolreWebhookRicky",
          };

          try {
            const apiResponse = await axios.post(
              "https://backend.justicedatashop.com/api/order",
              deliveryPayload,
              {
                headers: {
                  "X-API-Key":
                    "naj_live_1779152284137_g8q4dqk6fwrb2217bnl0fo_jaog684e07ioiq7zpcortr",
                  "Content-Type": "application/json",
                },
                timeout: 60000,
              },
            );

            // Access status property safely from the response payload directly
            if (
              apiResponse.data?.status === true ||
              apiResponse.status === 201 ||
              apiResponse.status === 200
            ) {
              deliveryStatus = "delivered";
              deliveryMessage = `Data plan routed via JusticeDataShop (${deliveryPayload.network})`;

              // Extract price from the explicit payload and scale it down from pesewas to GHS
              if (apiResponse.data?.payload?.price !== undefined) {
                apiCostPrice = parseFloat(apiResponse.data.payload.price) / 100;
              }
            }
          } catch (apiError) {
            deliveryStatus = "failed";
            deliveryMessage =
              apiError.response?.data?.message ||
              "JusticeDataShop API communication failure";
          }

          /* -------------------- BRANCH B: MTN ORDERS -------------------- */
        } else {
          let apiUrl = "";
          let apiPayload = {};

          if (metadata.type === "special_offer") {
            // Special Offers configuration
            packageId = metadata.package_id;
            apiUrl =
              "https://myspaceserver.com/api/external/special-offers/mashup/orders";
            apiPayload = {
              special_offer_package_id: packageId,
              customer_phone: recipient,
            };
          } else {
            // Regular Bundles configuration
            const packageIdMap = {
              "1GB": 20,
              "2GB": 21,
              "3GB": 22,
              "4GB": 23,
              "5GB": 24,
              "6GB": 25,
              "8GB": 27,
              "10GB": 28,
              "15GB": 29,
              "20GB": 30,
              "25GB": 31,
              "30GB": 32,
              "40GB": 33,
              "50GB": 34,
            };
            const gbKey = `${Math.round(extractedSize)}GB`;
            packageId = packageIdMap[gbKey];

            apiUrl = "https://myspaceserver.com/api/external/orders";
            apiPayload = {
              package_id: packageId,
              customer_phone: recipient,
            };
          }

          // Shoot the request to MySpaceServer if we successfully mapped a packageId
          if (packageId) {
            try {
              const apiResponse = await axios.post(apiUrl, apiPayload, {
                headers: {
                  "X-API-Key":
                    "sk_37f0307b219967ad569f2d45f9a1c0d72c08e166447e2f469fbeae9712fa095b",
                  "Content-Type": "application/json",
                },
                timeout: 60000,
              });

              if (apiResponse.status === 200 || apiResponse.status === 201) {
                deliveryStatus = "delivered";
                deliveryMessage =
                  metadata.type === "special_offer"
                    ? "Special offer sent successfully via MySpaceServer Mashup API"
                    : "Regular data plan sent successfully via MySpaceServer API";

                // Extract cost price from MySpaceServer response structure
                if (
                  apiResponse.data?.success &&
                  apiResponse.data.order?.cost_price
                ) {
                  apiCostPrice = parseFloat(apiResponse.data.order.cost_price);
                }
              }
            } catch (apiError) {
              deliveryStatus = "failed";
              deliveryMessage =
                apiError.response?.data?.message ||
                "MySpaceServer API connection failed";
            }
          } else {
            deliveryStatus = "failed";
            deliveryMessage =
              "Could not resolve a valid MySpace packageId mapping";
          }
        }

        /* ------------------ REVENUE & ANALYTICS UPDATE ------------------ */
        // Process financials only if delivery was marked complete
        if (deliveryStatus === "delivered") {
          const amountPaid = Number(amount || 0);
          const computedProfit = amountPaid - apiCostPrice;

          const dateOptions = {
            timeZone: "Africa/Accra",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          };
          const ghanaDateStr = new Date()
            .toLocaleDateString("en-ZA", dateOptions)
            .replace(/\//g, "-");

          const statsRef = db.collection("rickys_analytics").doc(ghanaDateStr);

          try {
            await db.runTransaction(async (analyticsTx) => {
              const statsDoc = await analyticsTx.get(statsRef);

              let currentProfit = statsDoc.exists
                ? statsDoc.data().profit || 0
                : 0;
              let currentCount = statsDoc.exists
                ? statsDoc.data().ordercount || 0
                : 0;
              let currentSales = statsDoc.exists
                ? statsDoc.data().salestransaction || 0
                : 0;

              analyticsTx.set(
                statsRef,
                {
                  profit: currentProfit + computedProfit,
                  salestransaction: currentSales + amountPaid,
                  ordercount: currentCount + 1,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            });
          } catch (analyticsErr) {
            logger.error(
              `[Analytics Write Failure] Ref ${externalref}:`,
              analyticsErr.message,
            );
          }
        }

        // 3. Persist data tracking variables inside standard record architecture
        const isSpecial = metadata.type === "special_offer";
        const computedServiceId = isSpecial
          ? metadata.package_id?.toString()
          : metadata.service_id || `D${metadata.gb}`;
        const computedServiceName = isSpecial
          ? `MTN Special: ${metadata.slug || "Offer"}`
          : `${metadata.provider || "Network"} ${metadata.gb}GB Plan`;

        await saveDataPurchase(
          {
            externalRef: externalref,
            moolreTransactionId: moolreTransactionId?.toString(),
            amount: parseFloat(amount),
            phoneNumber: payee,
            recipientNumber: metadata.recipient_number,
            serviceId: computedServiceId,
            serviceName: computedServiceName,
            transactionId: externalref,
            ussdSessionId: metadata.ussd_session_id || null,
            packageId: packageId,
            deliveryStatus: deliveryStatus,
            deliveryMessage: deliveryMessage,
            providerResponse:
              deliveryStatus === "delivered" ? "Success" : "Failed",
            metadata: metadata,
          },
          result.now,
        );
      }

      return res.status(200).send("OK");
    } catch (error) {
      if (error.message === "Transaction not found") {
        return res.status(404).send("Transaction not found");
      }
      logger.error("Webhook processing error:", error);
      return res.status(500).send("Internal error");
    }
  },
);
/**
 * Save data purchase to `webite_purchase`
 */
async function saveDataPurchase(purchase, now) {
  const docRef = db.collection("webite_purchase").doc(purchase.externalRef);

  // Determine standard properties or map our dynamic custom parameters
  const isSpecialOffer = purchase.metadata?.type === "special_offer";

  const serviceId = isSpecialOffer
    ? purchase.metadata?.package_id?.toString() // e.g. "24"
    : purchase.serviceId;

  const serviceName = isSpecialOffer
    ? `MTN Special: ${purchase.metadata?.slug || "Bundle"}` // e.g. "MTN Special: 1.7gb"
    : purchase.serviceName;

  await docRef.set({
    amount: purchase.amount,
    createdAt: now,
    exported: false,
    externalRef: purchase.externalRef,
    moolreTransactionId: purchase.moolreTransactionId,
    paymentMethod: "Mobile Money",
    phoneNumber: purchase.phoneNumber,
    serviceId: serviceId || null,
    serviceName: serviceName || null,
    recipientNumber: purchase.recipientNumber || null,
    status: "approved",
    statusCheckedAt: now,
    transactionId: purchase.transactionId,
    ussdSessionId: purchase.ussdSessionId || null,

    // Explicitly record custom offer categories so execution scripts filter safely
    purchaseType: isSpecialOffer ? "special_offer" : "regular_bundle",
    ...(isSpecialOffer && { specialOfferSlug: purchase.metadata?.slug || "" }),
  });

  logger.info(
    `Data purchase saved: ${purchase.externalRef} [Type: ${isSpecialOffer ? "Special" : "Regular"}]`,
  );
}

/**
 * Create Firebase Auth user + dataplug-agents record
 */

// Helper
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  if (phone.startsWith("0") && phone.length === 10)
    return `233${phone.slice(1)}`;
  if (phone.startsWith("233") && phone.length === 12) return phone;
  return `233${phone.replace(/\D/g, "")}`;
};

const { v4: uuidv4 } = require("uuid");

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

    // New Sub-Validation for Special Offer Data Packages
    if (metadata.type === "special_offer") {
      if (!metadata.package_id || !metadata.slug) {
        throw new HttpsError(
          "invalid-argument",
          "Special offer orders require package_id and slug identification markers.",
        );
      }
    }

    const ref = externalref || uuidv4();
    const currency = "GHS";
    const type = reusable ? 2 : 1;

    const defaultCallback =
      "https://us-central1-eustech-c4332.cloudfunctions.net/moolreWebhookRicky";

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
        },
      );

      const { status, code, message, data: resData } = response.data;

      if (status !== 1 || code !== "POS09") {
        logger.error("Moolre error response:", response.data);
        throw new HttpsError(
          "internal",
          `Moolre returned error: ${message} (code ${code})`,
        );
      }

      const { authorization_url, reference: moolreRef } = resData;

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
          metadata: payload.metadata, // Saving full extended metadata safely
          userId: userId || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "pending",
        });

      logger.info(
        `Moolre link generated → externalref: ${ref}, moolre_ref: ${moolreRef}`,
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
        `Failed to generate Moolre link: ${err.message}`,
      );
    }
  },
);
