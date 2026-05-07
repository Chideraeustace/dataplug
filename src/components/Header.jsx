import { motion } from "framer-motion";
import { FaWifi } from "react-icons/fa";

const Header = ({ currentUser }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-6 mb-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        <motion.div 
          className="flex items-center gap-3 cursor-default"
          whileHover={{ scale: 1.02 }}
        >
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
            <FaWifi className="text-white text-xl" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Ricky's <span className="text-indigo-600">Data</span>
          </h1>
        </motion.div>
        
        <div className="mt-1 flex items-center gap-2">
          <p className="text-slate-500 text-sm font-medium">
            Easy & Affordable Data Bundles Across Ghana
          </p>
          {currentUser && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              Agent Mode
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;