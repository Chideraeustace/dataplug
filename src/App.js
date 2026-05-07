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
        <section className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-xl font-bold text-slate-800">Support Hub</h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Call Support */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center group transition-all hover:shadow-md"
            >
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Live Assistance
              </h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Need help with a transaction? Our support team is just a call
                away.
              </p>
              <a
                href="tel:0559370174"
                className="w-full py-3 px-6 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
              >
                <span>Call 055 937 0174</span>
              </a>
            </motion.div>

            {/* WhatsApp Community */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-100 flex flex-col items-center text-center group text-white transition-all"
            >
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5">
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.435 5.63 1.436h.008c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Network Updates</h3>
              <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
                Join 500+ agents in our community for instant maintenance
                alerts.
              </p>
              <a
                href="https://chat.whatsapp.com/JtApd4zwqGU4hrGA6d2iv1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-6 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
              >
                <span>Join Community</span>
              </a>
            </motion.div>
          </div>
        </section>
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
