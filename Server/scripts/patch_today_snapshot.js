// 为现有资产补齐今天的基线快照（action = 'snapshot'）
// 若今天已有快照记录，则不做任何操作。
const db = require("../src/db");

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const today = todayStr();
const assets = db.prepare("SELECT * FROM assets ORDER BY id ASC").all();

if (assets.length === 0) {
  console.log("assets 表为空，无需补齐");
  process.exit(0);
}

const existingCount = db
  .prepare(
    "SELECT COUNT(*) AS count FROM asset_history WHERE snapshot_date = ? AND action = 'snapshot'"
  )
  .get(today).count;

if (existingCount > 0) {
  console.log(`今天（${today}）的基线快照已存在，无需重复添加`);
  process.exit(0);
}

let inserted = 0;
const insertStmt = db.prepare(`
  INSERT INTO asset_history
    (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount)
  VALUES (?, 'snapshot', ?, ?, ?, ?, ?, ?, ?, NULL)
`);

db.exec("BEGIN");
try {
  for (const asset of assets) {
    insertStmt.run(
      asset.id,
      today,
      asset.category,
      asset.name,
      asset.value,
      asset.purchase_date,
      asset.purchase_price,
      asset.remark
    );
    inserted++;
  }
  db.exec("COMMIT");
  console.log(`已为 ${inserted} 项资产添加今天（${today}）的基线快照`);
} catch (err) {
  try { db.exec("ROLLBACK"); } catch (_) {}
  console.error("事务回滚：", err);
  process.exit(1);
}
