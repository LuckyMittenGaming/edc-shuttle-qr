const express = require("express");
const db = require("./db");
const { now } = require("./util");
const path = require("path");

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

app.post("/api/scan", (req, res) => {
  const { token, scanType, bookingType } = req.body;

  if (!token) {
    return res.json({ ok: false, message: "NO TOKEN" });
  }

  const pass = db
    .prepare("SELECT * FROM passes WHERE token = ?")
    .get(token);

  if (!pass) {
    log(token, scanType, "FAIL", "INVALID QR");
    return res.json({ ok: false, message: "INVALID QR" });
  }

  if (bookingType === "PRIVATE") {
    log(token, scanType, "OK", "PRIVATE VEHICLE – OK");
    return res.json({ ok: true, message: "PRIVATE VEHICLE – OK" });
  }

  if (pass.status === "USED") {
    log(token, scanType, "FAIL", "ALREADY USED");
    return res.json({ ok: false, message: "ALREADY USED" });
  }

  db.prepare("UPDATE passes SET status='USED' WHERE token=?").run(token);
  log(token, scanType, "OK", "VALID PASS");

  res.json({ ok: true, message: "VALID PASS" });
});

function log(token, type, result, message) {
  db.prepare(`
    INSERT INTO scans (token, scan_type, result, message, scanned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, type, result, message, now());
}

app.listen(PORT, () => {
  console.log("QR backend running on port", PORT);
});

