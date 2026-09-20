"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function ZoneHealthCard() {
  const { backendZones, backendRisks } = useFarm();

  // Zone standing is derived from open risk candidates for that zone. There is no
  // "health %" available from the backend, so none is displayed — inventing one
  // would put a fabricated number in front of the farmer.
  const displayZones = backendZones.slice(0, 4).map((z) => {
    const openRisks = (backendRisks || []).filter(
      (r) => r.zone_id === z.id && (r.status === "open" || r.status === "acknowledged")
    );
    const worst = openRisks.some((r) => r.severity === "critical" || r.severity === "high")
      ? "high"
      : openRisks.length > 0
      ? "moderate"
      : "clear";
    return {
      id: z.id,
      name: z.name,
      crop: z.crop || "Unassigned",
      riskCount: openRisks.length,
      status:
        worst === "high" ? "Needs attention" : worst === "moderate" ? "Watch" : "No open risks",
      barColor:
        worst === "high" ? "bg-rose-500" : worst === "moderate" ? "bg-amber-400" : "bg-emerald-500",
      textColor:
        worst === "high"
          ? "text-rose-700"
          : worst === "moderate"
          ? "text-amber-700"
          : "text-emerald-700",
      // Bar reflects risk load, not a health score: full when clear, shorter as risks stack up.
      barWidth: worst === "high" ? 33 : worst === "moderate" ? 66 : 100,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Zone Health
        </h3>
        <Link
          href="/farm?tab=zones"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>View All</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {displayZones.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
            <Sprout size={20} />
          </div>
          <p className="text-xs font-bold text-slate-800">No zones configured</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Set up farm zones to monitor crop health.</p>
          <Link
            href="/farm?tab=zones"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>Add Zone</span>
            <ArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayZones.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-700">
                    <Sprout size={13} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="text-slate-400 ml-1.5 text-[11px] font-medium">{item.crop}</span>
                  </div>
                </div>
                <div className="text-right">
                  {item.riskCount > 0 && (
                    <span className="font-extrabold text-slate-900">
                      {item.riskCount} risk{item.riskCount > 1 ? "s" : ""}
                    </span>
                  )}
                  <span className={`ml-1.5 text-[11px] font-bold ${item.textColor}`}>
                    {item.status}
                  </span>
                </div>
              </div>

              {/* Risk-load indicator (not a measured health score) */}
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.barColor} transition-all duration-500`}
                  style={{ width: `${item.barWidth}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
