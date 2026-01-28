/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   VERSION: ULTIMATE ROBUST EXTRACTION + VISUAL FLASH
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
  void document.body.offsetWidth; // Force reflow

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
    statusEl.textContent = "MODE: DEPARTURE (Scanning 'TO' or 'ROUND')";
  } else {
    returnBtn.classList.add("active");
    departBtn.classList.remove("active");
    statusEl.textContent = "MODE: RETURN (Scanning 'FROM' or 'ROUND')";
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
  console.error("Camera error:", err);
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

    let token = null;

    // --- 1. ROBUST EXTRACTION LOGIC ---
    // Pattern: EDC + 6 digits + Day + numbers + 8 char hex/id
    const tokenRegex = /EDC-[0-9]{6}-[A-Z]{3}-[0-9]+-[A-Z0-9]{8}/i;

    // A. Check if the raw value IS the token
    if (tokenRegex.test(rawValue)) {
      const match = rawValue.match(tokenRegex);
      token = match[0].toUpperCase();
    } 
    // B. Check if it's a URL (Full or Partial)
    else if (rawValue.includes("token=")) {
      try {
        const url = new URL(rawValue.startsWith('http') ? rawValue : 'https://dummy.com' + rawValue);
        token = url.searchParams.get("token");
      } catch (e) {
        const decoded = decodeURIComponent(rawValue);
        const match = decoded.match(tokenRegex);
        if (match) token = match[0].toUpperCase();
      }
    }
    // C. Final Catch-All: Just look for the pattern anywhere in the string
    if (!token) {
      const match = rawValue.match(tokenRegex);
      if (match) token = match[0].toUpperCase();
    }

    if (!token) return;

    // --- 2. GATEKEEPER (Direction & Repeat Check) ---
    if (token === lastScannedToken) return;

    // DEPART Mode Direction Check
    if (scanType === "DEPART") {
      if (!token.includes("-TO-") && !token.includes("-ROUND-")) {
        statusEl.textContent = "WRONG DIRECTION! (Ticket is RETURN Only)";
        statusEl.className = "fail";
        triggerFlash("fail");
        if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50]);
        
        lastScannedToken = token;
        setTimeout(() => { lastScannedToken = null; statusEl.textContent = "READY"; }, 2000);
        return; 
      }
    }

    // RETURN Mode Direction Check
    if (scanType === "RETURN") {
      if (!token.includes("-FROM-") && !token.includes("-ROUND-")) {
        statusEl.textContent = "WRONG DIRECTION! (Ticket is DEPART Only)";
        statusEl.className = "fail";
        triggerFlash("fail");
        if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50]);
        
        lastScannedToken = token;
        setTimeout(() => { lastScannedToken = null; statusEl.textContent = "READY"; }, 2000);
        return;
      }
    }
    
    // --- 3. SERVER VALIDATION ---
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
        statusEl.textContent = data.message;
        statusEl.className = "fail";
        triggerFlash("fail");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }

    } catch (networkErr) {
      console.error(networkErr);
      statusEl.textContent = "NETWORK ERROR";
      statusEl.className = "fail";
      triggerFlash("fail");
    }

    // Allow re-scanning after 3 seconds
    setTimeout(() => {
      lastScannedToken = null;
    }, 3000);

  } catch (err) {
    console.error("Scanner loop error:", err);
  }
}, 800);
