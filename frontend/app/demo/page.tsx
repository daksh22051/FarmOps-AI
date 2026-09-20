"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { DemoRunResult, DemoScenario } from "../../types/api";
import {
  emitSimulatedReadings,
  getSimulatorStatus,
  runDemo,
  type SimulatorStatus,
} from "../../lib/api/farmops";
import {
  AlertTriangle,
  Ban,
  Beaker,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Info,
  Loader2,
  Bug,
  Radio,
  ShieldAlert,
  Sliders,
} from "lucide-react";

interface Scenario {
  id: DemoScenario;
  title: string;
  description: string;
  expectation: string;
  icon: React.ReactNode;
}

const SCENARIOS: Scenario[] = [
  {
    id: "water_stress",
    title: "Falling soil moisture",
    description: "Feeds a low soil-moisture reading into the pipeline for the selected farm.",
    expectation: "Expect a water-stress risk candidate and an irrigation-review plan.",
    icon: <Droplets size={18} className="text-blue-600" />,
  },
  {
    id: "pest_disease",
    title: "Uncertain pest / disease signal",
    description: "Feeds a humid, warm microclimate with no confirming imagery.",
    expectation: "Expect scouting or expert escalation — never an automatic chemical recommendation.",
    icon: <Bug size={18} className="text-amber-600" />,
  },
  {
    id: "nutrient_deficiency",
    title: "Nutrient sample reading",
    description: "Feeds soil nutrient values outside the configured comfortable range.",
    expectation: "Expect a soil-sampling recommendation. The system never proposes a fertilizer dose.",
    icon: <FlaskConical size={18} className="text-emerald-600" />,
  },
  {
    id: "chemical_approval",
    title: "Chemical action requiring approval",
    description: "Produces a plan whose action type is treated as sensitive.",
    expectation: "Expect approval to be required before any task becomes executable.",
    icon: <Beaker size={18} className="text-rose-600" />,
  },
  {
    id: "prohibited_actuator",
    title: "Prohibited equipment action",
    description: "Attempts a plan that would operate machinery directly.",
    expectation: "Expect the safety guard to reject it. This system never actuates equipment.",
    icon: <Ban size={18} className="text-slate-600" />,
  },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-semibold text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

export default function DemoControlsPage() {
  const { selectedFarmId, selectedFarm, refreshBackendState } = useFarm();

  const [simStatus, setSimStatus] = useState<SimulatorStatus | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<DemoRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [emitMessage, setEmitMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSimulatorStatus();
        if (!cancelled && res.data) setSimStatus(res.data);
      } catch {
        /* status is advisory; the buttons surface their own errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = !selectedFarmId || simStatus?.enabled === false;

  const handleScenario = useCallback(
    async (scenario: Scenario) => {
      if (!selectedFarmId) return;
      setRunning(scenario.id);
      setError(null);
      setResult(null);
      try {
        const res = await runDemo(scenario.id, { farm_name: selectedFarm?.name });
        if (res.error) {
          setError(res.error.message || "The scenario could not be run.");
        } else if (res.data) {
          setResult(res.data);
          await refreshBackendState();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error running the scenario.");
      } finally {
        setRunning(null);
      }
    },
    [selectedFarmId, selectedFarm, refreshBackendState]
  );

  const handleEmit = useCallback(
    async (seedHistory: boolean) => {
      if (!selectedFarmId) return;
      setEmitting(true);
      setEmitMessage(null);
      setError(null);
      try {
        const res = await emitSimulatedReadings(selectedFarmId, seedHistory);
        if (res.error) {
          setError(res.error.message || "Could not emit simulated readings.");
        } else if (res.data) {
          setEmitMessage(
            `Emitted ${res.data.events_emitted} simulated reading(s)` +
              (res.data.history_events_seeded
                ? ` and backfilled ${res.data.history_events_seeded} historical point(s).`
                : ".")
          );
          await refreshBackendState();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error emitting readings.");
      } finally {
        setEmitting(false);
      }
    },
    [selectedFarmId, refreshBackendState]
  );

  return (
    <AppShell title="Demo Controls">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sliders size={20} className="text-emerald-600" />
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Demo controls</h1>
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                Demo only
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Drive the full pipeline with clearly-labelled simulated signals
              {selectedFarm ? ` on ${selectedFarm.name}` : ""}.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p>
            Everything triggered here writes <strong>simulated</strong> readings, stored with
            <code className="mx-1 rounded bg-amber-100 px-1">source=simulator</code>
            and badged throughout the app. These are not field measurements, and no physical
            equipment is ever operated.
          </p>
        </div>

        {simStatus?.enabled === false && (
          <Card>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <div>
                <p className="font-bold">Simulator disabled in this environment</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Running as <code>{simStatus.environment}</code>. Demo controls are switched off so
                  simulated values cannot reach a real farm&apos;s records.
                </p>
              </div>
            </div>
          </Card>
        )}

        {!selectedFarmId && (
          <Card>
            <div className="py-8 text-center">
              <Info size={20} className="mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-bold text-slate-800">Select a farm first</p>
              <p className="mt-1 text-xs text-slate-500">
                Demo scenarios run against the currently selected farm.
              </p>
            </div>
          </Card>
        )}

        {/* Raw telemetry emission */}
        <Card>
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Sensor feed</h2>
          <p className="mt-1 text-xs text-slate-500">
            Emit a round of readings for every zone, optionally backfilling history so trend charts
            have something to draw.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleEmit(false)}
              disabled={disabled || emitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-40"
            >
              {emitting ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
              Emit one round
            </button>
            <button
              type="button"
              onClick={() => handleEmit(true)}
              disabled={disabled || emitting}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Emit with history backfill
            </button>
          </div>
          {emitMessage && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={13} /> {emitMessage}
            </p>
          )}
        </Card>

        {/* Scenario triggers */}
        <div>
          <h2 className="mb-3 text-sm font-extrabold tracking-tight text-slate-900">
            End-to-end scenarios
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {SCENARIOS.map((scenario) => (
              <Card key={scenario.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-lg bg-slate-50 p-2">{scenario.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900">{scenario.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{scenario.description}</p>
                    <p className="mt-1.5 text-xs font-semibold text-slate-700">
                      {scenario.expectation}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleScenario(scenario)}
                      disabled={disabled || running !== null}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                    >
                      {running === scenario.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : null}
                      {running === scenario.id ? "Running…" : "Run scenario"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {error && (
          <Card>
            <div className="flex items-start gap-2 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Scenario failed</p>
                <p className="mt-0.5 text-xs text-rose-600">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {result && (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900">
                Pipeline result — {result.scenario.replace(/_/g, " ")}
              </h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  result.success
                    ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                    : "border-rose-200 bg-rose-100 text-rose-800"
                }`}
              >
                {result.success ? "Completed" : "Failed"}
              </span>
            </div>

            <div className="mt-3">
              <Row label="Risk detected" value={result.risk_type ?? "None"} />
              <Row label="Severity" value={result.risk_severity ?? "—"} />
              <Row label="Safety decision" value={result.safety_decision ?? "—"} />
              <Row label="Plan approval state" value={result.approval_state ?? "—"} />
              <Row label="Task status" value={result.task_status ?? "No task created"} />
              <Row
                label="Alert raised"
                value={result.alert_id ? "Yes" : "No"}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/risks"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View risks
              </Link>
              <Link
                href="/plans"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View plans
              </Link>
              <Link
                href="/timeline"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View timeline
              </Link>
              <Link
                href="/escalations"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View escalations
              </Link>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
