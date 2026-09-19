"use client";

import React, { useState } from "react";
import { Building2, Sprout, Plus, X, Sparkles } from "lucide-react";

export interface FarmDetailsData {
  farmName: string;
  farmType: "Crop Farm" | "Orchard" | "Vegetable Farm" | "Mixed Farming" | "Other";
  primaryCrop: string;
  secondaryCrops: string[];
}

interface StepFarmDetailsProps {
  data: FarmDetailsData;
  onChange: (data: Partial<FarmDetailsData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const FARM_TYPES = [
  { id: "Crop Farm" as const, label: "Crop Farm", emoji: "🌾" },
  { id: "Orchard" as const, label: "Orchard", emoji: "🍎" },
  { id: "Vegetable Farm" as const, label: "Vegetable Farm", emoji: "🥦" },
  { id: "Mixed Farming" as const, label: "Mixed Farming", emoji: "🚜" },
  { id: "Other" as const, label: "Other", emoji: "🌱" },
];

const PRIMARY_CROPS = [
  { name: "Wheat", emoji: "🌾" },
  { name: "Cotton", emoji: "🌿" },
  { name: "Rice", emoji: "🌾" },
  { name: "Maize", emoji: "🌽" },
  { name: "Vegetables", emoji: "🥕" },
  { name: "Other", emoji: "🌱" },
];

const SECONDARY_CROP_OPTIONS = [
  "Mustard",
  "Soybean",
  "Sugarcane",
  "Chickpea (Gram)",
  "Tomato",
  "Onion",
  "Groundnut",
  "Potato",
];

export function StepFarmDetails({ data, onChange, onNext, onBack }: StepFarmDetailsProps) {
  const [customSecondary, setCustomSecondary] = useState("");

  const toggleSecondaryCrop = (crop: string) => {
    if (data.secondaryCrops.includes(crop)) {
      onChange({ secondaryCrops: data.secondaryCrops.filter((c) => c !== crop) });
    } else {
      onChange({ secondaryCrops: [...data.secondaryCrops, crop] });
    }
  };

  const handleAddCustomSecondary = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSecondary.trim();
    if (trimmed && !data.secondaryCrops.includes(trimmed)) {
      onChange({ secondaryCrops: [...data.secondaryCrops, trimmed] });
      setCustomSecondary("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.farmName.trim() || !data.farmType || !data.primaryCrop) return;
    onNext();
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Sprout size={14} className="text-emerald-600" />
          <span>Step 2 of 6 • Farm Details</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Tell us about your farm 🚜
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Specify your farm name, operational type, and the crops you cultivate.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Farm Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Farm Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Building2 size={18} />
            </div>
            <input
              type="text"
              required
              value={data.farmName}
              onChange={(e) => onChange({ farmName: e.target.value })}
              placeholder="e.g. Green Valley Farm"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Farm Type */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Farm Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FARM_TYPES.map((type) => {
              const isSelected = data.farmType === type.id;
              return (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => onChange({ farmType: type.id })}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 bg-white"
                  }`}
                >
                  <span>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Crop */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Primary Crop <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRIMARY_CROPS.map((crop) => {
              const isSelected = data.primaryCrop === crop.name;
              return (
                <button
                  type="button"
                  key={crop.name}
                  onClick={() => onChange({ primaryCrop: crop.name })}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 bg-white"
                  }`}
                >
                  <span>{crop.emoji}</span>
                  <span>{crop.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional: Secondary Crops */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Secondary Crops <span className="text-slate-400 font-normal normal-case">(Optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SECONDARY_CROP_OPTIONS.filter((c) => c !== data.primaryCrop).map((crop) => {
              const isSelected = data.secondaryCrops.includes(crop);
              return (
                <button
                  type="button"
                  key={crop}
                  onClick={() => toggleSecondaryCrop(crop)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-800"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <span>{crop}</span>
                  {isSelected && <X size={12} className="text-emerald-700" />}
                </button>
              );
            })}
          </div>

          {/* Add custom secondary crop */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customSecondary}
              onChange={(e) => setCustomSecondary(e.target.value)}
              placeholder="Add other crop (e.g. Barley)"
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddCustomSecondary}
              disabled={!customSecondary.trim()}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
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
            disabled={!data.farmName.trim() || !data.farmType || !data.primaryCrop}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue →</span>
          </button>
        </div>
      </form>
    </div>
  );
}
