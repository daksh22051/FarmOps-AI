import type { SensorEventResponse } from "../types/api";

// Canonical Measurement Aliases matching backend schemas/telemetry.py
export const MEASUREMENT_ALIASES: Record<string, string> = {
  // Soil Moisture
  soil_moisture: "soil_moisture",
  soilmoisture: "soil_moisture",
  "soil-moisture": "soil_moisture",
  moisture: "soil_moisture",
  soil_water: "soil_moisture",
  // Temperature
  temperature: "temperature",
  temp: "temperature",
  air_temperature: "temperature",
  air_temp: "temperature",
  // Humidity
  humidity: "humidity",
  relative_humidity: "humidity",
  rel_humidity: "humidity",
  rh: "humidity",
  // Rainfall
  rainfall: "rainfall",
  rain: "rainfall",
  precipitation: "rainfall",
  // pH
  ph: "ph",
  soil_ph: "ph",
  ph_level: "ph",
  // Nitrogen
  nitrogen: "nitrogen",
  n: "nitrogen",
  nitro: "nitrogen",
  // Phosphorus
  phosphorus: "phosphorus",
  p: "phosphorus",
  phos: "phosphorus",
  // Potassium
  potassium: "potassium",
  k: "potassium",
  potass: "potassium",
};

export const CANONICAL_METRIC_METADATA: Record<
  string,
  { label: string; defaultUnit: string; precision: number }
> = {
  soil_moisture: { label: "Soil Moisture", defaultUnit: "%", precision: 1 },
  temperature: { label: "Temperature", defaultUnit: "°C", precision: 1 },
  humidity: { label: "Relative Humidity", defaultUnit: "%", precision: 1 },
  rainfall: { label: "Rainfall", defaultUnit: "mm", precision: 1 },
  ph: { label: "Soil pH", defaultUnit: "pH", precision: 2 },
  nitrogen: { label: "Nitrogen (N)", defaultUnit: "mg/kg", precision: 1 },
  phosphorus: { label: "Phosphorus (P)", defaultUnit: "mg/kg", precision: 1 },
  potassium: { label: "Potassium (K)", defaultUnit: "mg/kg", precision: 1 },
};

export function normalizeMetricKey(rawKey: string): string {
  const clean = rawKey.trim().toLowerCase().replace(/-/g, "_");
  return MEASUREMENT_ALIASES[clean] || clean;
}

export interface LatestMeasurement {
  value: number;
  unit: string;
  timestamp: string; // ISO-8601
  deviceId: string;
  zoneId?: string | null;
  quality?: string;
}

/**
 * Extracts the latest measurement for each canonical metric from a list of sensor events.
 * Expects events to be sorted newest first (descending event_at), but sorts defensively.
 */
export function extractLatestMeasurements(
  events: SensorEventResponse[]
): Record<string, LatestMeasurement> {
  if (!events || events.length === 0) {
    return {};
  }

  // Sort descending by event_at
  const sorted = [...events].sort(
    (a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime()
  );

  const latest: Record<string, LatestMeasurement> = {};

  for (const event of sorted) {
    // 1. Check metric & value pair from SensorEventResponse
    if (event.metric && typeof event.value === "number") {
      const canonicalKey = normalizeMetricKey(event.metric);
      if (!latest[canonicalKey]) {
        latest[canonicalKey] = {
          value: event.value,
          unit: event.unit || CANONICAL_METRIC_METADATA[canonicalKey]?.defaultUnit || "",
          timestamp: event.event_at,
          deviceId: event.device_id,
          zoneId: event.zone_id,
          quality: event.quality,
        };
      }
    }

    // 2. Check flattened properties if present (e.g. soil_moisture, temperature, etc.)
    const flattenedKeys: Array<keyof SensorEventResponse> = [
      "soil_moisture",
      "temperature",
      "humidity",
      "rainfall",
      "ph",
      "nitrogen",
      "phosphorus",
      "potassium",
    ];

    for (const key of flattenedKeys) {
      const val = event[key];
      if (typeof val === "number" && !latest[key]) {
        latest[key] = {
          value: val,
          unit: CANONICAL_METRIC_METADATA[key]?.defaultUnit || "",
          timestamp: event.event_at,
          deviceId: event.device_id,
          zoneId: event.zone_id,
          quality: event.quality,
        };
      }
    }
  }

  return latest;
}

/**
 * Formats a measurement value with appropriate units and precision.
 */
export function formatMeasurementValue(
  metricKey: string,
  measurement?: LatestMeasurement | null
): string {
  if (!measurement || typeof measurement.value !== "number" || isNaN(measurement.value)) {
    return "No data";
  }

  const meta = CANONICAL_METRIC_METADATA[metricKey];
  const precision = meta?.precision ?? 1;
  const unit = measurement.unit || meta?.defaultUnit || "";

  return `${measurement.value.toFixed(precision)} ${unit}`.trim();
}

/**
 * Returns human-readable relative time or formatted timestamp.
 */
export function formatFreshness(isoString?: string | null): string {
  if (!isoString) return "No timestamp";

  try {
    const time = new Date(isoString).getTime();
    if (isNaN(time)) return "Invalid date";

    const diffSec = Math.floor((Date.now() - time) / 1000);

    if (diffSec < 0) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}
