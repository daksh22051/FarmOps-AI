"use client";

import React from "react";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import { Sprout, Leaf, MapPin, Loader2 } from "lucide-react";

export function FarmOverviewCard() {
  const { selectedFarm, backendZones, isLoadingFarm } = useFarm();

  const cropSummary = React.useMemo(() => {
    if (!backendZones || backendZones.length === 0) return "Not configured";
    const crops = Array.from(
      new Set(backendZones.map((z) => z.crop).filter((c): c is string => Boolean(c && c.trim())))
    );
    return crops.length > 0 ? crops.join(", ") : "Unspecified";
  }, [backendZones]);

  if (isLoadingFarm) {
    return (
      <Card className="mt-8 overflow-hidden p-6">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <Loader2 size={18} className="animate-spin text-forest-700" />
          <span>Loading farm overview from FastAPI backend...</span>
        </div>
      </Card>
    );
  }

  const farmName = selectedFarm?.name || "Farm Telemetry Not Connected";
  const farmLocation = selectedFarm?.location || selectedFarm?.address || "Not configured";
  const farmStatusDescription = selectedFarm
    ? `Operational farm registered on backend (${selectedFarm.total_area ? `${selectedFarm.total_area} ${selectedFarm.area_unit}` : "area unassigned"}, ${backendZones.length} field zones). Physical telemetry sensors awaiting live gateway ingestion.`
    : "Live on-field sensors, pump telemetry, and farmer account credentials are not configured. Historical research datasets are available in the demonstration hub below.";

  return (
    <Card className="mt-8 overflow-hidden p-0">
      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="border-b border-[#e5eae3] bg-[#f4f7f1] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-forest-700 shadow-sm">
              <Sprout aria-hidden="true" size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                {selectedFarm ? (selectedFarm.is_demo ? "Demo Backend Farm" : "Connected Backend Farm") : "Physical Farm Integration"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{farmName}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {farmStatusDescription}
              </p>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-[#e5eae3] p-5 sm:p-6">
          <div className="pr-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Leaf aria-hidden="true" size={14} />
              Live Crop
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-700">
              {cropSummary}
            </dd>
          </div>
          <div className="pl-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin aria-hidden="true" size={14} />
              Physical Location
            </dt>
            <dd className="mt-2 text-sm font-semibold text-slate-700">
              {farmLocation}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
