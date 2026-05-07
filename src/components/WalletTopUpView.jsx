import React, { useState } from "react";
import { FaMoneyBillWave, FaArrowRight, FaSpinner, FaShieldAlt } from "react-icons/fa";
import { auth } from "../Firebase";
import axios from "axios";

const WalletTopUpView = () => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) < 1) {
      setError("Minimum top-up is GHS 1.00");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const user = auth.currentUser;
      const idToken = await user.getIdToken();

      const response = await axios.post(
        "https://us-central1-eustech-c4332.cloudfunctions.net/initializeAgentPayment",
        { amount: parseFloat(amount), email: user.email },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      }
    } catch (err) {
      setError("Could not connect to payment gateway. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl">
          <FaMoneyBillWave />
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 mb-2">Fund Your Wallet</h2>
        <p className="text-gray-500 text-sm mb-8 font-medium">Enter amount to add to your balance</p>

        <div className="relative mb-6">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400">GHS</span>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-emerald-500 focus:bg-white outline-none text-2xl font-black transition-all"
          />
        </div>

        {error && <p className="text-rose-500 text-xs font-bold mb-4">{error}</p>}

        <button
          onClick={handleTopUp}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-100"
        >
          {loading ? <FaSpinner className="animate-spin" /> : <>Pay Now <FaArrowRight /></>}
        </button>

        <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
          <FaShieldAlt className="text-emerald-500" />
          Secured by Moolre Checkout
        </div>
      </div>
    </div>
  );
};

export default WalletTopUpView;