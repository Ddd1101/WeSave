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
  const s = String(value).trim();
  // 纯年份（如 "2023"）→ "2023年"
  if (/^\d{4}$/.test(s)) return s + "年";
  // 年-月（如 "2023-06"）→ "2023年06月"
  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const [y, m] = s.split("-");
    return `${y}年${m.padStart(2, "0")}月`;
  }
  // 完整日期（如 "2023-06-09"、"2023/06/09"）→ "2023-06-09"
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s;
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
