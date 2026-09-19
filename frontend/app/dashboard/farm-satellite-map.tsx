"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ArrowRight,
  MapPin,
  Sprout,
  Cpu,
  AlertTriangle,
  CheckSquare,
  Bell,
  Plus,
} from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function FarmSatelliteMap() {
  const {
    backendFarms,
    selectedFarm,
    selectFarm,
    backendZones,
    devices,
    backendRisks,
    backendTasks,
    backendUnreadAlertCount,
  } = useFarm();

  const [activeFarmId, setActiveFarmId] = useState<string>("");

  useEffect(() => {
    if (selectedFarm?.id) {
      setActiveFarmId(selectedFarm.id);
    } else if (backendFarms.length > 0) {
      setActiveFarmId(backendFarms[0].id);
    }
  }, [selectedFarm, backendFarms]);

  const handleSelectFarm = (id: string) => {
    setActiveFarmId(id);
    selectFarm(id);
  };

  // Active farm data resolution directly from backend state
  const activeFarm = useMemo(() => {
    if (selectedFarm) return selectedFarm;
    if (activeFarmId) {
      const found = backendFarms.find((f) => f.id === activeFarmId);
      if (found) return found;
    }
    return backendFarms[0] || null;
  }, [selectedFarm, activeFarmId, backendFarms]);

  // Display values
  const farmName = activeFarm?.name || "My Farm";
  const farmLocation = activeFarm?.location || activeFarm?.address || "Location unassigned";
  const farmArea = activeFarm?.total_area !== undefined && activeFarm?.total_area !== null
    ? activeFarm.total_area
    : backendZones.reduce((sum, z) => sum + (Number(z.area) || 0), 0);
  const farmUnit = activeFarm?.area_unit || "Acres";
  const cropProfile = (activeFarm?.crop_profile as Record<string, unknown>) || {};
  const primaryCrop = (typeof cropProfile.primary_crop === "string" ? cropProfile.primary_crop : null) || (backendZones[0]?.crop) || "Unspecified";
  const lat = typeof cropProfile.latitude === "number" ? cropProfile.latitude : undefined;
  const lon = typeof cropProfile.longitude === "number" ? cropProfile.longitude : undefined;

  const activeRisksCount = backendRisks.filter((r) => r.status !== "resolved").length;
  const openTasksCount = backendTasks.filter((t) => t.status !== "completed").length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between h-full space-y-5">
      {/* Header with Title & Farm Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Farm Overview
          </h3>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Active Digital Twin
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Farm Dropdown: ONLY when user has multiple real farms */}
          {backendFarms.length > 1 ? (
            <div className="relative">
              <select
                value={activeFarmId}
                onChange={(e) => handleSelectFarm(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-[#f8faf7] py-1.5 pl-3 pr-8 text-xs font-extrabold text-slate-800 hover:border-slate-300 focus:outline-none cursor-pointer shadow-2xs"
              >
                {backendFarms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          ) : backendFarms.length === 1 ? (
            <span className="text-xs font-bold text-slate-800 px-3 py-1 rounded-xl bg-slate-100/80 border border-slate-200/60">
              {farmName}
            </span>
          ) : null}

          <Link
            href="/farm"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>View Details</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Primary Farm Identity Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#f8faf7] border border-emerald-200/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Farm Identity
          </span>
          <h4 className="text-lg font-black text-slate-900 tracking-tight" suppressHydrationWarning>{farmName}</h4>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1" suppressHydrationWarning>
            <MapPin size={12} className="text-emerald-600" />
            <span>{farmLocation}</span>
          </p>
          {lat && lon && (
            <p className="text-[10px] font-mono text-emerald-700 font-bold" suppressHydrationWarning>
              {Number(lat).toFixed(4)}° N, {Number(lon).toFixed(4)}° E
            </p>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-[#f8faf7] border border-emerald-200/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Operational Size
          </span>
          <div className="text-2xl font-black text-emerald-800" suppressHydrationWarning>
            {farmArea} <span className="text-sm font-bold text-slate-600 capitalize">{farmUnit}</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1" suppressHydrationWarning>
            <Sprout size={12} className="text-emerald-600" />
            <span>Primary Crop: <strong>{primaryCrop}</strong></span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#f8faf7] border border-emerald-200/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Monitored Zones
          </span>
          <div className="text-2xl font-black text-slate-900" suppressHydrationWarning>
            {backendZones.length} <span className="text-sm font-bold text-slate-500">Zones</span>
          </div>
          <p className="text-xs font-semibold text-emerald-700">
            {backendZones.length > 0 ? "Precision Divided & Monitored" : "Awaiting Zone Setup"}
          </p>
        </div>
      </div>

      {/* Configured Zones Breakdown */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Farm Zones ({backendZones.length})
          </span>
          <Link
            href="/farm?tab=zones"
            className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
          >
            <Plus size={12} />
            <span>Manage Zones</span>
          </Link>
        </div>

        {backendZones.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {backendZones.map((zone, idx) => (
              <div
                key={zone.id || idx}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-400 transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">{zone.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {zone.status === "active" ? "Active" : zone.status === "fallow" ? "Fallow" : "Prepared"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {zone.crop || "Unassigned"} • {zone.area ? `${zone.area} ${farmUnit}` : "Area unassigned"}
                </div>
                <div className="text-[10px] text-slate-400">
                  {zone.soil_type || "Loamy Soil"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              No zones configured yet for this farm.
            </p>
            <Link
              href="/farm?tab=zones"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
            >
              <Plus size={13} />
              <span>Add Your First Zone</span>
            </Link>
          </div>
        )}
      </div>

      {/* Honest Operational Empty States Grid */}
      <div className="pt-2 border-t border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Operational Status
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Cpu size={14} />
              <span className="text-[10px] font-bold uppercase">Devices</span>
            </div>
            <span className="font-extrabold text-slate-900 block" suppressHydrationWarning>{devices.length}</span>
            <span className="text-[10px] text-slate-500 block truncate" suppressHydrationWarning>
              {devices.length === 0 ? "No sensors connected" : `${devices.length} connected`}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <AlertTriangle size={14} />
              <span className="text-[10px] font-bold uppercase">Risks</span>
            </div>
            <span className="font-extrabold text-slate-900 block" suppressHydrationWarning>{activeRisksCount}</span>
            <span className="text-[10px] text-slate-500 block truncate" suppressHydrationWarning>
              {activeRisksCount === 0 ? "No active risks" : `${activeRisksCount} active`}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <CheckSquare size={14} />
              <span className="text-[10px] font-bold uppercase">Tasks</span>
            </div>
            <span className="font-extrabold text-slate-900 block" suppressHydrationWarning>{openTasksCount}</span>
            <span className="text-[10px] text-slate-500 block truncate" suppressHydrationWarning>
              {openTasksCount === 0 ? "No open tasks" : `${openTasksCount} tasks`}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Bell size={14} />
              <span className="text-[10px] font-bold uppercase">Alerts</span>
            </div>
            <span className="font-extrabold text-slate-900 block" suppressHydrationWarning>{backendUnreadAlertCount}</span>
            <span className="text-[10px] text-slate-500 block truncate" suppressHydrationWarning>
              {backendUnreadAlertCount === 0 ? "No alerts" : `${backendUnreadAlertCount} notifications`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
