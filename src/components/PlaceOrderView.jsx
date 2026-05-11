import React, { useState, useEffect, useCallback } from "react";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs 
} from "firebase/firestore";
import { db, auth } from "../Firebase";

const PlaceOrderView = () => {
  // --- State Management ---
  const [bundles, setBundles] = useState({ option1: [], option2: [], option3: [] });
  const [selectedProvider, setSelectedProvider] = useState("mtn");
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentData, setAgentData] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });

  // --- Helper: Fetch Agent Profile & Wallet ---
  const fetchAgentData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const agentDoc = await getDoc(doc(db, "dataplug-agents", user.uid));
      if (agentDoc.exists()) {
        setAgentData(agentDoc.data());
      }
    } catch (err) {
      console.error("Error fetching agent balance:", err);
    }
  }, []);

  // --- Helper: Fetch Bundles based on Network ---
  const fetchBundles = useCallback(async (network) => {
    setLoading(true);
    try {
      const result = { option1: [], option2: [], option3: [] };
      const periods = [
        { subcoll: "daily", key: "option1" },
        { subcoll: "weekly", key: "option2" },
        { subcoll: "monthly", key: "option3" },
      ];

      for (const { subcoll, key } of periods) {
        const subcollRef = collection(db, "dp-bundles", network, subcoll);
        const q = query(subcollRef, where("active", "==", true), orderBy("price", "asc"));
        const snap = await getDocs(q);
        
        result[key] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      setBundles(result);
      setSelectedBundle(null); // Clear selection when network changes
    } catch (err) {
      console.error("Error loading bundles:", err);
      showStatus("Failed to load packages", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Internal Status Handler ---
  const showStatus = (text, type = "info") => {
    setStatusMessage({ text, type });
    // Auto-clear message after 5 seconds
    setTimeout(() => setStatusMessage({ text: "", type: "" }), 5000);
  };

  // --- Lifecycle: Load initial data ---
  useEffect(() => {
    fetchBundles(selectedProvider);
    fetchAgentData();
  }, [selectedProvider, fetchBundles, fetchAgentData]);

  // --- Action: Place Order ---
  const handlePlaceOrder = async () => {
    const user = auth.currentUser;
    
    if (!selectedBundle || !recipientPhone) {
      showStatus("Please fill all fields", "error");
      return;
    }

    if (!user) {
      showStatus("You must be logged in", "error");
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      // Calling your Google Cloud Function
      const response = await fetch("https://us-central1-eustech-c4332.cloudfunctions.net/placeOrder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          agentId: user.uid,
          recipient: recipientPhone,
          network: selectedProvider,
          bundleId: selectedBundle.id,
          price: selectedBundle.price,
          size: selectedBundle.size // This is "1GB", "2GB", etc.
        })
      });

      const data = await response.json();

      if (response.ok) {
        showStatus("Order successful! Data delivered.", "success");
        setRecipientPhone("");
        setSelectedBundle(null);
        fetchAgentData(); // Refresh wallet balance
      } else {
        showStatus(data.message || "Transaction failed", "error");
      }
    } catch (error) {
      console.error(error);
      showStatus("Network error. Check connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 font-sans">
      
      {/* Status Notification */}
      {statusMessage.text && (
        <div className={`mb-4 p-4 rounded-2xl text-sm font-bold animate-bounce ${
          statusMessage.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-50">
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Data Plug</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Plan</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Wallet</span>
            <p className="text-xl font-bold text-indigo-600">
              GHS {agentData?.walletBalance?.toFixed(2) || "0.00"}
            </p>
          </div>
        </div>

        {/* Network Selector */}
        <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
          {["mtn", "tigo", "telecel"].map((net) => (
            <button
              key={net}
              onClick={() => setSelectedProvider(net)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                selectedProvider === net 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {net}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {/* Recipient Input */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Recipient Number</label>
            <input
              type="tel"
              placeholder="0541234567"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none transition-all font-semibold text-lg"
            />
          </div>

          {/* Bundle Dropdown */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">Bundle Package</label>
            <div className="relative">
              <select
                value={selectedBundle?.id || ""}
                onChange={(e) => {
                  const all = [...bundles.option1, ...bundles.option2, ...bundles.option3];
                  const found = all.find(b => b.id === e.target.value);
                  setSelectedBundle(found);
                }}
                className="w-full p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none transition-all font-semibold appearance-none cursor-pointer"
              >
                <option value="" disabled>Select a bundle...</option>
                
                {bundles.option1.length > 0 && (
                  <optgroup label="Daily Packages">
                    {bundles.option1.map(b => (
                      <option key={b.id} value={b.id}>{b.size} - GHS {b.price}</option>
                    ))}
                  </optgroup>
                )}

                {bundles.option2.length > 0 && (
                  <optgroup label="Weekly Packages">
                    {bundles.option2.map(b => (
                      <option key={b.id} value={b.id}>{b.size} - GHS {b.price}</option>
                    ))}
                  </optgroup>
                )}

                {bundles.option3.length > 0 && (
                  <optgroup label="Monthly Packages">
                    {bundles.option3.map(b => (
                      <option key={b.id} value={b.id}>{b.size} - GHS {b.price}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {/* Custom Arrow */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                ▼
              </div>
            </div>
          </div>

          {/* Order Summary */}
          {selectedBundle && (
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center animate-in fade-in zoom-in duration-300">
              <div className="text-indigo-900 font-bold">{selectedBundle.name}</div>
              <div className="text-indigo-600 font-black">GHS {selectedBundle.price}</div>
            </div>
          )}

          {/* Action Button */}
          <button
            disabled={loading || !selectedBundle || !recipientPhone}
            onClick={handlePlaceOrder}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:bg-gray-200 disabled:shadow-none disabled:text-gray-400 active:scale-95"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </div>
            ) : (
              `Buy ${selectedBundle?.size || ""} Package`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceOrderView;