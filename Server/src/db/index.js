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

db.exec(`
  CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER,
    action TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    purchase_date TEXT,
    purchase_price REAL,
    remark TEXT,
    change_amount REAL,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(
  `CREATE INDEX IF NOT EXISTS idx_asset_history_date ON asset_history(snapshot_date);`,
);
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id);`,
);

// 初始化种子数据（仅在 assets 表为空时）
function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM assets").get().count;
  if (count > 0) return;

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${day}`;

  const seed = [
    {
      category: "存款",
      name: "公共账户",
      value: 513697,
      remark: "目前暂存在农行卡",
    },
    {
      category: "存款",
      name: "佳卉-工商银行",
      value: 227399,
      remark: "工资卡",
    },
    { category: "存款", name: "佳卉-招商银行", value: 197639, remark: null },
    { category: "存款", name: "佳卉-微众银行", value: 75000, remark: "理财" },
    { category: "存款", name: "佳卉-支付宝", value: 3300, remark: null },
    {
      category: "投资资产",
      name: "华为股票E",
      value: 392500,
      purchase_date: "2023",
      purchase_price: 7.85,
      remark: "5万股",
    },
    {
      category: "投资资产",
      name: "华为股票E1",
      value: 5926750,
      purchase_date: "2026",
      purchase_price: 7.85,
      remark: null,
    },
    { category: "投资资产", name: "A股股票", value: 364617.64, remark: null },
    { category: "投资资产", name: "基金", value: 18418.87, remark: null },
    { category: "投资资产", name: "港股", value: 91166.39, remark: "腾讯" },
    {
      category: "投资资产",
      name: "流动投资",
      value: 200000,
      remark: "电商流动资金",
    },
    { category: "投资资产", name: "投资黄金", value: 59416.22, remark: "59g" },
    { category: "其他资产", name: "黄金首饰", value: 59820, remark: "60g" },
  ];

  const insertAsset = db.prepare(
    "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertHistory = db.prepare(
    "INSERT INTO asset_history (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  db.exec("BEGIN");
  try {
    for (const row of seed) {
      const info = insertAsset.run(
        row.category,
        row.name,
        row.value,
        row.purchase_date || null,
        row.purchase_price != null ? row.purchase_price : null,
        row.remark || null,
      );
      const assetId = info.lastInsertRowid;
      insertHistory.run(
        assetId,
        "snapshot",
        todayStr,
        row.category,
        row.name,
        row.value,
        row.purchase_date || null,
        row.purchase_price != null ? row.purchase_price : null,
        row.remark || null,
        null,
      );
    }
    db.exec("COMMIT");
    console.log(`[DB] 已初始化 ${seed.length} 条种子资产数据`);
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("[DB] 种子数据初始化失败:", err);
  }
}

seedIfEmpty();

module.exports = db;
