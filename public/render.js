import { formatPLN, formatInt, formatM2 } from "./format.js";
import { summary, statsByDistrict } from "./stats.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const empty = (msg) => `<div class="empty">${msg}</div>`;
// Escapowanie danych z otodom przed wstawieniem do innerHTML (ochrona przed XSS).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderSummary(offers) {
  const s = summary(offers);
  const box = document.getElementById("summary");
  const kpi = (val, lab) => `<div class="kpi"><div class="val">${val}</div><div class="lab">${lab}</div></div>`;
  box.innerHTML =
    kpi(formatInt(s.count), "ofert") +
    kpi(formatPLN(s.medianCena), "mediana ceny") +
    kpi(s.medianCenaM2 == null ? "-" : formatInt(s.medianCenaM2) + " zł/m²", "mediana ceny/m²") +
    kpi(formatM2(s.medianPowierzchnia), "mediana metrażu");
}

export function renderDistricts(offers, metric = "cenaM2") {
  const host = document.getElementById("chart-districts");
  const rows = statsByDistrict(offers, metric);
  if (rows.length === 0) { host.innerHTML = empty("Brak ofert dla wybranych filtrów"); return; }

  const W = 720, rowH = 30, pad = 160, max = Math.max(...rows.map((r) => r.value));
  const H = rows.length * rowH + 20;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  rows.forEach((r, i) => {
    const y = i * rowH + 10;
    const w = max > 0 ? (W - pad - 20) * (r.value / max) : 0;
    const label = el("text", { x: 0, y: y + 16, fill: "#a89fd6", "font-size": "13" });
    label.textContent = r.dzielnica || "brak dzielnicy";
    svg.appendChild(label);
    const bar = el("rect", { x: pad, y, width: w, height: rowH - 10, rx: 6, fill: "url(#grad)", class: "bar" });
    bar.addEventListener("mousemove", (e) => showTip(e,
      `<b>${esc(r.dzielnica || "brak dzielnicy")}</b><br>mediana: ${formatInt(r.value)}<br>ofert: ${r.count}<br>zakres: ${formatInt(r.min)} - ${formatInt(r.max)}`));
    bar.addEventListener("mouseleave", hideTip);
    svg.appendChild(bar);
    const val = el("text", { x: pad + w + 6, y: y + 16, fill: "#f3f0ff", "font-size": "12", "font-weight": "700" });
    val.textContent = formatInt(r.value);
    svg.appendChild(val);
  });
  const defs = el("defs");
  const grad = el("linearGradient", { id: "grad", x1: "0", x2: "1", y1: "0", y2: "0" });
  grad.appendChild(el("stop", { offset: "0", "stop-color": "#7a2dff" }));
  grad.appendChild(el("stop", { offset: "1", "stop-color": "#ff2d95" }));
  defs.appendChild(grad); svg.appendChild(defs);
  host.replaceChildren(svg);
}

const ROOM_COLORS = { "1": "#00e5ff", "2": "#b6ff00", "3": "#ff2d95", "4+": "#7a2dff" };
const bucket = (p) => (p >= 4 ? "4+" : String(p));

export function renderScatter(offers) {
  const host = document.getElementById("chart-scatter");
  const pts = offers.filter((o) => typeof o.powierzchnia === "number" && typeof o.cena === "number");
  if (pts.length === 0) { host.innerHTML = empty("Brak ofert dla wybranych filtrów"); return; }

  const W = 720, H = 420, m = 50;
  const xs = pts.map((o) => o.powierzchnia), ys = pts.map((o) => o.cena);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const sx = (v) => m + (W - 2 * m) * ((v - xMin) / (xMax - xMin || 1));
  const sy = (v) => H - m - (H - 2 * m) * ((v - yMin) / (yMax - yMin || 1));

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  svg.appendChild(el("line", { x1: m, y1: H - m, x2: W - m, y2: H - m, stroke: "#3a3260" }));
  svg.appendChild(el("line", { x1: m, y1: m, x2: m, y2: H - m, stroke: "#3a3260" }));
  for (const o of pts) {
    const c = el("circle", { cx: sx(o.powierzchnia), cy: sy(o.cena), r: 6,
      fill: ROOM_COLORS[bucket(o.pokoje)] || "#888", class: "dot" });
    c.addEventListener("click", () => window.open(o.link, "_blank"));
    c.addEventListener("mousemove", (e) => showTip(e,
      `<b>${esc(o.tytul)}</b><br>${esc(o.dzielnica || "brak dzielnicy")}<br>${formatPLN(o.cena)} &middot; ${formatM2(o.powierzchnia)} &middot; ${o.pokoje} pok.`));
    c.addEventListener("mouseleave", hideTip);
    svg.appendChild(c);
  }
  host.replaceChildren(svg);
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = Object.entries(ROOM_COLORS)
    .map(([k, v]) => `<span><i style="background:${v}"></i>${k} pok.</span>`).join("");
  host.appendChild(legend);
}

function showTip(e, html) {
  const t = document.getElementById("tooltip");
  t.innerHTML = html; t.hidden = false;
  t.style.left = e.clientX + 14 + "px"; t.style.top = e.clientY + 14 + "px";
}
function hideTip() { document.getElementById("tooltip").hidden = true; }
