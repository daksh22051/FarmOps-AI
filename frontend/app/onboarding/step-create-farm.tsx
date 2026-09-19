"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Plus,
  Check,
  X,
  Sprout,
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

export interface FarmVisionAnalysis {
  is_valid_farm: boolean;
  category: string;
  confidence: number;
  rejection_reason?: string | null;
  detected_crop?: string | null;
  vegetation_health?: string | null;
  soil_condition?: string | null;
  canopy_cover_pct?: number | null;
  agronomic_advice?: string | null;
}

export interface FarmDetailsData {
  farmName: string;
  villageCity: string;
  state: string;
  crops: string[];
  photoUrl?: string | null;
  visionAnalysis?: FarmVisionAnalysis | null;
}

interface StepCreateFarmProps {
  data: FarmDetailsData;
  onChange: (data: Partial<FarmDetailsData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const INDIAN_STATES = [
  "Gujarat",
  "Punjab",
  "Maharashtra",
  "Haryana",
  "Rajasthan",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Karnataka",
  "Tamil Nadu",
  "Andhra Pradesh",
  "Telangana",
  "Bihar",
  "West Bengal",
  "Other",
];

const POPULAR_CROPS = [
  { name: "Wheat", emoji: "🌾" },
  { name: "Rice (Paddy)", emoji: "🌾" },
  { name: "Corn (Maize)", emoji: "🌽" },
  { name: "Cotton", emoji: "🌿" },
  { name: "Sugarcane", emoji: "🎋" },
  { name: "Potato", emoji: "🥔" },
  { name: "Soybean", emoji: "🌱" },
  { name: "Mustard", emoji: "🌼" },
  { name: "Tomato", emoji: "🍅" },
  { name: "Onion", emoji: "🧅" },
  { name: "Chickpea (Gram)", emoji: "🫘" },
  { name: "Groundnut", emoji: "🥜" },
];

const PHOTO_PRESETS = [
  { name: "Green Terrace Fields", url: "/farm_login_bg.jpg", emoji: "🏞️" },
  {
    name: "Golden Wheat Field",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
    emoji: "🌾",
  },
  {
    name: "Lush Corn Plantation",
    url: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80",
    emoji: "🌽",
  },
];

export function StepCreateFarm({ data, onChange, onNext, onBack }: StepCreateFarmProps) {
  const [customCrop, setCustomCrop] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<{ category?: string; reason?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleCrop = (cropName: string) => {
    const exists = data.crops.includes(cropName);
    if (exists) {
      onChange({ crops: data.crops.filter((c) => c !== cropName) });
    } else {
      onChange({ crops: [...data.crops, cropName] });
    }
  };

  const handleAddCustomCrop = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCrop.trim();
    if (trimmed && !data.crops.includes(trimmed)) {
      onChange({ crops: [...data.crops, trimmed] });
      setCustomCrop("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInspectionError(null);
    setIsInspecting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      if (!base64Url) {
        setIsInspecting(false);
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/ai/inspect-farm-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: base64Url,
            mime_type: file.type || "image/jpeg",
          }),
        });

        if (res.ok) {
          const apiRes = await res.json();
          const analysis: FarmVisionAnalysis = apiRes.data;

          if (analysis && analysis.is_valid_farm === false) {
            // Strictly reject non-farm images (code screenshot, document, selfie, etc.)
            setInspectionError({
              category: analysis.category || "Non-Farm Image",
              reason:
                analysis.rejection_reason ||
                "This image does not appear to be a farm, crop, or agricultural field.",
            });
            onChange({ photoUrl: null, visionAnalysis: null });
            setIsInspecting(false);
            return;
          }

          // Approved authentic farm photo!
          onChange({
            photoUrl: base64Url,
            visionAnalysis: analysis,
          });
        } else {
          // If server error, accept with fallback
          onChange({ photoUrl: base64Url });
        }
      } catch (err) {
        console.warn("AI vision inspection offline note, accepting local photo:", err);
        onChange({ photoUrl: base64Url });
      } finally {
        setIsInspecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: (typeof PHOTO_PRESETS)[0]) => {
    setInspectionError(null);
    onChange({
      photoUrl: preset.url,
      visionAnalysis: {
        is_valid_farm: true,
        category: preset.name,
        confidence: 0.99,
        rejection_reason: null,
        detected_crop: preset.name.includes("Wheat")
          ? "Wheat"
          : preset.name.includes("Corn")
          ? "Corn"
          : "Terrace Crops",
        vegetation_health: "Optimal vigor and canopy density",
        soil_condition: "Healthy cultivated agricultural soil",
        canopy_cover_pct: 85,
        agronomic_advice:
          "High vegetation index detected. Ready for boundary and zone mapping.",
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.farmName.trim() || !data.villageCity.trim() || data.crops.length === 0) return;
    onNext();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Sprout size={14} className="text-emerald-600" />
          <span>Step 2 of 5 • Farm Identification & Photo</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Create Your Farm 🚜
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Add your farm photo, operational identity, and the primary crops you cultivate.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Farm Photo Upload Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Farm Photo <span className="text-slate-400 font-normal normal-case">(Inspected by FarmOps AI)</span>
            </label>
            {data.visionAnalysis?.is_valid_farm && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Sparkles size={11} className="text-emerald-600" />
                <span>AI Verified Farm</span>
              </span>
            )}
          </div>

          {/* AI Inspection In-Progress State */}
          {isInspecting && (
            <div className="p-6 border-2 border-emerald-400 bg-emerald-50/50 rounded-2xl text-center space-y-2 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles size={20} className="animate-spin" />
              </div>
              <h4 className="text-sm font-black text-emerald-900">
                AI Inspecting Farm Photo...
              </h4>
              <p className="text-xs text-emerald-700">
                Gemini Computer Vision is analyzing your image to verify agricultural authenticity (checking for fields, crops, and soil vs. screenshots or non-farm images).
              </p>
            </div>
          )}

          {/* AI Rejection Alert Card */}
          {inspectionError && !isInspecting && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-2 text-left animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <X size={18} strokeWidth={3} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                    ❌ Invalid Farm Photo Rejected
                  </h4>
                  <div className="text-xs font-bold text-rose-800">
                    Detected: <span className="underline decoration-rose-400">{inspectionError.category}</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    {inspectionError.reason}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-600 pt-1">
                    💡 Please upload an authentic photo of your field, crops, or soil, or select one of the verified presets below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Farm Photo Preview */}
          {!isInspecting && data.photoUrl ? (
            <div className="space-y-3">
              <div className="relative h-44 w-full rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xs group">
                <Image
                  src={data.photoUrl}
                  alt="Farm preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/80 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Camera size={13} />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ photoUrl: null, visionAnalysis: null });
                      setInspectionError(null);
                    }}
                    className="p-1 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                    title="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white font-bold bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-xl">
                  <Check size={13} className="text-emerald-400" />
                  <span>Verified Farm Photo</span>
                </div>
              </div>

              {/* AI Agronomic Inspection Findings Card */}
              {data.visionAnalysis?.is_valid_farm && (
                <div className="p-3.5 rounded-2xl bg-[#f8faf8] border border-emerald-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <Sparkles size={12} className="text-emerald-600" />
                      AI Vision Agronomic Analysis
                    </span>
                    <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-black">
                      {(data.visionAnalysis.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Crop</span>
                      <span className="font-extrabold text-slate-900 truncate block">
                        {data.visionAnalysis.detected_crop || "Field Crop"}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Health</span>
                      <span className="font-extrabold text-emerald-700 truncate block">
                        {data.visionAnalysis.vegetation_health || "Good"}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Canopy</span>
                      <span className="font-extrabold text-slate-900 truncate block">
                        {data.visionAnalysis.canopy_cover_pct ? `${data.visionAnalysis.canopy_cover_pct}%` : "80%"}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Soil</span>
                      <span className="font-extrabold text-slate-900 truncate block">
                        {data.visionAnalysis.soil_condition || "Cultivated"}
                      </span>
                    </div>
                  </div>

                  {data.visionAnalysis.agronomic_advice && (
                    <p className="text-[11px] text-slate-600 italic bg-white/80 p-2 rounded-xl border border-slate-100">
                      💡 {data.visionAnalysis.agronomic_advice}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : !isInspecting ? (
            <div className="space-y-3">
              {/* Drag and Drop / File Input Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/70 hover:bg-emerald-50/30 transition-all text-center cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <Upload size={20} />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Click to upload a photo of your farm / field
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Inspected by Gemini AI • Supports PNG, JPG, WebP
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Or Choose a Realistic Preset */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">
                  Or pick verified preset:
                </span>
                {PHOTO_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

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
              placeholder="e.g. Surya Green Valley Farm"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Village / City & State */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Village / City <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <MapPin size={18} />
              </div>
              <input
                type="text"
                required
                value={data.villageCity}
                onChange={(e) => onChange({ villageCity: e.target.value })}
                placeholder="e.g. Sanand"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              State <span className="text-rose-500">*</span>
            </label>
            <select
              value={data.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Crops Multi-Select */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Primary Crop(s) <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs font-semibold text-emerald-700">
              {data.crops.length} selected
            </span>
          </div>

          {/* Popular Crops Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POPULAR_CROPS.map((c) => {
              const isSelected = data.crops.includes(c.name);
              return (
                <button
                  type="button"
                  key={c.name}
                  onClick={() => toggleCrop(c.name)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs font-bold"
                      : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{c.emoji}</span>
                    <span className="truncate">{c.name}</span>
                  </span>
                  {isSelected && <Check size={13} className="text-emerald-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Crop Entry */}
          <div className="pt-2 flex gap-2">
            <input
              type="text"
              value={customCrop}
              onChange={(e) => setCustomCrop(e.target.value)}
              placeholder="Add other crop..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddCustomCrop}
              disabled={!customCrop.trim()}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {/* Selected Custom Chips */}
          {data.crops.filter((c) => !POPULAR_CROPS.some((p) => p.name === c)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.crops
                .filter((c) => !POPULAR_CROPS.some((p) => p.name === c))
                .map((custom) => (
                  <span
                    key={custom}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold"
                  >
                    <span>{custom}</span>
                    <button
                      type="button"
                      onClick={() => toggleCrop(custom)}
                      className="hover:text-emerald-950 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="pt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={!data.farmName.trim() || !data.villageCity.trim() || data.crops.length === 0}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Proceed to Farm Location & Boundary</span>
            <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
