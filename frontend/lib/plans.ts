import type { Zone } from "../types/api";

export interface StatusStyle {
  label: string;
  badgeClass: string;
}

export function formatPlanStatus(rawStatus?: string | null, approvalState?: string | null): StatusStyle {
  const s = (approvalState || rawStatus || "pending_approval").trim().toLowerCase();

  switch (s) {
    case "pending_approval":
    case "pending":
    case "pending decision":
      return {
        label: "Pending Approval",
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-200",
      };
    case "approved":
      return {
        label: "Approved",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    case "executing":
    case "in_progress":
      return {
        label: "Executing",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "completed":
      return {
        label: "Completed",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    case "rejected":
      return {
        label: "Rejected",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
      };
    case "draft":
      return {
        label: "Draft",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
    default:
      return {
        label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export function formatPlanPriority(priority?: string | null): StatusStyle {
  const p = (priority || "medium").trim().toLowerCase();

  switch (p) {
    case "urgent":
    case "critical":
      return {
        label: "Urgent",
        badgeClass: "bg-red-100 text-red-800 border border-red-200",
      };
    case "high":
      return {
        label: "High Priority",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    case "medium":
    case "moderate":
      return {
        label: "Medium Priority",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "low":
    default:
      return {
        label: "Low Priority",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export function formatPolicyDecision(decision?: string | null): StatusStyle {
  const d = (decision || "").trim().toLowerCase();

  switch (d) {
    case "allow":
      return {
        label: "Safety Allow",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    case "approval_required":
    case "requires_review":
      return {
        label: "Approval Required",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "reject":
    case "rejected":
      return {
        label: "Safety Rejected",
        badgeClass: "bg-red-100 text-red-800 border border-red-200",
      };
    case "escalate":
      return {
        label: "Escalation Required",
        badgeClass: "bg-purple-100 text-purple-800 border border-purple-200",
      };
    default:
      return {
        label: decision || "Standard",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export function resolveZoneName(zoneId?: string | null, zones?: Zone[]): string {
  if (!zoneId) return "Farm-wide";
  if (!zones || zones.length === 0) return "Zone unassigned";
  const matched = zones.find((z) => z.id === zoneId);
  return matched ? matched.name : "Zone unassigned";
}
