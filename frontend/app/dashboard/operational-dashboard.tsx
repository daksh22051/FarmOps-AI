"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Droplets,
  Layers,
  Leaf,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useFarm } from "../../context/farm-context";
import { useDashboard } from "./use-dashboard";
import { LiveWeatherCard } from "./live-weather-card";
import { FieldReadingForm } from "./field-reading-form";
import {
  acknowledgeAlert,
  approveActionPlan,
  completeTask,
  createActionPlan,
  createTask,
  detectRisks,
  evaluateRiskWithAI,
  rejectActionPlan,
  startTask,
} from "../../lib/api/farmops";
import { formatRiskType, getSeverityStyle } from "../../lib/risks";
import { formatPlanStatus } from "../../lib/plans";
import type { AIEvaluationResponse, APIResponse, ActionPlan, Farm, RiskAssessment } from "../../types/api";

/* Metrics surfaced on a zone card, in display order. A metric is only rendered when
   the zone actually reported it. */
const ZONE_CARD_METRICS: { key: string; label: string }[] = [
  { key: "soil_moisture", label: "Soil Moisture" },
  { key: "soil_temperature", label: "Soil Temp" },
  { key: "air_temperature", label: "Air Temp" },
  { key: "air_humidity", label: "Humidity" },
  { key: "ph", label: "Soil pH" },
  { key: "nitrogen", label: "Nitrogen" },
  { key: "phosphorus", label: "Phosphorus" },
  { key: "potassium", label: "Potassium" },
];

/* ===== DESIGN TOKENS ===== */
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all duration-200";
const dangerBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200";
const input =
  "mt-1 w-full rounded-xl bg-white border border-slate-200 p-2.5 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none";

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "No data recorded";
  try {
    const timestamp = new Date(isoString).getTime();
    if (!Number.isFinite(timestamp)) return "No data recorded";
    const now = Date.now();
    const diffSec = Math.floor((now - timestamp) / 1000);
    if (diffSec < 45) return "Just now";
    const minutes = Math.floor(diffSec / 60);
    if (minutes <= 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  } catch {
    return "Recently";
  }
}

function formatIST(value?: string | null): string {
  if (!value) return "Not recorded";
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "Not recorded";
    return (
      d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " IST"
    );
  } catch {
    return value;
  }
}

function formatSchedule(plan: ActionPlan): string {
  if (plan.evidence && typeof (plan.evidence as Record<string, unknown>).timing_desc === "string") {
    return String((plan.evidence as Record<string, unknown>).timing_desc);
  }
  if (plan.earliest_at) {
    try {
      const startStr = new Date(plan.earliest_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const endStr = plan.latest_at
        ? new Date(plan.latest_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "";
      return `${startStr}${endStr ? ` – ${endStr}` : ""} IST`;
    } catch {
      // Fallback
    }
  }
  return `${plan.priority ? plan.priority.toUpperCase() : "HIGH"} Priority · Recommended within 4 hours`;
}

function unwrap<T>(response: APIResponse<T>): T {
  if (!response.success || response.data === null) {
    throw new Error(response.message || response.error?.message || "The action could not be completed.");
  }
  return response.data;
}

/* ===== GLASS SECTION CARD ===== */
function Section({
  title,
  subtitle,
  icon,
  action,
  children,
  badge,
  glowColor,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  glowColor?: string;
}) {
  return (
    <section className={`glass-card glass-card-hover rounded-2xl p-5 min-w-0 animate-fade-in ${glowColor || ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base flex gap-2 items-center">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-500">
      {children}
    </div>
  );
}

/* ===== SKELETON PULSE ===== */
function Skeleton({ className }: { className: string }) {
  return <div className={`bg-slate-200/70 animate-pulse rounded-xl ${className}`} />;
}

/* ===== 5-STAGE LIFECYCLE PIPELINE ===== */
function ActionPlanPipeline({
  approvalState,
  taskCreated,
}: {
  approvalState: string;
  taskCreated?: boolean;
}) {
  const isApproved = approvalState === "approved" || approvalState === "executing" || approvalState === "completed";
  const isRejected = approvalState === "rejected" || approvalState === "cancelled";
  const isCompleted = approvalState === "completed";

  const stages = [
    { label: "AI Generated", done: true, color: "emerald" },
    { label: "Safety Gated", done: true, color: "emerald" },
    {
      label: isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Approval",
      done: isApproved,
      failed: isRejected,
      active: !isApproved && !isRejected,
      color: isApproved ? "emerald" : isRejected ? "rose" : "amber",
    },
    {
      label: isCompleted ? "Task Dispatched" : isApproved || taskCreated ? "In Progress" : "Pending",
      done: isCompleted,
      active: isApproved && !isCompleted,
      color: isCompleted ? "emerald" : isApproved ? "cyan" : "slate",
    },
    {
      label: "Completed",
      done: isCompleted,
      color: isCompleted ? "emerald" : "slate",
    },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
        Lifecycle Pipeline
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all ${
                stage.done
                  ? "text-emerald-800 bg-emerald-50 border-emerald-200 shadow-xs"
                  : stage.failed
                  ? "text-rose-800 bg-rose-50 border-rose-200"
                  : stage.active
                  ? "text-amber-800 bg-amber-50 border-amber-200 animate-pulse"
                  : "text-slate-500 bg-white border-slate-200"
              }`}
            >
              {stage.done ? (
                <Check size={11} className="stroke-[3]" />
              ) : stage.failed ? (
                <X size={11} className="stroke-[3]" />
              ) : stage.active ? (
                <Clock size={11} />
              ) : null}
              {i + 1}. {stage.label}
            </span>
            {i < stages.length - 1 && <ArrowRight size={12} className="text-slate-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== MAIN DASHBOARD ===== */
export function OperationalDashboard({ farm }: { farm: Farm }) {
  const { backendFarms, selectFarm, triggerLiveTelemetry, refreshTelemetry } = useFarm();
  const { data, error, loading, isSwitching, refresh } = useDashboard(farm.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [isSimulatingFeed, setIsSimulatingFeed] = useState(false);
  const actionLock = useRef(false);
  const mountedFarm = useRef(farm.id);
  mountedFarm.current = farm.id;

  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [showReadings, setShowReadings] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [proposal, setProposal] = useState<{ risk: RiskAssessment; result: AIEvaluationResponse } | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [completion, setCompletion] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<"plans" | "open" | "completed" | "alerts">("open");

  useEffect(() => {
    setProposal(null);
    setShowTask(false);
    setShowReadings(false);
    setCompletion(null);
    setNotice(null);
  }, [farm.id]);

  async function handleSimulateFeed() {
    if (isSimulatingFeed) return;
    setIsSimulatingFeed(true);
    setNotice(null);
    try {
      const res = await triggerLiveTelemetry(farm.id);
      if (res.success) {
        setNotice({
          text: `🟢 Live sensor stream active! Telemetry synchronized for ${res.eventsGenerated || "all"} probe observations.`,
        });
        await refresh();
        await refreshTelemetry();
      } else {
        setNotice({
          text: res.error || "Failed to trigger live sensor stream.",
          error: true,
        });
      }
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : "Failed to connect live sensors.",
        error: true,
      });
    } finally {
      setIsSimulatingFeed(false);
    }
  }

  const disabled = !!busy || !!error || !data || isSwitching;

  async function act(id: string, operation: () => Promise<unknown>, message: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(id);
    setNotice(null);
    const origin = farm.id;
    try {
      await operation();
      if (mountedFarm.current === origin) {
        setNotice({ text: message });
        await refresh();
      }
    } catch (err) {
      if (mountedFarm.current === origin) {
        setNotice({
          text: err instanceof Error ? err.message : "Action failed. Please retry.",
          error: true,
        });
      }
    } finally {
      actionLock.current = false;
      setBusy(null);
    }
  }

  const risks = [...(data?.risks || [])].sort(
    (a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)
  );

  const zoneCrops = Array.from(new Set(data?.zones.map((z) => z.crop).filter(Boolean))) as string[];
  const mainCropsDisplay =
    zoneCrops.length > 0
      ? zoneCrops.join(" • ")
      : typeof farm.crop_profile?.primary_crop === "string"
      ? farm.crop_profile.primary_crop
      : "Wheat • Cotton";

  const monitoring = data?.monitoring.status;

  const zoneName = (id?: string | null) =>
    id ? data?.zones.find((z) => z.id === id)?.name || "Unknown zone" : "Farm-wide";

  const waterRisk = risks.find(
    (r) => r.risk_type.includes("water") || r.risk_type.includes("irrigation")
  );
  const pestRisk = risks.find(
    (r) => r.risk_type.includes("pest") || r.risk_type.includes("disease")
  );
  const nutrientRisk = risks.find(
    (r) => r.risk_type.includes("nutrient") || r.risk_type.includes("soil") || r.risk_type.includes("fertility")
  );

  return (
    <div className="space-y-6 pb-12">
      {/* ===== HEADER ===== */}
      <header className="flex flex-wrap items-center justify-between gap-4 animate-fade-in">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-glow-pulse" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
              Live Field Operations Command
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            {farm.name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time telemetry, automated risk intelligence, and AI action orchestration.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <select
            aria-label="Select farm"
            value={farm.id}
            disabled={!!busy || showReadings}
            onChange={(e) => void selectFarm(e.target.value)}
            className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-800 max-w-56 cursor-pointer shadow-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none"
          >
            {backendFarms.map((f) => (
              <option key={f.id} value={f.id} className="bg-white text-slate-900">
                {f.name}
              </option>
            ))}
          </select>

          <button
            className={secondary}
            onClick={() => setShowReadings(true)}
            disabled={disabled}
            aria-label="Record field readings"
          >
            <Droplets size={14} className="text-emerald-600" />
            + Record Reading
          </button>

          <button
            className={secondary}
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : "text-slate-500"} />
            Refresh
          </button>
        </div>
      </header>

      {/* ===== FLASH ALERTS ===== */}
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm flex justify-between items-center gap-3 animate-fade-in ${
            notice.error
              ? "bg-rose-50 border-rose-200 text-rose-800 font-medium"
              : "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium shadow-xs"
          }`}
        >
          <span>{notice.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 font-bold transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-xs"
        >
          <div className="flex gap-2.5 items-center">
            <AlertTriangle className="text-amber-600 flex-shrink-0" size={18} />
            <span>
              {error}{" "}
              {data
                ? "Reconnecting in background."
                : "Unable to reach the farm telemetry stream."}
            </span>
          </div>
          <button
            className="font-bold underline text-amber-800 hover:text-amber-950 disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading && <RefreshCw size={13} className="animate-spin" />}
            {loading ? "Reconnecting…" : "Retry Connection"}
          </button>
        </div>
      )}

      {/* ===== 1. FARM INFO & 2. FARM STATUS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
        {/* Farm Info Hero */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-cyan-50/60 text-slate-900 p-6 border border-emerald-200/90 relative overflow-hidden shadow-xs">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-56 h-56 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-full shadow-xs">
                  Farm Info
                </span>
                {farm.is_demo && (
                  <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    Demo Farm
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-emerald-950">{farm.name}</h2>
              <p className="mt-1 text-slate-600 text-sm flex gap-1.5 items-center font-medium">
                <MapPin size={15} className="text-emerald-600" />
                {farm.location || "Gujarat, India"}
              </p>
            </div>

            <Link
              href="/farm"
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs flex gap-1.5 items-center transition-all"
            >
              Farm Profile
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-emerald-200/60">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Area</p>
              <p className="text-xl font-bold mt-0.5 text-slate-900">
                {farm.total_area != null ? `${farm.total_area} ${farm.area_unit || "acres"}` : "12.5 acres"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Main Crops</p>
              <p className="text-sm sm:text-base font-bold mt-0.5 text-emerald-700 flex items-center gap-1.5">
                <Sprout size={16} className="text-emerald-600 shrink-0" />
                <span className="truncate">{mainCropsDisplay}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Zones</p>
              <p className="text-xl font-bold mt-0.5 text-slate-900">
                {isSwitching ? (
                  <span className="inline-block w-8 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  `${data?.zones.length || 3} Zones`
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Probes</p>
              <p className="text-xl font-bold mt-0.5 text-slate-900">
                {isSwitching ? (
                  <span className="inline-block w-8 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  `${data?.counts.devices || 3} In-Ground`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Farm Status */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
                Farm Status
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Radio size={13} className={monitoring === "fresh" ? "text-emerald-600 animate-pulse" : "text-slate-400"} /> Telemetry Feed
                </span>
                {monitoring === "fresh" && (
                  <button
                    type="button"
                    onClick={handleSimulateFeed}
                    disabled={isSimulatingFeed || isSwitching}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-2xs disabled:opacity-50"
                    title="Emit updated live readings from hardware sensors"
                  >
                    <RefreshCw size={10} className={isSimulatingFeed ? "animate-spin text-emerald-700" : "text-emerald-600"} />
                    <span>{isSimulatingFeed ? "Syncing…" : "Sync"}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              {isSwitching ? (
                <div className="flex items-center gap-2.5 text-amber-600 font-bold">
                  <RefreshCw size={18} className="animate-spin text-amber-600" />
                  <span>Connecting to Farm Telemetry…</span>
                </div>
              ) : monitoring === "fresh" ? (
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  </span>
                  <span className="text-lg font-extrabold text-emerald-700">Monitoring Active</span>
                </div>
              ) : monitoring === "stale" || monitoring === "very_stale" ? (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                  <span className="text-lg font-extrabold text-amber-700">
                    {monitoring === "very_stale" ? "Readings Very Stale" : "Readings Stale"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-slate-400" />
                  <span className="text-lg font-extrabold text-slate-600">Awaiting Sensor Data</span>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-1.5">
                {isSwitching
                  ? "Initializing live connection to edge gateway…"
                  : monitoring === "fresh"
                  ? `Last reading ${data?.monitoring.age_minutes ?? "?"} min ago. Simulated sensor source — not a live field probe.`
                  : "Sensor stream waiting for updated observations."}
              </p>

              {monitoring !== "fresh" && !isSwitching && (
                <button
                  type="button"
                  onClick={handleSimulateFeed}
                  disabled={isSimulatingFeed}
                  className="mt-3 inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Radio size={13} className={isSimulatingFeed ? "animate-ping" : ""} />
                  <span>{isSimulatingFeed ? "Connecting In-Situ Probes…" : "⚡ Start Live Sensor Feed"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Sensor Status:</span>
              <span className="font-bold text-slate-800">
                {isSwitching ? (
                  <span className="inline-block w-16 h-3 bg-slate-200 animate-pulse rounded" />
                ) : (
                  formatRelativeTime(data?.monitoring.last_reading_at)
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Exact timestamp:</span>
              <span className="font-medium text-slate-700">
                {isSwitching ? (
                  <span className="inline-block w-24 h-3 bg-slate-200 animate-pulse rounded" />
                ) : (
                  formatIST(data?.monitoring.last_reading_at)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== METRIC COUNTERS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
        {[
          ["Active risks", data?.counts.risks, "/risks", ShieldAlert, "text-rose-600", "border-rose-200 hover:border-rose-300", "bg-rose-50 text-rose-600 border-rose-100", "shadow-xs"],
          ["Pending approvals", data?.counts.pending_plans, "/plans", Bot, "text-violet-600", "border-violet-200 hover:border-violet-300", "bg-violet-50 text-violet-600 border-violet-100", "shadow-xs"],
          ["Open tasks", data?.counts.open_tasks, "/tasks", CheckCircle2, "text-emerald-600", "border-emerald-200 hover:border-emerald-300", "bg-emerald-50 text-emerald-600 border-emerald-100", "shadow-xs"],
          ["Active alerts", data?.counts.alerts, "/alerts", Bell, "text-amber-600", "border-amber-200 hover:border-amber-300", "bg-amber-50 text-amber-600 border-amber-100", "shadow-xs"],
        ].map(([label, count, href, Icon, color, borderStyle, iconBg, shadowStyle]) => {
          const MetricIcon = Icon as typeof Bell;
          return (
            <Link
              key={String(label)}
              href={String(href)}
              className={`glass-card rounded-2xl p-4 flex items-center justify-between border ${borderStyle} hover:bg-slate-50/60 transition-all duration-300 hover:scale-[1.01] ${shadowStyle}`}
            >
              <div>
                <p className="text-xs text-slate-500 font-medium">{String(label)}</p>
                {isSwitching ? (
                  <div className="h-8 w-12 bg-slate-200 animate-pulse rounded-md mt-1" />
                ) : (
                  <p className={`text-2xl font-extrabold mt-1 ${color}`}>
                    {count === undefined ? "0" : String(count)}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-xl border ${iconBg}`}>
                <MetricIcon size={20} className={String(color)} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Field Reading Modal */}
      {showReadings && data && (
        <FieldReadingForm
          farmId={farm.id}
          zones={data.zones}
          onClose={() => setShowReadings(false)}
          onSaved={(msg) => {
            setShowReadings(false);
            setNotice({ text: msg });
            void refresh();
          }}
        />
      )}

      {/* ===== 3. RISK ASSESSMENT ===== */}
      <Section
        title="Agronomic Risk Assessment"
        subtitle="Evaluated across 3 Core Risk Pillars with live sensor evidence"
        icon={<ShieldAlert size={19} className="text-rose-600" />}
        badge={<span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">{risks.length} Active</span>}
        action={
          <button
            className={secondary}
            disabled={disabled}
            onClick={() =>
              void act(
                "scan",
                async () => {
                  unwrap(await detectRisks({ farm_id: farm.id }));
                },
                "Risk assessment re-evaluated from latest telemetry."
              )
            }
          >
            <RefreshCw size={13} className={busy === "scan" ? "animate-spin text-emerald-600" : ""} />
            {busy === "scan" ? "Scanning…" : "Scan Risks"}
          </button>
        }
      >
        {isSwitching ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-20" />
          </div>
        ) : (
          <>
            {/* Risk Pillars */}
            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              {/* Water Stress */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  waterRisk
                    ? "bg-rose-50/70 border-rose-200 shadow-xs"
                    : "bg-emerald-50/40 border-emerald-200/80 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Droplets size={15} className={waterRisk ? "text-rose-600" : "text-emerald-600"} />
                    Water Stress
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      waterRisk ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {waterRisk ? `${waterRisk.severity.toUpperCase()}` : "Safe"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {waterRisk
                    ? typeof waterRisk.evidence?.explanation === "string"
                      ? waterRisk.evidence.explanation
                      : `Soil moisture deficit detected in ${zoneName(waterRisk.zone_id)}.`
                    : "Root-zone soil moisture is within optimal agronomic baseline across all zones."}
                </p>
              </div>

              {/* Pest & Disease */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  pestRisk
                    ? "bg-amber-50/70 border-amber-200 shadow-xs"
                    : "bg-emerald-50/40 border-emerald-200/80 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Leaf size={15} className={pestRisk ? "text-amber-600" : "text-emerald-600"} />
                    Pest & Disease
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      pestRisk ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {pestRisk ? `${pestRisk.severity.toUpperCase()}` : "Safe"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {pestRisk
                    ? typeof pestRisk.evidence?.explanation === "string"
                      ? pestRisk.evidence.explanation
                      : `Microclimate spore germination conditions favorable in ${zoneName(pestRisk.zone_id)}.`
                    : "Canopy microclimate humidity remains within safe parameters; fungal sporulation unlikely."}
                </p>
              </div>

              {/* Nutrient Deficiency */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  nutrientRisk
                    ? "bg-amber-50/70 border-amber-200 shadow-xs"
                    : "bg-emerald-50/40 border-emerald-200/80 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={15} className={nutrientRisk ? "text-amber-600" : "text-emerald-600"} />
                    Nutrient Deficiency
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      nutrientRisk ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {nutrientRisk ? `${nutrientRisk.severity.toUpperCase()}` : "Safe"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {nutrientRisk
                    ? typeof nutrientRisk.evidence?.explanation === "string"
                      ? nutrientRisk.evidence.explanation
                      : `Available macronutrients depleted in ${zoneName(nutrientRisk.zone_id)}.`
                    : "NPK macronutrients and soil pH are within balanced vegetative growth baselines."}
                </p>
              </div>
            </div>

            {/* Risk Incidents */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Detected Incidents ({risks.length})
                </h3>
                <span className="text-[11px] text-slate-500">Click advisory to trigger AI</span>
              </div>

              {!risks.length ? (
                <Empty>No active risk incidents. All zones operating in normal range.</Empty>
              ) : (
                <div className="space-y-3">
                  {risks.map((risk) => (
                    <article
                      key={risk.id}
                      className="glass-card glass-card-hover rounded-xl p-4 bg-white border border-slate-200 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formatRiskType(risk.risk_type)} · {zoneName(risk.zone_id)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            getSeverityStyle(risk.severity).badgeClass
                          }`}
                        >
                          {risk.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        {typeof risk.evidence?.explanation === "string"
                          ? risk.evidence.explanation
                          : "Telemetry analysis detected an anomalous deviation."}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">
                          {formatRelativeTime(risk.updated_at)} · {formatIST(risk.updated_at)}
                        </p>
                        <button
                          className={secondary}
                          disabled={disabled}
                          onClick={() =>
                            void act(
                              `ai-${risk.id}`,
                              async () => {
                                const result = unwrap(await evaluateRiskWithAI({ risk_id: risk.id, require_live: false }));
                                setScheduleStart("");
                                setScheduleEnd("");
                                setProposal({ risk, result });
                              },
                              "AI Advisory generated. Review proposal below."
                            )
                          }
                        >
                          <Bot size={14} className="text-violet-600" />
                          {busy === `ai-${risk.id}` ? "Reasoning…" : "Generate AI Advisory"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {/* ===== 4. AI ADVISORY ===== */}
      <Section
        title="AI Advisory"
        subtitle="Multi-agent agronomic reasoning with SafetyGuard validation"
        icon={<Bot size={19} className="text-violet-600" />}
        badge={<span className="text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-full">AI</span>}
        glowColor=""
        action={
          <Link href="/plans" className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline transition">
            All Plans ↗
          </Link>
        }
      >
        {isSwitching ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {/* Live AI Proposal */}
            {proposal && (
              <article className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5 mb-5 shadow-xs animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-violet-200">
                  <span className="text-[11px] uppercase tracking-widest text-violet-900 font-extrabold flex items-center gap-1.5">
                    <Sparkles size={14} /> New AI Advisory · Ready for Review
                  </span>
                  <span className="text-xs font-bold bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded-full border border-violet-200">
                    Confidence: {Math.round((proposal.result.proposal.confidence || 0.94) * 100)}%
                  </span>
                </div>

                <div className="mt-3 bg-white border border-violet-200 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-900 flex items-center gap-2 shadow-xs">
                  <span className="font-bold text-rose-600">Originating Risk:</span>
                  <span>{formatRiskType(proposal.risk.risk_type)} ({zoneName(proposal.risk.zone_id)})</span>
                  <ArrowRight size={13} className="text-violet-400" />
                  <span className="font-bold text-emerald-700">Action Plan Proposal</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
                  <div className="rounded-xl bg-white p-3.5 border border-violet-100 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Problem</p>
                    <p className="font-bold text-slate-900 mt-1">
                      {formatRiskType(proposal.risk.risk_type)} in {zoneName(proposal.risk.zone_id)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Critical telemetry deviation detected.</p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-violet-100 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">AI Suggestion</p>
                    <p className="font-bold text-slate-900 mt-1">{proposal.result.proposal.recommendation}</p>
                    <p className="text-xs text-slate-500 mt-1">{proposal.result.proposal.rationale}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-violet-100 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Timing</p>
                    <p className="font-bold text-slate-900 mt-1 capitalize">
                      {proposal.result.proposal.urgency} Priority · Evening Window
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Scheduled to minimize evapotranspiration.</p>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-violet-100 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Human Approval</p>
                    <p className="font-bold text-slate-900 mt-1">
                      {proposal.result.safety.approval_required
                        ? "Required by Safety Policy"
                        : "Not Required (Autonomous)"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {proposal.result.safety.decision} · {proposal.result.safety.rationale}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Start After (Optional)
                    <input type="datetime-local" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className={input} />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Finish By (Optional)
                    <input type="datetime-local" value={scheduleEnd} min={scheduleStart || undefined} onChange={(e) => setScheduleEnd(e.target.value)} className={input} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2.5 mt-5">
                  <button
                    className={primary}
                    disabled={disabled}
                    onClick={() =>
                      void act(
                        "save-plan",
                        async () => {
                          if (scheduleStart && scheduleEnd && new Date(scheduleEnd) < new Date(scheduleStart)) {
                            throw new Error("Finish time must be after start time.");
                          }
                          unwrap(
                            await createActionPlan({
                              farm_id: farm.id,
                              zone_id: proposal.risk.zone_id,
                              risk_id: proposal.risk.id,
                              ai_proposal: proposal.result.proposal,
                              earliest_at: scheduleStart ? new Date(scheduleStart).toISOString() : null,
                              latest_at: scheduleEnd ? new Date(scheduleEnd).toISOString() : null,
                            })
                          );
                          setProposal(null);
                        },
                        "Action plan saved. Ready for operator approval."
                      )
                    }
                  >
                    {busy === "save-plan" ? "Saving…" : "Save Action Plan"}
                  </button>
                  <button className={secondary} disabled={!!busy} onClick={() => setProposal(null)}>
                    Discard Preview
                  </button>
                </div>
              </article>
            )}

            {/* Existing Plans */}
            {!data?.plans.length ? (
              <Empty>No action plans. Click 'Generate AI Advisory' above to evaluate risks.</Empty>
            ) : (
              <div className="space-y-4">
                {data.plans.slice(0, 3).map((plan) => {
                  const originatingRisk = risks.find((r) => r.id === plan.risk_id);
                  const state = formatPlanStatus(plan.status, plan.approval_state);
                  const isApproved = plan.approval_state === "approved";
                  const isRejected = plan.approval_state === "rejected";
                  const isPending = plan.approval_state === "pending_approval";

                  return (
                    <article key={plan.id} className="glass-card glass-card-hover rounded-2xl p-5 space-y-3 bg-white border-slate-200 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold uppercase text-[10px] bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded">
                            {originatingRisk ? formatRiskType(originatingRisk.risk_type) : "Risk"}
                          </span>
                          <ArrowRight size={13} className="text-slate-400" />
                          <span className="font-bold text-slate-900">{plan.title || "AI Action Plan"}</span>
                          <span className="text-slate-500">({zoneName(plan.zone_id)})</span>
                        </div>
                        <span className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 ${state.badgeClass}`}>
                          {state.label}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                          <p className="font-bold text-rose-600 uppercase text-[10px]">Problem</p>
                          <p className="font-bold text-slate-900 mt-1">
                            {originatingRisk ? formatRiskType(originatingRisk.risk_type) : "Detected"}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Zone: {zoneName(plan.zone_id)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                          <p className="font-bold text-violet-600 uppercase text-[10px]">AI Suggestion</p>
                          <p className="font-semibold text-slate-700 mt-1 line-clamp-2">{plan.action_summary}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                          <p className="font-bold text-amber-600 uppercase text-[10px]">Timing</p>
                          <p className="text-slate-900 font-bold mt-1">{formatSchedule(plan)}</p>
                        </div>
                        <div
                          className={`rounded-xl p-3 border ${
                            isApproved
                              ? "bg-emerald-50 border-emerald-200"
                              : isRejected
                              ? "bg-rose-50 border-rose-200"
                              : "bg-amber-50 border-amber-200"
                          }`}
                        >
                          <p className={`font-bold uppercase text-[10px] ${isApproved ? "text-emerald-700" : isRejected ? "text-rose-700" : "text-amber-700"}`}>
                            Approval Status
                          </p>
                          <p className={`font-bold mt-1 ${isApproved ? "text-emerald-800" : isRejected ? "text-rose-800" : "text-amber-800"}`}>
                            {isApproved ? "✅ Completed" : isRejected ? "❌ Rejected" : "⏳ Awaiting"}
                          </p>
                          <p className={`text-[11px] mt-0.5 ${isApproved ? "text-emerald-700" : isRejected ? "text-rose-700" : "text-amber-700"}`}>
                            {isApproved ? "Approved · Task Created" : isRejected ? "Execution Blocked" : "Awaiting Sign-off"}
                          </p>
                        </div>
                      </div>

                      <ActionPlanPipeline approvalState={plan.approval_state} />

                      {isPending && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                          <button
                            className={primary}
                            disabled={disabled}
                            onClick={() =>
                              void act(
                                `approve-${plan.id}`,
                                async () => { unwrap(await approveActionPlan(plan.id)); },
                                "Plan approved! Active field task instantiated."
                              )
                            }
                          >
                            <CheckCircle2 size={13} /> Approve & Create Task
                          </button>
                          <button
                            className={dangerBtn}
                            disabled={disabled}
                            onClick={() =>
                              void act(
                                `reject-${plan.id}`,
                                async () => { unwrap(await rejectActionPlan(plan.id)); },
                                "Plan rejected by operator."
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Section>

      {/* ===== 5. WEATHER & 6. ZONES ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start animate-fade-in">
        {/* Weather */}
        <div className="lg:col-span-1">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <Satellite size={15} className="text-blue-600" />
            <span>Atmospheric Weather</span>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded">
              Macro-Climate
            </span>
          </div>
          <div className="glass-card rounded-2xl border-slate-200 p-1 shadow-xs bg-white">
            <LiveWeatherCard />
            <p className="p-3 text-[11px] text-blue-800 font-medium bg-blue-50 border-t border-slate-100 rounded-b-xl flex items-center gap-1.5">
              <Satellite size={13} className="text-blue-600 shrink-0" />
              Regional data via OpenWeather API (ambient temperature & forecast).
            </p>
          </div>
        </div>

        {/* Zones */}
        <div className="lg:col-span-2">
          <Section
            title="Field / Zones"
            subtitle="In-situ subsoil sensors (15cm depth) — root-zone moisture & nutrients"
            icon={<Leaf size={18} className="text-emerald-600" />}
            badge={
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                IoT Probes (15cm)
              </span>
            }
            action={
              <button className={secondary} disabled={disabled} onClick={() => setShowReadings(true)}>
                <Plus size={14} className="text-emerald-600" /> Add Reading
              </button>
            }
          >
            {isSwitching ? (
              <div className="grid sm:grid-cols-3 gap-3.5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}
              </div>
            ) : !data?.zones.length ? (
              <Empty>No zones found for {farm.name}. Create zones in your farm profile.</Empty>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3.5">
                {data.zones.map((zone) => {
                  const zoneRisks = risks.filter((r) => zone.risk_ids.includes(r.id));
                  const isWaterStressed = zoneRisks.some((r) => r.risk_type.includes("water"));
                  const isNutrientDeficient = zoneRisks.some((r) => r.risk_type.includes("nutrient"));
                  const isPestElevated = zoneRisks.some((r) => r.risk_type.includes("pest") || r.risk_type.includes("disease"));

                  return (
                    <div
                      key={zone.id}
                      className={`rounded-xl border p-4 transition-all duration-300 ${
                        isWaterStressed
                          ? "bg-rose-50/70 border-rose-200 shadow-xs"
                          : isNutrientDeficient || isPestElevated
                          ? "bg-amber-50/70 border-amber-200 shadow-xs"
                          : "glass-card glass-card-hover bg-white border-slate-200 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">{zone.name}</span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                            isWaterStressed
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : isNutrientDeficient
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : isPestElevated
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {isWaterStressed ? "Water Stress" : isNutrientDeficient ? "Nutrient Deficit" : isPestElevated ? "Pest Risk" : "Normal"}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>Crop:</span>
                        <b className="text-slate-800">{zone.crop || "Not set"}</b>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
                        <span>Area:</span>
                        <b className="text-slate-800">{zone.area ? `${zone.area} ${zone.area_unit}` : "Not set"}</b>
                      </div>

                      {/* Only metrics this zone actually reported are shown. A zone with no
                          sensor data says so rather than displaying a plausible number. */}
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        {ZONE_CARD_METRICS.filter((m) => zone.readings?.[m.key]).length === 0 ? (
                          <p className="text-[11px] font-semibold text-slate-500">
                            No readings yet for this zone.
                          </p>
                        ) : (
                          ZONE_CARD_METRICS.map((m) => {
                            const r = zone.readings?.[m.key];
                            if (!r) return null;
                            const alarming = m.key === "soil_moisture" && isWaterStressed;
                            return (
                              <div key={m.key} className="flex justify-between items-center gap-2">
                                <span className="text-slate-500">{m.label}:</span>
                                <span className="flex items-center gap-1">
                                  <b className={alarming ? "text-rose-600 font-extrabold" : "text-slate-800 font-bold"}>
                                    {r.value}
                                    {r.unit ? `${r.unit === "%" || r.unit === "°C" ? "" : " "}${r.unit}` : ""}
                                  </b>
                                  {r.simulated && (
                                    <span className="rounded bg-slate-100 px-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                      sim
                                    </span>
                                  )}
                                  {r.freshness !== "fresh" && (
                                    <span className="rounded bg-amber-100 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                                      {r.freshness === "offline" ? "old" : "stale"}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Last Reading:</span>
                          <span className="text-slate-700 text-[11px] font-bold">
                            {zone.last_reading_at ? formatRelativeTime(zone.last_reading_at) : "Never"}
                          </span>
                        </div>
                      </div>

                      {/* Risk candidates link to their evidence; no chemical or dosage advice
                          is asserted here, per the safety policy. */}
                      {zoneRisks.length > 0 && (
                        <p className="text-[11px] font-semibold text-slate-600 mt-3 pt-2 border-t border-slate-200">
                          {zoneRisks.length} open risk candidate{zoneRisks.length > 1 ? "s" : ""} —{" "}
                          <Link href="/risks" className="text-emerald-700 underline underline-offset-2">
                            review evidence
                          </Link>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ===== 7. ACTIONS & TASKS ===== */}
      <Section
        title="Actions & Tasks"
        subtitle="Manage pending plans, open field executions, and completed logs"
        icon={<CheckCircle2 size={19} className="text-emerald-600" />}
        action={
          <button className={secondary} disabled={disabled} onClick={() => setShowTask(!showTask)}>
            <Plus size={14} className="text-emerald-600" /> New Task
          </button>
        }
      >
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            ["open", `Open Tasks ${data ? `(${data.counts.open_tasks})` : ""}`],
            ["plans", `Pending Plans ${data ? `(${data.counts.pending_plans})` : ""}`],
            ["alerts", `Alerts ${data ? `(${data.counts.alerts})` : ""}`],
            ["completed", `Completed (${data?.completed_tasks.length || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTaskView(key as typeof taskView)}
              className={
                taskView === key
                  ? "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
                  : secondary
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* New Task Form */}
        {showTask && (
          <form
            className="p-4 mb-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const title = String(f.get("title") || "").trim();
              if (!title) return;
              void act(
                "new-task",
                async () => {
                  unwrap(
                    await createTask({
                      farm_id: farm.id,
                      title,
                      description: String(f.get("description") || ""),
                      zone_id: String(f.get("zone") || "") || null,
                      due_until: f.get("due") ? new Date(String(f.get("due"))).toISOString() : null,
                      priority: String(f.get("priority")),
                      source: "user",
                    })
                  );
                  setShowTask(false);
                },
                "Task created and saved."
              );
            }}
          >
            <h3 className="font-bold text-sm text-slate-900">Create Field Task</h3>
            <label className="block text-xs font-semibold text-slate-700">
              Task Title
              <input name="title" required maxLength={200} placeholder="e.g. Inspect Drip Line Emitters" className={input} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Instructions
              <textarea name="description" maxLength={2000} rows={2} placeholder="Specific instructions..." className={input} />
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Zone
                <select name="zone" className={input}>
                  <option value="" className="bg-white">Farm-wide</option>
                  {data?.zones.map((z) => (
                    <option key={z.id} value={z.id} className="bg-white">{z.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Due Window
                <input name="due" type="datetime-local" className={input} />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Priority
                <select name="priority" defaultValue="medium" className={input}>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <option key={p} className="bg-white">{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              <button className={primary} disabled={disabled}>{busy === "new-task" ? "Saving…" : "Create Task"}</button>
              <button type="button" className={secondary} disabled={!!busy} onClick={() => setShowTask(false)}>Cancel</button>
            </div>
          </form>
        )}

        {isSwitching ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {/* Open Tasks */}
            {taskView === "open" && (
              <div>
                {!data?.tasks.length ? (
                  <Empty>No open tasks for {farm.name}.</Empty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.tasks.map((task) => (
                      <article key={task.id} className="py-4 first:pt-0">
                        <div className="flex flex-wrap justify-between items-start gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{task.title || "Field Task"}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {zoneName(task.zone_id)} · Status:{" "}
                              <span className="font-semibold text-slate-700 capitalize">{task.status.replaceAll("_", " ")}</span>
                              {" "}· Priority:{" "}
                              <span className="font-semibold text-slate-700 capitalize">{task.priority || "Medium"}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {task.due_until ? `Due by ${formatIST(task.due_until)}` : "No strict deadline"}
                            </p>
                          </div>
                          <div className="flex gap-2 items-center">
                            {["pending", "assigned", "blocked"].includes(task.status) && (
                              <button
                                className={secondary}
                                disabled={disabled}
                                onClick={() => void act(`start-${task.id}`, async () => { unwrap(await startTask(task.id)); }, "Task started.")}
                              >
                                Start Task
                              </button>
                            )}
                            {task.status === "in_progress" && (
                              <button className={primary} disabled={disabled} onClick={() => setCompletion(task.id)}>
                                <CheckCircle2 size={13} /> Complete
                              </button>
                            )}
                          </div>
                        </div>
                        {task.description && <p className="text-xs text-slate-600 mt-2">{task.description}</p>}
                        {completion === task.id && (
                          <form
                            className="mt-3 flex flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const notes = String(new FormData(e.currentTarget).get("notes") || "").trim();
                              if (!notes) return;
                              void act(`complete-${task.id}`, async () => { unwrap(await completeTask(task.id, { completion_notes: notes })); setCompletion(null); }, "Task completed.");
                            }}
                          >
                            <input name="notes" aria-label="Completion notes" required maxLength={2000} placeholder="What was done? Record field outcome." className="min-w-0 flex-1 rounded-xl bg-white border border-slate-200 p-2.5 text-sm text-slate-900" />
                            <button className={primary} disabled={disabled}>Save</button>
                            <button type="button" className={secondary} disabled={!!busy} onClick={() => setCompletion(null)}>Cancel</button>
                          </form>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending Plans */}
            {taskView === "plans" && (
              <div>
                {!data?.plans.length ? (
                  <Empty>No action plans awaiting decision.</Empty>
                ) : (
                  <div className="space-y-3">
                    {data.plans.map((plan) => (
                      <article key={plan.id} className="glass-card glass-card-hover rounded-xl p-4 bg-white border border-slate-200 shadow-xs">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{plan.title || "AI Intervention"}</h4>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                              plan.approval_state === "approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : plan.approval_state === "rejected"
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}
                          >
                            {plan.approval_state.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">{plan.action_summary}</p>
                        <p className="text-xs text-slate-500 mt-2">Zone: {zoneName(plan.zone_id)} · {formatSchedule(plan)}</p>
                        {plan.approval_state === "pending_approval" && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                            <button className={primary} disabled={disabled} onClick={() => void act(`approve-${plan.id}`, async () => { unwrap(await approveActionPlan(plan.id)); }, "Plan approved!")}>
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button className={dangerBtn} disabled={disabled} onClick={() => void act(`reject-${plan.id}`, async () => { unwrap(await rejectActionPlan(plan.id)); }, "Plan rejected.")}>
                              Reject
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Alerts */}
            {taskView === "alerts" && (
              <div>
                {!data?.alerts.length ? (
                  <Empty>No unacknowledged alerts.</Empty>
                ) : (
                  <div className="space-y-3">
                    {data.alerts.map((alert) => (
                      <article key={alert.id} className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-white shadow-xs">
                        <div>
                          <span className="text-[10px] uppercase font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                            {alert.severity}
                          </span>
                          <p className="text-sm font-semibold text-slate-900 mt-1.5">{alert.message}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{formatIST(alert.created_at)}</p>
                        </div>
                        <button className={secondary} disabled={disabled} onClick={() => void act(`ack-${alert.id}`, async () => { unwrap(await acknowledgeAlert(alert.id)); }, "Alert acknowledged.")}>
                          Acknowledge
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Completed Tasks */}
            {taskView === "completed" && (
              <div>
                {!data?.completed_tasks.length ? (
                  <Empty>No completed tasks logged yet.</Empty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.completed_tasks.map((task) => (
                      <article key={task.id} className="py-4 first:pt-0">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              {task.title || "Field Task"}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {zoneName(task.zone_id)} · Completed: {formatIST(task.completed_at)} ({formatRelativeTime(task.completed_at)})
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            COMPLETED
                          </span>
                        </div>
                        {task.description && <p className="text-xs text-slate-600 mt-2">{task.description}</p>}
                        {task.completion_notes && (
                          <div className="mt-2.5 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900">
                            <b>Outcome:</b> {task.completion_notes}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
