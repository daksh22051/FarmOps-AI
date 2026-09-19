import type { Zone } from "../types/api";

export const RISK_TYPE_LABELS: Record<string, string> = {
  water_stress: "Water Stress",
  water_stress_risk: "Water Stress",
  pest_disease: "Pest / Disease Risk",
  pest_disease_risk: "Pest / Disease Risk",
  nutrient_deficiency: "Nutrient Deficiency",
  nutrient_deficiency_risk: "Nutrient Deficiency",
  heat_stress: "Heat Stress",
  frost: "Frost Hazard",
  market_exposure: "Market Exposure",
};

export function formatRiskType(rawType: string): string {
  if (!rawType) return "Unknown Risk";
  const clean = rawType.trim().toLowerCase();
  if (RISK_TYPE_LABELS[clean]) {
    return RISK_TYPE_LABELS[clean];
  }
  // Default title casing for any other recognized types
  return clean
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface SeverityStyle {
  label: string;
  badgeClass: string;
  cardBorderClass: string;
  cardBgClass: string;
  iconColorClass: string;
}

export function getSeverityStyle(severity?: string): SeverityStyle {
  const s = (severity || "").trim().toLowerCase();

  switch (s) {
    case "critical":
      return {
        label: "Critical",
        badgeClass: "bg-red-100 text-red-800 border border-red-200",
        cardBorderClass: "border-red-200",
        cardBgClass: "bg-red-50/30",
        iconColorClass: "text-red-700",
      };
    case "high":
      return {
        label: "High",
        badgeClass: "bg-rose-100 text-rose-800 border border-rose-200",
        cardBorderClass: "border-rose-200",
        cardBgClass: "bg-rose-50/20",
        iconColorClass: "text-rose-600",
      };
    case "medium":
    case "moderate":
      return {
        label: "Medium",
        badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
        cardBorderClass: "border-amber-200",
        cardBgClass: "bg-amber-50/20",
        iconColorClass: "text-amber-600",
      };
    case "low":
    default:
      return {
        label: "Low",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        cardBorderClass: "border-emerald-200",
        cardBgClass: "bg-emerald-50/20",
        iconColorClass: "text-emerald-600",
      };
  }
}

export function formatConfidence(confidence?: number | null): string {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return "Confidence unavailable";
  }
  const pct = confidence <= 1.0 ? Math.round(confidence * 100) : Math.round(confidence);
  return `${pct}% confidence`;
}

export function resolveZoneName(zoneId?: string | null, zones?: Zone[]): string {
  if (!zoneId) return "Farm-wide";
  if (!zones || zones.length === 0) return "Zone unavailable";
  const matched = zones.find((z) => z.id === zoneId);
  return matched ? matched.name : "Zone unavailable";
}

export function formatRiskStatus(status?: string): { label: string; badgeClass: string } {
  const s = (status || "").trim().toLowerCase();
  switch (s) {
    case "open":
      return { label: "Open", badgeClass: "bg-rose-50 text-rose-700 border border-rose-200" };
    case "acknowledged":
      return { label: "Acknowledged", badgeClass: "bg-blue-50 text-blue-700 border border-blue-200" };
    case "resolved":
      return { label: "Resolved", badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
    case "dismissed":
      return { label: "Dismissed", badgeClass: "bg-slate-100 text-slate-600 border border-slate-200" };
    default:
      return { label: status || "Open", badgeClass: "bg-slate-100 text-slate-700 border border-slate-200" };
  }
}
