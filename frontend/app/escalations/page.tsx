"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { Escalation } from "../../types/api";
import { getEscalations, reviewEscalation } from "../../lib/api/farmops";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

const STATUS_FILTERS = ["ALL", "open", "in_review", "resolved", "rejected"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLE: Record<string, { chip: string; label: string }> = {
  open: { chip: "bg-amber-100 text-amber-800 border-amber-200", label: "Awaiting review" },
  in_review: { chip: "bg-blue-100 text-blue-800 border-blue-200", label: "Under review" },
  resolved: { chip: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Resolved" },
  rejected: { chip: "bg-slate-100 text-slate-700 border-slate-200", label: "Closed, no action" },
};

function statusStyle(status: string) {
  return (
    STATUS_STYLE[status] ?? {
      chip: "bg-slate-100 text-slate-700 border-slate-200",
      label: status.replace(/_/g, " "),
    }
  );
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Outcomes an expert can record. Mirrors the backend review contract. */
const OUTCOMES = [
  { value: "resolved", label: "Resolve case", status: "resolved", tone: "emerald" },
  { value: "needs_more_data", label: "Request more data", status: "in_review", tone: "blue" },
  { value: "rejected", label: "Close without action", status: "rejected", tone: "slate" },
] as const;

export default function EscalationsPage() {
  const { selectedFarmId, selectedFarm } = useFarm();

  const [cases, setCases] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string>("resolved");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async (farmId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEscalations(farmId, { limit: 100 });
      if (res.error) {
        setError(res.error.message || "Could not load escalation cases.");
        setCases([]);
      } else {
        setCases(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error loading escalations.");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedFarmId) {
      setCases([]);
      return;
    }
    // Clear immediately so a farm switch never shows the previous farm's cases.
    setCases([]);
    setActiveCase(null);
    void load(selectedFarmId);
  }, [selectedFarmId, load]);

  const visible = useMemo(
    () => (filter === "ALL" ? cases : cases.filter((c) => c.status === filter)),
    [cases, filter]
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = { open: 0, in_review: 0, resolved: 0, rejected: 0 };
    for (const c of cases) base[c.status] = (base[c.status] ?? 0) + 1;
    return base;
  }, [cases]);

  async function submitReview(escalationId: string) {
    if (!notes.trim()) {
      setSubmitError("A review note is required so the decision is traceable.");
      return;
    }
    const chosen = OUTCOMES.find((o) => o.value === outcome) ?? OUTCOMES[0];
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await reviewEscalation(escalationId, {
        review_notes: notes.trim(),
        review_outcome: chosen.value,
        status: chosen.status,
      });
      if (res.error) {
        setSubmitError(res.error.message || "Could not record the review.");
        return;
      }
      setActiveCase(null);
      setNotes("");
      if (selectedFarmId) await load(selectedFarmId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error recording the review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Escalations">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Expert escalations</h1>
            <p className="mt-1 text-sm text-slate-600">
              Cases the safety guard could not clear automatically
              {selectedFarm ? ` for ${selectedFarm.name}` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectedFarmId && load(selectedFarmId)}
            disabled={!selectedFarmId || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* The PRD is explicit that demo experts must not be passed off as real ones. */}
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            Reviews recorded here are logged against your own account. No external agronomist is
            connected to this deployment, so treat expert outcomes as your farm team&apos;s decision
            rather than an independent professional opinion.
          </p>
        </div>

        {!selectedFarmId ? (
          <Card>
            <div className="py-10 text-center">
              <ShieldAlert size={22} className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-bold text-slate-800">No farm selected</p>
              <p className="mt-1 text-xs text-slate-500">
                Choose a farm to see the cases waiting for review.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {(["open", "in_review", "resolved", "rejected"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key === filter ? "ALL" : key)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    filter === key
                      ? "border-emerald-300 bg-emerald-50 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="block text-2xl font-extrabold text-slate-900">{counts[key] ?? 0}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {statusStyle(key).label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    filter === value
                      ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {value === "ALL" ? "All cases" : statusStyle(value).label}
                </button>
              ))}
            </div>

            {error && (
              <Card>
                <div className="flex items-start gap-2 text-sm text-rose-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Could not load escalations</p>
                    <p className="mt-0.5 text-xs text-rose-600">{error}</p>
                  </div>
                </div>
              </Card>
            )}

            {loading && cases.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <Card>
                <div className="py-12 text-center flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-base font-bold text-slate-800">
                    {cases.length === 0 ? "No cases have been escalated" : "Nothing matches this filter"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
                    {cases.length === 0
                      ? "The AI safety guard opens an escalation case when a plan is too uncertain, requires high-sensitivity chemical verification, or needs expert agronomist review."
                      : "Try selecting 'All cases' to view all escalation records."}
                  </p>
                  {cases.length === 0 && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <Link
                        href="/demo"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all"
                      >
                        <ShieldAlert size={14} />
                        <span>Simulate Expert Escalation (Demo)</span>
                      </Link>
                      <Link
                        href="/risks"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all"
                      >
                        <span>View Risk Assessments</span>
                      </Link>
                      <Link
                        href="/plans"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all"
                      >
                        <span>Review Action Plans</span>
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {visible.map((item) => {
                  const style = statusStyle(item.status);
                  const isTerminal = item.status === "resolved" || item.status === "rejected";
                  const isOpen = activeCase === item.id;
                  return (
                    <Card key={item.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.chip}`}
                            >
                              {style.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                              <Clock size={11} /> Opened {formatWhen(item.created_at)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-bold text-slate-900">{item.reason}</p>

                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                            {item.risk_id && (
                              <Link
                                href="/risks"
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2"
                              >
                                <ShieldAlert size={11} /> Linked risk
                              </Link>
                            )}
                            {item.plan_id && (
                              <Link
                                href="/plans"
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline underline-offset-2"
                              >
                                <ClipboardList size={11} /> Linked plan
                              </Link>
                            )}
                            {item.zone_id && <span>Zone scoped</span>}
                          </div>

                          {item.review_notes && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                                Review outcome
                                {item.review_outcome ? `: ${item.review_outcome.replace(/_/g, " ")}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-700">{item.review_notes}</p>
                              <p className="mt-1 text-[10px] text-slate-400">
                                Recorded {formatWhen(item.updated_at)}
                              </p>
                            </div>
                          )}
                        </div>

                        {!isTerminal && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCase(isOpen ? null : item.id);
                              setNotes("");
                              setSubmitError(null);
                              setOutcome("resolved");
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
                          >
                            <UserCheck size={13} />
                            {isOpen ? "Cancel" : "Record review"}
                          </button>
                        )}
                      </div>

                      {isOpen && (
                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                          <div>
                            <label
                              htmlFor={`outcome-${item.id}`}
                              className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                            >
                              Outcome
                            </label>
                            <select
                              id={`outcome-${item.id}`}
                              value={outcome}
                              onChange={(e) => setOutcome(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                            >
                              {OUTCOMES.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`notes-${item.id}`}
                              className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                            >
                              Review notes <span className="text-rose-600">*</span>
                            </label>
                            <textarea
                              id={`notes-${item.id}`}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              rows={3}
                              placeholder="What was observed in the field, and what should happen next?"
                              className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                            />
                          </div>

                          {submitError && (
                            <p className="text-xs font-semibold text-rose-700">{submitError}</p>
                          )}

                          <button
                            type="button"
                            onClick={() => submitReview(item.id)}
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {submitting ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Send size={13} />
                            )}
                            {submitting ? "Recording…" : "Submit review"}
                          </button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
