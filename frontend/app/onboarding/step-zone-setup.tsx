"use client";

import React, { useState } from "react";
import { Layers, Plus, Trash2, AlertCircle, CheckCircle2, Sprout } from "lucide-react";

export interface ZoneConfigItem {
  id: string;
  name: string;
  crop: string;
  area: number;
  soilType?: string;
  irrigationType?: string;
}

interface StepZoneSetupProps {
  totalFarmArea: number;
  areaUnit: "acres" | "hectares";
  primaryCrop: string;
  secondaryCrops: string[];
  zones: ZoneConfigItem[];
  onChange: (zones: ZoneConfigItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const COMMON_CROPS = [
  "Wheat",
  "Cotton",
  "Rice",
  "Maize",
  "Vegetables",
  "Mustard",
  "Soybean",
  "Sugarcane",
  "Chickpea (Gram)",
  "Tomato",
  "Onion",
  "Potato",
  "Other",
];

const SOIL_TYPES = [
  "Loamy Soil",
  "Clay Loam",
  "Black Cotton Soil",
  "Sandy Soil",
  "Red Soil",
  "Alluvial Soil",
];

const IRRIGATION_TYPES = ["Drip", "Sprinkler", "Flood / Furrow", "Rainfed"];

export function StepZoneSetup({
  totalFarmArea,
  areaUnit,
  primaryCrop,
  secondaryCrops,
  zones,
  onChange,
  onNext,
  onBack,
}: StepZoneSetupProps) {
  // Available crop options
  const cropOptions = Array.from(
    new Set([primaryCrop, ...secondaryCrops, ...COMMON_CROPS].filter(Boolean))
  );

  // Quick set zone count (1..5)
  const handleSetZoneCount = (count: number) => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const perZone = Math.round((totalFarmArea / count) * 10) / 10;
    const newZones: ZoneConfigItem[] = [];

    for (let i = 0; i < count; i++) {
      const letter = letters[i] || `${i + 1}`;
      newZones.push({
        id: `zone-${letter.toLowerCase()}-${Date.now()}-${i}`,
        name: `Zone ${letter}`,
        crop: i === 0 ? primaryCrop : secondaryCrops[i - 1] || primaryCrop,
        area: i === count - 1 ? Math.round((totalFarmArea - perZone * (count - 1)) * 10) / 10 : perZone,
        soilType: "Loamy Soil",
        irrigationType: "Drip",
      });
    }
    onChange(newZones);
  };

  // Add individual zone
  const handleAddZone = () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const letter = letters[zones.length] || `${zones.length + 1}`;
    const allocated = zones.reduce((sum, z) => sum + (z.area || 0), 0);
    const remaining = Math.max(0, Math.round((totalFarmArea - allocated) * 10) / 10);

    onChange([
      ...zones,
      {
        id: `zone-${letter.toLowerCase()}-${Date.now()}`,
        name: `Zone ${letter}`,
        crop: primaryCrop,
        area: remaining > 0 ? remaining : 1.0,
        soilType: "Loamy Soil",
        irrigationType: "Drip",
      },
    ]);
  };

  // Remove zone
  const handleRemoveZone = (id: string) => {
    if (zones.length <= 1) return;
    onChange(zones.filter((z) => z.id !== id));
  };

  // Update zone property
  const handleUpdateZone = (id: string, updates: Partial<ZoneConfigItem>) => {
    onChange(zones.map((z) => (z.id === id ? { ...z, ...updates } : z)));
  };

  // Area allocation metrics
  const totalAllocated = Math.round(zones.reduce((sum, z) => sum + (z.area || 0), 0) * 10) / 10;
  const remaining = Math.round((totalFarmArea - totalAllocated) * 10) / 10;
  const isOverAllocated = totalAllocated > totalFarmArea;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverAllocated) return;
    if (zones.length === 0) return;
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Layers size={14} className="text-emerald-600" />
          <span>Step 5 of 6 • Zone Setup</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Divide your farm into zones 🌾
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Zones help FarmOps AI monitor different parts of your farm separately.
        </p>
      </div>

      {/* Main Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Quick Zone Count Picker */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            How many zones do you want?
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => handleSetZoneCount(num)}
                className={`w-11 h-11 rounded-2xl font-extrabold text-sm transition-all cursor-pointer ${
                  zones.length === num
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20 ring-2 ring-emerald-500/30"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleAddZone}
              className="px-3.5 py-2.5 rounded-2xl border border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-xs font-bold text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Zone</span>
            </button>
          </div>
        </div>

        {/* Live Area Allocation Tracker Banner */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isOverAllocated
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-[#f8faf7] border-emerald-200/80 text-slate-800"
          }`}
        >
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Farm Area
              </span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block">
                {totalFarmArea} {areaUnit}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Allocated to Zones
              </span>
              <span
                className={`text-sm font-black mt-0.5 block ${
                  isOverAllocated ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {totalAllocated} {areaUnit}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Remaining Area
              </span>
              <span
                className={`text-sm font-black mt-0.5 block ${
                  remaining < 0 ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {remaining} {areaUnit}
              </span>
            </div>
          </div>

          {isOverAllocated && (
            <div className="mt-2 text-xs text-rose-700 flex items-center justify-center gap-1.5 font-semibold">
              <AlertCircle size={14} />
              <span>Total zone area exceeds total farm area! Please adjust zone sizes.</span>
            </div>
          )}
        </div>

        {/* Zones List */}
        <div className="space-y-4">
          {zones.map((zone, index) => (
            <div
              key={zone.id}
              className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px]">
                    {index + 1}
                  </span>
                  <span>{zone.name}</span>
                </span>
                {zones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveZone(zone.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Remove Zone"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Zone Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Zone Name
                  </label>
                  <input
                    type="text"
                    required
                    value={zone.name}
                    onChange={(e) => handleUpdateZone(zone.id, { name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Crop */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Crop
                  </label>
                  <select
                    value={zone.crop}
                    onChange={(e) => handleUpdateZone(zone.id, { crop: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-white"
                  >
                    {cropOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Approximate Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Approximate Area ({areaUnit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={zone.area}
                    onChange={(e) =>
                      handleUpdateZone(zone.id, { area: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Soil Type (Optional) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Soil Type <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={zone.soilType || ""}
                    onChange={(e) => handleUpdateZone(zone.id, { soilType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-white"
                  >
                    {SOIL_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Irrigation Type (Optional) */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Irrigation Type <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={zone.irrigationType || ""}
                    onChange={(e) => handleUpdateZone(zone.id, { irrigationType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-white"
                  >
                    {IRRIGATION_TYPES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddZone}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Add Another Zone</span>
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={isOverAllocated || zones.length === 0}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue →</span>
          </button>
        </div>
      </form>
    </div>
  );
}
