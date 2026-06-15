export function formatInt(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPLN(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return formatInt(n) + " zł";
}

export function formatM2(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return n.toString().replace(".", ",") + " m²";
}
