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

export function formatPercent(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits) + "%";
}

export function formatDate(value) {
  if (!value) return "-";
  return String(value);
}
