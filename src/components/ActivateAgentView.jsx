import React, { useState } from "react";

const ActivateAgentView = ({ onActivated }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = () => {
    if (!code) return;
    setLoading(true);
    
    setTimeout(() => {
      onActivated();
      alert("✅ Agent Code Activated Successfully!");
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Activate Agent Code</h2>
      <div className="bg-white rounded-3xl p-8">
        <input
          type="text"
          placeholder="Enter your activation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full p-5 border-2 border-gray-200 rounded-2xl text-center text-lg mb-6 focus:border-indigo-500 outline-none"
        />
        <button 
          onClick={handleActivate}
          disabled={loading || !code}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-50"
        >
          {loading ? "Activating..." : "Activate Agent"}
        </button>
      </div>
    </div>
  );
};

export default ActivateAgentView;