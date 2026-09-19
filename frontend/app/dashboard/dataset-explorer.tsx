"use client";

import React, { useState, useEffect } from "react";
import type { DashboardDatasetBundle } from "../../lib/data/server";
import type { CropRecordPayload } from "../../lib/data/server/crop-adapter";
import type { EdgeSensorRecordPayload } from "../../lib/data/server/edge-sensor-adapter";
import type { SoilDailyRecordPayload } from "../../lib/data/server/soil-daily-adapter";
import type { SoilHourlyRecordPayload } from "../../lib/data/server/soil-hourly-adapter";
import type { SourceReference, DatasetValue } from "../../lib/data/dataset-adapter";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Info,
  Leaf,
  ShieldAlert,
  Sprout,
  Waves,
} from "lucide-react";
import { Card } from "../../components/ui";

interface DatasetExplorerProps {
  initialBundle: DashboardDatasetBundle;
}

type TabType = "crop" | "edge-sensor" | "soil-network" | "images" | "audit";

interface CropRecordItem {
  reference: SourceReference;
  payload: CropRecordPayload;
}

interface EdgeSensorRecordItem {
  reference: SourceReference;
  payload: EdgeSensorRecordPayload;
}

interface SoilRecordItem {
  reference: SourceReference;
  payload: SoilDailyRecordPayload | SoilHourlyRecordPayload;
}

interface ImageRecordItem {
  reference: SourceReference;
  payload: {
    relativePath: string;
    fileName: string;
    directoryLabel?: string;
    plantName?: string;
    conditionLabel?: string;
    byteSize: number;
    extension: string;
  };
}

interface ApiRecordsEnvelope<T> {
  status?: string;
  data?: {
    records: T[];
  };
  pagination?: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  error?: string;
  message?: string;
}

interface SafeFetchResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function safeFetchJson<T>(url: string): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      if (contentType.includes("application/json")) {
        try {
          const errJson = await res.json();
          const msg = errJson?.message || errJson?.error || `Request failed with HTTP ${res.status}`;
          return { ok: false, status: res.status, error: msg };
        } catch {
          return { ok: false, status: res.status, error: `Request failed with HTTP ${res.status}` };
        }
      }
      return {
        ok: false,
        status: res.status,
        error: `Endpoint returned HTTP ${res.status} (${res.statusText || "Error"}) with non-JSON response. Route or backend service may be unavailable.`,
      };
    }

    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        status: res.status,
        error: `Expected JSON from server but received content-type "${contentType}". Response cannot be parsed as JSON.`,
      };
    }

    const json = (await res.json()) as T;
    return { ok: true, status: res.status, data: json };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: `Network request error: ${message}`,
    };
  }
}

export function DatasetExplorer({ initialBundle }: DatasetExplorerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("crop");

  // Crop pagination state
  const [cropRecords, setCropRecords] = useState<CropRecordItem[]>([]);
  const [cropOffset, setCropOffset] = useState(0);
  const [cropLimit] = useState(15);
  const [cropLoading, setCropLoading] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [cropReloadKey, setCropReloadKey] = useState(0);
  const [cropTotal] = useState(2200);

  // Edge sensor pagination state
  const [edgeRecords, setEdgeRecords] = useState<EdgeSensorRecordItem[]>([]);
  const [edgeOffset, setEdgeOffset] = useState(0);
  const [edgeLimit] = useState(15);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [edgeReloadKey, setEdgeReloadKey] = useState(0);
  const [edgeTotal] = useState(2000);

  // Soil moisture state
  const [selectedStation, setSelectedStation] = useState<string>("CAF003");
  const [soilGrain, setSoilGrain] = useState<"daily" | "hourly">("daily");
  const [soilRecords, setSoilRecords] = useState<SoilRecordItem[]>([]);
  const [soilOffset, setSoilOffset] = useState(0);
  const [soilLimit] = useState(15);
  const [soilLoading, setSoilLoading] = useState(false);
  const [soilError, setSoilError] = useState<string | null>(null);
  const [soilReloadKey, setSoilReloadKey] = useState(0);
  const [soilTotal, setSoilTotal] = useState(3346);

  // Image archive state
  const [imageSource, setImageSource] = useState<"edge" | "plantvillage">("edge");
  const [pvVariant, setPvVariant] = useState<"color" | "grayscale" | "segmented">("color");
  const [selectedImageClass, setSelectedImageClass] = useState<string>("");
  const [imageRecords, setImageRecords] = useState<ImageRecordItem[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageReloadKey, setImageReloadKey] = useState(0);
  const [previewModalImg, setPreviewModalImg] = useState<{ src: string; title: string; meta: string } | null>(null);

  // Fetch crop records
  useEffect(() => {
    if (activeTab !== "crop") return;
    let isCancelled = false;
    setCropLoading(true);
    setCropError(null);

    safeFetchJson<ApiRecordsEnvelope<CropRecordItem>>(
      `/api/datasets/records?dataset=crop-recommendation&offset=${cropOffset}&limit=${cropLimit}`
    )
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data?.status === "ready" && res.data?.data?.records) {
          setCropRecords(res.data.data.records);
          setCropError(null);
        } else if (!res.ok) {
          setCropError(res.error || "Failed to load crop recommendation records.");
        } else if (res.data?.error) {
          setCropError(res.data.error);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setCropError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!isCancelled) setCropLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, cropOffset, cropLimit, cropReloadKey]);

  // Fetch edge sensor records
  useEffect(() => {
    if (activeTab !== "edge-sensor") return;
    let isCancelled = false;
    setEdgeLoading(true);
    setEdgeError(null);

    safeFetchJson<ApiRecordsEnvelope<EdgeSensorRecordItem>>(
      `/api/datasets/records?dataset=edge-sensor-csv&offset=${edgeOffset}&limit=${edgeLimit}`
    )
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data?.status === "ready" && res.data?.data?.records) {
          setEdgeRecords(res.data.data.records);
          setEdgeError(null);
        } else if (!res.ok) {
          setEdgeError(res.error || "Failed to load edge sensor records.");
        } else if (res.data?.error) {
          setEdgeError(res.data.error);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setEdgeError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!isCancelled) setEdgeLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, edgeOffset, edgeLimit, edgeReloadKey]);

  // Fetch soil moisture records
  useEffect(() => {
    if (activeTab !== "soil-network") return;
    let isCancelled = false;
    setSoilLoading(true);
    setSoilError(null);
    const datasetKey = soilGrain === "daily" ? "soil-daily" : "soil-hourly";

    safeFetchJson<ApiRecordsEnvelope<SoilRecordItem>>(
      `/api/datasets/records?dataset=${datasetKey}&station=${selectedStation}&offset=${soilOffset}&limit=${soilLimit}`
    )
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data?.status === "ready" && res.data?.data?.records) {
          setSoilRecords(res.data.data.records);
          setSoilTotal(res.data.pagination?.totalCount ?? (soilGrain === "daily" ? 3346 : 80304));
          setSoilError(null);
        } else if (!res.ok) {
          setSoilError(res.error || "Failed to load soil moisture records.");
        } else if (res.data?.error) {
          setSoilError(res.data.error);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setSoilError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!isCancelled) setSoilLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedStation, soilGrain, soilOffset, soilLimit, soilReloadKey]);

  // Fetch image records
  useEffect(() => {
    if (activeTab !== "images") return;
    let isCancelled = false;
    setImageLoading(true);
    setImageError(null);

    const url =
      imageSource === "edge"
        ? `/api/datasets/records?dataset=edge-images&limit=24${selectedImageClass ? `&label=${encodeURIComponent(selectedImageClass)}` : ""}`
        : `/api/datasets/records?dataset=plantvillage&variant=${pvVariant}&limit=24${selectedImageClass ? `&label=${encodeURIComponent(selectedImageClass)}` : ""}`;

    safeFetchJson<ApiRecordsEnvelope<ImageRecordItem>>(url)
      .then((res) => {
        if (isCancelled) return;
        if (res.ok && res.data?.status === "ready" && res.data?.data?.records) {
          setImageRecords(res.data.data.records);
          setImageError(null);
        } else if (!res.ok) {
          setImageError(res.error || "Failed to load specimen image archive.");
        } else if (res.data?.error) {
          setImageError(res.data.error);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setImageError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!isCancelled) setImageLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab, imageSource, pvVariant, selectedImageClass, imageReloadKey]);

  const { cropSummary, edgeSensorSummary, edgeImagesInventory, plantVillageInventory } = initialBundle;

  return (
    <div className="mt-10 space-y-6">
      {/* Disclaimer Banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
              <Info size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Dataset-Derived Demonstration & Integration Center
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-amber-800/90">
                These views display verified static Kaggle research datasets loaded via server-side streaming adapters.
                They are <strong>not live telemetry</strong> from a physical farm and <strong>do not control machinery</strong> or provide automated diagnoses.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Static Data Mode
          </span>
        </div>
      </div>

      {/* Dataset Sources Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {initialBundle.datasetStatuses.map((ds) => (
          <Card key={ds.id} className="flex flex-col justify-between p-4 transition-all hover:border-forest-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
                  <CheckCircle2 size={12} className="text-forest-600" />
                  Verified & Ready
                </span>
                <a
                  href={ds.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-700"
                  title="Source on Kaggle"
                  aria-label={`Source on Kaggle for ${ds.name}`}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-ink line-clamp-1">{ds.name}</h4>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{ds.assetCountDescription}</p>
            </div>
            <div className="mt-4 border-t border-[#edf0eb] pt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{ds.verifiedRecordsCount.toLocaleString("en-US")} items verified</span>
              <span>{ds.limitationsCount} limitations noted</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#dfe6dd] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("crop")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "crop"
              ? "bg-forest-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-forest-50 hover:text-forest-800"
          }`}
        >
          <Sprout size={16} />
          Crop Recommendation
          <span className="rounded-md bg-black/10 px-1.5 py-0.2 text-xs">2,200</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("edge-sensor")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "edge-sensor"
              ? "bg-forest-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-forest-50 hover:text-forest-800"
          }`}
        >
          <Activity size={16} />
          Edge Sensor Telemetry
          <span className="rounded-md bg-black/10 px-1.5 py-0.2 text-xs">2,000</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("soil-network")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "soil-network"
              ? "bg-forest-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-forest-50 hover:text-forest-800"
          }`}
        >
          <Waves size={16} />
          Soil Moisture Network
          <span className="rounded-md bg-black/10 px-1.5 py-0.2 text-xs">42 Stations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("images")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "images"
              ? "bg-forest-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-forest-50 hover:text-forest-800"
          }`}
        >
          <ImageIcon size={16} />
          Image Archives
          <span className="rounded-md bg-black/10 px-1.5 py-0.2 text-xs">163k+</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            activeTab === "audit"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          }`}
        >
          <ShieldAlert size={14} />
          Validation & Provenance Audit
        </button>
      </div>

      {/* TAB 1: CROP RECOMMENDATION */}
      {activeTab === "crop" && cropSummary && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Crop Soil & Environmental Parameters</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Descriptive summary across 2,200 records. Notice: Measurement units for N/P/K, temperature, humidity, and rainfall are not documented in source headers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  0 Missing Cells
                </span>
                <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  0 Duplicate Rows
                </span>
              </div>
            </div>

            {/* Metric Ranges Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Object.entries(cropSummary.fieldRanges).map(([field, range]) => (
                <div key={field} className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{field}</span>
                  <div className="mt-1.5 text-base font-semibold text-forest-800">{range.mean}</div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Range: {range.min} – {range.max}
                  </div>
                </div>
              ))}
            </div>

            {/* Crop Categories Breakdown */}
            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                22 Balanced Crop Classes (100 Records Each)
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(cropSummary.classDistribution).map((crop) => (
                  <span
                    key={crop}
                    className="inline-flex items-center gap-1 rounded-md border border-[#e2e8df] bg-white px-2 py-0.5 text-xs text-slate-700"
                  >
                    <Leaf size={10} className="text-forest-600" />
                    {crop}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-xl border border-[#dfe6dd] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FileSpreadsheet size={16} className="text-forest-600" />
                Raw Source Records (Bounded Stream)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={cropOffset === 0 || cropLoading}
                  onClick={() => setCropOffset(Math.max(0, cropOffset - cropLimit))}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Previous page of crop records"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-slate-500">
                  Rows {cropOffset + 1}–{Math.min(cropOffset + cropLimit, cropTotal)} of {cropTotal}
                </span>
                <button
                  type="button"
                  disabled={cropOffset + cropLimit >= cropTotal || cropLoading}
                  onClick={() => setCropOffset(cropOffset + cropLimit)}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Next page of crop records"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f8f6] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Row #</th>
                    <th className="px-4 py-2.5">N</th>
                    <th className="px-4 py-2.5">P</th>
                    <th className="px-4 py-2.5">K</th>
                    <th className="px-4 py-2.5">Temperature</th>
                    <th className="px-4 py-2.5">Humidity</th>
                    <th className="px-4 py-2.5">pH</th>
                    <th className="px-4 py-2.5">Rainfall</th>
                    <th className="px-4 py-2.5">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {cropLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Streaming records from server...
                      </td>
                    </tr>
                  ) : cropError && cropRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-amber-800">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-xs font-semibold">Unable to load crop recommendation records</p>
                          <p className="max-w-md text-[11px] text-slate-500">{cropError}</p>
                          <button
                            type="button"
                            onClick={() => setCropReloadKey((k) => k + 1)}
                            className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            Retry Request
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : cropRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No crop records available.
                      </td>
                    </tr>
                  ) : (
                    cropRecords.map((r) => {
                      const p = r.payload;
                      return (
                        <tr key={r.reference.recordNumber} className="hover:bg-[#fafbf9]">
                          <td className="px-4 py-2 font-mono text-slate-400">#{r.reference.recordNumber}</td>
                          <td className="px-4 py-2 text-ink">{p.N.value}</td>
                          <td className="px-4 py-2 text-ink">{p.P.value}</td>
                          <td className="px-4 py-2 text-ink">{p.K.value}</td>
                          <td className="px-4 py-2 text-ink">{p.temperature.value?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-ink">{p.humidity.value?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-ink">{p.ph.value?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-ink">{p.rainfall.value?.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex rounded bg-forest-50 px-2 py-0.5 text-[11px] font-medium text-forest-700">
                              {p.label.value}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EDGE SENSOR TELEMETRY */}
      {activeTab === "edge-sensor" && edgeSensorSummary && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Edge Sensor Telemetry Parameters</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Coverage: {edgeSensorSummary.dateRange.start} to {edgeSensorSummary.dateRange.end} (hourly).
                  Notice: Only <code>5G_Latency_ms</code> has a stated unit in source headers. Other units remain unassigned.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  2,000 Hourly Observations
                </span>
                <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  0 Missing Values
                </span>
              </div>
            </div>

            {/* Health Labels Breakdown */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-xs font-bold uppercase tracking-wider">Healthy</span>
                  <CheckCircle2 size={16} />
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-900">
                  {edgeSensorSummary.cropHealthDistribution.Healthy}
                </div>
                <div className="mt-1 text-[11px] text-emerald-700">
                  33.95% of records • Categorical source label
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center justify-between text-amber-800">
                  <span className="text-xs font-bold uppercase tracking-wider">Moderate Stress</span>
                  <AlertTriangle size={16} />
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-900">
                  {edgeSensorSummary.cropHealthDistribution.Moderate_Stress}
                </div>
                <div className="mt-1 text-[11px] text-amber-700">
                  31.65% of records • Not clinical diagnosis
                </div>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex items-center justify-between text-rose-800">
                  <span className="text-xs font-bold uppercase tracking-wider">High Stress</span>
                  <ShieldAlert size={16} />
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-900">
                  {edgeSensorSummary.cropHealthDistribution.High_Stress}
                </div>
                <div className="mt-1 text-[11px] text-rose-700">
                  34.40% of records • Research label
                </div>
              </div>
            </div>

            {/* Averages */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Soil Moisture</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.soilMoisture}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Soil Temp</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.soilTemperature}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Soil pH</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.soilPh}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Humidity</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.humidity}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Air Temp</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.airTemperature}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Solar Rad</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.solarRadiation}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Wind Speed</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.fieldAverages.windSpeed}</div>
              </div>
              <div className="rounded-lg border border-[#edf0eb] bg-[#fafbf9] p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">5G Latency</span>
                <div className="mt-1 text-sm font-semibold text-ink">{edgeSensorSummary.averageLatencyMs} ms</div>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-xl border border-[#dfe6dd] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FileSpreadsheet size={16} className="text-forest-600" />
                Edge Sensor Historical Records
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={edgeOffset === 0 || edgeLoading}
                  onClick={() => setEdgeOffset(Math.max(0, edgeOffset - edgeLimit))}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Previous page of edge sensor records"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-slate-500">
                  Rows {edgeOffset + 1}–{Math.min(edgeOffset + edgeLimit, edgeTotal)} of {edgeTotal}
                </span>
                <button
                  type="button"
                  disabled={edgeOffset + edgeLimit >= edgeTotal || edgeLoading}
                  onClick={() => setEdgeOffset(edgeOffset + edgeLimit)}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Next page of edge sensor records"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f8f6] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Moisture</th>
                    <th className="px-4 py-2.5">Soil Temp</th>
                    <th className="px-4 py-2.5">pH</th>
                    <th className="px-4 py-2.5">Humidity</th>
                    <th className="px-4 py-2.5">Air Temp</th>
                    <th className="px-4 py-2.5">NDVI</th>
                    <th className="px-4 py-2.5">Latency</th>
                    <th className="px-4 py-2.5">Crop Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {edgeLoading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        Streaming records...
                      </td>
                    </tr>
                  ) : edgeError && edgeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-amber-800">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-xs font-semibold">Unable to load edge sensor records</p>
                          <p className="max-w-md text-[11px] text-slate-500">{edgeError}</p>
                          <button
                            type="button"
                            onClick={() => setEdgeReloadKey((k) => k + 1)}
                            className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            Retry Request
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : edgeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No sensor records available.
                      </td>
                    </tr>
                  ) : (
                    edgeRecords.map((r) => {
                      const p = r.payload;
                      const health = p.cropHealth.value;
                      const badgeClass =
                        health === "Healthy"
                          ? "bg-emerald-50 text-emerald-800"
                          : health === "Moderate_Stress"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-rose-50 text-rose-800";

                      return (
                        <tr key={r.reference.recordNumber} className="hover:bg-[#fafbf9]">
                          <td className="px-4 py-2 font-mono text-slate-400">#{p.recordId.value}</td>
                          <td className="px-4 py-2 font-mono text-slate-600">{p.timestamp.value}</td>
                          <td className="px-4 py-2 text-ink">{p.soilMoisture.value}</td>
                          <td className="px-4 py-2 text-ink">{p.soilTemperature.value}</td>
                          <td className="px-4 py-2 text-ink">{p.soilPh.value}</td>
                          <td className="px-4 py-2 text-ink">{p.humidity.value}</td>
                          <td className="px-4 py-2 text-ink">{p.airTemperature.value}</td>
                          <td className="px-4 py-2 text-ink">{p.ndviIndex.value}</td>
                          <td className="px-4 py-2 text-ink">{p.latencyMs5G.value} ms</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                              {health}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SOIL MOISTURE NETWORK */}
      {activeTab === "soil-network" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Field Scale Sensor Network (42 Stations)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a station and granularity (Daily vs Hourly). Notice: VW and T measurement units and geographic station coordinates remain undocumented. Missing sensor readings (NA) are preserved without imputation.
                </p>
              </div>

              {/* Station & Grain Selector Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg border border-[#dfe6dd] bg-slate-50 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setSoilGrain("daily");
                      setSoilOffset(0);
                    }}
                    className={`rounded-md px-3 py-1.5 transition-all ${
                      soilGrain === "daily" ? "bg-white text-forest-800 shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    Daily (140.5k rows)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSoilGrain("hourly");
                      setSoilOffset(0);
                    }}
                    className={`rounded-md px-3 py-1.5 transition-all ${
                      soilGrain === "hourly" ? "bg-white text-forest-800 shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    Hourly (3.37M rows)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Station:</span>
                  <select
                    value={selectedStation}
                    onChange={(e) => {
                      setSelectedStation(e.target.value);
                      setSoilOffset(0);
                    }}
                    className="rounded-lg border border-[#dfe6dd] bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm"
                  >
                    {initialBundle.stations.map((st) => (
                      <option key={st} value={st}>
                        {st} {st === "CAF201" ? "(Anomaly documented)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* CAF201 Anomaly Notice */}
            {selectedStation === "CAF201" && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <strong>CAF201 Trailing Anomaly Notice:</strong> Hourly file contains 890 trailing all-missing records (889 duplicates of the first) where Location is retained but date, time, and measurements are NA. These records are preserved unchanged in raw storage and reported by our validation adapter.
                  </div>
                </div>
              </div>
            )}

            {/* Depth Columns Schema & Missingness Overview */}
            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Depth Sensors (30cm – 150cm) • Daily Station Sample (CAF003)
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {["VW_30cm", "VW_60cm", "VW_90cm", "VW_120cm", "VW_150cm"].map((d) => (
                  <div key={d} className="rounded-md border border-[#edf0eb] bg-[#fafbf9] p-2 text-center text-xs">
                    <span className="font-semibold text-sky-800">{d}</span>
                    <div className="mt-1 text-[11px] text-slate-500">Volumetric Sensor</div>
                  </div>
                ))}
                {["T_30cm", "T_60cm", "T_90cm", "T_120cm", "T_150cm"].map((d) => (
                  <div key={d} className="rounded-md border border-[#edf0eb] bg-[#fafbf9] p-2 text-center text-xs">
                    <span className="font-semibold text-amber-800">{d}</span>
                    <div className="mt-1 text-[11px] text-slate-500">Temperature Sensor</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="rounded-xl border border-[#dfe6dd] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FileSpreadsheet size={16} className="text-forest-600" />
                Station {selectedStation} Records ({soilGrain.toUpperCase()})
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={soilOffset === 0 || soilLoading}
                  onClick={() => setSoilOffset(Math.max(0, soilOffset - soilLimit))}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Previous page of soil records"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-slate-500">
                  Rows {soilOffset + 1}–{Math.min(soilOffset + soilLimit, soilTotal)} of {soilTotal}
                </span>
                <button
                  type="button"
                  disabled={soilOffset + soilLimit >= soilTotal || soilLoading}
                  onClick={() => setSoilOffset(soilOffset + soilLimit)}
                  className="rounded-lg border border-[#dfe6dd] p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  aria-label="Next page of soil records"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f7f8f6] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Row</th>
                    <th className="px-3 py-2.5">Station</th>
                    <th className="px-3 py-2.5">Date</th>
                    {soilGrain === "hourly" && <th className="px-3 py-2.5">Time</th>}
                    <th className="px-3 py-2.5">VW 30cm</th>
                    <th className="px-3 py-2.5">VW 60cm</th>
                    <th className="px-3 py-2.5">VW 90cm</th>
                    <th className="px-3 py-2.5">VW 120cm</th>
                    <th className="px-3 py-2.5">VW 150cm</th>
                    <th className="px-3 py-2.5">T 30cm</th>
                    <th className="px-3 py-2.5">T 60cm</th>
                    <th className="px-3 py-2.5">T 90cm</th>
                    <th className="px-3 py-2.5">T 120cm</th>
                    <th className="px-3 py-2.5">T 150cm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {soilLoading ? (
                    <tr>
                      <td colSpan={soilGrain === "hourly" ? 14 : 13} className="py-8 text-center text-slate-400">
                        Streaming station records...
                      </td>
                    </tr>
                  ) : soilError && soilRecords.length === 0 ? (
                    <tr>
                      <td colSpan={soilGrain === "hourly" ? 14 : 13} className="py-8 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-amber-800">
                          <AlertTriangle size={20} className="text-amber-600" />
                          <p className="text-xs font-semibold">Unable to load soil sensor records</p>
                          <p className="max-w-md text-[11px] text-slate-500">{soilError}</p>
                          <button
                            type="button"
                            onClick={() => setSoilReloadKey((k) => k + 1)}
                            className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            Retry Request
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : soilRecords.length === 0 ? (
                    <tr>
                      <td colSpan={soilGrain === "hourly" ? 14 : 13} className="py-8 text-center text-slate-400">
                        No soil records available for station {selectedStation}.
                      </td>
                    </tr>
                  ) : (
                    soilRecords.map((r) => {
                      const p = r.payload;
                      const renderVal = (v?: DatasetValue<number>) =>
                        !v || v.status === "missing" ? (
                          <span className="font-mono text-[10px] text-rose-400">NA</span>
                        ) : (
                          <span className="font-mono text-ink">{v.value}</span>
                        );

                      return (
                        <tr key={r.reference.recordNumber} className="hover:bg-[#fafbf9]">
                          <td className="px-3 py-2 font-mono text-slate-400">#{r.reference.recordNumber}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{p.location?.value}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{p.date?.value}</td>
                          {soilGrain === "hourly" && "time" in p && (
                            <td className="px-3 py-2 font-mono text-slate-700">{p.time?.value}</td>
                          )}
                          <td className="px-3 py-2">{renderVal(p.vw30cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.vw60cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.vw90cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.vw120cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.vw150cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.t30cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.t60cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.t90cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.t120cm)}</td>
                          <td className="px-3 py-2">{renderVal(p.t150cm)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: IMAGE ARCHIVES */}
      {activeTab === "images" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Agricultural & Leaf Specimen Archives</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Secure streaming thumbnail preview without exposing raw filesystem directories.
                  Notice: Folder names are source directory labels, not confirmed AI diagnostic predictions.
                </p>
              </div>

              {/* Source Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-[#dfe6dd] bg-slate-50 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setImageSource("edge");
                      setSelectedImageClass("");
                    }}
                    className={`rounded-md px-3 py-1.5 transition-all ${
                      imageSource === "edge" ? "bg-white text-forest-800 shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    Edge Images (829 images, 30 crops)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageSource("plantvillage");
                      setSelectedImageClass("");
                    }}
                    className={`rounded-md px-3 py-1.5 transition-all ${
                      imageSource === "plantvillage" ? "bg-white text-forest-800 shadow-sm" : "text-slate-600 hover:text-ink"
                    }`}
                  >
                    PlantVillage (162.9k images, 38 classes)
                  </button>
                </div>

                {imageSource === "plantvillage" && (
                  <div className="flex items-center rounded-lg border border-[#dfe6dd] bg-slate-50 p-1 text-xs font-semibold">
                    {(["color", "grayscale", "segmented"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPvVariant(v)}
                        className={`rounded-md px-2.5 py-1.5 capitalize transition-all ${
                          pvVariant === v ? "bg-forest-700 text-white shadow-sm" : "text-slate-600 hover:text-ink"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Class Filter */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filter Category:</span>
              <select
                value={selectedImageClass}
                onChange={(e) => setSelectedImageClass(e.target.value)}
                className="max-w-xs truncate rounded-lg border border-[#dfe6dd] bg-white px-3 py-1.5 text-xs text-ink shadow-sm"
              >
                <option value="">All Categories</option>
                {imageSource === "edge" &&
                  edgeImagesInventory?.directories.map((d) => (
                    <option key={d.label} value={d.label}>
                      {d.label} ({d.imageCount} imgs)
                    </option>
                  ))}
                {imageSource === "plantvillage" &&
                  plantVillageInventory?.classes.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.plantName} — {c.conditionLabel}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Specimen Gallery Grid */}
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">
                Bounded Specimen Preview ({imageRecords.length} loaded)
              </span>
              <span className="text-xs text-slate-400">
                Served securely via API route • Read-only
              </span>
            </div>

            {imageLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Loading specimen thumbnails...
              </div>
            ) : imageError && imageRecords.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-amber-800">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <p className="text-xs font-semibold">Unable to load specimen image archive</p>
                  <p className="max-w-md text-[11px] text-slate-500">{imageError}</p>
                  <button
                    type="button"
                    onClick={() => setImageReloadKey((k) => k + 1)}
                    className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Retry Request
                  </button>
                </div>
              </div>
            ) : imageRecords.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No images available for this selection.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {imageRecords.map((r) => {
                  const p = r.payload;
                  const imgSrc =
                    imageSource === "edge"
                      ? `/api/datasets/image?source=edge&path=${encodeURIComponent(p.relativePath)}`
                      : `/api/datasets/image?source=plantvillage&path=${encodeURIComponent(p.relativePath)}`;

                  const title =
                    imageSource === "edge"
                      ? p.directoryLabel ?? "Specimen"
                      : `${p.plantName ?? "Plant"} (${p.conditionLabel ?? "Specimen"})`;
                  const meta = `${(p.byteSize / 1024).toFixed(1)} KB • ${p.extension}`;

                  return (
                    <div
                      key={r.reference.path + r.reference.recordNumber}
                      onClick={() => setPreviewModalImg({ src: imgSrc, title, meta })}
                      className="group cursor-pointer overflow-hidden rounded-xl border border-[#edf0eb] bg-[#fafbf9] transition-all hover:border-forest-600 hover:shadow-md"
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgSrc}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-xs font-semibold text-ink" title={title}>
                          {title}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400 font-mono">
                          {p.fileName}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Preview */}
          {previewModalImg && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setPreviewModalImg(null)}
            >
              <div
                className="max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
                  <h4 className="text-sm font-bold text-ink">{previewModalImg.title}</h4>
                  <button
                    type="button"
                    onClick={() => setPreviewModalImg(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-4 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewModalImg.src}
                    alt={previewModalImg.title}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500 font-mono">{previewModalImg.meta}</p>
                <p className="mt-1 text-[11px] text-amber-700">
                  Notice: Specimen display for research dataset inspection only. No diagnosis or health status is asserted.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT & PROVENANCE */}
      {activeTab === "audit" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[#dfe6dd] bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-ink">Dataset Integration & Validation Findings</h3>
            <p className="mt-1 text-xs text-slate-500">
              Complete audit log based on the verified dataset inspection report (docs/datasets/README.md) and server adapter executions.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#edf0eb] bg-[#fafbf9] p-4">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Crop Recommendation Dataset (CSV)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                  <li>2,200 records parsed with 0 missing cells and 0 duplicate rows.</li>
                  <li>22 crop classes with exactly 100 observations each (balanced distribution).</li>
                  <li>Limitation: Measurement units for N, P, K, temperature, humidity, and rainfall are not documented in source headers.</li>
                  <li>No predictive ML recommendation model is attached in this advisory demonstration.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#edf0eb] bg-[#fafbf9] p-4">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Edge Assisted Agricultural Sensor Dataset (CSV & Images)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                  <li>2,000 hourly observations parsed from 2024-01-01 00:00:00 to 2024-03-24 07:00:00 (timezone unspecified).</li>
                  <li>Crop_Health distribution: Healthy (679), Moderate_Stress (633), High_Stress (688).</li>
                  <li>Limitation: Only 5G_Latency_ms carries a stated measurement unit (ms). Other sensor units remain unresolved.</li>
                  <li>Separate image tree contains 829 crop photos across 30 directories; no foreign key manifest links images to CSV rows.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#edf0eb] bg-[#fafbf9] p-4">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  PlantVillage Dataset (Color, Grayscale, Segmented)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                  <li>162,916 total images across 3 variants (54,305 color, 54,305 grayscale, 54,306 segmented) and 38 classes.</li>
                  <li>Documented anomaly: Segmented Grape___Esca_(Black_Measles) has 1,384 files vs 1,383 in color/grayscale.</li>
                  <li>Limitation: Directory names are source labels, not clinical plant pathology diagnoses.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#edf0eb] bg-[#fafbf9] p-4">
                <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Soil Moisture Data from Field Scale Sensor Network (Daily & Hourly)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
                  <li>42 station tab-delimited files per grain (CAF003 to CAF401).</li>
                  <li>Daily: 140,532 rows, 645,405 missing measurement cells (NA).</li>
                  <li>Hourly: 3,373,658 rows, 15,648,564 missing cells (NA). Memory-bounded streaming prevents out-of-memory errors.</li>
                  <li>Documented anomaly: Hourly/CAF201.txt contains 890 trailing all-missing records (889 duplicates of the first) preserved in raw data.</li>
                  <li>Limitation: VW and T measurement units and geographic station coordinates are not defined in raw headers.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
