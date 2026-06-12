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
// 对每个 asset_id，取 <= dateStr 的最后一条 snapshot_date 的记录
// 如果当天/之前无 snapshot 记录，再从最新的 create/update 记录中取最后一次的值（确保空区间也能显示当前资产价值）
function snapshotAt(dateStr) {
  const rows = db
    .prepare(
      `
      SELECT h.*
      FROM asset_history h
      INNER JOIN (
        SELECT asset_id,
               COALESCE(
                 MAX(CASE WHEN action = 'snapshot' AND snapshot_date <= ? THEN snapshot_date END),
                 MAX(CASE WHEN action IN ('create','update') AND recorded_at <= ? THEN recorded_at END)
               ) AS key_date
        FROM asset_history
        GROUP BY asset_id
      ) m
        ON h.asset_id = m.asset_id
        AND m.key_date IS NOT NULL
        AND (
             (h.action = 'snapshot' AND h.snapshot_date = m.key_date)
          OR (h.action IN ('create','update') AND h.recorded_at = m.key_date)
        )
      WHERE h.action != 'delete'
      ORDER BY h.id ASC
      `,
    )
    .all(dateStr, dateStr);
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
// 获取已录入过快照的所有日期（降序）
router.get("/dates", (req, res) => {
  const rows = db
    .prepare(
      "SELECT DISTINCT snapshot_date AS date FROM asset_history WHERE snapshot_date IS NOT NULL ORDER BY date DESC",
    )
    .all();
  res.json({ dates: rows.map((r) => r.date) });
});

// 获取某天快照（仅从 asset_history 读取，不再 fallback 到主表）
router.get("/snapshot", (req, res) => {
  const date = parseDate(req.query.date) || todayStr();
  const rows = db
    .prepare(
      "SELECT * FROM asset_history WHERE snapshot_date = ? AND action = 'snapshot' ORDER BY id ASC",
    )
    .all(date);
  const assets = rows.map((r) => ({
    id: r.asset_id,
    category: r.category,
    name: r.name,
    value: r.value,
    purchase_date: r.purchase_date,
    purchase_price: r.purchase_price,
    remark: r.remark,
    change_amount: r.change_amount,
  }));
  const total = assets.reduce((s, r) => s + Number(r.value || 0), 0);
  const byCategory = aggregateByCategory(assets);
  res.json({ date, assets, total, by_category: byCategory });
});

// 批量保存某天快照
router.post("/batch-snapshot", (req, res) => {
  const date = parseDate(req.query.date);
  if (!date)
    return res.status(400).json({ error: "date 参数必须是 YYYY-MM-DD 格式" });
  const assets = Array.isArray(req.body.assets) ? req.body.assets : [];
  const isToday = date === todayStr();

  // 校验
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (!a || !a.category || !String(a.category).trim()) {
      return res.status(400).json({ error: `第 ${i + 1} 项：类别不能为空` });
    }
    if (!a.name || !String(a.name).trim()) {
      return res
        .status(400)
        .json({ error: `第 ${i + 1} 项：资产名称不能为空` });
    }
    const numValue = Number(a.value);
    if (!Number.isFinite(numValue)) {
      return res
        .status(400)
        .json({ error: `第 ${i + 1} 项：当前价值必须是有效数字` });
    }
  }

  try {
    db.exec("BEGIN");

    // 删除该日期的旧快照
    db.prepare(
      "DELETE FROM asset_history WHERE snapshot_date = ? AND action = 'snapshot'",
    ).run(date);

    // 处理每一项资产
    const results = [];
    const insertHist = db.prepare(`
      INSERT INTO asset_history
        (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount)
      VALUES (?, 'snapshot', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of assets) {
      const category = String(a.category).trim();
      const name = String(a.name).trim();
      const value = Number(a.value);
      let purchaseDate = a.purchase_date || null;
      let purchasePrice =
        a.purchase_price !== undefined &&
        a.purchase_price !== "" &&
        a.purchase_price !== null
          ? Number(a.purchase_price)
          : null;
      const remark = a.remark || null;

      let assetId = null;
      let existingAsset = null;
      if (a.id) {
        existingAsset = db
          .prepare("SELECT * FROM assets WHERE id = ?")
          .get(Number(a.id));
        if (existingAsset) {
          assetId = existingAsset.id;
        }
      }

      // 若无 id 或 id 无效：按 category+name 精确匹配已有资产，避免重复创建，并继承购买信息
      if (!assetId) {
        existingAsset = db
          .prepare(
            "SELECT * FROM assets WHERE category = ? AND name = ? ORDER BY id ASC LIMIT 1",
          )
          .get(category, name);
        if (existingAsset) {
          assetId = existingAsset.id;
        }
      }

      // 若表单中 purchase_date / purchase_price 为空，但已有资产有这些字段，则继承
      if (existingAsset) {
        if (!purchaseDate && existingAsset.purchase_date) {
          purchaseDate = existingAsset.purchase_date;
        }
        if (
          purchasePrice === null &&
          existingAsset.purchase_price !== null &&
          existingAsset.purchase_price !== undefined &&
          existingAsset.purchase_price !== ""
        ) {
          purchasePrice = Number(existingAsset.purchase_price);
        }
      }

      if (assetId) {
        // 更新已有资产（只有今天才同步更新主表；历史日期仅写入快照历史）
        if (isToday) {
          db.prepare(
            "UPDATE assets SET category = ?, name = ?, value = ?, purchase_date = ?, purchase_price = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(
            category,
            name,
            value,
            purchaseDate,
            purchasePrice,
            remark,
            assetId,
          );
        }
      } else {
        // 全新资产：插入主表
        const info = db
          .prepare(
            "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(category, name, value, purchaseDate, purchasePrice, remark);
        assetId = info.lastInsertRowid;
      }

      // 计算 change_amount：相对上一个日期（snapshot_date < date）该资产最后一次快照值
      const prevRecord = db
        .prepare(
          `
        SELECT value FROM asset_history
        WHERE asset_id = ? AND snapshot_date < ? AND action = 'snapshot'
        ORDER BY snapshot_date DESC, recorded_at DESC LIMIT 1
      `,
        )
        .get(assetId, date);
      const changeAmount = prevRecord ? value - Number(prevRecord.value) : null;

      // 插入历史记录
      insertHist.run(
        assetId,
        date,
        category,
        name,
        value,
        purchaseDate,
        purchasePrice,
        remark,
        changeAmount,
      );

      results.push({
        id: assetId,
        category,
        name,
        value,
        purchase_date: purchaseDate,
        purchase_price: purchasePrice,
        remark,
        change_amount: changeAmount,
      });
    }

    db.exec("COMMIT");

    const total = results.reduce((s, r) => s + Number(r.value || 0), 0);
    const byCategory = aggregateByCategory(results);
    res.json({ date, assets: results, total, by_category: byCategory });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch (_) {}
    console.error("[batch-snapshot] 事务回滚：", err);
    res.status(500).json({
      error: err && err.message ? err.message : "保存失败",
    });
  }
});

router.get("/snapshots", (req, res) => {
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end) || todayStr();
  const g = String(req.query.granularity || "day").toLowerCase();
  const granularity = g === "month" ? "month" : g === "week" ? "week" : "day";
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
  } else if (granularity === "week") {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    // 以每周的星期日为桶结束日，labels 使用周结束日 YYYY-MM-DD
    const bucketsList = [];
    // 先找到第一个 ≥ start 的周日（或等于 end 的日期）
    const first = new Date(s);
    const dayOfWeek = first.getDay(); // 0=Sun..6=Sat
    const diffToSun = (7 - dayOfWeek) % 7;
    first.setDate(first.getDate() + diffToSun);
    // 如果 first 比 start 还小一周内，保持为 first；若 first > e，则只取 end
    let cur = new Date(first);
    if (cur.getTime() < s.getTime()) cur.setDate(cur.getDate() + 7);
    while (cur.getTime() <= e.getTime()) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      bucketsList.push({
        key: `${y}-${m}-${d}`,
        label: `${y}-${m}-${d}`,
        dateEnd: `${y}-${m}-${d}`,
      });
      cur.setDate(cur.getDate() + 7);
    }
    // 确保最后一个桶至少覆盖到 end
    const last = bucketsList[bucketsList.length - 1];
    if (!last || last.dateEnd < end) {
      const ye = e.getFullYear();
      const me = String(e.getMonth() + 1).padStart(2, "0");
      const de = String(e.getDate()).padStart(2, "0");
      bucketsList.push({
        key: `${ye}-${me}-${de}`,
        label: `${ye}-${me}-${de}`,
        dateEnd: `${ye}-${me}-${de}`,
      });
    }
    buckets = bucketsList;
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
  // 仅返回 snapshot 类型的历史，用于细项走势；避免 create/update/delete 混入
  const baseSql =
    "SELECT asset_id, snapshot_date, value FROM asset_history WHERE asset_id = ? AND action = 'snapshot'";
  if (start && end) {
    rows = db
      .prepare(
        `${baseSql} AND snapshot_date BETWEEN ? AND ? ORDER BY snapshot_date ASC`,
      )
      .all(id, start, end);
  } else {
    rows = db.prepare(`${baseSql} ORDER BY snapshot_date ASC`).all(id);
  }
  const history = rows.map((r) => ({
    asset_id: r.asset_id,
    snapshot_date: r.snapshot_date,
    value: Number(r.value),
  }));
  res.json({ id, history });
});

router.get("/changes", (req, res) => {
  const start = parseDate(req.query.start);
  const end = parseDate(req.query.end) || todayStr();
  if (!start)
    return res.status(400).json({ error: "start 参数必须是 YYYY-MM-DD" });
  // 只统计快照动作的变化；create/update/delete 的变化量意义不同（且会重复计入）
  const rows = db
    .prepare(
      `SELECT * FROM asset_history WHERE action = 'snapshot' AND snapshot_date BETWEEN ? AND ? ORDER BY snapshot_date ASC`,
    )
    .all(start, end);

  const dailyMap = new Map();
  const byCatMap = new Map();
  const byItemMap = new Map();
  for (const r of rows) {
    const ch = Number(r.change_amount || 0);
    if (ch === 0) continue;
    const d = r.snapshot_date;
    dailyMap.set(d, (dailyMap.get(d) || 0) + ch);
    byCatMap.set(r.category, (byCatMap.get(r.category) || 0) + ch);
    const key = String(r.asset_id || r.name);
    const existing = byItemMap.get(key);
    if (existing) {
      existing.change += ch;
    } else {
      byItemMap.set(key, {
        id: r.asset_id || null,
        name: r.name,
        change: ch,
      });
    }
  }
  const daily = [...dailyMap.entries()]
    .map(([date, change]) => ({ date, change }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const by_category = [...byCatMap.entries()]
    .map(([category, change]) => ({ category, change }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const top_items = [...byItemMap.values()]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 10);

  res.json({ daily, by_category, top_items });
});

// 生成以今天为基准的前后 N 天模拟快照数据
router.post("/generate-mock", (req, res) => {
  const daysBefore = Math.min(
    180,
    Math.max(1, Number(req.query.days_before || req.body?.days_before || 30)),
  );
  const daysAfter = Math.min(
    180,
    Math.max(0, Number(req.query.days_after || req.body?.days_after || 30)),
  );
  const force =
    String(req.query.force || req.body?.force || "false").toLowerCase() ===
    "true";

  const assets = db.prepare("SELECT * FROM assets ORDER BY id ASC").all();
  if (assets.length === 0) {
    return res.status(400).json({ error: "请先创建资产条目后再生成模拟数据" });
  }

  const today = todayStr();

  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(
      dt.getDate(),
    )}`;
  }
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
  function categoryDrift(name) {
    const map = {
      存款: 0.002,
      投资资产: 0.012,
      其他资产: 0.004,
      外部借款: 0.002,
    };
    return map[name] || 0.005;
  }

  // 找出已存在的 snapshot 日期
  const existingRows = db
    .prepare(
      "SELECT DISTINCT snapshot_date AS d FROM asset_history WHERE action = 'snapshot'",
    )
    .all();
  const existingDates = new Set(existingRows.map((r) => r.d));

  const insertStmt = db.prepare(`
    INSERT INTO asset_history
      (asset_id, action, snapshot_date, category, name, value, purchase_date, purchase_price, remark, change_amount)
    VALUES (?, 'snapshot', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;

  try {
    db.exec("BEGIN");
    for (let offset = -daysBefore; offset <= daysAfter; offset++) {
      const date = shiftDate(today, offset);
      if (existingDates.has(date) && !force) {
        skipped++;
        continue;
      }

      const prevDate = shiftDate(date, -1);
      const prevRows = db
        .prepare(
          "SELECT asset_id, value FROM asset_history WHERE snapshot_date = ? AND action = 'snapshot'",
        )
        .all(prevDate);
      const prevValues = {};
      prevRows.forEach((r) => (prevValues[r.asset_id] = Number(r.value || 0)));

      for (const a of assets) {
        const rnd = seededRandom(date + "|" + a.id + "|" + a.name);
        const base = Number(a.value || 0);
        const driftPerDay = categoryDrift(a.category) || 0.005;
        const driftDays = Math.abs(offset);
        const range = driftPerDay * Math.max(1, driftDays);
        const noise = (rnd() - 0.5) * 2;
        let newValue = base + base * range * noise;
        if (base < 0 && newValue > 0) newValue = base * 0.95;
        newValue = Math.round(newValue * 100) / 100;
        const changeAmount =
          prevValues[a.id] != null ? newValue - prevValues[a.id] : null;
        insertStmt.run(
          a.id,
          date,
          a.category,
          a.name,
          newValue,
          a.purchase_date || null,
          a.purchase_price != null ? a.purchase_price : null,
          a.remark || null,
          changeAmount,
        );
      }
      inserted++;
    }
    db.exec("COMMIT");
    res.json({
      ok: true,
      today,
      days_before: daysBefore,
      days_after: daysAfter,
      inserted,
      skipped,
    });
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch (_) {}
    console.error("[generate-mock]", e);
    res.status(500).json({ error: e.message || "生成失败" });
  }
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
