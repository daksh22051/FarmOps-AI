"use client";

import React from "react";
import Link from "next/link";
import { Droplets, Leaf, Search, ClipboardList, ArrowRight } from "lucide-react";
import { useFarm } from "../../context/farm-context";

export function RecentTasksCard() {
  const { tasks } = useFarm();

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Recent Tasks
        </h3>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>View All</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
            <ClipboardList size={20} />
          </div>
          <p className="text-xs font-bold text-slate-800">No open tasks</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Create your first task to track farm operations.</p>
          <Link
            href="/tasks"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>Create Task</span>
            <ArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.slice(0, 4).map((t, i) => {
            const isProgress = t.stage === "In Progress" || t.stage === "Confirmed";
            const Icon = i === 0 ? Droplets : i === 1 ? Leaf : i === 2 ? Search : ClipboardList;
            const iconClass = i === 0 ? "bg-blue-50 text-blue-600" : i === 1 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600";
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${iconClass}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {t.title || "Farm Task"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate" suppressHydrationWarning>
                      {t.parcel || "Zone A"} • {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Upcoming"}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                    isProgress
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : t.stage === "Completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {t.stage}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
