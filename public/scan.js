/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   VERSION: PRODUCTION FIXED - HANDLES EMAILED TOKENS
========================================================= */

let scanType = "DEPART";
let lastScannedToken = null;

const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const departBtn = document.getElementById("depart");
const returnBtn = document.getElementById("return");

/* =========================
   HELPER: VISUAL FLASH
========================= */
function triggerFlash(type) {
  document.body.classList.remove("flash-ok", "flash-fail");
  void document.body.offsetWidth; 
  if (type === "ok") {
    document.body.classList.add("flash-ok");
  } else {
    document.body.classList.add("flash-fail");
  }
  setTimeout(() => {
    document.body.classList.remove("flash-ok", "flash-fail");
  }, 500);
}

/* =========================
   UI MODE HANDLING
========================= */
function setMode(mode) {
  scanType = mode;
  lastScannedToken = null; 
  if (mode === "DEPART") {
    departBtn.classList.add("active");
    returnBtn.classList.remove("active");
    statusEl.textContent = "MODE: DEPARTURE";
  } else {
    returnBtn.classList.add("active");
    departBtn.classList.remove("active");
    statusEl.textContent = "MODE: RETURN";
  }
  statusEl.className = "muted";
  if (navigator.vibrate) navigator.vibrate(30);
}

setMode("DEPART");
departBtn.addEventListener("click", () => setMode("DEPART"));
returnBtn.addEventListener("click", () => setMode("RETURN"));

/* =========================
   CAMERA & DETECTOR SETUP
========================= */
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } },
  audio: false
})
.then(stream => {
  video.srcObject = stream;
  video.play();
})
.catch(err => {
  statusEl.textContent = "CAMERA ERROR";
  statusEl.className = "fail";
});

if (!("BarcodeDetector" in window)) {
  statusEl.textContent = "QR SCANNING NOT SUPPORTED";
  statusEl.className = "fail";
  throw new Error("BarcodeDetector not supported");
}
const detector = new BarcodeDetector({ formats: ["qr_code"] });

/* =========================================================
   MAIN SCAN LOOP
========================================================= */
setInterval(async () => {
  try {
    const barcodes = await detector.detect(video);
    if (!barcodes.length) return;

    let rawValue = String(barcodes[0].rawValue || "").trim();
    if (!rawValue) return;

    // --- 1. ROBUST TOKEN EXTRACTION ---
    // This looks for the EDC pattern even if it's inside an email link
    let token = null;
    const tokenRegex = /EDC-[0-9]{6}-[A-Z]{3}-[0-9]+-[A-Z0-9]{8}/i;

    const match = rawValue.match(tokenRegex);
    if (match) {
        token = match[0].toUpperCase();
    }

    if (!token) return;

    // --- 2. GATEKEEPER (Repeat Preventer) ---
    if (token === lastScannedToken) return;

    // --- 3. SERVER VALIDATION ---
    // We NO LONGER check for "-TO-" or "-FROM-" here. 
    // The Google Script (doGet) checks the Direction column in your sheet for us.
    lastScannedToken = token;
    statusEl.textContent = "CHECKING…";
    statusEl.className = "muted";

    try {
      const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyP94hI0NOjDE5kM1r5X6NIwhrCxQ6C2oJ1cxwzsHN6tlAQvSec7-8cAli3csJo5fv2nw/exec";
      const fullUrl = `${SCRIPT_URL}?token=${encodeURIComponent(token)}&scanType=${encodeURIComponent(scanType)}`;

      const response = await fetch(fullUrl, { method: "GET" });
      const data = await response.json();

      if (data.status === "ALLOWED") {
        statusEl.textContent = data.message;
        statusEl.className = "ok";
        triggerFlash("ok");
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        // If it's the wrong direction, the server will now tell the phone
        statusEl.textContent = data.message;
        statusEl.className = "fail";
        triggerFlash("fail");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    } catch (networkErr) {
      statusEl.textContent = "NETWORK ERROR";
      statusEl.className = "fail";
      triggerFlash("fail");
    }

    setTimeout(() => {
      lastScannedToken = null;
    }, 3000);

  } catch (err) {
    console.error("Scanner loop error:", err);
  }
}, 800);
