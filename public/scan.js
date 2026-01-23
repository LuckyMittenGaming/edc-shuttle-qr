/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   FINAL PRODUCTION VERSION (ROBUST TOKEN HANDLING)
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
    // iOS may require user interaction first
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

setMode("DEPART");

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
   MAIN SCAN LOOP (ROBUST)
========================= */
setInterval(async () => {
  try {
    const barcodes = await detector.detect(video);
    if (!barcodes.length) return;

    const rawValue = String(barcodes[0].rawValue || "").trim();
    if (!rawValue) return;

    let token = null;

    /* ---------------------------------
       TOKEN EXTRACTION LOGIC
    ---------------------------------- */

    // CASE 1: Token-only QR (BEST / PREFERRED)
    if (rawValue.startsWith("EDC-")) {
      token = rawValue;
    }

    // CASE 2: Full URL QR (expected fallback)
    else if (rawValue.includes("token=")) {
      try {
        const url = new URL(rawValue);
        token = url.searchParams.get("token");
      } catch (err) {
        // URL constructor can fail on partial reads
      }
    }

    // CASE 3: Partial URL / weird scan → extract manually
    if (!token && rawValue.includes("EDC-")) {
      const match = rawValue.match(/EDC-[A-Z0-9\-]+/);
      if (match) {
        token = match[0];
      }
    }

    // Final safety check
    if (!token) return;

    /* ---------------------------------
       DEBOUNCE DUPLICATE SCANS
    ---------------------------------- */
    if (token === lastScannedToken) return;
    lastScannedToken = token;

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

    // Allow same QR again after short delay
    setTimeout(() => {
      lastScannedToken = null;
    }, 3000);

  } catch (err) {
    console.error("Scanner loop error:", err);
  }
}, 800);

/* =========================================================
   END SCANNER
========================================================= */
