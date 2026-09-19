import { Database } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { getDashboardDatasetBundle } from "../../lib/data/server";
import { DatasetExplorer } from "./dataset-explorer";
import { FarmOverviewCard } from "./farm-overview-card";
import { TelemetryOverview } from "./telemetry-overview";
import { RecentActivity } from "./recent-activity";
import { DashboardOverviewCards } from "./dashboard-overview-cards";

export default async function DashboardPage() {
  const bundle = await getDashboardDatasetBundle();

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-forest-600">FarmOps AI</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe1d2] bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-600" aria-hidden="true" />
              Advisory Workspace
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Farm overview & data hub</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Monitor farm conditions, detect emerging risks, review advisory plans, and explore connected agronomic research datasets.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-3.5 py-2 text-xs font-semibold text-forest-800 shadow-sm">
          <Database aria-hidden="true" size={15} className="text-forest-600" />
          4 Datasets Connected • 3.5M+ Records Verified
        </div>
      </div>

      {/* Operational Farm Overview (Connected to FastAPI backend) */}
      <FarmOverviewCard />

      {/* Operational Sensor Telemetry & Live Conditions History (Connected to real backend telemetry) */}
      <TelemetryOverview />

      {/* Interactive Dataset Demonstration Hub */}
      <section className="mt-10" aria-labelledby="datasets-heading">
        <div className="border-t border-[#dfe6dd] pt-8">
          <SectionHeading
            id="datasets-heading"
            title="Connected dataset exploration hub"
            description="Verified research datasets loaded via server-side streaming adapters"
          />
          <DatasetExplorer initialBundle={bundle} />
        </div>
      </section>

      {/* Operational Command Center (Connected to real backend risks, plans, tasks, alerts) */}
      <DashboardOverviewCards />

      <section className="mt-8" aria-labelledby="activity-heading">
        <SectionHeading id="activity-heading" title="Recent activity" description="Farm decisions, work, and reassessments" />
        <RecentActivity />
      </section>
    </AppShell>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
