// Transliteracja polskich znakow do ASCII + slugifikacja.
const PL = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "a", Ć: "c", Ę: "e", Ł: "l", Ń: "n", Ó: "o", Ś: "s", Ź: "z", Ż: "z",
};

export function slugify(input) {
  const ascii = String(input ?? "")
    .split("")
    .map((ch) => PL[ch] ?? ch)
    .join("")
    .toLowerCase();
  return ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Nazwa kanalu Discord: slug, 2-100 znakow; fallback dla bardzo krotkich.
export function channelName(input) {
  let s = slugify(input);
  if (s.length < 2) s = "miasto-" + (s || "x");
  if (s.length > 100) s = s.slice(0, 100).replace(/-+$/, "");
  return s;
}
