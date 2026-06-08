const express = require("express");
const db = require("../db");

const router = express.Router();

// ---------- 工具函数 ----------
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function validate(body, requireId = false) {
  const { category, name, value, purchase_date, purchase_price, remark } =
    body || {};
  if (requireId && !body.id)
    throw Object.assign(new Error("id 是必填字段"), { status: 400 });
  if (!category || !String(category).trim())
    throw Object.assign(new Error("资产类别为必填项"), { status: 400 });
  if (!name || !String(name).trim())
    throw Object.assign(new Error("资产名称为必填项"), { status: 400 });
  const numValue = Number(value);
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    Number.isNaN(numValue)
  ) {
    throw Object.assign(new Error("当前价值必须是有效数字"), { status: 400 });
  }
  let purchasePrice = null;
  if (
    purchase_price !== undefined &&
    purchase_price !== "" &&
    purchase_price !== null
  ) {
    const n = Number(purchase_price);
    if (Number.isNaN(n))
      throw Object.assign(new Error("购买价格必须是数字"), { status: 400 });
    purchasePrice = n;
  }
  return {
    category: String(category).trim(),
    name: String(name).trim(),
    value: numValue,
    purchase_date: purchase_date || null,
    purchase_price: purchasePrice,
    remark: remark || null,
  };
}

// 写入一条历史记录
const insertHistoryStmt = db.prepare(`
  INSERT INTO asset_history
    (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function recordHistory({
  asset_id,
  action,
  category,
  name,
  value,
  purchase_date,
  purchase_price,
  remark,
  change_amount,
}) {
  insertHistoryStmt.run(
    asset_id,
    action,
    todayStr(),
    category,
    name,
    value,
    purchase_date || null,
    purchase_price !== undefined ? purchase_price : null,
    remark || null,
    change_amount !== undefined ? change_amount : null,
  );
}

// 计算截止某日期的资产快照
function snapshotAt(dateStr) {
  // 对每个 asset_id，取 <= dateStr 当天 23:59:59 的最后一条记录
  // 如果当天无记录，往前找最近一次；如果最后状态是 delete 则剔除
  const upper = `${dateStr} 23:59:59`;
  const rows = db
    .prepare(
      `
      SELECT h.*
      FROM asset_history h
      INNER JOIN (
        SELECT asset_id, MAX(recorded_at) AS max_at
        FROM asset_history
        WHERE recorded_at <= ?
        GROUP BY asset_id
      ) m ON h.asset_id = m.asset_id AND h.recorded_at = m.max_at
      WHERE h.action != 'delete'
      ORDER BY h.recorded_at DESC
      `,
    )
    .all(upper);
  return rows;
}

// 按分类聚合
function aggregateByCategory(assets) {
  const map = new Map();
  for (const a of assets) {
    map.set(a.category, (map.get(a.category) || 0) + Number(a.value || 0));
  }
  const arr = [];
  map.forEach((sum, category) => arr.push({ category, sum }));
  return arr.sort((x, y) => y.sum - x.sum);
}

// 日期序列生成
function dateRange(start, end) {
  const out = [];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e)
    return out;
  const cur = new Date(s);
  while (cur <= e) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ---------- 原 CRUD ----------
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM assets ORDER BY id ASC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const data = validate(req.body);
  const info = db
    .prepare(
      "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      data.category,
      data.name,
      data.value,
      data.purchase_date,
      data.purchase_price,
      data.remark,
    );
  const assetId = info.lastInsertRowid;
  recordHistory({
    asset_id: assetId,
    action: "create",
    category: data.category,
    name: data.name,
    value: data.value,
    purchase_date: data.purchase_date,
    purchase_price: data.purchase_price,
    remark: data.remark,
    change_amount: data.value,
  });
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(assetId);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "未找到该资产条目" });
  const data = validate(req.body);
  db.prepare(
    `UPDATE assets SET category = ?, name = ?, value = ?, purchase_date = ?, purchase_price = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(
    data.category,
    data.name,
    data.value,
    data.purchase_date,
    data.purchase_price,
    data.remark,
    id,
  );
  const oldValue = Number(existing.value || 0);
  recordHistory({
    asset_id: id,
    action: "update",
    category: data.category,
    name: data.name,
    value: data.value,
    purchase_date: data.purchase_date,
    purchase_price: data.purchase_price,
    remark: data.remark,
    change_amount: Number(data.value) - oldValue,
  });
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "未找到该资产条目" });
  const oldValue = Number(existing.value || 0);
  db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  recordHistory({
    asset_id: id,
    action: "delete",
    category: existing.category,
    name: existing.name,
    value: 0,
    purchase_date: existing.purchase_date,
    purchase_price: existing.purchase_price,
    remark: existing.remark,
    change_amount: 0 - oldValue,
  });
  res.json({ success: true, id });
});

// ---------- 新增：历史 / 快照 / 趋势 / 变更 ----------
router.get("/snapshot", (req, res) => {
  const date = parseDate(req.query.date) || todayStr();
  const assets = snapshotAt(date);
  // 如果这一天完全没有历史数据，fallback 到当前 assets 表（视为今天的快照）
  let list = assets;
  if (list.length === 0 && date === todayStr()) {
    list = db.prepare("SELECT * FROM assets ORDER BY id ASC").all();
  }
  const total = list.reduce((s, r) => s + Number(r.value || 0), 0);
  const byCategory = aggregateByCategory(list);
  res.json({ date, assets: list, total, by_category: byCategory });
});

router.get("/snapshots", (req, res) => {
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end) || todayStr();
  const granularity = req.query.granularity === "month" ? "month" : "day";
  if (!start)
    return res.status(400).json({ error: "start 参数必须是 YYYY-MM-DD" });
  if (start > end) return res.status(400).json({ error: "start 不能晚于 end" });

  const allCatRows = db
    .prepare(
      `SELECT DISTINCT category FROM asset_history WHERE snapshot_date BETWEEN ? AND ?
       UNION
       SELECT DISTINCT category FROM assets`,
    )
    .all(start, end);
  const categories = allCatRows.map((r) => r.category).filter(Boolean);

  let buckets;
  let labels = [];
  if (granularity === "month") {
    const set = new Set();
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    const cur = new Date(s.getFullYear(), s.getMonth(), 1);
    while (cur <= e) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      set.add(`${y}-${m}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    buckets = [...set].map((key) => {
      const [y, m] = key.split("-");
      const endDay = new Date(Number(y), Number(m), 0).getDate();
      return {
        key,
        label: key,
        dateEnd: `${key}-${String(endDay).padStart(2, "0")}`,
      };
    });
    labels = buckets.map((b) => b.label);
  } else {
    const dates = dateRange(start, end);
    buckets = dates.map((d) => ({ key: d, label: d, dateEnd: d }));
    labels = dates;
  }

  const totals = [];
  const byCategoryMap = new Map(categories.map((c) => [c, []]));

  for (const bucket of buckets) {
    const snap = snapshotAt(bucket.dateEnd);
    let total = 0;
    const catSum = new Map();
    for (const a of snap) {
      const v = Number(a.value || 0);
      total += v;
      catSum.set(a.category, (catSum.get(a.category) || 0) + v);
    }
    totals.push(total);
    for (const c of categories) {
      byCategoryMap.get(c).push(catSum.get(c) || 0);
    }
  }

  const by_category = categories
    .map((c) => ({ category: c, values: byCategoryMap.get(c) }))
    .filter((x) => x.values.some((v) => v !== 0));

  res.json({ granularity, dates: labels, totals, by_category });
});

router.get("/:id/history", (req, res) => {
  const id = Number(req.params.id);
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end);
  let rows;
  if (start && end) {
    rows = db
      .prepare(
        `SELECT * FROM asset_history WHERE asset_id = ? AND snapshot_date BETWEEN ? AND ? ORDER BY recorded_at ASC`,
      )
      .all(id, start, end);
  } else {
    rows = db
      .prepare(
        `SELECT * FROM asset_history WHERE asset_id = ? ORDER BY recorded_at ASC`,
      )
      .all(id);
  }
  res.json({ id, history: rows });
});

router.get("/changes", (req, res) => {
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end) || todayStr();
  if (!start)
    return res.status(400).json({ error: "start 参数必须是 YYYY-MM-DD" });
  const rows = db
    .prepare(
      `SELECT * FROM asset_history WHERE snapshot_date BETWEEN ? AND ? ORDER BY recorded_at ASC`,
    )
    .all(start, end);

  const dailyMap = new Map();
  const byCatMap = new Map();
  const byItemMap = new Map();
  for (const r of rows) {
    const ch = Number(r.change_amount || 0);
    const d = r.snapshot_date;
    dailyMap.set(d, (dailyMap.get(d) || 0) + ch);
    byCatMap.set(r.category, (byCatMap.get(r.category) || 0) + ch);
    byItemMap.set(r.name, (byItemMap.get(r.name) || 0) + ch);
  }
  const daily = [...dailyMap.entries()]
    .map(([date, change]) => ({ date, change }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const by_category = [...byCatMap.entries()]
    .map(([category, change]) => ({ category, change }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const top_items = [...byItemMap.entries()]
    .map(([name, change]) => ({ name, change }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);

  res.json({ daily, by_category, top_items });
});

// 原有 get by id —— 必须放在最后以避免与 /snapshot /snapshots 等冲突
router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM assets WHERE id = ?")
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "未找到该资产条目" });
  res.json(row);
});

module.exports = router;
