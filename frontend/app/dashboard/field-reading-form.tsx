"use client";
import { useState } from "react";
import { createDevice, createTelemetryEvent, detectRisks, getDevices } from "../../lib/api/farmops";
import type { DashboardZone } from "../../lib/api/dashboard";

const fields = [
  ["soil_moisture", "Soil moisture (%)", 0, 100], ["temperature", "Temperature (°C)", -50, 70],
  ["humidity", "Humidity (%)", 0, 100], ["rainfall", "Rainfall (mm)", 0, 10000],
  ["ph", "Soil pH", 0, 14], ["nitrogen", "Nitrogen (mg/kg)", 0, 100000],
  ["phosphorus", "Phosphorus (mg/kg)", 0, 100000], ["potassium", "Potassium (mg/kg)", 0, 100000],
] as const;

export function FieldReadingForm({ farmId, zones, onSaved, onClose }: {
  farmId: string; zones: DashboardZone[]; onSaved: (message: string) => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const zoneId = String(form.get("zone") || "") || null;
    const measurements: Record<string, number> = {};
    fields.forEach(([key]) => { const value = String(form.get(key) || "").trim(); if (value !== "") measurements[key] = Number(value); });
    if (!Object.keys(measurements).length) { setError("Enter at least one measured value."); return; }
    const measuredAt = new Date(String(form.get("measuredAt")));
    if (!Number.isFinite(measuredAt.getTime()) || measuredAt.getTime() > Date.now()) { setError("Use the actual measurement time, not a future time."); return; }
    setBusy(true); setError(null);
    let saved = false;
    try {
      const devices = await getDevices(farmId);
      if (!devices.success || !devices.data) throw new Error("Unable to load reading sources.");
      let device = devices.data.find(d => (d.zone_id || null) === zoneId && d.calibration?.source === "manual_field_reading" && d.enabled);
      if (!device) {
        const created = await createDevice(farmId, { zone_id: zoneId, device_type: "other", calibration: { source: "manual_field_reading" } });
        if (!created.success || !created.data) throw new Error("Unable to register field reading source.");
        device = created.data;
      }
      const result = await createTelemetryEvent({ device_id: device.id, sequence: Math.floor(Date.now() / 1000),
        event_timestamp: measuredAt.toISOString(), measurements, metadata: { source: "manual_field_reading", notes: String(form.get("notes") || "") } });
      if (!result.success || !result.data) throw new Error(result.message || "Reading could not be saved.");
      if (result.data.duplicate) throw new Error("This source already has a reading for this second. Wait a moment and submit again.");
      saved = true;
      const scan = await detectRisks({ farm_id: farmId, zone_id: zoneId });
      if (!scan.success) throw new Error(scan.message || "Risk scan failed.");
      onSaved("Field readings saved and risk assessment updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save readings.";
      if (saved) onSaved(`Readings saved. Risk scan failed: ${message} Use Scan risks to retry.`);
      else setError(message);
    } finally { setBusy(false); }
  }
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <section className="rounded-2xl border border-emerald-200 bg-white p-5">
    <h2 className="font-bold text-lg">Record field readings</h2>
    <p className="text-sm text-slate-500 mt-1">Enter only measurements you actually took. Leave unmeasured values blank. These are saved as manual observations, not connected sensors.</p>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Zone<select name="zone" className="mt-1 w-full rounded-lg border p-2.5"><option value="">Farm-wide</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Measurement time (your local time)<input name="measuredAt" type="datetime-local" required defaultValue={localNow} max={localNow} className="mt-1 w-full rounded-lg border p-2.5" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([key, label, min, max]) => <label key={key} className="text-xs font-semibold">{label}<input name={key} type="number" step="any" min={min} max={max} placeholder="Not measured" className="mt-1 w-full rounded-lg border p-2.5" /></label>)}</div>
      <label className="block text-xs font-semibold">Measurement notes<input name="notes" maxLength={1000} placeholder="Instrument, sampling location, or field observations" className="mt-1 w-full rounded-lg border p-2.5" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Saving & assessing…" : "Save readings & assess risks"}</button><button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 text-sm">Cancel</button></div>
    </form>
  </section>;
}
