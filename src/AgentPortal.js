import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaUserShield,
  FaSignOutAlt,
  FaHistory,
  FaShoppingCart,
  FaSearch,
  FaUserEdit,
  FaCheckCircle,
  FaSpinner,
  FaTimesCircle,
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

const THETELLER_CONFIG = {
  merchantId: "TTM-00009769",
};

const STATIC_CUSTOMER_EMAIL = "customeremail@gmail.com";

const PROVIDER_R_SWITCH_MAP = {
  mtn: "MTN",
  airtel: "ATL",
  telecel: "VDF",
};

const publicProvidersData = {
  airtel: [
    { gb: 1, price: 4.0 },
    { gb: 2, price: 9.0 },
    { gb: 3, price: 13.0 },
    { gb: 4, price: 18.0 },
    { gb: 5, price: 23.0 },
    { gb: 6, price: 27.0 },
    { gb: 7, price: 30.0 },
    { gb: 8, price: 35.0 },
    { gb: 10, price: 41.0 },
    { gb: 12, price: 47.0 },
    { gb: 15, price: 57.0 },
    { gb: 20, price: 72.0 },
    { gb: 25, price: 88.0 },
    { gb: 30, price: 102.0 },
    { gb: 40, price: 138.0 },
    { gb: 50, price: 172.0 },
    { gb: 100, price: 322.0 },
  ],
  telecel: [
    { gb: 5, price: 25.5 },
    { gb: 10, price: 43.5 },
    { gb: 15, price: 66.0 },
    { gb: 20, price: 83.0 },
    { gb: 25, price: 113.0 },
    { gb: 30, price: 131.0 },
    { gb: 40, price: 168.0 },
    { gb: 50, price: 220.0 },
  ],
  mtn: [
    { gb: 1, price: 5.0 },
    { gb: 2, price: 10.0 },
    { gb: 3, price: 15.5 },
    { gb: 4, price: 22.0 },
    { gb: 5, price: 26.5 },
    { gb: 6, price: 33.5 },
    { gb: 8, price: 41.5 },
    { gb: 10, price: 51.0 },
    { gb: 15, price: 74.0 },
    { gb: 20, price: 92.0 },
    { gb: 25, price: 113.0 },
    { gb: 30, price: 139.0 },
    { gb: 40, price: 178.0 },
    { gb: 50, price: 218.0 },
    { gb: 100, price: 428.0 },
  ],
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
  const [paymentStatus, setPaymentStatus] = useState("pending_pin");
  const [initiateThetellerPayment] = useState(
    httpsCallable(functions, "initiateThetellerPayment")
  );

  const checkPaymentStatus = useCallback(async () => {
    if (!purchaseDetails?.transid) return;

    try {
      const result = await initiateThetellerPayment({
        transaction_id: purchaseDetails.transid,
        isCallback: true,
      });

      if (result.data.final_status === "approved") {
        setPaymentStatus("approved");
        await storePurchase();
      } else if (result.data.final_status === "declined") {
        setPaymentStatus("declined");
      }
    } catch (error) {
      console.log("Status check in progress...");
    }
  }, [purchaseDetails, initiateThetellerPayment]);

  const getSelectedBundle = useMemo(() => {
    const providerBundles = publicProvidersData[selectedProvider];
    return providerBundles?.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  const getRSwitch = useMemo(
    () => PROVIDER_R_SWITCH_MAP[selectedProvider],
    [selectedProvider]
  );

  const generateTransactionId = useCallback(() => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0].toString().padStart(12, "0").slice(0, 12);
  }, []);

  const formatPhoneNumber = useCallback((phone) => {
    if (phone.startsWith("0") && phone.length === 10)
      return `233${phone.slice(1)}`;
    if (phone.startsWith("233") && phone.length === 13) return phone;
    return `233${phone}`;
  }, []);

  // Auth state
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

  // Reset bundle size when provider changes
  useEffect(() => {
    setSelectedBundleSize(
      publicProvidersData[selectedProvider][0]?.gb.toString() || "1"
    );
  }, [selectedProvider]);

  // Auto-poll payment status
  useEffect(() => {
    let interval;
    if (paymentStatus === "pending_pin" && purchaseDetails) {
      interval = setInterval(checkPaymentStatus, 5000);
    }
    return () => interval && clearInterval(interval);
  }, [paymentStatus, purchaseDetails, checkPaymentStatus]);

  // Store purchase in Firestore
  const storePurchase = async () => {
    try {
      await addDoc(collection(db, "teller_response"), {
        ...purchaseDetails,
        email: STATIC_CUSTOMER_EMAIL,
        purchasedAt: new Date(),
        userId: currentUser.uid,
        exported: false,
        subscriber_number: formatPhoneNumber(purchaseDetails.number),
        r_switch: getRSwitch,
        amount: purchaseDetails.price,
        status: "approved",
        code: "000",
        desc: `${purchaseDetails.gb}GB ${purchaseDetails.provider} Data Bundle`,
      });

      // Refresh transactions
      fetchAgentTransactions(currentUser.uid);
    } catch (error) {
      console.error("Error storing purchase:", error);
      alert("Failed to store purchase. Contact support.");
    }
  };

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
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentProfile = async (userId) => {
    try {
      const agentDoc = await getDoc(doc(db, "lords-agents", userId));
      if (agentDoc.exists()) {
        const data = agentDoc.data();
        setAgentFullName(data.fullName);
        setAgentPhone(data.phone);
        setAgentUsername(data.username);
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
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
      await updateDoc(doc(db, "lords-agents", currentUser.uid), {
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
      setProfileError("Failed to update profile.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // *** AGENT PURCHASE - NO REDIRECT ***
  const handlePurchase = async (e) => {
    e.preventDefault();

    if (!getSelectedBundle || recipientPhoneNumber.length !== 10) {
      alert("Please complete all fields.");
      return;
    }

    setIsPaymentLoading(true);
    const transactionId = generateTransactionId();
    const amountInPesewas = (getSelectedBundle.price * 100).toFixed(0);

    const newPurchaseDetails = {
      provider: selectedProvider.toUpperCase(),
      gb: getSelectedBundle.gb,
      price: getSelectedBundle.price,
      number: recipientPhoneNumber,
      transid: transactionId,
    };

    setPurchaseDetails(newPurchaseDetails);
    setPaymentStatus("pending_pin");
    setModalIsOpen(true);

    try {
      await initiateThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: `${
          getSelectedBundle.gb
        }GB ${selectedProvider.toUpperCase()} Data Bundle`,
        amount: amountInPesewas,
        subscriber_number: formatPhoneNumber(recipientPhoneNumber),
        r_switch: getRSwitch,
        email: STATIC_CUSTOMER_EMAIL,
        isAgentSignup: false,
      });

      alert(`📱 Check your phone ${recipientPhoneNumber} for PIN prompt!`);
    } catch (error) {
      alert(`Payment failed: ${error.message}`);
      setPurchaseDetails(null);
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setPurchaseDetails(null);
    setPaymentStatus("pending_pin");
    setRecipientPhoneNumber("");
    setSelectedProvider("airtel");
    setSelectedBundleSize("1");
  };

  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setProfileError("");
    setProfileSuccess("");
  };

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (dataPhoneNumber.length !== 10 || !/^\d{10}$/.test(dataPhoneNumber)) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    const formattedPhone = formatPhoneNumber(dataPhoneNumber);
    try {
      let q = query(
        collection(db, "teller_response"),
        where("subscriber_number", "==", formattedPhone)
      );
      let snapshot = await getDocs(q);

      if (snapshot.empty) {
        q = query(
          collection(db, "theteller-transactions"),
          where("subscriber_number", "==", formattedPhone)
        );
        snapshot = await getDocs(q);
      }

      if (snapshot.empty) {
        alert(`No data bundle found for ${dataPhoneNumber}`);
        closeCheckDataModal();
        return;
      }

      const data = snapshot.docs[0].data();
      let message = "";

      switch (data.status) {
        case "pending_pin":
          message = `⏳ Enter PIN on ${dataPhoneNumber} to complete payment!`;
          break;
        case "approved":
          message = data.exported
            ? `✅ Data ACTIVATED! ${data.desc}`
            : `✅ Payment approved! ⏳ Data processing...`;
          break;
        case "declined":
          message = `❌ Payment declined: ${data.reason || "Unknown reason"}`;
          break;
        default:
          message = `Status: ${data.status}`;
      }

      alert(message);
    } catch (error) {
      alert("Error checking status.");
    }
    closeCheckDataModal();
  };

  // JSX
  return (
    <div className="agent-portal">
      <motion.header
        className="agent-header"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="title-with-icon">
          <FaUserShield className="agent-icon" />
          <h1>Agent Portal - Lord's Data</h1>
        </div>
        {currentUser && (
          <p className="welcome-message">
            Welcome, {currentUser.email}
          </p>
        )}
      </motion.header>

      <motion.nav
        className="agent-nav"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
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
          className={`nav-button`}
          onClick={() => setCheckDataModalOpen(true)}
        >
          <FaSearch /> Check Data Status
        </button>
        <button
          className={`nav-button`}
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
                  >
                    <FaHistory className="transaction-icon" />
                    <div className="transaction-details">
                      <p>
                        <strong>ID:</strong> {transaction.transid}
                      </p>
                      <p>
                        <strong>Provider:</strong> {transaction.provider}
                      </p>
                      <p>
                        <strong>Bundle:</strong> {transaction.gb} GB
                      </p>
                      <p>
                        <strong>Amount:</strong> GHS{" "}
                        {transaction.amount?.toFixed(2)}
                      </p>
                      <p>
                        <strong>Phone:</strong> {transaction.subscriber_number}
                      </p>
                      <p>
                        <strong>Status:</strong>{" "}
                        {transaction.exported ? "✅ Processed" : "⏳ Pending"}
                      </p>
                      <p>
                        <strong>Date:</strong>{" "}
                        {transaction.purchasedAt?.toDate()?.toLocaleString()}
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
            <h2>Purchase Bundles</h2>
            <form onSubmit={handlePurchase} className="purchase-form">
              <div className="form-group">
                <label>Network:</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  {Object.keys(publicProvidersData).map((provider) => (
                    <option key={provider} value={provider}>
                      {provider.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Bundle:</label>
                <select
                  value={selectedBundleSize}
                  onChange={(e) => setSelectedBundleSize(e.target.value)}
                >
                  {publicProvidersData[selectedProvider]?.map((bundle) => (
                    <option key={bundle.gb} value={bundle.gb}>
                      {bundle.gb} GB (GHS {bundle.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Phone Number:</label>
                <input
                  type="tel"
                  value={recipientPhoneNumber}
                  onChange={(e) => setRecipientPhoneNumber(e.target.value)}
                  pattern="[0-9]{10}"
                  placeholder="0541234567"
                  required
                />
              </div>
              <motion.button
                type="submit"
                disabled={isPaymentLoading || !getSelectedBundle}
                className="submit-button"
                whileHover={{ scale: 1.05 }}
              >
                {isPaymentLoading
                  ? "Processing..."
                  : `Pay GHS ${getSelectedBundle?.price.toFixed(2)}`}
              </motion.button>
            </form>
          </>
        )}
      </motion.section>

      {/* PIN MODAL */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div
          className="pin-modal"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {paymentStatus === "pending_pin" ? (
            <>
              <h2>📱 Enter PIN to Complete Payment</h2>
              <p>
                <strong>Sent to:</strong> {purchaseDetails?.number}
              </p>
              <div className="pin-instructions">
                <ol>
                  <li>Check SMS on your phone</li>
                  <li>Enter your Mobile Money PIN</li>
                  <li>Approve payment</li>
                </ol>
              </div>
              <p>
                <strong>
                  {purchaseDetails?.gb}GB {purchaseDetails?.provider}
                </strong>
              </p>
              <motion.button
                onClick={checkPaymentStatus}
                className="check-btn"
                whileHover={{ scale: 1.05 }}
              >
                <FaSpinner className="spin" /> Checking...
              </motion.button>
              <p className="timer">Auto-checking every 5 seconds...</p>
              <motion.button
                onClick={closeModal}
                className="close-modal-button secondary"
                whileHover={{ scale: 1.05 }}
              >
                Cancel
              </motion.button>
            </>
          ) : paymentStatus === "approved" ? (
            <>
              <FaCheckCircle size={50} className="success-icon" />
              <h2>🎉 Purchase Successful!</h2>
              <p>
                {purchaseDetails?.gb}GB bundle purchased for GHS{" "}
                {purchaseDetails?.price.toFixed(2)}!
              </p>
              <p>Data will be credited to {purchaseDetails?.number} shortly.</p>
              <motion.button
                onClick={closeModal}
                className="close-modal-button"
                whileHover={{ scale: 1.05 }}
              >
                Close
              </motion.button>
            </>
          ) : (
            <>
              <FaTimesCircle size={50} className="error-icon" />
              <h2>❌ Payment Declined</h2>
              <p>Please try again.</p>
              <motion.button
                onClick={closeModal}
                className="close-modal-button"
                whileHover={{ scale: 1.05 }}
              >
                Close
              </motion.button>
            </>
          )}
        </motion.div>
      </Modal>

      {/* CHECK DATA MODAL */}
      <Modal
        isOpen={checkDataModalOpen}
        onRequestClose={closeCheckDataModal}
        className="modal"
        overlayClassName="overlay"
      >
        <div className="modal-content">
          <h2>
            <FaSearch /> Check Data Status
          </h2>
          <form onSubmit={handleCheckData}>
            <div className="form-group">
              <input
                type="tel"
                value={dataPhoneNumber}
                onChange={(e) => setDataPhoneNumber(e.target.value)}
                placeholder="0541234567"
                pattern="[0-9]{10}"
                required
              />
            </div>
            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
            >
              Check
            </motion.button>
          </form>
          <motion.button
            onClick={closeCheckDataModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
          >
            Cancel
          </motion.button>
        </div>
      </Modal>

      {/* PROFILE MODAL */}
      <Modal
        isOpen={profileModalOpen}
        onRequestClose={closeProfileModal}
        className="modal"
        overlayClassName="overlay"
      >
        <div className="modal-content">
          <h2>
            <FaUserEdit /> Edit Profile
          </h2>
          {profileError && <p className="error-message">{profileError}</p>}
          {profileSuccess && (
            <p className="success-message">{profileSuccess}</p>
          )}
          <form onSubmit={handleUpdateProfile} className="simple-form">
            <div className="form-group">
              <label>Full Name:</label>
              <input
                type="text"
                value={agentFullName}
                onChange={(e) => setAgentFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number:</label>
              <input
                type="tel"
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                pattern="[0-9]{10}"
                required
              />
            </div>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                value={agentUsername}
                onChange={(e) => setAgentUsername(e.target.value)}
                required
              />
            </div>
            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
            >
              Update Profile
            </motion.button>
          </form>
          <motion.button
            onClick={closeProfileModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
          >
            Cancel
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}

export default AgentPortal;