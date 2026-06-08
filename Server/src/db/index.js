const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, "assets.db");
const db = new Database(dbFile);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    purchase_date TEXT,
    purchase_price REAL,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
