"use client";

import { useState } from "react";
import { priorityStyles } from "@/lib/leads";

type GeneratedLead = {
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

export default function AiGenerateModal({
  open,
  kind,
  accent,
  bulkEndpoint,
  onClose,
  onImported,
}: {
  open: boolean;
  kind: "wholesale" | "general";
  accent: string;
  bulkEndpoint: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [keywords, setKeywords] = useState("");
  const [count, setCount] = useState(5);
  const [realSearch, setRealSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setResults([]);
    setSelected(new Set());
    setError(null);
    setSourceNote(null);
    setSourceKind(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    if (realSearch && !location.trim()) {
      setError("Enter a location to search for real businesses.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(new Set());
    try {
      const res = await fetch("/api/ai/generate-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, location, keywords, count, kind, realSearch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const leads: GeneratedLead[] = data.leads ?? [];
      setResults(leads);
      setSelected(new Set(leads.map((_, i) => i)));
      setSourceNote(data.note ?? null);
      setSourceKind(data.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((_, i) => i)));
  };

  const handleImport = async () => {
    const chosen = results.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(bulkEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onImported(data.inserted ?? chosen.length);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const fieldCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
  const labelCls = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">AI Lead Finder</h2>
              <p className="text-xs text-slate-500">Searches real businesses on the web &amp; qualifies them with AI — free, no API key needed.</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Criteria */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Industry</label>
              <input className={fieldCls} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Food & Beverage, Retail, Manufacturing" />
            </div>
            <div>
              <label className={labelCls}>
                Location / Region {realSearch && <span className="text-rose-500">*</span>}
              </label>
              <input className={fieldCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Austin, Texas · Denver, CO" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Keywords / Needs</label>
              <input className={fieldCls} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. bulk organic supplier, needs net-30 terms, 500+ units/month" />
            </div>
            <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                role="switch"
                aria-checked={realSearch}
                onClick={() => setRealSearch((v) => !v)}
                className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition ${realSearch ? "" : "bg-slate-300"}`}
                style={realSearch ? { backgroundColor: accent } : undefined}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${realSearch ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <div className="text-sm">
                <p className="font-medium text-slate-800">Search real businesses on the web</p>
                <p className="text-xs text-slate-500">
                  {realSearch
                    ? "Finds real, existing companies (name, phone, website, address) in your location, then AI qualifies each. Requires a location."
                    : "Off: AI drafts realistic sample prospects without a live web search."}
                </p>
              </div>
            </div>
            <div>
              <label className={labelCls}>How many prospects?</label>
              <input type="number" min={1} max={15} className={fieldCls} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.2-8.5" strokeLinecap="round" />
                    </svg>
                    Searching…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
                    </svg>
                    Find Leads
                  </>
                )}
              </button>
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-5">
              {sourceKind && (
                <div className="mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                      sourceKind === "search"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : sourceKind === "builtin"
                          ? "bg-slate-100 text-slate-600 ring-slate-200"
                          : "bg-sky-50 text-sky-700 ring-sky-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${sourceKind === "search" ? "bg-emerald-500" : sourceKind === "builtin" ? "bg-slate-400" : "bg-sky-500"}`} />
                    {sourceKind === "search"
                      ? "Live web search + AI"
                      : sourceKind === "builtin"
                        ? "Sample drafts"
                        : "AI generated"}
                  </span>
                </div>
              )}
              {sourceNote && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-100">
                  {sourceNote}
                </p>
              )}
              <div className="mb-2 flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs font-medium text-slate-600 hover:text-slate-900">
                  {selected.size === results.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-xs text-slate-500">{selected.size} of {results.length} selected</span>
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {results.map((lead, i) => {
                  const isSel = selected.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggle(i)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        isSel ? "border-transparent ring-2" : "border-slate-200 hover:border-slate-300"
                      }`}
                      style={isSel ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${isSel ? "text-white" : "border-slate-300"}`}
                        style={isSel ? { backgroundColor: accent, borderColor: accent } : undefined}
                      >
                        {isSel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{lead.companyName}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${priorityStyles[lead.priority] ?? ""}`}>
                            {lead.priority}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {lead.contactPerson} · {lead.email} · {lead.phone}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {lead.industry} · {lead.leadSource}
                        </div>
                        {lead.notes && <div className="mt-1 text-xs text-slate-500">{lead.notes}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button onClick={handleClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {importing ? "Importing…" : `Import ${selected.size} Lead${selected.size === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
