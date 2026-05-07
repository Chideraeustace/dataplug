import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { FaSpinner, FaWifi, FaMobileAlt, FaShieldAlt } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { httpsCallable } from "firebase/functions";
import { functions } from "../Firebase";

const providersData = {
  mtn: { color: "bg-[#FFCC00]", border: "border-[#FFCC00]", text: "text-black", bundles: [{ gb: 1, price: 6.0 }, { gb: 2, price: 12.0 }, { gb: 3, price: 16.0 }, { gb: 4, price: 21.0 }, { gb: 5, price: 26.0 }, { gb: 6, price: 30.0 }, { gb: 8, price: 42.0 }, { gb: 10, price: 47.0 }, { gb: 12, price: 53.0 }, { gb: 15, price: 67.0 }, { gb: 20, price: 87.0 }, { gb: 25, price: 105.0 }, { gb: 30, price: 128.0 }, { gb: 40, price: 168.0 }, { gb: 50, price: 199.0 }] },
  airtel: { color: "bg-[#ED1C24]", border: "border-[#ED1C24]", text: "text-white", bundles: [{ gb: 1, price: 5.0 }, { gb: 2, price: 10.0 }, { gb: 3, price: 15.0 }, { gb: 4, price: 20.0 }, { gb: 5, price: 25.0 }, { gb: 6, price: 30.0 }, { gb: 7, price: 35.0 }, { gb: 8, price: 40.0 }, { gb: 10, price: 45.0 }, { gb: 12, price: 52.0 }, { gb: 15, price: 65.0 }, { gb: 20, price: 83.0 }, { gb: 25, price: 106.0 }] },
  telecel: { color: "bg-[#E60000]", border: "border-[#E60000]", text: "text-white", bundles: [{ gb: 5, price: 25.0 }, { gb: 10, price: 50.0 }, { gb: 15, price: 58.0 }, { gb: 20, price: 85.0 }, { gb: 25, price: 100.0 }, { gb: 30, price: 130.0 }] },
};

const PurchaseForm = ({ setStatusMessage }) => {
  const [selectedProvider, setSelectedProvider] = useState("mtn");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const startMoolrePayment = useMemo(() => httpsCallable(functions, "startMoolrePayment"), []);

  const getSelectedBundle = useMemo(() => {
    return providersData[selectedProvider].bundles.find(
      (bundle) => bundle.gb === Number(selectedBundleSize)
    );
  }, [selectedProvider, selectedBundleSize]);

  const formatPhoneNumber = useCallback((phone) => {
    let formatted = phone.trim();
    if (formatted.startsWith("0") && formatted.length === 10) return `233${formatted.slice(1)}`;
    if (formatted.length === 9) return `233${formatted}`;
    return formatted;
  }, []);

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (!getSelectedBundle || !/^\d{10}$/.test(recipientPhoneNumber)) {
      setStatusMessage("Please enter a valid 10-digit recipient phone number.");
      return;
    }

    setIsPaymentLoading(true);
    const paymentWindow = window.open("", "_blank");

    try {
      const amount = getSelectedBundle.price.toFixed(2);
      const payload = {
        amount,
        email: "customeremail@gmail.com",
        desc: `${getSelectedBundle.gb}GB ${selectedProvider.toUpperCase()} Data Bundle`,
        redirect: window.location.href,
        externalref: uuidv4(),
        metadata: {
          type: "data_bundle",
          provider: selectedProvider.toUpperCase(),
          recipient_number: formatPhoneNumber(recipientPhoneNumber),
        },
      };

      const result = await startMoolrePayment(payload);
      if (result.data.authorization_url) {
        paymentWindow.location.href = result.data.authorization_url;
        setStatusMessage("Redirecting to secure payment page...");
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (err) {
      setStatusMessage("Failed to initiate payment. Please try again.");
      if (paymentWindow) paymentWindow.close();
    } finally {
      setIsPaymentLoading(false);
    }
  };

  return (
    <section className="w-full max-w-lg mx-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl overflow-hidden"
      >
        {/* Header Section */}
        <div className="bg-slate-900 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-500/20 p-2 rounded-lg">
              <FaWifi className="text-indigo-400 text-xl" />
            </div>
            <h2 className="text-xl font-bold">Purchase Bundle</h2>
          </div>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Delivered within 15 mins – 2 hours
          </p>
        </div>

        <form onSubmit={handlePurchase} className="p-6 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">Choose Network</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(providersData).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(prov);
                    setSelectedBundleSize(prov === "telecel" ? "5" : "1");
                  }}
                  className={`py-3 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-wider
                    ${selectedProvider === prov 
                      ? `${providersData[prov].border} ${providersData[prov].color} ${providersData[prov].text} shadow-md` 
                      : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"}`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* Bundle Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">Select Data Plan</label>
            <div className="relative">
              <select
                value={selectedBundleSize}
                onChange={(e) => setSelectedBundleSize(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                {providersData[selectedProvider].bundles.map((b) => (
                  <option key={b.gb} value={b.gb}>
                    {b.gb}GB — GHS {b.price.toFixed(2)}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {/* Recipient Phone */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">Recipient Number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <FaMobileAlt />
              </span>
              <input
                type="tel"
                value={recipientPhoneNumber}
                onChange={(e) => setRecipientPhoneNumber(e.target.value)}
                placeholder="054 123 4567"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                pattern="[0-9]{10}"
                maxLength={10}
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Must be a 10-digit Ghana number</p>
          </div>

          {/* Pay Button */}
          <motion.button
            type="submit"
            disabled={isPaymentLoading || !getSelectedBundle}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            {isPaymentLoading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <>Pay GHS {getSelectedBundle?.price?.toFixed(2)}</>
            )}
          </motion.button>
          
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium uppercase tracking-tighter">
            <FaShieldAlt className="text-green-500" /> Secured by Moolre Gateway
          </div>
        </form>
      </motion.div>
    </section>
  );
};

export default PurchaseForm;