import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSpinner,
  FaWifi,
  FaMobileAlt,
  FaShieldAlt,
  FaStar,
  FaTimesCircle,
} from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { httpsCallable } from "firebase/functions";
import { functions } from "../Firebase";

const providersData = {
  mtn: {
    color: "bg-[#FFCC00]",
    border: "border-[#FFCC00]",
    text: "text-black",
    bundles: [
      { gb: 1, price: 5.0 },
      { gb: 2, price: 10.0 },
      { gb: 3, price: 15.0 },
      { gb: 4, price: 20.0 },
      { gb: 5, price: 25.0 },
      { gb: 6, price: 30.0 },
      { gb: 8, price: 37.0 },
      { gb: 10, price: 44.0 },
      { gb: 15, price: 64.0 },
      { gb: 20, price: 84.0 },
      { gb: 25, price: 104.0 },
      { gb: 30, price: 124.0 },
      { gb: 40, price: 160.0 },
      { gb: 50, price: 200.0 },
    ],
  },
  airtel: {
    color: "bg-[#ED1C24]",
    border: "border-[#ED1C24]",
    text: "text-white",
    bundles: [
      { gb: 1, price: 4.5 },
      { gb: 2, price: 9.5 },
      { gb: 3, price: 14.0 },
      { gb: 4, price: 19.0 },
      { gb: 5, price: 24.0 },
      { gb: 6, price: 39.0 },
      { gb: 7, price: 33.0 },
      { gb: 8, price: 38.0 },
      { gb: 10, price: 45.0 },
      { gb: 9, price: 40.0 },
      { gb: 15, price: 65.0 },
      { gb: 20, price: 85.0 },
    ],
  },
  telecel: {
    color: "bg-[#E60000]",
    border: "border-[#E60000]",
    text: "text-white",
    bundles: [
      { gb: 5, price: 25.0 },
      { gb: 10, price: 50.0 },
      { gb: 15, price: 66.0 },
      { gb: 20, price: 85.0 },
      { gb: 25, price: 105.0 },
      { gb: 30, price: 123.0 },
      { gb: 40, price: 160.0 },
      { gb: 50, price: 200.0 },
    ],
  },
};

const mtnSpecialOffers = [
  {
    id: 24,
    special_offer_package_id: 24,
    slug: "1.7gb",
    name: "1.7 GB",
    description: "Single MashUp cycle — 1746.92MB Only",
    cost_price: "6",
  },
  {
    id: 26,
    special_offer_package_id: 26,
    slug: "2.6gb-mins",
    name: "2.6 GB + 1,077 mins",
    description: "Three 873.46MB bundle cycles — approx 2.6 GB + mins",
    cost_price: "18",
  },
  {
    id: 34,
    special_offer_package_id: 34,
    slug: "3.4gb",
    name: "3.4 GB",
    description: "Two MashUp cycles on 1.7 GB base — approx 3.4 GB",
    cost_price: "11",
  },
  {
    id: 25,
    special_offer_package_id: 25,
    slug: "5.1gb-12",
    name: "5.1 GB",
    description: "Three 1.7 GB MashUp cycles — approx 5.1 GB",
    cost_price: "20",
  },
  {
    id: 27,
    special_offer_package_id: 27,
    slug: "7.2gb-15",
    name: "7.2 GB",
    description: "Four 1806.56MB bundle cycles — approx 7.2 GB",
    cost_price: "25",
  },
  {
    id: 31,
    special_offer_package_id: 31,
    slug: "10.2gb",
    name: "10.2 GB",
    description: "Six MashUp cycles on 1.7 GB base — approx 10.2 GB",
    cost_price: "30",
  },
];

const PurchaseForm = ({ setStatusMessage }) => {
  const isSpecialOfferAvailable = false;

  const [purchaseType, setPurchaseType] = useState("regular");
  const [selectedProvider, setSelectedProvider] = useState("mtn");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [selectedSpecialId, setSelectedSpecialId] = useState(
    mtnSpecialOffers[0].id.toString(),
  );
  // Who receives the data bundle.
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  // Whose MoMo wallet gets charged — can be different from the recipient
  // (e.g. buying a bundle as a gift for someone else).
  const [payerPhoneNumber, setPayerPhoneNumber] = useState("");
  const [sameAsRecipient, setSameAsRecipient] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ recipient: "", payer: "" });

  // "idle" | "submitting" | "sent" | "error"
  // No live tracking of the payment's eventual outcome — once the request
  // is sent, we just tell the customer to go approve it on their phone.
  const [paymentPhase, setPaymentPhase] = useState("idle");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const startTheTellerPayment = useMemo(
    () => httpsCallable(functions, "startTheTellerPayment"),
    [],
  );
  const activeType = isSpecialOfferAvailable ? purchaseType : "regular";
  const isBusy = paymentPhase !== "idle";

  const activeBundleDetails = useMemo(() => {
    if (activeType === "regular") {
      const bundle = providersData[selectedProvider].bundles.find(
        (b) => b.gb === Number(selectedBundleSize),
      );
      return bundle
        ? {
            price: bundle.price,
            desc: `${bundle.gb}GB ${selectedProvider.toUpperCase()} Data Bundle`,
            meta: {
              type: "data_bundle",
              provider: selectedProvider.toUpperCase(),
            },
          }
        : null;
    } else {
      const offer = mtnSpecialOffers.find(
        (o) => o.id === Number(selectedSpecialId),
      );
      return offer
        ? {
            price: Number(offer.cost_price),
            desc: `MTN Special: ${offer.name} (${offer.description})`,
            meta: {
              type: "special_offer",
              provider: "MTN",
              package_id: offer.id,
              slug: offer.slug,
            },
          }
        : null;
    }
  }, [activeType, selectedProvider, selectedBundleSize, selectedSpecialId]);

  const formatPhoneNumber = useCallback((phone) => {
    let formatted = phone.trim();
    if (formatted.startsWith("0") && formatted.length === 10)
      return `233${formatted.slice(1)}`;
    if (formatted.length === 9) return `233${formatted}`;
    return formatted;
  }, []);

  // Digits-only, capped at 10 chars, as the user types — and clears any
  // inline error for that field the moment they start correcting it.
  const handlePhoneInput = useCallback(
    (setter, errorKey) => (e) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
      setter(digits);
      setFieldErrors((prev) =>
        prev[errorKey] ? { ...prev, [errorKey]: "" } : prev,
      );
    },
    [],
  );

  const validate = useCallback(() => {
    const errors = { recipient: "", payer: "" };

    if (!/^0\d{9}$/.test(recipientPhoneNumber)) {
      errors.recipient = "Enter a valid 10-digit number starting with 0.";
    }

    const effectivePayer = sameAsRecipient
      ? recipientPhoneNumber
      : payerPhoneNumber;
    if (!/^0\d{9}$/.test(effectivePayer)) {
      errors.payer = "Enter a valid 10-digit MoMo number starting with 0.";
    }

    setFieldErrors(errors);
    return !errors.recipient && !errors.payer;
  }, [recipientPhoneNumber, payerPhoneNumber, sameAsRecipient]);

  const resetPurchase = useCallback(() => {
    setPaymentPhase("idle");
    setConfirmationMessage("");
    setErrorMessage("");
  }, []);

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (!activeBundleDetails || !validate()) {
      return;
    }

    const effectivePayerNumber = sameAsRecipient
      ? recipientPhoneNumber
      : payerPhoneNumber;

    setPaymentPhase("submitting");

    try {
      const ref = uuidv4();

      const payload = {
        amount: activeBundleDetails.price,
        phone: effectivePayerNumber,
        desc: activeBundleDetails.desc,
        reference: ref,
        metadata: {
          ...activeBundleDetails.meta,
          recipient_number: formatPhoneNumber(recipientPhoneNumber),
        },
      };

      const result = await startTheTellerPayment(payload);
      const responseData = result.data || {};

      if (responseData.status === "already_exists") {
        const message =
          "This payment was already started. Please wait a moment before trying again.";
        setErrorMessage(message);
        setPaymentPhase("error");
        setStatusMessage(message);
        return;
      }

      const message =
        responseData.message ||
        `Check your phone (${effectivePayerNumber}) and enter your MoMo PIN to approve the payment.`;
      setConfirmationMessage(message);
      setPaymentPhase("sent");
      setStatusMessage(message);
    } catch (err) {
      console.error("Failed to start payment:", err);
      const message =
        err.message || "Failed to initiate payment. Please try again.";
      setErrorMessage(message);
      setPaymentPhase("error");
      setStatusMessage(message);
    }
  };

  return (
    <section className="w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80"
      >
        {/* Header Section */}
        <div className="bg-slate-950 p-5 sm:p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-500/10 p-2 rounded-lg">
              <FaWifi className="text-indigo-400 text-xl" />
            </div>
            <h2 className="text-xl font-bold text-white">Purchase Bundle</h2>
          </div>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Verified numbers are delivered within 3 minutes to 2 hours, while
            unverified numbers are delivered within 24 hours.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {paymentPhase === "idle" || paymentPhase === "submitting" ? (
            <motion.form
              key="form"
              onSubmit={handlePurchase}
              className="p-5 sm:p-6 space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Service Category Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">
                  Select Offer Type
                </label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={isBusy}
                    onClick={() => {
                      setPurchaseType("regular");
                      setSelectedProvider("mtn");
                      setSelectedBundleSize("1");
                    }}
                    className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                      activeType === "regular"
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Regular Bundles
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={!isSpecialOfferAvailable || isBusy}
                    onClick={() => {
                      setPurchaseType("special");
                      setSelectedProvider("mtn");
                    }}
                    className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 relative
                      ${
                        !isSpecialOfferAvailable
                          ? "opacity-30 cursor-not-allowed bg-slate-900 text-slate-500"
                          : activeType === "special"
                            ? "bg-amber-500 text-black shadow-md"
                            : "text-slate-400 hover:text-slate-200"
                      }`}
                  >
                    <FaStar
                      className={
                        activeType === "special"
                          ? "text-black"
                          : "text-slate-500"
                      }
                    />
                    <span>MTN Special Offers</span>
                    {!isSpecialOfferAvailable && (
                      <span className="absolute -top-2 -right-1 bg-rose-600 text-white text-[8px] font-medium tracking-tight px-1.5 py-0.5 rounded-full uppercase">
                        Out of Stock
                      </span>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Conditional Network Selection */}
              {activeType === "regular" && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-300">
                    Choose Network
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.keys(providersData).map((prov) => (
                      <motion.button
                        key={prov}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={isBusy}
                        onClick={() => {
                          setSelectedProvider(prov);
                          setSelectedBundleSize(prov === "telecel" ? "5" : "1");
                        }}
                        className={`py-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-wider
                          ${
                            selectedProvider === prov
                              ? `${providersData[prov].border} ${providersData[prov].color} ${providersData[prov].text} shadow-md`
                              : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                          }`}
                      >
                        {prov}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditional Data Plan Select Dropdown */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-300">
                  {activeType === "regular"
                    ? "Select Data Plan"
                    : "Select MTN Special Offer Package"}
                </label>
                <div className="relative">
                  {activeType === "regular" ? (
                    <select
                      value={selectedBundleSize}
                      onChange={(e) => setSelectedBundleSize(e.target.value)}
                      disabled={isBusy}
                      className="w-full appearance-none bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    >
                      {providersData[selectedProvider].bundles.map((b) => (
                        <option
                          key={b.gb}
                          value={b.gb}
                          className="bg-slate-950 text-slate-100"
                        >
                          {b.gb}GB — GHS {b.price.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedSpecialId}
                      onChange={(e) => setSelectedSpecialId(e.target.value)}
                      disabled={isBusy}
                      className="w-full appearance-none bg-slate-950 border border-amber-500/30 text-slate-100 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    >
                      {mtnSpecialOffers.map((offer) => (
                        <option
                          key={offer.id}
                          value={offer.id}
                          className="bg-slate-950 text-slate-100"
                        >
                          {offer.name} — GHS{" "}
                          {Number(offer.cost_price).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {activeType === "special" && (
                  <p className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/40 p-2.5 rounded-lg">
                    <strong>Package detail:</strong>{" "}
                    {
                      mtnSpecialOffers.find(
                        (o) => o.id === Number(selectedSpecialId),
                      )?.description
                    }
                  </p>
                )}
              </div>

              {/* Recipient Phone Field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">
                  Recipient Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <FaMobileAlt />
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={recipientPhoneNumber}
                    onChange={handlePhoneInput(
                      setRecipientPhoneNumber,
                      "recipient",
                    )}
                    disabled={isBusy}
                    placeholder="0541234567"
                    className={`w-full bg-slate-950 border text-slate-100 rounded-xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:border-transparent transition-all placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                      fieldErrors.recipient
                        ? "border-rose-600 focus:ring-rose-500"
                        : "border-slate-800 focus:ring-indigo-500"
                    }`}
                    maxLength={10}
                    required
                  />
                </div>
                {fieldErrors.recipient ? (
                  <p className="text-xs text-rose-400">
                    {fieldErrors.recipient}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                    The number that receives the data bundle
                  </p>
                )}
              </div>

              {/* Same-as-recipient shortcut */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsRecipient}
                  disabled={isBusy}
                  onChange={(e) => {
                    setSameAsRecipient(e.target.checked);
                    setFieldErrors((prev) => ({ ...prev, payer: "" }));
                  }}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50"
                />
                <span className="text-sm text-slate-300">
                  This is also my MoMo number
                </span>
              </label>

              {/* Payer Phone Field */}
              <AnimatePresence initial={false}>
                {!sameAsRecipient && (
                  <motion.div
                    key="payer-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label className="text-sm font-semibold text-slate-300">
                      Your MoMo Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <FaMobileAlt />
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={payerPhoneNumber}
                        onChange={handlePhoneInput(
                          setPayerPhoneNumber,
                          "payer",
                        )}
                        disabled={isBusy}
                        placeholder="0541234567"
                        className={`w-full bg-slate-950 border text-slate-100 rounded-xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:border-transparent transition-all placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                          fieldErrors.payer
                            ? "border-rose-600 focus:ring-rose-500"
                            : "border-slate-800 focus:ring-indigo-500"
                        }`}
                        maxLength={10}
                        required={!sameAsRecipient}
                      />
                    </div>
                    {fieldErrors.payer ? (
                      <p className="text-xs text-rose-400">
                        {fieldErrors.payer}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                        The MoMo wallet that gets charged — you'll get a PIN
                        prompt here
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pay Button */}
              <motion.button
                type="submit"
                disabled={isBusy || !activeBundleDetails}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2
                  ${
                    activeType === "special"
                      ? "bg-amber-500 hover:bg-amber-600 text-black disabled:bg-slate-800 disabled:text-slate-600"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-800 disabled:text-slate-600"
                  }`}
              >
                {paymentPhase === "submitting" ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <>Pay GHS {activeBundleDetails?.price?.toFixed(2)}</>
                )}
              </motion.button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium uppercase tracking-tighter">
                <FaShieldAlt className="text-emerald-500" /> Secured by
                TheTeller
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-8 flex flex-col items-center text-center gap-4 min-h-[320px] justify-center"
            >
              {paymentPhase === "sent" && (
                <>
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/40 flex items-center justify-center">
                    <FaMobileAlt className="text-indigo-400 text-2xl" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Approve on Your Phone
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs">
                    {confirmationMessage}
                  </p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={resetPurchase}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
                  >
                    Make Another Purchase
                  </motion.button>
                </>
              )}

              {paymentPhase === "error" && (
                <>
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center">
                    <FaTimesCircle className="text-rose-400 text-2xl" />
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Payment Request Failed
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs">
                    {errorMessage}
                  </p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={resetPurchase}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
                  >
                    Try Again
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
};

export default PurchaseForm;
