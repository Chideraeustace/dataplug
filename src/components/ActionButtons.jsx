import { motion } from "framer-motion";
import { FaSearch, FaUserShield } from "react-icons/fa";

const ActionButtons = ({ onCheckData, onAgentPortal }) => {
  const handleAction = (fn) => {
    document.activeElement?.blur();
    fn();
  };

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.button
          onClick={() => handleAction(onCheckData)}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          className="group flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all text-left"
        >
          <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <FaSearch size={20} />
          </div>
          <div>
            <span className="block font-bold text-slate-900">Check Status</span>
            <span className="block text-xs text-slate-500">Track your bundle delivery</span>
          </div>
        </motion.button>

        <motion.button
          onClick={() => handleAction(onAgentPortal)}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          className="group flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:shadow-lg transition-all text-left"
        >
          <div className="bg-white/10 text-white p-4 rounded-xl group-hover:bg-white group-hover:text-slate-900 transition-colors">
            <FaUserShield size={20} />
          </div>
          <div>
            <span className="block font-bold text-white">Agent Portal</span>
            <span className="block text-xs text-slate-400">Manage orders & earn money</span>
          </div>
        </motion.button>
      </div>
    </section>
  );
};

export default ActionButtons;