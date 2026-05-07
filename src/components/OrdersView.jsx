import { FaFilter } from "react-icons/fa";

const OrdersView = ({ orders, dateFilter, setDateFilter }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold">Order History</h2>
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <FaFilter className="text-slate-400 text-xs" />
        <input 
          type="date" 
          className="text-sm outline-none bg-transparent" 
          value={dateFilter} 
          onChange={(e) => setDateFilter(e.target.value)} 
        />
      </div>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
          <tr>
            <th className="px-6 py-4">Date</th>
            <th className="px-6 py-4">Recipient</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map(order => (
            <tr key={order.id} className="text-sm hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 text-slate-500">
                {new Date(order.timestamp?.seconds * 1000).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 font-bold">{order.recipientNumber}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {order.status}
                </span>
              </td>
              <td className="px-6 py-4 text-right font-bold text-indigo-600">GHS {order.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default OrdersView;