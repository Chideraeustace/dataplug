import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../Firebase";
import { FaArrowUp, FaArrowDown, FaHistory, FaWallet, FaSyncAlt } from "react-icons/fa";

const WalletView = ({ agentData }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletHistory();
  }, []);

  const fetchWalletHistory = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, "wallet_history"),
        where("agentId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(data);
    } catch (error) {
      console.error("Error fetching wallet history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Balance Summary Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl">
            <FaWallet />
          </div>
          <div>
            <p className="text-indigo-100 text-sm font-bold uppercase tracking-wider">Current Balance</p>
            <h2 className="text-4xl font-black">GHS {agentData?.walletBalance?.toFixed(2) || "0.00"}</h2>
          </div>
        </div>
        <button 
          onClick={fetchWalletHistory}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95"
        >
          <FaSyncAlt className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FaHistory className="text-indigo-500" /> Recent Transactions
        </h3>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{history.length} Entries</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 w-full bg-gray-100 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : history.length > 0 ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {history.map((tx) => (
              <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Icon Indicator */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
                    tx.type === 'credit' 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : 'bg-rose-50 text-rose-600'
                  }`}>
                    {tx.type === 'credit' ? <FaArrowDown /> : <FaArrowUp />}
                  </div>
                  
                  <div>
                    <p className="font-bold text-gray-900 leading-tight">{tx.description}</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {tx.timestamp?.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-black ${
                    tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {tx.type === 'credit' ? '+' : '-'} GHS {tx.amount?.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter">
                    Bal: GHS {tx.newBalance?.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] p-16 text-center shadow-sm border border-gray-50">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaHistory className="text-gray-200 text-3xl" />
          </div>
          <p className="text-gray-500 font-medium text-lg">No transaction history found.</p>
          <p className="text-gray-400 text-sm">Your financial logs will appear here after your first order.</p>
        </div>
      )}
    </div>
  );
};

export default WalletView;