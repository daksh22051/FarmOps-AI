import { ApiClientError } from "./api/client";

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  WATER_AGENT: "Water Stress Agent",
  PEST_DISEASE_AGENT: "Pest & Pathogen Agent",
  NUTRIENT_AGENT: "Soil Fertility & Nutrient Agent",
  MARKET_CONTEXT_AGENT: "Market Context Agent",
  ORCHESTRATOR: "FarmOps Orchestrator",
};

export function formatAgentName(agentType?: string): string {
  if (!agentType) return "Agronomic AI Agent";
  const clean = agentType.trim().toUpperCase();
  if (AGENT_DISPLAY_NAMES[clean]) {
    return AGENT_DISPLAY_NAMES[clean];
  }
  // Convert SNAKE_CASE to Title Case
  return clean
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export interface SafetyStyle {
  decisionKey: "allow" | "approval_required" | "reject" | "escalate";
  label: string;
  badgeClass: string;
  bannerBorderClass: string;
  bannerBgClass: string;
  textColorClass: string;
  iconColorClass: string;
  summaryText: string;
}

export function getSafetyDecisionStyle(
  decision?: string,
  approvalRequired?: boolean
): SafetyStyle {
  const d = (decision || "").trim().toLowerCase();

  if (d === "reject" || d === "rejected") {
    return {
      decisionKey: "reject",
      label: "Safety Policy: Rejected",
      badgeClass: "bg-red-100 text-red-800 border border-red-200",
      bannerBorderClass: "border-red-200",
      bannerBgClass: "bg-red-50/80",
      textColorClass: "text-red-950",
      iconColorClass: "text-red-700",
      summaryText:
        "Proposal rejected by deterministic SafetyGuard. Prohibited or hazardous actions cannot be executed.",
    };
  }

  if (d === "escalate" || d === "escalated") {
    return {
      decisionKey: "escalate",
      label: "Safety Policy: Escalation Required",
      badgeClass: "bg-orange-100 text-orange-800 border border-orange-200",
      bannerBorderClass: "border-orange-200",
      bannerBgClass: "bg-orange-50/80",
      textColorClass: "text-orange-950",
      iconColorClass: "text-orange-700",
      summaryText:
        "Critical agronomic situation requiring immediate manager or agronomist supervisor escalation.",
    };
  }

  if (d === "approval_required" || d === "requires_review" || approvalRequired) {
    return {
      decisionKey: "approval_required",
      label: "Safety Policy: Human Approval Required",
      badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      bannerBorderClass: "border-amber-200",
      bannerBgClass: "bg-amber-50/80",
      textColorClass: "text-amber-950",
      iconColorClass: "text-amber-700",
      summaryText:
        "Sensitive intervention identified. Explicit farmer or agronomist authorization is required before execution.",
    };
  }

  // Routine advisory / allow
  return {
    decisionKey: "allow",
    label: "Safety Policy: Allowed (Routine Advisory)",
    badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    bannerBorderClass: "border-emerald-200",
    bannerBgClass: "bg-emerald-50/80",
    textColorClass: "text-emerald-950",
    iconColorClass: "text-emerald-700",
    summaryText:
      "Advisory guidance cleared by deterministic SafetyGuard. Standard field monitoring applies.",
  };
}

export function formatUrgencyStyle(urgency?: string): {
  label: string;
  badgeClass: string;
} {
  const u = (urgency || "").trim().toLowerCase();
  switch (u) {
    case "critical":
      return {
        label: "Critical Urgency",
        badgeClass: "bg-red-100 text-red-800 border border-red-200",
      };
    case "high":
      return {
        label: "High Urgency",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
      };
    case "medium":
      return {
        label: "Medium Urgency",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
      };
    case "low":
    default:
      return {
        label: "Low Urgency",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

export function formatAIErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    switch (err.status) {
      case 401:
        return "Authentication expired. Please log in again to evaluate risks.";
      case 403:
        return "Access denied: you do not have permission to evaluate risks for this farm.";
      case 404:
        return "Risk assessment not found on backend. It may have been updated or removed.";
      case 422:
        return "Invalid AI evaluation request parameters.";
      case 429:
        return "AI analysis is temporarily unavailable due to service quota. Please try again in a few moments.";
      case 500:
        return "Backend AI reasoning service encountered an error while evaluating this risk.";
      case 502:
      case 503:
        return "AI model provider is temporarily unreachable. Please retry shortly.";
      default:
        return err.message || "Failed to complete AI evaluation.";
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "An unexpected error occurred during AI evaluation.";
}
