import React, { useState } from "react";
import Modal from "react-modal";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaUserShield, FaSpinner, FaLock, FaEnvelope, FaTimes, 
  FaUserPlus, FaUser, FaStore, FaWhatsapp, FaEye, FaEyeSlash 
} from "react-icons/fa";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../Firebase";

const AgentPortalModal = ({ isOpen, onClose, setStatusMessage, navigate }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Auth Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Agent Detail Fields
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleForgotPassword = async () => {
    if (!email) {
      setStatusMessage("Please enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setStatusMessage("Password reset link sent to your email!");
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to send reset email. Verify the address.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "dataplug-agents", user.uid), {
          uid: user.uid,
          fullName: fullName || "",
          businessName: businessName || "",
          phoneNumber: phoneNumber || "",
          email: email || user.email,
          role: "agent",
          walletBalance: 0,
          withdrawalBalance: 0,
          isActivated: false,
          agentCode: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setStatusMessage("Agent account registered successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setStatusMessage("Welcome back, Agent!");
      }

      onClose();
      navigate("/agent-portal");
    } catch (err) {
      console.error(err);
      setStatusMessage("Authentication failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false}
      overlayClassName="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      className="bg-white w-full max-w-md rounded-3xl shadow-2xl outline-none overflow-y-auto max-h-[90vh] relative"
    >
      <div className="sticky top-0 h-2 bg-indigo-600 w-full z-10" />

      <div className="p-8">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
          <FaTimes />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl mb-3">
            {isSignUp ? <FaUserPlus size={22} /> : <FaUserShield size={22} />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isSignUp ? "Agent Registration" : "Agent Login"}
          </h2>
        </div>

        {/* Toggle */}
        <div className="bg-slate-100 p-1 rounded-xl flex mb-6">
          <button
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isSignUp ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            }`}
          >
            LOGIN
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isSignUp ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            }`}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                  <div className="relative">
                    <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                {/* Business Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Business Name</label>
                  <div className="relative">
                    <FaStore className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                      placeholder="Ricky's Sub-Agent"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WhatsApp Number</label>
                  <div className="relative">
                    <FaWhatsapp className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                      placeholder="054XXXXXXX"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
            <div className="relative">
              <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                placeholder="agent@email.com"
              />
            </div>
          </div>

          {/* Password with Show/Hide */}
          <div className="space-y-1">
            <div className="flex justify-between items-center pr-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] font-bold text-indigo-600 hover:underline uppercase"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-12 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
              >
                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-4 ${
              isSignUp ? "bg-indigo-600 shadow-indigo-200" : "bg-slate-900 shadow-slate-200"
            }`}
            disabled={loading}
          >
            {loading ? (
              <FaSpinner className="animate-spin" />
            ) : isSignUp ? (
              "Complete Registration"
            ) : (
              "Enter Dashboard"
            )}
          </motion.button>
        </form>
      </div>
    </Modal>
  );
};

export default AgentPortalModal;