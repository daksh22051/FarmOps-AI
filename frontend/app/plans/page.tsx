"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { ActionPlan, ActionPlanStep } from "../../types/api";
import {
  getActionPlans,
  approveActionPlan,
  rejectActionPlan,
  rescheduleActionPlan,
} from "../../lib/api/farmops";
import {
  formatPlanStatus,
  formatPlanPriority,
  formatPolicyDecision,
  resolveZoneName,
} from "../../lib/plans";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Filter,
  Info,
  RefreshCw,
  X,
  XCircle,
  ShieldAlert,
  Clock,
  ListChecks,
  CalendarClock,
} from "lucide-react";

export default function AdvisoryPlansPage() {
  const { selectedFarmId, selectedFarm, backendZones } = useFarm();

  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Rejection Modal State
  const [rejectingPlan, setRejectingPlan] = useState<ActionPlan | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reschedulingPlan, setReschedulingPlan] = useState<ActionPlan | null>(null);
  const [rescheduleFrom, setRescheduleFrom] = useState("");
  const [rescheduleTo, setRescheduleTo] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // User Feedback Message
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const loadPlans = useCallback(async (farmId: string) => {
    setIsLoadingPlans(true);
    setPlansError(null);
    try {
      const res = await getActionPlans(farmId);
      if (res.error) {
        setPlansError(res.error.message || "Failed to load action plans.");
        setPlans([]);
      } else if (Array.isArray(res.data)) {
        setPlans(res.data);
      } else {
        setPlans([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading action plans.";
      setPlansError(msg);
      setPlans([]);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  // Farm-switching safety: clear plans immediately and reload for selected farm
  useEffect(() => {
    if (!selectedFarmId) {
      setPlans([]);
      setIsLoadingPlans(false);
      setPlansError(null);
      return;
    }
    setPlans([]);
    void loadPlans(selectedFarmId);
  }, [selectedFarmId, loadPlans]);

  const handleApprove = async (planId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await approveActionPlan(planId);
      if (res.error) {
        setFeedbackMessage({
          text: `Approval failed: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: `Action plan approved successfully. An authoritative field task has been scheduled on the Task Board.`,
          type: "success",
        });
        if (selectedFarmId) {
          await loadPlans(selectedFarmId);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error approving plan.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Opens the reschedule dialog. The window is prefilled from the plan's own proposed
   * window when it has one; it is never prefilled with a guessed date, because the
   * execution window is the farmer's decision about their own field.
   */
  const openRescheduleModal = (plan: ActionPlan) => {
    const toLocalInput = (iso?: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setReschedulingPlan(plan);
    setRescheduleFrom(toLocalInput(plan.earliest_at));
    setRescheduleTo(toLocalInput(plan.latest_at));
    setRescheduleReason("");
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingPlan || isSubmitting) return;
    if (!rescheduleFrom || !rescheduleTo) {
      setFeedbackMessage({ text: "Enter both a start and an end for the new window.", type: "error" });
      return;
    }
    if (new Date(rescheduleTo) <= new Date(rescheduleFrom)) {
      setFeedbackMessage({ text: "The window must end after it starts.", type: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await rescheduleActionPlan(reschedulingPlan.id, {
        earliest_at: new Date(rescheduleFrom).toISOString(),
        latest_at: new Date(rescheduleTo).toISOString(),
        review_notes: rescheduleReason.trim() || undefined,
      });
      if (res.error) {
        setFeedbackMessage({ text: `Reschedule failed: ${res.error.message}`, type: "error" });
      } else {
        setFeedbackMessage({
          text: "New execution window recorded. The plan is back on the approval queue as a new version; the earlier proposal is kept in the timeline.",
          type: "info",
        });
        setReschedulingPlan(null);
        if (selectedFarmId) {
          await loadPlans(selectedFarmId);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error rescheduling plan.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPlan || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await rejectActionPlan(rejectingPlan.id, {
        review_notes: rejectReason.trim() || undefined,
      });
      if (res.error) {
        setFeedbackMessage({
          text: `Rejection failed: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: `Action plan ${rejectingPlan.id} was rejected. No field tasks will be instantiated.`,
          type: "info",
        });
        setRejectingPlan(null);
        setRejectReason("");
        if (selectedFarmId) {
          await loadPlans(selectedFarmId);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error rejecting plan.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlans = plans.filter((plan) => {
    const rawState = (plan.approval_state || plan.status || "").toLowerCase();
    if (statusFilter !== "ALL") {
      if (statusFilter === "pending_approval" && !["pending_approval", "draft"].includes(rawState)) {
        return false;
      }
      if (statusFilter === "approved" && rawState !== "approved") {
        return false;
      }
      if (statusFilter === "executing" && !["executing", "in_progress"].includes(rawState)) {
        return false;
      }
      if (statusFilter === "completed" && rawState !== "completed") {
        return false;
      }
      if (statusFilter === "rejected" && rawState !== "rejected") {
        return false;
      }
      if (statusFilter === "cancelled" && rawState !== "cancelled") {
        return false;
      }
    }

    if (priorityFilter !== "ALL") {
      const p = (plan.priority || "").toLowerCase();
      if (priorityFilter.toLowerCase() !== p) return false;
    }

    return true;
  });

  const pendingCount = plans.filter((p) => {
    const s = (p.approval_state || p.status || "").toLowerCase();
    return s === "pending_approval" || s === "draft";
  }).length;

  const approvedExecutingCount = plans.filter((p) => {
    const s = (p.approval_state || p.status || "").toLowerCase();
    return ["approved", "executing", "completed"].includes(s);
  }).length;

  const rejectedCancelledCount = plans.filter((p) => {
    const s = (p.approval_state || p.status || "").toLowerCase();
    return ["rejected", "cancelled"].includes(s);
  }).length;

  return (
    <AppShell title="Action Plans">
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
            Agronomic Action Plans
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Authoritative agronomic action plans generated from verified AI recommendations. Human approval is strictly enforced before any plan can spawn field tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedFarmId || isLoadingPlans}
            onClick={() => {
              if (selectedFarmId) void loadPlans(selectedFarmId);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoadingPlans ? "animate-spin" : ""} />
            Refresh Plans
          </button>
        </div>
      </div>

      {/* Decision Workflow Banner */}
      <div className="mt-6 rounded-xl border border-forest-200 bg-[#f4f7f2] p-4 text-xs text-forest-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div className="space-y-1">
            <p className="font-semibold text-forest-900">
              Deterministic Safety Boundary & Human Approval Flow
            </p>
            <p className="leading-relaxed text-forest-800">
              <strong>Workflow:</strong> Risk Assessment → AI Evaluation → Deterministic Safety Guard → <u>Action Plan</u> → <u>Farmer Decision</u> → Executable Task → Risk Reassessment.
              Plans requiring human approval remain locked until you explicitly accept or reject them. <strong>Approving an action plan instantiates a tracked field task for manual crew execution; it never commands physical farm equipment or automated valves.</strong>
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
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : feedbackMessage.type === "error" ? (
              <ShieldAlert size={16} className="text-rose-600 shrink-0" />
            ) : (
              <Info size={16} className="text-blue-600 shrink-0" />
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
            Requires human sign-off before operational execution
          </p>
        </Card>

        <Card className="p-5 border-emerald-200 bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Approved / Executing
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-950">
              {approvedExecutingCount}
            </span>
            <span className="text-xs text-emerald-700 font-medium">
              active or completed in field
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Approved for manual crew work & tracked on Task Board
          </p>
        </Card>

        <Card className="p-5 border-slate-200 bg-slate-50/50">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Rejected / Cancelled
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">
              {rejectedCancelledCount}
            </span>
            <span className="text-xs text-slate-500">zero tasks dispatched</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Farmer or SafetyGuard determined action inadmissible
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
              <option value="ALL">All Statuses ({plans.length})</option>
              <option value="pending_approval">Pending Approval ({pendingCount})</option>
              <option value="approved">Approved</option>
              <option value="executing">Executing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
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
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoadingPlans && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-forest-800 bg-forest-50 border border-forest-200 px-3.5 py-2 rounded-xl">
            <RefreshCw size={14} className="animate-spin text-forest-700" />
            <span>Loading action plans for {selectedFarm?.name || "selected farm"}…</span>
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 bg-slate-200 rounded-md" />
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
              <div className="grid sm:grid-cols-4 gap-3 pt-2">
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-14 bg-slate-100 rounded-xl" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-9 w-32 bg-slate-200 rounded-xl" />
                <div className="h-9 w-20 bg-slate-200 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoadingPlans && plansError && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-center shadow-sm">
          <AlertTriangle size={32} className="mx-auto text-rose-600" />
          <h3 className="mt-2 text-base font-bold text-rose-950">
            ⚠️ Unable to load action plans
          </h3>
          <p className="mt-1 text-xs text-rose-800 max-w-md mx-auto">
            {plansError || "The telemetry server took too long or encountered an error. Click below to retry."}
          </p>
          {selectedFarmId && (
            <button
              type="button"
              onClick={() => void loadPlans(selectedFarmId)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 transition"
            >
              <RefreshCw size={13} />
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* Empty State: No plans exist */}
      {!isLoadingPlans && !plansError && plans.length === 0 && (
        <Card className="mt-6 flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <ListChecks size={24} />
          </div>
          <h3 className="mt-4 text-base font-bold text-ink">
            No Action Plans Recorded
          </h3>
          <p className="mt-1 text-xs text-slate-600 max-w-md">
            No agronomic action plans currently exist for <strong>{selectedFarm?.name || "this farm"}</strong>.
            You can evaluate risks in the Risk Center with AI, and convert safe proposals into actionable plans.
          </p>
          <Link
            href="/risks"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800"
          >
            Go to Risk Center
          </Link>
        </Card>
      )}

      {/* Empty Filtered Results */}
      {!isLoadingPlans && !plansError && plans.length > 0 && filteredPlans.length === 0 && (
        <Card className="mt-6 p-10 text-center">
          <p className="text-xs font-semibold text-slate-500">
            No action plans match the selected filters.
          </p>
        </Card>
      )}

      {/* Action Plan Cards List */}
      {!isLoadingPlans && !plansError && filteredPlans.length > 0 && (
        <div className="mt-6 space-y-5">
          {filteredPlans.map((plan) => {
            const statusStyle = formatPlanStatus(plan.status, plan.approval_state);
            const priorityStyle = formatPlanPriority(plan.priority);
            const policyStyle = formatPolicyDecision(plan.policy_decision);
            const zoneName = resolveZoneName(plan.zone_id, backendZones);
            const isPending =
              plan.approval_state === "pending_approval" ||
              plan.status === "pending_approval" ||
              plan.approval_state === "draft";
            const isApproved =
              plan.approval_state === "approved" ||
              plan.status === "approved" ||
              plan.approval_state === "executing" ||
              plan.status === "executing" ||
              plan.approval_state === "completed";
            const isRejected =
              plan.approval_state === "rejected" ||
              plan.status === "rejected";

            const rawSteps = (plan.steps || []) as (ActionPlanStep | Record<string, unknown>)[];

            return (
              <Card key={plan.id} className="p-6 border-[#dfe6dd]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-forest-700">
                        {plan.id.slice(0, 12)}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${priorityStyle.badgeClass}`}>
                        {priorityStyle.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusStyle.badgeClass}`}>
                        {statusStyle.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${policyStyle.badgeClass}`}>
                        {policyStyle.label}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-bold text-ink sm:text-lg">
                      {plan.title || plan.action_summary || "Agronomic Field Plan"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        Target: <strong>{zoneName}</strong>
                      </span>
                      {plan.action_type && (
                        <span>
                          Action Type: <strong>{plan.action_type}</strong>
                        </span>
                      )}
                      {plan.created_at && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(plan.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-start">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setRejectingPlan(plan);
                            setRejectReason("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => openRescheduleModal(plan)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-50 transition-colors disabled:opacity-50"
                        >
                          <CalendarClock size={14} />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleApprove(plan.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          Approve Plan
                        </button>
                      </>
                    ) : isApproved ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 size={15} />
                        {plan.approval_state === "completed" ? "Executed & Completed" : "Approved by Farmer"}
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-600 border border-slate-200">
                        <XCircle size={15} />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 border border-slate-200">
                        {statusStyle.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Plan Objective & Summary */}
                <div className="mt-4 space-y-3 text-xs leading-relaxed border-t border-[#edf0eb] pt-3">
                  {plan.objective && (
                    <div>
                      <strong className="text-ink block mb-0.5">Operational Objective:</strong>
                      <p className="text-slate-700">{plan.objective}</p>
                    </div>
                  )}

                  {plan.action_summary && plan.action_summary !== plan.title && (
                    <div className="rounded-xl border border-forest-100 bg-[#f6f9f5] p-3.5">
                      <strong className="text-forest-900 block mb-0.5">Action Protocol:</strong>
                      <p className="text-forest-800">{plan.action_summary}</p>
                    </div>
                  )}

                  {/* Agronomic Rationale */}
                  {plan.rationale && (
                    <div>
                      <strong className="text-ink block mb-0.5">Agronomic Rationale:</strong>
                      <p className="text-slate-700">{plan.rationale}</p>
                    </div>
                  )}

                  {/* Ordered Action Steps */}
                  {rawSteps.length > 0 && (
                    <div className="rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-ink text-xs">
                        <ListChecks size={15} className="text-forest-600" />
                        <span>Execution Steps ({rawSteps.length}):</span>
                      </div>
                      <ol className="space-y-1.5 pl-5 list-decimal text-xs text-slate-700">
                        {rawSteps.map((step, sIdx) => {
                          const title = String(step.title || `Step ${sIdx + 1}`);
                          const desc = step.description ? String(step.description) : null;
                          return (
                            <li key={sIdx} className="leading-relaxed">
                              <span className="font-semibold text-ink">{title}</span>
                              {desc && <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}

                  {/* Supporting Evidence / Telemetry */}
                  {plan.evidence && Object.keys(plan.evidence).length > 0 && (
                    <div className="rounded-xl border border-[#dfe6dd] bg-slate-50/60 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        <Database size={14} className="text-forest-600" />
                        <span>Supporting Telemetry Evidence:</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 pl-5">
                        {JSON.stringify(plan.evidence, null, 2)}
                      </div>
                    </div>
                  )}

                  {/* Safety Flags & Disclosures */}
                  {(plan.safety_flags && plan.safety_flags.length > 0) || plan.safety_notes ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <span>Deterministic Safety Policies & Boundaries:</span>
                      </div>
                      {plan.safety_flags && plan.safety_flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {plan.safety_flags.map((flag, fIdx) => (
                            <span
                              key={fIdx}
                              className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-900"
                            >
                              policy: {flag}
                            </span>
                          ))}
                        </div>
                      )}
                      {plan.safety_notes && (
                        <p className="mt-1 italic">{plan.safety_notes}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {reschedulingPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="reschedule-modal-title" className="text-base font-bold text-ink">
                Reschedule Plan ({reschedulingPlan.id.slice(0, 10)})
              </h3>
              <button
                type="button"
                onClick={() => setReschedulingPlan(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Set the window in which this work should actually happen. The plan returns to
                the approval queue as a new version, and the proposal you are replacing stays
                in the audit timeline.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reschedule-from" className="block text-xs font-semibold text-slate-700 mb-1">
                    Earliest
                  </label>
                  <input
                    id="reschedule-from"
                    type="datetime-local"
                    required
                    value={rescheduleFrom}
                    onChange={(e) => setRescheduleFrom(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="reschedule-to" className="block text-xs font-semibold text-slate-700 mb-1">
                    Latest
                  </label>
                  <input
                    id="reschedule-to"
                    type="datetime-local"
                    required
                    value={rescheduleTo}
                    onChange={(e) => setRescheduleTo(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reschedule-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  id="reschedule-reason"
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g., Rain forecast this afternoon; moving irrigation to tomorrow morning."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReschedulingPlan(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save New Window"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                Reject Action Plan ({rejectingPlan.id.slice(0, 10)})
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
                Please provide an agronomic rationale for rejecting this plan. Rejecting this plan records your decision and guarantees that no field tasks are dispatched.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason / Field Rationale
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g., Visual inspection indicates soil moisture is sufficient; additional irrigation would risk root rot."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRejectingPlan(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
