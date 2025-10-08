import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Modal from "react-modal";
import {
  FaWhatsapp,
  FaMobileAlt,
  FaWifi,
  FaSearch,
  FaUserShield,
} from "react-icons/fa";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  GoogleAuthProvider,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import "./App.css";

Modal.setAppElement("#root");

const AGENT_USSD_CODE = "*920*177#";

const THETELLER_CONFIG = {
  merchantId: "TTM-00009769",
  currency: "GHS",
  paymentMethod: "both",
  redirectUrl: window.location.href,
  payButtonText: "Pay Securely with TheTeller",
  customDescription: "Payment for Data Bundle via Lord's Data",
};

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
  const [purchaseDetails, setPurchaseDetails] = useState(() => {
    const saved = localStorage.getItem("purchaseDetails");
    return saved ? JSON.parse(saved) : null;
  });
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
  const [agentSignUpDetails, setAgentSignUpDetails] = useState(() => {
    const saved = localStorage.getItem("agentSignUpDetails");
    return saved ? JSON.parse(saved) : null;
  });
  const [agentSignUpModalOpen, setAgentSignUpModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [signupError, setSignupError] = useState("");

  const generateTransactionId = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0].toString().padStart(12, "0").slice(0, 12);
  };

  const getSelectedBundle = useMemo(() => {
    const providerBundles = providersData[selectedProvider];
    return providerBundles.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  useEffect(() => {
    const handleAuthError = (error) => {
      if (error.code === "auth/no-auth-event") {
        console.warn(
          "Firebase Auth Event Error: Likely popup/redirect blocked. Try incognito or whitelist domains."
        );
        alert(
          "Auth flow interrupted (e.g., popup blocked). Please retry in an incognito window or check console."
        );
      }
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        if (user) {
          console.log("Auth state changed: User logged in", user.uid);
        }
      },
      handleAuthError
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedBundleSize(
      providersData[selectedProvider][0]?.gb.toString() || ""
    );
  }, [selectedProvider]);

  useEffect(() => {
    if (purchaseDetails) {
      localStorage.setItem("purchaseDetails", JSON.stringify(purchaseDetails));
    } else {
      localStorage.removeItem("purchaseDetails");
    }
    if (agentSignUpDetails) {
      localStorage.setItem(
        "agentSignUpDetails",
        JSON.stringify(agentSignUpDetails)
      );
    } else {
      localStorage.removeItem("agentSignUpDetails");
    }
  }, [purchaseDetails, agentSignUpDetails]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transid = urlParams.get("transaction_id");
    if (transid && (!purchaseDetails || purchaseDetails.transid !== transid)) {
      console.log("Clearing stale purchaseDetails due to mismatch or absence");
      setPurchaseDetails(null);
      localStorage.removeItem("purchaseDetails");
    }
  }, []);

  const closeModal = () => {
    setModalIsOpen(false);
    setRecipientPhoneNumber("");
    setSelectedProvider("airtel");
    setPurchaseDetails(null);
    localStorage.removeItem("purchaseDetails");
  };

  const closeCheckDataModal = () => {
    setCheckDataModalOpen(false);
    setDataPhoneNumber("");
  };

  const closeAgentSignUpModal = () => {
    setAgentSignUpModalOpen(false);
    setAgentSignUpDetails(null);
    localStorage.removeItem("agentSignUpDetails");
    navigate("/agent-portal");
  };

  const closeAgentPortalModal = () => {
    setAgentPortalModalOpen(false);
    setAgentEmail("");
    setAgentPassword("");
    setIsSignUp(false);
    setSignupError("");
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

  const handleAgentLogin = async (e) => {
    e.preventDefault();
    if (!agentEmail || !agentPassword) {
      alert("Please enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, agentEmail, agentPassword);
      alert(`Logged in as agent with email ${agentEmail}!`);
      closeAgentPortalModal();
      navigate("/agent-portal");
    } catch (error) {
      console.error("Login Error:", error);
      if (error.code === "auth/no-auth-event") {
        alert("Auth popup blocked. Trying redirect...");
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        alert(`Login failed: ${error.message}`);
      }
    }
  };

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

    try {
      const checkEmailUniqueness = httpsCallable(
        functions,
        "checkEmailUniqueness"
      );
      const result = await checkEmailUniqueness({ email: agentSignUpEmail });
      if (result.data.exists) {
        setSignupError("An agent with this email already exists.");
        return;
      }
    } catch (error) {
      console.error("Error checking existing email:", error);
      setSignupError("Error checking email availability. Please try again.");
      return;
    }

    setIsPaymentLoading(true);
    setSignupError("");
    const transactionId = generateTransactionId();
    setAgentSignUpDetails({
      fullName: agentFullName,
      phone: agentPhone,
      email: agentSignUpEmail,
      username: signUpUsername,
      password: signUpPassword,
      transid: transactionId,
    });

    try {
      const initiateThetellerPayment = httpsCallable(
        functions,
        "initiateThetellerPayment"
      );
      const amountInPesewas = (50.0 * 100).toFixed(0);
      const result = await initiateThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: "Agent Registration Fee - Lord's Data Portal",
        amount: amountInPesewas,
        redirect_url: THETELLER_CONFIG.redirectUrl,
        email: STATIC_CUSTOMER_EMAIL,
      });
      const { checkout_url } = result.data;
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Error initiating agent signup payment:", error);
      setSignupError(`Payment initiation failed: ${error.message}`);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect auth success:", result.user.uid);
          navigate("/agent-portal");
        }
      } catch (error) {
        console.error("Redirect result error:", error);
        setSignupError(`Authentication failed: ${error.message}`);
      }
    };

    handleRedirectResult();

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const code = urlParams.get("code");
    const transid = urlParams.get("transaction_id");

    if (
      status === "approved" &&
      code === "000" &&
      transid &&
      agentSignUpDetails?.transid === transid
    ) {
      const registerAgent = async () => {
        try {
          const checkEmailUniqueness = httpsCallable(
            functions,
            "checkEmailUniqueness"
          );
          const result = await checkEmailUniqueness({
            email: agentSignUpDetails.email,
          });
          if (result.data.exists) {
            setSignupError("An agent with this email already exists.");
            return;
          }

          const userCredential = await createUserWithEmailAndPassword(
            auth,
            agentSignUpDetails.email,
            agentSignUpDetails.password
          );
          const user = userCredential.user;

          await sendEmailVerification(user);

          await setDoc(doc(db, "lord's-agents", user.uid), {
            fullName: agentSignUpDetails.fullName,
            phone: agentSignUpDetails.phone,
            username: agentSignUpDetails.username,
            email: agentSignUpDetails.email,
            registeredAt: new Date(),
            isActive: false,
          });

          console.log("Agent registered successfully:", user.uid);
          setAgentSignUpModalOpen(true);
        } catch (error) {
          console.error("Signup Error:", error);
          setSignupError(`Registration failed: ${error.message}`);
        }
      };

      registerAgent();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [agentSignUpDetails, navigate]);

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

    // Validate subscriber_number
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
    } else {
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
      storePurchase(true); // Store declined transaction
    }
  }, [purchaseDetails, currentUser]);

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

  return (
    <div className="app">
      <header className="header">
        <motion.div
          className="title-with-icon"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FaWifi className="wifi-icon" />
          <h1>Lord's Data</h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="subtitle"
        >
          Easy & Affordable Data Bundle Purchase
          {currentUser && (
            <span> | Welcome, {currentUser.email} (Agent Logged In)</span>
          )}
        </motion.p>
      </header>
      <motion.section
        className="action-buttons-section"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="action-buttons-container">
          <motion.button
            className="action-button check-data-btn"
            onClick={() => setCheckDataModalOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaSearch className="action-icon" />
            Check Data Status
          </motion.button>
          <motion.button
            className="action-button agent-portal-btn"
            onClick={() => setAgentPortalModalOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaUserShield className="action-icon" />
            Agent Portal
          </motion.button>
        </div>
      </motion.section>
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
            <p>Dial this code to purchase bundles directly from Lord's Data:</p>
            <span className="ussd-code-display primary-code">
              {AGENT_USSD_CODE}
            </span>
          </div>
        </div>
      </motion.section>
      <motion.section
        className="purchase-form-container"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <h2>Select and Buy Bundle</h2>
        <form onSubmit={handlePurchase} className="purchase-form">
          <motion.div
            className="form-group"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <label htmlFor="network">Network Provider:</label>
            <select
              id="network"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              required
            >
              {Object.keys(providersData).map((provider) => (
                <option key={provider} value={provider}>
                  {provider.toUpperCase()}
                </option>
              ))}
            </select>
          </motion.div>
          <motion.div
            className="form-group"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <label htmlFor="bundle">Select Bundle:</label>
            <select
              id="bundle"
              value={selectedBundleSize}
              onChange={(e) => setSelectedBundleSize(e.target.value)}
              required
            >
              {providersData[selectedProvider]?.map((bundle, index) => (
                <option key={index} value={bundle.gb}>
                  {bundle.gb} GB (GHS {bundle.price.toFixed(2)})
                </option>
              ))}
            </select>
          </motion.div>
          <motion.div
            className="form-group"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
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
          </motion.div>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            {isPaymentLoading ? "Processing..." : "Proceed to Payment"}
          </motion.button>
        </form>
      </motion.section>
      <motion.section
        className="contact-support"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <h3>Need Help?</h3>
        <p>
          For any issue or concern, contact{" "}
          <a href="tel:0245687544" className="contact-number">
            0245687544
          </a>
        </p>
      </motion.section>
      <motion.a
        href="https://wa.me/233555555555"
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.0 }}
        whileHover={{ scale: 1.1 }}
      >
        <FaWhatsapp size={30} />
      </motion.a>
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
            You have successfully purchased a **{purchaseDetails?.gb} GB**
            bundle from **{purchaseDetails?.provider}** for **GHS{" "}
            {purchaseDetails?.price.toFixed(2)}**.
          </p>
          <p>The bundle has been credited to **{purchaseDetails?.number}**.</p>
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
        isOpen={agentPortalModalOpen}
        onRequestClose={closeAgentPortalModal}
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
            <>
              <p>
                Complete the form and pay GHS 50 registration fee to sign up.
              </p>
              {signupError && (
                <p
                  className="error-message"
                  style={{ color: "red", marginBottom: "10px" }}
                >
                  {signupError}
                </p>
              )}
              <form onSubmit={handleAgentSignUpPayment} className="simple-form">
                <div className="form-group">
                  <label htmlFor="agent-fullname">Full Name:</label>
                  <input
                    id="agent-fullname"
                    type="text"
                    value={agentFullName}
                    onChange={(e) => setAgentFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="agent-phone">Phone Number:</label>
                  <input
                    id="agent-phone"
                    type="tel"
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    required
                    pattern="[0-9]{10}"
                    placeholder="Enter 10-digit number"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-email">Email:</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={agentSignUpEmail}
                    onChange={(e) => setAgentSignUpEmail(e.target.value)}
                    required
                    placeholder="Enter your email address"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-username">Username:</label>
                  <input
                    id="signup-username"
                    type="text"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    required
                    placeholder="Enter your username"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-password">Password:</label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <motion.button
                  type="submit"
                  className="submit-button"
                  disabled={
                    !agentFullName ||
                    agentPhone.length !== 10 ||
                    !agentSignUpEmail ||
                    !signUpUsername ||
                    !signUpPassword ||
                    isPaymentLoading
                  }
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPaymentLoading ? "Processing..." : "Proceed to Payment"}
                </motion.button>
              </form>
            </>
          ) : (
            <>
              <p>Login to access your agent dashboard.</p>
              <form onSubmit={handleAgentLogin} className="simple-form">
                <div className="form-group">
                  <label htmlFor="agent-email">Email:</label>
                  <input
                    id="agent-email"
                    type="email"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="agent-password">Password:</label>
                  <input
                    id="agent-password"
                    type="password"
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <motion.button
                  type="submit"
                  className="submit-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Login
                </motion.button>
              </form>
            </>
          )}
          <motion.button
            onClick={closeAgentPortalModal}
            className="close-modal-button secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
        </motion.div>
      </Modal>
      <Modal
        isOpen={agentSignUpModalOpen}
        onRequestClose={closeAgentSignUpModal}
        className="modal"
        overlayClassName="overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="success-message"
        >
          <h2>🎉 Agent Registration Successful! 🎉</h2>
          <p>
            Thank you, **{agentSignUpDetails?.fullName}**! Your payment of GHS
            50 has been received.
          </p>
          <p>
            Your account has been created. Please check your email (**
            {agentSignUpDetails?.email}**) for a verification link to activate
            your account. Contact support for queries.
          </p>
          <motion.button
            onClick={closeAgentSignUpModal}
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

export default App;
