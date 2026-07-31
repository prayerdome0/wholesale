import { db } from "@/db";
import { leads } from "@/db/schema";
import { normalizeInput } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = (body as { leads?: unknown })?.leads;
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "No leads provided" }, { status: 400 });
  }

  const values = [];
  for (const item of items) {
    const parsed = normalizeInput(item);
    if ("error" in parsed) continue;
    values.push(parsed);
  }

  if (values.length === 0) {
    return Response.json({ error: "No valid leads provided" }, { status: 400 });
  }

  const created = await db.insert(leads).values(values).returning();
  return Response.json({ inserted: created.length, leads: created }, { status: 201 });
}
