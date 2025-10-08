import React, { useEffect, useMemo, useState } from "react";

const ThetellerPayment = () => {
  // State for phone number and bundle selection
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bundle, setBundle] = useState("Basic - 40 GHS"); // Default to first bundle
  const [scriptError, setScriptError] = useState(null);

  // Available bundle packages
  const bundles = [
    {
      name: "Basic - 40 GHS",
      amount: "40",
      description: "Basic Bundle - 40 GHS",
    },
    {
      name: "Standard - 100 GHS",
      amount: "100",
      description: "Standard Bundle - 100 GHS",
    },
    {
      name: "Premium - 200 GHS",
      amount: "200",
      description: "Premium Bundle - 200 GHS",
    },
  ];

  // Load Theteller script dynamically when bundle changes
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://checkout-test.theteller.net/resource/api/inline/theteller_inline.js"; // Use live URL in production
    script.async = true;
    script.onload = () => {
      console.log("Theteller script loaded successfully");
    };
    script.onerror = () => {
      setScriptError(
        "Failed to load Theteller script. Please try again later."
      );
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [bundle]); // Reload script when bundle changes

  // Generate unique transaction ID
  const generateTransId = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0].toString().padStart(12, "0").slice(0, 12);
  };
  const transId = useMemo(generateTransId, []);

  // Get selected bundle details
  const selectedBundle = bundles.find((b) => b.name === bundle) || bundles[0];

  // Validate phone number and bundle selection
  const isFormValid = phoneNumber.trim() !== "" && bundle !== "";

  return (
    <div style={{ textAlign: "center", marginTop: "40px" }}>
      <h2>Pay with Theteller</h2>
      {scriptError && (
        <p style={{ color: "red", marginBottom: "10px" }}>{scriptError}</p>
      )}
      <div style={{ marginBottom: "20px" }}>
        <label
          htmlFor="phoneNumber"
          style={{ display: "block", marginBottom: "10px" }}
        >
          Phone Number:
        </label>
        <input
          type="tel"
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter your phone number"
          style={{ padding: "8px", width: "200px", marginBottom: "20px" }}
          required
        />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label
          htmlFor="bundle"
          style={{ display: "block", marginBottom: "10px" }}
        >
          Select Bundle:
        </label>
        <select
          id="bundle"
          value={bundle}
          onChange={(e) => setBundle(e.target.value)}
          style={{ padding: "8px", width: "200px" }}
          required
        >
          {bundles.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {!isFormValid && (
        <p style={{ color: "red", marginBottom: "10px" }}>
          Please enter a phone number to enable payment.
        </p>
      )}
      <a
        className="ttlr_inline"
        data-apikey="NmY4NGNkNzFhMDk5ZWI3MmNiNmFlYWIzMzYxMTlhOTY=" // Replace with your real key
        data-transid={transId}
        data-amount={selectedBundle.amount} // Dynamic amount based on bundle
        data-customer_email="customer@example.com"
        data-customer_phone={phoneNumber} // Use entered phone number
        data-currency="GHS"
        data-redirect_url="https://yourwebsite.com/payment-success"
        data-pay_button_text="Pay Now"
        data-custom_description={selectedBundle.description} // Dynamic description
        data-payment_method="both" // can be 'card', 'momo', or 'both'
        style={{
          display: "inline-block",
          padding: "10px 20px",
          backgroundColor: isFormValid ? "#28a745" : "#ccc",
          color: "white",
          textDecoration: "none",
          borderRadius: "5px",
          cursor: isFormValid ? "pointer" : "not-allowed",
          opacity: isFormValid ? 1 : 0.5,
        }}
        title={
          isFormValid ? "Proceed to payment" : "Please complete all fields"
        }
      >
        Pay Now
      </a>
    </div>
  );
};

export default ThetellerPayment;
