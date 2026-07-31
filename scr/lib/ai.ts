import { LEAD_SOURCES } from "./leads";
import { geocode } from "./geocode";
import { searchBusinesses, type RealBusiness } from "./search";

export type GenerateCriteria = {
  industry?: string;
  location?: string;
  keywords?: string;
  count: number;
  kind: "wholesale" | "general";
  realSearch?: boolean;
};

export type GeneratedLead = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  industry: string;
  leadSource: string;
  priority: string;
  status: string;
  nextFollowUpDate: string;
  notes: string;
};

export type GenerateResult = {
  leads: GeneratedLead[];
  source: "openai" | "pollinations" | "builtin" | "search";
  note: string;
};

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(15, Math.round(n)));
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Shared prompt + response parsing                                    */
/* ------------------------------------------------------------------ */

function buildPrompt(criteria: GenerateCriteria): string {
  const count = clampCount(criteria.count);
  return [
    `You are a B2B lead-generation research assistant.`,
    `Produce ${count} realistic ${criteria.kind === "wholesale" ? "WHOLESALE / bulk-buying" : "sales"} prospect companies`,
    criteria.industry ? `in the "${criteria.industry}" industry` : "",
    criteria.location ? `located in or near "${criteria.location}"` : "",
    criteria.keywords ? `matching these keywords/needs: "${criteria.keywords}"` : "",
    `.`,
    `Return ONLY valid JSON of the form {"leads":[{...}]} where each lead has keys:`,
    `companyName, contactPerson, email, phone, industry, leadSource, priority, status, nextFollowUpDate (YYYY-MM-DD within next 30 days), notes.`,
    `priority must be one of Low, Medium, High, Urgent. status should be "New".`,
    `leadSource should be a plausible channel (e.g. Referral, Website, Trade Show, Cold Outreach, Partner).`,
    `Make emails and phone numbers plausible but clearly example data. Notes should explain the fit in one sentence.`,
    `Do not include any prose, markdown, or code fences — JSON only.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to locate the first {...} or [...] block in the text.
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const candidate = objMatch?.[0] ?? arrMatch?.[0];
    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceLeads(parsed: unknown, criteria: GenerateCriteria): GeneratedLead[] {
  const count = clampCount(criteria.count);
  const rawLeads: unknown[] = Array.isArray(parsed)
    ? parsed
    : ((parsed as { leads?: unknown } | null)?.leads as unknown[]) ?? [];

  return rawLeads.slice(0, count).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const str = (v: unknown, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);
    return {
      companyName: str(o.companyName, "Unknown Company"),
      contactPerson: str(o.contactPerson),
      email: str(o.email),
      phone: str(o.phone),
      industry: str(o.industry, criteria.industry ?? ""),
      leadSource: str(o.leadSource, "AI Prospecting"),
      priority: PRIORITIES.includes(str(o.priority) as (typeof PRIORITIES)[number])
        ? str(o.priority)
        : "Medium",
      status: "New",
      nextFollowUpDate: /^\d{4}-\d{2}-\d{2}$/.test(str(o.nextFollowUpDate))
        ? str(o.nextFollowUpDate)
        : daysFromNow(7),
      notes: str(o.notes),
    };
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* OpenAI-backed generation (used automatically when key is present)   */
/* ------------------------------------------------------------------ */

async function generateWithOpenAI(
  criteria: GenerateCriteria,
  apiKey: string,
): Promise<GeneratedLead[]> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output only strict JSON." },
          { role: "user", content: buildPrompt(criteria) },
        ],
      }),
    },
    25000,
  );

  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status})`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  return coerceLeads(extractJson(content), criteria);
}

/* ------------------------------------------------------------------ */
/* Pollinations free AI (no API key required)                          */
/* ------------------------------------------------------------------ */

async function generateWithPollinations(
  criteria: GenerateCriteria,
): Promise<GeneratedLead[]> {
  const res = await fetchWithTimeout(
    "https://text.pollinations.ai/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: "You output only strict JSON, no markdown." },
          { role: "user", content: buildPrompt(criteria) },
        ],
      }),
    },
    22000,
  );

  if (!res.ok) {
    throw new Error(`Pollinations request failed (${res.status})`);
  }

  const text = await res.text();
  // Some responses are the raw model text, others wrap it OpenAI-style.
  let content = text;
  const asJson = extractJson(text);
  if (
    asJson &&
    typeof asJson === "object" &&
    "choices" in (asJson as Record<string, unknown>)
  ) {
    const choices = (asJson as { choices?: Array<{ message?: { content?: string } }> })
      .choices;
    content = choices?.[0]?.message?.content ?? text;
  }

  const leads = coerceLeads(
    typeof content === "string" ? extractJson(content) : content,
    criteria,
  );
  if (leads.length === 0) {
    throw new Error("Pollinations returned no usable leads");
  }
  return leads;
}

/* ------------------------------------------------------------------ */
/* Built-in generator (works with no API key)                          */
/* ------------------------------------------------------------------ */

const INDUSTRY_LIBRARY: Record<
  string,
  { prefixes: string[]; suffixes: string[]; notes: string[] }
> = {
  retail: {
    prefixes: ["Cedar", "Harbor", "Maple", "Union", "Crestview", "Brightline", "Meadow", "Copper", "Riverside", "Golden Gate"],
    suffixes: ["Retail Group", "Mercantile", "Stores", "Marketplace", "Trading Co.", "Outfitters"],
    notes: [
      "Multi-store retailer seeking consistent wholesale supply.",
      "Expanding chain looking to consolidate vendors.",
      "High foot-traffic locations with steady reorder volume.",
    ],
  },
  "food & beverage": {
    prefixes: ["Harvest", "Golden Fork", "Fresh Valley", "Coastal", "Sunrise", "Evergreen", "Blue Ridge", "Artisan", "Prairie", "Orchard"],
    suffixes: ["Foods", "Distributors", "Provisions", "Grocers", "Beverage Co.", "Pantry"],
    notes: [
      "Grocery buyer interested in bulk seasonal pricing.",
      "Restaurant group needing reliable weekly deliveries.",
      "Specialty food distributor expanding SKU range.",
    ],
  },
  manufacturing: {
    prefixes: ["Ironclad", "Precision", "Summit", "Apex", "Vanguard", "Titan", "Forge", "Keystone", "Atlas", "Northgate"],
    suffixes: ["Manufacturing", "Industries", "Fabrication", "Works", "Components", "Systems"],
    notes: [
      "OEM buyer evaluating long-term supply contracts.",
      "Plant seeking to reduce material lead times.",
      "Growing manufacturer needing higher-volume terms.",
    ],
  },
  healthcare: {
    prefixes: ["Bluebird", "Wellspring", "Cardinal", "Evercare", "Meridian", "Lakeside", "Unity", "Vista", "Carepoint", "Northstar"],
    suffixes: ["Pharmacy Group", "Health Systems", "Medical Supply", "Clinics", "Care Network", "Labs"],
    notes: [
      "Multi-location provider standardizing procurement.",
      "Pharmacy chain seeking competitive bulk pricing.",
      "Clinic network consolidating medical suppliers.",
    ],
  },
  technology: {
    prefixes: ["TechFlow", "DataForge", "CloudPeak", "ByteWorks", "Nexus", "Quantum", "Stackline", "CoreLogic", "Pinnacle", "Vertex"],
    suffixes: ["Solutions", "Systems", "Labs", "Technologies", "Digital", "Networks"],
    notes: [
      "Reseller interested in volume licensing.",
      "Integrator sourcing hardware at wholesale rates.",
      "Scaling company needing bulk equipment supply.",
    ],
  },
  "sporting goods": {
    prefixes: ["Summit", "Trailhead", "Peak", "Rapids", "Basecamp", "Frontier", "Alpine", "Riverbend", "Highland", "Coastline"],
    suffixes: ["Outdoor Supply", "Sports", "Gear Co.", "Outfitters", "Athletics", "Recreation"],
    notes: [
      "Retailer stocking up for seasonal demand.",
      "Outdoor chain seeking bulk gear pricing.",
      "Sports outlet consolidating equipment vendors.",
    ],
  },
  default: {
    prefixes: ["Northwind", "Blue Harbor", "Silverline", "Grandview", "Pioneer", "Momentum", "Beacon", "Everline", "Horizon", "Crossroads"],
    suffixes: ["Group", "Partners", "Enterprises", "Trading Co.", "Holdings", "& Co."],
    notes: [
      "Promising fit for a wholesale partnership.",
      "Actively sourcing new suppliers this quarter.",
      "Strong volume potential based on profile.",
    ],
  },
};

const FIRST_NAMES = ["Marcus", "Priya", "Derek", "Elena", "Sam", "Anna", "Raj", "Nina", "Carlos", "Grace", "Owen", "Leah", "Victor", "Maya", "Theo", "Sofia"];
const LAST_NAMES = ["Lee", "Nair", "Olson", "Ruiz", "Whitfield", "Kim", "Patel", "Alvarez", "Bennett", "Chen", "Dupont", "Foster", "Hughes", "Iqbal", "Novak", "Reyes"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "company";
}

function generateBuiltin(criteria: GenerateCriteria): GeneratedLead[] {
  const count = clampCount(criteria.count);
  const key = (criteria.industry ?? "").trim().toLowerCase();
  const lib = INDUSTRY_LIBRARY[key] ?? INDUSTRY_LIBRARY.default;
  const industryLabel = criteria.industry?.trim() || "General";
  const usedNames = new Set<string>();
  const leads: GeneratedLead[] = [];
  let seed = Date.now();

  for (let i = 0; leads.length < count && i < count * 5; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const prefix = pick(lib.prefixes, seed + i);
    const suffix = pick(lib.suffixes, seed >> 3);
    let companyName = `${prefix} ${suffix}`;
    if (usedNames.has(companyName)) {
      companyName = `${prefix} ${criteria.location?.split(",")[0]?.trim() || pick(["North", "West", "Central", "Metro"], seed)} ${suffix}`;
    }
    if (usedNames.has(companyName)) continue;
    usedNames.add(companyName);

    const first = pick(FIRST_NAMES, seed + i * 7);
    const last = pick(LAST_NAMES, seed >> 5);
    const domain = slugify(prefix + suffix);
    const area = 200 + (Math.abs(seed) % 799);
    const mid = 100 + (Math.abs(seed >> 4) % 899);
    const end = 1000 + (Math.abs(seed >> 8) % 8999);
    const locationNote = criteria.location ? ` Based in ${criteria.location}.` : "";
    const keywordNote = criteria.keywords ? ` Matches: ${criteria.keywords}.` : "";

    leads.push({
      companyName,
      contactPerson: `${first} ${last}`,
      email: `${first.toLowerCase()}@${domain}.com`,
      phone: `(${area}) ${mid}-${end}`,
      industry: industryLabel,
      leadSource: pick([...LEAD_SOURCES], seed + i),
      priority: pick([...PRIORITIES], seed + i * 3),
      status: "New",
      nextFollowUpDate: daysFromNow(3 + (Math.abs(seed) % 21)),
      notes: `${pick(lib.notes, seed + i)}${locationNote}${keywordNote}`.trim(),
    });
  }

  return leads;
}

/* ------------------------------------------------------------------ */
/* Real business search + AI enrichment (production path)              */
/* ------------------------------------------------------------------ */

function domainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function heuristicPriority(b: RealBusiness): string {
  const score =
    (b.website ? 1 : 0) + (b.phone ? 1 : 0) + (b.email ? 2 : 0);
  if (score >= 3) return "High";
  if (score === 2) return "Medium";
  return "Low";
}

// Ask the free AI to enrich real businesses with priority + tailored notes.
async function aiEnrich(
  businesses: RealBusiness[],
  criteria: GenerateCriteria,
): Promise<Record<number, { priority?: string; notes?: string }>> {
  if (businesses.length === 0) return {};
  const list = businesses
    .map(
      (b, i) =>
        `${i}. ${b.name} — category: ${b.category}${b.address ? `, ${b.address}` : ""}${b.website ? `, site: ${b.website}` : ""}`,
    )
    .join("\n");

  const prompt = [
    `You are a B2B sales analyst. Below are REAL businesses found via web search.`,
    `Goal: qualify each as a ${criteria.kind === "wholesale" ? "WHOLESALE / bulk-buying" : "sales"} prospect`,
    criteria.keywords ? `for a seller offering: "${criteria.keywords}".` : ".",
    `For each, assign a priority (Low, Medium, High, or Urgent) based on fit and write ONE concise sentence explaining why they're a good prospect and a suggested first outreach angle.`,
    `Return ONLY JSON: {"items":[{"index":0,"priority":"High","notes":"..."}]}. No markdown.`,
    ``,
    `Businesses:`,
    list,
  ].join(" ");

  try {
    const res = await fetchWithTimeout(
      "https://text.pollinations.ai/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            { role: "system", content: "You output only strict JSON, no markdown." },
            { role: "user", content: prompt },
          ],
        }),
      },
      22000,
    );
    if (!res.ok) return {};
    const text = await res.text();
    let content = text;
    const asJson = extractJson(text);
    if (asJson && typeof asJson === "object" && "choices" in (asJson as Record<string, unknown>)) {
      content =
        (asJson as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
          ?.content ?? text;
    }
    const parsed = extractJson(typeof content === "string" ? content : JSON.stringify(content));
    const items = (parsed as { items?: unknown[] } | null)?.items ?? [];
    const out: Record<number, { priority?: string; notes?: string }> = {};
    for (const raw of items as Array<Record<string, unknown>>) {
      const idx = Number(raw.index);
      if (!Number.isInteger(idx)) continue;
      const priority =
        typeof raw.priority === "string" &&
        PRIORITIES.includes(raw.priority as (typeof PRIORITIES)[number])
          ? raw.priority
          : undefined;
      const notes = typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined;
      out[idx] = { priority, notes };
    }
    return out;
  } catch {
    return {};
  }
}

async function generateFromRealSearch(
  criteria: GenerateCriteria,
): Promise<{ leads: GeneratedLead[]; enriched: boolean } | null> {
  if (!criteria.location?.trim()) return null;

  const bbox = await geocode(criteria.location);
  if (!bbox) return null;

  const businesses = await searchBusinesses(bbox, criteria.industry, clampCount(criteria.count));
  if (businesses.length === 0) return null;

  const enrichment = await aiEnrich(businesses, criteria);
  const enriched = Object.keys(enrichment).length > 0;

  const leads: GeneratedLead[] = businesses.map((b, i) => {
    const domain = domainFromUrl(b.website);
    const email = b.email ?? (domain ? `info@${domain}` : "");
    const info = enrichment[i] ?? {};
    const baseNote = [
      b.address ? `Located at ${b.address}.` : "",
      b.website ? `Website: ${b.website}.` : "",
      !b.email && domain ? "Email inferred from website domain — verify before use." : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      companyName: b.name,
      contactPerson: "",
      email,
      phone: b.phone ?? "",
      industry: criteria.industry?.trim() || capitalize(b.category),
      leadSource: "Web Search",
      priority: info.priority ?? heuristicPriority(b),
      status: "New",
      nextFollowUpDate: daysFromNow(3 + (i % 10)),
      notes: [info.notes, baseNote].filter(Boolean).join(" ").trim(),
    };
  });

  return { leads, enriched };
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ------------------------------------------------------------------ */

export async function generateLeads(criteria: GenerateCriteria): Promise<GenerateResult> {
  // 0) Real business search (production path) — actual companies that exist.
  if (criteria.realSearch && criteria.location?.trim()) {
    try {
      const result = await generateFromRealSearch(criteria);
      if (result && result.leads.length > 0) {
        return {
          leads: result.leads,
          source: "search",
          note: result.enriched
            ? "Real businesses found via web search and qualified by AI. Verify contact details before outreach."
            : "Real businesses found via web search. Verify contact details before outreach.",
        };
      }
    } catch {
      // fall through to generative providers
    }
  }

  // 1) If the user has configured their own OpenAI key, prefer it (best quality).
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const leads = await generateWithOpenAI(criteria, apiKey);
      if (leads.length > 0) {
        return {
          leads,
          source: "openai",
          note: "Generated with AI. Verify contact details before outreach.",
        };
      }
    } catch {
      // fall through to the free provider
    }
  }

  // 2) Free, no-key AI via Pollinations (unless explicitly disabled).
  if (process.env.DISABLE_FREE_AI !== "1") {
    try {
      const leads = await generateWithPollinations(criteria);
      if (leads.length > 0) {
        return {
          leads,
          source: "pollinations",
          note: "Generated with free AI. Verify contact details before outreach.",
        };
      }
    } catch {
      // fall through to the built-in generator
    }
  }

  // 3) Guaranteed fallback — always works, unlimited, no network needed.
  return {
    leads: generateBuiltin(criteria),
    source: "builtin",
    note: "Free AI was busy, so these were drafted by the built-in prospector. Try again for live AI results. Verify details before outreach.",
  };
}
