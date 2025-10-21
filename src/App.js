import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Modal from "react-modal";
import {
  FaWhatsapp,
  FaWifi,
  FaSearch,
  FaUserShield,
  FaCheckCircle,
  FaSpinner,
  FaTimesCircle,
} from "react-icons/fa";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db, auth, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import "./App.css";
import mtn from "./download.png";
import airtel from "./airtel.png";
import telecel from "./telecel.png";

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

function App() {
  const navigate = useNavigate();
  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [checkDataModalOpen, setCheckDataModalOpen] = useState(false);
  const [agentPortalModalOpen, setAgentPortalModalOpen] = useState(false);
  const [dataPhoneNumber, setDataPhoneNumber] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [agentFullName, setAgentFullName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentSignUpEmail, setAgentSignUpEmail] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [agentSignUpDetails, setAgentSignUpDetails] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [signupError, setSignupError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending_pin");
  const [isAgentSignup, setIsAgentSignup] = useState(false);

  const providerLogos = { mtn, airtel, telecel };
  const initiateThetellerPayment = httpsCallable(
    functions,
    "initiateThetellerPayment"
  );
  const formatPhoneNumber = useCallback((phone) => {
    if (phone.startsWith("0") && phone.length === 10)
      return `233${phone.slice(1)}`;
    if (phone.startsWith("233") && phone.length === 13) return phone;
    return `233${phone}`;
  }, []);

  // *** NOW SAFE - checkPaymentStatus IS DEFINED ***
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);

  const getRSwitch = useMemo(
    () => PROVIDER_R_SWITCH_MAP[selectedProvider],
    [selectedProvider]
  );
  // *** HOISTED - DECLARED BEFORE USEEFFECT ***
  const checkPaymentStatus = useCallback(async () => {
    const transactionId =
      purchaseDetails?.transid || agentSignUpDetails?.transid;
    if (!transactionId) return;

    try {
      const result = await initiateThetellerPayment({
        transaction_id: transactionId,
        isCallback: true,
      });

      if (result.data.final_status === "approved") {
        setPaymentStatus("approved");

        // *** AGENT SIGNUP - AUTO LOGIN AFTER SUCCESS ***
        if (isAgentSignup && agentSignUpDetails) {
          try {
            await signInWithEmailAndPassword(
              auth,
              agentSignUpDetails.email,
              agentSignUpDetails.password
            );
            alert(
              `🎉 Welcome ${agentSignUpDetails.fullName}! Agent account created & logged in!`
            );
            closeModal();
            navigate("/agent-portal");
            return;
          } catch (loginError) {
            alert(`Payment successful! Please login with your credentials.`);
          }
        }

        // *** DATA PURCHASE - STORE TRANSACTION ***
        if (purchaseDetails) {
          await addDoc(collection(db, "teller_response"), {
            ...purchaseDetails,
            email: STATIC_CUSTOMER_EMAIL,
            createdAt: new Date(),
            userId: currentUser?.uid,
            exported: false,
            subscriber_number: formatPhoneNumber(purchaseDetails.number),
            r_switch: getRSwitch,
            amount: purchaseDetails.price,
            status: "approved",
            code: "000",
            desc: `${purchaseDetails.gb}GB ${purchaseDetails.provider} Data Bundle`,
          });
        }
      } else if (result.data.final_status === "declined") {
        setPaymentStatus("declined");
      }
    } catch (error) {
      console.log("Status check in progress...");
    }
  }, [
    purchaseDetails,
    agentSignUpDetails,
    currentUser,
    formatPhoneNumber,
    getRSwitch,
    isAgentSignup,
    navigate,
  ]);

  const generateTransactionId = useCallback(() => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0].toString().padStart(12, "0").slice(0, 12);
  }, []);

  const getSelectedBundle = useMemo(() => {
    return providersData[selectedProvider]?.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  // Auto-poll payment status
  useEffect(() => {
    let interval;
    if (
      paymentStatus === "pending_pin" &&
      (purchaseDetails || agentSignUpDetails)
    ) {
      interval = setInterval(checkPaymentStatus, 5000);
    }
    return () => interval && clearInterval(interval);
  }, [paymentStatus, purchaseDetails, agentSignUpDetails, checkPaymentStatus]);

  // *** DATA PURCHASE - NO REDIRECT ***
  const handlePurchase = async (e) => {
    e.preventDefault();

    if (!getSelectedBundle || recipientPhoneNumber.length !== 10) {
      alert("Please complete all fields.");
      return;
    }

    setIsPaymentLoading(true);
    setIsAgentSignup(false);
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

  // *** AGENT SIGNUP - PAY FIRST, CREATE ACCOUNT AFTER ***
  const handleAgentSignUpPayment = async (e) => {
    e.preventDefault();

    if (
      !agentFullName ||
      !agentPhone ||
      !agentSignUpEmail ||
      !signUpUsername ||
      !signUpPassword
    ) {
      setSignupError("Please fill all fields.");
      return;
    }

    if (agentPhone.length !== 10 || !/^\d{10}$/.test(agentPhone)) {
      setSignupError("Please enter a valid 10-digit phone number.");
      return;
    }

    if (
      !agentSignUpEmail.match(
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      )
    ) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    setIsPaymentLoading(true);
    setSignupError("");
    setIsAgentSignup(true);
    const transactionId = generateTransactionId();

    const agentDetails = {
      fullName: agentFullName,
      phone: agentPhone,
      email: agentSignUpEmail,
      username: signUpUsername,
      password: signUpPassword,
      transid: transactionId,
    };

    setAgentSignUpDetails(agentDetails);
    setPaymentStatus("pending_pin");
    setModalIsOpen(true);
    setAgentPortalModalOpen(false); // Close signup form

    try {
      const amountInPesewas = (50.0 * 100).toFixed(0);
      await initiateThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: JSON.stringify(agentDetails),
        amount: amountInPesewas,
        subscriber_number: formatPhoneNumber(agentPhone),
        email: STATIC_CUSTOMER_EMAIL,
        isAgentSignup: true,
      });

      alert(`📱 Check your phone ${agentPhone} for PIN prompt!`);
    } catch (error) {
      setSignupError(`Payment failed: ${error.message}`);
      setModalIsOpen(false);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setPurchaseDetails(null);
    setAgentSignUpDetails(null);
    setPaymentStatus("pending_pin");
    setIsAgentSignup(false);
    if (!currentUser) {
      setRecipientPhoneNumber("");
      setSelectedProvider("airtel");
      setSelectedBundleSize("1");
    }
  };

  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
  };

  const closeAgentPortalModal = () => {
    setAgentPortalModalOpen(false);
    setAgentEmail("");
    setAgentPassword("");
    setIsSignUp(false);
    setSignupError("");
    setAgentFullName("");
    setAgentPhone("");
    setAgentSignUpEmail("");
    setSignUpUsername("");
    setSignUpPassword("");
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

  const handleAgentLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, agentEmail, agentPassword);
      alert(`Logged in as agent with email ${agentEmail}!`);
      closeAgentPortalModal();
      navigate("/agent-portal");
    } catch (error) {
      alert(`Login failed: ${error.message}`);
    }
  };

  // JSX
  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <motion.div
          className="title-with-icon"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FaWifi className="wifi-icon" />
          <h1>Lord's Data</h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="subtitle"
        >
          Easy & Affordable Data Bundle Purchase
          {currentUser && <span> | Welcome, {currentUser.email} (Agent)</span>}
        </motion.p>
      </header>

      {/* ACTION BUTTONS */}
      <motion.section
        className="action-buttons-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="action-buttons-container ">
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

      {/* PROVIDER LOGOS */}
      <motion.section className="provider-logos-section">
        <h3>Supported Networks</h3>
        <div className="provider-logos-container">
          {Object.keys(providerLogos).map((provider) => (
            <motion.img
              key={provider}
              src={providerLogos[provider]}
              className="provider-logo-img"
              alt={provider}
              whileHover={{ scale: 1.1 }}
            />
          ))}
        </div>
      </motion.section>

      {/* PURCHASE FORM */}
      <motion.section className="purchase-form-container">
        <h2>Purchase Data Bundle</h2>
        <p className="disclaimer-message">
          Data credited within 15 mins - 4 hours
        </p>
        <form onSubmit={handlePurchase} className="purchase-form">
          <div className="form-group">
            <label>Network:</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
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
            >
              {providersData[selectedProvider]?.map((b) => (
                <option key={b.gb} value={b.gb}>
                  {b.gb}GB (GHS {b.price})
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
              : `Pay GHS ${getSelectedBundle?.price}`}
          </motion.button>
        </form>
      </motion.section>

      {/* CONTACT */}
      <motion.section className="contact-support">
        <h3>Need Help?</h3>
        <p>
          Contact <a href="tel:0240964167">0240964167</a>
        </p>
      </motion.section>

      {/* WHATSAPP GROUP SECTION */}
      <motion.section className="whatsapp-group-section">
        <h3>Join Our Community</h3>
        <p>
          Stay updated with the latest offers and support by joining our
          WhatsApp group!
        </p>
        <motion.a
          href="https://chat.whatsapp.com/E7iqqHV9RgpBcyXeEnRMQP"
          className="whatsapp-group-button"
          whileHover={{ scale: 1.05 }}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaWhatsapp size={24} /> Join WhatsApp Group
        </motion.a>
      </motion.section>

      {/* WHATSAPP */}
      <motion.a
        href="https://wa.me/233240964167"
        className="whatsapp-float"
        whileHover={{ scale: 1.1 }}
      >
        <FaWhatsapp size={30} />
      </motion.a>

      {/* *** UNIVERSAL PIN MODAL *** */}
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
                <strong>Sent to:</strong>{" "}
                {purchaseDetails?.number || agentSignUpDetails?.phone}
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
                  {isAgentSignup
                    ? "Agent Registration (GHS 50)"
                    : `${purchaseDetails?.gb}GB ${purchaseDetails?.provider}`}
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
              <h2>🎉 Payment Successful!</h2>
              <p>
                {isAgentSignup
                  ? "Agent registration completed!"
                  : `${purchaseDetails?.gb}GB bundle purchased!`}
              </p>
              <p>
                {isAgentSignup
                  ? "Logging you in..."
                  : "Data will be processed shortly."}
              </p>
              <motion.button
                onClick={closeModal}
                className="close-modal-button"
                whileHover={{ scale: 1.05 }}
              >
                {isAgentSignup ? "Redirecting..." : "Close"}
              </motion.button>
            </>
          ) : (
            <>
              <FaTimesCircle size={50} className="error-icon" />
              <h2>❌ Payment Declined</h2>
              <p>Please try again or contact support.</p>
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

      {/* AGENT PORTAL MODAL */}
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
              {signupError && (
                <p className="error-message" style={{ color: "red" }}>
                  {signupError}
                </p>
              )}
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
                {isPaymentLoading ? "Processing..." : "Pay GHS 50 & Register"}
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
              <motion.button
                type="submit"
                className="submit-button"
                whileHover={{ scale: 1.05 }}
              >
                Login
              </motion.button>
            </form>
          )}
          <motion.button
            onClick={closeAgentPortalModal}
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

export default App;
