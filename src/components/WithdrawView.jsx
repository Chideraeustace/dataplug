import React from "react";

const WithdrawView = () => {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Withdraw Earnings</h2>
      <div className="bg-white rounded-3xl p-10 text-center">
        <p className="text-lg mb-6">Minimum withdrawal: GHS 200</p>
        <button className="bg-emerald-600 text-white px-12 py-4 rounded-2xl text-lg font-semibold w-full">
          Request Withdrawal
        </button>
      </div>
    </div>
  );
};

export default WithdrawView;