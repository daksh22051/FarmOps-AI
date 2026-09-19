"use client";

import React from "react";
import Link from "next/link";
import { Leaf, Sprout, Plus, Loader2 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { useFarm } from "../../context/farm-context";
import { DashboardGreeting } from "./dashboard-greeting";
import { DashboardMetrics } from "./dashboard-metrics";
import { FarmSatelliteMap } from "./farm-satellite-map";
import { WeatherCard } from "./weather-card";
import { LatestAlertsCard } from "./latest-alerts-card";
import { ZoneHealthCard } from "./zone-health-card";
import { RecentTasksCard } from "./recent-tasks-card";
import { RiskSummaryCard } from "./risk-summary-card";

export default function DashboardPage() {
  const { currentUser, backendFarms, isLoadingFarms } = useFarm();

  // Loading state while checking user's farms from FastAPI backend
  if (isLoadingFarms && backendFarms.length === 0) {
    return (
      <AppShell title="Dashboard">
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <Loader2 size={32} className="animate-spin text-emerald-700 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Connecting to FarmOps...</p>
        </div>
      </AppShell>
    );
  }

  // Proper empty state for a new farmer with zero backend farms
  if (!isLoadingFarms && backendFarms.length === 0) {
    const userMeta = (currentUser?.user_metadata || {}) as Record<string, unknown>;
    const farmerName =
      (typeof userMeta.full_name === "string" ? userMeta.full_name : null) ||
      (typeof userMeta.name === "string" ? userMeta.name : null) ||
      (currentUser?.email ? currentUser.email.split("@")[0] : "");

    return (
      <AppShell title="Dashboard">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-xl mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 mb-5 shadow-xs">
            <Sprout size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome{farmerName ? `, ${farmerName}` : ""} 👋
          </h1>
          <p className="mt-3 text-base font-semibold text-slate-700">
            You haven&apos;t created your first farm yet.
          </p>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-md">
            Set up your operational farm boundaries, define management zones, and connect sensor telemetry to unlock automated risk detection and agronomic advisory.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} />
            <span>Create Your First Farm</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* ============================================================ */}
        {/* 1. GREETING & DATE BANNER                                    */}
        {/* ============================================================ */}
        <DashboardGreeting />

        {/* ============================================================ */}
        {/* 2. FIVE KPI SUMMARY CARDS (Zones, Devices, Risks, Tasks, Alerts) */}
        {/* ============================================================ */}
        <DashboardMetrics />

        {/* ============================================================ */}
        {/* 3. MIDDLE SECTION: Farm Satellite Map + Weather & Alerts     */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Farm Overview with Real Selected Farm Data (65% width) */}
          <div className="lg:col-span-7 xl:col-span-8">
            <FarmSatelliteMap />
          </div>

          {/* Right Column: Live Weather & Latest Alerts (35% width) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
            <WeatherCard />
            <LatestAlertsCard />
          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. BOTTOM THREE COLUMNS: Zone Health, Recent Tasks, Risks    */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <ZoneHealthCard />
          <RecentTasksCard />
          <RiskSummaryCard />
        </div>

        {/* ============================================================ */}
        {/* 5. FOOTER BANNER                                             */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-slate-200/60 bg-white/80 px-4 py-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Leaf size={10} className="fill-current" />
            </div>
            <span>Data-driven farming for a better tomorrow.</span>
          </div>
          <div className="flex items-center gap-1.5 font-extrabold text-slate-800 text-xs">
            <span className="text-emerald-700">FarmOps</span>
            <span>AI</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
