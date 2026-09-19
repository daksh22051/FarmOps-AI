"use client";

import React, { useState } from "react";
import { Maximize2, Sparkles, Check, HelpCircle } from "lucide-react";

export interface FarmSizeData {
  area: number;
  areaUnit: "acres" | "hectares";
  addBoundaryLater: boolean;
}

interface StepFarmSizeProps {
  data: FarmSizeData;
  onChange: (data: Partial<FarmSizeData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepFarmSize({ data, onChange, onNext, onBack }: StepFarmSizeProps) {
  const [areaInput, setAreaInput] = useState(data.area ? String(data.area) : "5.2");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Conversion calculations
  const numArea = parseFloat(areaInput) || 0;
  const convertedArea =
    data.areaUnit === "acres"
      ? (numArea / 2.47105).toFixed(2) // in hectares
      : (numArea * 2.47105).toFixed(2); // in acres

  const handleAreaChange = (val: string) => {
    setAreaInput(val);
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg("Farm area must be greater than 0.");
    } else if (parsed > 50000) {
      setErrorMsg("Please enter a realistic farm area (maximum 50,000).");
    } else {
      setErrorMsg(null);
      onChange({ area: parsed });
    }
  };

  const handleUnitToggle = (newUnit: "acres" | "hectares") => {
    if (newUnit === data.areaUnit) return;
    const currentNum = parseFloat(areaInput) || 0;
    const converted =
      newUnit === "acres"
        ? Math.round(currentNum * 2.47105 * 10) / 10
        : Math.round((currentNum / 2.47105) * 10) / 10;

    setAreaInput(String(converted));
    onChange({ area: converted, areaUnit: newUnit });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(areaInput);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg("Please enter a valid farm area greater than 0.");
      return;
    }
    onChange({ area: parsed });
    onNext();
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Maximize2 size={14} className="text-emerald-600" />
          <span>Step 4 of 6 • Farm Size</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How large is your farm? 📐
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          You can enter the approximate farm area. Exact boundary mapping is optional.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Farm Area Input with Unit Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Farm Area <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={areaInput}
              onChange={(e) => handleAreaChange(e.target.value)}
              placeholder="e.g. 5.2"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-lg font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => handleUnitToggle("acres")}
                className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  data.areaUnit === "acres"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Acres
              </button>
              <button
                type="button"
                onClick={() => handleUnitToggle("hectares")}
                className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  data.areaUnit === "hectares"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hectares
              </button>
            </div>
          </div>

          {errorMsg ? (
            <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>
          ) : (
            <p className="text-xs text-slate-500 font-medium">
              ≈ <strong>{convertedArea}</strong> {data.areaUnit === "acres" ? "Hectares" : "Acres"} (automatic conversion)
            </p>
          )}
        </div>

        {/* Boundary Option: Add Farm Boundary Later */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
            <Check size={16} strokeWidth={3} />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-emerald-950 block">
              Exact Boundary is Optional
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              For now, entering your approximate area is sufficient. You can draw exact field boundaries from your dashboard anytime.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                <span>✓</span> Add Farm Boundary Later
              </span>
            </div>
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
            disabled={!numArea || numArea <= 0}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue →</span>
          </button>
        </div>
      </form>
    </div>
  );
}
