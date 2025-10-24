import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import AgentPortal from "./AgentPortal";
import CustomerPurchase from "./CustomerPurchase"; // Import the new CustomerPurchase component
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/agent-portal" element={<AgentPortal />} />
        <Route
          path="/customer-purchase/:agentId"
          element={<CustomerPurchase />}
        />{" "}
        {/* Added new route */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
