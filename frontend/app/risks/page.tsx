"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeading } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  getRisks,
  detectRisks,
  evaluateRiskWithAI,
  createActionPlan,
  approveActionPlan,
  createTask as apiCreateTask,
  createTelemetryEvent,
  getTelemetryEvents,
} from "../../lib/api/farmops";
import {
  formatRiskType,
  getSeverityStyle,
  formatConfidence,
  formatRiskStatus,
} from "../../lib/risks";
import {
  formatAgentName,
  getSafetyDecisionStyle,
  formatUrgencyStyle,
  formatAIErrorMessage,
} from "../../lib/ai";
import type {
  RiskAssessment,
  AIEvaluationResponse,
  SensorEventResponse,
  Farm as BackendFarm,
} from "../../types/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Droplets,
  Edit2,
  Eye,
  Filter,
  Layers,
  Leaf,
  ListChecks,
  Loader2,
  MapPin,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Trash2,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";

/* ===== DESIGN TOKENS ===== */
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all duration-200 cursor-pointer";
const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 transition-all duration-200 cursor-pointer";
const inputStyle =
  "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all";

/* Configurable Freshness Thresholds */
const FRESH_THRESHOLD_MINUTES = 5.0;
const STALE_THRESHOLD_MINUTES = 15.0;

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
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function calculateFreshness(timestamp?: string | null): "LIVE" | "STALE" | "OFFLINE" {
  if (!timestamp) return "OFFLINE";
  try {
    const ts = new Date(timestamp).getTime();
    if (!Number.isFinite(ts)) return "OFFLINE";
    const diffMin = (Date.now() - ts) / 60000.0;
    if (diffMin <= FRESH_THRESHOLD_MINUTES) return "LIVE";
    if (diffMin <= STALE_THRESHOLD_MINUTES) return "STALE";
    return "OFFLINE";
  } catch {
    return "OFFLINE";
  }
}

export default function RiskCenterPage() {
  const {
    backendFarms,
    selectedFarm,
    selectedFarmId,
    selectFarm,
    backendZones,
    devices,
    telemetryEvents,
    refreshTelemetry,
    refreshBackendState,
    triggerLiveTelemetry,
  } = useFarm();

  // Active farm state
  const currentFarm = selectedFarm || (backendFarms.length > 0 ? backendFarms[0] : null);
  const currentFarmId = selectedFarmId || currentFarm?.id || null;

  // Real backend risk state
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [isLoadingRisks, setIsLoadingRisks] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [risksError, setRisksError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Real AI evaluation state keyed by risk_id
  const [aiEvaluations, setAiEvaluations] = useState<
    Record<string, { loading: boolean; error: string | null; data: AIEvaluationResponse | null }>
  >({});
  const [evaluatingRiskId, setEvaluatingRiskId] = useState<string | null>(null);

  // Action plan creation tracking
  const [creatingPlanRiskId, setCreatingPlanRiskId] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState<Record<string, string>>({});

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [zoneFilter, setZoneFilter] = useState<string>("all");

  // Field Reading Ingestion Modal
  const [showManualReadingModal, setShowManualReadingModal] = useState<boolean>(false);
  const [selectedZoneForReading, setSelectedZoneForReading] = useState<string>("");
  const [manualMoisture, setManualMoisture] = useState<string>("21.5");
  const [manualTemp, setManualTemp] = useState<string>("33.0");
  const [manualHumidity, setManualHumidity] = useState<string>("32.0");
  const [manualPh, setManualPh] = useState<string>("6.4");
  const [isSubmittingReading, setIsSubmittingReading] = useState<boolean>(false);

  // Sequence ref to prevent race conditions when switching farms
  const activeRiskRequestIdRef = useRef<string | null>(null);

  // Load risks strictly scoped to the selected farm
  const loadRisks = useCallback(async (farmId: string) => {
    activeRiskRequestIdRef.current = farmId;
    setIsLoadingRisks(true);
    setRisksError(null);
    try {
      const res = await getRisks(farmId);
      if (activeRiskRequestIdRef.current !== farmId) return;

      if (res.data && Array.isArray(res.data)) {
        // Enforce strict farm scoping: never display a risk belonging to another farm
        const farmScoped = res.data.filter((r) => r.farm_id === farmId);
        setRisks(farmScoped);
      } else {
        setRisks([]);
      }
    } catch (err: unknown) {
      if (activeRiskRequestIdRef.current !== farmId) return;
      console.warn("Failed to load risks for farm:", err);
      const msg = err instanceof Error ? err.message : "Failed to load farm risks.";
      setRisksError(msg);
      setRisks([]);
    } finally {
      if (activeRiskRequestIdRef.current === farmId) {
        setIsLoadingRisks(false);
      }
    }
  }, []);

  // When selected farm changes: immediately clear previous data and fetch for active farm
  useEffect(() => {
    if (currentFarmId) {
      setRisks([]);
      setAiEvaluations({});
      setPlanSuccessNotice({});
      setRisksError(null);
      void loadRisks(currentFarmId);
    } else {
      setRisks([]);
      setAiEvaluations({});
      setPlanSuccessNotice({});
      setIsLoadingRisks(false);
      setRisksError(null);
    }
  }, [currentFarmId, loadRisks]);

  // Zone Telemetry Verification Matrix
  const zoneTelemetryHealth = useMemo(() => {
    if (!backendZones || backendZones.length === 0) return [];

    return backendZones.map((z) => {
      const zEvents = telemetryEvents.filter((e) => e.zone_id === z.id);
      const latestEvent = zEvents[0] || null;
      const zDevices = devices.filter((d) => d.zone_id === z.id);
      const isConnected = zDevices.some((d) => d.enabled) || zEvents.length > 0;
      const latestTimestamp = latestEvent?.event_at || (zDevices[0]?.last_seen_at) || null;
      const freshness = calculateFreshness(latestTimestamp);

      const measurements = latestEvent?.measurements || {};
      const moisture = (measurements.soil_moisture as number) ?? (latestEvent?.value && latestEvent.metric === "soil_moisture" ? latestEvent.value : null);
      const temp = (measurements.soil_temp as number) ?? (measurements.temperature as number) ?? (measurements.air_temp as number) ?? null;
      const humidity = (measurements.humidity as number) ?? (measurements.air_humidity as number) ?? null;
      const ph = (measurements.ph as number) ?? (measurements.soil_ph as number) ?? null;

      return {
        zoneId: z.id,
        zoneName: z.name,
        crop: z.crop || "Not set",
        area: z.area ?? null,
        areaUnit: z.area_unit || "ha",
        isConnected,
        deviceCount: zDevices.length,
        latestTimestamp,
        freshness,
        moisture,
        temp,
        humidity,
        ph,
      };
    });
  }, [backendZones, telemetryEvents, devices]);

  // Check if live telemetry is available for the farm
  const hasLiveOrStaleTelemetry = useMemo(() => {
    return zoneTelemetryHealth.some((z) => z.freshness === "LIVE" || z.freshness === "STALE");
  }, [zoneTelemetryHealth]);

  // Trigger deterministic risk detection on live telemetry
  const handleRunDetection = async () => {
    if (!currentFarmId || isDetecting) return;
    setIsDetecting(true);
    setNotification(null);
    try {
      const res = await detectRisks({ farm_id: currentFarmId });
      const detectedCount = res.data?.length ?? 0;
      setNotification({
        type: "success",
        message: `Deterministic risk detection complete. ${detectedCount} active risk${detectedCount === 1 ? "" : "s"} evaluated from live sensor data.`,
      });
      await loadRisks(currentFarmId);
      await refreshBackendState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Risk detection failed.";
      setNotification({
        type: "error",
        message: msg,
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Trigger AI evaluation on a specific detected risk
  const handleEvaluateRiskWithAI = async (risk: RiskAssessment) => {
    if (!currentFarmId) return;
    setEvaluatingRiskId(risk.id);
    setAiEvaluations((prev) => ({
      ...prev,
      [risk.id]: { loading: true, error: null, data: prev[risk.id]?.data || null },
    }));

    try {
      const res = await evaluateRiskWithAI({ risk_id: risk.id, require_live: false });
      if (res.data) {
        setAiEvaluations((prev) => ({
          ...prev,
          [risk.id]: { loading: false, error: null, data: res.data },
        }));
      } else {
        throw new Error(res.message || "No evaluation response received from AI service.");
      }
    } catch (err: unknown) {
      const errMsg = formatAIErrorMessage(err);
      setAiEvaluations((prev) => ({
        ...prev,
        [risk.id]: { loading: false, error: errMsg, data: null },
      }));
    } finally {
      setEvaluatingRiskId(null);
    }
  };

  // Create & Approve Action Plan from AI proposal
  const handleCreatePlanFromAI = async (risk: RiskAssessment, aiData: AIEvaluationResponse) => {
    if (!currentFarmId || creatingPlanRiskId) return;
    setCreatingPlanRiskId(risk.id);
    try {
      const { proposal } = aiData;
      const title = `Zone ${risk.zone_id ? risk.zone_id.slice(0, 8) : "Farm"}: ${proposal.recommendation.slice(0, 60)}...`;

      const planRes = await createActionPlan({
        farm_id: currentFarmId,
        zone_id: risk.zone_id || undefined,
        risk_id: risk.id,
        title,
        action_type: proposal.risk_type === "water_stress" ? "irrigation_adjustment" : "treatment_application",
        action_summary: proposal.recommendation,
        rationale: proposal.rationale,
        priority: proposal.urgency === "critical" ? "urgent" : proposal.urgency === "high" ? "high" : "medium",
        ai_proposal: proposal,
        evidence: {
          urgency: proposal.urgency,
          assumptions: proposal.assumptions,
        },
      });

      if (planRes.success && planRes.data) {
        if (planRes.data.approval_state === "pending_approval") {
          await approveActionPlan(planRes.data.id, { review_notes: "Approved via Risk Center" });
        }
        setPlanSuccessNotice((prev) => ({ ...prev, [risk.id]: planRes.data!.id }));
        setNotification({
          type: "success",
          message: `Action plan created and approved for ${formatRiskType(risk.risk_type)}!`,
        });
        await refreshBackendState();
      } else {
        setNotification({
          type: "error",
          message: planRes.message || "Action plan creation failed.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating action plan.";
      setNotification({ type: "error", message: msg });
    } finally {
      setCreatingPlanRiskId(null);
    }
  };

  // Submit manual field telemetry reading
  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFarmId || !selectedZoneForReading) return;
    setIsSubmittingReading(true);
    setNotification(null);

    // Only submit what the farmer actually measured. A blank field must stay
    // absent rather than being filled with a plausible default, which would
    // record a measurement nobody took and then drive risk detection from it.
    const measurements: Record<string, number> = {};
    const entered: [string, string][] = [
      ["soil_moisture", manualMoisture],
      ["temperature", manualTemp],
      ["humidity", manualHumidity],
      ["ph", manualPh],
    ];
    for (const [key, raw] of entered) {
      const parsed = parseFloat(raw);
      if (raw.trim() !== "" && Number.isFinite(parsed)) measurements[key] = parsed;
    }

    if (Object.keys(measurements).length === 0) {
      setNotification({
        type: "error",
        message: "Enter at least one measured value before recording a reading.",
      });
      setIsSubmittingReading(false);
      return;
    }

    try {
      await createTelemetryEvent({
        device_id: `DEV-MANUAL-${selectedZoneForReading.slice(0, 6)}`,
        sequence: Math.floor(Date.now() / 1000) % 1000000,
        event_timestamp: new Date().toISOString(),
        measurements,
        metadata: {
          farm_id: currentFarmId,
          zone_id: selectedZoneForReading,
          source: "manual_entry",
        },
      });

      setNotification({
        type: "success",
        message: `Recorded ${Object.keys(measurements).length} manual reading(s) for the selected zone.`,
      });
      setShowManualReadingModal(false);
      await refreshTelemetry();
      // Auto trigger risk re-evaluation on fresh telemetry
      await detectRisks({ farm_id: currentFarmId });
      await loadRisks(currentFarmId);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to submit telemetry reading.",
      });
    } finally {
      setIsSubmittingReading(false);
    }
  };

  // Filtered risks
  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (severityFilter !== "all" && r.severity.toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }
      if (typeFilter !== "all" && r.risk_type.toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (zoneFilter !== "all" && r.zone_id !== zoneFilter) {
        return false;
      }
      return true;
    });
  }, [risks, severityFilter, typeFilter, statusFilter, zoneFilter]);

  // Statistics
  const criticalAndHighCount = useMemo(() => {
    return risks.filter((r) => r.severity === "critical" || r.severity === "high").length;
  }, [risks]);
  const warningCount = useMemo(() => {
    return risks.filter((r) => r.severity === "low").length;
  }, [risks]);
  const resolvedCount = useMemo(() => {
    return risks.filter((r) => r.status === "resolved").length;
  }, [risks]);

  return (
    <AppShell title="Agronomic Risk Center">
      <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Header & Farm Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <PageHeading
            title="Agronomic Risk Center"
            description="Real-time, backend-driven risk detection engine verifying live sensor streams, calculating agronomic stress, and orchestrating AI action plans."
          />

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real Farm Dropdown Selector */}
            {backendFarms.length > 0 && (
              <div className="relative">
                <select
                  value={currentFarmId || ""}
                  onChange={(e) => {
                    const fid = e.target.value;
                    if (fid) selectFarm(fid);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs focus:border-emerald-500 outline-none cursor-pointer pr-8"
                >
                  {backendFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.location || "Farm"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={!currentFarmId || isDetecting}
              onClick={handleRunDetection}
              className={btnPrimary}
              id="btn-run-risk-detection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isDetecting ? "animate-spin" : ""}`} />
              <span>{isDetecting ? "Evaluating Sensors..." : "Run Risk Detection"}</span>
            </button>
          </div>
        </div>

        {/* Notifications & Error Banners */}
        {notification && (
          <div
            className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
              notification.type === "success"
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                : notification.type === "error"
                ? "border-rose-200 bg-rose-50/90 text-rose-800"
                : "border-blue-200 bg-blue-50/90 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {risksError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{risksError}</span>
            </div>
            <button onClick={() => setRisksError(null)} className="text-rose-600 hover:text-rose-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REQUIREMENT 2: IF FARMER HAS NO FARM                                      */}
        {/* ========================================================================= */}
        {!currentFarm && backendFarms.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs space-y-4 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No Farm Available</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Create a farm first to start risk monitoring. Risk detection operates strictly on verified farm boundaries and connected sensor nodes.
            </p>
            <Link href="/onboarding" className={btnPrimary}>
              <Plus className="h-4 w-4" />
              <span>Create Farm</span>
            </Link>
          </div>
        )}

        {currentFarm && (
          <>
            {/* ========================================================================= */}
            {/* REQUIREMENT 3 & 4: LIVE SENSOR DATA & FRESHNESS VALIDATION                */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Sensor Telemetry Validation (Pre-Detection Check)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {zoneTelemetryHealth.length} Zone Nodes
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (backendZones.length > 0) {
                        setSelectedZoneForReading(backendZones[0].id);
                      }
                      setShowManualReadingModal(true);
                    }}
                    className={btnSecondary}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Ingest Field Telemetry</span>
                  </button>
                </div>
              </div>

              {/* Zone Telemetry Freshness Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {zoneTelemetryHealth.map((zt) => {
                  const isLive = zt.freshness === "LIVE";
                  const isStale = zt.freshness === "STALE";

                  return (
                    <div
                      key={zt.zoneId}
                      className={`p-4 rounded-2xl border transition-all ${
                        isLive
                          ? "bg-emerald-50/40 border-emerald-200"
                          : isStale
                          ? "bg-amber-50/40 border-amber-200"
                          : "bg-slate-50/70 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {zt.zoneName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isLive
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : isStale
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-slate-200 text-slate-700 border-slate-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isLive
                                ? "bg-emerald-600 animate-pulse"
                                : isStale
                                ? "bg-amber-600"
                                : "bg-slate-500"
                            }`}
                          />
                          {zt.freshness}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-1 mb-3">
                        <div className="flex justify-between">
                          <span>Crop:</span>
                          <strong className="text-slate-800">{zt.crop} ({zt.area} {zt.areaUnit})</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Reading:</span>
                          <strong className="text-slate-700">{formatRelativeTime(zt.latestTimestamp)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Sensor Node:</span>
                          <span className={zt.isConnected ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                            {zt.isConnected ? "Connected" : "Disconnected"}
                          </span>
                        </div>
                      </div>

                      {/* Live Measurements Preview */}
                      {zt.freshness !== "OFFLINE" && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-[10px]">
                          <div className="p-1.5 rounded-lg bg-white border border-slate-100 text-center">
                            <span className="text-slate-400 block">Soil Moisture</span>
                            <span className="font-bold text-blue-700 text-xs">
                              {zt.moisture !== null ? `${zt.moisture.toFixed(1)}%` : "N/A"}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-white border border-slate-100 text-center">
                            <span className="text-slate-400 block">Temperature</span>
                            <span className="font-bold text-slate-800 text-xs">
                              {zt.temp !== null ? `${zt.temp.toFixed(1)}°C` : "N/A"}
                            </span>
                          </div>
                        </div>
                      )}

                      {zt.freshness === "OFFLINE" && (
                        <div className="p-2 rounded-xl bg-white border border-dashed border-slate-200 text-center space-y-1 mt-2">
                          <span className="text-[10px] text-slate-500 block">Live Sensor Unavailable</span>
                          <button
                            onClick={() => {
                              setSelectedZoneForReading(zt.zoneId);
                              setShowManualReadingModal(true);
                            }}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            + Record Reading
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Offline Telemetry Warning Banner if ALL zones are offline */}
            {!hasLiveOrStaleTelemetry && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">Live Sensor Data Unavailable</h4>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Risk detection cannot be performed until fresh telemetry is received. Missing telemetry does not generate synthetic risks.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (backendZones.length > 0) setSelectedZoneForReading(backendZones[0].id);
                      setShowManualReadingModal(true);
                    }}
                    className={btnPrimary}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Ingest Telemetry</span>
                  </button>
                  <button onClick={handleRunDetection} disabled={isDetecting} className={btnSecondary}>
                    <RefreshCw className={`h-3.5 w-3.5 ${isDetecting ? "animate-spin" : ""}`} />
                    <span>Retry Check</span>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATS OVERVIEW CARDS                                                      */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Active Risks
                </span>
                <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                  {risks.filter((r) => r.status !== "resolved").length}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Assessed from live telemetry
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider">
                  Critical / High
                </span>
                <span className="text-2xl font-extrabold text-rose-700 mt-1 block">
                  {criticalAndHighCount}
                </span>
                <span className="text-[11px] text-rose-600/80 mt-0.5 block">
                  Requires urgent intervention
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
                  Attention Required
                </span>
                <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
                  {warningCount}
                </span>
                <span className="text-[11px] text-amber-600/80 mt-0.5 block">
                  Moderate deviations
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
                  Resolved Risks
                </span>
                <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
                  {resolvedCount}
                </span>
                <span className="text-[11px] text-emerald-600/80 mt-0.5 block">
                  Telemetry normalized
                </span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* REQUIREMENT 5 & 6: DYNAMIC RISK LIST & EVIDENCE MATRIX                    */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Active Detected Risks ({filteredRisks.length})
                  </h3>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Zone Filter */}
                  <select
                    value={zoneFilter}
                    onChange={(e) => setZoneFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Zones</option>
                    {backendZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>

                  {/* Severity Filter */}
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  {/* Risk Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Risk Types</option>
                    <option value="water_stress">Water Stress</option>
                    <option value="pest_disease">Pest & Disease</option>
                    <option value="nutrient_deficiency">Nutrient Deficiency</option>
                    <option value="weather_environmental">Weather & Environmental</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {isLoadingRisks ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold">Loading farm risk assessments...</p>
                </div>
              ) : filteredRisks.length === 0 ? (
                <div className="py-12 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2.5">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900">
                    No Active Risks Detected
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    All current sensor telemetry streams for {currentFarm.name} are within safe agronomic parameters.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRisks.map((risk) => {
                    const sev = getSeverityStyle(risk.severity);
                    const aiState = aiEvaluations[risk.id];
                    const isEvaluating = evaluatingRiskId === risk.id;
                    const zoneObj = backendZones.find((z) => z.id === risk.zone_id);
                    const zoneName = zoneObj?.name || (risk.zone_id ? `Zone ${risk.zone_id.slice(0, 8)}` : "Whole Farm");
                    const evidence = (risk.evidence || {}) as { explanation?: string; signals?: unknown[]; rules_triggered?: string[] };
                    const signals = Array.isArray(evidence.signals) ? evidence.signals : [];
                    const rules = Array.isArray(evidence.rules_triggered) ? evidence.rules_triggered : [];

                    return (
                      <div
                        key={risk.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5 hover:bg-white hover:border-slate-300 transition-all space-y-4 shadow-xs"
                      >
                        {/* Risk Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${sev.badge}`}>
                                <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
                                {risk.severity.toUpperCase()}
                              </span>
                              <h4 className="text-sm font-extrabold text-slate-900">
                                {formatRiskType(risk.risk_type)}
                              </h4>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/70 text-slate-700 text-[11px] font-semibold">
                                <Layers className="h-3 w-3 text-slate-500" />
                                {zoneName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Score: {(risk.score * 100).toFixed(0)} / 100
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed pt-1">
                              {typeof evidence.explanation === "string" && evidence.explanation
                                ? evidence.explanation
                                : `Telemetry sensors detected agronomic deviation in ${zoneName}.`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleEvaluateRiskWithAI(risk)}
                              disabled={isEvaluating}
                              className={btnPrimary}
                            >
                              {isEvaluating ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Reasoning...</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="h-3.5 w-3.5" />
                                  <span>Evaluate with AI</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Agronomic Evidence Signals */}
                        {signals.length > 0 && (
                          <div className="rounded-xl bg-white border border-slate-200/80 p-3.5 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Verified Telemetry Evidence & Signals
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {(signals as Array<{ name?: string; value?: number | string; unit?: string; threshold?: number | string }>).map((sig, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                                  <span className="text-slate-500 text-[11px] block capitalize">
                                    {sig.name ? String(sig.name).replace(/_/g, " ") : "Signal"}
                                  </span>
                                  <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="font-extrabold text-slate-900 text-sm">
                                      {String(sig.value ?? "")} {String(sig.unit ?? "")}
                                    </span>
                                    {sig.threshold !== undefined && (
                                      <span className="text-[10px] text-rose-600 font-semibold">
                                        (Threshold: {String(sig.threshold)} {String(sig.unit ?? "")})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI Evaluation Drawer if available */}
                        {aiState?.data && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-emerald-600" />
                                <span className="text-xs font-bold text-slate-900">
                                  AI Agronomist Recommendation ({aiState.data.proposal.agent_type})
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                  Safety Decision: {aiState.data.safety.decision.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                              {aiState.data.proposal.recommendation}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                              <div>
                                <span>Urgency: </span>
                                <strong className="text-slate-900 capitalize">{aiState.data.proposal.urgency}</strong>
                              </div>
                              <div>
                                <span>Confidence: </span>
                                <strong className="text-emerald-700">
                                  {Math.round(aiState.data.proposal.confidence * 100)}%
                                </strong>
                              </div>
                              <div>
                                <span>Human Approval: </span>
                                <strong className="text-slate-900">
                                  {aiState.data.safety.approval_required ? "Required" : "Automated"}
                                </strong>
                              </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-emerald-100">
                              <button
                                onClick={() => handleCreatePlanFromAI(risk, aiState.data!)}
                                disabled={creatingPlanRiskId === risk.id || Boolean(planSuccessNotice[risk.id])}
                                className={btnPrimary}
                              >
                                {creatingPlanRiskId === risk.id ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Generating Plan...</span>
                                  </>
                                ) : planSuccessNotice[risk.id] ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Plan Approved & Dispatched</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Approve & Create Action Plan</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Footer Info */}
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>Detected: {formatIST(risk.created_at)}</span>
                          </span>
                          <span>Detector Agent: <strong className="text-slate-600">{risk.agent}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* MODAL: MANUAL FIELD TELEMETRY INGESTION                                   */}
        {/* ========================================================================= */}
        {showManualReadingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <span>Ingest Live Field Telemetry</span>
                </h3>
                <button onClick={() => setShowManualReadingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleRecordReading} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Target Zone</label>
                  <select
                    value={selectedZoneForReading}
                    onChange={(e) => setSelectedZoneForReading(e.target.value)}
                    className={inputStyle}
                  >
                    {backendZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.crop || "Crop"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil Moisture (% VWC)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualMoisture}
                      onChange={(e) => setManualMoisture(e.target.value)}
                      className={inputStyle}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">&lt;25% triggers Water Stress</span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Ambient Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualTemp}
                      onChange={(e) => setManualTemp(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Relative Humidity (%)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={manualHumidity}
                      onChange={(e) => setManualHumidity(e.target.value)}
                      className={inputStyle}
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">&gt;80% triggers Pest Risk</span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil pH</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualPh}
                      onChange={(e) => setManualPh(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowManualReadingModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingReading} className={btnPrimary}>
                    {isSubmittingReading ? "Submitting..." : "Ingest Telemetry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
