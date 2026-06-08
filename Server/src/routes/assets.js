const express = require("express");
const db = require("../db");

const router = express.Router();

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

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM assets ORDER BY id ASC").all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM assets WHERE id = ?")
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "未找到该资产条目" });
  res.json(row);
});

router.post("/", (req, res) => {
  const data = validate(req.body);
  const stmt = db.prepare(
    "INSERT INTO assets (category, name, value, purchase_date, purchase_price, remark) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const result = stmt.run(
    data.category,
    data.name,
    data.value,
    data.purchase_date,
    data.purchase_price,
    data.remark,
  );
  const row = db
    .prepare("SELECT * FROM assets WHERE id = ?")
    .get(result.lastInsertRowid);
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
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  if (info.changes === 0)
    return res.status(404).json({ error: "未找到该资产条目" });
  res.json({ success: true, id });
});

module.exports = router;
