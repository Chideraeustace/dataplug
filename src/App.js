// First, install necessary dependencies:
// npm install framer-motion react-modal react-icons

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Modal from "react-modal";
import { FaWhatsapp, FaMobileAlt, FaWifi } from "react-icons/fa";
import "./App.css";

Modal.setAppElement("#root");

// Agent's Specific USSD Code for purchase through Lord's Data (the code you provided)
const AGENT_USSD_CODE = "*920*177#";

// Data structure remains the same
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
  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState(null);

  const getSelectedBundle = useMemo(() => {
    const providerBundles = providersData[selectedProvider];
    return providerBundles.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  React.useEffect(() => {
    setSelectedBundleSize(
      providersData[selectedProvider][0]?.gb.toString() || ""
    );
  }, [selectedProvider]);

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const handlePurchase = (e) => {
    e.preventDefault();

    const finalBundle = getSelectedBundle;

    if (!finalBundle) {
      alert("Please select a valid bundle.");
      return;
    }

    setPurchaseDetails({
      provider: selectedProvider.toUpperCase(),
      gb: finalBundle.gb,
      price: finalBundle.price,
      number: recipientPhoneNumber,
    });

    setModalIsOpen(true);

    setTimeout(() => {
      closeModal();
      setRecipientPhoneNumber("");
      setSelectedProvider("airtel");
    }, 3000);
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
        </motion.p>
      </header>

      {/* -------------------- AGENT USSD CODE DISPLAY -------------------- */}
      <motion.section
        className="agent-ussd-card"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
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

      {/* -------------------- PURCHASE FORM -------------------- */}
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
            disabled={!getSelectedBundle || recipientPhoneNumber.length !== 10}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            Purchase GHS {getSelectedBundle?.price.toFixed(2) || "0.00"} Bundle
          </motion.button>
        </form>
      </motion.section>

      {/* -------------------- CONTACT SUPPORT SECTION -------------------- */}
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

      {/* -------------------- WHATSAPP ICON -------------------- */}
      <motion.a
        href="https://wa.me/233555555555" // Replace with your actual WhatsApp number
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

      {/* -------------------- MODAL -------------------- */}
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
    </div>
  );
}

export default App;
