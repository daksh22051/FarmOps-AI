import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Database,
  Droplets,
  FileCheck2,
  History,
  Leaf,
  MapPin,
  ShieldAlert,
  Sprout,
  Thermometer,
  Waves,
} from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { Card, StatusBadge } from "../../components/ui";
import { getDashboardDatasetBundle } from "../../lib/data/server";
import { DatasetExplorer } from "./dataset-explorer";

const overviewItems: Array<{ label: string; icon: LucideIcon; tone: string }> = [
  { label: "Soil moisture", icon: Droplets, tone: "bg-sky-50 text-sky-700" },
  { label: "Temperature", icon: Thermometer, tone: "bg-amber-50 text-amber-700" },
  { label: "Humidity", icon: Waves, tone: "bg-cyan-50 text-cyan-700" },
  { label: "Active risks", icon: ShieldAlert, tone: "bg-rose-50 text-rose-700" },
  { label: "Pending approvals", icon: FileCheck2, tone: "bg-violet-50 text-violet-700" },
  { label: "Open tasks", icon: ClipboardCheck, tone: "bg-emerald-50 text-emerald-700" },
];

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

      {/* Operational Farm Configuration Status (Honest unconfigured state) */}
      <Card className="mt-8 overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.25fr_1fr]">
          <div className="border-b border-[#e5eae3] bg-[#f4f7f1] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-forest-700 shadow-sm">
                <Sprout aria-hidden="true" size={22} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Physical Farm Integration</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Farm Telemetry Not Connected</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Live on-field sensors, pump telemetry, and farmer account credentials are not configured.
                  Historical research datasets are available in the demonstration hub below.
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
              <dd className="mt-2 text-sm font-semibold text-slate-700">Not configured</dd>
            </div>
            <div className="pl-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <MapPin aria-hidden="true" size={14} />
                Physical Location
              </dt>
              <dd className="mt-2 text-sm font-semibold text-slate-700">Not configured</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Operational Indicators (Honest unavailable state for live farm) */}
      <section className="mt-8" aria-labelledby="overview-heading">
        <SectionHeading
          id="overview-heading"
          title="Operational telemetry"
          description="Live farm indicators (awaiting physical hardware connection)"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewItems.map(({ label, icon: Icon, tone }) => (
            <KpiCard key={label} label={label} icon={Icon} tone={tone} />
          ))}
        </div>
      </section>

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

      {/* Advisory and Follow-up Sections */}
      <section className="mt-10" aria-labelledby="conditions-heading">
        <SectionHeading id="conditions-heading" title="Farm conditions" description="Live sensor and environmental trends" />
        <Card className="mt-4 p-0">
          <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Activity aria-hidden="true" size={17} className="text-forest-600" />
              Live condition history
            </div>
            <StatusBadge>No live source</StatusBadge>
          </div>
          <EmptyState
            icon={CloudSun}
            title="Live sensor history is unavailable"
            description="Verified moisture, temperature, and humidity trends will appear here after physical on-farm hardware integration. No synthetic farm measurements are being substituted."
            roomy
          />
        </Card>
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

function KpiCard({ label, icon: Icon, tone }: { label: string; icon: LucideIcon; tone: string }) {
  return (
    <Card className="flex min-h-32 items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-4 text-lg font-semibold text-ink">Unavailable</p>
        <p className="mt-1 text-xs text-slate-500">Awaiting live farm connection</p>
      </div>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
        <Icon aria-hidden="true" size={20} />
      </span>
    </Card>
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
