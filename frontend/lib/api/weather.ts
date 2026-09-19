/**
 * Live Weather API Client for FarmOps AI
 * Integrates OpenWeather API (primary with user key) with fallback to Open-Meteo.
 */

export interface LiveWeatherData {
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  rainChance: number; // %
  condition: string; // e.g. "Partly Cloudy", "Sunny", "Light Rain"
  weatherCode: number;
  locationName: string;
  lastUpdated: string;
  source?: "OpenWeather" | "Open-Meteo";
}

let cachedWeather: { data: LiveWeatherData; timestamp: number } | null = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const OPENWEATHER_API_KEY =
  process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "18e4d04c2f83a4bef4d0fb23338443f5";

/**
 * Fetch from OpenWeatherMap 2.5 Current Weather API using user's key
 */
async function fetchOpenWeather(
  latitude: number,
  longitude: number,
  locationName: string
): Promise<LiveWeatherData | null> {
  if (!OPENWEATHER_API_KEY) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 180 } });
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`OpenWeather returned status ${res.status}: ${errBody}`);
      return null;
    }

    const data = await res.json();
    const weather = data.weather?.[0] || {};
    const main = data.main || {};
    const wind = data.wind || {};
    const clouds = data.clouds || {};

    // Wind speed: OpenWeather returns m/s in metric mode, convert to km/h (1 m/s = 3.6 km/h)
    const windKmH = Math.round((wind.speed ?? 3.3) * 3.6);

    // Condition mapping
    const condition = weather.main === "Clear" ? "Clear Sky" : weather.description
      ? weather.description.replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Partly Cloudy";

    return {
      temperature: Math.round(main.temp ?? 28),
      humidity: Math.round(main.humidity ?? 60),
      windSpeed: windKmH,
      rainChance: clouds.all ? Math.min(100, Math.round(clouds.all * 0.8)) : 10,
      condition,
      weatherCode: weather.id ?? 800,
      locationName: data.name ? `${data.name}, ${data.sys?.country || "IN"}` : locationName,
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "OpenWeather",
    };
  } catch (err) {
    console.warn("OpenWeather request failed:", err);
    return null;
  }
}

/**
 * Fetch from Open-Meteo as fallback
 */
async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
  locationName: string
): Promise<LiveWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation_probability`;
  const res = await fetch(url, { next: { revalidate: 180 } });
  if (!res.ok) {
    throw new Error(`Open-Meteo fetch failed: ${res.statusText}`);
  }

  const json = await res.json();
  const current = json.current || {};

  function interpretWeatherCode(code: number): string {
    if (code === 0) return "Clear Sky";
    if (code === 1) return "Mainly Clear";
    if (code === 2) return "Partly Cloudy";
    if (code === 3) return "Overcast";
    if ([45, 48].includes(code)) return "Foggy";
    if ([51, 53, 55].includes(code)) return "Light Drizzle";
    if ([61, 63, 65].includes(code)) return "Rainy";
    if ([71, 73, 75].includes(code)) return "Snowfall";
    if ([80, 81, 82].includes(code)) return "Rain Showers";
    if ([95, 96, 99].includes(code)) return "Thunderstorm";
    return "Partly Cloudy";
  }

  return {
    temperature: Math.round(current.temperature_2m ?? 28),
    humidity: Math.round(current.relative_humidity_2m ?? 62),
    windSpeed: Math.round(current.wind_speed_10m ?? 12),
    rainChance: Math.round(current.precipitation_probability ?? 10),
    condition: interpretWeatherCode(current.weather_code ?? 2),
    weatherCode: current.weather_code ?? 2,
    locationName,
    lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    source: "Open-Meteo",
  };
}

export async function getLiveWeather(
  latitude = 23.0225,
  longitude = 72.5714,
  locationName = "Ahmedabad, Gujarat"
): Promise<LiveWeatherData> {
  const now = Date.now();
  if (cachedWeather && now - cachedWeather.timestamp < CACHE_TTL_MS) {
    return cachedWeather.data;
  }

  // 1. Try OpenWeather first with user API key
  const owData = await fetchOpenWeather(latitude, longitude, locationName);
  if (owData) {
    cachedWeather = { data: owData, timestamp: now };
    return owData;
  }

  // 2. Fallback to Open-Meteo
  try {
    const omData = await fetchOpenMeteo(latitude, longitude, locationName);
    cachedWeather = { data: omData, timestamp: now };
    return omData;
  } catch (err) {
    console.warn("Fallback to static weather data:", err);
    return {
      temperature: 28,
      humidity: 62,
      windSpeed: 12,
      rainChance: 10,
      condition: "Partly Cloudy",
      weatherCode: 2,
      locationName,
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "Open-Meteo",
    };
  }
}
