"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  AlertCircle,
  AlertTriangle,
  BellOff,
  Check,
  CheckCheck,
  Database,
  Filter,
  Info,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react";

export default function AlertsPage() {
  const {
    alerts,
    unreadAlertCount,
    toggleAlertRead,
    markAllAlertsRead,
    deleteAlert,
    clearAlerts,
    restoreDefaultAlerts,
    settings,
  } = useFarm();

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNREAD" | "READ">("ALL");

  // Clear Confirmation State
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter alerts according to settings & UI selection
  const visibleAlerts = alerts.filter((alert) => {
    // Respect settings preferences
    if (!settings.alertDatasetAudits && alert.category === "Dataset Provenance") return false;
    if (!settings.alertHardwareStatus && alert.category === "Hardware Telemetry") return false;

    if (categoryFilter !== "ALL" && alert.category !== categoryFilter) return false;
    if (severityFilter !== "ALL" && alert.severity !== severityFilter) return false;
    if (statusFilter === "UNREAD" && alert.read) return false;
    if (statusFilter === "READ" && !alert.read) return false;
    return true;
  });

  return (
    <AppShell title="Alerts">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              System Audit & Findings
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Verified Scientific Notices
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Notifications & Quality Audits
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Surfacing structural dataset quality findings, telemetry boundary disclosures, and research observations. No synthetic farm emergencies are generated.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadAlertCount > 0 && (
            <button
              type="button"
              onClick={markAllAlertsRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <CheckCheck size={14} />
              Mark All Read
            </button>
          )}

          {alerts.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-50"
            >
              <Trash2 size={14} />
              Clear Inbox
            </button>
          ) : (
            <button
              type="button"
              onClick={restoreDefaultAlerts}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800"
            >
              <RefreshCw size={14} />
              Restore Audit Notices
            </button>
          )}
        </div>
      </div>

      {/* Distinction & Provenance Banner */}
      <div className="mt-6 rounded-xl border border-[#dfe6dd] bg-[#f8faf7] p-4 text-xs text-slate-700">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div className="space-y-1">
            <p className="font-semibold text-ink">
              Alert Integrity & Quality Classification
            </p>
            <p className="leading-relaxed text-slate-600">
              FarmOps AI strictly distinguishes between <strong>Dataset Provenance Audits</strong> (such as duplicate records or image imbalances in research archives), <strong>Hardware Telemetry Notices</strong> (confirming that live MQTT/actuators are intentionally disconnected), and <strong>Agronomic Observations</strong>. Dataset warnings are never misrepresented as active on-farm disasters.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Filter size={15} className="text-forest-600" />
          <span>Filter Inbox:</span>
          {unreadAlertCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
              {unreadAlertCount} unread
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Read Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "UNREAD" | "READ")}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All ({alerts.length})</option>
              <option value="UNREAD">Unread ({unreadAlertCount})</option>
              <option value="READ">Read ({alerts.length - unreadAlertCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              <option value="Dataset Provenance">Dataset Provenance</option>
              <option value="Hardware Telemetry">Hardware Telemetry</option>
              <option value="Agronomic Notice">Agronomic Notice</option>
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
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="mt-6 space-y-4">
        {visibleAlerts.length === 0 ? (
          <Card className="p-12 text-center">
            <BellOff size={36} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-ink">Alert Inbox Empty</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {alerts.length === 0
                ? "You have cleared all alerts. You can restore the verified dataset audit notices at any time."
                : "No alerts match the current filter selection or your Settings preferences."}
            </p>
            {alerts.length === 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={restoreDefaultAlerts}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
                >
                  <RefreshCw size={13} />
                  Restore Audit Notices
                </button>
              </div>
            )}
          </Card>
        ) : (
          visibleAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-5 transition-all border ${
                !alert.read
                  ? "border-forest-300 bg-white shadow-xs"
                  : "border-[#dfe6dd] bg-slate-50/60 opacity-90"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {alert.category === "Dataset Provenance" ? (
                      <Database size={18} className="text-blue-600" />
                    ) : alert.category === "Hardware Telemetry" ? (
                      <Radio size={18} className="text-amber-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-rose-600" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {alert.id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          alert.severity === "high"
                            ? "bg-rose-100 text-rose-800"
                            : alert.severity === "medium"
                            ? "bg-amber-100 text-amber-800"
                            : alert.severity === "low"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {alert.category}
                      </span>
                      {!alert.read && (
                        <span className="rounded-full bg-forest-700 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                          New
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1.5 text-sm font-bold text-ink sm:text-base">
                      {alert.title}
                    </h3>

                    <div className="mt-1 text-xs text-slate-500">
                      <span>Source: <strong className="font-mono text-slate-700">{alert.sourceRef}</strong></span>
                      <span className="mx-2">•</span>
                      <span>{alert.timestamp}</span>
                    </div>

                    <p className="mt-2.5 text-xs text-slate-700 leading-relaxed">
                      {alert.description}
                    </p>

                    <div className="mt-3 rounded-lg bg-[#f0f4ef] p-2.5 text-[11px] text-forest-900 border border-forest-100">
                      <span className="font-semibold block mb-0.5">Evidence & Context Note:</span>
                      {alert.evidenceNote}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleAlertRead(alert.id)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink transition-colors"
                    title={alert.read ? "Mark as Unread" : "Mark as Read"}
                    aria-label={alert.read ? "Mark as Unread" : "Mark as Read"}
                  >
                    {alert.read ? <Check size={16} /> : <CheckCheck size={16} className="text-forest-700" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAlert(alert.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="Delete Notice"
                    aria-label="Delete Notice"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-alerts-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 id="clear-alerts-title" className="text-base font-bold text-ink">
                Clear All Audit Notices?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to clear all {alerts.length} notifications from your active inbox? You can restore the default scientific audit notices at any time.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAlerts();
                  setShowClearConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Clear Inbox
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
