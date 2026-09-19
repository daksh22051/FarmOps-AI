"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function RiskSummaryCard() {
  const { backendRisks } = useFarm();

  const activeRisks = backendRisks.filter((r) => r.status !== "resolved");
  const high = activeRisks.filter((r) => r.severity === "high" || r.severity === "critical").length;
  const moderate = activeRisks.filter((r) => r.severity === "medium").length;
  const low = activeRisks.filter((r) => r.severity === "low").length;
  const resolved = backendRisks.filter((r) => r.status === "resolved").length;
  const totalActive = activeRisks.length;

  // Donut chart SVG stroke calculations
  // Circumference = 2 * PI * 40 ≈ 251.3
  const totalForChart = totalActive || 1;
  const highRatio = high / totalForChart;
  const modRatio = moderate / totalForChart;
  const circumference = 251.3;

  const highDash = highRatio * circumference;
  const modDash = modRatio * circumference;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Risk Summary
        </h3>
        <Link
          href="/risks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>View Analytics</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {totalActive === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
            <ShieldCheck size={20} />
          </div>
          <p className="text-xs font-bold text-slate-800">No active risks detected</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Crop health and environmental conditions are stable.</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 py-2">
          {/* SVG Donut Chart */}
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="12"
              />
              {/* High Risks Segment (Red) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="12"
                strokeDasharray={`${highDash} ${circumference}`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Moderate Risks Segment (Orange/Amber) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f97316"
                strokeWidth="12"
                strokeDasharray={`${modDash} ${circumference}`}
                strokeDashoffset={`-${highDash}`}
                strokeLinecap="round"
              />
            </svg>

            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-slate-900 leading-none">
                {totalActive}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                Active Risks
              </span>
            </div>
          </div>

          {/* Legend Breakdown */}
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-slate-600 font-medium">High</span>
              </div>
              <span className="font-extrabold text-slate-900">{high}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-slate-600 font-medium">Moderate</span>
              </div>
              <span className="font-extrabold text-slate-900">{moderate}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Low</span>
              </div>
              <span className="font-extrabold text-slate-900">{low}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="text-slate-500 font-medium">Resolved</span>
              </div>
              <span className="font-extrabold text-slate-700">{resolved}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
