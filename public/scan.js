/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   VERSION: ROBUST TOKEN + ROUND TRIP SUPPORT + VISUAL FLASH
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
  // Remove existing classes to allow re-triggering animation
  document.body.classList.remove("flash-ok", "flash-fail");
  
  // Force a reflow (browser repaint) so the animation restarts if triggered quickly
  void document.body.offsetWidth;

  // Add the appropriate class
  if (type === "ok") {
    document.body.classList.add("flash-ok");
  } else {
    document.body.classList.add("flash-fail");
  }

  // Classes automatically fade out via CSS, but we clean up after 500ms
  setTimeout(() => {
    document.body.classList.remove("flash-ok", "flash-fail");
  }, 500);
}

/* =========================
   ORIENTATION LOCK (BEST EFFORT)
========================= */
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock("portrait").catch(() => {});
}

/* =========================
   UI MODE HANDLING
========================= */
function setMode(mode) {
  scanType = mode;
  lastScannedToken = null; // Reset memory so we can re-scan immediately if needed

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
   CAMERA SETUP
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

/* =========================
   QR DETECTION SETUP
========================= */
if (!("BarcodeDetector" in window)) {
  statusEl.textContent = "QR SCANNING NOT SUPPORTED";
  statusEl.className = "fail";
  throw new Error("BarcodeDetector not supported");
}

const detector = new BarcodeDetector({ formats: ["qr_code"] });

/* =========================
   MAIN SCAN LOOP
========================= */
setInterval(async () => {
  try {
    const barcodes = await detector.detect(video);
    if (!barcodes.length) return;

    const rawValue = String(barcodes[0].rawValue || "").trim();
    if (!rawValue) return;

    let token = null;

    // --- 1. ROBUST EXTRACTION ---
    if (rawValue.startsWith("EDC-")) {
      token = rawValue;
    } else if (rawValue.includes("token=")) {
      try {
        const url = new URL(rawValue);
        token = url.searchParams.get("token");
      } catch (err) { }
    }
    
    // Fallback Regex
    if (!token) {
      const match = rawValue.match(/EDC-[A-Z0-9\-]+/);
      if (match) token = match[0];
    }

    if (!token) return;

    // --- 2. GATEKEEPER (Direction Check) ---
    // Prevent scanning the same code multiple times in a row
    if (token === lastScannedToken) return;

    // DEPART Mode Check
    if (scanType === "DEPART") {
      // Valid if token contains "-TO-" OR "-ROUND-"
      if (!token.includes("-TO-") && !token.includes("-ROUND-")) {
        statusEl.textContent = "WRONG DIRECTION! (Ticket is RETURN Only)";
        statusEl.className = "fail";
        triggerFlash("fail"); // RED FLASH
        
        if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50]);
        
        lastScannedToken = token;
        setTimeout(() => { 
            lastScannedToken = null; 
            statusEl.textContent = "READY"; 
            statusEl.className = "muted"; 
        }, 2000);
        return; 
      }
    }

    // RETURN Mode Check
    if (scanType === "RETURN") {
      // Valid if token contains "-FROM-" OR "-ROUND-"
      if (!token.includes("-FROM-") && !token.includes("-ROUND-")) {
        statusEl.textContent = "WRONG DIRECTION! (Ticket is DEPART Only)";
        statusEl.className = "fail";
        triggerFlash("fail"); // RED FLASH

        if (navigator.vibrate) navigator.vibrate([50, 50, 50, 50]);
        
        lastScannedToken = token;
        setTimeout(() => { 
            lastScannedToken = null; 
            statusEl.textContent = "READY"; 
            statusEl.className = "muted"; 
        }, 2000);
        return;
      }
    }
    
    // --- 3. SERVER VALIDATION ---
    lastScannedToken = token;
    statusEl.textContent = "CHECKING…";
    statusEl.className = "muted";

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, scanType: scanType })
      });

      const data = await response.json();

      statusEl.textContent = data.message || "UNKNOWN ERROR";
      statusEl.className = data.ok ? "ok" : "fail";

      if (data.ok) {
        triggerFlash("ok"); // GREEN FLASH
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        triggerFlash("fail"); // RED FLASH
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }

    } catch (networkErr) {
      statusEl.textContent = "NETWORK ERROR";
      statusEl.className = "fail";
      triggerFlash("fail"); // RED FLASH
    }

    setTimeout(() => {
      lastScannedToken = null;
    }, 3000);

  } catch (err) {
    console.error("Scanner loop error:", err);
  }
}, 800);
