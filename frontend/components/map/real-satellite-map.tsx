"use client";

import React, { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import {
  MapPin,
  Pencil,
  RotateCcw,
  Trash2,
  Navigation,
  Search,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RealMapData {
  farmPin: GeoPoint | null;
  boundaryPoints: GeoPoint[];
  areaHectares: number;
  areaAcres: number;
  perimeterKm: number;
  latitude: number;
  longitude: number;
  locationName: string;
}

interface RealSatelliteMapProps {
  initialCenter?: GeoPoint;
  initialZoom?: number;
  data: RealMapData;
  onChange: (updated: Partial<RealMapData>) => void;
  height?: string;
  readOnly?: boolean;
}

const AGRICULTURAL_HUBS = [
  { name: "Ahmedabad, Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Nashik, Maharashtra", lat: 19.9975, lng: 73.7898 },
  { name: "Ludhiana, Punjab", lat: 30.901, lng: 75.8573 },
  { name: "Karnal, Haryana", lat: 29.6857, lng: 76.9905 },
  { name: "Surat, Gujarat", lat: 21.1702, lng: 72.8311 },
  { name: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { name: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873 },
];

const EARTH_RADIUS = 6378137;

export function calculateGeodesicArea(coords: GeoPoint[]): {
  areaHectares: number;
  areaAcres: number;
  perimeterKm: number;
} {
  if (coords.length < 3) {
    return { areaHectares: 0, areaAcres: 0, perimeterKm: 0 };
  }

  let totalAngle = 0;
  let perimeterMeters = 0;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = coords[i];
    const p2 = coords[j];

    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;

    const dLat = lat2 - lat1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    perimeterMeters += EARTH_RADIUS * c;

    totalAngle += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaMeters = Math.abs((totalAngle * EARTH_RADIUS * EARTH_RADIUS) / 4);
  const hectares = Math.round((areaMeters / 10000) * 100) / 100;
  const acres = Math.round(hectares * 2.47105 * 100) / 100;
  const perimeterKm = Math.round((perimeterMeters / 1000) * 100) / 100;

  return {
    areaHectares: Math.max(0.1, hectares),
    areaAcres: Math.max(0.25, acres),
    perimeterKm: Math.max(0.1, perimeterKm),
  };
}

export function RealSatelliteMap({
  initialCenter,
  initialZoom = 15,
  data,
  onChange,
  height = "460px",
  readOnly = false,
}: RealSatelliteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);

  const [mode, setMode] = useState<"pin" | "draw">("pin");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let isMounted = true;

    async function initMap() {
      const L = (await import("leaflet")).default;

      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const centerLat = data.latitude || initialCenter?.lat || 23.0225;
      const centerLng = data.longitude || initialCenter?.lng || 72.5714;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false,
      });

      // Esri World Imagery Satellite Tiles
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          subdomains: ["server", "services"],
        }
      ).addTo(map);

      // Boundaries & Place Labels Overlay
      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
        }
      ).addTo(map);

      mapInstanceRef.current = map;
      if (isMounted) setIsMapReady(true);

      // Handle map clicks
      map.on("click", (e: L.LeafletMouseEvent) => {
        if (readOnly) return;
        const clickedLat = Math.round(e.latlng.lat * 100000) / 100000;
        const clickedLng = Math.round(e.latlng.lng * 100000) / 100000;

        // In PIN mode: place farm center
        if (mode === "pin") {
          const newPin = { lat: clickedLat, lng: clickedLng };
          onChange({
            farmPin: newPin,
            latitude: clickedLat,
            longitude: clickedLng,
          });
        }
        // In DRAW mode: append boundary point
        else if (mode === "draw") {
          const updatedPoints = [...data.boundaryPoints, { lat: clickedLat, lng: clickedLng }];
          const metrics = calculateGeodesicArea(updatedPoints);
          onChange({
            boundaryPoints: updatedPoints,
            ...metrics,
          });
        }
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Pin Marker
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    import("leaflet").then((LModule) => {
      const L = LModule.default;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (data.farmPin) {
        const pinIcon = L.divIcon({
          className: "custom-farm-pin",
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
              <div style="background:#059669; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; box-shadow:0 2px 6px rgba(0,0,0,0.3); border:1.5px solid white; white-space:nowrap; margin-bottom:2px;">
                📍 Farm Center
              </div>
              <div style="width:16px; height:16px; border-radius:50%; background:#10b981; border:3px solid white; box-shadow:0 0 10px #10b981; animation:pulse 1.5s infinite;"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 20],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([data.farmPin.lat, data.farmPin.lng]);
        } else {
          markerRef.current = L.marker([data.farmPin.lat, data.farmPin.lng], { icon: pinIcon }).addTo(map);
        }
      } else if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    });
  }, [isMapReady, data.farmPin]);

  // Update Polygon / Boundary Display
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    import("leaflet").then((LModule) => {
      const L = LModule.default;
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing boundary layers
      if (polygonRef.current) {
        polygonRef.current.remove();
        polygonRef.current = null;
      }
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      vertexMarkersRef.current.forEach((m) => m.remove());
      vertexMarkersRef.current = [];

      const latLngs = data.boundaryPoints.map((p) => [p.lat, p.lng] as [number, number]);

      if (latLngs.length >= 3) {
        polygonRef.current = L.polygon(latLngs, {
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.35,
          weight: 3.5,
          dashArray: undefined,
        }).addTo(map);
      } else if (latLngs.length > 0) {
        polylineRef.current = L.polyline(latLngs, {
          color: "#10b981",
          weight: 3.5,
          dashArray: "6, 6",
        }).addTo(map);
      }

      // Add vertex dot markers
      data.boundaryPoints.forEach((pt, idx) => {
        const dotIcon = L.divIcon({
          className: "custom-vertex-dot",
          html: `<div style="width:10px; height:10px; border-radius:50%; background:#34d399; border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        const m = L.marker([pt.lat, pt.lng], { icon: dotIcon }).addTo(map);
        vertexMarkersRef.current.push(m);
      });
    });
  }, [isMapReady, data.boundaryPoints]);

  // Search Location via OpenStreetMap Nominatim
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapInstanceRef.current) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=in&limit=1`
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const item = results[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
        onChange({
          latitude: lat,
          longitude: lng,
          locationName: item.display_name.split(",")[0],
          farmPin: { lat, lng },
        });
      } else {
        alert("Location not found. Please try a nearby city or district name.");
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // GPS Locate
  const handleUseGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.5 });
        }

        onChange({
          latitude: lat,
          longitude: lng,
          locationName: `GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
          farmPin: { lat, lng },
        });
      },
      (err) => {
        setIsLocating(false);
        alert("Unable to fetch your GPS coordinates. Please select your region.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Quick Hub Fly-To
  const handleSelectHub = (hub: (typeof AGRICULTURAL_HUBS)[0]) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([hub.lat, hub.lng], 16, { duration: 1.5 });
    }
    onChange({
      latitude: hub.lat,
      longitude: hub.lng,
      locationName: hub.name,
      farmPin: { lat: hub.lat, lng: hub.lng },
    });
  };

  // Undo Last Point
  const handleUndoPoint = () => {
    if (data.boundaryPoints.length === 0) return;
    const updated = data.boundaryPoints.slice(0, -1);
    const metrics = calculateGeodesicArea(updated);
    onChange({
      boundaryPoints: updated,
      ...metrics,
    });
  };

  // Clear Boundary
  const handleClearBoundary = () => {
    onChange({
      boundaryPoints: [],
      areaHectares: 0,
      areaAcres: 0,
      perimeterKm: 0,
    });
  };

  return (
    <div className="space-y-3">
      {/* Top Map Action Toolbar */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Bar */}
          <form onSubmit={handleSearchLocation} className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your village, tehsil, or district in India..."
              className="w-full pl-9 pr-20 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSearching ? "..." : "Fly To"}
            </button>
          </form>

          {/* GPS Button & Mode Toggles */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleUseGPS}
              disabled={isLocating}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Locate via GPS"
            >
              <Navigation size={13} className={isLocating ? "animate-spin text-emerald-600" : "text-emerald-600"} />
              <span>{isLocating ? "Locating..." : "Use My GPS"}</span>
            </button>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setMode("pin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  mode === "pin"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MapPin size={12} className={mode === "pin" ? "text-emerald-600" : ""} />
                <span>1. Pin Center</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("draw")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  mode === "draw"
                    ? "bg-white text-emerald-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Pencil size={12} className={mode === "draw" ? "text-emerald-600" : ""} />
                <span>2. Draw Boundary</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regional Quick Chips */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 shrink-0">
            Farming Hubs:
          </span>
          {AGRICULTURAL_HUBS.map((hub) => (
            <button
              type="button"
              key={hub.name}
              onClick={() => handleSelectHub(hub)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-slate-700 text-xs font-semibold shrink-0 transition-all cursor-pointer"
            >
              {hub.name.split(",")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Real Satellite Map Canvas */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-md bg-slate-950"
        style={{ height }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Instruction / Status Badge */}
        {!readOnly && (
          <div className="absolute top-3 left-3 z-20 bg-black/75 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/20 text-xs font-medium flex items-center gap-2 pointer-events-none">
            {mode === "pin" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Click satellite map to place your <strong>Farm Center Pin</strong></span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Click points around your field to draw boundary ({data.boundaryPoints.length} points)
                </span>
              </>
            )}
          </div>
        )}

        {/* Boundary Editing Tools (Floating Bottom Bar) */}
        {!readOnly && mode === "draw" && data.boundaryPoints.length > 0 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/20 shadow-lg">
            <button
              type="button"
              onClick={handleUndoPoint}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClearBoundary}
              className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* Real Coordinates & Acreage Telemetry Display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Latitude
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-slate-900 block">
            {data.latitude ? `${data.latitude.toFixed(4)}° N` : "--"}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Longitude
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-slate-900 block">
            {data.longitude ? `${data.longitude.toFixed(4)}° E` : "--"}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Geodesic Area
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-emerald-700 block">
            {data.areaHectares} Ha
          </span>
          <span className="text-[10px] text-slate-500 font-semibold block">
            ({data.areaAcres} Acres)
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Perimeter
          </span>
          <span className="mt-0.5 text-sm font-extrabold text-slate-900 block">
            {data.perimeterKm} km
          </span>
        </div>
      </div>
    </div>
  );
}
