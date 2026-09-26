import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./Firebase";
import { motion } from "framer-motion";

import Header from "./components/Header";
import StatusMessage from "./components/StatusMessage";
import ActionButtons from "./components/ActionButtons";
import ProviderLogos from "./components/ProviderLogos";
import PurchaseForm from "./components/PurchaseForm";
import CheckDataModal from "./components/CheckDataModal";
import AgentPortalModal from "./components/AgentPortalModal";
import WhatsAppFloat from "./components/WhatsAppFloat";

function App() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [modalType, setModalType] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const openCheckData = () => setModalType("checkData");
  const openAgentPortal = () => setModalType("agentPortal");
  const closeModal = () => setModalType(null);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 relative overflow-x-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-[20%] -right-24 w-96 h-96 bg-indigo-100/30 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-[10%] -left-24 w-96 h-96 bg-emerald-50/30 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Fixed status message */}
      <div className="fixed top-0 left-0 right-0 z-[100] px-4 pointer-events-none">
        <div className="max-w-md mx-auto pt-4 pointer-events-auto">
          <StatusMessage message={statusMessage} />
        </div>
      </div>

      <Header currentUser={currentUser} />

      <main className="max-w-4xl mx-auto px-4 pt-12 pb-24 space-y-12">
        {/* Hero / Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Data & Airtime{" "}
              <span className="text-indigo-600">Simplified.</span>
            </h1>
            <p className="text-slate-500 max-w-lg mx-auto">
              Reliable high-speed data delivery across all major networks. Top
              up your wallet or buy instantly.
            </p>
          </div>
          <ActionButtons
            onCheckData={openCheckData}
            onAgentPortal={openAgentPortal}
          />
        </motion.section>

        {/* Main Purchase Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-10 relative overflow-hidden"
        >
          {/* Subtle Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[5rem] -z-0" />

          <div className="relative z-10">
            <ProviderLogos />
            <div className="mt-10">
              <PurchaseForm setStatusMessage={setStatusMessage} />
            </div>
          </div>
        </motion.div>

        {/* Support & Community Section */}
        
      </main>

      <WhatsAppFloat />

      {/* Modals */}
      <CheckDataModal
        isOpen={modalType === "checkData"}
        onClose={closeModal}
        setStatusMessage={setStatusMessage}
      />

      <AgentPortalModal
        isOpen={modalType === "agentPortal"}
        onClose={closeModal}
        setStatusMessage={setStatusMessage}
        navigate={navigate}
      />
    </div>
  );
}

export default App;
