/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   FINAL PRODUCTION VERSION (ROBUST TOKEN HANDLING + PROXY FIX)
========================================================= */

let scanType = "DEPART";
let lastScannedToken = null;

const video = document.getElementById("video");
const statusEl = document.getElementById("status");

const departBtn = document.getElementById("depart");
const returnBtn = document.getElementById("return");

/* =========================
   ORIENTATION LOCK (BEST EFFORT)
========================= */
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock("portrait").catch(() => {
    // iOS may require user interaction first, or not support lock
  });
}

/* =========================
   UI MODE HANDLING
========================= */
function setMode(mode) {
  scanType = mode;

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

  if (navigator.vibrate) {
    navigator.vibrate(30);
  }
}

// Initialize default mode
setMode("DEPART");

departBtn.addEventListener("click", () => setMode("DEPART"));
returnBtn.addEventListener("click", () => setMode("RETURN"));

/* =========================
   CAMERA SETUP (REAR / ENVIRONMENT)
========================= */
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } },
  audio: false
})
.then(stream => {
  video.srcObject = stream;
  // iOS Safari requires playsinline in HTML, but playing here ensures it starts
  video.play(); 
})
.catch(err => {
  statusEl.textContent = "CAMERA ERROR";
  statusEl.className = "fail";
  console.error("Camera error:", err);
});

/* =========================
   QR DETECTION SETUP
========================= */
if (!("BarcodeDetector" in window)) {
  statusEl.textContent = "QR SCANNING NOT SUPPORTED";
  statusEl.className = "fail";
  throw new Error("BarcodeDetector not supported in this browser");
}

const detector = new BarcodeDetector({ formats: ["qr_code"] });

/* =========================
   MAIN SCAN LOOP
========================= */
setInterval(async () => {
  try {
    // 1. Detect Barcodes
    const barcodes = await detector.detect(video);
    if (!barcodes.length) return;

    const rawValue = String(barcodes[0].rawValue || "").trim();
    if (!rawValue) return;

    let token = null;

    /* ---------------------------------
       TOKEN EXTRACTION LOGIC
    ---------------------------------- */

    // CASE 1: Token-only QR (e.g., "EDC-963648...")
    if (rawValue.startsWith("EDC-")) {
      token = rawValue;
    }

    // CASE 2: Full URL QR (e.g., "https://script.google.com...?token=EDC-...")
    else if (rawValue.includes("token=")) {
      try {
        // We use the 'URL' object to safely parse query parameters
        const url = new URL(rawValue);
        token = url.searchParams.get("token");
      } catch (err) {
        console.warn("URL Parse failed, attempting fallback regex");
      }
    }

    // CASE 3: Fallback Regex (Extract "EDC-" pattern from any string)
    if (!token) {
      const match = rawValue.match(/EDC-[A-Z0-9\-]+/);
      if (match) {
        token = match[0];
      }
    }

    // Final safety check: If we still don't have a token, ignore this scan.
    if (!token) return;

    /* ---------------------------------
       DEBOUNCE DUPLICATE SCANS
    ---------------------------------- */
    if (token === lastScannedToken) return;
    lastScannedToken = token;

    // Provide immediate visual feedback that we are processing
    statusEl.textContent = "CHECKING…";
    statusEl.className = "muted";

    /* ---------------------------------
       SEND TO SERVER (PROXY)
    ---------------------------------- */
    // FIX: We send data to YOUR server (/api/scan), not Google directly.
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token: token, 
          scanType: scanType 
        })
      });

      const data = await response.json();

      // Show the message returned by server (which comes from Google)
      statusEl.textContent = data.message || "UNKNOWN ERROR";
      
      // Update color based on success/fail
      statusEl.className = data.ok ? "ok" : "fail";

      // HAPTIC FEEDBACK
      if (navigator.vibrate) {
        if (data.ok) {
           navigator.vibrate(50); // Short buzz for success
        } else {
           navigator.vibrate([100, 50, 100]); // Double buzz for error
        }
      }

    } catch (networkErr) {
      console.error("Network Error:", networkErr);
      statusEl.textContent = "NETWORK ERROR";
      statusEl.className = "fail";
    }

    // Reset debounce after 3 seconds so the same person can scan again if needed
    setTimeout(() => {
      lastScannedToken = null;
    }, 3000);

  } catch (err) {
    // Silent catch for general loop errors (e.g. video stream hiccups)
    console.error("Scanner loop error:", err);
  }
}, 800);
