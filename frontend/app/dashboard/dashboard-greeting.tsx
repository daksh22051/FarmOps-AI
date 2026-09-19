"use client";

import React, { useMemo } from "react";
import { Leaf } from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function DashboardGreeting() {
  const { currentUser, selectedFarm, backendFarms } = useFarm();

  const farmerName: string = useMemo(() => {
    const meta = (currentUser?.user_metadata || {}) as Record<string, unknown>;
    if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
    if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
    const selCrop = selectedFarm?.crop_profile as Record<string, unknown> | undefined;
    if (typeof selCrop?.farmer_name === "string" && selCrop.farmer_name.trim()) return selCrop.farmer_name.trim();
    const bCrop = backendFarms[0]?.crop_profile as Record<string, unknown> | undefined;
    if (typeof bCrop?.farmer_name === "string" && bCrop.farmer_name.trim()) return bCrop.farmer_name.trim();
    if (currentUser?.email) {
      const prefix = currentUser.email.split("@")[0];
      return prefix
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Farmer";
  }, [currentUser, selectedFarm, backendFarms]);

  const activeFarm = selectedFarm || backendFarms[0];
  const farmName = activeFarm?.name;
  const farmArea = activeFarm?.total_area ? `${activeFarm.total_area} ${activeFarm.area_unit || "Acres"}` : null;

  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-slate-500">Good Morning,</p>
        <h1
          className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5"
          suppressHydrationWarning
        >
          <span>Good Morning, {farmerName}</span>
          <span>👋</span>
        </h1>
        {farmName ? (
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium" suppressHydrationWarning>
            Your Farm: <span className="font-bold text-slate-900">{farmName}</span>
            {farmArea && <span className="text-slate-400"> · {farmArea}</span>}
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-slate-500 mt-1" suppressHydrationWarning>
            Here&apos;s what&apos;s happening on your farm today.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-xs font-bold text-slate-500" suppressHydrationWarning>
          {todayFormatted}
        </span>

        {/* Pill Banner: Healthy Farms / Stronger Communities */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/90 bg-emerald-50/70 py-1.5 px-3.5 text-xs shadow-2xs">
          <div className="h-6 w-6 rounded-full bg-emerald-600/15 flex items-center justify-center text-emerald-800 shrink-0">
            <Leaf size={13} className="fill-current" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-extrabold text-emerald-950 leading-tight">
              Healthy Farms
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 leading-tight">
              Stronger Communities
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
