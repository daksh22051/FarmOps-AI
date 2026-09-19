"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { AuditEvent } from "../../types/api";
import { getAuditEvents } from "../../lib/api/farmops";
import { formatAuditEvent } from "../../lib/alerts";
import { History, RefreshCw, ArrowRight } from "lucide-react";

export function RecentActivity() {
  const { selectedFarmId, selectedFarm } = useFarm();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadRecentEvents = useCallback(async (farmId: string) => {
    setIsLoading(true);
    try {
      const res = await getAuditEvents(farmId, { limit: 5 });
      if (Array.isArray(res.data)) {
        setEvents(res.data);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedFarmId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    setEvents([]);
    void loadRecentEvents(selectedFarmId);
  }, [selectedFarmId, loadRecentEvents]);

  if (isLoading) {
    return (
      <Card className="mt-4 flex flex-col items-center justify-center p-8 text-center">
        <RefreshCw size={20} className="animate-spin text-forest-600 mb-2" />
        <p className="text-xs font-semibold text-ink">Loading recent activity...</p>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="mt-4 flex flex-col items-center justify-center p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <History size={20} />
        </div>
        <h4 className="mt-3 text-sm font-bold text-ink">No Activity History Yet</h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Audit events will appear here as decisions and field tasks are recorded for {selectedFarm?.name || "this farm"}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 divide-y divide-[#edf0eb] p-0 overflow-hidden">
      {events.map((evt) => {
        const meta = formatAuditEvent(evt);
        return (
          <div key={evt.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${meta.badgeClass}`}>
                  {meta.entityLabel} • {evt.event_type.toUpperCase()}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h5 className="mt-1 text-xs font-bold text-ink">{meta.title}</h5>
              <p className="text-[11px] text-slate-600">{meta.summary}</p>
            </div>

            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {new Date(evt.timestamp).toLocaleDateString()}
            </span>
          </div>
        );
      })}

      <div className="bg-slate-50/80 px-4 py-2.5 flex items-center justify-between border-t border-[#edf0eb]">
        <span className="text-[11px] text-slate-500 font-medium">Authoritative Audit Trail</span>
        <Link
          href="/timeline"
          className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900"
        >
          View Full Timeline
          <ArrowRight size={12} />
        </Link>
      </div>
    </Card>
  );
}
