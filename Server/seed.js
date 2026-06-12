const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const db = new Database(path.join(dataDir, "assets.db"));
db.pragma("journal_mode = WAL");

db.exec(
  "CREATE TABLE IF NOT EXISTS assets (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "category TEXT NOT NULL," +
    "name TEXT NOT NULL," +
    "value REAL NOT NULL," +
    "purchase_date TEXT," +
    "purchase_price REAL," +
    "remark TEXT," +
    "created_at TEXT DEFAULT CURRENT_TIMESTAMP," +
    "updated_at TEXT DEFAULT CURRENT_TIMESTAMP" +
    ");",
);

db.exec(
  "CREATE TABLE IF NOT EXISTS asset_history (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
    "asset_id INTEGER," +
    "action TEXT NOT NULL," +
    "snapshot_date TEXT NOT NULL," +
    "category TEXT NOT NULL," +
    "name TEXT NOT NULL," +
    "value REAL NOT NULL," +
    "purchase_date TEXT," +
    "purchase_price REAL," +
    "remark TEXT," +
    "change_amount REAL," +
    "recorded_at TEXT DEFAULT CURRENT_TIMESTAMP" +
    ");",
);

db.prepare("DELETE FROM assets").run();
db.prepare("DELETE FROM asset_history").run();

const seed = [
  {
    category: "存款",
    name: "公共账户",
    value: 513697,
    remark: "目前暂存在农行卡",
  },
  { category: "存款", name: "佳卉-工商银行", value: 227399, remark: "工资卡" },
  { category: "存款", name: "佳卉-招商银行", value: 197639, remark: null },
  { category: "存款", name: "佳卉-微众银行", value: 75000, remark: "理财" },
  { category: "存款", name: "佳卉-支付宝", value: 3300, remark: null },
  { category: "存款", name: "鑫 -招商", value: 56321.79, remark: null },
  { category: "存款", name: "鑫 -信用卡", value: -9178.88, remark: null },
  { category: "存款", name: "鑫 - 公积金", value: 210603.43, remark: null },
  { category: "存款", name: "鑫 - 微信", value: 414.7, remark: null },
  { category: "存款", name: "鑫 - 支付宝", value: 8000.58, remark: null },
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
  { category: "外部借款", name: "外部借款", value: -400000, remark: null },
];

const insertAsset = db.prepare(
  "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
);
const insertHistory = db.prepare(
  "INSERT INTO asset_history (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
);

const today = todayStr();
let inserted = 0;
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
    today,
    row.category,
    row.name,
    row.value,
    row.purchase_date || null,
    row.purchase_price != null ? row.purchase_price : null,
    row.remark || null,
    null,
  );
  inserted++;
}

console.log(`已写入 ${inserted} 条资产记录。`);
const rows = db
  .prepare("SELECT id, category, name, value FROM assets ORDER BY id ASC")
  .all();
rows.forEach((r) => {
  console.log(
    `  [${String(r.id).padStart(2)}] ${r.category} / ${r.name} => ${r.value.toFixed(2)}`,
  );
});
const total = rows.reduce((s, r) => s + r.value, 0);
console.log(`合计 = ${total.toFixed(2)} 元`);
