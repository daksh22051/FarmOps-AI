"use client";

import dynamic from "next/dynamic";

const OnboardingClient = dynamic(() => import("./onboarding-client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-xs">
          <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Loading FarmOps Onboarding...</p>
      </div>
    </div>
  ),
});

export default function OnboardingPage() {
  return <OnboardingClient />;
}
