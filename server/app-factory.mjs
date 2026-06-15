import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slugify } from "./slug.js";
import { WOJEWODZTWA, isValidWojewodztwo } from "./wojewodztwa.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Zaleznosci wstrzykiwane: db, fetchListings, ensureChannel, postListings, discordConfigured().
export function createApp({ db, fetchListings, ensureChannel, postListings, discordConfigured }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "..", "public")));

  const inFlight = new Set(); // blokada per slug miasta (anty-duplikat na Discord)

  app.get("/api/wojewodztwa", (_req, res) => res.json(WOJEWODZTWA));
  app.get("/api/cities", (_req, res) => res.json(db.getCities()));
  app.get("/api/listings", (req, res) => {
    const city = req.query.city ? slugify(String(req.query.city)) : undefined;
    res.json(db.getListings(city));
  });

  app.post("/api/fetch", async (req, res) => {
    const rawCity = String(req.body?.city ?? "").trim();
    const woj = String(req.body?.wojewodztwo ?? "").trim();
    const citySlug = slugify(rawCity);

    if (!rawCity || rawCity.length > 60 || !citySlug) {
      return res.status(400).json({ status: "bad_request", message: "Podaj poprawna nazwe miasta." });
    }
    if (!isValidWojewodztwo(woj)) {
      return res.status(400).json({ status: "bad_request", message: "Wybierz wojewodztwo z listy." });
    }
    if (inFlight.has(citySlug)) {
      return res.status(409).json({ status: "busy", message: "Pobieranie dla tego miasta juz trwa." });
    }

    inFlight.add(citySlug);
    try {
      const { status, items } = await fetchListings(citySlug, woj, 10);
      if (status === "blocked") {
        return res.json({ status, fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Otodom zablokowal zapytanie (DataDome) lub blad sieci. Sprobuj pozniej." });
      }
      if (status === "parse_failed") {
        return res.json({ status, fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Nie udalo sie odczytac danych z otodom." });
      }
      if (status === "empty" || items.length === 0) {
        return res.json({ status: "empty", fetched: 0, new: 0, channel: null, discordOk: false,
          message: "Brak ofert dla tego miasta (sprawdz pisownie; dziala dla miast na prawach powiatu)." });
      }

      const city = db.ensureCity({ name: rawCity, slug: citySlug, wojewodztwo: woj });
      const fresh = db.upsertListings(city.id, items);

      // Discord nieskonfigurowany: zapis do bazy OK, wysylka pominieta (niezaleznie od liczby nowych).
      if (!discordConfigured()) {
        return res.json({ status: "discord_unconfigured", fetched: items.length, new: fresh.length,
          channel: null, discordOk: false,
          message: `Pobrano ${items.length}, nowych ${fresh.length}. Discord nieskonfigurowany - oferty w bazie.` });
      }
      if (fresh.length === 0) {
        return res.json({ status: "ok", fetched: items.length, new: 0, channel: null, discordOk: true,
          message: `Pobrano ${items.length}, nowych 0.` });
      }
      try {
        const cityRow = db.getCityBySlug(citySlug);
        const ch = await ensureChannel(db, cityRow);
        await postListings(ch, fresh);
        return res.json({ status: "ok", fetched: items.length, new: fresh.length, channel: ch.name,
          discordOk: true, message: `Pobrano ${items.length}, nowych ${fresh.length}, kanal #${ch.name}.` });
      } catch (e) {
        return res.json({ status: "ok", fetched: items.length, new: fresh.length, channel: null,
          discordOk: false,
          message: `Pobrano ${items.length}, nowych ${fresh.length}. Zapisano w bazie, ale wysylka na Discord sie nie udala.` });
      }
    } catch (e) {
      return res.status(500).json({ status: "error", message: "Blad serwera: " + e.message });
    } finally {
      inFlight.delete(citySlug);
    }
  });

  return app;
}
