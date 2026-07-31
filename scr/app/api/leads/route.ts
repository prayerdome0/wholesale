import { db } from "@/db";
import { leads } from "@/db/schema";
import { normalizeInput } from "@/lib/leads";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
  return Response.json(rows);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = normalizeInput(body);
  if ("error" in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const [created] = await db.insert(leads).values(parsed).returning();
  return Response.json(created, { status: 201 });
}
