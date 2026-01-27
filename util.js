/**
 * =========================================================
 * util.js
 * EDC Shuttle QR Scanner Utilities
 * =========================================================
 * PURPOSE:
 * Normalize QR scan input so the scanner accepts:
 *  - Full URLs
 *  - Partial URLs
 *  - URL-encoded values
 *  - Token-only scans
 *
 * OUTPUT:
 *  - Returns a clean QRToken (string) or null
 * =========================================================
 */

/**
 * Extracts a valid EDC QR token from any scanned input
 * @param {string} input - Raw scanned QR value
 * @returns {string|null} Normalized QR token
 */
function extractToken(input) {
  if (!input || typeof input !== 'string') return null;

  let decoded;

  try {
    decoded = decodeURIComponent(input.trim());
  } catch (err) {
    // If decode fails, fall back to raw input
    decoded = input.trim();
  }

  // -------------------------------------------------------
  // CASE 1: Full or partial URL with ?token=
  // -------------------------------------------------------
  const urlTokenMatch = decoded.match(/[?&]token=([A-Z0-9-]+)/i);
  if (urlTokenMatch && urlTokenMatch[1]) {
    return urlTokenMatch[1].toUpperCase();
  }

  // -------------------------------------------------------
  // CASE 2: token=XYZ (no URL)
  // -------------------------------------------------------
  const directTokenMatch = decoded.match(/token=([A-Z0-9-]+)/i);
  if (directTokenMatch && directTokenMatch[1]) {
    return directTokenMatch[1].toUpperCase();
  }

  // -------------------------------------------------------
  // CASE 3: Token-only scan (camera / screenshot)
  // -------------------------------------------------------
  const rawTokenMatch = decoded.match(/EDC-[A-Z0-9-]+/i);
  if (rawTokenMatch && rawTokenMatch[0]) {
    return rawTokenMatch[0].toUpperCase();
  }

  // -------------------------------------------------------
  // No valid token found
  // -------------------------------------------------------
  return null;
}

/**
 * Optional helper for clean scanner logging
 * @param {string} raw
 * @param {string|null} token
 */
function logNormalization(raw, token) {
  console.log('📷 RAW SCAN VALUE:', raw);
  console.log('🔑 NORMALIZED TOKEN:', token || 'NONE');
}

module.exports = {
  extractToken,
  logNormalization
};
