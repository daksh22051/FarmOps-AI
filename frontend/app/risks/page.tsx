"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Radio,
  ShieldAlert,
  Sliders,
} from "lucide-react";

// Exact precalculated metrics from data/raw/edge-agricultural-sensor/agriculture_dataset_with_target.csv
const DATASET_CATEGORY_STATS = {
  ALL: {
    count: 2000,
    pct: "100.0%",
    metrics: {
      Soil_Moisture: { mean: 24.95, min: 5.13, max: 44.99 },
      Soil_Temperature: { mean: 22.41, min: 10.0, max: 34.99 },
      Soil_pH: { mean: 6.74, min: 5.5, max: 8.0 },
      Humidity: { mean: 61.71, min: 30.02, max: 94.96 },
      Air_Temperature: { mean: 27.29, min: 15.0, max: 39.99 },
      Solar_Radiation: { mean: 604.38, min: 200.13, max: 999.74 },
      Wind_Speed: { mean: 5.06, min: 0.21, max: 9.99 },
      NDVI_Index: { mean: 0.57, min: 0.2, max: 0.95 },
      "5G_Latency_ms": { mean: 5.6, min: 1.0, max: 9.99 },
    },
  },
  High_Stress: {
    count: 688,
    pct: "34.4%",
    metrics: {
      Soil_Moisture: { mean: 24.24, min: 5.13, max: 44.85 },
      Soil_Temperature: { mean: 22.37, min: 10.0, max: 34.99 },
      Soil_pH: { mean: 6.73, min: 5.5, max: 8.0 },
      Humidity: { mean: 60.74, min: 30.02, max: 94.93 },
      Air_Temperature: { mean: 27.49, min: 15.09, max: 39.97 },
      Solar_Radiation: { mean: 596.02, min: 200.75, max: 999.74 },
      Wind_Speed: { mean: 5.09, min: 0.21, max: 9.99 },
      NDVI_Index: { mean: 0.57, min: 0.2, max: 0.95 },
      "5G_Latency_ms": { mean: 5.65, min: 1.0, max: 9.97 },
    },
  },
  Moderate_Stress: {
    count: 633,
    pct: "31.6%",
    metrics: {
      Soil_Moisture: { mean: 25.19, min: 5.21, max: 44.98 },
      Soil_Temperature: { mean: 22.92, min: 10.1, max: 34.97 },
      Soil_pH: { mean: 6.79, min: 5.5, max: 7.99 },
      Humidity: { mean: 61.43, min: 30.05, max: 94.8 },
      Air_Temperature: { mean: 27.52, min: 15.0, max: 39.89 },
      Solar_Radiation: { mean: 612.63, min: 201.71, max: 998.89 },
      Wind_Speed: { mean: 4.96, min: 0.21, max: 9.99 },
      NDVI_Index: { mean: 0.58, min: 0.2, max: 0.95 },
      "5G_Latency_ms": { mean: 5.42, min: 1.01, max: 9.97 },
    },
  },
  Healthy: {
    count: 679,
    pct: "34.0%",
    metrics: {
      Soil_Moisture: { mean: 25.44, min: 5.2, max: 44.99 },
      Soil_Temperature: { mean: 21.97, min: 10.0, max: 34.95 },
      Soil_pH: { mean: 6.71, min: 5.5, max: 7.99 },
      Humidity: { mean: 62.95, min: 30.24, max: 94.96 },
      Air_Temperature: { mean: 26.88, min: 15.01, max: 39.99 },
      Solar_Radiation: { mean: 605.15, min: 200.13, max: 999.47 },
      Wind_Speed: { mean: 5.12, min: 0.21, max: 9.98 },
      NDVI_Index: { mean: 0.57, min: 0.2, max: 0.95 },
      "5G_Latency_ms": { mean: 5.71, min: 1.01, max: 9.99 },
    },
  },
};

interface ParameterMetadata {
  header: keyof (typeof DATASET_CATEGORY_STATS)["ALL"]["metrics"];
  title: string;
  sourceUnit: string;
  scientificUnitStatus: "Verified" | "Not specified in source";
  evidenceNature: "Direct Dataset Observation" | "Proposed Agronomic Rule-of-Thumb";
  sourceDocument: string;
  interpretation: string;
  statusImplication: string;
}

const PARAMETER_METADATA: ParameterMetadata[] = [
  {
    header: "Soil_Moisture",
    title: "Soil Moisture",
    sourceUnit: "Unspecified (numeric scale 5.13 – 44.99)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Dataset records show a slight decrease in High_Stress (mean 24.24 vs 25.44 in Healthy).",
    statusImplication: "Proposed agronomic check: monitor root zone if tensiometer or local probe drops below 15. Unvalidated for specific user soils.",
  },
  {
    header: "Soil_Temperature",
    title: "Soil Temperature",
    sourceUnit: "Unspecified (presumed °C but undocumented)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Mean stays tightly centered between 21.97 and 22.92 across all 3 health categories.",
    statusImplication: "Soil thermal inertia buffers ambient fluctuations. No standalone diagnostic correlation established in source archive.",
  },
  {
    header: "Soil_pH",
    title: "Soil Reaction (pH)",
    sourceUnit: "Standard pH scale [5.50 – 8.00]",
    scientificUnitStatus: "Verified",
    evidenceNature: "Proposed Agronomic Rule-of-Thumb",
    sourceDocument: "FAO / ICAR Standard Agronomic Benchmark",
    interpretation: "Observed dataset mean is 6.74 across all 2,000 records, within optimal nutrient availability zone.",
    statusImplication: "Standard agronomic rule: pH between 6.0 and 7.5 optimizes macronutrient assimilation. Requires local lab soil test.",
  },
  {
    header: "Humidity",
    title: "Relative Humidity",
    sourceUnit: "Unspecified (presumed % RH, range 30.02 – 94.96)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Observed dataset mean is 61.71; Healthy rows exhibit slightly higher mean (62.95).",
    statusImplication: "Proposed threshold: Sustained high humidity (>85%) warrants manual foliar inspection for fungal spore germination.",
  },
  {
    header: "Air_Temperature",
    title: "Air Temperature",
    sourceUnit: "Unspecified (presumed °C, range 15.00 – 39.99)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Healthy records have lower mean (26.88) compared to Moderate (27.52) and High Stress (27.49).",
    statusImplication: "Proposed threshold: Extreme daytime spikes (>38) warrant thermal mitigation checks. Not a disease diagnosis.",
  },
  {
    header: "Solar_Radiation",
    title: "Solar Radiation",
    sourceUnit: "Unspecified (range 200.13 – 999.74)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Mean across dataset is 604.38; values vary widely across all subsets without clear categorical separation.",
    statusImplication: "High radiation (>900) elevates canopy evapotranspiration demand; manual irrigation check suggested.",
  },
  {
    header: "Wind_Speed",
    title: "Wind Speed",
    sourceUnit: "Unspecified (range 0.21 – 9.99)",
    scientificUnitStatus: "Not specified in source",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Mean is 5.06 uniformly across all subsets; no statistical distinction between health classes.",
    statusImplication: "Operational threshold: Higher winds (>8) increase spray drift risk during manual application.",
  },
  {
    header: "NDVI_Index",
    title: "NDVI Vegetation Index",
    sourceUnit: "Unitless index ratio [-1.0 to 1.0]",
    scientificUnitStatus: "Verified",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (Jan–Mar 2024)",
    interpretation: "Mean is 0.57 across all 3 classes (min 0.20, max 0.95). NDVI alone does not separate labels in this dataset.",
    statusImplication: "General remote-sensing guideline: Values <0.25 indicate sparse canopy; physical ground-truth scouting required.",
  },
  {
    header: "5G_Latency_ms",
    title: "5G Edge Latency",
    sourceUnit: "Milliseconds (ms)",
    scientificUnitStatus: "Verified",
    evidenceNature: "Direct Dataset Observation",
    sourceDocument: "Colabsss Edge Sensor CSV (explicit unit in header)",
    interpretation: "Mean is 5.60 ms (range 1.00 – 9.99 ms). Sole parameter with explicit unit in header.",
    statusImplication: "Network transport telemetry delay only; zero biological or agronomic relevance.",
  },
];

export default function RiskCenterPage() {
  const { formatNumber } = useFarm();
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "High_Stress" | "Moderate_Stress" | "Healthy">("ALL");
  const [activeTab, setActiveTab] = useState<"overview" | "provenance" | "telemetry">("overview");

  const currentStats = DATASET_CATEGORY_STATS[selectedCategory];

  return (
    <AppShell title="Risk Center">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Risk Evidence & Agronomic Thresholds
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Verified Dataset Calculations
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Agronomic & Sensor Risk Center
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Statistical analysis of environmental stress distributions from verified research telemetry. All metrics reflect exact calculations across 2,000 hourly dataset records. No synthetic farm diagnosis is generated.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-semibold text-rose-800">
            <ShieldAlert size={15} className="text-rose-600" />
            Live Hardware: Disconnected
          </div>
        </div>
      </div>

      {/* Boundary & Methodology Disclosure Banner */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">Evidence Grounding & Non-Diagnostic Disclosure</p>
            <p className="leading-relaxed text-amber-900">
              The statistics below are derived from the verified <strong>Edge Assisted Agricultural Sensor Dataset</strong> (2,000 rows, Jan 1 – Mar 24, 2024). Source column headers do not specify physical measurement units (except for 5G latency in ms). The categorical label (<code>Healthy</code>, <code>Moderate_Stress</code>, <code>High_Stress</code>) is a source dataset label and must <strong>never</strong> be interpreted as a certified botanical diagnosis of your actual field parcels.
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
          Stress Distributions & Parameter Thresholds
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

      {activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          {/* Category Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card
              className={`p-5 transition-all cursor-pointer ${
                selectedCategory === "High_Stress"
                  ? "ring-2 ring-rose-500 border-rose-300 bg-rose-50/50"
                  : "border-rose-200 bg-rose-50/20 hover:bg-rose-50/30"
              }`}
              onClick={() => setSelectedCategory("High_Stress")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  High Stress Frequency
                </span>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                  Kaggle Source
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-rose-900">34.4%</span>
                <span className="text-xs text-rose-700 font-mono">
                  ({formatNumber(688)} / {formatNumber(2000)} rows)
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Mean soil moisture 24.24 (vs 25.44 in Healthy). Zero missing cells across 688 observations.
              </p>
            </Card>

            <Card
              className={`p-5 transition-all cursor-pointer ${
                selectedCategory === "Moderate_Stress"
                  ? "ring-2 ring-amber-500 border-amber-300 bg-amber-50/50"
                  : "border-amber-200 bg-amber-50/20 hover:bg-amber-50/30"
              }`}
              onClick={() => setSelectedCategory("Moderate_Stress")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Moderate Stress Frequency
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Kaggle Source
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-amber-900">31.6%</span>
                <span className="text-xs text-amber-700 font-mono">
                  ({formatNumber(633)} / {formatNumber(2000)} rows)
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Intermediate parameter telemetry. Mean air temp 27.52, soil moisture 25.19.
              </p>
            </Card>

            <Card
              className={`p-5 transition-all cursor-pointer ${
                selectedCategory === "Healthy"
                  ? "ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/50"
                  : "border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/30"
              }`}
              onClick={() => setSelectedCategory("Healthy")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Healthy Classification
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Kaggle Source
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-900">34.0%</span>
                <span className="text-xs text-emerald-700 font-mono">
                  ({formatNumber(679)} / {formatNumber(2000)} rows)
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Baseline vegetative state. Highest mean humidity (62.95) and lowest air temp (26.88).
              </p>
            </Card>
          </div>

          {/* Interactive Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Sliders size={15} className="text-forest-600" />
              <span>Active Telemetry Filter:</span>
              <span className="font-bold text-forest-800">
                {selectedCategory === "ALL" ? "All Dataset Rows (N = 2,000)" : `${selectedCategory.replace("_", " ")} (N = ${formatNumber(currentStats.count)})`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-medium">
              {(["ALL", "High_Stress", "Moderate_Stress", "Healthy"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedCategory(filter)}
                  className={`rounded-lg px-3 py-1 transition-all ${
                    selectedCategory === filter
                      ? "bg-forest-700 text-white font-semibold shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter === "ALL" ? "All Records (2,000)" : filter.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Risk Matrix Table */}
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[#edf0eb] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Observed Parameter Statistics & Threshold Analysis
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dynamically calculated values for: <strong>{selectedCategory.replace("_", " ")}</strong> (Sample Size N = {formatNumber(currentStats.count)})
                </p>
              </div>
              <span className="font-mono text-xs text-slate-400">
                12 Columns • 0 Missing Cells in Subset
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f8f6] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Telemetry Metric</th>
                    <th className="px-4 py-3">Source Header</th>
                    <th className="px-4 py-3">Observed Mean</th>
                    <th className="px-4 py-3">Observed Range (Min – Max)</th>
                    <th className="px-4 py-3">Documented Unit Status</th>
                    <th className="px-4 py-3">Grounding Source & Type</th>
                    <th className="px-4 py-3">Agronomic Implication / Boundary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {PARAMETER_METADATA.map((param) => {
                    const stat = currentStats.metrics[param.header];
                    return (
                      <tr key={param.header} className="hover:bg-[#fafbf9]">
                        <td className="px-5 py-3.5 font-semibold text-ink">
                          {param.title}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {param.header}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-ink">
                          {formatNumber(stat.mean)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {formatNumber(stat.min)} – {formatNumber(stat.max)}
                        </td>
                        <td className="px-4 py-3">
                          {param.scientificUnitStatus === "Verified" ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 size={12} />
                              {param.sourceUnit}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 italic text-amber-700">
                              <AlertTriangle size={12} />
                              Not specified in source
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              param.evidenceNature === "Direct Dataset Observation"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {param.evidenceNature}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            {param.sourceDocument}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 leading-relaxed">
                          {param.statusImplication}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

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
