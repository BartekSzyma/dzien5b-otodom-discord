export function median(values) {
  const nums = values
    .filter((v) => typeof v === "number" && !Number.isNaN(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export function roomsBucket(pokoje) {
  return pokoje >= 4 ? "4+" : String(pokoje);
}

export function applyFilters(offers, { districts = [], rooms = [] } = {}) {
  return offers.filter((o) => {
    if (districts.length && !districts.includes(o.dzielnica)) return false;
    if (rooms.length && !rooms.includes(roomsBucket(o.pokoje))) return false;
    return true;
  });
}

export function statsByDistrict(offers, metric = "cenaM2") {
  const groups = new Map();
  for (const o of offers) {
    const v = o[metric];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (!groups.has(o.dzielnica)) groups.set(o.dzielnica, []);
    groups.get(o.dzielnica).push(v);
  }
  const rows = [];
  for (const [dzielnica, values] of groups) {
    rows.push({
      dzielnica,
      value: median(values),
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

export function summary(offers) {
  return {
    count: offers.length,
    medianCena: median(offers.map((o) => o.cena)),
    medianCenaM2: median(offers.map((o) => o.cenaM2)),
    medianPowierzchnia: median(offers.map((o) => o.powierzchnia)),
  };
}
