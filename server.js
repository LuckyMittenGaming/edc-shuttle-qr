/**
 * =========================================================
 * server.js
 * EDC Shuttle QR Scanner Server
 * =========================================================
 * Handles QR scan intake, normalization, and validation
 * =========================================================
 */

const express = require('express');
const bodyParser = require('body-parser');

const { extractToken, logNormalization } = require('./util');
const { validateQRToken } = require('./db'); // assumes your existing validator

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   MIDDLEWARE
========================================================= */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* =========================================================
   HEALTH CHECK (optional but useful onsite)
========================================================= */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'EDC QR Scanner' });
});

/* =========================================================
   QR SCAN ENDPOINT
   THIS IS THE IMPORTANT PART
========================================================= */
app.post('/scan', async (req, res) => {
  try {
    // ---------------------------------------------
    // 1. Capture RAW scanned value
    // ---------------------------------------------
    const rawScan =
      req.body?.value ||
      req.body?.scan ||
      req.body?.data ||
      '';

    // ---------------------------------------------
    // 2. Normalize / extract token
    // ---------------------------------------------
    const token = extractToken(rawScan);

    // Optional logging (very helpful onsite)
    logNormalization(rawScan, token);

    if (!token) {
      return res.json({
        status: 'DENIED',
        message: 'INVALID QR FORMAT'
      });
    }

    // ---------------------------------------------
    // 3. Validate token against RideLedger
    // ---------------------------------------------
    const result = await validateQRToken(token);

    /**
     * Expected result shape (example):
     * {
     *   allowed: true|false,
     *   message: 'VALID PASS' | 'ALREADY USED' | 'INVALID PASS'
     * }
     */

    if (!result || result.allowed !== true) {
      return res.json({
        status: 'DENIED',
        message: result?.message || 'INVALID PASS'
      });
    }

    // ---------------------------------------------
    // 4. Success
    // ---------------------------------------------
    return res.json({
      status: 'ALLOWED',
      message: result.message || 'VALID PASS'
    });

  } catch (err) {
    console.error('❌ SCAN ERROR:', err);

    return res.json({
      status: 'DENIED',
      message: 'SCAN ERROR'
    });
  }
});

/* =========================================================
   SERVER START
========================================================= */
app.listen(PORT, () => {
  console.log(`🚐 EDC Shuttle QR Scanner running on port ${PORT}`);
});
