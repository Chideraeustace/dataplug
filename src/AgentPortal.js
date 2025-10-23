import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
    { gb: 10, price: 45.0 },
    { gb: 15, price: 74.0 },
    { gb: 20, price: 92.0 },
    { gb: 25, price: 113.0 },
    { gb: 30, price: 139.0 },
    { gb: 40, price: 178.0 },
    { gb: 50, price: 207.0 },
    { gb: 100, price: 428.0 },
  ],
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <p className="global-error">Something went wrong. Please try again.</p>
      );
    }
    return this.props.children;
  }
}

function AgentPortal() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("history");
  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [momoPhoneNumber, setMomoPhoneNumber] = useState(""); // Added for MoMo number
  const [paymentProvider, setPaymentProvider] = useState("mtn"); // Added for payment network
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
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(null);
  const statusCache = useRef(new Map());
  const timeoutRef = useRef(null);
  const startThetellerPayment = useCallback(
    httpsCallable(functions, "startThetellerPayment"),
    []
  );

  const getSelectedBundle = useMemo(() => {
    const providerBundles = publicProvidersData[selectedProvider];
    return providerBundles?.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  const getRSwitch = useMemo(
    () => PROVIDER_R_SWITCH_MAP[paymentProvider],
    [paymentProvider]
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

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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

  // Error message timeout
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const checkPaymentStatus = useCallback(async () => {
    if (!purchaseDetails?.transid) {
      setErrorMessage("No transaction ID available.");
      closeModal();
      return;
    }

    if (statusCache.current.has(purchaseDetails.transid)) {
      const cachedStatus = statusCache.current.get(purchaseDetails.transid);
      console.log(
        `Using cached status for ${purchaseDetails.transid}:`,
        cachedStatus
      );
      setPaymentStatus(cachedStatus.final_status);
      return;
    }

    try {
      console.log(`Checking status for transaction ${purchaseDetails.transid}`);
      const result = await startThetellerPayment({
        transaction_id: purchaseDetails.transid,
        isCallback: true,
      });

      const { final_status, code, reason } = result.data;
      console.log(`Received status for ${purchaseDetails.transid}:`, {
        final_status,
        code,
        reason,
      });

      statusCache.current.set(purchaseDetails.transid, {
        final_status,
        code,
        reason,
      });
      setPaymentStatus(final_status);

      if (final_status === "declined") {
        setErrorMessage(`Payment declined: ${reason || "Unknown reason"}`);
      }
    } catch (error) {
      console.error(
        `Status check error for ${purchaseDetails.transid}:`,
        error
      );
      setErrorMessage(`Failed to check payment status: ${error.message}`);
    }
  }, [purchaseDetails, startThetellerPayment]);

  const fetchAgentTransactions = async (userId) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "data_approve_teller_transaction"),
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
      setErrorMessage("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentProfile = async (userId) => {
    try {
      const agentDoc = await getDoc(doc(db, "dataplug-agents", userId));
      if (agentDoc.exists()) {
        const data = agentDoc.data();
        setAgentFullName(data.fullName);
        setAgentPhone(data.phone);
        setAgentUsername(data.username);
      }
    } catch (error) {
      console.error("Error fetching agent profile:", error);
      setErrorMessage("Failed to load profile.");
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
      await updateDoc(doc(db, "dataplug-agents", currentUser.uid), {
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
      setErrorMessage("Failed to sign out.");
    }
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (
      !getSelectedBundle ||
      !/^\d{10}$/.test(recipientPhoneNumber) ||
      !/^\d{10}$/.test(momoPhoneNumber) ||
      !paymentProvider
    ) {
      setErrorMessage(
        "Please enter valid 10-digit phone numbers and select a bundle and payment network."
      );
      return;
    }

    setIsPaymentLoading(true);
    setErrorMessage("");
    statusCache.current.clear();
    const transactionId = generateTransactionId();
    const amountInPesewas = (getSelectedBundle.price * 100).toFixed(0);

    const newPurchaseDetails = {
      provider: selectedProvider.toUpperCase(),
      gb: getSelectedBundle.gb,
      price: getSelectedBundle.price,
      recipientNumber: recipientPhoneNumber, // Updated to distinguish from MoMo number
      momoNumber: momoPhoneNumber, // Added for MoMo number
      paymentProvider: paymentProvider.toUpperCase(), // Added for payment network
      transid: transactionId,
    };

    setPurchaseDetails(newPurchaseDetails);
    setPaymentStatus(null);
    setCountdown(35);
    setModalIsOpen(true);

    try {
      console.log("Initiating payment:", {
        transactionId,
        recipientPhoneNumber,
        momoPhoneNumber,
        paymentProvider,
      });
      const response = await startThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: `${
          getSelectedBundle.gb
        }GB ${selectedProvider.toUpperCase()} Data Bundle`,
        amount: amountInPesewas,
        subscriber_number: formatPhoneNumber(momoPhoneNumber), // Use MoMo number
        recipient_number: formatPhoneNumber(recipientPhoneNumber), // Use recipient number
        r_switch: getRSwitch, // Use payment network
        email: STATIC_CUSTOMER_EMAIL,
        isAgentSignup: false,
      });

      setPaymentStatus(response.data.status);
      setErrorMessage(
        `📱 Transaction initiated for ${momoPhoneNumber} (payment) and ${recipientPhoneNumber} (data recipient)!`
      );

      timeoutRef.current = setTimeout(() => {
        checkPaymentStatus();
        fetchAgentTransactions(currentUser.uid); // Refresh transactions after check
      }, 35000);
    } catch (error) {
      console.error("Payment initiation error:", error);
      setErrorMessage(
        `Payment failed: ${error.message}`
      );
      setPurchaseDetails(null);
      setCountdown(null);
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setPurchaseDetails(null);
    setPaymentStatus(null);
    setRecipientPhoneNumber("");
    setMomoPhoneNumber(""); // Reset MoMo number
    setPaymentProvider("mtn"); // Reset payment network
    setSelectedProvider("airtel");
    setSelectedBundleSize("1");
    setErrorMessage("");
    setCountdown(null);
    statusCache.current.clear();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
    setErrorMessage("");
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setProfileError("");
    setProfileSuccess("");
    setErrorMessage("");
  };

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(dataPhoneNumber)) {
      setErrorMessage("Please enter a valid 10-digit phone number.");
      return;
    }

    const formattedPhone = formatPhoneNumber(dataPhoneNumber);
    try {
      let q = query(
        collection(db, "data_approve_teller_transaction"),
        where("recipient_number", "==", formattedPhone) // Updated to check recipient_number
      );
      let snapshot = await getDocs(q);

      if (snapshot.empty) {
        q = query(
          collection(db, "theteller-transactions"),
          where("recipient_number", "==", formattedPhone) // Updated to check recipient_number
        );
        snapshot = await getDocs(q);
      }

      if (snapshot.empty) {
        setErrorMessage(`No data bundle found for ${dataPhoneNumber}`);
        return;
      }

      const data = snapshot.docs[0].data();
      let message = "";

      switch (data.status) {
        case "pending_pin":
          message = `⏳ Enter PIN on ${data.subscriber_number} to complete payment!`;
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
      setErrorMessage("Error checking status.");
    }
  };

  // JSX
  return (
    <ErrorBoundary>
      <div className="agent-portal">
        {errorMessage && (
          <motion.div
            className="global-error"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {errorMessage}
          </motion.div>
        )}
        <motion.header
          className="agent-header"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="title-with-icon">
            <FaUserShield className="agent-icon" aria-hidden="true" />
            <h1>Agent Portal - Data Plug</h1>
          </div>
          {currentUser && (
            <p className="welcome-message">
              Welcome, {agentFullName || currentUser.email}
            </p>
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
            aria-label="View Transaction History"
          >
            <FaHistory /> Transaction History
          </button>
          <button
            className={`nav-button ${activeTab === "purchase" ? "active" : ""}`}
            onClick={() => setActiveTab("purchase")}
            aria-label="Purchase Data Bundles"
          >
            <FaShoppingCart /> Purchase Bundles
          </button>
          <button
            className="nav-button"
            onClick={() => setCheckDataModalOpen(true)}
            aria-label="Check Data Status"
          >
            <FaSearch /> Check Data Status
          </button>
          <button
            className="nav-button"
            onClick={() => setProfileModalOpen(true)}
            aria-label="Edit Profile"
          >
            <FaUserEdit /> Edit Profile
          </button>
          <button
            className="nav-button"
            onClick={handleSignOut}
            aria-label="Sign Out"
          >
            <FaSignOutAlt /> Sign Out
          </button>
        </motion.nav>

        <motion.section
          className="agent-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {activeTab === "history" && (
            <>
              <h2>Transaction History</h2>
              {loading ? (
                <div className="loading-spinner">
                  <FaSpinner className="spin" /> Loading transactions...
                </div>
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
                      <FaHistory
                        className="transaction-icon"
                        aria-hidden="true"
                      />
                      <div className="transaction-details">
                        <p>
                          <strong>ID:</strong>{" "}
                          {transaction.transaction_id || "N/A"}
                        </p>
                        <p>
                          <strong>Provider:</strong>{" "}
                          {transaction.provider || "N/A"}
                        </p>
                        <p>
                          <strong>Bundle:</strong> {transaction.gb || "N/A"} GB
                        </p>
                        <p>
                          <strong>Amount:</strong> GHS{" "}
                          {transaction.amount?.toFixed(2) || "N/A"}
                        </p>
                        <p>
                          <strong>Data Recipient:</strong>{" "}
                          {transaction.recipient_number || "N/A"}
                        </p>
                        <p>
                          <strong>MoMo Number:</strong>{" "}
                          {transaction.subscriber_number || "N/A"}
                        </p>
                        <p>
                          <strong>Payment Network:</strong>{" "}
                          {transaction.r_switch || "N/A"}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {transaction.exported ? "✅ Processed" : "⏳ Pending"}
                        </p>
                        <p>
                          <strong>Date:</strong>{" "}
                          {transaction.purchasedAt
                            ?.toDate()
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
              <h2>Purchase Bundles</h2>
              <form onSubmit={handlePurchase} className="purchase-form">
                <div className="form-group">
                  <label htmlFor="network">Data Network:</label>
                  <select
                    id="network"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    required
                  >
                    {Object.keys(publicProvidersData).map((provider) => (
                      <option key={provider} value={provider}>
                        {provider.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="bundle">Bundle:</label>
                  <select
                    id="bundle"
                    value={selectedBundleSize}
                    onChange={(e) => setSelectedBundleSize(e.target.value)}
                    required
                  >
                    {publicProvidersData[selectedProvider]?.map((bundle) => (
                      <option key={bundle.gb} value={bundle.gb}>
                        {bundle.gb} GB (GHS {bundle.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="recipient-phone-number">
                    Recipient Phone Number:
                  </label>
                  <input
                    id="recipient-phone-number"
                    type="tel"
                    value={recipientPhoneNumber}
                    onChange={(e) => setRecipientPhoneNumber(e.target.value)}
                    pattern="[0-9]{10}"
                    placeholder="0541234567"
                    required
                    aria-describedby="recipient-phone-error"
                  />
                  {recipientPhoneNumber &&
                    !/^\d{10}$/.test(recipientPhoneNumber) && (
                      <span className="form-error" id="recipient-phone-error">
                        Please enter a valid 10-digit phone number.
                      </span>
                    )}
                </div>
                <div className="form-group">
                  <label htmlFor="momo-phone-number">MoMo Phone Number:</label>
                  <input
                    id="momo-phone-number"
                    type="tel"
                    value={momoPhoneNumber}
                    onChange={(e) => setMomoPhoneNumber(e.target.value)}
                    pattern="[0-9]{10}"
                    placeholder="0541234567"
                    required
                    aria-describedby="momo-phone-error"
                  />
                  {momoPhoneNumber && !/^\d{10}$/.test(momoPhoneNumber) && (
                    <span className="form-error" id="momo-phone-error">
                      Please enter a valid 10-digit MoMo phone number.
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="payment-network">Payment Network:</label>
                  <select
                    id="payment-network"
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value)}
                    required
                  >
                    {Object.keys(PROVIDER_R_SWITCH_MAP).map((provider) => (
                      <option key={provider} value={provider}>
                        {provider.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <motion.button
                  type="submit"
                  disabled={
                    isPaymentLoading ||
                    !getSelectedBundle ||
                    !recipientPhoneNumber ||
                    !momoPhoneNumber ||
                    !paymentProvider
                  }
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={`Purchase ${
                    getSelectedBundle?.gb
                  }GB bundle for GHS ${getSelectedBundle?.price.toFixed(2)}`}
                >
                  {isPaymentLoading ? (
                    <>
                      <FaSpinner className="spin" /> Processing...
                    </>
                  ) : (
                    `Pay GHS ${getSelectedBundle?.price.toFixed(2)}`
                  )}
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
          aria-labelledby="pin-modal-title"
        >
          <motion.div
            className="pin-modal"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {paymentStatus === "approved" ? (
              <>
                <FaCheckCircle
                  size={50}
                  className="success-icon"
                  aria-hidden="true"
                />
                <h2 id="pin-modal-title">🎉 Purchase Successful!</h2>
                <p>
                  {purchaseDetails?.gb}GB bundle purchased for GHS{" "}
                  {purchaseDetails?.price.toFixed(2)}!
                </p>
                <p>
                  Data will be credited to {purchaseDetails?.recipientNumber}{" "}
                  shortly.
                </p>
                <p>
                  Payment made from {purchaseDetails?.momoNumber} (
                  {purchaseDetails?.paymentProvider}).
                </p>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close success modal"
                >
                  Close
                </motion.button>
              </>
            ) : paymentStatus === "declined" ? (
              <>
                <FaTimesCircle
                  size={50}
                  className="error-icon"
                  aria-hidden="true"
                />
                <h2 id="pin-modal-title">❌ Payment Declined</h2>
                <p>Please try again or contact support.</p>
                <p>
                  Attempted payment from {purchaseDetails?.momoNumber} (
                  {purchaseDetails?.paymentProvider}).
                </p>
                <p>Data recipient: {purchaseDetails?.recipientNumber}.</p>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close error modal"
                >
                  Close
                </motion.button>
              </>
            ) : (
              <>
                <h2 id="pin-modal-title">📱 Processing Payment</h2>
                <p>
                  <strong>Data Recipient:</strong>{" "}
                  {purchaseDetails?.recipientNumber}
                </p>
                <p>
                  <strong>Payment Number:</strong> {purchaseDetails?.momoNumber}{" "}
                  ({purchaseDetails?.paymentProvider})
                </p>
                <div className="pin-instructions">
                  <ol>
                    <li>Check SMS on {purchaseDetails?.momoNumber}</li>
                    <li>Enter your Mobile Money PIN</li>
                    <li>Approve payment</li>
                  </ol>
                </div>
                <p>
                  <strong>
                    {purchaseDetails?.gb}GB {purchaseDetails?.provider}
                  </strong>
                </p>
                <p className="timer">
                  {countdown !== null
                    ? `Checking in ${countdown}s...`
                    : "Checking status..."}
                </p>
                <motion.button
                  onClick={checkPaymentStatus}
                  className="check-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Check payment status"
                  disabled={countdown !== null || paymentStatus}
                >
                  <FaSpinner className="spin" /> Check Now
                </motion.button>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Cancel payment"
                >
                  Cancel
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
          aria-labelledby="check-data-modal-title"
        >
          <div className="modal-content">
            <h2 id="check-data-modal-title">
              <FaSearch /> Check Data Status
            </h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <form onSubmit={handleCheckData}>
              <div className="form-group">
                <label htmlFor="check-phone-number">
                  Recipient Phone Number:
                </label>
                <input
                  id="check-phone-number"
                  type="tel"
                  value={dataPhoneNumber}
                  onChange={(e) => setDataPhoneNumber(e.target.value)}
                  placeholder="0541234567"
                  pattern="[0-9]{10}"
                  required
                  aria-describedby="check-phone-error"
                />
                {dataPhoneNumber && !/^\d{10}$/.test(dataPhoneNumber) && (
                  <span className="form-error" id="check-phone-error">
                    Please enter a valid 10-digit phone number.
                  </span>
                )}
              </div>
              <motion.button
                type="submit"
                className="submit-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Check data status"
              >
                Check
              </motion.button>
            </form>
            <motion.button
              onClick={closeCheckDataModal}
              className="close-modal-button secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Cancel check data"
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
          aria-labelledby="profile-modal-title"
        >
          <div className="modal-content">
            <h2 id="profile-modal-title">
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
                  aria-describedby="full-name-error"
                />
                {!agentFullName && (
                  <span className="form-error" id="full-name-error">
                    Full name is required.
                  </span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="profile-phone">Phone Number:</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  pattern="[0-9]{10}"
                  required
                  aria-describedby="profile-phone-error"
                />
                {agentPhone && !/^\d{10}$/.test(agentPhone) && (
                  <span className="form-error" id="profile-phone-error">
                    Please enter a valid 10-digit phone number.
                  </span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  id="username"
                  type="text"
                  value={agentUsername}
                  onChange={(e) => setAgentUsername(e.target.value)}
                  required
                  aria-describedby="username-error"
                />
                {!agentUsername && (
                  <span className="form-error" id="username-error">
                    Username is required.
                  </span>
                )}
              </div>
              <motion.button
                type="submit"
                className="submit-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Update profile"
              >
                Update Profile
              </motion.button>
            </form>
            <motion.button
              onClick={closeProfileModal}
              className="close-modal-button secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Cancel profile edit"
            >
              Cancel
            </motion.button>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

export default AgentPortal;
