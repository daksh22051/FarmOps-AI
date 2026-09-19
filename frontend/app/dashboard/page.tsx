import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  History,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { getDashboardDatasetBundle } from "../../lib/data/server";
import { DatasetExplorer } from "./dataset-explorer";
import { FarmOverviewCard } from "./farm-overview-card";
import { TelemetryOverview } from "./telemetry-overview";

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

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <OverviewSection
          icon={ShieldAlert}
          title="Risks & advisory"
          description="No verified risk assessments or advisory plans are available."
          detail="Recommendations will appear only after a trusted farm data source and assessment workflow are connected."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <OverviewSection
            icon={ClipboardCheck}
            title="Tasks"
            description="No task records available."
            detail="Approved follow-up work will be summarized here."
          />
          <OverviewSection
            icon={BellRing}
            title="Alerts"
            description="No alert records available."
            detail="Meaningful notices will appear when alert rules are connected."
          />
        </div>
      </div>

      <section className="mt-8" aria-labelledby="activity-heading">
        <SectionHeading id="activity-heading" title="Recent activity" description="Farm decisions, work, and reassessments" />
        <Card className="mt-4">
          <EmptyState
            icon={History}
            title="No activity history yet"
            description="Timeline events will appear here after the farm is configured and verified records are available."
          />
        </Card>
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


function OverviewSection({
  icon: Icon,
  title,
  description,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <Card className="min-h-52">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
            <Icon aria-hidden="true" size={18} />
          </span>
          <h2 className="font-semibold text-ink">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Empty</span>
      </div>
      <div className="mt-6 flex gap-3">
        <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">{description}</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  roomy = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  roomy?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 text-center ${roomy ? "min-h-72 py-10" : "py-8"}`}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f4ef] text-slate-500">
        <Icon aria-hidden="true" size={23} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
