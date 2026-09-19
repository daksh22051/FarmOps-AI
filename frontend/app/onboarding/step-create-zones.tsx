"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Layers, Plus, Trash2, Sprout, Check, MapPin } from "lucide-react";
import {
  slicePolygonIntoZones,
  getPolygonCentroid,
  pointsToSvgString,
  type Point,
} from "../../lib/gis/polygon-slice";

export interface ZoneItem {
  id: string;
  name: string;
  crop: string;
  areaHa: number;
  percentage: number;
  soilType: string;
  irrigation: "Drip" | "Sprinkler" | "Flood / Furrow" | "Rainfed";
  points?: Point[];
}

interface StepCreateZonesProps {
  totalFarmAreaHa: number;
  selectedCrops: string[];
  boundaryPoints: Point[];
  zones: ZoneItem[];
  onChange: (zones: ZoneItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SOIL_TYPES = [
  "Loamy Soil (Ideal)",
  "Clay Loam",
  "Black Cotton Soil (Regur)",
  "Sandy Loam",
  "Alluvial Soil",
  "Red & Yellow Soil",
];

const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Flood / Furrow", "Rainfed"] as const;

const ZONE_COLORS = [
  { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.32)", text: "text-emerald-300", badge: "border-emerald-400/40" },
  { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.32)", text: "text-amber-300", badge: "border-amber-400/40" },
  { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.32)", text: "text-cyan-300", badge: "border-cyan-400/40" },
  { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.32)", text: "text-purple-300", badge: "border-purple-400/40" },
  { stroke: "#eab308", fill: "rgba(234, 179, 8, 0.32)", text: "text-yellow-300", badge: "border-yellow-400/40" },
];

export function StepCreateZones({
  totalFarmAreaHa,
  selectedCrops,
  boundaryPoints,
  zones,
  onChange,
  onNext,
  onBack,
}: StepCreateZonesProps) {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const fallbackCrop = selectedCrops[0] || "Wheat";

  // Compute sliced sub-polygons for each zone based on their areaHa ratios
  const zonePolygons = useMemo(() => {
    if (boundaryPoints.length < 3) return [];
    const ratios = zones.map((z) => Number(z.areaHa) || 1);
    return slicePolygonIntoZones(boundaryPoints, ratios);
  }, [boundaryPoints, zones]);

  const handleUpdateZone = (id: string, updates: Partial<ZoneItem>) => {
    const updated = zones.map((z) => (z.id === id ? { ...z, ...updates } : z));
    onChange(updated);
  };

  const handleAddZone = () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G"];
    const nextLetter = letters[zones.length] || `Z${zones.length + 1}`;
    const newCrop = selectedCrops[zones.length % selectedCrops.length] || fallbackCrop;
    const defaultHa = Math.round((totalFarmAreaHa / (zones.length + 1)) * 10) / 10;

    const newZone: ZoneItem = {
      id: `zone-${Date.now()}`,
      name: `Zone ${nextLetter}`,
      crop: newCrop,
      areaHa: defaultHa,
      percentage: Math.round(100 / (zones.length + 1)),
      soilType: "Loamy Soil (Ideal)",
      irrigation: "Drip",
    };

    onChange([...zones, newZone]);
  };

  const handleRemoveZone = (id: string) => {
    if (zones.length <= 1) return;
    onChange(zones.filter((z) => z.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (zones.length === 0) return;

    // Attach computed polygon points to each zone before advancing
    const zonesWithPolygons = zones.map((z, idx) => ({
      ...z,
      points: zonePolygons[idx] || [],
    }));
    onChange(zonesWithPolygons);
    onNext();
  };

  const totalAllocatedHa = zones.reduce((sum, z) => sum + Number(z.areaHa || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Layers size={14} className="text-emerald-600" />
          <span>Step 4 of 5 • Dynamic Zone Slicing</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Sub-Divide Your Farm into Zones 🌾
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Your drawn boundary is dynamically partitioned into precision management zones. Assign crops and irrigation methods to each sub-parcel.
        </p>
      </div>

      {/* Main Grid: Interactive Sliced Map Preview (Left) & Zone Settings (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Sliced Satellite Map (6 cols) */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="relative w-full h-[360px] sm:h-[420px] rounded-3xl overflow-hidden border-2 border-slate-300 shadow-md bg-slate-950 select-none">
            {/* Satellite Background */}
            <Image
              src="/farm_login_bg.jpg"
              alt="Satellite field background"
              fill
              className="object-cover object-center filter brightness-[0.88] contrast-[1.1]"
              priority
            />

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0f_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0f_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            {/* Dynamic Sliced Zones SVG */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-auto"
              viewBox="0 0 800 500"
              preserveAspectRatio="none"
            >
              {zones.map((zone, idx) => {
                const polyPoints = zonePolygons[idx] || [];
                if (polyPoints.length < 3) return null;
                const pointsStr = pointsToSvgString(polyPoints);
                const centroid = getPolygonCentroid(polyPoints);
                const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                const isHovered = hoveredZoneId === zone.id;

                return (
                  <g
                    key={zone.id}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseLeave={() => setHoveredZoneId(null)}
                  >
                    {/* Zone Sub-Polygon */}
                    <polygon
                      points={pointsStr}
                      fill={isHovered ? color.fill.replace("0.32", "0.55") : color.fill}
                      stroke={color.stroke}
                      strokeWidth={isHovered ? 4 : 3}
                      strokeLinejoin="round"
                      className="transition-all"
                    />

                    {/* Zone Centroid Badge */}
                    <foreignObject
                      x={Math.max(10, Math.min(680, centroid.x - 55))}
                      y={Math.max(10, Math.min(440, centroid.y - 25))}
                      width="110"
                      height="50"
                    >
                      <div
                        className={`flex flex-col items-center justify-center rounded-xl bg-black/75 backdrop-blur-xs px-2 py-1 text-center border shadow-md transition-transform ${
                          color.badge
                        } ${isHovered ? "scale-110 ring-2 ring-white/50" : ""}`}
                      >
                        <span className="text-[11px] font-black text-white truncate max-w-[95px]">
                          {zone.name}
                        </span>
                        <span className={`text-[9px] font-bold ${color.text} truncate max-w-[95px]`}>
                          {zone.crop} • {zone.areaHa} Ha
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Top Indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 text-xs text-white">
              <Layers size={13} className="text-emerald-400" />
              <span className="font-semibold">
                {zones.length} Zones Dynamically Sliced in Boundary
              </span>
            </div>
          </div>

          {/* Allocation Info Bar */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sprout size={16} className="text-emerald-600" />
              <span className="font-bold text-slate-800">
                Total Boundary: {totalFarmAreaHa} Ha
              </span>
            </div>
            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              Allocated: {Math.round(totalAllocatedHa * 10) / 10} Ha
            </span>
          </div>
        </div>

        {/* Right Column: Zone Controls Form (6 cols) */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 flex flex-col justify-between">
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {zones.map((zone, idx) => {
                const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                const isHovered = hoveredZoneId === zone.id;

                return (
                  <div
                    key={zone.id}
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseLeave={() => setHoveredZoneId(null)}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                      isHovered
                        ? "border-emerald-500 ring-2 ring-emerald-500/15 shadow-sm"
                        : "border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    {/* Zone Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: color.stroke }}
                        >
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          value={zone.name}
                          onChange={(e) => handleUpdateZone(zone.id, { name: e.target.value })}
                          className="font-extrabold text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none transition-colors"
                        />
                      </div>

                      {zones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(zone.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove zone"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Zone Inputs Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {/* Crop */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Crop
                        </label>
                        <select
                          value={zone.crop}
                          onChange={(e) => handleUpdateZone(zone.id, { crop: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
                        >
                          {selectedCrops.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="Fallow / Resting">Fallow / Resting</option>
                        </select>
                      </div>

                      {/* Area */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Area (Ha)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                            value={zone.areaHa}
                            onChange={(e) =>
                              handleUpdateZone(zone.id, {
                                areaHa: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            Ha
                          </span>
                        </div>
                      </div>

                      {/* Soil Type */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Soil
                        </label>
                        <select
                          value={zone.soilType}
                          onChange={(e) => handleUpdateZone(zone.id, { soilType: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
                        >
                          {SOIL_TYPES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Irrigation */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Irrigation
                        </label>
                        <select
                          value={zone.irrigation}
                          onChange={(e) =>
                            handleUpdateZone(zone.id, {
                              irrigation: e.target.value as ZoneItem["irrigation"],
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-xs"
                        >
                          {IRRIGATION_TYPES.map((it) => (
                            <option key={it} value={it}>
                              {it}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Zone Button */}
            <button
              type="button"
              onClick={handleAddZone}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Another Zone</span>
            </button>

            {/* Navigation Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={zones.length === 0}
                className="flex-1 py-3 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <span>Review & Complete Setup</span>
                <span>→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
