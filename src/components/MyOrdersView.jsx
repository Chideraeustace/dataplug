import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "../Firebase";
import { FaSearch, FaRedoAlt, FaMobileAlt, FaRegClock,FaShoppingCart } from "react-icons/fa";

const MyOrdersView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, "webite_purchase"),
        where("agentId", "==", user.uid),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders based on search (phone number or ID)
  const filteredOrders = orders.filter((order) =>
    order.recipientNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "success": return "bg-emerald-100 text-emerald-700";
      case "failed": return "bg-red-100 text-red-700";
      case "processing": return "bg-blue-100 text-blue-700";
      default: return "bg-amber-100 text-amber-700"; // pending
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Order History</h2>
          <p className="text-gray-500 font-medium">Track and manage your data deliveries.</p>
        </div>

        <button 
          onClick={fetchOrders}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-indigo-600 font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <FaRedoAlt className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Search by phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4 bg-white rounded-3xl border-none shadow-sm focus:ring-2 focus:ring-indigo-100 outline-none font-medium text-gray-700 transition-all"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 w-full bg-gray-100 animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="bg-white p-5 rounded-3xl border border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-5">
                {/* Network Indicator */}
                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-[10px] ${
                  order.provider?.toLowerCase() === 'mtn' ? 'bg-yellow-400 text-black' : 
                  order.provider?.toLowerCase() === 'telecel' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  <span className="leading-none tracking-tighter uppercase">{order.provider}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-gray-900 text-lg">{order.recipientNumber}</p>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                      {order.status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 font-bold">
                    <span className="flex items-center gap-1 uppercase"><FaMobileAlt /> {order.size || order.gb + 'GB'}</span>
                    <span className="flex items-center gap-1 uppercase"><FaRegClock /> {order.timestamp?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:text-right border-t sm:border-none pt-3 sm:pt-0">
                <div className="sm:hidden text-xs text-gray-400 font-bold">Amount Paid</div>
                <div>
                  <p className="text-xl font-black text-gray-900">GHS {order.amount?.toFixed(2)}</p>
                  <p className="text-[9px] text-gray-400 font-mono tracking-tighter uppercase">ID: {order.id.substring(0, 12)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[40px] p-20 text-center shadow-sm border border-gray-50">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300 text-3xl">
            <FaShoppingCart />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500 max-w-xs mx-auto mb-8 font-medium">
            {searchTerm ? "We couldn't find any orders matching that number." : "Start placing orders to build your history!"}
          </p>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="text-indigo-600 font-bold hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MyOrdersView;