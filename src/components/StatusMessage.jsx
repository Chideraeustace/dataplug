import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa";

const StatusMessage = ({ message, type = "info", onClose }) => {
  // Config for different status types
  const statusConfig = {
    success: { icon: <FaCheckCircle />, color: "bg-emerald-500", border: "border-emerald-600" },
    error: { icon: <FaExclamationCircle />, color: "bg-rose-500", border: "border-rose-600" },
    info: { icon: <FaInfoCircle />, color: "bg-indigo-600", border: "border-indigo-700" },
  };

  const config = statusConfig[type] || statusConfig.info;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          layout
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className="fixed top-6 right-6 z-[9999] pointer-events-none"
        >
          <div className={`
            ${config.color} text-white px-6 py-4 rounded-2xl shadow-2xl 
            flex items-center gap-4 border-b-4 ${config.border}
            min-w-[300px] max-w-md pointer-events-auto relative overflow-hidden
          `}>
            {/* Icon */}
            <span className="text-xl opacity-90">
              {config.icon}
            </span>

            {/* Message */}
            <div className="flex-1">
              <p className="text-sm font-bold tracking-wide leading-tight">
                {message}
              </p>
            </div>

            {/* Close Button */}
            {onClose && (
              <button 
                onClick={onClose}
                className="hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <FaTimes size={14} />
              </button>
            )}

            {/* Animated Progress Bar (Optional) */}
            <motion.div 
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusMessage;