/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   FINAL PRODUCTION VERSION (TOKEN-SAFE)
========================================================= */

let scanType = "DEPART";
let lastToken = null;
let lastScanTime = 0;

const video = document.getElementById("video");
const statusEl = document.getElementById("status");

const departBtn = document.getElementById("depart");
const returnBtn = document.getElementById("return");

/* =========================
   ORIENTATION LOCK (BEST EFFORT)
========================= */
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock("portrait").catch(() => {
    // iOS may require user interaction first – safe to ignore
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

// Default mode
setMode("DEPART");

// Button handlers
departBtn.addEventListener("click", () => setMode("DEPART"));
returnBtn.addEventListener("click", () => setMode("RETURN"));

/* =========================
   CAMERA (REAR / ENVIRONMENT)
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

    // ✅ CASE 1: Token-only QR (PREFERRED)
    if (rawValue.startsWith("EDC-")) {
      token = rawValue;
    }

    // ✅ CASE 2: URL QR (fallback / backward compatible)
    else {
      try {
        const url = new URL(rawValue);
        token = url.searchParams.get("token");
      } catch (e) {
        return; // Not usable QR content
      }
    }

    if (!token) return;

    // Prevent rapid duplicate scans
    const now = Date.now();
    if (token === lastToken && now - lastScanTime < 2000) return;

    lastToken = token;
    lastScanTime = now;

    statusEl.textContent = "CHECKING…";
    statusEl.className = "muted";

    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, scanType })
    });

    const data = await response.json();

    statusEl.textContent = data.message || "UNKNOWN RESPONSE";
    statusEl.className = data.ok ? "ok" : "fail";

  } catch (err) {
    // Silent per-frame errors to keep scanning smooth
    console.error("Scan error:", err);
  }
}, 800);

/* =========================================================
   END SCANNER
========================================================= */
