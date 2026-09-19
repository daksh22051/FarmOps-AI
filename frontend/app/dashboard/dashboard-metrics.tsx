"use client";

import React from "react";
import Link from "next/link";
import { Grid, Cpu, AlertTriangle, CheckSquare, Bell, ChevronRight } from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function DashboardMetrics() {
  const { backendZones, devices, backendRisks, backendTasks, backendUnreadAlertCount } = useFarm();

  const totalZones = backendZones.length;
  const totalDevices = devices.length;

  const activeRisks = backendRisks.filter((r) => r.status !== "resolved");
  const highRisks = activeRisks.filter((r) => r.severity === "high" || r.severity === "critical").length;
  const moderateRisks = activeRisks.filter((r) => r.severity === "medium").length;
  const totalRisks = activeRisks.length;

  const openTasks = backendTasks.filter((t) => t.status !== "completed");
  const inProgressTasks = openTasks.filter((t) => t.status === "in_progress").length;
  const totalTasks = openTasks.length;

  const totalAlerts = backendUnreadAlertCount;

  const metrics = [
    {
      title: "Zones",
      value: totalZones,
      subtitle: totalZones > 0 ? `${totalZones} precision ${totalZones === 1 ? "zone" : "zones"}` : "No zones configured",
      subtitleBadge: totalZones > 0,
      href: "/farm?tab=zones",
      icon: Grid,
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Devices",
      value: totalDevices,
      subtitle: totalDevices > 0 ? `${totalDevices} active ${totalDevices === 1 ? "device" : "devices"}` : "No sensor devices",
      subtitleBadge: totalDevices > 0,
      href: "/farm?tab=devices",
      icon: Cpu,
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Active Risks",
      value: totalRisks,
      subtitle: totalRisks > 0 ? `${highRisks} High • ${moderateRisks} Mod` : "No active risks",
      subtitleHighlight: totalRisks > 0,
      href: "/risks",
      icon: AlertTriangle,
      iconBg: totalRisks > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400",
    },
    {
      title: "Open Tasks",
      value: totalTasks,
      subtitle: totalTasks > 0 ? `${inProgressTasks} in progress` : "No open tasks",
      subtitleHighlightBlue: inProgressTasks > 0,
      href: "/tasks",
      icon: CheckSquare,
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Alerts",
      value: totalAlerts,
      subtitle: totalAlerts > 0 ? `${totalAlerts} unread` : "No alerts",
      subtitleHighlight: totalAlerts > 0,
      href: "/alerts",
      icon: Bell,
      iconBg: totalAlerts > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Link
            key={m.title}
            href={m.href}
            className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-emerald-500/50 hover:shadow-xs transition-all flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">{m.title}</p>
              <h3
                className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight"
                suppressHydrationWarning
              >
                {m.value}
              </h3>
              <div
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold"
                suppressHydrationWarning
              >
                {m.subtitleBadge ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    {m.subtitle}
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  </span>
                ) : m.subtitleHighlight ? (
                  <span className="text-xs font-semibold text-slate-600">
                    <span className="text-rose-600 font-bold">{highRisks} High</span>{" "}
                    <span className="text-amber-600 font-bold">{moderateRisks} Moderate</span>
                  </span>
                ) : m.subtitleHighlightBlue ? (
                  <span className="text-blue-600 font-bold">{m.subtitle}</span>
                ) : (
                  <span className="text-slate-500 group-hover:text-emerald-700 flex items-center gap-0.5">
                    {m.subtitle} <ChevronRight size={12} />
                  </span>
                )}
              </div>
            </div>

            <div className={`p-3 rounded-2xl ${m.iconBg} shrink-0`}>
              <Icon size={22} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
