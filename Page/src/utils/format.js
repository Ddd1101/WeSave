export function formatCurrency(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  return (
    sign +
    "¥" +
    abs.toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatSignedCurrency(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  if (num === 0) return "¥0";
  const prefix = num > 0 ? "+" : "-";
  const abs = Math.abs(num);
  return (
    prefix +
    "¥" +
    abs.toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatPercent(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits) + "%";
}

export function formatSignedPercent(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return sign + num.toFixed(digits) + "%";
}

export function formatDate(value) {
  if (!value) return "-";
  return String(value);
}

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
