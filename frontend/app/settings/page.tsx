"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm, type FarmSettings } from "../../context/farm-context";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Info,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
} from "lucide-react";

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
    resetSettings,
    formatNumber,
    formatArea,
    totalAreaHa,
  } = useFarm();

  const [localSettings, setLocalSettings] = useState<FarmSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <AppShell title="Settings">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Application Configuration
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Local Browser Persistence
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">System Preferences</h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Configure measurement display units, number formatting locales, automated workflow rules, and audit alert sensitivities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Persistence Scope Notice */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="font-semibold">Local Persistence Scope Disclosure</p>
            <p className="leading-relaxed text-blue-900">
              All settings configured here are stored directly in your browser&apos;s <code>localStorage</code>. There is no remote account database or cloud sync involved. Unit conversions are applied only to parameters with documented physical units (e.g. farm area in hectares vs. acres). Telemetry fields whose units are undocumented in source archives are never modified.
            </p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600" />
          Preferences updated and saved to local storage.
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {/* Section 1: Units and Formatting */}
        <Card className="p-6 border-[#dfe6dd]">
          <div className="flex items-center gap-2.5 border-b border-[#edf0eb] pb-3 mb-4">
            <Globe size={18} className="text-forest-700" />
            <h2 className="text-base font-bold text-ink">Units & Numerical Formatting</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Land Measurement System
              </label>
              <select
                value={localSettings.unitSystem}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    unitSystem: e.target.value as "Metric" | "Imperial",
                  })
                }
                className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:border-forest-600 focus:outline-hidden"
              >
                <option value="Metric">Metric (Hectares - ha)</option>
                <option value="Imperial">Imperial (Acres - ac, 1 ha = 2.471 ac)</option>
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                Applies to farm parcels. Current total farm area preview:{" "}
                <strong className="text-ink">{formatArea(totalAreaHa)}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Number & Currency Locale Grouping
              </label>
              <select
                value={localSettings.locale}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    locale: e.target.value as "en-US" | "en-IN",
                  })
                }
                className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:border-forest-600 focus:outline-hidden"
              >
                <option value="en-US">International / US (e.g. 100,000)</option>
                <option value="en-IN">Indian Standard (e.g. 1,00,000)</option>
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                Sample dataset rows count:{" "}
                <strong className="text-ink font-mono">{formatNumber(162916)}</strong>.
              </p>
            </div>
          </div>
        </Card>

        {/* Section 2: Workflow Automation & Advisory Rules */}
        <Card className="p-6 border-[#dfe6dd]">
          <div className="flex items-center gap-2.5 border-b border-[#edf0eb] pb-3 mb-4">
            <Sparkles size={18} className="text-forest-700" />
            <h2 className="text-base font-bold text-ink">Advisory Decision Workflow</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4">
              <div>
                <strong className="text-xs font-bold text-ink block">
                  Automatic Task Creation on Advisory Acceptance
                </strong>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  When enabled, accepting an advisory plan automatically generates a corresponding follow-up task with a pre-populated execution checklist in the Tasks board.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoTaskOnAccept}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autoTaskOnAccept: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-[#dfe6dd] text-forest-700 focus:ring-forest-600 mt-0.5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Advisory Risk Threshold Sensitivity
              </label>
              <select
                value={localSettings.riskSensitivity}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    riskSensitivity: e.target.value as FarmSettings["riskSensitivity"],
                  })
                }
                className="w-full sm:w-80 rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:border-forest-600 focus:outline-hidden"
              >
                <option value="Standard">Standard (Dataset benchmark medians)</option>
                <option value="Conservative">Conservative (Flag marginal deviations)</option>
                <option value="Aggressive">Aggressive (Prioritize yield maximization)</option>
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Governs advisory prioritization tags. Does not alter underlying raw research records.
              </p>
            </div>
          </div>
        </Card>

        {/* Section 3: Notification & Quality Audit Inbox */}
        <Card className="p-6 border-[#dfe6dd]">
          <div className="flex items-center gap-2.5 border-b border-[#edf0eb] pb-3 mb-4">
            <Shield size={18} className="text-forest-700" />
            <h2 className="text-base font-bold text-ink">Alert Inbox Filters</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4">
              <div>
                <strong className="text-xs font-bold text-ink block">
                  Show Dataset Provenance & Structural Audit Notices
                </strong>
                <p className="mt-0.5 text-xs text-slate-600">
                  Surface findings like timestamp duplication in CAF003 or image asymmetry in PlantVillage.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.alertDatasetAudits}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    alertDatasetAudits: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-[#dfe6dd] text-forest-700 focus:ring-forest-600 mt-0.5"
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#dfe6dd] bg-slate-50/70 p-4">
              <div>
                <strong className="text-xs font-bold text-ink block">
                  Show Hardware Telemetry Gateway Disconnection Warnings
                </strong>
                <p className="mt-0.5 text-xs text-slate-600">
                  Notify that live MQTT telemetry broker and LoRaWAN gateways are disconnected.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.alertHardwareStatus}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    alertHardwareStatus: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-[#dfe6dd] text-forest-700 focus:ring-forest-600 mt-0.5"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-forest-800 transition-colors"
          >
            <Save size={14} />
            Save Preferences
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-settings-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} />
              <h3 id="reset-settings-title" className="text-base font-bold text-ink">
                Reset Preferences to Defaults?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              This will restore Metric units (ha), en-US locale, and enable all standard audit notifications. Your farm parcels and tasks will not be affected.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetSettings();
                  setLocalSettings({
                    unitSystem: "Metric",
                    locale: "en-US",
                    autoTaskOnAccept: true,
                    riskSensitivity: "Standard",
                    alertDatasetAudits: true,
                    alertHardwareStatus: true,
                  });
                  setShowResetConfirm(false);
                }}
                className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
              >
                Reset Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
