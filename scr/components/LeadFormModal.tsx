"use client";

import { useEffect, useState } from "react";
import {
  PRIORITIES,
  STATUSES,
  LEAD_SOURCES,
  type LeadRecord,
} from "@/lib/leads";

type FormState = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  industry: string;
  leadSource: string;
  priority: string;
  status: string;
  lastContactDate: string;
  nextFollowUpDate: string;
  notes: string;
};

const empty: FormState = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  industry: "",
  leadSource: "",
  priority: "Medium",
  status: "New",
  lastContactDate: "",
  nextFollowUpDate: "",
  notes: "",
};

function fromRecord(rec: LeadRecord): FormState {
  return {
    companyName: rec.companyName ?? "",
    contactPerson: rec.contactPerson ?? "",
    email: rec.email ?? "",
    phone: rec.phone ?? "",
    industry: rec.industry ?? "",
    leadSource: rec.leadSource ?? "",
    priority: rec.priority ?? "Medium",
    status: rec.status ?? "New",
    lastContactDate: rec.lastContactDate ?? "",
    nextFollowUpDate: rec.nextFollowUpDate ?? "",
    notes: rec.notes ?? "",
  };
}

export default function LeadFormModal({
  open,
  editing,
  accent,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: LeadRecord | null;
  accent: string;
  onClose: () => void;
  onSubmit: (data: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(editing ? fromRecord(editing) : empty);
      setError(null);
    }
  }, [open, editing]);

  if (!open) return null;

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      setError("Company Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const fieldCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
  const labelCls = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {editing ? "Edit Wholesale Lead" : "New Wholesale Lead"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Company Name *</label>
              <input className={fieldCls} value={form.companyName} onChange={set("companyName")} placeholder="Acme Wholesale Co." />
            </div>
            <div>
              <label className={labelCls}>Contact Person</label>
              <input className={fieldCls} value={form.contactPerson} onChange={set("contactPerson")} placeholder="Jane Doe" />
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <input className={fieldCls} value={form.industry} onChange={set("industry")} placeholder="Retail, Manufacturing…" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={fieldCls} value={form.email} onChange={set("email")} placeholder="jane@acme.com" />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input className={fieldCls} value={form.phone} onChange={set("phone")} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className={labelCls}>Lead Source</label>
              <select className={fieldCls} value={form.leadSource} onChange={set("leadSource")}>
                <option value="">Select source…</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Priority</label>
                <select className={fieldCls} value={form.priority} onChange={set("priority")}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={fieldCls} value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Last Contact Date</label>
              <input type="date" className={fieldCls} value={form.lastContactDate} onChange={set("lastContactDate")} />
            </div>
            <div>
              <label className={labelCls}>Next Follow-Up Date</label>
              <input type="date" className={fieldCls} value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea className={`${fieldCls} min-h-[90px] resize-y`} value={form.notes} onChange={set("notes")} placeholder="Order volumes, terms discussed, next steps…" />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
