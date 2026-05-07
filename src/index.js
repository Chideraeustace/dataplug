import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import AgentPortal from "./AgentPortal";
import ProtectedRoute from "./ProtectedRoute"; // Import the wrapper
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />

        {/* PROTECTED ROUTE */}
        <Route
          path="/agent-portal"
          element={
            <ProtectedRoute>
              <AgentPortal />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

reportWebVitals();
