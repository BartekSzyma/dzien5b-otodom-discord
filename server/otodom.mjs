// Pobiera N najnowszych ofert z otodom.pl i zwraca tablice obiektow w ksztalcie
// dashboardu. Dane z bloku __NEXT_DATA__ (Next.js). Pola szczegolowe (rok, pietra,
// wspolrzedne) pochodza ze strony szczegolow kazdej oferty.
import { execFileSync } from "node:child_process";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function buildUrl(citySlug, wojSlug) {
  return (
    "https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/" +
    `${wojSlug}/${citySlug}/${citySlug}/${citySlug}` +
    "?by=LATEST&direction=DESC"
  );
}

// Systemowy curl.exe przechodzi ochrone DataDome (HTTP 200), inaczej niz prosty klient.
// --max-time 30: nie wisimy w nieskonczonosc; -L: podazaj za przekierowaniami.
function fetchHtml(url) {
  return execFileSync(
    "curl.exe",
    ["-s", "-L", "--max-time", "30", "--compressed", "-A", UA,
     "-H", "Accept-Language: pl-PL,pl;q=0.9,en;q=0.8", url],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  ).toString("utf8");
}

// Zwraca { status: "ok"|"blocked"|"parse_failed", data? }.
export function extractNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { status: "blocked" }; // brak bloku = captcha/blokada DataDome
  try {
    return { status: "ok", data: JSON.parse(m[1]) };
  } catch {
    return { status: "parse_failed" };
  }
}

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// "floor_8" -> 8, "ground_floor" -> 0, inne -> null.
function floorNum(v) {
  if (!v) return null;
  if (v === "ground_floor") return 0;
  const m = /^floor_(\d+)$/.exec(v);
  return m ? Number(m[1]) : null;
}

function district(it) {
  const locs = it?.location?.reverseGeocoding?.locations || [];
  const byLevel = {};
  for (const l of locs) byLevel[l.locationLevel] = l.name;
  return byLevel.residential || byLevel.district || byLevel.city_or_village || "";
}

export function mapItem(it, detail) {
  const ad = detail?.props?.pageProps?.ad || {};
  const ch = {};
  for (const c of ad.characteristics || []) ch[c.key] = c.value;
  const coords = ad?.location?.coordinates || {};
  return {
    id: String(it.id),
    tytul: String(it.title ?? ""),
    dzielnica: district(it),
    cena: toNum(it.totalPrice?.value),
    cenaM2: toNum(it.pricePerSquareMeter?.value),
    powierzchnia: toNum(it.areaInSquareMeters),
    pokoje: toNum(ch.rooms_num),
    pietro: floorNum(ch.floor_no),
    pieterWBudynku: toNum(ch.building_floors_num),
    rokBudowy: toNum(ch.build_year),
    lat: toNum(coords.latitude),
    lng: toNum(coords.longitude),
    liczbaZdjec: toNum(it.totalPossibleImages),
    link: ad.url || `https://www.otodom.pl/pl/oferta/${it.slug}`,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zwraca { status, items }. status: ok|empty|blocked|parse_failed.
export async function fetchListings(citySlug, wojSlug, count = 10) {
  let listHtml;
  try {
    listHtml = fetchHtml(buildUrl(citySlug, wojSlug));
  } catch (e) {
    console.error("[otodom] blad pobrania listy:", e.message);
    return { status: "blocked", items: [] }; // curl padl / timeout / brak sieci
  }
  const listRes = extractNextData(listHtml);
  if (listRes.status !== "ok") return { status: listRes.status, items: [] };

  const items = listRes.data?.props?.pageProps?.data?.searchAds?.items;
  if (!Array.isArray(items)) return { status: "parse_failed", items: [] };
  if (items.length === 0) return { status: "empty", items: [] };

  const top = items.slice(0, count);
  const out = [];
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    try {
      const detail = extractNextData(fetchHtml(`https://www.otodom.pl/pl/oferta/${it.slug}`));
      if (detail.status !== "ok") {
        console.error(`[otodom] pomijam oferte ${it.id}: szczegoly status=${detail.status}`);
        continue;
      }
      out.push(mapItem(it, detail.data));
    } catch (e) {
      console.error(`[otodom] pomijam oferte ${it.id}: ${e.message}`);
    }
    if (i < top.length - 1) await sleep(500); // grzeczna przerwa
  }
  // Lista miala oferty, ale zadnej nie udalo sie zmapowac (np. blokada na stronach
  // szczegolow) - to NIE jest pusty wynik, tylko prawdopodobna blokada.
  if (out.length === 0) return { status: "blocked", items: [] };
  return { status: "ok", items: out };
}
