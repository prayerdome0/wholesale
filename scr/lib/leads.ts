export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type Status = (typeof STATUSES)[number];

export const LEAD_SOURCES = [
  "Referral",
  "Website",
  "Cold Outreach",
  "Trade Show",
  "Social Media",
  "Email Campaign",
  "Partner",
  "Other",
] as const;

export type LeadKind = "wholesale" | "general";

export type LeadRecord = {
  id: number;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  leadSource: string | null;
  priority: string;
  status: string;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadInput = {
  companyName: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  leadSource?: string | null;
  priority?: string;
  status?: string;
  lastContactDate?: string | null;
  nextFollowUpDate?: string | null;
  notes?: string | null;
};

export const priorityStyles: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700 ring-slate-200",
  Medium: "bg-sky-100 text-sky-700 ring-sky-200",
  High: "bg-amber-100 text-amber-800 ring-amber-200",
  Urgent: "bg-rose-100 text-rose-700 ring-rose-200",
};

export const statusStyles: Record<string, string> = {
  New: "bg-slate-100 text-slate-700 ring-slate-200",
  Contacted: "bg-blue-100 text-blue-700 ring-blue-200",
  Qualified: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "Proposal Sent": "bg-violet-100 text-violet-700 ring-violet-200",
  Negotiation: "bg-amber-100 text-amber-800 ring-amber-200",
  Won: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Lost: "bg-rose-100 text-rose-700 ring-rose-200",
};

export function normalizeInput(body: unknown): LeadInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const companyName = typeof b.companyName === "string" ? b.companyName.trim() : "";
  if (!companyName) {
    return { error: "Company Name is required" };
  }

  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  };

  return {
    companyName,
    contactPerson: str(b.contactPerson),
    email: str(b.email),
    phone: str(b.phone),
    industry: str(b.industry),
    leadSource: str(b.leadSource),
    priority: typeof b.priority === "string" && b.priority.trim() ? b.priority.trim() : "Medium",
    status: typeof b.status === "string" && b.status.trim() ? b.status.trim() : "New",
    lastContactDate: str(b.lastContactDate),
    nextFollowUpDate: str(b.nextFollowUpDate),
    notes: str(b.notes),
  };
}
