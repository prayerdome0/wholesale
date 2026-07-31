"use client";

import { useEffect, useMemo, useState } from "react";
import LeadFormModal from "./LeadFormModal";
import AiGenerateModal from "./AiGenerateModal";
import {
  PRIORITIES,
  STATUSES,
  priorityStyles,
  statusStyles,
  type LeadKind,
  type LeadRecord,
} from "@/lib/leads";

type TabDef = {
  key: LeadKind;
  label: string;
  endpoint: string;
  accent: string;
};

const TABS: TabDef[] = [
  { key: "wholesale", label: "Wholesale", endpoint: "/api/wholesale-leads", accent: "#0f766e" },
  { key: "general", label: "All Leads", endpoint: "/api/leads", accent: "#334155" },
];

function Badge({ label, cls }: { label: string; cls?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {label}
    </span>
  );
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v + "T00:00:00");
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(v: string | null): boolean {
  if (!v) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(v + "T00:00:00");
  return d.getTime() < today.getTime();
}

export default function LeadMatrix() {
  const [activeTab, setActiveTab] = useState<LeadKind>("wholesale");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRecord | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const tab = TABS.find((t) => t.key === activeTab)!;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const load = async (kind: LeadKind) => {
    setLoading(true);
    const t = TABS.find((x) => x.key === kind)!;
    try {
      const res = await fetch(t.endpoint, { cache: "no-store" });
      const data = (await res.json()) as LeadRecord[];
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeTab);
    setSearch("");
    setPriorityFilter("");
    setStatusFilter("");
  }, [activeTab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (priorityFilter && l.priority !== priorityFilter) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.companyName, l.contactPerson, l.email, l.industry, l.leadSource]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [leads, search, priorityFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = leads.length;
    const won = leads.filter((l) => l.status === "Won").length;
    const active = leads.filter((l) => !["Won", "Lost"].includes(l.status)).length;
    const followUpsDue = leads.filter(
      (l) => l.nextFollowUpDate && isOverdue(l.nextFollowUpDate) && !["Won", "Lost"].includes(l.status),
    ).length;
    return { total, won, active, followUpsDue };
  }, [leads]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (lead: LeadRecord) => {
    setEditing(lead);
    setModalOpen(true);
  };

  const handleSubmit = async (data: Record<string, string>) => {
    const url = editing ? `${tab.endpoint}/${editing.id}` : tab.endpoint;
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to save lead");
    }
    setModalOpen(false);
    await load(activeTab);
  };

  const handleDelete = async (lead: LeadRecord) => {
    if (!confirm(`Delete "${lead.companyName}"? This cannot be undone.`)) return;
    const res = await fetch(`${tab.endpoint}/${lead.id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: tab.accent }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead Matrix</h1>
            <p className="text-sm text-slate-500">Track opportunities, prioritize outreach, and never miss a follow-up.</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-current"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              style={active ? { color: t.accent } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="Active Pipeline" value={stats.active} />
        <StatCard label="Won" value={stats.won} tone="emerald" />
        <StatCard label="Follow-ups Due" value={stats.followUpsDue} tone={stats.followUpsDue > 0 ? "rose" : "slate"} />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email, industry…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setAiOpen(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50"
          style={{ borderColor: tab.accent, color: tab.accent }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
          Find Leads with AI
        </button>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: tab.accent }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add {activeTab === "wholesale" ? "Wholesale" : ""} Lead
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Industry</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Contact</th>
                <th className="px-4 py-3 font-semibold">Next Follow-Up</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-400">Loading leads…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <p className="text-slate-500">No leads found.</p>
                    <button onClick={openCreate} className="mt-2 text-sm font-semibold" style={{ color: tab.accent }}>
                      + Add your first lead
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const overdue = isOverdue(l.nextFollowUpDate) && !["Won", "Lost"].includes(l.status);
                  return (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{l.companyName}</div>
                        {l.notes && <div className="mt-0.5 line-clamp-1 max-w-[220px] text-xs text-slate-400">{l.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{l.contactPerson ?? "—"}</div>
                        <div className="text-xs text-slate-400">
                          {l.email && <div>{l.email}</div>}
                          {l.phone && <div>{l.phone}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{l.industry ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{l.leadSource ?? "—"}</td>
                      <td className="px-4 py-3"><Badge label={l.priority} cls={priorityStyles[l.priority]} /></td>
                      <td className="px-4 py-3"><Badge label={l.status} cls={statusStyles[l.status]} /></td>
                      <td className="px-4 py-3 text-slate-700">{fmtDate(l.lastContactDate)}</td>
                      <td className="px-4 py-3">
                        <span className={overdue ? "font-semibold text-rose-600" : "text-slate-700"}>
                          {fmtDate(l.nextFollowUpDate)}
                        </span>
                        {overdue && <div className="text-xs font-medium text-rose-500">Overdue</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(l)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            aria-label="Edit"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(l)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                            aria-label="Delete"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {leads.length} {tab.label.toLowerCase()} lead{leads.length === 1 ? "" : "s"}
        </p>
      )}

      <LeadFormModal
        open={modalOpen}
        editing={editing}
        accent={tab.accent}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <AiGenerateModal
        open={aiOpen}
        kind={activeTab}
        accent={tab.accent}
        bulkEndpoint={`${tab.endpoint}/bulk`}
        onClose={() => setAiOpen(false)}
        onImported={(n) => {
          showToast(`Imported ${n} AI-sourced lead${n === 1 ? "" : "s"} into ${tab.label}.`);
          load(activeTab);
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
