"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Info, ArrowRight, Bell } from "lucide-react";
import { useFarm } from "../../context/farm-context";

function formatAlertTime(timestamp?: string): string {
  if (!timestamp) return "Recent";
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "Recent";
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = (hours % 12 || 12).toString().padStart(2, "0");
    return `${displayHours}:${minutes} ${ampm}`;
  } catch {
    return "Recent";
  }
}

export function LatestAlertsCard() {
  const { alerts } = useFarm();

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Latest Alerts
        </h3>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>View All</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
            <Bell size={20} />
          </div>
          <p className="text-xs font-bold text-slate-800">No alerts</p>
          <p className="text-[11px] text-slate-400 mt-0.5">All telemetry and system parameters are normal.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.slice(0, 3).map((a) => {
            const isHigh = a.severity === "high";
            const isMedium = a.severity === "medium";
            const Icon = a.severity === "info" ? Info : AlertTriangle;
            const badgeClass = isHigh
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : isMedium
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-blue-50 text-blue-700 border-blue-200";
            const iconClass = isHigh
              ? "text-rose-600 bg-rose-50"
              : isMedium
              ? "text-amber-600 bg-amber-50"
              : "text-blue-600 bg-blue-50";

            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${iconClass}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {a.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate" suppressHydrationWarning>
                      {a.sourceRef ? `Zone ${a.sourceRef}` : "All zones"} • {formatAlertTime(a.timestamp)}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${badgeClass}`}
                >
                  {isHigh ? "High" : isMedium ? "Moderate" : "Info"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
