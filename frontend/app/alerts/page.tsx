"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { Alert, Escalation } from "../../types/api";
import {
  getAlerts,
  acknowledgeAlert as apiAcknowledgeAlert,
  getEscalations,
  createEscalation as apiCreateEscalation,
  reviewEscalation as apiReviewEscalation,
} from "../../lib/api/farmops";
import {
  formatAlertSeverity,
  formatEscalationStatus,
  resolveZoneName,
} from "../../lib/alerts";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";

export default function AlertsPage() {
  const { selectedFarmId, selectedFarm, backendZones } = useFarm();

  // Tab State: Alerts vs Escalations
  const [activeTab, setActiveTab] = useState<"alerts" | "escalations">("alerts");

  // Real Alerts State
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // Real Escalations State
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoadingEscalations, setIsLoadingEscalations] = useState<boolean>(false);
  const [escalationsError, setEscalationsError] = useState<string | null>(null);

  // Alert Filters
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [ackFilter, setAckFilter] = useState<"ALL" | "UNACKNOWLEDGED" | "ACKNOWLEDGED">("ALL");

  // Escalation Filters
  const [escalationStatusFilter, setEscalationStatusFilter] = useState<string>("ALL");

  // Feedback Banner
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Review Escalation Modal State
  const [reviewingEscalation, setReviewingEscalation] = useState<Escalation | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewOutcome, setReviewOutcome] = useState("approved_with_adjustments");
  const [reviewStatus, setReviewStatus] = useState<"resolved" | "rejected" | "in_review">("resolved");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Create Escalation Modal State
  const [showCreateEscalation, setShowCreateEscalation] = useState(false);
  const [createReason, setCreateReason] = useState("");
  const [createZoneId, setCreateZoneId] = useState("");
  const [isCreatingEscalation, setIsCreatingEscalation] = useState(false);

  // Load Alerts
  const loadAlerts = useCallback(async (farmId: string) => {
    setIsLoadingAlerts(true);
    setAlertsError(null);
    try {
      const res = await getAlerts(farmId);
      if (res.error) {
        setAlertsError(res.error.message || "Failed to load alerts.");
        setAlerts([]);
      } else if (Array.isArray(res.data)) {
        setAlerts(res.data);
      } else {
        setAlerts([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading alerts.";
      setAlertsError(msg);
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  // Load Escalations
  const loadEscalations = useCallback(async (farmId: string) => {
    setIsLoadingEscalations(true);
    setEscalationsError(null);
    try {
      const res = await getEscalations(farmId);
      if (res.error) {
        setEscalationsError(res.error.message || "Failed to load escalations.");
        setEscalations([]);
      } else if (Array.isArray(res.data)) {
        setEscalations(res.data);
      } else {
        setEscalations([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading escalations.";
      setEscalationsError(msg);
      setEscalations([]);
    } finally {
      setIsLoadingEscalations(false);
    }
  }, []);

  // Farm-switching safety: clear records immediately and reload for active farm
  useEffect(() => {
    if (!selectedFarmId) {
      setAlerts([]);
      setEscalations([]);
      setIsLoadingAlerts(false);
      setIsLoadingEscalations(false);
      setAlertsError(null);
      setEscalationsError(null);
      return;
    }
    setAlerts([]);
    setEscalations([]);
    void loadAlerts(selectedFarmId);
    void loadEscalations(selectedFarmId);
  }, [selectedFarmId, loadAlerts, loadEscalations]);

  // Acknowledge Alert Handler
  const handleAcknowledgeAlert = async (alertId: string) => {
    if (acknowledgingId) return;
    setAcknowledgingId(alertId);
    try {
      const res = await apiAcknowledgeAlert(alertId, { acknowledged_by: "Farm Operator" });
      if (res.error) {
        setFeedbackMessage({
          text: `Acknowledgment failed: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: `Alert ${alertId.slice(0, 10)} acknowledged successfully.`,
          type: "success",
        });
        if (selectedFarmId) await loadAlerts(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error acknowledging alert.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Submit Escalation Review Handler
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingEscalation || isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      const res = await apiReviewEscalation(reviewingEscalation.id, {
        review_notes: reviewNotes.trim(),
        review_outcome: reviewOutcome,
        status: reviewStatus,
      });

      if (res.error) {
        setFeedbackMessage({
          text: `Review submission failed: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: `Escalation review recorded (${reviewStatus}).`,
          type: "success",
        });
        setReviewingEscalation(null);
        setReviewNotes("");
        if (selectedFarmId) await loadEscalations(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error submitting review.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Create Escalation Handler
  const handleCreateEscalationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId || !createReason.trim() || isCreatingEscalation) return;
    setIsCreatingEscalation(true);
    try {
      const res = await apiCreateEscalation({
        farm_id: selectedFarmId,
        zone_id: createZoneId || undefined,
        reason: createReason.trim(),
      });

      if (res.error) {
        setFeedbackMessage({
          text: `Failed to open escalation: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: `Escalation opened for expert agronomist review.`,
          type: "success",
        });
        setShowCreateEscalation(false);
        setCreateReason("");
        setCreateZoneId("");
        await loadEscalations(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating escalation.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsCreatingEscalation(false);
    }
  };

  // Filtered Alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== "ALL" && alert.severity.toLowerCase() !== severityFilter.toLowerCase()) {
      return false;
    }
    if (ackFilter === "UNACKNOWLEDGED" && alert.acknowledged_at) return false;
    if (ackFilter === "ACKNOWLEDGED" && !alert.acknowledged_at) return false;
    return true;
  });

  const unackAlertCount = alerts.filter((a) => !a.acknowledged_at).length;
  const criticalAlertCount = alerts.filter((a) => a.severity.toLowerCase() === "critical").length;

  // Filtered Escalations
  const filteredEscalations = escalations.filter((esc) => {
    if (escalationStatusFilter !== "ALL" && esc.status.toLowerCase() !== escalationStatusFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const openEscalationCount = escalations.filter((e) => e.status.toLowerCase() === "open").length;

  return (
    <AppShell title="Alerts">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Operational Notifications & Gating
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              FastAPI Authoritative State
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Alerts & Expert Escalations
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Real operational notifications and expert agronomist escalations for <strong>{selectedFarm?.name || "selected farm"}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "escalations" && (
            <button
              type="button"
              disabled={!selectedFarmId}
              onClick={() => {
                setCreateReason("");
                setCreateZoneId(backendZones.length > 0 ? backendZones[0].id : "");
                setShowCreateEscalation(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-800 disabled:opacity-50"
            >
              <Plus size={14} />
              Open Escalation
            </button>
          )}

          <button
            type="button"
            disabled={!selectedFarmId || isLoadingAlerts || isLoadingEscalations}
            onClick={() => {
              if (selectedFarmId) {
                void loadAlerts(selectedFarmId);
                void loadEscalations(selectedFarmId);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoadingAlerts || isLoadingEscalations ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Operational Boundary Notice */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="font-semibold">Backend Authoritative Notifications & Escalations</p>
            <p className="leading-relaxed text-blue-900">
              Alerts reflect verified operational and sensor threshold conditions. Acknowledging an alert logs operator awareness and updates backend audit records. Escalations facilitate expert agronomist reviews before risky decisions or non-standard protocols proceed.
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
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
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

      {/* Primary Tab Selector */}
      <div className="mt-6 flex border-b border-[#dfe6dd]">
        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "alerts"
              ? "border-forest-600 text-forest-800"
              : "border-transparent text-slate-500 hover:text-ink"
          }`}
        >
          <Bell size={16} />
          <span>Operational Alerts</span>
          {unackAlertCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              {unackAlertCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("escalations")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "escalations"
              ? "border-purple-600 text-purple-800"
              : "border-transparent text-slate-500 hover:text-ink"
          }`}
        >
          <UserCheck size={16} />
          <span>Expert Escalations</span>
          {openEscalationCount > 0 && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
              {openEscalationCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OPERATIONAL ALERTS */}
      {/* ========================================================= */}
      {activeTab === "alerts" && (
        <div className="mt-6 space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5 border-blue-200 bg-blue-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Unacknowledged Alerts
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-950">
                  {unackAlertCount}
                </span>
                <span className="text-xs text-blue-700 font-medium">pending sign-off</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Active notifications requiring operator verification
              </p>
            </Card>

            <Card className="p-5 border-rose-200 bg-rose-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Critical Severity
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-950">
                  {criticalAlertCount}
                </span>
                <span className="text-xs text-rose-700 font-medium">urgent</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Threshold violations demanding immediate field review
              </p>
            </Card>

            <Card className="p-5 border-slate-200 bg-slate-50/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Total Farm Alerts
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-800">
                  {alerts.length}
                </span>
                <span className="text-xs text-slate-500">recorded</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Authoritative alert log scoped to {selectedFarm?.name || "current farm"}
              </p>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Filter size={15} className="text-forest-600" />
              <span>Filter Alerts:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={ackFilter}
                  onChange={(e) => setAckFilter(e.target.value as "ALL" | "UNACKNOWLEDGED" | "ACKNOWLEDGED")}
                  className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
                >
                  <option value="ALL">All ({alerts.length})</option>
                  <option value="UNACKNOWLEDGED">Unacknowledged ({unackAlertCount})</option>
                  <option value="ACKNOWLEDGED">Acknowledged ({alerts.length - unackAlertCount})</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
                >
                  <option value="ALL">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoadingAlerts && (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <RefreshCw size={28} className="animate-spin text-forest-600" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Loading alerts for {selectedFarm?.name || "selected farm"}...
              </p>
            </Card>
          )}

          {/* Error State */}
          {!isLoadingAlerts && alertsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-rose-600" />
              <h3 className="mt-2 text-sm font-bold text-rose-900">Unable to Load Alerts</h3>
              <p className="mt-1 text-xs text-rose-700">{alertsError}</p>
              {selectedFarmId && (
                <button
                  type="button"
                  onClick={() => void loadAlerts(selectedFarmId)}
                  className="mt-3 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Honest Empty State */}
          {!isLoadingAlerts && !alertsError && alerts.length === 0 && (
            <Card className="p-12 text-center">
              <BellOff size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-ink">No Active Alerts</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                No alerts are recorded for <strong>{selectedFarm?.name || "this farm"}</strong>.
                Operational notices will appear when sensor thresholds or risk events trigger alarm conditions.
              </p>
            </Card>
          )}

          {/* Filtered Empty State */}
          {!isLoadingAlerts && !alertsError && alerts.length > 0 && filteredAlerts.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                No alerts match the active filter criteria.
              </p>
            </Card>
          )}

          {/* Alerts List */}
          {!isLoadingAlerts && !alertsError && filteredAlerts.length > 0 && (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => {
                const severityStyle = formatAlertSeverity(alert.severity);
                const zoneName = resolveZoneName(alert.zone_id, backendZones);
                const isAcknowledged = Boolean(alert.acknowledged_at);

                return (
                  <Card
                    key={alert.id}
                    className={`p-5 transition-all border ${
                      !isAcknowledged
                        ? "border-forest-300 bg-white shadow-xs"
                        : "border-[#dfe6dd] bg-slate-50/70 opacity-95"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {alert.severity.toLowerCase() === "critical" ? (
                            <ShieldAlert size={20} className="text-red-600" />
                          ) : alert.channel === "mqtt" ? (
                            <Radio size={20} className="text-amber-600" />
                          ) : (
                            <Bell size={20} className="text-blue-600" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              {alert.id.slice(0, 10)}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${severityStyle.badgeClass}`}>
                              {severityStyle.label}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                              channel: {alert.channel}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              delivery: {alert.delivery_status}
                            </span>
                          </div>

                          <h3 className="mt-2 text-sm font-bold text-ink sm:text-base">
                            {alert.message}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>
                              Target: <strong>{zoneName}</strong>
                            </span>
                            {alert.risk_id && (
                              <Link
                                href="/risks"
                                className="font-mono text-forest-700 hover:text-forest-900 underline"
                              >
                                Related Risk: {alert.risk_id.slice(0, 8)}
                              </Link>
                            )}
                            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                              <Clock size={12} className="text-slate-400" />
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                          </div>

                          {alert.acknowledged_at && (
                            <div className="mt-2.5 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1.5 font-medium">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Acknowledged on {new Date(alert.acknowledged_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Acknowledge Action */}
                      <div className="shrink-0 self-end sm:self-start">
                        {!isAcknowledged ? (
                          <button
                            type="button"
                            disabled={acknowledgingId === alert.id}
                            onClick={() => void handleAcknowledgeAlert(alert.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            {acknowledgingId === alert.id ? "Acknowledging..." : "Acknowledge"}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <ShieldCheck size={14} className="text-emerald-600" />
                            Acknowledged
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: EXPERT ESCALATIONS */}
      {/* ========================================================= */}
      {activeTab === "escalations" && (
        <div className="mt-6 space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5 border-purple-200 bg-purple-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Open for Review
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-purple-950">
                  {openEscalationCount}
                </span>
                <span className="text-xs text-purple-700 font-medium">pending agronomist</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Escalated situations requiring expert review before execution
              </p>
            </Card>

            <Card className="p-5 border-emerald-200 bg-emerald-50/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Resolved Decisions
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-950">
                  {escalations.filter((e) => e.status.toLowerCase() === "resolved").length}
                </span>
                <span className="text-xs text-emerald-700 font-medium">completed review</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Expert determinations verified and closed
              </p>
            </Card>

            <Card className="p-5 border-slate-200 bg-slate-50/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Total Escalations
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-800">
                  {escalations.length}
                </span>
                <span className="text-xs text-slate-500">lifetime</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Tracked supervisory review requests for this farm
              </p>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Filter size={15} className="text-purple-600" />
              <span>Filter Escalations:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select
                value={escalationStatusFilter}
                onChange={(e) => setEscalationStatusFilter(e.target.value)}
                className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="ALL">All Statuses ({escalations.length})</option>
                <option value="open">Open ({openEscalationCount})</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {isLoadingEscalations && (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <RefreshCw size={28} className="animate-spin text-purple-600" />
              <p className="mt-3 text-sm font-semibold text-ink">
                Loading escalations for {selectedFarm?.name || "selected farm"}...
              </p>
            </Card>
          )}

          {/* Error State */}
          {!isLoadingEscalations && escalationsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-rose-600" />
              <h3 className="mt-2 text-sm font-bold text-rose-900">Unable to Load Escalations</h3>
              <p className="mt-1 text-xs text-rose-700">{escalationsError}</p>
              {selectedFarmId && (
                <button
                  type="button"
                  onClick={() => void loadEscalations(selectedFarmId)}
                  className="mt-3 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Honest Empty State */}
          {!isLoadingEscalations && !escalationsError && escalations.length === 0 && (
            <Card className="p-12 text-center">
              <UserCheck size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-ink">No Escalations Opened</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                No expert escalations are currently open for <strong>{selectedFarm?.name || "this farm"}</strong>.
                If an agronomic condition requires expert review, you can open an escalation above.
              </p>
            </Card>
          )}

          {/* Filtered Empty State */}
          {!isLoadingEscalations && !escalationsError && escalations.length > 0 && filteredEscalations.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                No escalations match the selected filter.
              </p>
            </Card>
          )}

          {/* Escalations List */}
          {!isLoadingEscalations && !escalationsError && filteredEscalations.length > 0 && (
            <div className="space-y-4">
              {filteredEscalations.map((esc) => {
                const statusStyle = formatEscalationStatus(esc.status);
                const zoneName = resolveZoneName(esc.zone_id, backendZones);
                const isPendingReview = ["open", "in_review"].includes(esc.status.toLowerCase());

                return (
                  <Card key={esc.id} className="p-5 border-[#dfe6dd]">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-purple-700">
                            {esc.id.slice(0, 10)}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusStyle.badgeClass}`}>
                            {statusStyle.label}
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-ink">
                          {esc.reason}
                        </h3>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            Target Zone: <strong>{zoneName}</strong>
                          </span>
                          {esc.risk_id && (
                            <Link href="/risks" className="font-mono text-forest-700 hover:text-forest-900 underline">
                              Risk: {esc.risk_id.slice(0, 8)}
                            </Link>
                          )}
                          {esc.plan_id && (
                            <Link href="/plans" className="font-mono text-forest-700 hover:text-forest-900 underline">
                              Plan: {esc.plan_id.slice(0, 8)}
                            </Link>
                          )}
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Clock size={12} className="text-slate-400" />
                            {new Date(esc.created_at).toLocaleString()}
                          </span>
                        </div>

                        {/* Review Findings if Reviewed */}
                        {esc.review_notes && (
                          <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3 text-xs text-purple-950 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-purple-900">Expert Review Finding:</span>
                              {esc.review_outcome && (
                                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-800">
                                  outcome: {esc.review_outcome}
                                </span>
                              )}
                            </div>
                            <p className="text-purple-900 leading-relaxed">{esc.review_notes}</p>
                            {esc.assigned_expert_id && (
                              <p className="text-[10px] text-purple-700">
                                Reviewer ID: {esc.assigned_expert_id}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 self-end sm:self-start">
                        {isPendingReview ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingEscalation(esc);
                              setReviewNotes(esc.review_notes || "");
                              setReviewOutcome(esc.review_outcome || "approved_with_adjustments");
                              setReviewStatus("resolved");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-800 transition-colors"
                          >
                            <UserCheck size={14} />
                            Submit Review
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={14} />
                            Reviewed
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Review Escalation Modal */}
      {reviewingEscalation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="review-modal-title" className="text-base font-bold text-ink">
                Submit Agronomist Review ({reviewingEscalation.id.slice(0, 10)})
              </h3>
              <button
                type="button"
                onClick={() => setReviewingEscalation(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Record expert determination for: <strong>{reviewingEscalation.reason}</strong>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Outcome *
                </label>
                <select
                  value={reviewOutcome}
                  onChange={(e) => setReviewOutcome(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] bg-white px-3 py-2 text-xs text-ink focus:outline-hidden"
                >
                  <option value="approved_with_adjustments">Approved with Adjustments</option>
                  <option value="verified_admissible">Verified Admissible</option>
                  <option value="rejected_inapplicable">Rejected / Inapplicable</option>
                  <option value="secondary_scouting_requested">Secondary Scouting Requested</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Updated Status *
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as "resolved" | "rejected" | "in_review")}
                  className="w-full rounded-lg border border-[#dfe6dd] bg-white px-3 py-2 text-xs text-ink focus:outline-hidden"
                >
                  <option value="resolved">Resolved (Complete)</option>
                  <option value="rejected">Rejected</option>
                  <option value="in_review">In Review (Keep Open)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Review Notes & Agronomic Findings *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-purple-600 focus:outline-hidden"
                  placeholder="Document agronomic rationale, weather context, or dosing adjustments..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isSubmittingReview}
                  onClick={() => setReviewingEscalation(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {isSubmittingReview ? "Submitting..." : "Save Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Escalation Modal */}
      {showCreateEscalation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-escalation-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="create-escalation-title" className="text-base font-bold text-ink">
                Open Expert Escalation
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateEscalation(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEscalationSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Request agronomist supervisor or specialist review for an uncertain situation.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Zone
                </label>
                <select
                  value={createZoneId}
                  onChange={(e) => setCreateZoneId(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] bg-white px-3 py-2 text-xs text-ink focus:outline-hidden"
                >
                  <option value="">Farm-wide / General</option>
                  {backendZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.crop || "No crop specified"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Escalation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-purple-600 focus:outline-hidden"
                  placeholder="e.g., Sensor telemetry shows rapid moisture drop despite recent irrigation; verify sensor calibration vs rootzone deficit."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isCreatingEscalation}
                  onClick={() => setShowCreateEscalation(false)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEscalation}
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {isCreatingEscalation ? "Opening..." : "Submit Escalation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
