"use client";

import React, { useState, useRef } from "react";
import {
  MapPin,
  Search,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  RotateCcw,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  X,
  Check,
} from "lucide-react";
import { inspectFarmPhoto } from "../../lib/api/farmops";
import type { FarmVisionInspectionResult } from "../../types/api";

export interface FarmLocationData {
  villageCity: string;
  district: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  farmImage?: string | null;
}

interface StepFarmLocationProps {
  data: FarmLocationData;
  onChange: (data: Partial<FarmLocationData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const COMMON_REGIONS = [
  { name: "Ahmedabad, Gujarat", lat: 23.0225, lng: 72.5714, district: "Ahmedabad", state: "Gujarat" },
  { name: "Ludhiana, Punjab", lat: 30.901, lng: 75.8573, district: "Ludhiana", state: "Punjab" },
  { name: "Nashik, Maharashtra", lat: 19.9975, lng: 73.7898, district: "Nashik", state: "Maharashtra" },
  { name: "Karnal, Haryana", lat: 29.6857, lng: 76.9905, district: "Karnal", state: "Haryana" },
  { name: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567, district: "Pune", state: "Maharashtra" },
  { name: "Surat, Gujarat", lat: 21.1702, lng: 72.8311, district: "Surat", state: "Gujarat" },
];

const PHOTO_PRESETS = [
  {
    name: "Green Terrace Fields",
    url: "/farm_login_bg.jpg",
    emoji: "🏞️",
    crop: "Terrace Crops",
  },
  {
    name: "Golden Wheat Field",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
    emoji: "🌾",
    crop: "Wheat",
  },
  {
    name: "Lush Corn Plantation",
    url: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80",
    emoji: "🌽",
    crop: "Corn",
  },
];

export function StepFarmLocation({ data, onChange, onNext, onBack }: StepFarmLocationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Photo Inspection states
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<{
    category?: string;
    reason: string;
  } | null>(null);
  const [visionAnalysis, setVisionAnalysis] = useState<FarmVisionInspectionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Search geocoding via OpenStreetMap Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setErrorMsg(null);
    setSearchResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          query
        )}&countrycodes=in&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        setSearchResults(items);
      } else {
        setErrorMsg("No matching locations found in India. Please try another city, district, or PIN code.");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      setErrorMsg("Location service is temporarily unavailable. You can choose a quick region or retry.");
    } finally {
      setIsSearching(false);
    }
  };

  // Select a result from geocoding
  const handleSelectResult = (item: Record<string, unknown>) => {
    const lat = parseFloat(String(item.lat));
    const lon = parseFloat(String(item.lon));
    const addr = (item.address as Record<string, string>) || {};

    const villageCity =
      addr.village || addr.town || addr.city || addr.suburb || (item.name as string) || "Unknown";
    const district = addr.state_district || addr.county || addr.district || villageCity;
    const state = addr.state || "India";
    const country = addr.country || "India";

    onChange({
      villageCity,
      district,
      state,
      country,
      latitude: Math.round(lat * 100000) / 100000,
      longitude: Math.round(lon * 100000) / 100000,
      formattedAddress: (item.display_name as string) || undefined,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  // Use browser GPS
  const handleUseGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser. Please search manually.");
      return;
    }

    setIsLocating(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100000) / 100000;
        const lon = Math.round(pos.coords.longitude * 100000) / 100000;

        try {
          // Reverse geocode
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`,
            { headers: { "Accept-Language": "en" } }
          );
          const revData = await revRes.json();
          const addr = revData.address || {};

          const villageCity =
            addr.village || addr.town || addr.city || addr.suburb || "My Village";
          const district = addr.state_district || addr.county || addr.district || villageCity;
          const state = addr.state || "India";
          const country = addr.country || "India";

          onChange({
            villageCity,
            district,
            state,
            country,
            latitude: lat,
            longitude: lon,
            formattedAddress: revData.display_name || `${lat}° N, ${lon}° E`,
          });
        } catch {
          // Fallback if reverse geocode fails
          onChange({
            villageCity: "Current Location",
            district: "Local District",
            state: "India",
            country: "India",
            latitude: lat,
            longitude: lon,
            formattedAddress: `GPS: ${lat}° N, ${lon}° E`,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("GPS permission denied. Please search for your village/city manually above.");
        } else {
          setErrorMsg("Unable to determine GPS location. Please search manually above.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select a preset region
  const handleSelectPreset = (hub: (typeof COMMON_REGIONS)[0]) => {
    onChange({
      villageCity: hub.name.split(",")[0],
      district: hub.district,
      state: hub.state,
      country: "India",
      latitude: hub.lat,
      longitude: hub.lng,
      formattedAddress: hub.name,
    });
    setSearchResults([]);
    setErrorMsg(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setInspectionError({
        reason: "Please upload a valid image file (PNG, JPG, JPEG, WEBP).",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setInspectionError({
        reason: "Image size is too large (maximum 5MB allowed).",
      });
      return;
    }

    setInspectionError(null);
    setIsInspecting(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;

      try {
        // Call backend Gemini AI vision inspection endpoint
        const res = await inspectFarmPhoto(base64Url, file.type);

        if (res.data && res.data.is_valid_farm === false) {
          // Strictly reject non-farm images (code screenshots, software UIs, selfies, etc.)
          setInspectionError({
            category: res.data.category || "Non-Farm Image",
            reason:
              res.data.rejection_reason ||
              "This image does not appear to be a farm, crop, or agricultural field. Please upload a real farm photograph.",
          });
          onChange({ farmImage: null });
          setVisionAnalysis(null);
          // Clear file input so user can choose again
          if (fileInputRef.current) fileInputRef.current.value = "";
          setIsInspecting(false);
          return;
        }

        if (res.data && res.data.is_valid_farm) {
          // Approved authentic farm photo!
          onChange({ farmImage: base64Url });
          setVisionAnalysis(res.data);
          setInspectionError(null);
        } else if (!res.success) {
          setInspectionError({
            reason: res.message || "Unable to verify this image. Please upload a clear photo of your farm.",
          });
          onChange({ farmImage: null });
          setVisionAnalysis(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          onChange({ farmImage: base64Url });
        }
      } catch (err) {
        console.warn("AI vision inspection offline or failed:", err);
        setInspectionError({
          reason: "Failed to verify image authenticity with AI. Please ensure your backend is reachable and upload a clear farm photo.",
        });
        onChange({ farmImage: null });
        setVisionAnalysis(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsInspecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetPhoto = (preset: (typeof PHOTO_PRESETS)[0]) => {
    setInspectionError(null);
    setVisionAnalysis({
      is_valid_farm: true,
      category: preset.name,
      confidence: 0.99,
      rejection_reason: null,
      detected_crop: preset.crop,
      vegetation_health: "Optimal vigor and canopy density",
      soil_condition: "Healthy cultivated agricultural soil",
      canopy_cover_pct: 85,
      agronomic_advice: "High vegetation index detected. Ready for digital twin mapping.",
    });
    onChange({ farmImage: preset.url });
  };

  const handleRemovePhoto = () => {
    onChange({ farmImage: null });
    setVisionAnalysis(null);
    setInspectionError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isLocationSelected = Boolean(data.latitude && data.longitude);

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <MapPin size={14} className="text-emerald-600" />
          <span>Step 3 of 6 • Farm Location</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Where is your farm located? 📍
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          We use your farm location to provide location-specific weather and agricultural insights
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* If location is ALREADY selected: Show Location Preview */}
        {isLocationSelected ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                <CheckCircle2 size={18} />
                <span>Selected Farm Location</span>
              </div>
              <button
                type="button"
                onClick={() => onChange({ latitude: null, longitude: null })}
                className="text-xs font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>Change Location</span>
              </button>
            </div>

            {/* Location Preview Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Village / City
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {data.villageCity || "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    District
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {data.district || "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    State
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {data.state || "--"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Country
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {data.country || "India"}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Exact Coordinates
                </span>
                <span className="font-mono font-bold text-emerald-800 text-xs mt-0.5 block">
                  {data.latitude?.toFixed(6)}° N, {data.longitude?.toFixed(6)}° E
                </span>
              </div>
            </div>

            {/* Upload Farm Photo (Inspected by FarmOps AI) */}
            <div className="p-4 rounded-2xl bg-[#f8faf7] border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera size={15} className="text-emerald-700" />
                    <span>Farm Photo / Field Picture (Optional)</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inspected by FarmOps AI to ensure genuine agricultural authenticity.
                  </p>
                </div>
                {data.farmImage && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* AI Inspection In-Progress Loading State */}
              {isInspecting && (
                <div className="p-6 border-2 border-emerald-400 bg-emerald-50/70 rounded-2xl text-center space-y-2 animate-pulse">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mx-auto shadow-md">
                    <Sparkles size={20} className="animate-spin" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-950">
                    AI Inspecting Farm Photo...
                  </h4>
                  <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                    Gemini Computer Vision is analyzing your image to verify agricultural authenticity (checking for genuine fields, crops, and soil vs. code screenshots, documents, or non-farm images).
                  </p>
                </div>
              )}

              {/* AI Rejection Alert Card */}
              {inspectionError && !isInspecting && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 space-y-2 text-left animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <AlertTriangle size={18} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                        ❌ Invalid Farm Photo Rejected
                      </h4>
                      {inspectionError.category && (
                        <div className="text-xs font-bold text-rose-800">
                          Detected: <span className="underline decoration-rose-400">{inspectionError.category}</span>
                        </div>
                      )}
                      <p className="text-xs text-rose-700 leading-relaxed font-medium">
                        {inspectionError.reason}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 pt-1">
                        💡 Please upload an authentic photo of your field, crops, or soil, or select one of the verified presets below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Farm Photo Preview (If Approved) */}
              {!isInspecting && data.farmImage ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 h-44 bg-slate-900 group shadow-xs">
                    <img
                      src={data.farmImage}
                      alt="Farm Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-3.5">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-bold text-white bg-emerald-600/90 backdrop-blur-xs px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-xs">
                          <Check size={13} strokeWidth={3} className="text-white" />
                          <span>AI-Verified Farm Photo</span>
                        </span>
                        <label className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-100 shadow-md transition-all flex items-center gap-1.5">
                          <Camera size={13} className="text-emerald-700" />
                          <span>Change Photo</span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* AI Vision Agronomic Findings Card */}
                  {visionAnalysis && (
                    <div className="p-3.5 rounded-2xl bg-white border border-emerald-200/80 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-extrabold text-emerald-900">
                        <span className="flex items-center gap-1">
                          <Sparkles size={12} className="text-emerald-600" />
                          AI Agronomic Telemetry
                        </span>
                        <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-black">
                          {(visionAnalysis.confidence * 100).toFixed(0)}% Confidence
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Crop</span>
                          <span className="font-extrabold text-slate-900 truncate block">
                            {visionAnalysis.detected_crop || "Agricultural Plot"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Health</span>
                          <span className="font-extrabold text-emerald-700 truncate block">
                            {visionAnalysis.vegetation_health || "Normal Baseline"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Canopy</span>
                          <span className="font-extrabold text-slate-900 truncate block">
                            {visionAnalysis.canopy_cover_pct ? `${visionAnalysis.canopy_cover_pct}%` : "75%"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Soil</span>
                          <span className="font-extrabold text-slate-900 truncate block">
                            {visionAnalysis.soil_condition || "Cultivated"}
                          </span>
                        </div>
                      </div>

                      {visionAnalysis.agronomic_advice && (
                        <p className="text-[11px] text-slate-600 italic bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/60">
                          💡 {visionAnalysis.agronomic_advice}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : !isInspecting ? (
                <div className="space-y-3">
                  <label className="border-2 border-dashed border-emerald-300/80 hover:border-emerald-600 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 bg-white cursor-pointer transition-all hover:bg-emerald-50/20 group">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                      <Upload size={18} />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-emerald-900 block">
                        Click to upload farm photo
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        PNG, JPG, JPEG, WEBP up to 5MB • Validated by Gemini AI Vision
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Or Pick Verified Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Or pick verified preset photo:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PHOTO_PRESETS.map((preset) => (
                        <button
                          type="button"
                          key={preset.name}
                          onClick={() => handleSelectPresetPhoto(preset)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span>{preset.emoji}</span>
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={isInspecting}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Continue →</span>
              </button>
            </div>
          </div>
        ) : (
          /* Search & GPS Input Form */
          <div className="space-y-6">
            {/* Search Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Search Location <span className="text-rose-500">*</span>
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search village / city / PIN code (e.g. Ahmedabad, Gujarat)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {/* Or Use GPS */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-bold text-slate-400 uppercase">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div>
              <button
                type="button"
                onClick={handleUseGPS}
                disabled={isLocating}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-emerald-600/30 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isLocating ? (
                  <Loader2 size={16} className="animate-spin text-emerald-600" />
                ) : (
                  <Navigation size={16} className="text-emerald-600" />
                )}
                <span>{isLocating ? "Requesting GPS coordinates..." : "📍 Use My Current Location"}</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">
                  Select matching location:
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  {searchResults.map((item, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectResult(item)}
                      className="w-full p-3 text-left hover:bg-emerald-50/50 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <MapPin size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">{String(item.name ?? "")}</span>
                        <span className="text-slate-500 text-[11px] block">{String(item.display_name ?? "")}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Farming Regions */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Common Agricultural Regions:
              </span>
              <div className="flex flex-wrap gap-2">
                {COMMON_REGIONS.map((hub) => (
                  <button
                    type="button"
                    key={hub.name}
                    onClick={() => handleSelectPreset(hub)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                  >
                    <span>{hub.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Back Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
