const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-xl`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
    </div>
  </div>
);

export default StatCard;