import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Modal from "react-modal";
import {
  FaWhatsapp,
  FaWifi,
  FaSearch,
  FaUserShield,
  FaSpinner,
} from "react-icons/fa";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import mtn from "./download.png";
import airtel from "./airtel.png";
import telecel from "./telecel.png";

Modal.setAppElement("#root");

// === CONFIG ===
const STATIC_CUSTOMER_EMAIL = "customeremail@gmail.com";

const providersData = {
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
    { gb: 2, price: 11.5 },
    { gb: 3, price: 16.5 },
    { gb: 4, price: 21.0 },
    { gb: 5, price: 26.5 },
    { gb: 6, price: 31.0 },
    { gb: 8, price: 42.0 },
    { gb: 10, price: 48.0 },
    { gb: 15, price: 70.0 },
    { gb: 20, price: 88.0 },
    { gb: 25, price: 112.0 },
    { gb: 30, price: 132.0 },
    { gb: 40, price: 172.0 },
    { gb: 50, price: 217.0 },
  ],
};

function App() {
  const navigate = useNavigate();

  // === STATE ===
  const [selectedProvider, setSelectedProvider] = useState("mtn");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [checkDataModalOpen, setCheckDataModalOpen] = useState(false);
  const [agentPortalModalOpen, setAgentPortalModalOpen] = useState(false);
  const [dataPhoneNumber, setDataPhoneNumber] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [agentFullName, setAgentFullName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentMomoNumber, setAgentMomoNumber] = useState("");
  const [agentSignUpEmail, setAgentSignUpEmail] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [signupError, setSignupError] = useState("");
  const [statusMessage, setStatusMessage] = useState(""); // ← NEW: Homepage status
  const [isAgentSignup, setIsAgentSignup] = useState(false);

  // === FIREBASE CALLABLE ===
  const startMoolrePayment = useCallback(
    httpsCallable(functions, "startMoolrePayment"),
    []
  );

  // === HELPERS ===
  const formatPhoneNumber = useCallback((phone) => {
    let formatted = phone;
    if (phone.startsWith("0") && phone.length === 10) {
      formatted = `233${phone.slice(1)}`;
    } else if (phone.startsWith("233") && phone.length === 12) {
      formatted = phone;
    } else {
      formatted = `233${phone}`;
    }
    return formatted;
  }, []);

  const closeModal = () => {
    setModalIsOpen(false);
    setIsAgentSignup(false);
  };

  const getSelectedBundle = useMemo(() => {
    return providersData[selectedProvider]?.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  // === DATA PURCHASE ===
  const handlePurchase = async (e) => {
    e.preventDefault();

    if (!getSelectedBundle || !/^\d{10}$/.test(recipientPhoneNumber)) {
      setStatusMessage("Please enter a valid 10-digit recipient phone number.");
      return;
    }

    setIsPaymentLoading(true);
    setIsAgentSignup(false);

    const amount = getSelectedBundle.price.toFixed(2);
    const externalref = uuidv4();
    const description = `${
      getSelectedBundle.gb
    }GB ${selectedProvider.toUpperCase()} Data Bundle`;

    setModalIsOpen(true);

    try {
      const payload = {
        amount,
        email: STATIC_CUSTOMER_EMAIL,
        desc: description,
        externalref,
        metadata: {
          type: "data_bundle",
          provider: selectedProvider.toUpperCase(),
          gb: getSelectedBundle.gb,
          recipient_number: formatPhoneNumber(recipientPhoneNumber),
          service_id: `D${getSelectedBundle.gb}`,
          ussd_session_id: uuidv4(),
        },
      };

      const result = await startMoolrePayment(payload);
      const { authorization_url } = result.data;

      // Auto-redirect + close modal
      window.open(authorization_url, "_blank", "noopener,noreferrer");
      setModalIsOpen(false); // ← CLOSE MODAL
      setStatusMessage("Redirecting to payment...");
    } catch (err) {
      console.error("Moolre error:", err);
      setStatusMessage(
        err.code === "invalid-argument"
          ? err.message
          : `Payment failed: ${err.message}`
      );
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // === AGENT SIGNUP ===
  const handleAgentSignUpPayment = async (e) => {
    e.preventDefault();

    const fields = [
      agentFullName,
      agentPhone,
      agentMomoNumber,
      agentSignUpEmail,
      signUpUsername,
      signUpPassword,
    ];
    if (fields.some((f) => !f)) {
      setSignupError("Please fill all fields.");
      return;
    }
    if (!/^\d{10}$/.test(agentPhone) || !/^\d{10}$/.test(agentMomoNumber)) {
      setSignupError("Please enter valid 10-digit phone and MoMo numbers.");
      return;
    }
    if (!agentSignUpEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    setIsPaymentLoading(true);
    setSignupError("");
    setIsAgentSignup(true);

    const amount = "50.00";
    const externalref = uuidv4();

    setModalIsOpen(true);

    try {
      const payload = {
        amount,
        email: agentSignUpEmail,
        desc: `Agent registration – ${agentFullName}`,
        externalref,
        metadata: {
          type: "agent_signup",
          fullName: agentFullName,
          phone: agentPhone,
          momoNumber: agentMomoNumber,
          email: agentSignUpEmail,
          username: signUpUsername,
          password: signUpPassword,
        },
      };

      const result = await startMoolrePayment(payload);
      const { authorization_url } = result.data;

      window.open(authorization_url, "_blank", "noopener,noreferrer");
      setModalIsOpen(false); // ← CLOSE MODAL
      setStatusMessage("Redirecting to payment...");
    } catch (err) {
      console.error("Agent signup error:", err);
      setSignupError(
        err.code === "invalid-argument" ? err.message : `Failed: ${err.message}`
      );
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // === CHECK DATA STATUS ===
  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
  };

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(dataPhoneNumber)) {
      setStatusMessage("Enter a valid 10-digit number.");
      closeCheckDataModal();
      return;
    }

    const phone = formatPhoneNumber(dataPhoneNumber);
    try {
      const q = query(
        collection(db, "webite_purchase"),
        where("phoneNumber", "==", phone)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setStatusMessage(`No purchase found for ${dataPhoneNumber}`);
        closeCheckDataModal();
        return;
      }

      const doc = snapshot.docs[0].data();

      let message = "";
      if (doc.status === "approved") {
        if (doc.exported === true) {
          message = "Data has been processed and will be delivered shortly!";
        } else {
          message = "Payment successful! Pending processing.";
        }
      } else {
        message = `Status: ${doc.status}`;
      }

      setStatusMessage(message);
      closeCheckDataModal();
    } catch (err) {
      setStatusMessage("Error checking status.");
      closeCheckDataModal();
    }
  };

  // === AGENT LOGIN ===
  const closeAgentPortalModal = () => {
    setAgentPortalModalOpen(false);
    setAgentEmail("");
    setAgentPassword("");
    setIsSignUp(false);
    setSignupError("");
    setAgentFullName("");
    setAgentPhone("");
    setAgentMomoNumber("");
    setAgentSignUpEmail("");
    setSignUpUsername("");
    setSignUpPassword("");
  };

  const handleAgentLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, agentEmail, agentPassword);
      setStatusMessage("Logged in successfully!");
      closeAgentPortalModal();
      navigate("/agent-portal");
    } catch (err) {
      setStatusMessage(`Login failed: ${err.message}`);
    }
  };

  // === AUTH OBSERVER ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);

  // === CLEAR STATUS MESSAGE AFTER 6s ===
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(""), 6000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  // === RENDER ===
  const providerLogos = { mtn, airtel, telecel };

  return (
    <div className="app">
      {/* Homepage Status Message */}
      {statusMessage && (
        <motion.div
          className="global-status"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {statusMessage}
        </motion.div>
      )}

      <header className="header">
        <motion.div className="title-with-icon">
          <FaWifi className="wifi-icon" />
          <h1>Ricky's Data</h1>
        </motion.div>
        <motion.p className="subtitle">
          Easy & Affordable Data Bundle Purchase
          {currentUser && ` | Welcome, ${currentUser.email} (Agent)`}
        </motion.p>
      </header>

      <motion.section className="action-buttons-section">
        <div className="action-buttons-container">
          <motion.button
            className="action-button check-data-btn"
            onClick={() => setCheckDataModalOpen(true)}
            whileHover={{ scale: 1.05 }}
          >
            <FaSearch /> Check Data Status
          </motion.button>
          <motion.button
            className="action-button agent-portal-btn"
            onClick={() => setAgentPortalModalOpen(true)}
            whileHover={{ scale: 1.05 }}
          >
            <FaUserShield /> Agent Portal
          </motion.button>
        </div>
      </motion.section>

      <motion.section className="provider-logos-section">
        <h3>Supported Networks</h3>
        <div className="provider-logos-container">
          {Object.keys(providerLogos).map((p) => (
            <motion.img
              key={p}
              src={providerLogos[p]}
              className="provider-logo-img"
              alt={p}
              whileHover={{ scale: 1.1 }}
            />
          ))}
        </div>
      </motion.section>

      <motion.section className="purchase-form-container">
        <h2>Purchase Data Bundle</h2>
        <p className="disclaimer-message">
          Data will be credited within 5 mins - 4 hours
        </p>
        <form onSubmit={handlePurchase} className="purchase-form">
          <div className="form-group">
            <label>Data Network:</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              required
            >
              {Object.keys(providersData).map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Bundle:</label>
            <select
              value={selectedBundleSize}
              onChange={(e) => setSelectedBundleSize(e.target.value)}
              required
            >
              {providersData[selectedProvider]?.map((b) => (
                <option key={b.gb} value={b.gb}>
                  {b.gb}GB (GHS {b.price})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Recipient Phone Number:</label>
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
            whileTap={{ scale: 0.95 }}
          >
            {isPaymentLoading ? (
              <>
                <FaSpinner className="spin" /> Processing...
              </>
            ) : (
              `Pay GHS ${getSelectedBundle?.price}`
            )}
          </motion.button>
        </form>
      </motion.section>

      <motion.section className="contact-support">
        <h3>Need Help?</h3>
        <p>
          Contact <a href="tel:0559370174">0559370174</a>
        </p>
      </motion.section>

      <motion.section className="whatsapp-group-section">
        <h3>Join Our Community</h3>
        <p>
          Stay updated with the latest offers and support by joining our
          WhatsApp group!
        </p>
        <motion.a
          href="https://chat.whatsapp.com/JtApd4zwqGU4hrGA6d2iv1?mode=wwt"
          className="whatsapp-group-button"
          whileHover={{ scale: 1.05 }}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp size={24} /> Join WhatsApp Group
        </motion.a>
      </motion.section>

      <motion.a
        href="https://wa.me/233549856098"
        className="whatsapp-float"
        whileHover={{ scale: 1.1 }}
      >
        <FaWhatsapp size={30} />
      </motion.a>

      {/* Loading Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div className="pin-modal">
          <FaSpinner className="spin" size={50} />
          <h2>Redirecting to Payment...</h2>
          <p>Please wait while we open the secure payment page.</p>
          <p>
            <strong>
              {isAgentSignup
                ? "Agent Registration (GHS 50)"
                : `${
                    getSelectedBundle?.gb
                  }GB ${selectedProvider.toUpperCase()}`}
            </strong>
          </p>
          <motion.button
            onClick={closeModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
          >
            Cancel
          </motion.button>
        </motion.div>
      </Modal>

      {/* Check Data Modal */}
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
              <label>Phone Number:</label>
              <input
                type="tel"
                value={dataPhoneNumber}
                onChange={(e) => setDataPhoneNumber(e.target.value)}
                pattern="[0-9]{10}"
                placeholder="0541234567"
                required
              />
            </div>
            <motion.button type="submit" className="submit-button">
              Check
            </motion.button>
          </form>
          <motion.button
            onClick={closeCheckDataModal}
            className="close-modal-button secondary"
          >
            Cancel
          </motion.button>
        </div>
      </Modal>

      {/* Agent Portal Modal */}
      <Modal
        isOpen={agentPortalModalOpen}
        onRequestClose={closeAgentPortalModal}
        className="modal"
        overlayClassName="overlay"
      >
        <div className="modal-content">
          <h2>
            <FaUserShield /> Agent Portal
          </h2>
          <div className="toggle-buttons">
            <button
              type="button"
              className={`toggle-btn ${!isSignUp ? "active" : ""}`}
              onClick={() => setIsSignUp(false)}
            >
              Login
            </button>
            <button
              type="button"
              className={`toggle-btn ${isSignUp ? "active" : ""}`}
              onClick={() => setIsSignUp(true)}
            >
              Sign Up
            </button>
          </div>

          {isSignUp ? (
            <form onSubmit={handleAgentSignUpPayment} className="simple-form">
              <p>
                <strong>Step 1:</strong> Pay GHS 50 → <strong>Step 2:</strong>{" "}
                Account auto-created!
              </p>
              {signupError && <p className="error-message">{signupError}</p>}

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
                <label>Contact Phone Number:</label>
                <input
                  type="tel"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  pattern="[0-9]{10}"
                  placeholder="0541234567"
                  required
                />
              </div>
              <div className="form-group">
                <label>MoMo Number:</label>
                <input
                  type="tel"
                  value={agentMomoNumber}
                  onChange={(e) => setAgentMomoNumber(e.target.value)}
                  pattern="[0-9]{10}"
                  placeholder="0541234567"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={agentSignUpEmail}
                  onChange={(e) => setAgentSignUpEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={signUpUsername}
                  onChange={(e) => setSignUpUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                />
              </div>

              <motion.button
                type="submit"
                disabled={isPaymentLoading}
                className="submit-button"
                whileHover={{ scale: 1.05 }}
              >
                {isPaymentLoading ? (
                  <>
                    <FaSpinner className="spin" /> Processing...
                  </>
                ) : (
                  "Pay GHS 50 & Register"
                )}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleAgentLogin} className="simple-form">
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  value={agentPassword}
                  onChange={(e) => setAgentPassword(e.target.value)}
                  required
                />
              </div>
              <motion.button type="submit" className="submit-button">
                Login
              </motion.button>
            </form>
          )}
          <motion.button
            onClick={closeAgentPortalModal}
            className="close-modal-button secondary"
          >
            Cancel
          </motion.button>
        </div>
      </Modal>
    </div>
  );
}

export default App;
