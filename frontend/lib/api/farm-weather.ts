import type { Farm } from "../../types/api";

export interface FarmWeather {
  temperature: number; humidity: number; rain: number; wind: number; condition: string;
  observedAt: string; forecast: { date: string; min: number; max: number; rain: number; chance: number }[];
}
export function farmCoordinates(farm: Farm): [number, number] | null {
  const profile = farm.crop_profile;
  const lat = profile?.latitude, lon = profile?.longitude;
  if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lat, lon];
  const points: number[][] = [];
  function visit(value: unknown) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") points.push(value as number[]);
    else value.forEach(visit);
  }
  visit(farm.boundary_geometry?.coordinates);
  if (points.length) {
    const latitude = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const longitude = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return [latitude, longitude];
    }
  }
  const rawLoc = farm.location || (profile && typeof (profile as Record<string, unknown>).city === "string" ? (profile as Record<string, unknown>).city : "") || "";
  const loc = String(rawLoc).toLowerCase();
  if (loc.includes("shilaj")) return [23.0500, 72.4800];
  if (loc.includes("ahmedabad")) return [23.0225, 72.5714];
  if (loc.includes("surat")) return [21.1702, 72.8311];
  if (loc.includes("rajkot")) return [22.3039, 70.8022];
  if (loc.includes("vadodara") || loc.includes("baroda")) return [22.3072, 73.1812];
  if (loc.includes("punjab") || loc.includes("ludhiana")) return [30.9010, 75.8573];
  if (loc.includes("haryana") || loc.includes("karnal")) return [29.6857, 76.9905];
  if (loc.includes("maharashtra") || loc.includes("pune")) return [18.5204, 73.8567];
  // Default regional farm coordinates (Ahmedabad / Western Agri Belt)
  return [23.0225, 72.5714];
}
function condition(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 86) return "Showers";
  return "Thunderstorm";
}
const cache = new Map<string, { time: number; data: FarmWeather }>();
export async function fetchFarmWeather(lat: number, lon: number, signal: AbortSignal): Promise<FarmWeather> {
  const key = `${lat},${lon}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < 180000) return cached.data;
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,rain,wind_speed_10m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    forecast_days: "3", timezone: "auto", timeformat: "unixtime" });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error("Weather provider is unavailable. Please retry.");
  const json = await response.json();
  const c = json.current, d = json.daily;
  const required = [c?.temperature_2m, c?.relative_humidity_2m, c?.rain, c?.wind_speed_10m, c?.weather_code, c?.time];
  if (!required.every(v => typeof v === "number" && Number.isFinite(v)) || !Array.isArray(d?.time)) throw new Error("Weather provider returned incomplete measurements.");
  const data: FarmWeather = { temperature: c.temperature_2m, humidity: c.relative_humidity_2m, rain: c.rain,
    wind: c.wind_speed_10m, condition: condition(c.weather_code), observedAt: new Date(c.time * 1000).toISOString(),
    forecast: d.time.map((time: number, i: number) => ({ date: new Date(time * 1000).toISOString(),
      min: d.temperature_2m_min[i], max: d.temperature_2m_max[i], rain: d.precipitation_sum[i], chance: d.precipitation_probability_max[i] })) };
  if (!data.forecast.every(day => [day.min, day.max, day.rain, day.chance].every(v => typeof v === "number" && Number.isFinite(v)))) throw new Error("Forecast is incomplete. Please retry.");
  cache.set(key, { time: Date.now(), data });
  return data;
}
