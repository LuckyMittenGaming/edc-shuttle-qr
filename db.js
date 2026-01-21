const Database = require("better-sqlite3");

const db = new Database("qr.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS passes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE,
  type TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT,
  scan_type TEXT,
  result TEXT,
  message TEXT,
  scanned_at TEXT
);
`);

module.exports = db;

