"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ClipboardCheck,
  CloudRain,
  CloudSun,
  Droplets,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  Sprout,
  Thermometer,
  Waves,
} from "lucide-react";
import { Card, StatusBadge } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import { formatMeasurementValue, formatFreshness, CANONICAL_METRIC_METADATA } from "../../lib/telemetry";

interface TelemetryMetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: string;
}

const PRIMARY_METRICS: TelemetryMetricConfig[] = [
  { key: "soil_moisture", label: "Soil moisture", icon: Droplets, tone: "bg-sky-50 text-sky-700" },
  { key: "temperature", label: "Temperature", icon: Thermometer, tone: "bg-amber-50 text-amber-700" },
  { key: "humidity", label: "Humidity", icon: Waves, tone: "bg-cyan-50 text-cyan-700" },
  { key: "rainfall", label: "Rainfall", icon: CloudRain, tone: "bg-blue-50 text-blue-700" },
  { key: "ph", label: "Soil pH", icon: Activity, tone: "bg-emerald-50 text-emerald-700" },
  { key: "nitrogen", label: "Nitrogen (N)", icon: Sprout, tone: "bg-teal-50 text-teal-700" },
  { key: "phosphorus", label: "Phosphorus (P)", icon: Sprout, tone: "bg-indigo-50 text-indigo-700" },
  { key: "potassium", label: "Potassium (K)", icon: Sprout, tone: "bg-purple-50 text-purple-700" },
];

export function TelemetryOverview() {
  const {
    selectedFarm,
    selectedFarmId,
    latestTelemetry,
    telemetryEvents,
    devices,
    isLoadingTelemetry,
    telemetryError,
    refreshTelemetry,
  } = useFarm();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTelemetry();
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasTelemetry = Object.keys(latestTelemetry).length > 0;
  const isSelected = Boolean(selectedFarmId);

  return (
    <>
      {/* SECTION 1: OPERATIONAL TELEMETRY */}
      <section className="mt-8" aria-labelledby="overview-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="overview-heading" className="text-lg font-semibold tracking-tight text-ink">
              Operational telemetry
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSelected
                ? hasTelemetry
                  ? "Real backend telemetry feeds from connected farm sensors"
                  : "Live farm indicators (awaiting physical hardware connection)"
                : "Select a farm to view operational sensor telemetry"}
            </p>
          </div>

          {isSelected && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingTelemetry}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-[#dfe6dd] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={isRefreshing || isLoadingTelemetry ? "animate-spin text-forest-700" : "text-slate-500"}
              />
              <span>Refresh Sensors</span>
            </button>
          )}
        </div>

        {/* Telemetry Error Notification (Non-technical) */}
        {telemetryError && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <p>
              Sensor telemetry feed is temporarily unavailable. Displaying last verified records without synthetic substitution.
            </p>
          </div>
        )}

        {/* Sensor KPI Cards Grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PRIMARY_METRICS.map(({ key, label, icon: Icon, tone }) => {
            const measurement = latestTelemetry[key];
            const hasData = Boolean(measurement && typeof measurement.value === "number");

            return (
              <Card key={key} className="flex min-h-32 items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{label}</p>
                  {isLoadingTelemetry && !hasData ? (
                    <div className="mt-4">
                      <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
                      <p className="mt-1 text-xs text-slate-400">Loading sensor data...</p>
                    </div>
                  ) : hasData ? (
                    <>
                      <p className="mt-3 text-2xl font-bold text-ink tracking-tight">
                        {formatMeasurementValue(key, measurement)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Updated {formatFreshness(measurement.timestamp)}
                        {measurement.deviceId ? ` • ${measurement.deviceId.slice(0, 12)}` : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 text-lg font-semibold text-ink">Unavailable</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {isSelected ? "Awaiting live sensor reading" : "Awaiting farm connection"}
                      </p>
                    </>
                  )}
                </div>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                  <Icon aria-hidden="true" size={20} />
                </span>
              </Card>
            );
          })}
        </div>

        {/* Operational Follow-Up Status Items */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card className="flex min-h-28 items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Active risks</p>
              <p className="mt-3 text-lg font-semibold text-ink">Unavailable</p>
              <p className="mt-1 text-xs text-slate-500">Awaiting risk assessment pipeline</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
              <ShieldAlert aria-hidden="true" size={20} />
            </span>
          </Card>
          <Card className="flex min-h-28 items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Pending approvals</p>
              <p className="mt-3 text-lg font-semibold text-ink">Unavailable</p>
              <p className="mt-1 text-xs text-slate-500">Awaiting advisory plan workflow</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <FileCheck2 aria-hidden="true" size={20} />
            </span>
          </Card>
          <Card className="flex min-h-28 items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Open tasks</p>
              <p className="mt-3 text-lg font-semibold text-ink">Unavailable</p>
              <p className="mt-1 text-xs text-slate-500">Awaiting task dispatching</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <ClipboardCheck aria-hidden="true" size={20} />
            </span>
          </Card>
        </div>
      </section>

      {/* SECTION 2: FARM CONDITIONS / LIVE CONDITION HISTORY */}
      <section className="mt-10" aria-labelledby="conditions-heading">
        <div>
          <h2 id="conditions-heading" className="text-lg font-semibold tracking-tight text-ink">
            Farm conditions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live sensor and environmental time-series events
          </p>
        </div>

        <Card className="mt-4 p-0">
          <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Activity aria-hidden="true" size={17} className="text-forest-600" />
              Live condition history
            </div>
            {telemetryEvents.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                {telemetryEvents.length} Events Ingested
              </span>
            ) : (
              <StatusBadge>No live source</StatusBadge>
            )}
          </div>

          {isLoadingTelemetry && telemetryEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-forest-600" />
              Loading real telemetry history...
            </div>
          ) : telemetryEvents.length > 0 ? (
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Showing {Math.min(telemetryEvents.length, 10)} most recent telemetry events recorded for {selectedFarm?.name || "selected farm"}.
                </span>
                {devices.length > 0 && (
                  <span className="font-medium text-slate-700">
                    {devices.length} registered {devices.length === 1 ? "device" : "devices"}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-[#edf0eb] bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Metric</th>
                      <th className="px-4 py-3">Reading</th>
                      <th className="px-4 py-3">Device Reference</th>
                      <th className="px-4 py-3">Sequence</th>
                      <th className="px-4 py-3">Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0eb]">
                    {telemetryEvents.slice(0, 10).map((evt) => {
                      const meta = CANONICAL_METRIC_METADATA[evt.metric];
                      const label = meta?.label || evt.metric;
                      const unit = evt.unit || meta?.defaultUnit || "";

                      return (
                        <tr key={evt.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                            {new Date(evt.event_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">{label}</td>
                          <td className="px-4 py-3 font-semibold text-ink">
                            {evt.value} {unit}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {evt.device_id}
                          </td>
                          <td className="px-4 py-3 text-slate-500">#{evt.sequence}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                              {evt.quality || "good"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-10 min-h-72 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f4ef] text-slate-500">
                <CloudSun aria-hidden="true" size={23} />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-ink">
                Live sensor history is unavailable
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Verified moisture, temperature, and humidity trends will appear here after physical on-farm hardware integration. No synthetic farm measurements are being substituted.
              </p>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
