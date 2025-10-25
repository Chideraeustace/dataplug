import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaUserEdit, FaArrowLeft } from "react-icons/fa";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./Firebase";
import "./EditProfile.css";

const DEFAULT_PROVIDER_DATA = {
  airtel: [
    { gb: 1, price: 4.0 },
    { gb: 2, price: 9.0 },
    { gb: 3, price: 13.0 },
    { gb: 4, price: 18.0 },
    { gb: 5, price: 23.0 },
    { gb: 6, price: 27.0 },
    { gb: 7, price: 30.0 },
    { gb: 8, price: 35.0 },
    { gb: 10, price: 41.0 },
    { gb: 12, price: 47.0 },
    { gb: 15, price: 57.0 },
    { gb: 20, price: 72.0 },
    { gb: 25, price: 88.0 },
    { gb: 30, price: 102.0 },
    { gb: 40, price: 138.0 },
    { gb: 50, price: 172.0 },
    { gb: 100, price: 322.0 },
  ],
  telecel: [
    { gb: 5, price: 25.5 },
    { gb: 10, price: 43.5 },
    { gb: 15, price: 66.0 },
    { gb: 20, price: 83.0 },
    { gb: 25, price: 113.0 },
    { gb: 30, price: 131.0 },
    { gb: 40, price: 168.0 },
    { gb: 50, price: 220.0 },
  ],
  mtn: [
    { gb: 1, price: 5.0 },
    { gb: 2, price: 10.0 },
    { gb: 3, price: 15.5 },
    { gb: 4, price: 22.0 },
    { gb: 5, price: 26.5 },
    { gb: 6, price: 33.5 },
    { gb: 8, price: 41.5 },
    { gb: 10, price: 45.0 },
    { gb: 15, price: 74.0 },
    { gb: 20, price: 92.0 },
    { gb: 25, price: 113.0 },
    { gb: 30, price: 139.0 },
    { gb: 40, price: 178.0 },
    { gb: 50, price: 207.0 },
    { gb: 100, price: 428.0 },
  ],
};

function EditProfile() {
  const navigate = useNavigate();
  const [agentFullName, setAgentFullName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentUsername, setAgentUsername] = useState("");
  const [customPrices, setCustomPrices] = useState({
    mtn: {},
    airtel: {},
    telecel: {},
  });
  const [selectedNetworks, setSelectedNetworks] = useState({
    mtn: false,
    airtel: false,
    telecel: false,
  });
  const [updateProfile, setUpdateProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch agent profile on mount
  useEffect(() => {
    const fetchAgentProfile = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const agentDoc = await getDoc(doc(db, "dataplug-agents", user.uid));
          if (agentDoc.exists()) {
            const data = agentDoc.data();
            setAgentFullName(data.fullName || "");
            setAgentPhone(data.phone || "");
            setAgentUsername(data.username || "");
            setCustomPrices(
              data.customPrices || { mtn: {}, airtel: {}, telecel: {} }
            );
          }
        } else {
          navigate("/"); // Redirect if not authenticated
        }
      } catch (error) {
        setProfileError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchAgentProfile();
  }, [navigate]);

  // Handle price input change
  const handlePriceChange = (provider, gb, value) => {
    setCustomPrices((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [gb]: value ? parseFloat(value) : "",
      },
    }));
  };

  // Handle network selection
  const handleNetworkToggle = (provider) => {
    setSelectedNetworks((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  // Validate and handle profile update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    // Check if at least one section is selected for update
    if (!updateProfile && !Object.values(selectedNetworks).some((v) => v)) {
      setProfileError(
        "Please select at least one section to update (Profile or Networks)."
      );
      return;
    }

    // Validate profile fields if updateProfile is checked
    if (updateProfile) {
      if (!agentFullName || !agentPhone || !agentUsername) {
        setProfileError("Please fill all required profile fields.");
        return;
      }
      if (agentPhone.length !== 10 || !/^\d{10}$/.test(agentPhone)) {
        setProfileError("Please enter a valid 10-digit phone number.");
        return;
      }
    }

    // Validate custom prices for selected networks
    for (const provider in selectedNetworks) {
      if (selectedNetworks[provider]) {
        for (const gb in customPrices[provider]) {
          const price = customPrices[provider][gb];
          if (price !== "" && (isNaN(price) || price <= 0)) {
            setProfileError(
              `Invalid price for ${provider} ${gb}GB. Please enter a valid positive number.`
            );
            return;
          }
        }
      }
    }

    try {
      setLoading(true);
      const updateData = {};

      // Include profile fields if updateProfile is checked
      if (updateProfile) {
        updateData.fullName = agentFullName;
        updateData.phone = agentPhone;
        updateData.username = agentUsername;
      }

      // Include custom prices for selected networks
      if (Object.values(selectedNetworks).some((v) => v)) {
        const cleanedCustomPrices = {};
        Object.keys(customPrices).forEach((provider) => {
          cleanedCustomPrices[provider] = {};
          if (selectedNetworks[provider]) {
            Object.keys(customPrices[provider]).forEach((gb) => {
              if (customPrices[provider][gb] !== "") {
                cleanedCustomPrices[provider][gb] = customPrices[provider][gb];
              }
            });
          } else {
            // Preserve existing prices for unselected networks
            cleanedCustomPrices[provider] = customPrices[provider];
          }
        });
        updateData.customPrices = cleanedCustomPrices;
      }

      // Perform update only if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateDoc(
          doc(db, "dataplug-agents", auth.currentUser.uid),
          updateData
        );
        setProfileSuccess("Selected fields updated successfully!");
        setProfileError("");
        setTimeout(() => {
          navigate("/agent-portal");
        }, 2000);
      } else {
        setProfileError("No changes detected to update.");
      }
    } catch (error) {
      setProfileError("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  // Reset specific network prices
  const handleResetNetwork = (provider) => {
    setCustomPrices((prev) => ({
      ...prev,
      [provider]: {},
    }));
    setSelectedNetworks((prev) => ({
      ...prev,
      [provider]: false,
    }));
  };

  return (
    <motion.div
      className="edit-profile-page"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <header className="edit-profile-header">
        <button
          className="back-button"
          onClick={() => navigate("/agent-portal")}
          aria-label="Back to Agent Portal"
        >
          <FaArrowLeft /> Back
        </button>
        <div className="title-with-icon">
          <FaUserEdit className="edit-icon" aria-hidden="true" />
          <h1>Edit Profile</h1>
        </div>
      </header>

      <section className="edit-profile-content">
        {profileError && <p className="error-message">{profileError}</p>}
        {profileSuccess && <p className="success-message">{profileSuccess}</p>}
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <form onSubmit={handleUpdateProfile} className="edit-profile-form">
            {/* Profile Fields */}
            <div className="section-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={updateProfile}
                  onChange={() => setUpdateProfile(!updateProfile)}
                />
                Update Profile Details
              </label>
            </div>
            <h2>Profile Details</h2>
            <div
              className={
                updateProfile ? "form-section" : "form-section disabled"
              }
            >
              <div className="form-group">
                <label htmlFor="full-name">Full Name:</label>
                <input
                  id="full-name"
                  type="text"
                  value={agentFullName}
                  onChange={(e) => setAgentFullName(e.target.value)}
                  disabled={!updateProfile}
                  required={updateProfile}
                  aria-describedby="full-name-error"
                />
                {updateProfile && !agentFullName && (
                  <span className="form-error" id="full-name-error">
                    Full name is required.
                  </span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="profile-phone">Phone Number:</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  pattern="[0-9]{10}"
                  disabled={!updateProfile}
                  required={updateProfile}
                  aria-describedby="profile-phone-error"
                />
                {updateProfile &&
                  agentPhone &&
                  !/^\d{10}$/.test(agentPhone) && (
                    <span className="form-error" id="profile-phone-error">
                      Please enter a valid 10-digit phone number.
                    </span>
                  )}
              </div>
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  id="username"
                  type="text"
                  value={agentUsername}
                  onChange={(e) => setAgentUsername(e.target.value)}
                  disabled={!updateProfile}
                  required={updateProfile}
                  aria-describedby="username-error"
                />
                {updateProfile && !agentUsername && (
                  <span className="form-error" id="username-error">
                    Username is required.
                  </span>
                )}
              </div>
            </div>

            {/* Custom Prices Section */}
            <h2>Customize Data Bundle Prices</h2>
            {Object.keys(DEFAULT_PROVIDER_DATA).map((provider) => (
              <div key={provider} className="provider-prices">
                <div className="section-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedNetworks[provider]}
                      onChange={() => handleNetworkToggle(provider)}
                    />
                    Update {provider.toUpperCase()} Prices
                  </label>
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => handleResetNetwork(provider)}
                    disabled={!selectedNetworks[provider]}
                  >
                    Reset {provider.toUpperCase()} Prices
                  </button>
                </div>
                <div
                  className={
                    selectedNetworks[provider]
                      ? "form-section"
                      : "form-section disabled"
                  }
                >
                  {DEFAULT_PROVIDER_DATA[provider].map((bundle) => (
                    <div key={bundle.gb} className="form-group price-group">
                      <label htmlFor={`${provider}-${bundle.gb}`}>
                        {bundle.gb} GB (Default: GHS {bundle.price.toFixed(2)}):
                      </label>
                      <input
                        id={`${provider}-${bundle.gb}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={customPrices[provider][bundle.gb] || ""}
                        onChange={(e) =>
                          handlePriceChange(provider, bundle.gb, e.target.value)
                        }
                        placeholder={`Default: ${bundle.price.toFixed(2)}`}
                        disabled={!selectedNetworks[provider]}
                        aria-describedby={`${provider}-${bundle.gb}-error`}
                      />
                      {selectedNetworks[provider] &&
                        customPrices[provider][bundle.gb] &&
                        (isNaN(customPrices[provider][bundle.gb]) ||
                          customPrices[provider][bundle.gb] <= 0) && (
                          <span
                            className="form-error"
                            id={`${provider}-${bundle.gb}-error`}
                          >
                            Please enter a valid positive number.
                          </span>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <motion.button
              type="submit"
              className="submit-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Update selected fields"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Selected Fields"}
            </motion.button>
          </form>
        )}
      </section>
    </motion.div>
  );
}

export default EditProfile;
