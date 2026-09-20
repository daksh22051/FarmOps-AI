import { apiClient } from "./client";
import type { ActionPlan, Alert, RiskAssessment, Task } from "../../types/api";

/** Single freshness vocabulary shared with the backend risk engine and dashboard. */
export type Freshness = "fresh" | "stale" | "very_stale" | "offline";

export interface Monitoring {
  status: Freshness;
  has_data: boolean;
  age_minutes: number | null;
  last_reading_at: string | null;
}
/** A metric that was actually measured. Absent from `readings` means never reported. */
export interface ZoneReading {
  metric: string;
  value: number;
  unit: string | null;
  event_at: string | null;
  received_at: string | null;
  source: string;
  quality: string;
  simulated: boolean;
  freshness: Freshness;
}

export interface DashboardZone {
  id: string; name: string; crop: string | null; area: number | null;
  area_unit: string; risk_ids: string[];
  readings: Record<string, ZoneReading>;
  /** The zone's own lifecycle state — not its telemetry freshness. */
  status: string | null;
  monitoring: Monitoring;
  telemetry_status: Freshness;
  last_reading_at: string | null;
}
export interface DashboardSnapshot {
  farm_id: string; generated_at: string; monitoring: Monitoring;
  freshness_thresholds_minutes: { fresh: number; stale: number; very_stale: number };
  ai_available: boolean; zones: DashboardZone[]; risks: RiskAssessment[]; plans: ActionPlan[];
  tasks: Task[]; completed_tasks: Task[]; alerts: Alert[];
  counts: { risks: number; pending_plans: number; open_tasks: number; alerts: number; devices: number };
}

/** Human-facing label for a freshness value; never styles stale data as live. */
export function freshnessLabel(f: Freshness | undefined, hasData = true): string {
  if (!hasData || f === "offline") return "No recent data";
  if (f === "fresh") return "Current";
  if (f === "stale") return "Stale";
  if (f === "very_stale") return "Very stale";
  return "Unknown";
}
export async function getDashboard(farmId: string, signal?: AbortSignal) {
  const response = await apiClient.get<DashboardSnapshot>(`/farms/${farmId}/dashboard`, { signal, cache: "no-store" });
  if (!response.success || !response.data) throw new Error(response.message || "Dashboard data is unavailable.");
  return response.data;
}
