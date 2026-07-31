import { db } from "@/db";
import { wholesaleLeads } from "@/db/schema";
import { normalizeInput } from "@/lib/leads";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

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

  const [updated] = await db
    .update(wholesaleLeads)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(wholesaleLeads.id, leadId))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(wholesaleLeads)
    .where(eq(wholesaleLeads.id, leadId))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
