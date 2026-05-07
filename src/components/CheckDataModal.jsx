import React, { useState } from "react";
import Modal from "react-modal";
import { motion } from "framer-motion";
import { FaSearch, FaSpinner, FaTimes } from "react-icons/fa";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../Firebase";
import { formatPhoneNumber } from "../formatPhone";

const CheckDataModal = ({ isOpen, onClose, setStatusMessage }) => {
  const [dataPhoneNumber, setDataPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckData = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(dataPhoneNumber)) {
      setStatusMessage("Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    const phone = formatPhoneNumber(dataPhoneNumber);

    try {
      const q = query(collection(db, "webite_purchase"), where("recipientNumber", "==", phone));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setStatusMessage(`No purchase found for ${dataPhoneNumber}`);
      } else {
        const docData = snapshot.docs[0].data();
        let message = docData.status === "approved" 
          ? (docData.exported ? "Data has been processed and will be delivered shortly!" : "Payment successful! Pending processing.")
          : `Current Status: ${docData.status}`;
        setStatusMessage(message);
      }
    } catch (err) {
      setStatusMessage("Error checking status. Please try again.");
    } finally {
      setLoading(false);
      onClose();
      setDataPhoneNumber("");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      closeTimeoutMS={200}
      ariaHideApp={false}
      overlayClassName="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      className="bg-white w-full max-w-md rounded-3xl shadow-2xl outline-none overflow-hidden"
    >
      <div className="relative p-8">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <FaTimes size={18} />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
            <FaSearch size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Check Status</h2>
          <p className="text-slate-500 text-sm mt-1">Enter the recipient number to track delivery</p>
        </div>

        <form onSubmit={handleCheckData} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 ml-1">Recipient Number</label>
            <input
              type="tel"
              value={dataPhoneNumber}
              onChange={(e) => setDataPhoneNumber(e.target.value)}
              placeholder="054 123 4567"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              maxLength={10}
              required
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              "Check Status Now"
            )}
          </motion.button>
        </form>
        
        <button 
          onClick={onClose} 
          className="w-full mt-4 py-2 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
        >
          Nevermind, go back
        </button>
      </div>
    </Modal>
  );
};

export default CheckDataModal;