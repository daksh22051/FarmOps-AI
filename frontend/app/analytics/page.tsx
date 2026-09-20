"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import { useDashboard } from "../dashboard/use-dashboard";
import { freshnessLabel } from "../../lib/api/dashboard";
import { formatRiskType } from "../../lib/risks";
import { BarChart3, Info, ShieldAlert, ListTodo, Layers, Bell } from "lucide-react";

/** Horizontal bar built from real counts. Empty input renders an explicit empty state. */
function BreakdownBar({
  rows,
  emptyLabel,
}: {
  rows: { key: string; label: string; count: number; color: string }[];
  emptyLabel: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) {
    return <p className="py-4 text-center text-xs text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows
        .filter((r) => r.count > 0)
        .map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{r.label}</span>
              <span className="font-extrabold text-slate-900">
                {r.count}
                <span className="ml-1 font-medium text-slate-400">
                  ({Math.round((r.count / total) * 100)}%)
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${r.color}`}
                style={{ width: `${(r.count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-slate-50 p-2">{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { selectedFarmId, selectedFarm } = useFarm();
  const { data, loading, error } = useDashboard(selectedFarmId);

  const riskRows = useMemo(() => {
    const bySeverity: Record<string, number> = {};
    for (const r of data?.risks ?? []) {
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    }
    return [
      { key: "critical", label: "Critical", count: bySeverity.critical ?? 0, color: "bg-rose-500" },
      { key: "high", label: "High", count: bySeverity.high ?? 0, color: "bg-orange-500" },
      { key: "medium", label: "Medium", count: bySeverity.medium ?? 0, color: "bg-amber-400" },
      { key: "low", label: "Low", count: bySeverity.low ?? 0, color: "bg-emerald-500" },
    ];
  }, [data?.risks]);

  const typeRows = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const r of data?.risks ?? []) {
      byType[r.risk_type] = (byType[r.risk_type] ?? 0) + 1;
    }
    const palette = ["bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-slate-400"];
    return Object.entries(byType).map(([key, count], i) => ({
      key,
      label: formatRiskType(key),
      count,
      color: palette[i % palette.length],
    }));
  }, [data?.risks]);

  const freshnessRows = useMemo(() => {
    const byFreshness: Record<string, number> = {};
    for (const z of data?.zones ?? []) {
      byFreshness[z.telemetry_status] = (byFreshness[z.telemetry_status] ?? 0) + 1;
    }
    return [
      { key: "fresh", label: "Current", count: byFreshness.fresh ?? 0, color: "bg-emerald-500" },
      { key: "stale", label: "Stale", count: byFreshness.stale ?? 0, color: "bg-amber-400" },
      { key: "very_stale", label: "Very stale", count: byFreshness.very_stale ?? 0, color: "bg-orange-500" },
      { key: "offline", label: "No recent data", count: byFreshness.offline ?? 0, color: "bg-slate-400" },
    ];
  }, [data?.zones]);

  const completed = data?.completed_tasks.length ?? 0;
  const open = data?.counts.open_tasks ?? 0;

  return (
    <AppShell title="Analytics">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-emerald-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Analytics</h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Current standing of {selectedFarm?.name ?? "the selected farm"}, derived from recorded
            risks, tasks and telemetry.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            These figures are a snapshot of what is currently recorded, not a historical trend
            series. Counts come straight from the dashboard API; nothing here is estimated.
          </p>
        </div>

        {!selectedFarmId ? (
          <Card>
            <p className="py-10 text-center text-sm text-slate-600">
              Select a farm to see its analytics.
            </p>
          </Card>
        ) : error ? (
          <Card>
            <p className="py-6 text-center text-sm text-rose-700">{error}</p>
          </Card>
        ) : loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                icon={<ShieldAlert size={17} className="text-rose-600" />}
                label="Open risks"
                value={data?.counts.risks ?? 0}
                hint="Candidates awaiting review or action"
              />
              <Stat
                icon={<ListTodo size={17} className="text-blue-600" />}
                label="Open tasks"
                value={open}
                hint={`${completed} completed recently`}
              />
              <Stat
                icon={<Layers size={17} className="text-emerald-600" />}
                label="Zones"
                value={data?.zones.length ?? 0}
                hint={`${data?.counts.devices ?? 0} enabled device(s)`}
              />
              <Stat
                icon={<Bell size={17} className="text-amber-600" />}
                label="Unacknowledged alerts"
                value={data?.counts.alerts ?? 0}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">
                  Open risks by severity
                </h2>
                <BreakdownBar rows={riskRows} emptyLabel="No open risk candidates." />
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">
                  Open risks by type
                </h2>
                <BreakdownBar rows={typeRows} emptyLabel="No open risk candidates." />
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">
                  Zone data freshness
                </h2>
                <BreakdownBar rows={freshnessRows} emptyLabel="No zones configured." />
                <p className="mt-3 text-[11px] text-slate-500">
                  Farm-wide feed: {freshnessLabel(data?.monitoring.status, data?.monitoring.has_data)}
                  {data?.monitoring.age_minutes != null
                    ? ` · last reading ${Math.round(data.monitoring.age_minutes)} min ago`
                    : ""}
                </p>
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">
                  Task workload
                </h2>
                <BreakdownBar
                  rows={[
                    { key: "open", label: "Open", count: open, color: "bg-blue-500" },
                    { key: "done", label: "Completed", count: completed, color: "bg-emerald-500" },
                  ]}
                  emptyLabel="No tasks recorded for this farm."
                />
                <p className="mt-3 text-[11px] text-slate-500">
                  Completing a task does not by itself resolve the underlying risk — the engine
                  reassesses against new readings.{" "}
                  <Link href="/tasks" className="font-semibold text-emerald-700 underline underline-offset-2">
                    Open task board
                  </Link>
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
