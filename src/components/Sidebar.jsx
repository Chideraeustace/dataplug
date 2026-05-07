import React from "react";
import { 
  FaHome, 
  FaPlusCircle, 
  FaHistory, 
  FaWallet, 
  FaSignOutAlt, 
  FaTimes,
  FaArrowUp,
  FaCode,
  FaMoneyBillWave
} from "react-icons/fa";

const Sidebar = ({ 
  activeView, 
  setActiveView, 
  isOpen, 
  onLogout, 
  onClose,
  isAgentActivated = false   // Pass true when agent code is activated
}) => {
  const mainMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: <FaHome /> },
    { id: "order", label: "Place Order", icon: <FaPlusCircle /> },
    { id: "myOrders", label: "My Orders", icon: <FaHistory /> },
    { id: "wallet", label: "Wallet", icon: <FaWallet /> },
    { id: "topup", label: "Wallet Top Up", icon: <FaArrowUp /> },
  ];

  const activatedMenuItems = [
    { id: "withdraw", label: "Withdraw Earnings", icon: <FaMoneyBillWave /> },
    { id: "updatePrices", label: "Update Prices", icon: <FaPlusCircle /> },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 bg-slate-900 
          transition-all duration-300 flex flex-col h-screen
          ${isOpen ? "w-72" : "-translate-x-full md:translate-x-0 md:w-64"}`}
      >
        {/* Sidebar Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              R
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Ricky's Agent
            </span>
          </div>

          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white p-2"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-6 px-4 space-y-1.5 overflow-y-auto">
          {/* Main Menu Items (Always Visible) */}
          {mainMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                if (window.innerWidth < 768) onClose();
              }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all text-left
                ${activeView === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}

          {/* Activate Agent Code (Shown only if not activated) */}
          {!isAgentActivated && (
            <button
              onClick={() => {
                setActiveView("activate");
                if (window.innerWidth < 768) onClose();
              }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all text-left mt-6 border border-dashed border-indigo-500
                ${activeView === "activate" 
                  ? "bg-indigo-600 text-white" 
                  : "text-indigo-400 hover:bg-slate-800 hover:text-indigo-300"
                }`}
            >
              <FaCode className="text-xl" />
              <span className="text-sm font-semibold">Activate Agent Code</span>
            </button>
          )}

          {/* Activated Features */}
          {isAgentActivated && (
            <>
              <div className="px-5 py-3 mt-8 text-xs font-medium text-slate-500 uppercase tracking-widest border-t border-slate-700">
                Agent Tools
              </div>
              {activatedMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all text-left
                    ${activeView === item.id 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-4 mt-auto border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-slate-400 hover:bg-slate-800 hover:text-rose-500 transition-all"
          >
            <FaSignOutAlt className="text-xl" />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;