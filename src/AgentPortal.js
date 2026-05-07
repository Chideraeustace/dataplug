import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./Firebase";
import { doc, getDoc } from "firebase/firestore";
import { AnimatePresence } from "framer-motion";
import { FaBars, FaTimes } from "react-icons/fa";

// Import All View Components
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import PlaceOrderView from "./components/PlaceOrderView";
import MyOrdersView from "./components/MyOrdersView";
import WalletView from "./components/WalletView";
import WalletTopUpView from "./components/WalletTopUpView";
import ActivateAgentView from "./components/ActivateAgentView";
import WithdrawView from "./components/WithdrawView";
import UpdatePricesView from "./components/UpdatePricesView";

const AgentPortal = ({ setStatusMessage }) => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAgentActivated, setIsAgentActivated] = useState(false); // Control activation

  useEffect(() => {
    fetchAgentData();
  }, []);

  const fetchAgentData = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      const agentDoc = await getDoc(doc(db, "dataplug-agents", user.uid));

      if (agentDoc.exists()) {
        const data = agentDoc.data();
        setAgentData(data);
        setIsAgentActivated(data.isActivated || false);
      }
    } catch (error) {
      console.error("Error fetching agent data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Agent Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOpen={isSidebarOpen}
        onLogout={handleLogout}
        onClose={() => setIsSidebarOpen(false)}
        isAgentActivated={isAgentActivated}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-4 py-4 flex items-center justify-between md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {isSidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 capitalize">
              {activeView.replace(/([A-Z])/g, " $1")}
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium">{agentData?.fullName || "Agent"}</p>
              <p className="text-xs text-gray-500">Agent Account</p>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeView === "dashboard" && (
              <DashboardView agentData={agentData} />
            )}
            {activeView === "order" && (
              <PlaceOrderView setStatusMessage={setStatusMessage} />
            )}
            {activeView === "myOrders" && <MyOrdersView />}
            {activeView === "wallet" && <WalletView agentData={agentData} />}
            {activeView === "topup" && <WalletTopUpView />}
            {activeView === "activate" && (
              <ActivateAgentView
                onActivated={() => setIsAgentActivated(true)}
              />
            )}
            {activeView === "withdraw" && <WithdrawView />}
            {activeView === "updatePrices" && <UpdatePricesView />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AgentPortal;
