"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { AuditEvent } from "../../types/api";
import { getAuditEvents } from "../../lib/api/farmops";
import { formatAuditEvent, sanitizeAuditState } from "../../lib/alerts";
import {
  Activity,
  AlertTriangle,
  Clock,
  Filter,
  History,
  Info,
  Layers,
  RefreshCw,
  Shield,
  User,
} from "lucide-react";

export default function TimelinePage() {
  const { selectedFarmId, selectedFarm } = useFarm();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Filters
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const loadEvents = useCallback(async (farmId: string) => {
    setIsLoadingEvents(true);
    setEventsError(null);
    try {
      const res = await getAuditEvents(farmId, { limit: 100 });
      if (res.error) {
        setEventsError(res.error.message || "Failed to load audit events.");
        setEvents([]);
      } else if (Array.isArray(res.data)) {
        setEvents(res.data);
      } else {
        setEvents([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading audit events.";
      setEventsError(msg);
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Farm-switching safety: clear events immediately on farm change
  useEffect(() => {
    if (!selectedFarmId) {
      setEvents([]);
      setIsLoadingEvents(false);
      setEventsError(null);
      return;
    }
    setEvents([]);
    void loadEvents(selectedFarmId);
  }, [selectedFarmId, loadEvents]);

  // Filtered Events
  const filteredEvents = events.filter((evt) => {
    if (entityFilter !== "ALL" && evt.entity_type.toLowerCase() !== entityFilter.toLowerCase()) {
      return false;
    }
    if (actionFilter !== "ALL" && evt.event_type.toLowerCase() !== actionFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const riskAdvisoryCount = events.filter((e) =>
    ["risk", "risk_assessment", "action_plan", "plan"].includes(e.entity_type.toLowerCase())
  ).length;

  const taskCount = events.filter((e) =>
    ["task", "field_task"].includes(e.entity_type.toLowerCase())
  ).length;

  const alertEscalationCount = events.filter((e) =>
    ["alert", "escalation"].includes(e.entity_type.toLowerCase())
  ).length;

  return (
    <AppShell title="Timeline">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Audit Trail & Traceability
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Immutable Backend Logs
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Audit Trail & Activity Timeline
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Authoritative, chronologically ordered audit logs tracking risk detections, human approval decisions, field task executions, and safety policies for <strong>{selectedFarm?.name || "selected farm"}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedFarmId || isLoadingEvents}
            onClick={() => {
              if (selectedFarmId) void loadEvents(selectedFarmId);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoadingEvents ? "animate-spin" : ""} />
            Refresh Audit Log
          </button>
        </div>
      </div>

      {/* Audit Policy Banner */}
      <div className="mt-6 rounded-xl border border-forest-200 bg-[#f4f7f2] p-4 text-xs text-forest-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div className="space-y-1">
            <p className="font-semibold text-forest-900">
              Authoritative Compliance & Audit Grounding
            </p>
            <p className="leading-relaxed text-forest-800">
              Every entry in this stream originates directly from verified PostgreSQL audit records generated during risk evaluation, safety gating, or human task completion. <strong>No fake timeline entries or synthetic activities are fabricated.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Event Classification Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className={`p-4 cursor-pointer transition-all border ${
            entityFilter === "risk"
              ? "ring-2 ring-forest-500 bg-forest-50/40 border-forest-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setEntityFilter(entityFilter === "risk" ? "ALL" : "risk")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800">
              Risks & Advisories
            </span>
            <Shield size={16} className="text-forest-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-forest-900">{riskAdvisoryCount}</span>
            <span className="text-xs text-forest-700">audit logs</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Detections, evaluations, and human plan decisions
          </p>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all border ${
            entityFilter === "task"
              ? "ring-2 ring-blue-500 bg-blue-50/40 border-blue-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setEntityFilter(entityFilter === "task" ? "ALL" : "task")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Field Execution Tasks
            </span>
            <Layers size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-900">{taskCount}</span>
            <span className="text-xs text-blue-700">transitions</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Manual crew assignments, start, and completions
          </p>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all border ${
            entityFilter === "alert"
              ? "ring-2 ring-amber-500 bg-amber-50/40 border-amber-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setEntityFilter(entityFilter === "alert" ? "ALL" : "alert")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Alerts & Escalations
            </span>
            <Activity size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-900">{alertEscalationCount}</span>
            <span className="text-xs text-amber-700">events</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Operational alarm triggers and expert reviews
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Filter size={15} className="text-forest-600" />
          <span>Filter Audit Stream:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Entity Type:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Entities ({events.length})</option>
              <option value="risk">Risk Assessments</option>
              <option value="action_plan">Action Plans</option>
              <option value="task">Field Tasks</option>
              <option value="alert">Alerts</option>
              <option value="escalation">Escalations</option>
              <option value="telemetry">Telemetry</option>
              <option value="device">Devices</option>
              <option value="farm">Farm</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="started">Started</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoadingEvents && (
        <Card className="mt-6 flex flex-col items-center justify-center p-12 text-center">
          <RefreshCw size={28} className="animate-spin text-forest-600" />
          <p className="mt-3 text-sm font-semibold text-ink">
            Loading audit timeline for {selectedFarm?.name || "selected farm"}...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Fetching immutable audit events and compliance records.
          </p>
        </Card>
      )}

      {/* Error State */}
      {!isLoadingEvents && eventsError && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle size={28} className="mx-auto text-rose-600" />
          <h3 className="mt-2 text-sm font-bold text-rose-900">Unable to Load Audit Trail</h3>
          <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">{eventsError}</p>
          {selectedFarmId && (
            <button
              type="button"
              onClick={() => void loadEvents(selectedFarmId)}
              className="mt-3 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Honest Empty State */}
      {!isLoadingEvents && !eventsError && events.length === 0 && (
        <Card className="mt-6 p-12 text-center">
          <History size={36} className="mx-auto text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-ink">No Activity History Yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            No audit events have been logged for <strong>{selectedFarm?.name || "this farm"}</strong>.
            Events will be recorded as sensor telemetry is ingested, risks are detected, and plans are approved.
          </p>
        </Card>
      )}

      {/* Filtered Empty State */}
      {!isLoadingEvents && !eventsError && events.length > 0 && filteredEvents.length === 0 && (
        <Card className="mt-6 p-10 text-center">
          <p className="text-xs font-semibold text-slate-500">
            No audit events match the chosen filters.
          </p>
        </Card>
      )}

      {/* Timeline Stream */}
      {!isLoadingEvents && !eventsError && filteredEvents.length > 0 && (
        <div className="mt-8 relative pl-6 sm:pl-8 border-l-2 border-[#dfe6dd] ml-3 sm:ml-4 space-y-6">
          {filteredEvents.map((evt) => {
            const auditMeta = formatAuditEvent(evt);
            const sanitizedAfter = sanitizeAuditState(evt.after_state);

            return (
              <div key={evt.id} className="relative group">
                {/* Timeline Bullet */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white shadow-2xs bg-forest-700 text-white">
                  <Clock size={12} />
                </div>

                {/* Event Card */}
                <Card className="p-5 border-[#dfe6dd] hover:border-slate-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${auditMeta.badgeClass}`}>
                        {auditMeta.entityLabel} • {evt.event_type.toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        source: {evt.source}
                      </span>
                      {evt.correlation_id && (
                        <span className="font-mono text-[10px] text-slate-400">
                          corr: {evt.correlation_id.slice(0, 8)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={13} className="text-slate-400" />
                      <span className="font-mono">{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-ink sm:text-base">
                    {auditMeta.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                    {auditMeta.summary}
                  </p>

                  {/* Entity Link if applicable */}
                  {evt.entity_id && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span>Target Entity:</span>
                      {evt.entity_type === "risk" ? (
                        <Link href="/risks" className="font-mono text-forest-700 hover:text-forest-900 underline">
                          Risk {evt.entity_id.slice(0, 8)}
                        </Link>
                      ) : evt.entity_type === "action_plan" ? (
                        <Link href="/plans" className="font-mono text-forest-700 hover:text-forest-900 underline">
                          Plan {evt.entity_id.slice(0, 8)}
                        </Link>
                      ) : evt.entity_type === "task" ? (
                        <Link href="/tasks" className="font-mono text-forest-700 hover:text-forest-900 underline">
                          Task {evt.entity_id.slice(0, 8)}
                        </Link>
                      ) : evt.entity_type === "alert" ? (
                        <Link href="/alerts" className="font-mono text-forest-700 hover:text-forest-900 underline">
                          Alert {evt.entity_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="font-mono text-slate-600">{evt.entity_id.slice(0, 12)}</span>
                      )}
                    </div>
                  )}

                  {/* Sanitized State Preview if Present */}
                  {sanitizedAfter && Object.keys(sanitizedAfter).length > 0 && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] font-mono text-slate-700 border border-[#dfe6dd] overflow-x-auto">
                      <span className="font-semibold text-slate-500 block mb-1 font-sans">
                        Recorded State Snapshot:
                      </span>
                      <pre className="text-[10px] leading-relaxed">
                        {JSON.stringify(sanitizedAfter, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#edf0eb] pt-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      Actor: <strong className="text-slate-700">{evt.actor_id || "System"}</strong>
                    </span>
                    <span className="font-mono text-slate-400">{evt.id}</span>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
