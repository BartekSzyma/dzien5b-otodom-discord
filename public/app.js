import { renderSummary, renderDistricts, renderScatter } from "./render.js";

let metric = "cenaM2";

// Escapowanie wartosci uzytkownika/otodom przed wstawieniem do innerHTML.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadWojewodztwa() {
  const list = await (await fetch("/api/wojewodztwa")).json();
  const sel = document.getElementById("woj");
  sel.innerHTML = list.map((w) => `<option value="${esc(w.slug)}">${esc(w.label)}</option>`).join("");
}

async function loadCities() {
  const cities = await (await fetch("/api/cities")).json();
  const sel = document.getElementById("city-filter");
  const current = sel.value;
  sel.innerHTML = '<option value="">wszystkie</option>' +
    cities.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("");
  sel.value = current;
}

async function loadListings() {
  const city = document.getElementById("city-filter").value;
  const url = city ? `/api/listings?city=${encodeURIComponent(city)}` : "/api/listings";
  const offers = await (await fetch(url)).json();
  renderSummary(offers);
  renderDistricts(offers, metric);
  renderScatter(offers);
}

document.getElementById("fetch-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("fetch-btn");
  const msg = document.getElementById("fetch-msg");
  const city = document.getElementById("city").value.trim();
  const wojewodztwo = document.getElementById("woj").value;
  btn.disabled = true; btn.textContent = "Pobieram...";
  msg.hidden = false; msg.textContent = "Pobieranie ofert (kilka sekund)...";
  try {
    const r = await fetch("/api/fetch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, wojewodztwo }),
    });
    const data = await r.json();
    msg.textContent = data.message;
    await loadCities();
    await loadListings();
  } catch (err) {
    msg.textContent = "Blad polaczenia: " + err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Pobierz 10 najnowszych";
  }
});

document.getElementById("city-filter").addEventListener("change", loadListings);
document.getElementById("metric-toggle").addEventListener("click", (e) => {
  metric = metric === "cenaM2" ? "cena" : "cenaM2";
  e.target.textContent = metric === "cenaM2" ? "Pokaz cene calkowita" : "Pokaz cene za m2";
  loadListings();
});

await loadWojewodztwa();
await loadCities();
await loadListings();
