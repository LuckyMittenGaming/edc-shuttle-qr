/**
 * =========================================================
 * server.js
 * EDC Shuttle QR Scanner Server
 * =========================================================
 * - Serves scanner UI (GET /scan)
 * - Accepts QR scans (POST /scan)
 * - Normalizes QR payloads
 * - Validates tokens against RideLedger
 * =========================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const { extractToken, logNormalization } = require('./util');
const { validateQRToken } = require('./db'); // existing RideLedger validator

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   MIDDLEWARE
========================================================= */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (scan.html, scan.js, styles.css, etc.)
app.use(express.static(path.join(__dirname, 'public')));

/* =========================================================
   HEALTH CHECK (OPTIONAL)
========================================================= */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'EDC QR Scanner' });
});

/* =========================================================
   SCANNER UI
   Browser loads this via GET
========================================================= */
app.get('/scan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scan.html'));
});

/* =========================================================
   QR SCAN ENDPOINT
   Scanner JS POSTs here
========================================================= */
app.post('/scan', async (req, res) => {
  try {
    // ---------------------------------------------
    // 1. Capture RAW scanned value (defensive)
    // ---------------------------------------------
    const rawScan =
      req.body?.value ||
      req.body?.scan ||
      req.body?.data ||
      req.body?.qr ||
      '';

    // ---------------------------------------------
    // 2. Normalize / extract token
    // ---------------------------------------------
    const token = extractToken(rawScan);

    // Optional but VERY useful onsite
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

    /*
      Expected result shape:
      {
        allowed: true | false,
        message: 'VALID PASS' | 'ALREADY USED' | 'INVALID PASS'
      }
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
  console.log(`📷 Scanner UI: http://localhost:${PORT}/scan`);
});
