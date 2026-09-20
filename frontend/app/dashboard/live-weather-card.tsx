"use client";
import { useEffect, useState } from "react";
import { CloudSun, RefreshCw } from "lucide-react";
import { useFarm } from "../../context/farm-context";
import { farmCoordinates, fetchFarmWeather, type FarmWeather } from "../../lib/api/farm-weather";

export function LiveWeatherCard() {
  const { selectedFarm } = useFarm();
  const [weather, setWeather] = useState<FarmWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const coordinates = selectedFarm ? farmCoordinates(selectedFarm) : null;
  const lat = coordinates?.[0], lon = coordinates?.[1];

  useEffect(() => {
    let active = true;
    setWeather(null); setError(null);
    if (lat === undefined || lon === undefined) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetchFarmWeather(lat, lon, controller.signal)
      .then(data => { if (active) setWeather(data); })
      .catch(err => {
        if (active) setError(controller.signal.aborted ? "Weather request timed out." : err instanceof Error ? err.message : "Weather unavailable.");
      })
      .finally(() => clearTimeout(timeout));
    const timer = setInterval(() => setAttempt(n => n + 1), 300000);
    return () => { active = false; controller.abort(); clearTimeout(timeout); clearInterval(timer); };
  }, [lat, lon, attempt, selectedFarm?.id]);

  return (
    <section className="glass-card rounded-2xl p-5 h-full bg-white border border-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 flex gap-2 items-center">
          <CloudSun size={19} className="text-amber-500" />
          Weather
        </h2>
        <button
          type="button"
          aria-label="Refresh weather"
          onClick={() => setAttempt(n => n + 1)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        {selectedFarm?.location || selectedFarm?.name} · Farm coordinates
      </p>

      {!coordinates ? (
        <p className="mt-5 text-sm text-slate-500">
          Add farm coordinates or a boundary in your farm profile to load local weather.
        </p>
      ) : error ? (
        <p role="status" className="mt-5 text-sm text-amber-600">{error}</p>
      ) : !weather ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw size={14} className="animate-spin text-emerald-600" /> Fetching forecast…
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-end gap-3">
            <strong className="text-4xl tracking-tight text-emerald-700 font-extrabold">
              {weather.temperature.toFixed(1)}°C
            </strong>
            <span className="text-sm text-slate-600 pb-1 font-medium">{weather.condition}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 my-5 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-medium">Humidity</p>
              <b className="text-slate-800 font-bold">{weather.humidity}%</b>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Rain · current</p>
              <b className="text-slate-800 font-bold">{weather.rain} mm</b>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Wind</p>
              <b className="text-slate-800 font-bold">{weather.wind} km/h</b>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-3 gap-2">
            {weather.forecast.map(day => (
              <div key={day.date} className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs hover:bg-slate-100/60 transition shadow-xs">
                <p className="font-bold text-slate-800">
                  {new Date(day.date).toLocaleDateString([], { weekday: "short", timeZone: selectedFarm?.timezone || "UTC" })}
                </p>
                <p className="my-1 text-slate-600 font-semibold">{Math.round(day.min)}–{Math.round(day.max)}°C</p>
                <p className="text-blue-600 font-medium">{day.chance}% rain</p>
                <p className="text-slate-400">{day.rain} mm</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Data from{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline text-blue-600 hover:text-blue-800">
              Open-Meteo
            </a>{" "}
            · {new Date(weather.observedAt).toLocaleString()} · Not a field sensor reading.
          </p>
        </>
      )}
    </section>
  );
}
