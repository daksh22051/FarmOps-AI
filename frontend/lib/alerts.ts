import type { Zone, AuditEvent } from "../types/api";

export interface SeverityStyle {
  label: string;
  badgeClass: string;
  iconClass: string;
}

export function formatAlertSeverity(severity?: string | null): SeverityStyle {
  const s = (severity || "info").trim().toLowerCase();

  switch (s) {
    case "critical":
      return {
        label: "Critical Alert",
        badgeClass: "bg-red-100 text-red-800 border border-red-200",
        iconClass: "text-red-600",
      };
    case "warning":
    case "medium":
    case "high":
      return {
        label: "Warning",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
        iconClass: "text-amber-600",
      };
    case "info":
    case "low":
    default:
      return {
        label: "Notice / Info",
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-200",
        iconClass: "text-blue-600",
      };
  }
}

export interface EscalationStatusStyle {
  label: string;
  badgeClass: string;
}

export function formatEscalationStatus(status?: string | null): EscalationStatusStyle {
  const s = (status || "open").trim().toLowerCase();

  switch (s) {
    case "open":
      return {
        label: "Open / Pending Expert",
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-200",
      };
    case "in_review":
      return {
        label: "In Expert Review",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "resolved":
      return {
        label: "Resolved",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      };
    case "rejected":
      return {
        label: "Rejected / Dismissed",
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
      };
    default:
      return {
        label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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

const SENSITIVE_KEYS = ["token", "secret", "password", "key", "credential", "hash", "jwt", "auth"];

export function sanitizeAuditState(
  state?: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!state || typeof state !== "object") return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditState(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function formatAuditEvent(evt: AuditEvent): {
  title: string;
  summary: string;
  badgeClass: string;
  entityLabel: string;
} {
  const entity = (evt.entity_type || "system").replace(/_/g, " ");
  const action = (evt.event_type || "action").replace(/_/g, " ");
  const title = `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${action}`;

  let summary = `Event triggered by ${evt.actor_id || evt.source || "system"}.`;
  if (evt.after_state && typeof evt.after_state === "object") {
    const keys = Object.keys(evt.after_state);
    if (keys.length > 0) {
      summary = `Updated fields: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ` (+${keys.length - 4} more)` : ""}.`;
    }
  }

  let badgeClass = "bg-slate-100 text-slate-700";
  if (action.includes("create") || action.includes("approv") || action.includes("complet")) {
    badgeClass = "bg-emerald-100 text-emerald-800";
  } else if (action.includes("start") || action.includes("in_progress") || action.includes("review")) {
    badgeClass = "bg-amber-100 text-amber-800";
  } else if (action.includes("reject") || action.includes("cancel") || action.includes("fail")) {
    badgeClass = "bg-rose-100 text-rose-800";
  } else if (action.includes("alert") || action.includes("risk")) {
    badgeClass = "bg-blue-100 text-blue-800";
  }

  return {
    title,
    summary,
    badgeClass,
    entityLabel: entity.toUpperCase(),
  };
}
