// 16 wojewodztw RP: label = czytelna nazwa PL (dropdown), slug = wartosc do URL otodom.
export const WOJEWODZTWA = [
  { label: "dolnośląskie", slug: "dolnoslaskie" },
  { label: "kujawsko-pomorskie", slug: "kujawsko--pomorskie" },
  { label: "lubelskie", slug: "lubelskie" },
  { label: "lubuskie", slug: "lubuskie" },
  { label: "łódzkie", slug: "lodzkie" },
  { label: "małopolskie", slug: "malopolskie" },
  { label: "mazowieckie", slug: "mazowieckie" },
  { label: "opolskie", slug: "opolskie" },
  { label: "podkarpackie", slug: "podkarpackie" },
  { label: "podlaskie", slug: "podlaskie" },
  { label: "pomorskie", slug: "pomorskie" },
  { label: "śląskie", slug: "slaskie" },
  { label: "świętokrzyskie", slug: "swietokrzyskie" },
  { label: "warmińsko-mazurskie", slug: "warminsko--mazurskie" },
  { label: "wielkopolskie", slug: "wielkopolskie" },
  { label: "zachodniopomorskie", slug: "zachodniopomorskie" },
];

const SLUGS = new Set(WOJEWODZTWA.map((w) => w.slug));
export function isValidWojewodztwo(slug) {
  return SLUGS.has(slug);
}
