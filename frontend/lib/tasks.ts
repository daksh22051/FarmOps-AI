import type { Zone } from "../types/api";

export interface TaskStatusStyle {
  label: string;
  badgeClass: string;
}

export function formatTaskStatus(status?: string | null): TaskStatusStyle {
  const s = (status || "pending").trim().toLowerCase();

  switch (s) {
    case "in_progress":
    case "in progress":
      return {
        label: "In Progress",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "completed":
      return {
        label: "Completed",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
      };
    case "assigned":
      return {
        label: "Assigned",
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-200",
      };
    case "blocked":
      return {
        label: "Blocked",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    case "pending":
    default:
      return {
        label: "Pending",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export function formatTaskPriority(priority?: string | null): TaskStatusStyle {
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
        label: "High",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    case "medium":
    case "moderate":
      return {
        label: "Medium",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "low":
    default:
      return {
        label: "Low",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export interface NormalizedChecklistItem {
  text: string;
  done: boolean;
}

export function parseTaskChecklist(rawChecklist?: unknown): NormalizedChecklistItem[] {
  if (!rawChecklist || !Array.isArray(rawChecklist)) {
    return [];
  }

  return rawChecklist.map((item) => {
    if (typeof item === "string") {
      return { text: item, done: false };
    }
    if (typeof item === "object" && item !== null) {
      const record = item as Record<string, unknown>;
      const text = String(record.text || record.title || record.description || record.step || "Execution step");
      const done = Boolean(record.done || record.completed || record.is_done);
      return { text, done };
    }
    return { text: String(item), done: false };
  });
}

export function resolveZoneName(zoneId?: string | null, zones?: Zone[]): string {
  if (!zoneId) return "Farm-wide";
  if (!zones || zones.length === 0) return "Zone unassigned";
  const matched = zones.find((z) => z.id === zoneId);
  return matched ? matched.name : "Zone unassigned";
}
