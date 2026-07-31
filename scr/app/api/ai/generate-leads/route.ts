import { generateLeads, type GenerateCriteria } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const criteria: GenerateCriteria = {
    industry: typeof b.industry === "string" ? b.industry : undefined,
    location: typeof b.location === "string" ? b.location : undefined,
    keywords: typeof b.keywords === "string" ? b.keywords : undefined,
    count: typeof b.count === "number" ? b.count : Number(b.count) || 5,
    kind: b.kind === "general" ? "general" : "wholesale",
    realSearch: b.realSearch !== false,
  };

  try {
    const result = await generateLeads(criteria);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Failed to generate leads" }, { status: 500 });
  }
}
