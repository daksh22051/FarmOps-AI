"use client";

import Link from "next/link";
import { Loader2, Plus, Sprout } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { useFarm } from "../../context/farm-context";
import { OperationalDashboard } from "./operational-dashboard";

export default function DashboardPage() {
  const { backendFarms, isLoadingFarms, isHydrated, selectedFarm, selectedFarmId, farmError, authError, refreshFarms } = useFarm();
  const farm = selectedFarm?.id === selectedFarmId ? selectedFarm : backendFarms.find(f => f.id === selectedFarmId);
  if (farm) return <AppShell title="Dashboard"><OperationalDashboard key={farm.id} farm={farm} /></AppShell>;
  const error = farmError || authError;
  if (error) return <AppShell title="Dashboard"><div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-bold">Could not load your farms</h1><p className="text-sm mt-2">{error.message}</p><button onClick={() => void refreshFarms()} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-white">Retry</button><Link href="/login" className="ml-4 text-sm underline">Sign in</Link></div></AppShell>;
  if (!isHydrated || isLoadingFarms || backendFarms.length > 0) return <AppShell title="Dashboard"><div role="status" className="flex items-center justify-center gap-3 py-28 text-slate-600"><Loader2 className="animate-spin" size={24} />Connecting to your farm…</div></AppShell>;
  return <AppShell title="Dashboard"><div className="mx-auto max-w-lg py-20 text-center"><Sprout size={40} className="mx-auto text-emerald-700" /><h1 className="mt-4 text-3xl font-extrabold">Start with your farm</h1><p className="mt-3 text-slate-500">Add your farm and crop zones, then connect sensors or record field readings to monitor risks and plan work.</p><Link href="/onboarding" className="mt-6 inline-flex gap-2 items-center rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"><Plus size={18} />Create your first farm</Link></div></AppShell>;
}
