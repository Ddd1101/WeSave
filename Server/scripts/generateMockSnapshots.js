/**
 * 生成以今天为基准，前30天 + 后30天 的快照模拟数据。
 * - 以当前资产条目为基础，每天每项按小波动产生新值，写入 asset_history (action='snapshot')
 * - 若某天已经存在 snapshot，则会跳过（幂等）
 * 用法: node scripts/generateMockSnapshots.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'assets.db'));
db.pragma('journal_mode = WAL');

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// 简单的可复现伪随机
function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let x = s || 1;
  return function () {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

const DAYS_BEFORE = 30;
const DAYS_AFTER = 30;

function categoryDrift(name) {
  const map = {
    存款: 0.002,
    投资资产: 0.012,
    其他资产: 0.004,
    外部借款: 0.002,
  };
  return map[name] || 0.005;
}

const today = todayStr();

const assets = db.prepare('SELECT * FROM assets ORDER BY id ASC').all();
if (assets.length === 0) {
  console.log('没有资产条目，请先执行 seed.js');
  process.exit(0);
}

// 找出当前数据库中已存在的 snapshot 日期
const existingDates = new Set(
  db
    .prepare(
      "SELECT DISTINCT snapshot_date AS d FROM asset_history WHERE action = 'snapshot'"
    )
    .all()
    .map((r) => r.d)
);

const insertSnapshot = db.prepare(`
  INSERT INTO asset_history
    (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount)
  VALUES (?, 'snapshot', ?, ?, ?, ?, ?, ?, ?, ?)
`);

let insertedDays = 0;
let skippedDays = 0;

for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
  const date = shiftDate(today, offset);
  if (existingDates.has(date)) {
    skippedDays++;
    continue;
  }

  try {
    db.exec('BEGIN');

    // 读取前一天的 snapshot 作为 baseline（用于计算 change_amount）
    const prevDate = shiftDate(date, -1);
    const prevRows = db
      .prepare(
        "SELECT asset_id, value FROM asset_history WHERE snapshot_date = ? AND action = 'snapshot'"
      )
      .all(prevDate);
    const prevValues = {};
    prevRows.forEach((r) => (prevValues[r.asset_id] = Number(r.value || 0)));

    for (const a of assets) {
      const rnd = seededRandom(date + '|' + a.id + '|' + a.name);
      const base = Number(a.value || 0);
      const driftPerDay = categoryDrift(a.category) || 0.005;
      // 距离今天越远，扰动范围越大，但保持温和
      const driftDays = Math.abs(offset);
      const range = driftPerDay * Math.max(1, driftDays);
      const noise = (rnd() - 0.5) * 2; // -1 ~ 1
      let newValue = base + base * range * noise;
      // 保持外部借款为负
      if (base < 0 && newValue > 0) newValue = base * 0.95;
      newValue = Math.round(newValue * 100) / 100;
      const changeAmount =
        prevValues[a.id] != null ? newValue - prevValues[a.id] : null;

      insertSnapshot.run(
        a.id,
        date,
        a.category,
        a.name,
        newValue,
        a.purchase_date || null,
        a.purchase_price != null ? a.purchase_price : null,
        a.remark || null,
        changeAmount
      );
    }

    db.exec('COMMIT');
    insertedDays++;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error('写入失败', date, e);
    process.exit(1);
  }
}

console.log(
  `完成：新增 ${insertedDays} 天快照（跳过 ${skippedDays} 天，共覆盖 ${
    DAYS_BEFORE + DAYS_AFTER + 1
  } 天范围）`
);
