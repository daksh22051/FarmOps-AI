"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  getRisks,
  detectRisks,
  evaluateRiskWithAI,
  createActionPlan,
} from "../../lib/api/farmops";
import {
  formatRiskType,
  getSeverityStyle,
  formatConfidence,
  resolveZoneName,
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
  RiskEvidence,
  AIEvaluationResponse,
} from "../../types/api";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Radio,
  ShieldAlert,
  Sliders,
  RefreshCw,
  Play,
  Clock,
  Layers,
  Activity,
  X,
  Sparkles,
  ListChecks,
} from "lucide-react";

export default function RiskCenterPage() {
  const { selectedFarmId, selectedFarm, backendZones, formatNumber } = useFarm();

  const [activeTab, setActiveTab] = useState<"overview" | "provenance" | "telemetry">("overview");

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

  // Action plan creation tracking keyed by risk_id
  const [creatingPlanRiskId, setCreatingPlanRiskId] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState<Record<string, string>>({});

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Sequence ref to prevent race conditions when switching farms
  const activeRiskRequestIdRef = useRef<string | null>(null);

  // Load risks whenever selected farm changes - strictly farm scoped
  const loadRisks = useCallback(async (farmId: string) => {
    activeRiskRequestIdRef.current = farmId;
    setIsLoadingRisks(true);
    setRisksError(null);
    try {
      const res = await getRisks(farmId);
      // Discard response if farm changed during fetch
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

  useEffect(() => {
    if (selectedFarmId) {
      // Immediately reset previous farm's risk data and AI evaluations to prevent cross-farm display
      setRisks([]);
      setAiEvaluations({});
      setPlanSuccessNotice({});
      setRisksError(null);
      void loadRisks(selectedFarmId);
    } else {
      setRisks([]);
      setAiEvaluations({});
      setPlanSuccessNotice({});
      setIsLoadingRisks(false);
      setRisksError(null);
    }
  }, [selectedFarmId, loadRisks]);

  // Trigger deterministic risk detection
  const handleRunDetection = async () => {
    if (!selectedFarmId || isDetecting) return;
    setIsDetecting(true);
    setNotification(null);
    try {
      const res = await detectRisks({ farm_id: selectedFarmId });
      const detectedCount = res.data?.length ?? 0;
      setNotification({
        type: "success",
        message: `Risk detection completed: ${detectedCount} assessment${detectedCount === 1 ? "" : "s"} evaluated.`,
      });
      // Refresh list to display newly saved assessments
      await loadRisks(selectedFarmId);
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

  // Trigger real AI domain agent evaluation on a specific risk
  const handleEvaluateRiskWithAI = async (risk: RiskAssessment) => {
    if (!selectedFarmId) return;

    // Verify selected risk belongs to currently active farm
    if (risk.farm_id && risk.farm_id !== selectedFarmId) {
      setAiEvaluations((prev) => ({
        ...prev,
        [risk.id]: {
          loading: false,
          error: "Farm scope mismatch: this risk does not belong to the selected farm.",
          data: null,
        },
      }));
      return;
    }

    setAiEvaluations((prev) => ({
      ...prev,
      [risk.id]: {
        loading: true,
        error: null,
        data: prev[risk.id]?.data || null,
      },
    }));

    try {
      const res = await evaluateRiskWithAI({ risk_id: risk.id });
      if (res.data) {
        setAiEvaluations((prev) => ({
          ...prev,
          [risk.id]: {
            loading: false,
            error: null,
            data: res.data,
          },
        }));
      } else {
        throw new Error("No evaluation response received from AI service.");
      }
    } catch (err: unknown) {
      const errMsg = formatAIErrorMessage(err);
      setAiEvaluations((prev) => ({
        ...prev,
        [risk.id]: {
          loading: false,
          error: errMsg,
          data: null,
        },
      }));
    }
  };

  // Create an authoritative action plan from an AI recommendation
  const handleCreatePlanFromAI = async (risk: RiskAssessment, aiData: AIEvaluationResponse) => {
    if (!selectedFarmId || creatingPlanRiskId) return;
    setCreatingPlanRiskId(risk.id);
    try {
      const { proposal } = aiData;
      const title =
        proposal.recommendation.length > 80
          ? `${proposal.recommendation.slice(0, 77)}...`
          : proposal.recommendation;

      const res = await createActionPlan({
        farm_id: selectedFarmId,
        zone_id: risk.zone_id || undefined,
        risk_id: risk.id,
        source_risk_ids: [risk.id],
        title,
        action_summary: proposal.recommendation,
        rationale: proposal.rationale || undefined,
        priority: proposal.urgency === "critical" ? "urgent" : proposal.urgency,
        confidence: proposal.confidence,
        source: "ai_agent",
        ai_proposal: proposal,
        steps: [
          {
            step_number: 1,
            title: "Inspect field conditions & verify diagnostic",
            description: proposal.recommendation,
            action_type: "scouting",
            status: "pending",
          },
        ],
      });

      if (res.error) {
        setNotification({
          type: "error",
          message: `Action plan creation failed: ${res.error.message}`,
        });
      } else if (res.data) {
        setPlanSuccessNotice((prev) => ({
          ...prev,
          [risk.id]: res.data!.id,
        }));
        setNotification({
          type: "success",
          message: `Action plan created (${res.data.id.slice(0, 8)}). Review and approve it on the Action Plans page.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating action plan.";
      setNotification({ type: "error", message: msg });
    } finally {
      setCreatingPlanRiskId(null);
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
      return true;
    });
  }, [risks, severityFilter, typeFilter, statusFilter]);

  // Dynamic statistics calculated from live risks
  const totalRisksCount = risks.length;
  const criticalAndHighCount = useMemo(() => {
    return risks.filter((r) => {
      const s = r.severity.toLowerCase();
      return s === "critical" || s === "high";
    }).length;
  }, [risks]);

  const mediumCount = useMemo(() => {
    return risks.filter((r) => {
      const s = r.severity.toLowerCase();
      return s === "medium" || s === "moderate";
    }).length;
  }, [risks]);

  const lowAndResolvedCount = useMemo(() => {
    return risks.filter((r) => {
      const s = r.severity.toLowerCase();
      const st = r.status.toLowerCase();
      return s === "low" || st === "resolved";
    }).length;
  }, [risks]);

  // Unique risk types present in current farm
  const availableRiskTypes = useMemo(() => {
    const types = new Set<string>();
    risks.forEach((r) => {
      if (r.risk_type) types.add(r.risk_type.toLowerCase());
    });
    return Array.from(types);
  }, [risks]);

  return (
    <AppShell title="Risk Center">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Deterministic Agronomic Detection
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {selectedFarm ? selectedFarm.name : "No Farm Selected"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Agronomic & Sensor Risk Center
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Real-time deterministic risk evaluations for water stress, pest/disease susceptibility, and nutrient deficiency based on live sensor telemetry and agronomic thresholds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          {selectedFarmId && (
            <button
              type="button"
              disabled={isLoadingRisks}
              onClick={() => void loadRisks(selectedFarmId)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoadingRisks ? "animate-spin text-forest-700" : "text-slate-500"} />
              Refresh
            </button>
          )}

          {/* Run Detection Button */}
          <button
            type="button"
            disabled={!selectedFarmId || isDetecting}
            onClick={() => void handleRunDetection()}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 disabled:opacity-50"
          >
            {isDetecting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Detecting Risks...
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                Run Risk Detection
              </>
            )}
          </button>
        </div>
      </div>

      {/* User Feedback Notification */}
      {notification && (
        <div
          className={`mt-4 flex items-center justify-between rounded-xl border p-3.5 text-xs font-medium ${
            notification.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : notification.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : notification.type === "error" ? (
              <AlertTriangle size={16} className="text-rose-600" />
            ) : (
              <Info size={16} className="text-blue-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Boundary & Advisory Disclosure Banner */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">Deterministic Agronomic Boundary & Non-Autonomous Grounding</p>
            <p className="leading-relaxed text-amber-900">
              Risk assessments evaluate verified telemetry readings against agronomic models. They provide advisory flags for field investigation and must <strong>never</strong> trigger automated biological actuators or chemical sprayers without physical farmer scouting and ground-truth verification.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex border-b border-[#dfe6dd] text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`border-b-2 px-4 py-2.5 transition-all ${
            activeTab === "overview"
              ? "border-forest-700 text-forest-800 bg-white/50"
              : "border-transparent text-slate-500 hover:text-ink"
          }`}
        >
          Active Risk Assessments & Detection ({risks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("provenance")}
          className={`border-b-2 px-4 py-2.5 transition-all ${
            activeTab === "provenance"
              ? "border-forest-700 text-forest-800 bg-white/50"
              : "border-transparent text-slate-500 hover:text-ink"
          }`}
        >
          Dataset Limitations & Methodology Audit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("telemetry")}
          className={`border-b-2 px-4 py-2.5 transition-all ${
            activeTab === "telemetry"
              ? "border-forest-700 text-forest-800 bg-white/50"
              : "border-transparent text-slate-500 hover:text-ink"
          }`}
        >
          Physical Telemetry Pipeline Status
        </button>
      </div>

      {/* TAB 1: Real Backend Risk Assessments */}
      {activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          {/* Dynamic Summary Cards derived from backend risks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Critical & High */}
            <Card className="border-rose-200 bg-rose-50/20 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Critical & High Severity
                </span>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                  Immediate Attention
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-900">
                  {formatNumber(criticalAndHighCount)}
                </span>
                <span className="text-xs font-mono text-rose-700">
                  {totalRisksCount > 0
                    ? `(${Math.round((criticalAndHighCount / totalRisksCount) * 100)}% of active)`
                    : "assessments"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Water stress depletion, acute pathogen pressure, or critical nutrient imbalances.
              </p>
            </Card>

            {/* Medium / Moderate */}
            <Card className="border-amber-200 bg-amber-50/20 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Medium / Moderate Stress
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Watch List
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-900">
                  {formatNumber(mediumCount)}
                </span>
                <span className="text-xs font-mono text-amber-700">
                  {totalRisksCount > 0
                    ? `(${Math.round((mediumCount / totalRisksCount) * 100)}% of active)`
                    : "assessments"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Transitory moisture dip or ambient humidity favoring fungal incubation.
              </p>
            </Card>

            {/* Low & Resolved */}
            <Card className="border-emerald-200 bg-emerald-50/20 p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Low / Monitored Risks
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Nominal
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-900">
                  {formatNumber(lowAndResolvedCount)}
                </span>
                <span className="text-xs font-mono text-emerald-700">
                  {totalRisksCount > 0
                    ? `(${Math.round((lowAndResolvedCount / totalRisksCount) * 100)}% of active)`
                    : "assessments"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Mild fluctuations within physiological tolerances or previously resolved conditions.
              </p>
            </Card>
          </div>

          {/* Interactive Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Sliders size={15} className="text-forest-600" />
              <span>Active Scope:</span>
              <span className="font-bold text-forest-800">
                {selectedFarm ? selectedFarm.name : "No Farm"} ({filteredRisks.length} of {risks.length} risks shown)
              </span>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Severity filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-lg border border-[#dfe6dd] bg-slate-50 px-2.5 py-1 text-xs font-medium text-ink focus:border-forest-600 focus:outline-hidden"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Risk Type filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-[#dfe6dd] bg-slate-50 px-2.5 py-1 text-xs font-medium text-ink focus:border-forest-600 focus:outline-hidden"
                >
                  <option value="all">All Types</option>
                  <option value="water_stress">Water Stress</option>
                  <option value="pest_disease">Pest / Disease</option>
                  <option value="nutrient_deficiency">Nutrient Deficiency</option>
                  <option value="heat_stress">Heat Stress</option>
                  <option value="frost">Frost Hazard</option>
                  {availableRiskTypes
                    .filter(
                      (t) =>
                        ![
                          "water_stress",
                          "pest_disease",
                          "nutrient_deficiency",
                          "heat_stress",
                          "frost",
                        ].includes(t)
                    )
                    .map((t) => (
                      <option key={t} value={t}>
                        {formatRiskType(t)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-[#dfe6dd] bg-slate-50 px-2.5 py-1 text-xs font-medium text-ink focus:border-forest-600 focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              {/* Clear filters button if active */}
              {(severityFilter !== "all" || typeFilter !== "all" || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSeverityFilter("all");
                    setTypeFilter("all");
                    setStatusFilter("all");
                  }}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoadingRisks && (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <RefreshCw size={28} className="animate-spin text-forest-600" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Loading risk assessments for {selectedFarm?.name || "selected farm"}...
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Querying verified backend agronomic evaluation records.
              </p>
            </Card>
          )}

          {/* Error State */}
          {!isLoadingRisks && risksError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-rose-600" />
              <h3 className="mt-2 text-sm font-bold text-rose-900">
                Unable to Load Farm Risks
              </h3>
              <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">
                {risksError}
              </p>
              {selectedFarmId && (
                <button
                  type="button"
                  onClick={() => void loadRisks(selectedFarmId)}
                  className="mt-4 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-800"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Empty State (No risks recorded yet) */}
          {!isLoadingRisks && !risksError && risks.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldAlert size={24} />
              </div>
              <h3 className="mt-4 text-base font-bold text-ink">
                No Risk Assessments Recorded
              </h3>
              <p className="mt-1 text-xs text-slate-600 max-w-md">
                No active agronomic risk records currently exist for <strong>{selectedFarm?.name || "this farm"}</strong>. You can trigger deterministic risk detection to evaluate current zone sensor telemetry against water stress, pest/disease, and nutrient deficiency rules.
              </p>
              <button
                type="button"
                disabled={!selectedFarmId || isDetecting}
                onClick={() => void handleRunDetection()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 disabled:opacity-50"
              >
                {isDetecting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Running Detection...
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-current" />
                    Run Risk Detection Now
                  </>
                )}
              </button>
            </Card>
          )}

          {/* Empty Filtered Results */}
          {!isLoadingRisks && !risksError && risks.length > 0 && filteredRisks.length === 0 && (
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <Info size={24} className="text-slate-400" />
              <h4 className="mt-2 text-sm font-bold text-ink">
                No Matching Risk Assessments
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                No risk records match the chosen filters for severity, type, or status.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter("all");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="mt-3 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Clear Filters
              </button>
            </Card>
          )}

          {/* Risk Cards List */}
          {!isLoadingRisks && !risksError && filteredRisks.length > 0 && (
            <div className="space-y-4">
              {filteredRisks.map((risk) => {
                const severityStyle = getSeverityStyle(risk.severity);
                const statusStyle = formatRiskStatus(risk.status);
                const zoneName = resolveZoneName(risk.zone_id, backendZones);
                const evidence = risk.evidence as RiskEvidence | undefined;

                return (
                  <Card
                    key={risk.id}
                    className={`overflow-hidden border p-0 transition-all ${severityStyle.cardBorderClass}`}
                  >
                    {/* Header banner */}
                    <div className={`border-b border-[#edf0eb] px-5 py-4 ${severityStyle.cardBgClass}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${severityStyle.badgeClass}`}
                          >
                            {severityStyle.label} Severity
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle.badgeClass}`}
                          >
                            {statusStyle.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                            <Layers size={12} className="text-slate-500" />
                            {zoneName}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {formatConfidence(risk.confidence)}
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            Score: {formatNumber(risk.score)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2">
                        <h3 className="text-base font-bold text-ink">
                          {formatRiskType(risk.risk_type)}
                        </h3>
                      </div>
                    </div>

                    {/* Body content */}
                    <div className="space-y-4 p-5 text-xs">
                      {/* Agronomic Explanation */}
                      {evidence?.explanation ? (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Agronomic Assessment & Findings
                          </span>
                          <p className="mt-1 text-xs text-slate-700 leading-relaxed font-medium">
                            {evidence.explanation}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 italic">
                          Deterministic evaluation flagged conditions exceeding calibrated physiological thresholds.
                        </p>
                      )}

                      {/* Evidence Signals Grid */}
                      {evidence?.signals && evidence.signals.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Contributing Telemetry Signals
                          </span>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {evidence.signals.map((sig, sIdx) => (
                              <div
                                key={sIdx}
                                className="rounded-lg border border-[#dfe6dd] bg-slate-50/70 p-2.5"
                              >
                                <span className="block text-[10px] font-semibold uppercase text-slate-500 truncate">
                                  {sig.name.replace(/_/g, " ")}
                                </span>
                                <div className="mt-1 flex items-baseline gap-1">
                                  <span className="font-mono text-sm font-bold text-ink">
                                    {typeof sig.value === "number"
                                      ? formatNumber(sig.value)
                                      : String(sig.value)}
                                  </span>
                                  {sig.unit && (
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {sig.unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rules Triggered Chips */}
                      {evidence?.rules_triggered && evidence.rules_triggered.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Rules Triggered
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {evidence.rules_triggered.map((rule, rIdx) => (
                              <span
                                key={rIdx}
                                className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                              >
                                {rule}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Information Notice */}
                      {risk.missing_information && risk.missing_information.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] text-amber-900">
                          <span className="font-semibold">Missing telemetry indicators: </span>
                          <span>{risk.missing_information.join(", ")}</span>
                        </div>
                      )}

                      {/* AI ADVISORY & SAFETY EVALUATION PANEL */}
                      {(() => {
                        const aiState = aiEvaluations[risk.id];
                        const isAiLoading = Boolean(aiState?.loading);
                        const aiData = aiState?.data;
                        const aiError = aiState?.error;

                        return (
                          <div className="mt-3 rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4 space-y-3">
                            {/* Panel Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0eb] pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                                  <Sparkles size={14} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                                    AI Agronomic Advisory & Safety Guard
                                  </h4>
                                  <span className="text-[10px] text-slate-500">
                                    Domain Agent Reasoning • Deterministic Safety Policies
                                  </span>
                                </div>
                              </div>

                              <div>
                                {!aiData && !isAiLoading ? (
                                  <button
                                    type="button"
                                    disabled={!selectedFarmId || isAiLoading}
                                    onClick={() => void handleEvaluateRiskWithAI(risk)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-purple-800 disabled:opacity-50 transition-all"
                                  >
                                    <Sparkles size={12} />
                                    Evaluate with AI
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isAiLoading}
                                    onClick={() => void handleEvaluateRiskWithAI(risk)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                                  >
                                    <RefreshCw size={11} className={isAiLoading ? "animate-spin" : ""} />
                                    Re-evaluate
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Loading State */}
                            {isAiLoading && (
                              <div className="py-4 flex flex-col items-center justify-center text-center">
                                <RefreshCw size={20} className="animate-spin text-purple-600 mb-2" />
                                <p className="text-xs font-semibold text-ink">
                                  Synthesizing risk context & evaluating agronomic proposal...
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Routing through domain agent and verifying via deterministic SafetyGuard.
                                </p>
                              </div>
                            )}

                            {/* Error State */}
                            {!isAiLoading && aiError && (
                              <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-950">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                                  <div className="space-y-1">
                                    <p className="font-semibold text-rose-900">AI Evaluation Notice</p>
                                    <p className="text-rose-800 leading-relaxed">{aiError}</p>
                                    <button
                                      type="button"
                                      onClick={() => void handleEvaluateRiskWithAI(risk)}
                                      className="mt-1.5 inline-flex items-center gap-1 rounded bg-rose-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-800"
                                    >
                                      Retry AI Evaluation
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Un-evaluated State */}
                            {!isAiLoading && !aiError && !aiData && (
                              <div className="py-2 text-xs text-slate-500 leading-relaxed">
                                <span className="font-semibold text-slate-600">AI analysis not run yet.</span> Click &quot;Evaluate with AI&quot; to formulate grounded recommendations for this {formatRiskType(risk.risk_type).toLowerCase()} and evaluate against safety policies.
                              </div>
                            )}

                            {/* Evaluated State (Proposal + SafetyGuard Decision) */}
                            {!isAiLoading && !aiError && aiData && (() => {
                              const { proposal, safety } = aiData;
                              const safetyStyle = getSafetyDecisionStyle(safety.decision, safety.approval_required);
                              const urgencyStyle = formatUrgencyStyle(proposal.urgency);
                              const isRejected = safetyStyle.decisionKey === "reject";
                              const isApprovalRequired = safetyStyle.decisionKey === "approval_required";

                              return (
                                <div className="space-y-3 pt-1">
                                  {/* Proposal Badges */}
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                                        {formatAgentName(proposal.agent_type)}
                                      </span>
                                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${urgencyStyle.badgeClass}`}>
                                        {urgencyStyle.label}
                                      </span>
                                      {proposal.requires_human_review && (
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                          Human Review Required
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-[11px] font-semibold text-purple-900">
                                      {Math.round(proposal.confidence * 100)}% model confidence
                                    </div>
                                  </div>

                                  {/* Authoritative Deterministic SafetyGuard Decision Banner */}
                                  <div
                                    className={`rounded-xl border p-3 text-xs ${safetyStyle.bannerBorderClass} ${safetyStyle.bannerBgClass} ${safetyStyle.textColorClass}`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      {safetyStyle.decisionKey === "allow" ? (
                                        <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${safetyStyle.iconColorClass}`} />
                                      ) : safetyStyle.decisionKey === "reject" ? (
                                        <ShieldAlert size={16} className={`mt-0.5 shrink-0 ${safetyStyle.iconColorClass}`} />
                                      ) : (
                                        <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${safetyStyle.iconColorClass}`} />
                                      )}
                                      <div className="space-y-1 w-full">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-bold">{safetyStyle.label}</span>
                                          <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${safetyStyle.badgeClass}`}>
                                            {safety.decision}
                                          </span>
                                        </div>
                                        <p className="leading-relaxed text-[11px]">{safety.rationale || safetyStyle.summaryText}</p>

                                        {/* Triggered safety flags if any */}
                                        {safety.safety_flags && safety.safety_flags.length > 0 && (
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {safety.safety_flags.map((flag, fIdx) => (
                                              <span
                                                key={fIdx}
                                                className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold"
                                              >
                                                flag: {flag}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        {/* Safety notes */}
                                        {proposal.safety_notes && (
                                          <p className="mt-1 text-[11px] italic opacity-90">
                                            Safety Note: {proposal.safety_notes}
                                          </p>
                                        )}

                                        {/* Non-execution policy reminder */}
                                        {isApprovalRequired && (
                                          <p className="mt-1.5 font-semibold text-[10px] text-amber-900">
                                            Notice: Automated execution is prohibited. Human sign-off is required before any chemical application or field action.
                                          </p>
                                        )}
                                        {isRejected && (
                                          <p className="mt-1.5 font-semibold text-[10px] text-red-900">
                                            Prohibited Action: This recommendation has been rejected for safety and cannot be scheduled or executed.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Actionable AI Recommendation */}
                                  <div className="rounded-lg border border-[#dfe6dd] bg-white p-3 space-y-2">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Recommended Advisory Action
                                      </span>
                                      <p className={`mt-0.5 text-xs font-semibold leading-relaxed ${isRejected ? "line-through text-slate-400" : "text-ink"}`}>
                                        {proposal.recommendation}
                                      </p>
                                    </div>

                                    {/* Agronomic Rationale */}
                                    {proposal.rationale && (
                                      <div className="border-t border-slate-100 pt-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                          Agronomic Rationale & Grounding
                                        </span>
                                        <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                                          {proposal.rationale}
                                        </p>
                                      </div>
                                    )}

                                    {/* Assumptions & Uncertainty */}
                                    {((proposal.assumptions && proposal.assumptions.length > 0) || proposal.uncertainty) && (
                                      <div className="border-t border-slate-100 pt-2 space-y-1 text-[11px] text-slate-600">
                                        {proposal.assumptions && proposal.assumptions.length > 0 && (
                                          <div>
                                            <span className="font-semibold text-slate-700">Assumptions: </span>
                                            <span>{proposal.assumptions.join(" • ")}</span>
                                          </div>
                                        )}
                                        {proposal.uncertainty && (
                                          <div>
                                            <span className="font-semibold text-slate-700">Data Uncertainty: </span>
                                            <span>{proposal.uncertainty}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Telemetry Evidence References */}
                                    {proposal.evidence_refs && proposal.evidence_refs.length > 0 && (
                                      <div className="border-t border-slate-100 pt-2 flex flex-wrap items-center gap-1">
                                        <span className="text-[10px] font-semibold text-slate-500 mr-1">Evidence Keys:</span>
                                        {proposal.evidence_refs.map((ref, rIdx) => (
                                          <span
                                            key={rIdx}
                                            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-600"
                                          >
                                            {ref}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Action Plan Bridge */}
                                    <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                                      {isRejected ? (
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-800">
                                          <ShieldAlert size={14} className="text-rose-600 shrink-0" />
                                          <span>Plan Creation Prohibited: SafetyGuard rejected this recommendation.</span>
                                        </div>
                                      ) : planSuccessNotice[risk.id] ? (
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                            Action Plan Created ({planSuccessNotice[risk.id].slice(0, 8)})
                                          </span>
                                          <Link
                                            href="/plans"
                                            className="text-xs font-semibold text-forest-700 hover:text-forest-900 underline"
                                          >
                                            View in Action Plans →
                                          </Link>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={creatingPlanRiskId === risk.id}
                                          onClick={() => void handleCreatePlanFromAI(risk, aiData)}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors disabled:opacity-50"
                                        >
                                          <ListChecks size={13} />
                                          {creatingPlanRiskId === risk.id
                                            ? "Generating Action Plan..."
                                            : "Create Agronomic Action Plan"}
                                        </button>
                                      )}

                                      <span className="text-[10px] text-slate-500 font-medium">
                                        Human approval required before task dispatch
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Footer Metadata */}
                      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#edf0eb] pt-3 text-[11px] text-slate-500">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Activity size={12} className="text-slate-400" />
                            Agent: {risk.agent} (v{risk.agent_version})
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock size={12} className="text-slate-400" />
                            {new Date(risk.created_at).toLocaleString()}
                          </span>
                        </div>

                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Advisory Diagnostic • Human Confirmation Required
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Dataset Provenance & Rigorous Audit Findings */}
      {activeTab === "provenance" && (
        <div className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-bold text-ink mb-3">
              Dataset Provenance & Rigorous Audit Findings
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              To adhere strictly to data integrity standards, FarmOps AI performs automated RFC4180 parsing and statistical verification against the local raw datasets. The following audit findings are established for the research archives:
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4 space-y-2">
                <span className="font-bold text-ink block">
                  1. Edge Assisted Agricultural Sensor Dataset
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Record Count:</strong> Exactly 2,000 rows, 12 columns.</li>
                  <li><strong>Date Range:</strong> 2024-01-01 00:00:00 to 2024-03-24 07:00:00.</li>
                  <li><strong>Timezone:</strong> Undocumented in source CSV header.</li>
                  <li><strong>Units:</strong> Only <code>5G_Latency_ms</code> explicitly defines its unit (ms).</li>
                  <li><strong>Statistical Anomaly:</strong> NDVI mean is 0.57 across all 3 classes (Healthy, Moderate_Stress, High_Stress), showing that NDVI alone in this dataset is not a discriminant.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4 space-y-2">
                <span className="font-bold text-ink block">
                  2. Soil Moisture Sensor Network (Station CAF003)
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Audit Finding:</strong> Contains 889 duplicate timestamp rows.</li>
                  <li><strong>Missing Values:</strong> Sensor dropouts encoded as <code>NA</code>.</li>
                  <li><strong>Adapter Handling:</strong> Server adapter enforces deduplication and drops invalid rows without synthetic interpolation.</li>
                  <li><strong>Application:</strong> Deep subsoil moisture profiles (VW_60cm and VW_90cm) used as illustrative benchmark references only.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: Physical Telemetry Pipeline Status */}
      {activeTab === "telemetry" && (
        <div className="mt-6 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Radio size={20} className="text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Hardware Telemetry Gateway Status
                </h3>
                <p className="text-xs text-slate-500">
                  Live connection audit across field buses and wireless sensor nodes.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#dfe6dd] p-3 text-xs">
                <div>
                  <strong className="text-ink block">MQTT Telemetry Broker</strong>
                  <span className="text-slate-500">broker.farmops.local:1883</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Disconnected (No Hardware Deployed)
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#dfe6dd] p-3 text-xs">
                <div>
                  <strong className="text-ink block">LoRaWAN Gateway (868/915 MHz)</strong>
                  <span className="text-slate-500">Soil moisture probe array / ambient weather station</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  No InfluxDB Stream
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#dfe6dd] p-3 text-xs">
                <div>
                  <strong className="text-ink block">Actuator & Solenoid Control Bus</strong>
                  <span className="text-slate-500">Drip irrigation zone valves / dosing pumps</span>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  Hardware Commands Prohibited (Advisory Only)
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
              <strong>System Boundary:</strong> FarmOps AI operates exclusively as an advisory workspace. Even if physical hardware is connected in future phases, agricultural actuation (pumps, fertilizer applicators, sprayers) will remain subject to manual farmer verification and dispatch.
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
