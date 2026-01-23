const express = require("express");
const db = require("./db");
const { now } = require("./util");
const path = require("path");

// Node 18+ has fetch built-in (Render does)
const GOOGLE_VALIDATE_URL =
  "https://script.google.com/macros/s/AKfycbyP94hI0NOjDE5kM1r5X6NIwhrCxQ6C2oJ1cxwzsHN6tlAQvSec7-8cAli3csJo5fv2nw/exec";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("EDC Shuttle QR Backend Running");
});

app.get("/scan", (req, res) => {
  res.sendFile(path.join(__dirname, "public/scan.html"));
});

/* =========================================================
   SCAN ENDPOINT — GOOGLE IS SOURCE OF TRUTH
========================================================= */
app.post("/api/scan", async (req, res) => {
  try {
    const { token, scanType } = req.body;

    if (!token) {
      log("—", scanType, "FAIL", "NO TOKEN");
      return res.json({ ok: false, message: "NO TOKEN" });
    }

    // Call Google Apps Script validator
    const response = await fetch(
      GOOGLE_VALIDATE_URL + "?token=" + encodeURIComponent(token)
    );

    const result = await response.json();

    /*
      Expected Google response:
      {
        status: "ALLOWED" | "DENIED" | "ERROR",
        message: "...",
        timestamp: "..."
      }
    */

    if (result.status !== "ALLOWED") {
      log(token, scanType, "FAIL", result.message);
      return res.json({
        ok: false,
        message: result.message || "INVALID QR"
      });
    }

    // ✅ Valid scan
    log(token, scanType, "OK", "VALID PASS");
    return res.json({
      ok: true,
      message: "VALID PASS"
    });

  } catch (err) {
    console.error("Scan error:", err);
    log("—", "SYSTEM", "ERROR", err.message);
    return res.json({
      ok: false,
      message: "SCAN ERROR"
    });
  }
});

/* =========================================================
   LOGGING (LOCAL AUDIT TRAIL)
========================================================= */
function log(token, type, result, message) {
  try {
    db.prepare(`
      INSERT INTO scans (token, scan_type, result, message, scanned_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, type, result, message, now());
  } catch (e) {
    console.error("Logging error:", e);
  }
}

app.listen(PORT, () => {
  console.log("🚍 EDC Shuttle QR backend running on port", PORT);
});
