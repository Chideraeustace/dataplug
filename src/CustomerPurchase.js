import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaShoppingCart,
  FaCheckCircle,
  FaSpinner,
  FaTimesCircle,
} from "react-icons/fa";
import Modal from "react-modal";
import { db, functions } from "./Firebase";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc } from "firebase/firestore";
import "./CustomerPurchase.css";

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

function CustomerPurchase() {
  const { agentId } = useParams();
  const [selectedProvider, setSelectedProvider] = useState("airtel");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [momoPhoneNumber, setMomoPhoneNumber] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("mtn");
  const [purchaseDetails, setPurchaseDetails] = useState(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Added for initial load
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

  // Simulate initial loading
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 500);
  }, []);

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

  // Error message timeout
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Reset bundle size when provider changes
  useEffect(() => {
    setSelectedBundleSize(
      publicProvidersData[selectedProvider][0]?.gb.toString() || "1"
    );
  }, [selectedProvider]);

  const checkPaymentStatus = useCallback(async () => {
    if (!purchaseDetails?.transid) {
      setErrorMessage("No transaction ID available.");
      closeModal();
      return;
    }

    if (statusCache.current.has(purchaseDetails.transid)) {
      const cachedStatus = statusCache.current.get(purchaseDetails.transid);
      setPaymentStatus(cachedStatus.final_status);
      return;
    }

    try {
      const result = await startThetellerPayment({
        transaction_id: purchaseDetails.transid,
        isCallback: true,
      });

      const { final_status, code, reason } = result.data;
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
      setErrorMessage(`Failed to check payment status: ${error.message}`);
    }
  }, [purchaseDetails, startThetellerPayment]);

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
      recipientNumber: recipientPhoneNumber,
      momoNumber: momoPhoneNumber,
      paymentProvider: paymentProvider.toUpperCase(),
      transid: transactionId,
      agentId,
    };

    setPurchaseDetails(newPurchaseDetails);
    setPaymentStatus(null);
    setCountdown(35);
    setModalIsOpen(true);

    try {
      const response = await startThetellerPayment({
        merchant_id: THETELLER_CONFIG.merchantId,
        transaction_id: transactionId,
        desc: `${
          getSelectedBundle.gb
        }GB ${selectedProvider.toUpperCase()} Data Bundle`,
        amount: amountInPesewas,
        subscriber_number: formatPhoneNumber(momoPhoneNumber),
        recipient_number: formatPhoneNumber(recipientPhoneNumber),
        r_switch: getRSwitch,
        email: STATIC_CUSTOMER_EMAIL,
        isAgentSignup: false,
      });

      await addDoc(collection(db, "data_approve_teller_transaction"), {
        userId: agentId,
        transaction_id: transactionId,
        provider: selectedProvider.toUpperCase(),
        gb: getSelectedBundle.gb,
        amount: getSelectedBundle.price,
        recipient_number: formatPhoneNumber(recipientPhoneNumber),
        subscriber_number: formatPhoneNumber(momoPhoneNumber),
        r_switch: getRSwitch,
        status: response.data.status,
        purchasedAt: new Date(),
        exported: false,
      });

      setPaymentStatus(response.data.status);
      setErrorMessage(
        `📱 Transaction initiated for ${momoPhoneNumber} (payment) and ${recipientPhoneNumber} (data recipient)!`
      );

      timeoutRef.current = setTimeout(() => {
        checkPaymentStatus();
      }, 35000);
    } catch (error) {
      setErrorMessage(`Payment failed: ${error.message}`);
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
    setMomoPhoneNumber("");
    setPaymentProvider("mtn");
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

  return (
    <div className="customer-purchase">
      {isLoading ? (
        <motion.div
          className="loading-spinner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <FaSpinner className="spin" /> Loading Ricky's Data...
        </motion.div>
      ) : (
        <>
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
            className="customer-header"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>Ricky's Data - Purchase Bundle</h1>
            <p>Fast, reliable data bundles for you!</p>
          </motion.header>

          <motion.section
            className="customer-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2>
              <FaShoppingCart /> Buy Data Bundle
            </h2>
            <form onSubmit={handlePurchase} className="purchase-form">
              {[
                {
                  id: "network",
                  label: "Data Network",
                  value: selectedProvider,
                  onChange: (e) => setSelectedProvider(e.target.value),
                  options: Object.keys(publicProvidersData).map((provider) => ({
                    value: provider,
                    label: provider.toUpperCase(),
                  })),
                },
                {
                  id: "bundle",
                  label: "Bundle",
                  value: selectedBundleSize,
                  onChange: (e) => setSelectedBundleSize(e.target.value),
                  options: publicProvidersData[selectedProvider]?.map(
                    (bundle) => ({
                      value: bundle.gb,
                      label: `${bundle.gb} GB (GHS ${bundle.price.toFixed(2)})`,
                    })
                  ),
                },
                {
                  id: "recipient-phone-number",
                  label: "Recipient Phone Number",
                  type: "tel",
                  value: recipientPhoneNumber,
                  onChange: (e) => setRecipientPhoneNumber(e.target.value),
                  placeholder: "0541234567",
                  error:
                    recipientPhoneNumber &&
                    !/^\d{10}$/.test(recipientPhoneNumber)
                      ? "Please enter a valid 10-digit phone number."
                      : null,
                },
                {
                  id: "momo-phone-number",
                  label: "MoMo Phone Number",
                  type: "tel",
                  value: momoPhoneNumber,
                  onChange: (e) => setMomoPhoneNumber(e.target.value),
                  placeholder: "0541234567",
                  error:
                    momoPhoneNumber && !/^\d{10}$/.test(momoPhoneNumber)
                      ? "Please enter a valid 10-digit MoMo phone number."
                      : null,
                },
                {
                  id: "payment-network",
                  label: "Payment Network",
                  value: paymentProvider,
                  onChange: (e) => setPaymentProvider(e.target.value),
                  options: Object.keys(PROVIDER_R_SWITCH_MAP).map(
                    (provider) => ({
                      value: provider,
                      label: provider.toUpperCase(),
                    })
                  ),
                },
              ].map((field, index) => (
                <motion.div
                  key={field.id}
                  className="form-group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <label htmlFor={field.id}>{field.label}:</label>
                  {field.options ? (
                    <select
                      id={field.id}
                      value={field.value}
                      onChange={field.onChange}
                      required
                    >
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.id}
                      type={field.type || "text"}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={field.placeholder}
                      pattern={field.type === "tel" ? "[0-9]{10}" : undefined}
                      required
                      aria-describedby={`${field.id}-error`}
                      className={field.error ? "input-error" : ""}
                    />
                  )}
                  {field.error && (
                    <span className="form-error" id={`${field.id}-error`}>
                      {field.error}
                    </span>
                  )}
                </motion.div>
              ))}
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
                whileTap={{ scale: 0.9, rotate: 2 }}
                transition={{ type: "spring", stiffness: 300 }}
                aria-label={`Purchase ${
                  getSelectedBundle?.gb
                }GB bundle for GHS ${getSelectedBundle?.price.toFixed(2)}`}
              >
                {isPaymentLoading ? (
                  <>
                    <FaSpinner className="spin" /> Processing...
                  </>
                ) : (
                  <>
                    <FaShoppingCart /> Pay GHS{" "}
                    {getSelectedBundle?.price.toFixed(2)}
                  </>
                )}
              </motion.button>
            </form>
          </motion.section>

          <Modal
            isOpen={modalIsOpen}
            onRequestClose={closeModal}
            className="modal"
            overlayClassName="overlay"
            aria-labelledby="pin-modal-title"
          >
            <motion.div
              className="pin-modal"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              {paymentStatus === "approved" ? (
                <>
                  <FaCheckCircle
                    size={60}
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
                    whileTap={{ scale: 0.9, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    aria-label="Close success modal"
                  >
                    Close
                  </motion.button>
                </>
              ) : paymentStatus === "declined" ? (
                <>
                  <FaTimesCircle
                    size={60}
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
                    whileTap={{ scale: 0.9, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
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
                    <strong>Payment Number:</strong>{" "}
                    {purchaseDetails?.momoNumber} (
                    {purchaseDetails?.paymentProvider})
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
                    whileTap={{ scale: 0.9, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    aria-label="Check payment status"
                    disabled={countdown !== null || paymentStatus}
                  >
                    <FaSpinner className="spin" /> Check Now
                  </motion.button>
                  <motion.button
                    onClick={closeModal}
                    className="close-modal-button secondary"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    aria-label="Cancel payment"
                  >
                    Cancel
                  </motion.button>
                </>
              )}
            </motion.div>
          </Modal>
        </>
      )}
    </div>
  );
}

export default CustomerPurchase;
