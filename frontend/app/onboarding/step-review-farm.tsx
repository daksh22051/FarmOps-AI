"use client";

import React from "react";
import {
  CheckCircle2,
  Building2,
  MapPin,
  Maximize2,
  Sprout,
  Layers,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { FarmerProfileData } from "./step-welcome-profile";
import type { FarmDetailsData } from "./step-farm-details";
import type { FarmLocationData } from "./step-farm-location";
import type { FarmSizeData } from "./step-farm-size";
import type { ZoneConfigItem } from "./step-zone-setup";

interface StepReviewFarmProps {
  farmerProfile: FarmerProfileData;
  farmDetails: FarmDetailsData;
  locationData: FarmLocationData;
  sizeData: FarmSizeData;
  zones: ZoneConfigItem[];
  isCreating: boolean;
  onEdit: (stepIndex: number) => void;
  onCreateFarm: () => void;
}

export function StepReviewFarm({
  farmerProfile,
  farmDetails,
  locationData,
  sizeData,
  zones,
  isCreating,
  onEdit,
  onCreateFarm,
}: StepReviewFarmProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Sparkles size={14} className="text-emerald-600" />
          <span>Step 6 of 6 • Review & Launch</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Review your farm 📋
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Please confirm your farm setup. Once verified, FarmOps AI will initialize your digital twin.
        </p>
      </div>

      {/* Review Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        {/* Top Farm Banner */}
        <div className="p-6 bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            FARM PROFILE
          </span>
          <h2 className="text-2xl font-black tracking-tight">{farmDetails.farmName}</h2>
          <p className="text-xs text-emerald-100/80 font-medium">
            Operated by {farmerProfile.fullName} ({farmerProfile.phone ? `+91 ${farmerProfile.phone}` : "Owner"})
          </p>
        </div>

        {/* Details Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Location
              </span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block truncate">
                {locationData.villageCity || "Ahmedabad"}
              </span>
              <span className="text-[11px] text-slate-500 truncate block">
                {locationData.state || "Gujarat"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Farm Area
              </span>
              <span className="font-extrabold text-emerald-700 text-sm mt-0.5 block">
                {sizeData.area} {sizeData.areaUnit}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Approximate
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Primary Crop
              </span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block truncate">
                {farmDetails.primaryCrop}
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                {farmDetails.farmType}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Zones
              </span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                {zones.length} Zones
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold block">
                Configured
              </span>
            </div>
          </div>

          {/* Coordinates Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-emerald-600" />
              <span className="font-bold text-slate-700">GPS Coordinates:</span>
              <span className="font-mono font-bold text-emerald-800">
                {locationData.latitude ? `${locationData.latitude.toFixed(4)}° N, ${locationData.longitude?.toFixed(4)}° E` : "--"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onEdit(3)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Edit Location
            </button>
          </div>

          {/* Farm Photo Preview (If uploaded) */}
          {locationData.farmImage && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 border border-emerald-300">
                  <img
                    src={locationData.farmImage}
                    alt="Farm Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block">
                    Farm Photo
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium block">
                    Personalized field visual attached
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEdit(3)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer shrink-0"
              >
                Change Photo
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-slate-100" />

          {/* Zones Breakdown List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configured Zones ({zones.length})
              </span>
              <button
                type="button"
                onClick={() => onEdit(5)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Edit Zones
              </button>
            </div>

            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 text-sm block">
                      {zone.name}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {zone.crop} • {zone.area} {sizeData.areaUnit}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <span className="font-semibold block">{zone.soilType || "Standard Soil"}</span>
                    <span className="text-emerald-700 font-bold block">{zone.irrigationType || "Standard"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-slate-50/70 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onEdit(5)}
            disabled={isCreating}
            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-white text-slate-700 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            ← Edit
          </button>
          <button
            type="button"
            onClick={onCreateFarm}
            disabled={isCreating}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating Farm in Backend...</span>
              </>
            ) : (
              <>
                <span>Create My Farm →</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
