"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm, type AdvisoryPlan } from "../../context/farm-context";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Filter,
  Info,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

export default function AdvisoryPlansPage() {
  const {
    advisories,
    acceptPlan,
    rejectPlan,
    reconsiderPlan,
    resetPlans,
    settings,
  } = useFarm();

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Rejection Modal State
  const [rejectingPlan, setRejectingPlan] = useState<AdvisoryPlan | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // User Feedback Message
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const filteredAdvisories = advisories.filter((plan) => {
    if (categoryFilter !== "ALL" && plan.category !== categoryFilter) return false;
    if (priorityFilter !== "ALL" && plan.priority !== priorityFilter) return false;
    if (statusFilter !== "ALL" && plan.status !== statusFilter) return false;
    return true;
  });

  const pendingCount = advisories.filter((p) => p.status === "Pending Decision").length;
  const acceptedCount = advisories.filter((p) => p.status === "Accepted").length;
  const rejectedCount = advisories.filter((p) => p.status === "Rejected").length;

  const handleAccept = (planId: string) => {
    const res = acceptPlan(planId);
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: "success" });
    } else {
      setFeedbackMessage({ text: res.message, type: "error" });
    }
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPlan) return;
    const res = rejectPlan(rejectingPlan.id, rejectReason);
    setRejectingPlan(null);
    setRejectReason("");
    if (res.success) {
      setFeedbackMessage({ text: res.message, type: "info" });
    }
  };

  return (
    <AppShell title="Advisory Plans">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Farmer Decision Support
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Human-in-the-Loop Orchestration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Agronomic Advisory Plans
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Review recommendations generated from research dataset benchmarks. Each plan requires your explicit farmer decision (Accept or Reject).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Reset Review State
          </button>
        </div>
      </div>

      {/* Decision Workflow Banner */}
      <div className="mt-6 rounded-xl border border-forest-200 bg-[#f4f7f2] p-4 text-xs text-forest-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div className="space-y-1">
            <p className="font-semibold text-forest-900">
              Operational Boundary & Advisory Flow
            </p>
            <p className="leading-relaxed text-forest-800">
              <strong>Flow:</strong> Monitor → Detect → Plan → <u>Farmer Decision</u> → Task → Verify/Reassess.
              Accepting an advisory records your approval and creates a follow-up checklist task (governed by your <em>Automatic Task Creation</em> setting). <strong>Acceptance never commands pumps, valves, or farm equipment.</strong> Physical execution remains manual crew work.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`mt-4 flex items-center justify-between rounded-xl p-3.5 text-xs font-medium shadow-2xs ${
            feedbackMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : feedbackMessage.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : "border border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <Info size={16} className="text-blue-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="rounded p-1 hover:bg-black/5"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Decision Summary Counters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5 border-blue-200 bg-blue-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            Pending Farmer Review
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-950">
              {pendingCount}
            </span>
            <span className="text-xs text-blue-700 font-medium">awaiting decision</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Inspect evidence and assess local parcel conditions
          </p>
        </Card>

        <Card className="p-5 border-emerald-200 bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Accepted by Farmer
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-950">
              {acceptedCount}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              {settings.autoTaskOnAccept ? "Follow-up tasks scheduled" : "No tasks scheduled (Setting off)"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Approved for manual field execution
          </p>
        </Card>

        <Card className="p-5 border-slate-200 bg-slate-50/50">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Rejected / Dismissed
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {rejectedCount}
            </span>
            <span className="text-xs text-slate-500">zero tasks scheduled</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Farmer determined advice inapplicable or unnecessary
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Filter size={15} className="text-forest-600" />
          Filter Plans:
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Statuses ({advisories.length})</option>
              <option value="Pending Decision">Pending ({pendingCount})</option>
              <option value="Accepted">Accepted ({acceptedCount})</option>
              <option value="Rejected">Rejected ({rejectedCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              <option value="Nutrient Management">Nutrient Management</option>
              <option value="Irrigation Timing">Irrigation Timing</option>
              <option value="Canopy Inspection">Canopy Inspection</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advisory Cards List */}
      <div className="mt-6 space-y-5">
        {filteredAdvisories.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-xs font-semibold text-slate-500">
              No advisory plans match the selected filters.
            </p>
          </Card>
        ) : (
          filteredAdvisories.map((plan) => (
            <Card key={plan.id} className="p-6 border-[#dfe6dd]">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-forest-700">
                      {plan.id}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        plan.priority === "High"
                          ? "bg-rose-100 text-rose-800"
                          : plan.priority === "Medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {plan.priority} Priority
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {plan.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        plan.status === "Pending Decision"
                          ? "bg-blue-100 text-blue-800"
                          : plan.status === "Accepted"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600 line-through"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-ink sm:text-lg">
                    {plan.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      Target: <strong>{plan.targetParcel}</strong> ({plan.crop})
                    </span>
                    {plan.acceptedAt && (
                      <span>Accepted at: <strong>{plan.acceptedAt}</strong></span>
                    )}
                    {plan.associatedTaskId && (
                      <span className="text-forest-700 font-semibold">
                        Task: <strong>{plan.associatedTaskId}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Farmer Decision Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-start">
                  {plan.status === "Pending Decision" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingPlan(plan);
                          setRejectReason("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 transition-colors"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(plan.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        Accept Plan
                      </button>
                    </>
                  ) : plan.status === "Accepted" ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={15} />
                        Accepted by Farmer
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 border border-slate-200">
                        <XCircle size={15} />
                        Rejected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          reconsiderPlan(plan.id);
                          setFeedbackMessage({
                            text: `Plan ${plan.id} returned to Pending Decision state for farmer re-evaluation.`,
                            type: "info",
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#dfe6dd] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                        title="Re-open this plan for review"
                      >
                        <RefreshCw size={12} />
                        Reconsider
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Note if Rejected */}
              {plan.status === "Rejected" && plan.rejectionReason && (
                <div className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                  <span className="font-semibold block mb-0.5">Farmer Rejection Reason:</span>
                  {plan.rejectionReason}
                </div>
              )}

              {/* Agronomic Reasoning */}
              <div className="mt-4 space-y-3 text-xs leading-relaxed border-t border-[#edf0eb] pt-3">
                <div>
                  <strong className="text-ink block mb-0.5">Agronomic Reasoning:</strong>
                  <p className="text-slate-700">{plan.reasoning}</p>
                </div>

                {/* Supporting Evidence Card */}
                <div className="rounded-xl border border-[#dfe6dd] bg-slate-50/80 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <Database size={14} className="text-forest-600" />
                    <span>Supporting Research Evidence & Citations:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pl-5">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Dataset Source:</span>
                      <strong className="text-ink font-medium">{plan.supportingEvidence.datasetSource}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Metrics Cited:</span>
                      <span className="font-mono text-ink text-[11px]">{plan.supportingEvidence.metricsCited}</span>
                    </div>
                  </div>
                </div>

                {/* Recommended Field Action */}
                <div className="rounded-xl border border-forest-100 bg-[#f6f9f5] p-3.5">
                  <strong className="text-forest-900 block mb-0.5">Recommended Field Action:</strong>
                  <p className="text-forest-800">{plan.recommendedAction}</p>
                </div>

                {/* Uncertainty & Operational Boundary Disclosures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
                  <div className="flex items-start gap-2 text-amber-900 bg-amber-50/60 rounded-lg p-2.5 border border-amber-200">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <span className="font-bold block">Scientific Uncertainty:</span>
                      {plan.uncertaintyDisclosure}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-blue-900 bg-blue-50/60 rounded-lg p-2.5 border border-blue-200">
                    <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
                    <div>
                      <span className="font-bold block">Operational Boundary:</span>
                      {plan.operationalBoundary}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {rejectingPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="reject-modal-title" className="text-base font-bold text-ink">
                Reject Advisory Plan ({rejectingPlan.id})
              </h3>
              <button
                type="button"
                onClick={() => setRejectingPlan(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Please provide a rationale for rejecting this plan for <strong>{rejectingPlan.targetParcel}</strong>. Rejecting this advisory guarantees that no task will be created.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason / Field Context *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Field inspection confirmed soil moisture is adequate; secondary irrigation would cause waterlogging."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  onClick={() => setRejectingPlan(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset State Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle size={24} />
              <h3 id="reset-modal-title" className="text-base font-bold text-ink">
                Reset Advisory Review State?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              This will restore all advisory plans to their default &quot;Pending Decision&quot; state. Existing tasks already created on the task board will remain intact.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPlans();
                  setShowResetConfirm(false);
                  setFeedbackMessage({
                    text: "Advisory review states reset to Pending Decision.",
                    type: "info",
                  });
                }}
                className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
