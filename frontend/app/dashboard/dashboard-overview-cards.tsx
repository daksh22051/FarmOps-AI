"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  getRisks,
  getActionPlans,
  getTasks,
  getAlerts,
} from "../../lib/api/farmops";
import type { RiskAssessment, ActionPlan, Task, Alert } from "../../types/api";

export function DashboardOverviewCards() {
  const { selectedFarmId, selectedFarm } = useFarm();

  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<string | null>(null);

  const loadData = useCallback(async (farmId: string) => {
    requestIdRef.current = farmId;
    setIsLoading(true);
    setError(null);

    try {
      const [risksRes, plansRes, tasksRes, alertsRes] = await Promise.allSettled([
        getRisks(farmId),
        getActionPlans(farmId),
        getTasks(farmId),
        getAlerts(farmId, { acknowledged: false }),
      ]);

      // Guard against race conditions if farm switched during request
      if (requestIdRef.current !== farmId) return;

      if (risksRes.status === "fulfilled" && Array.isArray(risksRes.value.data)) {
        setRisks(risksRes.value.data);
      } else {
        setRisks([]);
      }

      if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value.data)) {
        setPlans(plansRes.value.data);
      } else {
        setPlans([]);
      }

      if (tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.data)) {
        setTasks(tasksRes.value.data);
      } else {
        setTasks([]);
      }

      if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value.data)) {
        setAlerts(alertsRes.value.data);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      if (requestIdRef.current !== farmId) return;
      setError(err instanceof Error ? err.message : "Failed to load operational overview");
    } finally {
      if (requestIdRef.current === farmId) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedFarmId) {
      setRisks([]);
      setPlans([]);
      setTasks([]);
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    // Immediately clear stale state when farm changes
    setRisks([]);
    setPlans([]);
    setTasks([]);
    setAlerts([]);
    void loadData(selectedFarmId);
  }, [selectedFarmId, loadData]);

  // Derived metrics
  const activeRisks = risks.filter((r) => r.status !== "resolved");
  const highCriticalRisks = activeRisks.filter(
    (r) => r.severity === "critical" || r.severity === "high"
  );
  const pendingPlans = plans.filter((p) => p.status === "pending_review");
  const openTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const unackAlerts = alerts.filter((a) => !a.acknowledged_at);
  const criticalAlerts = unackAlerts.filter((a) => a.severity === "critical");

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>Notice: {error}</span>
          </div>
          {selectedFarmId && (
            <button
              type="button"
              onClick={() => void loadData(selectedFarmId)}
              className="font-semibold text-amber-900 underline hover:text-amber-950"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
      {/* 1. Risks & Advisory Command Card */}
      <Card className="flex flex-col justify-between min-h-52">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <ShieldAlert aria-hidden="true" size={18} />
              </span>
              <h2 className="font-semibold text-ink">Risks & advisory</h2>
            </div>
            {isLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                <Loader2 size={11} className="animate-spin" />
                Updating
              </span>
            ) : activeRisks.length > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                {activeRisks.length} Active {activeRisks.length === 1 ? "Risk" : "Risks"}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                All Clear
              </span>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            {isLoading ? (
              <div className="space-y-2 py-2">
                <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
              </div>
            ) : !selectedFarmId ? (
              <div>
                <p className="text-sm font-medium text-slate-700">No farm selected</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  Select an operational farm to view live risk assessments and advisory plans.
                </p>
              </div>
            ) : activeRisks.length === 0 ? (
              <>
                <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-slate-700">No active risks</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Deterministic agronomic models have identified no active water stress, pest, or nutrient anomalies for {selectedFarm?.name || "this farm"}.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {activeRisks.length} active {activeRisks.length === 1 ? "risk" : "risks"} detected
                    {highCriticalRisks.length > 0 && ` (${highCriticalRisks.length} high/critical)`}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {pendingPlans.length > 0
                      ? `${pendingPlans.length} action plan${pendingPlans.length === 1 ? "" : "s"} awaiting human review and approval.`
                      : "Evaluate risks with AI to formulate grounded advisory action plans."}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-[#edf0eb] pt-3 flex items-center justify-between text-xs">
          <Link
            href="/risks"
            className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:text-forest-900 transition-colors"
          >
            Open Risk Center
            <ArrowRight size={13} />
          </Link>
          {pendingPlans.length > 0 && (
            <Link
              href="/plans"
              className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:text-purple-900 transition-colors"
            >
              Review {pendingPlans.length} Plan{pendingPlans.length === 1 ? "" : "s"}
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </Card>

      {/* 2. Tasks & Alerts Subgrid */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Tasks Card */}
        <Card className="flex flex-col justify-between min-h-52">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <ClipboardCheck aria-hidden="true" size={18} />
                </span>
                <h2 className="font-semibold text-ink">Tasks</h2>
              </div>
              {isLoading ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  ...
                </span>
              ) : (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    openTasks.length > 0 ? "bg-blue-100 text-blue-800 font-bold" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {openTasks.length} Open
                </span>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              {isLoading ? (
                <div className="space-y-2 py-2">
                  <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                </div>
              ) : !selectedFarmId ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">No farm selected</p>
                  <p className="mt-1.5 text-xs text-slate-500">Connect a farm to manage tasks.</p>
                </div>
              ) : openTasks.length === 0 ? (
                <>
                  <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">No open tasks</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      {completedTasks.length > 0
                        ? `${completedTasks.length} field task${completedTasks.length === 1 ? "" : "s"} completed.`
                        : "Approved follow-up work will be scheduled here."}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {openTasks.length} field task{openTasks.length === 1 ? "" : "s"} active
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {tasks.filter((t) => t.status === "in_progress").length} in progress,{" "}
                    {tasks.filter((t) => t.status === "pending").length} pending execution.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-[#edf0eb] pt-3 text-xs">
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:text-forest-900 transition-colors"
            >
              Manage Tasks
              <ArrowRight size={13} />
            </Link>
          </div>
        </Card>

        {/* Alerts Card */}
        <Card className="flex flex-col justify-between min-h-52">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <BellRing aria-hidden="true" size={18} />
                </span>
                <h2 className="font-semibold text-ink">Alerts</h2>
              </div>
              {isLoading ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  ...
                </span>
              ) : (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    unackAlerts.length > 0 ? "bg-rose-100 text-rose-800 font-bold" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {unackAlerts.length} Active
                </span>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              {isLoading ? (
                <div className="space-y-2 py-2">
                  <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                </div>
              ) : !selectedFarmId ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">No farm selected</p>
                  <p className="mt-1.5 text-xs text-slate-500">Connect a farm to view alerts.</p>
                </div>
              ) : unackAlerts.length === 0 ? (
                <>
                  <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">No active alerts</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      All operational notices for {selectedFarm?.name || "this farm"} have been acknowledged.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {unackAlerts.length} unacknowledged notice{unackAlerts.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {criticalAlerts.length > 0
                      ? `${criticalAlerts.length} critical alert${criticalAlerts.length === 1 ? "" : "s"} requiring immediate operator review.`
                      : "Operator review and acknowledgement required."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-[#edf0eb] pt-3 text-xs">
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:text-forest-900 transition-colors"
            >
              Review Alerts
              <ArrowRight size={13} />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  </div>
  );
}
