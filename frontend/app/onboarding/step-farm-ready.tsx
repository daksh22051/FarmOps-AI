"use client";

import React from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Building2,
  MapPin,
  Layers,
  Sprout,
  Compass,
  Calendar,
  CloudSun,
} from "lucide-react";
import type { FarmerProfileData } from "./step-welcome-profile";
import type { FarmDetailsData } from "./step-create-farm";
import type { FarmBoundaryData } from "./step-farm-boundary";
import type { ZoneItem } from "./step-create-zones";

interface StepFarmReadyProps {
  farmerProfile: FarmerProfileData;
  farmDetails: FarmDetailsData;
  boundaryData: FarmBoundaryData;
  zones: ZoneItem[];
  isSaving: boolean;
  onFinish: () => void;
}

export function StepFarmReady({
  farmerProfile,
  farmDetails,
  boundaryData,
  zones,
  isSaving,
  onFinish,
}: StepFarmReadyProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      {/* Celebration Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 shadow-md shadow-emerald-500/15 mx-auto animate-bounce-short">
          <CheckCircle2 size={36} strokeWidth={2.5} />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <Sparkles size={13} className="text-emerald-600" />
            <span>Setup Complete</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Farm Ready! ✅
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Your digital twin has been generated. Satellite NDVI monitoring, soil telemetry, and AI advisory are now active for{" "}
            <strong className="text-slate-900">{farmDetails.farmName}</strong>.
          </p>
        </div>
      </div>

      {/* Digital Twin Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
        {/* Card Header with Satellite Miniature */}
        <div className="relative h-32 w-full bg-slate-900">
          <Image
            src={farmDetails.photoUrl || "/farm_login_bg.jpg"}
            alt="Farm aerial view"
            fill
            className="object-cover opacity-75"
            unoptimized={!!farmDetails.photoUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-3.5 left-5 right-5 flex items-end justify-between text-white">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                Digital Twin Active
              </span>
              <h3 className="text-lg font-black tracking-tight drop-shadow-sm">
                {farmDetails.farmName}
              </h3>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-200 bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-xl">
              <MapPin size={12} className="text-emerald-400" />
              <span>
                {farmDetails.villageCity}, {farmDetails.state}
              </span>
            </div>
          </div>
        </div>

        {/* Details Content */}
        <div className="p-6 space-y-5">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Area
              </span>
              <span className="mt-0.5 text-base font-extrabold text-slate-900">
                {boundaryData.areaHectares} Ha
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 block">
                ({boundaryData.areaAcres} Ac)
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Zones
              </span>
              <span className="mt-0.5 text-base font-extrabold text-slate-900">
                {zones.length} Zones
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block">
                Precision Mapped
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Crops
              </span>
              <span className="mt-0.5 text-base font-extrabold text-slate-900 truncate block">
                {farmDetails.crops.length} Types
              </span>
              <span className="text-[10px] font-semibold text-slate-500 block truncate">
                {farmDetails.crops.slice(0, 2).join(", ")}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Operator
              </span>
              <span className="mt-0.5 text-base font-extrabold text-slate-900 truncate block">
                {farmerProfile.fullName.split(" ")[0]}
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 block capitalize">
                {farmerProfile.role}
              </span>
            </div>
          </div>

          {/* Zones Breakdown List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Configured Zones ({zones.length})
            </span>
            <div className="space-y-1.5">
              {zones.map((zone, i) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-emerald-600/15 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-900">{zone.name}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-600">{zone.crop}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500">
                    <span>{zone.areaHa} Ha</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[10px] border border-emerald-200/60">
                      {zone.irrigation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Centroid & Satellite Tile Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold">
              <Compass size={15} className="text-emerald-700" />
              <span>Centroid: {boundaryData.latitude}° N, {boundaryData.longitude}° E</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700">NDVI Active 📡</span>
          </div>
        </div>

        {/* Bottom CTA to Dashboard */}
        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onFinish}
            disabled={isSaving}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving Farm Digital Twin...</span>
            ) : (
              <>
                <span>Launch Farm Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
