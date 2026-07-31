import type { BBox } from "./geocode";

export type RealBusiness = {
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  lat: number;
  lon: number;
};

// Map a free-text industry to a set of OpenStreetMap selectors.
function selectorsForIndustry(industry: string | undefined): string[] {
  const key = (industry ?? "").trim().toLowerCase();

  const map: Record<string, string[]> = {
    "food & beverage": [
      'node["shop"="wholesale"]',
      'node["shop"="supermarket"]',
      'node["shop"="greengrocer"]',
      'node["shop"="convenience"]',
      'node["craft"="brewery"]',
      'node["craft"="distillery"]',
      'node["shop"="bakery"]',
    ],
    food: [
      'node["shop"="supermarket"]',
      'node["shop"="greengrocer"]',
      'node["shop"="convenience"]',
      'node["shop"="bakery"]',
    ],
    retail: [
      'node["shop"="wholesale"]',
      'node["shop"="department_store"]',
      'node["shop"="variety_store"]',
      'node["shop"="clothes"]',
      'node["shop"="hardware"]',
    ],
    manufacturing: [
      'node["man_made"="works"]',
      'node["office"="company"]',
      'node["industrial"]',
      'node["building"="industrial"]',
    ],
    healthcare: [
      'node["amenity"="pharmacy"]',
      'node["amenity"="clinic"]',
      'node["healthcare"]',
      'node["shop"="medical_supply"]',
    ],
    technology: ['node["office"="it"]', 'node["office"="company"]', 'node["office"="telecommunication"]'],
    "sporting goods": ['node["shop"="sports"]', 'node["shop"="outdoor"]', 'node["shop"="bicycle"]'],
    sports: ['node["shop"="sports"]', 'node["shop"="outdoor"]'],
    hospitality: ['node["tourism"="hotel"]', 'node["amenity"="restaurant"]', 'node["amenity"="cafe"]'],
    automotive: ['node["shop"="car"]', 'node["shop"="car_parts"]', 'node["shop"="car_repair"]'],
    beauty: ['node["shop"="beauty"]', 'node["shop"="cosmetics"]', 'node["shop"="hairdresser"]'],
    construction: ['node["shop"="doityourself"]', 'node["shop"="hardware"]', 'node["craft"="builder"]'],
  };

  if (map[key]) return map[key];

  // Fuzzy contains match.
  for (const [k, sels] of Object.entries(map)) {
    if (key && (k.includes(key) || key.includes(k))) return sels;
  }

  // Default: general commercial establishments.
  return [
    'node["shop"="wholesale"]',
    'node["office"="company"]',
    'node["shop"="supermarket"]',
    'node["craft"]',
  ];
}

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Return parsed JSON from the first Overpass mirror that responds with valid
// data. Public mirrors rate-limit and sometimes return HTML error pages, so we
// rotate through several and validate the payload.
async function queryOverpass(
  query: string,
  ms: number,
): Promise<{ elements?: Array<Record<string, unknown>> } | null> {
  const endpoints = [...OVERPASS_ENDPOINTS].sort(() => Math.random() - 0.5);
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      const trimmed = text.trimStart();
      // Reject HTML/XML error pages returned when rate-limited.
      if (!trimmed.startsWith("{")) continue;
      try {
        return JSON.parse(trimmed);
      } catch {
        continue;
      }
    } catch {
      clearTimeout(timer);
      // try next endpoint
    }
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Search for real, existing businesses in a bounding box via the free
 * Overpass API (OpenStreetMap). No API key required.
 */
export async function searchBusinesses(
  bbox: BBox,
  industry: string | undefined,
  limit: number,
): Promise<RealBusiness[]> {
  const selectors = selectorsForIndustry(industry);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const want = Math.min(200, Math.max(20, limit * 8));

  // Prefer named businesses; ways/relations resolved via `out center`.
  const body = selectors
    .map((s) => `${s}["name"](${bboxStr});`)
    .join("");

  const query = `[out:json][timeout:25];(${body});out center ${want};`;

  const data = await queryOverpass(query, 26000);
  if (!data) return [];

  const elements = data.elements ?? [];
  const seen = new Set<string>();
  const results: RealBusiness[] = [];

  for (const el of elements) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const name = tags.name;
    if (!name) continue;

    const dedupeKey = name.toLowerCase().trim();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const lat = (el.lat as number) ?? (el.center as { lat: number })?.lat ?? 0;
    const lon = (el.lon as number) ?? (el.center as { lon: number })?.lon ?? 0;

    const category =
      tags.shop ??
      tags.office ??
      tags.craft ??
      tags.amenity ??
      tags.healthcare ??
      tags.man_made ??
      tags.tourism ??
      "business";

    results.push({
      name,
      category: category.replace(/_/g, " "),
      phone: tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null,
      email: tags.email ?? tags["contact:email"] ?? null,
      website: tags.website ?? tags["contact:website"] ?? tags.url ?? null,
      address: buildAddress(tags),
      lat,
      lon,
    });
  }

  // Prioritize businesses with more contact info (better leads first).
  results.sort((a, b) => contactScore(b) - contactScore(a));
  return results.slice(0, limit);
}

function contactScore(b: RealBusiness): number {
  return (b.website ? 2 : 0) + (b.phone ? 2 : 0) + (b.email ? 3 : 0) + (b.address ? 1 : 0);
}
