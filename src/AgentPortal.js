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
  FaLink,
} from "react-icons/fa";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import Modal from "react-modal";
import { auth, db, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import { v4 as uuidv4 } from "uuid";
import "./AgentPortal.css";

Modal.setAppElement("#root");

// ──────────────────────────────────────────────────────────────
// Provider data
// ──────────────────────────────────────────────────────────────
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
    { gb: 2, price: 11.0 },
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

// ──────────────────────────────────────────────────────────────
// Error Boundary
// ──────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

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

// ──────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────
function AgentPortal() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("history");

  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [momoPhoneNumber, setMomoPhoneNumber] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("mtn");

  const [purchaseDetails, setPurchaseDetails] = useState(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [referralLink, setReferralLink] = useState("");
  const [isReferralLoading, setIsReferralLoading] = useState(true);

  const [checkDataModalOpen, setCheckDataModalOpen] = useState(false);
  const [dataPhoneNumber, setDataPhoneNumber] = useState("");

  const statusCache = useRef(new Map());
  const pollIntervalRef = useRef(null);
  const autoStopRef = useRef(null);

  // ── Cloud Function ─────────────────────────────────────────
  const startMoolrePayment = useCallback(
    httpsCallable(functions, "startMoolrePayment"),
    []
  );

  // ── Helpers ────────────────────────────────────────────────
  const getSelectedBundle = useMemo(() => {
    const bundles = publicProvidersData[selectedProvider];
    return bundles
      ? bundles.find((b) => b.gb === Number(selectedBundleSize))
      : null;
  }, [selectedProvider, selectedBundleSize]);

  const formatPhoneNumber = useCallback((phone) => {
    if (phone.startsWith("0") && phone.length === 10)
      return `233${phone.slice(1)}`;
    if (phone.startsWith("233") && phone.length === 12) return phone;
    return `233${phone.replace(/\D/g, "")}`;
  }, []);

  const generateReferralLink = useCallback(() => {
    if (currentUser?.uid) {
      const link = `${window.location.origin}/customer-purchase/${currentUser.uid}`;
      setReferralLink(link);
      setIsReferralLoading(false);
    } else {
      setIsReferralLoading(true);
    }
  }, [currentUser]);

  const copyReferralLink = useCallback(async () => {
    if (!referralLink) {
      setErrorMessage("Referral link not ready.");
      return;
    }
    try {
      await navigator.clipboard.writeText(referralLink);
      setErrorMessage("Referral link copied!");
    } catch {
      setErrorMessage("Failed to copy. Copy manually.");
    }
  }, [referralLink]);

  // ── Effects ────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchAgentTransactions(user.uid);
        generateReferralLink();
      } else {
        navigate("/");
      }
    });
    return unsub;
  }, [navigate, generateReferralLink]);

  useEffect(() => {
    const firstBundle = publicProvidersData[selectedProvider]?.[0];
    setSelectedBundleSize(firstBundle ? firstBundle.gb.toString() : "1");
  }, [selectedProvider]);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(""), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // ── Fetch Transactions ─────────────────────────────────────
  const fetchAgentTransactions = async (uid) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "webite_purchase"),
        where("userId", "==", uid)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTransactions(data);
    } catch (e) {
      setErrorMessage("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  // ── Poll Moolre Status ─────────────────────────────────────
  const pollMoolreStatus = useCallback(
    (externalRef) => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);

      const docRef = doc(db, "moolre_transactions", externalRef);

      pollIntervalRef.current = setInterval(async () => {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const final = data.final_status;

        if (final === "success" || final === "failed") {
          clearInterval(pollIntervalRef.current);
          if (autoStopRef.current) clearTimeout(autoStopRef.current);
          setPaymentStatus(final);
          setCountdown(null);

          if (final === "success") {
            setErrorMessage("Payment successful – data is being processed!");
            fetchAgentTransactions(currentUser.uid);
          } else {
            setErrorMessage("Payment failed");
          }
        }
      }, 3000);

      autoStopRef.current = setTimeout(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setCountdown(null);
        setErrorMessage("Status check timed out. Try again later.");
      }, 120000);
    },
    [currentUser]
  );

  // ── Handle Purchase ────────────────────────────────────────
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

    const externalRef = uuidv4();
    const amount = getSelectedBundle.price.toFixed(2);

    const newPurchase = {
      provider: selectedProvider.toUpperCase(),
      gb: getSelectedBundle.gb,
      price: getSelectedBundle.price,
      recipientNumber: formatPhoneNumber(recipientPhoneNumber),
      momoNumber: formatPhoneNumber(momoPhoneNumber),
      paymentProvider: paymentProvider.toUpperCase(),
      externalRef,
      userid: currentUser.uid,
    };

    setPurchaseDetails(newPurchase);
    setPaymentStatus(null);
    setCountdown(35);
    setModalIsOpen(true);

    try {
      const res = await startMoolrePayment({
        amount,
        email: currentUser?.email || "customer@email.com",
        desc: `${
          getSelectedBundle.gb
        }GB ${selectedProvider.toUpperCase()} Data Bundle`,
        externalref: externalRef,
        metadata: {
          type: "data_bundle",
          provider: selectedProvider,
          gb: getSelectedBundle.gb,
          recipient_number: formatPhoneNumber(recipientPhoneNumber),
          payee_number: formatPhoneNumber(momoPhoneNumber),
          service_id: `D${getSelectedBundle.gb}`,
          
        },
      });

      const { status, authorization_url } = res.data;
      if (status !== "link_generated") throw new Error("Link not generated");

      const win = window.open(authorization_url, "_blank");
      if (!win) {
        setErrorMessage("Pop-up blocked – allow pop-ups and retry.");
        return;
      }

      setErrorMessage(
        `Redirected to Moolre. Complete payment on ${momoPhoneNumber}.`
      );
      pollMoolreStatus(externalRef);
    } catch (err) {
      setErrorMessage(`Moolre error: ${err.message}`);
      setPurchaseDetails(null);
      setCountdown(null);
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // ── Modal Cleanup ──────────────────────────────────────────
  const closeModal = () => {
    setModalIsOpen(false);
    setPurchaseDetails(null);
    setPaymentStatus(null);
    setRecipientPhoneNumber("");
    setMomoPhoneNumber("");
    setPaymentProvider("mtn");
    setSelectedProvider("airtel");
    setSelectedBundleSize("1");
    setErrorMessage("");
    setCountdown(null);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
  };

  // ── Check Data Status ──────────────────────────────────────
  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
    setErrorMessage("");
  };

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(dataPhoneNumber)) {
      setErrorMessage("Enter a valid 10-digit phone number.");
      return;
    }
    const formatted = formatPhoneNumber(dataPhoneNumber);
    try {
      const collections = ["webite_purchase", "moolre_transactions"];
      for (const col of collections) {
        const q = query(
          collection(db, col),
          where("recipientNumber", "==", formatted)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          let msg = "";
          if (data.status === "approved" || data.final_status === "success")
            msg = `Data ACTIVATED! ${data.serviceName || data.gb}GB`;
          else if (data.final_status === "failed") msg = `Payment failed`;
          else msg = `Status: ${data.status || data.final_status || "pending"}`;
          alert(msg);
          return;
        }
      }
      setErrorMessage(`No bundle found for ${dataPhoneNumber}`);
    } catch {
      setErrorMessage("Check failed.");
    }
  };

  // ── Sign Out ───────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  // ──────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="agent-portal">
        {/* Global Error */}
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

        {/* Header */}
        <motion.header
          className="agent-header"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="title-with-icon">
            <FaUserShield className="agent-icon" />
            <h1>Agent Portal - Ricky's Data</h1>
          </div>
          {currentUser && (
            <p className="welcome-message">Welcome, {currentUser.email}</p>
          )}
        </motion.header>

        {/* Navigation */}
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
            className={`nav-button ${activeTab === "referral" ? "active" : ""}`}
            onClick={() => setActiveTab("referral")}
          >
            <FaLink /> Referral Link
          </button>
          <button
            className="nav-button"
            onClick={() => setCheckDataModalOpen(true)}
          >
            <FaSearch /> Check Data Status
          </button>
          <button
            className="nav-button"
            onClick={() => navigate("/edit-profile")}
          >
            <FaUserEdit /> Edit Profile/Prices
          </button>
          <button className="nav-button" onClick={handleSignOut}>
            <FaSignOutAlt /> Sign Out
          </button>
        </motion.nav>

        {/* Content */}
        <motion.section
          className="agent-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* History */}
          {activeTab === "history" && (
            <>
              <h2>Transaction History</h2>
              {loading ? (
                <div className="loading-spinner">
                  <FaSpinner className="spin" /> Loading...
                </div>
              ) : transactions.length > 0 ? (
                <div className="transaction-list">
                  {transactions.map((t) => (
                    <motion.div
                      key={t.externalRef || t.id}
                      className="transaction-card"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <FaHistory className="transaction-icon" />
                      <div className="transaction-details">
                        <p>
                          <strong>ID:</strong> {t.externalRef || "N/A"}
                        </p>
                        <p>
                          <strong>Provider:</strong> {t.provider || "N/A"}
                        </p>
                        <p>
                          <strong>Bundle:</strong>{" "}
                          {t.serviceName || `${t.gb}GB`}
                        </p>
                        <p>
                          <strong>Amount:</strong> GHS{" "}
                          {t.amount?.toFixed(2) || "N/A"}
                        </p>
                        <p>
                          <strong>Recipient:</strong>{" "}
                          {t.recipientNumber || "N/A"}
                        </p>
                        <p>
                          <strong>MoMo:</strong> {t.phoneNumber || "N/A"}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {t.status === "approved" ? "Processed" : "Pending"}
                        </p>
                        <p>
                          <strong>Date:</strong>{" "}
                          {t.createdAt?.toDate?.()?.toLocaleString() || "N/A"}
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

          {/* Purchase */}
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
                    {Object.keys(publicProvidersData).map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
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
                    {publicProvidersData[selectedProvider]?.map((b) => (
                      <option key={b.gb} value={b.gb}>
                        {b.gb} GB (GHS {b.price.toFixed(2)})
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
                  />
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
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payment-network">Payment Network:</label>
                  <select
                    id="payment-network"
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value)}
                    required
                  >
                    {Object.keys(PROVIDER_R_SWITCH_MAP).map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <motion.button
                  type="submit"
                  disabled={isPaymentLoading || !getSelectedBundle}
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPaymentLoading ? (
                    <>
                      {" "}
                      <FaSpinner className="spin" /> Processing...
                    </>
                  ) : (
                    `Pay GHS ${getSelectedBundle?.price.toFixed(2)}`
                  )}
                </motion.button>
              </form>
            </>
          )}

          {/* Referral */}
          {activeTab === "referral" && (
            <>
              <h2>Referral Link</h2>
              <div className="referral-section">
                <p>Share this link with customers:</p>
                <div className="referral-link-container">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="referral-link-input"
                  />
                  <motion.button
                    onClick={copyReferralLink}
                    className="copy-button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaLink /> Copy
                  </motion.button>
                </div>
                <p className="referral-info">
                  Transactions from this link appear in your history.
                </p>
              </div>
            </>
          )}
        </motion.section>

        {/* Moolre Modal */}
        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          className="modal"
          overlayClassName="overlay"
          aria-labelledby="moolre-modal-title"
        >
          <motion.div
            className="pin-modal"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {paymentStatus === "success" && (
              <>
                <FaCheckCircle size={50} className="success-icon" />
                <h2 id="moolre-modal-title">Purchase Successful!</h2>
                <p>
                  {purchaseDetails?.gb}GB bundle purchased for GHS{" "}
                  {purchaseDetails?.price.toFixed(2)}
                </p>
                <p>
                  Data will be credited to {purchaseDetails?.recipientNumber}{" "}
                  shortly.
                </p>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </>
            )}

            {paymentStatus === "failed" && (
              <>
                <FaTimesCircle size={50} className="error-icon" />
                <h2 id="moolre-modal-title">Payment Failed</h2>
                <p>Please try again or contact support.</p>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </>
            )}

            {(!paymentStatus || paymentStatus === null) && (
              <>
                <h2 id="moolre-modal-title">Processing Payment</h2>
                <p>
                  <strong>Recipient:</strong> {purchaseDetails?.recipientNumber}
                </p>
                <p>
                  <strong>MoMo:</strong> {purchaseDetails?.momoNumber}
                </p>
                <div className="pin-instructions">
                  <ol>
                    <li>Complete payment in the opened Moolre page</li>
                    <li>Wait for confirmation</li>
                  </ol>
                </div>
                <p className="timer">
                  {countdown !== null
                    ? `Checking in ${countdown}s…`
                    : "Checking…"}
                </p>
                <motion.button
                  onClick={closeModal}
                  className="close-modal-button secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
              </>
            )}
          </motion.div>
        </Modal>

        {/* Check Data Modal */}
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
                />
              </div>
              <motion.button
                type="submit"
                className="submit-button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Check
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
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

export default AgentPortal;
