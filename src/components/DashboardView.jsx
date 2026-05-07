import React, { useState, useEffect } from "react";
import { 
  FaWallet, 
  FaChartBar, 
  FaShoppingCart, 
  FaMoneyBillWave, 
  FaUserShield, 
  FaClock 
} from "react-icons/fa";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "../Firebase";
import StatCard from "./StatCard";

const DashboardView = ({ agentData }) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    todayEarnings: 0,
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
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
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let totalSales = 0;
      let todayEarnings = 0;
      const today = new Date().toISOString().split("T")[0];

      orders.forEach(order => {
        totalSales += order.amount || 0;
        if (order.timestamp) {
          const orderDate = new Date(order.timestamp.seconds * 1000)
            .toISOString()
            .split("T")[0];
          if (orderDate === today) {
            todayEarnings += order.amount || 0;
          }
        }
      });

      setStats({
        totalSales,
        totalOrders: orders.length,
        todayEarnings,
        recentOrders: orders.slice(0, 5), // Keep the last 5 for a "Recent Activity" list
      });
    } catch (error) {
      console.error("Dashboard Stats Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const isActivated = agentData?.isActivated === true;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Hello, {agentData?.fullName?.split(" ")[0] || "Agent"}! 
          </h1>
          <p className="text-gray-500 font-medium">Here's what's happening with your business today.</p>
        </div>
        
        {/* Activation Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all ${
          isActivated 
          ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
          : "bg-amber-50 border-amber-100 text-amber-700 animate-pulse"
        }`}>
          <FaUserShield />
          <span className="text-sm font-bold uppercase tracking-wider">
            {isActivated ? "Fully Activated" : " USSD Activation Pending"}
          </span>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="Available Balance"
          value={`GHS ${agentData?.walletBalance?.toFixed(2) || "0.00"}`}
          icon={<FaWallet className="text-2xl" />}
          color="bg-white border-b-4 border-emerald-500 shadow-sm"
          textColor="text-emerald-600"
        />
        <StatCard
          label="Total Sales (Lifetime)"
          value={`GHS ${stats.totalSales.toFixed(2)}`}
          icon={<FaChartBar className="text-2xl" />}
          color="bg-white border-b-4 border-indigo-500 shadow-sm"
          textColor="text-indigo-600"
        />
        <StatCard
          label="Completed Orders"
          value={stats.totalOrders}
          icon={<FaShoppingCart className="text-2xl" />}
          color="bg-white border-b-4 border-purple-500 shadow-sm"
          textColor="text-purple-600"
        />
      </div>

      {/* Secondary / Action Stats */}
      {isActivated && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-3xl text-white shadow-lg shadow-orange-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 font-bold uppercase text-xs tracking-widest mb-1">Today's Earnings</p>
                <h3 className="text-4xl font-black">GHS {stats.todayEarnings.toFixed(2)}</h3>
              </div>
              <FaMoneyBillWave className="text-3xl opacity-40" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-teal-100 font-bold uppercase text-xs tracking-widest mb-1">Withdrawable</p>
                <h3 className="text-4xl font-black">GHS {agentData?.withdrawalBalance?.toFixed(2) || "0.00"}</h3>
              </div>
              <FaWallet className="text-3xl opacity-40" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity List */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FaClock className="text-gray-400" /> Recent Orders
            </h3>
            <button className="text-indigo-600 font-bold text-sm hover:underline">View All</button>
          </div>
          
          <div className="space-y-4">
            {stats.recentOrders.length > 0 ? (
              stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-xs font-black text-indigo-600">{order.provider?.substring(0,1)}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{order.recipientNumber}</p>
                      <p className="text-xs text-gray-400">{order.size || 'Data Bundle'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm">GHS {order.amount}</p>
                    <p className={`text-[10px] font-bold uppercase ${
                      order.status === 'success' ? 'text-emerald-500' : 'text-amber-500'
                    }`}>
                      {order.status || 'Pending'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-400 italic">No orders found yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action / Help Card */}
        <div className="bg-indigo-900 rounded-3xl p-8 text-white flex flex-col justify-between overflow-hidden relative">
            <div className="relative z-10">
                <h4 className="text-xl font-bold mb-2">Need Help?</h4>
                <p className="text-indigo-200 text-sm mb-6">Having trouble with a transaction? Our support team is here for you 24/7.</p>
                <button className="bg-white text-indigo-900 px-6 py-3 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-transform">
                    Contact Support
                </button>
            </div>
            {/* Abstract Background Shape */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-800 rounded-full blur-3xl opacity-50"></div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;