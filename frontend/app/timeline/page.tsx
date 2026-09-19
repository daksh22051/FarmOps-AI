"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import {
  Clock,
  Database,
  Filter,
  Info,
  Sparkles,
  User,
} from "lucide-react";

export default function TimelinePage() {
  const { timeline } = useFarm();
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filteredEvents = timeline.filter((evt) => {
    if (typeFilter !== "ALL" && evt.type !== typeFilter) return false;
    if (categoryFilter !== "ALL" && evt.category !== categoryFilter) return false;
    return true;
  });

  const sessionCount = timeline.filter((e) => e.type === "Session Activity").length;
  const provenanceCount = timeline.filter((e) => e.type === "Dataset Provenance").length;
  const demoCount = timeline.filter((e) => e.type === "Seeded Demonstration").length;

  return (
    <AppShell title="Timeline">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Audit Trail & History
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Honest Event Provenance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Activity & Provenance Timeline</h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            A chronological log separating active browser session decisions from research dataset verification milestones and seeded demonstration records.
          </p>
        </div>
      </div>

      {/* Provenance Separation Notice */}
      <div className="mt-6 rounded-xl border border-forest-200 bg-[#f4f7f2] p-4 text-xs text-forest-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
          <div className="space-y-1">
            <p className="font-semibold text-forest-900">
              Historical Activity Grounding Policy
            </p>
            <p className="leading-relaxed text-forest-800">
              FarmOps AI never fabricates fake farming activities (such as simulated historical tractor passes, planting dates, or chemical sprays) to make screens appear full. Events below are strictly tagged as <strong>Session Activity</strong> (your actions in this workspace), <strong>Dataset Provenance</strong> (scientific verification of Kaggle data), or <strong>Seeded Demonstration</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Event Classification Counts */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className={`p-4 cursor-pointer transition-all border ${
            typeFilter === "Session Activity"
              ? "ring-2 ring-forest-500 bg-forest-50/40 border-forest-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setTypeFilter(typeFilter === "Session Activity" ? "ALL" : "Session Activity")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-800">
              Session Actions
            </span>
            <User size={16} className="text-forest-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-forest-900">{sessionCount}</span>
            <span className="text-xs text-forest-700">active events</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real decisions made during your current browser session
          </p>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all border ${
            typeFilter === "Dataset Provenance"
              ? "ring-2 ring-blue-500 bg-blue-50/40 border-blue-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setTypeFilter(typeFilter === "Dataset Provenance" ? "ALL" : "Dataset Provenance")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Dataset Provenance
            </span>
            <Database size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-900">{provenanceCount}</span>
            <span className="text-xs text-blue-700">audit logs</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            RFC4180 parsing and statistical verification of datasets
          </p>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all border ${
            typeFilter === "Seeded Demonstration"
              ? "ring-2 ring-amber-500 bg-amber-50/40 border-amber-300"
              : "border-[#dfe6dd] hover:bg-slate-50"
          }`}
          onClick={() => setTypeFilter(typeFilter === "Seeded Demonstration" ? "ALL" : "Seeded Demonstration")}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Seeded Demonstration
            </span>
            <Sparkles size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-900">{demoCount}</span>
            <span className="text-xs text-amber-700">sample records</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Initial sample state for hackathon demonstration purposes
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Filter size={15} className="text-forest-600" />
          <span>Timeline Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Origin Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Event Types ({timeline.length})</option>
              <option value="Session Activity">Session Activity ({sessionCount})</option>
              <option value="Dataset Provenance">Dataset Provenance ({provenanceCount})</option>
              <option value="Seeded Demonstration">Seeded Demo ({demoCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
            >
              <option value="ALL">All Categories</option>
              <option value="Farm Profile">Farm Profile</option>
              <option value="Advisory">Advisory</option>
              <option value="Task">Task</option>
              <option value="Dataset Audit">Dataset Audit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="mt-8 relative pl-6 sm:pl-8 border-l-2 border-[#dfe6dd] ml-3 sm:ml-4 space-y-6">
        {filteredEvents.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-xs font-semibold text-slate-500">
              No timeline events match the active filters.
            </p>
          </Card>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Timeline Bullet */}
              <div
                className={`absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white shadow-2xs ${
                  evt.type === "Session Activity"
                    ? "bg-forest-700 text-white"
                    : evt.type === "Dataset Provenance"
                    ? "bg-blue-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                {evt.type === "Session Activity" ? (
                  <User size={13} />
                ) : evt.type === "Dataset Provenance" ? (
                  <Database size={13} />
                ) : (
                  <Sparkles size={13} />
                )}
              </div>

              {/* Event Card */}
              <Card className="p-5 border-[#dfe6dd] hover:border-slate-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        evt.type === "Session Activity"
                          ? "bg-forest-100 text-forest-800"
                          : evt.type === "Dataset Provenance"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {evt.type}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {evt.category}
                    </span>
                    {evt.refId && (
                      <span className="font-mono text-[11px] text-slate-500">
                        Ref: {evt.refId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={13} />
                    <span className="font-mono">{evt.timestamp}</span>
                  </div>
                </div>

                <h3 className="mt-2 text-sm font-bold text-ink sm:text-base">
                  {evt.title}
                </h3>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                  {evt.summary}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-[#edf0eb] pt-2 text-[11px] text-slate-500">
                  <span>Actor / Origin: <strong className="text-slate-700">{evt.actor}</strong></span>
                  <span className="font-mono text-slate-400">{evt.id}</span>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
