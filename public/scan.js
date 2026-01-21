/* =========================================================
   EDC SHUTTLE – STAFF QR SCANNER
   FINAL PRODUCTION VERSION
========================================================= */

let scanType = "DEPART";
let lastToken = null;
let lastScanTime = 0;

const video = document.getElementById("video");
const statusEl = document.getElementById("status");

const departBtn = document.getElementById("depart");
const returnBtn = document.getElementById("return");

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
  statusEl.textContent = "QR SCANNING NOT SUPPORTED ON THIS DEVICE";
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

    const rawValue = barcodes[0].rawValue;

    let token;
    try {
      const url = new URL(rawValue);
      token = url.pathname.split("/").pop();
    } catch {
      return; // Not a valid URL QR
    }

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

    statusEl.textContent = data.message;
    statusEl.className = data.ok ? "ok" : "fail";

  } catch (err) {
    // Silent failure per frame to keep scanning smooth
  }
}, 800);

/* =========================================================
   END SCANNER
========================================================= */
