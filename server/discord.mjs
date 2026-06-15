import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from "discord.js";
import { channelName } from "./slug.js";
import { formatPLN, formatInt, formatM2 } from "../public/format.js";

let clientPromise = null;

// Logowanie raz; brak tokena => null (Discord nieskonfigurowany).
export function getClient() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return null;
  if (!clientPromise) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    clientPromise = client.login(token).then(() => client);
  }
  return clientPromise;
}

// Wywolywane raz przy starcie serwera: jesli token jest, loguj bota od razu,
// by wczesnie wykryc zly token/guild id (a nie dopiero po scrapingu).
export async function initDiscordAtStartup() {
  const p = getClient();
  if (!p) { console.log("Discord nieskonfigurowany (brak DISCORD_TOKEN) - dziala tylko baza."); return; }
  try {
    const client = await p;
    await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log(`Discord: bot zalogowany jako ${client.user.tag}.`);
  } catch (e) {
    console.error("Discord: logowanie/guild nieudane - sprawdz DISCORD_TOKEN i DISCORD_GUILD_ID. " + e.message);
  }
}

async function createChannel(guild, city) {
  const ch = await guild.channels.create({
    name: channelName(city.name || city.slug),
    type: ChannelType.GuildText,
    reason: `Kanal ofert dla miasta ${city.name}`,
  });
  return ch;
}

// Zwraca kanal tekstowy dla miasta; tworzy gdy brak lub gdy stary zostal skasowany.
export async function ensureChannel(db, city) {
  const client = await getClient();
  if (!client) throw new Error("DISCORD_UNCONFIGURED");
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);

  if (city.discord_channel_id) {
    try {
      const existing = await guild.channels.fetch(city.discord_channel_id);
      if (existing) return existing; // fetch moze zwrocic null gdy kanal nie istnieje
    } catch (e) {
      if (e?.code !== 10003) throw e; // 10003 = Unknown Channel (skasowany recznie)
    }
  }
  const ch = await createChannel(guild, city); // brak/skasowany kanal -> tworzymy nowy
  db.setChannelId(city.id, ch.id);
  return ch;
}

function offerEmbed(o) {
  const linie = [
    `Dzielnica: ${o.dzielnica || "brak danych"}`,
    `Cena: ${formatPLN(o.cena)}`,
    `Cena/m2: ${formatInt(o.cenaM2)} zl/m2`,
    `Metraz: ${formatM2(o.powierzchnia)}`,
    `Pokoje: ${o.pokoje ?? "brak danych"}`,
  ].join("\n");
  return new EmbedBuilder()
    .setTitle(o.tytul || "Oferta")
    .setURL(o.link)
    .setDescription(linie)
    .setColor(0xff2d95);
}

// Wysyla oferty na kanal. discord.js sam kolejkuje zgodnie z rate-limitami.
export async function postListings(channel, offers) {
  for (const o of offers) {
    await channel.send({ embeds: [offerEmbed(o)] });
  }
}
