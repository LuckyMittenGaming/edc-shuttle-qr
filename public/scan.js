let scanType = "DEPART";

const video = document.getElementById("video");
const statusEl = document.getElementById("status");

document.getElementById("depart").onclick = () => scanType = "DEPART";
document.getElementById("return").onclick = () => scanType = "RETURN";

navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
});

const detector = new BarcodeDetector({ formats: ["qr_code"] });

setInterval(async () => {
  const barcodes = await detector.detect(video);
  if (!barcodes.length) return;

  const url = new URL(barcodes[0].rawValue);
  const token = url.pathname.split("/").pop();

  fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, scanType })
  })
  .then(r => r.json())
  .then(data => {
    statusEl.textContent = data.message;
    statusEl.className = data.ok ? "ok" : "fail";
  });
}, 1200);


