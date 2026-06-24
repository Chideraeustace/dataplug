import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { FaSpinner, FaWifi, FaMobileAlt, FaShieldAlt, FaStar } from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { httpsCallable } from "firebase/functions";
import { functions } from "../Firebase";

// Static regular bundles data
const providersData = {
  mtn: { color: "bg-[#FFCC00]", border: "border-[#FFCC00]", text: "text-black", bundles: [{ gb: 1, price: 5.3 }, { gb: 2, price: 11.0 }, { gb: 3, price: 16.0 }, { gb: 4, price: 20.0 }, { gb: 5, price: 25.0 }, { gb: 6, price: 30.0 }, { gb: 8, price: 40.0 }, { gb: 10, price: 46.0 }, { gb: 12, price: 54.0 }, { gb: 15, price: 66.0 }, { gb: 20, price: 86.0 }, { gb: 25, price: 105.0 }, { gb: 30, price: 125.0 }, { gb: 40, price: 165.0 }, { gb: 50, price: 199.0 }] },
  airtel: { color: "bg-[#ED1C24]", border: "border-[#ED1C24]", text: "text-white", bundles: [{ gb: 1, price: 4.5 }, { gb: 2, price: 9.5 }, { gb: 3, price: 14.0 }, { gb: 4, price: 19.0 }, { gb: 5, price: 24.0 }, { gb: 6, price: 39.0 }, { gb: 7, price: 33.0 }, { gb: 8, price: 38.0 }, { gb: 10, price: 45.0 }, { gb: 9, price: 40.0 }, { gb: 15, price: 65.0 }, { gb: 20, price: 85.0 }] },
  telecel: { color: "bg-[#E60000]", border: "border-[#E60000]", text: "text-white", bundles: [{ gb: 5, price: 25.0 }, { gb: 10, price: 45.0 }, { gb: 15, price: 60.0 }, { gb: 20, price: 85.0 }, { gb: 25, price: 100.0 }, { gb: 30, price: 120.0 }] },
};

// MTN Special Offers JSON
const mtnSpecialOffers = [
  { id: 24, special_offer_package_id: 24, slug: "1.7gb", name: "1.7 GB", description: "Single MashUp cycle — 1746.92MB Only", cost_price: "6" },
  { id: 26, special_offer_package_id: 26, slug: "2.6gb-mins", name: "2.6 GB + 1,077 mins", description: "Three 873.46MB bundle cycles — approx 2.6 GB + mins", cost_price: "18" },
  { id: 34, special_offer_package_id: 34, slug: "3.4gb", name: "3.4 GB", description: "Two MashUp cycles on 1.7 GB base — approx 3.4 GB", cost_price: "11" },
  { id: 25, special_offer_package_id: 25, slug: "5.1gb-12", name: "5.1 GB", description: "Three 1.7 GB MashUp cycles — approx 5.1 GB", cost_price: "20" },
  { id: 27, special_offer_package_id: 27, slug: "7.2gb-15", name: "7.2 GB", description: "Four 1806.56MB bundle cycles — approx 7.2 GB", cost_price: "25" },
  { id: 31, special_offer_package_id: 31, slug: "10.2gb", name: "10.2 GB", description: "Six MashUp cycles on 1.7 GB base — approx 10.2 GB", cost_price: "30" }
];

const PurchaseForm = ({ setStatusMessage }) => {
  // --- CONTROL FLAG FOR STOCK ---
  // Change this to false (or tie it to real remote config/props) to disable the special offers
  const isSpecialOfferAvailable = false; // Change to false when out of stock

  const [purchaseType, setPurchaseType] = useState("regular"); // "regular" or "special"
  const [selectedProvider, setSelectedProvider] = useState("mtn");
  const [selectedBundleSize, setSelectedBundleSize] = useState("1");
  const [selectedSpecialId, setSelectedSpecialId] = useState(mtnSpecialOffers[0].id.toString());
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState("");
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  const startMoolrePayment = useMemo(() => httpsCallable(functions, "startMoolrePayment"), []);

  // Safe fallback guard: if Special offers are turned off but user is somehow on 'special', fall back to 'regular'
  const activeType = isSpecialOfferAvailable ? purchaseType : "regular";

  // Compute active item details dynamically
  const activeBundleDetails = useMemo(() => {
    if (activeType === "regular") {
      const bundle = providersData[selectedProvider].bundles.find(
        (b) => b.gb === Number(selectedBundleSize)
      );
      return bundle ? { price: bundle.price, desc: `${bundle.gb}GB ${selectedProvider.toUpperCase()} Data Bundle`, meta: { type: "data_bundle", provider: selectedProvider.toUpperCase() } } : null;
    } else {
      const offer = mtnSpecialOffers.find((o) => o.id === Number(selectedSpecialId));
      return offer ? { price: Number(offer.cost_price), desc: `MTN Special: ${offer.name} (${offer.description})`, meta: { type: "special_offer", provider: "MTN", package_id: offer.id, slug: offer.slug } } : null;
    }
  }, [activeType, selectedProvider, selectedBundleSize, selectedSpecialId]);

  const formatPhoneNumber = useCallback((phone) => {
    let formatted = phone.trim();
    if (formatted.startsWith("0") && formatted.length === 10) return `233${formatted.slice(1)}`;
    if (formatted.length === 9) return `233${formatted}`;
    return formatted;
  }, []);

  const handlePurchase = async (e) => {
    e.preventDefault();
    if (!activeBundleDetails || !/^\d{10}$/.test(recipientPhoneNumber)) {
      setStatusMessage("Please check your selections and enter a valid 10-digit number.");
      return;
    }

    setIsPaymentLoading(true);
    const paymentWindow = window.open("", "_blank");

    try {
      const payload = {
        amount: activeBundleDetails.price.toFixed(2),
        email: "customeremail@gmail.com",
        desc: activeBundleDetails.desc,
        redirect: window.location.href,
        externalref: uuidv4(),
        metadata: {
          ...activeBundleDetails.meta,
          recipient_number: formatPhoneNumber(recipientPhoneNumber),
        },
      };

      const result = await startMoolrePayment(payload);
      if (result.data?.authorization_url) {
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
        className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100"
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
            Dear Customer, kindly hold on with purchasing of data bundles as we are currently experiencing a temporary outage. We apologize for the inconvenience and appreciate your patience. Our team is actively working to resolve the issue, and we will notify you once the service is restored. Thank you for your understanding.
          </p>
        </div>

        <form onSubmit={handlePurchase} className="p-6 space-y-6">
          
          {/* Service Category Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">Select Offer Type</label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setPurchaseType("regular");
                  setSelectedProvider("mtn");
                  setSelectedBundleSize("1");
                }}
                className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeType === "regular" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Regular Bundles
              </button>
              
              <button
                type="button"
                disabled={!isSpecialOfferAvailable}
                onClick={() => {
                  setPurchaseType("special");
                  setSelectedProvider("mtn");
                }}
                className={`py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 relative
                  ${!isSpecialOfferAvailable 
                    ? "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400" 
                    : activeType === "special" 
                      ? "bg-white text-amber-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"}`}
              >
                <FaStar className={activeType === "special" ? "text-amber-500" : "text-slate-400"} />
                <span>MTN Special Offers</span>
                {!isSpecialOfferAvailable && (
                  <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[8px] font-medium tracking-tight px-1.5 py-0.5 rounded-full scale-90 uppercase">
                    Out of Stock
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Conditional Network Selection */}
          {activeType === "regular" && (
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
          )}

          {/* Conditional Data Plan Select Dropdown */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">
              {activeType === "regular" ? "Select Data Plan" : "Select MTN Special Offer Package"}
            </label>
            <div className="relative">
              {activeType === "regular" ? (
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
              ) : (
                <select
                  value={selectedSpecialId}
                  onChange={(e) => setSelectedSpecialId(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-amber-300 rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                  required
                >
                  {mtnSpecialOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name} — GHS {Number(offer.cost_price).toFixed(2)}
                    </option>
                  ))}
                </select>
              )}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            
            {activeType === "special" && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-2.5 rounded-lg">
                <strong>Package detail:</strong> {mtnSpecialOffers.find(o => o.id === Number(selectedSpecialId))?.description}
              </p>
            )}
          </div>

          {/* Recipient Phone Field */}
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
            disabled={isPaymentLoading || !activeBundleDetails}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-white
              ${activeType === "special" 
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100 disabled:bg-slate-300" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 disabled:bg-slate-300"}`}
          >
            {isPaymentLoading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <>Pay GHS {activeBundleDetails?.price?.toFixed(2)}</>
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