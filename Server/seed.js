const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "assets.db"));
db.pragma("journal_mode = WAL");

db.exec(`CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  purchase_date TEXT,
  purchase_price REAL,
  remark TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

// 清空现有数据，以本脚本内容为准
db.prepare("DELETE FROM assets").run();

const seed = [
  // 存款
  {
    category: "存款",
    name: "公共账户",
    value: 513697.0,
    purchase_date: null,
    purchase_price: null,
    remark: "目前暂存在农行卡",
  },
  {
    category: "存款",
    name: "佳卉-工商银行",
    value: 227399.0,
    purchase_date: null,
    purchase_price: null,
    remark: "工资卡，目前有5w不到的信用卡账单",
  },
  {
    category: "存款",
    name: "佳卉-招商银行",
    value: 197639.0,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "佳卉-微众银行",
    value: 75000.0,
    purchase_date: null,
    purchase_price: null,
    remark: "理财，可随时提现",
  },
  {
    category: "存款",
    name: "佳卉-支付宝",
    value: 3300.0,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "鑫 -招商",
    value: 56321.79,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "鑫 -信用卡",
    value: -9178.88,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "鑫 - 公积金",
    value: 210603.43,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "鑫 - 微信",
    value: 414.7,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "存款",
    name: "鑫 - 支付宝",
    value: 8000.58,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },

  // 投资资产
  {
    category: "投资资产",
    name: "华为股票E",
    value: 392500.0,
    purchase_date: "2023",
    purchase_price: 7.85,
    remark: "5万股",
  },
  {
    category: "投资资产",
    name: "华为股票E1",
    value: 5926750.0,
    purchase_date: "2026",
    purchase_price: 7.85,
    remark: null,
  },
  {
    category: "投资资产",
    name: "A股股票",
    value: 364617.64,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "投资资产",
    name: "基金",
    value: 18418.87,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
  {
    category: "投资资产",
    name: "港股",
    value: 91166.39,
    purchase_date: null,
    purchase_price: null,
    remark: "腾讯",
  },
  {
    category: "投资资产",
    name: "流动投资",
    value: 200000.0,
    purchase_date: null,
    purchase_price: null,
    remark: "电商流动资金",
  },
  {
    category: "投资资产",
    name: "投资黄金",
    value: 59416.22,
    purchase_date: null,
    purchase_price: null,
    remark: "59g",
  },

  // 其他资产
  {
    category: "其他资产",
    name: "黄金首饰",
    value: 59820.0,
    purchase_date: null,
    purchase_price: null,
    remark: "60g",
  },
  {
    category: "其他资产",
    name: "外部借款",
    value: -400000.0,
    purchase_date: null,
    purchase_price: null,
    remark: null,
  },
];

const stmt = db.prepare(
  "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
);
let inserted = 0;
for (const row of seed) {
  stmt.run(
    row.category,
    row.name,
    row.value,
    row.purchase_date,
    row.purchase_price,
    row.remark,
  );
  inserted++;
}

console.log(`已写入 ${inserted} 条资产记录。`);
const rows = db
  .prepare("SELECT id, category, name, value FROM assets ORDER BY id ASC")
  .all();
rows.forEach((r) =>
  console.log(
    `  [${String(r.id).padStart(2)}] ${r.category} / ${r.name} => ${r.value.toFixed(2)}`,
  ),
);
const total = rows.reduce((s, r) => s + r.value, 0);
console.log(`合计 = ${total.toFixed(2)} 元`);
