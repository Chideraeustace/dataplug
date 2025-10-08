import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaUserShield,
  FaSignOutAlt,
  FaHistory,
  FaShoppingCart,
  FaSearch,
  FaUserEdit,
  FaMobileAlt,
} from "react-icons/fa";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  addDoc,
} from "firebase/firestore";
import Modal from "react-modal";
import { auth, db, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import "./AgentPortal.css";

Modal.setAppElement("#root");

const AGENT_USSD_CODE = "*920*177#";

const THETELLER_CONFIG = {
  merchantId: "TTM-00009769",
  currency: "GHS",
  paymentMethod: "both",
  redirectUrl: window.location.href,
  payButtonText: "Pay Securely with TheTeller",
  customDescription: "Payment for Data Bundle via Lord's Data (Agent)",
};

const STATIC_CUSTOMER_EMAIL = "customeremail@gmail.com";

const DISCOUNT_PERCENTAGE = 0.1; // 10% discount for agents

const publicProvidersData = {
  airtel: [
    { gb: 1, price: 5.0 },
    { gb: 2, price: 9.0 },
    { gb: 3, price: 14.0 },
    { gb: 4, price: 19.0 },
    { gb: 5, price: 25.0 },
    { gb: 6, price: 30.0 },
    { gb: 7, price: 35.0 },
    { gb: 8, price: 44.0 },
    { gb: 10, price: 50.0 },
    { gb: 12, price: 60.0 },
    { gb: 15, price: 58.0 },
    { gb: 20, price: 85.0 },
    { gb: 25, price: 100.0 },
    { gb: 30, price: 130.0 },
    { gb: 40, price: 180.0 },
    { gb: 50, price: 235.0 },
    { gb: 100, price: 450.0 },
  ],
  telecel: [
    { gb: 1, price: 5.0 },
    { gb: 2, price: 9.0 },
    { gb: 3, price: 14.0 },
    { gb: 4, price: 19.0 },
    { gb: 5, price: 25.0 },
    { gb: 6, price: 30.0 },
    { gb: 7, price: 35.0 },
    { gb: 8, price: 44.0 },
    { gb: 10, price: 50.0 },
    { gb: 12, price: 60.0 },
    { gb: 15, price: 58.0 },
    { gb: 20, price: 85.0 },
    { gb: 25, price: 100.0 },
    { gb: 30, price: 130.0 },
    { gb: 40, price: 180.0 },
    { gb: 50, price: 235.0 },
    { gb: 100, price: 450.0 },
  ],
  mtn: [
    { gb: 1, price: 6.0 },
    { gb: 2, price: 12.0 },
    { gb: 3, price: 16.5 },
    { gb: 4, price: 23.0 },
    { gb: 5, price: 28.0 },
    { gb: 6, price: 35.0 },
    { gb: 8, price: 43.0 },
    { gb: 10, price: 52.0 },
    { gb: 15, price: 75.0 },
    { gb: 20, price: 88.0 },
    { gb: 25, price: 115.0 },
    { gb: 30, price: 140.0 },
    { gb: 40, price: 180.0 },
    { gb: 50, price: 215.0 },
    { gb: 100, price: 410.0 },
  ],
};

// Calculate agent prices with discount
const agentProvidersData = Object.fromEntries(
  Object.entries(publicProvidersData).map(([provider, bundles]) => [
    provider,
    bundles.map((bundle) => ({
      gb: bundle.gb,
      price: bundle.price * (1 - DISCOUNT_PERCENTAGE),
    })),
  ])
);

const generateTransactionId = () => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0].toString().padStart(12, "0").slice(0, 12);
};

function AgentPortal() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("history");
  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [purchaseDetails, setPurchaseDetails] = useState(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [dataPhoneNumber, setDataPhoneNumber] = useState("");
  const [checkDataModalOpen, setCheckDataModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [agentFullName, setAgentFullName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentUsername, setAgentUsername] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const getSelectedBundle = useMemo(() => {
    const providerBundles = agentProvidersData[selectedProvider];
    return providerBundles.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchAgentTransactions(user.uid);
        fetchAgentProfile(user.uid);
      } else {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    setSelectedBundleSize(
      agentProvidersData[selectedProvider][0]?.gb.toString() || ""
    );
  }, [selectedProvider]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const code = urlParams.get("code");
    const transid = urlParams.get("transaction_id");
    const r_switch = urlParams.get("r_switch");
    const amount = urlParams.get("amount");
    const subscriber_number = urlParams.get("subscriber_number");

    if (!transid || !purchaseDetails) {
      if (transid) {
        console.warn("Missing purchaseDetails for transaction:", {
          transid,
          status,
          code,
        });
        alert("Purchase session expired. Please try the purchase again.");
        setPurchaseDetails(null);
        localStorage.removeItem("purchaseDetails");
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
      return;
    }

    if (purchaseDetails.transid !== transid) {
      console.warn("Transaction ID mismatch:", {
        urlTransId: transid,
        purchaseDetails,
        status,
        code,
        amount,
        subscriber_number,
        r_switch,
      });
      alert("Transaction ID mismatch. Please try the purchase again.");
      setPurchaseDetails(null);
      localStorage.removeItem("purchaseDetails");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const expectedSubscriberNumber = purchaseDetails.number.startsWith("0")
      ? `233${purchaseDetails.number.slice(1)}`
      : `233${purchaseDetails.number}`;
    if (subscriber_number && subscriber_number !== expectedSubscriberNumber) {
      console.warn("Subscriber number mismatch:", {
        expected: expectedSubscriberNumber,
        received: subscriber_number,
        transid,
        purchaseDetails,
      });
      alert(
        "Invalid phone number returned. Please try the purchase again or contact support at 0245687544."
      );
      setPurchaseDetails(null);
      localStorage.removeItem("purchaseDetails");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const storePurchase = async (isDeclined = false) => {
      try {
        await addDoc(collection(db, "teller_response"), {
          ...purchaseDetails,
          email: STATIC_CUSTOMER_EMAIL,
          purchasedAt: new Date(),
          userId: currentUser ? currentUser.uid : null,
          exported: false,
          subscriber_number: expectedSubscriberNumber,
          r_switch: r_switch || purchaseDetails.provider,
          amount: parseFloat(amount || purchaseDetails.price).toFixed(2),
          status: isDeclined ? status : "approved",
          code: code || (isDeclined ? "020" : "000"),
        });
        console.log(
          `Purchase ${
            isDeclined ? "declined" : "stored"
          } in Firestore with transaction ID:`,
          transid
        );
        if (!isDeclined) {
          setModalIsOpen(true);
        }
      } catch (error) {
        console.error("Error storing purchase:", error);
        alert(
          "Failed to store purchase. Please contact support at 0245687544."
        );
      } finally {
        setPurchaseDetails(null);
        localStorage.removeItem("purchaseDetails");
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    };

    if (status === "approved" && code === "000") {
      storePurchase(false);
    } else if (status && transid) {
      console.warn("Transaction declined or failed:", {
        urlTransId: transid,
        purchaseDetails,
        status,
        code,
        amount,
        subscriber_number,
        r_switch,
      });
      alert(
        `Payment declined (Code: ${code}). Please check your payment method and try again or contact support at 0245687544.`
      );
      storePurchase(true);
    }
  }, [purchaseDetails, currentUser]);

  const fetchAgentTransactions = async (userId) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "teller_response"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const transactionsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      alert("Failed to load transactions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentProfile = async (userId) => {
    try {
      const agentDoc = await getDoc(doc(db, "lord's-agents", userId));
      if (agentDoc.exists()) {
        const data = agentDoc.data();
        setAgentFullName(data.fullName);
        setAgentPhone(data.phone);
        setAgentUsername(data.username);
      } else {
        alert("Agent profile not found.");
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      alert("Failed to load profile. Please try again.");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!agentFullName || !agentPhone || !agentUsername) {
      setProfileError("Please fill all fields.");
      return;
    }

    if (agentPhone.length !== 10 || !/^\d{10}$/.test(agentPhone)) {
      setProfileError("Please enter a valid 10-digit phone number.");
      return;
    }

    try {
      const agentDocRef = doc(db, "lord's-agents", currentUser.uid);
      await updateDoc(agentDocRef, {
        fullName: agentFullName,
        phone: agentPhone,
        username: agentUsername,
      });
      setProfileSuccess("Profile updated successfully!");
      setProfileError("");
      setTimeout(() => {
        setProfileModalOpen(false);
        setProfileSuccess("");
      }, 2000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileError("Failed to update profile. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/");
      alert("Successfully signed out.");
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
  };

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (dataPhoneNumber.length !== 10 || !/^\d{10}$/.test(dataPhoneNumber)) {
      alert("Please enter a valid 10-digit phone number (e.g., 0549856098).");
      return;
    }

    let formattedPhoneNumber;
    if (dataPhoneNumber.startsWith("0")) {
      formattedPhoneNumber = `233${dataPhoneNumber.slice(1)}`;
    } else {
      formattedPhoneNumber = `233${dataPhoneNumber}`;
    }

    try {
      const q = query(
        collection(db, "teller_response"),
        where("subscriber_number", "==", formattedPhoneNumber)
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert(`No data bundle found for ${dataPhoneNumber}.`);
        closeCheckDataModal();
        return;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      if (data.exported === true) {
        alert(
          `Data bundle for ${dataPhoneNumber} has been processed!\nDescription: ${
            data.desc || "N/A"
          }\nProvider: ${data.r_switch || "N/A"}\nGB: ${
            data.desc?.match(/(\d+)GB/)?.[1] || "N/A"
          }`
        );
      } else {
        alert(
          `Data bundle for ${dataPhoneNumber} is pending processing.\nTransaction ID: ${
            data.transid || "N/A"
          }\nStatus: ${data.status || "Pending"}\nCreated: ${
            data.purchasedAt?.toDate?.()?.toLocaleString() || "N/A"
          }`
        );
      }
    } catch (error) {
      console.error("Error checking data status:", error);
      alert("Error checking data status. Please try again.");
    }

    closeCheckDataModal();
  };

  const handlePurchase = async (e) => {
    e.preventDefault();

    const finalBundle = getSelectedBundle;

    if (!finalBundle) {
      console.error("Invalid bundle selected");
      alert("Please select a valid bundle.");
      return;
    }

    if (recipientPhoneNumber.length !== 10) {
      console.error("Invalid phone number:", recipientPhoneNumber);
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    if (isPaymentLoading) {
      console.warn("Payment already in progress");
      return;
    }

    setIsPaymentLoading(true);
    const transactionId = generateTransactionId();
    const newPurchaseDetails = {
      provider: selectedProvider.toUpperCase(),
      gb: finalBundle.gb,
      price: finalBundle.price,
      number: recipientPhoneNumber,
      transid: transactionId,
    };
    setPurchaseDetails(newPurchaseDetails);

    try {
      const initiateThetellerPayment = httpsCallable(
        functions,
        "initiateThetellerPayment"
      );
      const amountInPesewas = (finalBundle.price * 100).toFixed(0);
      const result = await initiateThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: `${THETELLER_CONFIG.customDescription} - ${
          finalBundle.gb
        }GB ${selectedProvider.toUpperCase()}`,
        amount: amountInPesewas,
        redirect_url: THETELLER_CONFIG.redirectUrl,
        email: STATIC_CUSTOMER_EMAIL,
        subscriber_number: recipientPhoneNumber.startsWith("0")
          ? `233${recipientPhoneNumber.slice(1)}`
          : `233${recipientPhoneNumber}`,
      });
      const { checkout_url } = result.data;
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Error initiating purchase payment:", error);
      alert(`Payment initiation failed: ${error.message}`);
      setPurchaseDetails(null);
      localStorage.removeItem("purchaseDetails");
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setPurchaseDetails(null);
    localStorage.removeItem("purchaseDetails");
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setProfileError("");
    setProfileSuccess("");
  };

  return (
    <div className="agent-portal">
      <motion.header
        className="agent-header"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="title-with-icon">
          <FaUserShield className="agent-icon" />
          <h1>Agent Portal - Lord's Data</h1>
        </div>
        {currentUser && (
          <p className="welcome-message">Welcome, {currentUser.email}</p>
        )}
      </motion.header>

      <motion.nav
        className="agent-nav"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <button
          className={`nav-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <FaHistory /> Transaction History
        </button>
        <button
          className={`nav-button ${activeTab === "purchase" ? "active" : ""}`}
          onClick={() => setActiveTab("purchase")}
        >
          <FaShoppingCart /> Purchase Bundles
        </button>
        <button
          className={`nav-button ${activeTab === "check-data" ? "active" : ""}`}
          onClick={() => setCheckDataModalOpen(true)}
        >
          <FaSearch /> Check Data Status
        </button>
        <button
          className={`nav-button ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setProfileModalOpen(true)}
        >
          <FaUserEdit /> Edit Profile
        </button>
        <button className="nav-button" onClick={handleSignOut}>
          <FaSignOutAlt /> Sign Out
        </button>
      </motion.nav>

      <motion.section
        className="agent-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {activeTab === "history" && (
          <>
            <h2>Transaction History</h2>
            {loading ? (
              <p>Loading transactions...</p>
            ) : transactions.length > 0 ? (
              <div className="transaction-list">
                {transactions.map((transaction) => (
                  <motion.div
                    key={transaction.id}
                    className="transaction-card"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FaHistory className="transaction-icon" />
                    <div className="transaction-details">
                      <p>
                        <strong>Transaction ID:</strong> {transaction.transid}
                      </p>
                      <p>
                        <strong>Provider:</strong> {transaction.provider}
                      </p>
                      <p>
                        <strong>Bundle:</strong> {transaction.gb} GB
                      </p>
                      <p>
                        <strong>Amount:</strong> GHS {transaction.amount}
                      </p>
                      <p>
                        <strong>Phone:</strong> {transaction.subscriber_number}
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        {transaction.exported
                          ? "Processed"
                          : transaction.status || "Pending"}
                      </p>
                      <p>
                        <strong>Date:</strong>{" "}
                        {transaction.purchasedAt
                          ?.toDate?.()
                          ?.toLocaleString() || "N/A"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p>No transactions found.</p>
            )}
          </>
        )}

        {activeTab === "purchase" && (
          <>
            <h2>Purchase Bundles (Agent Discount Applied)</h2>
            <form onSubmit={handlePurchase} className="purchase-form">
              <div className="form-group">
                <label htmlFor="network">Network Provider:</label>
                <select
                  id="network"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  required
                >
                  {Object.keys(agentProvidersData).map((provider) => (
                    <option key={provider} value={provider}>
                      {provider.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="bundle">Select Bundle:</label>
                <select
                  id="bundle"
                  value={selectedBundleSize}
                  onChange={(e) => setSelectedBundleSize(e.target.value)}
                  required
                >
                  {agentProvidersData[selectedProvider]?.map(
                    (bundle, index) => (
                      <option key={index} value={bundle.gb}>
                        {bundle.gb} GB (GHS {bundle.price.toFixed(2)})
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="phone">Recipient Phone Number:</label>
                <input
                  id="phone"
                  type="tel"
                  value={recipientPhoneNumber}
                  onChange={(e) => setRecipientPhoneNumber(e.target.value)}
                  required
                  pattern="[0-9]{10}"
                  placeholder="Enter 10-digit number"
                />
              </div>
              <motion.button
                type="submit"
                className="submit-button"
                disabled={
                  !getSelectedBundle ||
                  recipientPhoneNumber.length !== 10 ||
                  isPaymentLoading
                }
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isPaymentLoading ? "Processing..." : "Proceed to Payment"}
              </motion.button>
            </form>
          </>
        )}

        {activeTab === "ussd" && (
          <motion.section
            className="agent-ussd-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="agent-ussd-content">
              <FaMobileAlt size={30} />
              <div>
                <h3>Buy via USSD (Agent Code)</h3>
                <p>
                  Dial this code to purchase bundles directly from Lord's Data:
                </p>
                <span className="ussd-code-display primary-code">
                  {AGENT_USSD_CODE}
                </span>
              </div>
            </div>
          </motion.section>
        )}
      </motion.section>

      <Modal
        isOpen={checkDataModalOpen}
        onRequestClose={closeCheckDataModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="modal-content"
        >
          <h2>
            <FaSearch /> Check Data Status
          </h2>
          <form onSubmit={handleCheckData} className="simple-form">
            <div className="form-group">
              <label htmlFor="data-phone">Phone Number:</label>
              <input
                id="data-phone"
                type="tel"
                value={dataPhoneNumber}
                onChange={(e) => setDataPhoneNumber(e.target.value)}
                required
                pattern="[0-9]{10}"
                placeholder="Enter 10-digit number"
              />
            </div>
            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Check Status
            </motion.button>
          </form>
          <motion.button
            onClick={closeCheckDataModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
        </motion.div>
      </Modal>

      <Modal
        isOpen={profileModalOpen}
        onRequestClose={closeProfileModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="modal-content"
        >
          <h2>
            <FaUserEdit /> Edit Profile
          </h2>
          {profileError && <p className="error-message">{profileError}</p>}
          {profileSuccess && (
            <p className="success-message">{profileSuccess}</p>
          )}
          <form onSubmit={handleUpdateProfile} className="simple-form">
            <div className="form-group">
              <label htmlFor="full-name">Full Name:</label>
              <input
                id="full-name"
                type="text"
                value={agentFullName}
                onChange={(e) => setAgentFullName(e.target.value)}
                required
                placeholder="Enter your full name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number:</label>
              <input
                id="phone"
                type="tel"
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                required
                pattern="[0-9]{10}"
                placeholder="Enter 10-digit number"
              />
            </div>
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                id="username"
                type="text"
                value={agentUsername}
                onChange={(e) => setAgentUsername(e.target.value)}
                required
                placeholder="Enter your username"
              />
            </div>
            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Update Profile
            </motion.button>
          </form>
          <motion.button
            onClick={closeProfileModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
        </motion.div>
      </Modal>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="success-message"
        >
          <h2>🎉 Purchase Successful! 🎉</h2>
          <p>
            You have successfully purchased a {purchaseDetails?.gb} GB bundle
            from {purchaseDetails?.provider} for GHS{" "}
            {purchaseDetails?.price.toFixed(2)}.
          </p>
          <p>The bundle has been credited to {purchaseDetails?.number}.</p>
          <motion.button
            onClick={closeModal}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="close-modal-button"
          >
            Close
          </motion.button>
        </motion.div>
      </Modal>
    </div>
  );
}

export default AgentPortal;
