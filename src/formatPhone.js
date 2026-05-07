/**
 * Formats Ghanaian phone numbers to international format (233XXXXXXXXX)
 * @param {string} phone - Phone number input (can be 10 digits starting with 0, or already with 233)
 * @returns {string} - Formatted phone number starting with 233
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.toString().replace(/\D/g, "");

  // Handle different input formats
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    // Local format: 0541234567 → 233541234567
    return `233${cleaned.slice(1)}`;
  } else if (cleaned.startsWith("233") && cleaned.length === 12) {
    // Already in international format
    return cleaned;
  } else if (cleaned.length === 9) {
    // Sometimes people enter without leading 0: 541234567 → 233541234567
    return `233${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("2330")) {
    // Rare case: 2330541234567 → 233541234567
    return `233${cleaned.slice(4)}`;
  }

  // If nothing matches, return as is (validation will catch invalid ones later)
  return cleaned;
};

/**
 * Validates if a phone number is a valid 10-digit Ghanaian number
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
export const isValidGhanaPhone = (phone) => {
  const cleaned = phone.toString().replace(/\D/g, "");
  return (
    /^\d{10}$/.test(cleaned) &&
    (cleaned.startsWith("0") || cleaned.length === 9)
  ); // Allow 10 digits starting with 0
};

/**
 * Extracts the last 9 digits (useful for some APIs)
 * @param {string} phone
 * @returns {string}
 */
export const getLast9Digits = (phone) => {
  const formatted = formatPhoneNumber(phone);
  return formatted.length === 12 ? formatted.slice(3) : formatted;
};

export default formatPhoneNumber;
