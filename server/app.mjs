import "dotenv/config";
import { createApp } from "./app-factory.mjs";
import { openDb } from "./db.mjs";
import { fetchListings } from "./otodom.mjs";
import { ensureChannel, postListings, initDiscordAtStartup } from "./discord.mjs";

const PORT = process.env.PORT || 3000;
const db = openDb("data/app.db");

const app = createApp({
  db, fetchListings, ensureChannel, postListings,
  discordConfigured: () => !!process.env.DISCORD_TOKEN,
});

await initDiscordAtStartup(); // loguj bota przy starcie (jesli token jest)
app.listen(PORT, () => console.log(`Serwer dziala: http://localhost:${PORT}`));
