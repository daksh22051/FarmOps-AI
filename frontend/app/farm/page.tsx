"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm, type FarmZone } from "../../context/farm-context";
import { AuthModal } from "../../components/auth-modal";
import { ApiClientError } from "../../lib/api/client";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Cpu,
  Edit2,
  Info,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sprout,
  Trash2,
  X,
} from "lucide-react";

export default function MyFarmPage() {
  const {
    farm,
    totalAreaHa,
    activeZoneCount,
    updateProfile,
    addZone,
    updateZone,
    deleteZone,
    loadDemoFarm,
    clearFarm,
    formatArea,
    settings,
    currentUser,
    backendFarms,
    selectedFarmId,
    selectedFarm,
    backendZones,
    devices,
    isLoadingFarms,
    isLoadingFarm,
    isLoadingZones,
    isLoadingDevices,
    farmError,
    devicesError,
    selectFarm,
    updateBackendZone,
    refreshDevices,
  } = useFarm();

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Profile Edit Modal State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(farm.name);
  const [profileDistrict, setProfileDistrict] = useState(farm.district);
  const [profileSoil, setProfileSoil] = useState(farm.primarySoil);
  const [profileError, setProfileError] = useState("");

  // Zone Add/Edit Modal State
  const [zoneModalMode, setZoneModalMode] = useState<"add" | "edit" | null>(null);
  const [targetZoneId, setTargetZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneArea, setZoneArea] = useState("4.0");
  const [zoneCrop, setZoneCrop] = useState("Soybean");
  const [zoneSoil, setZoneSoil] = useState("Clay Loam");
  const [zoneIrrigation, setZoneIrrigation] = useState<FarmZone["irrigation"]>("Drip");
  const [zoneStatus, setZoneStatus] = useState<FarmZone["status"]>("Active Cultivation");
  const [zoneFormError, setZoneFormError] = useState("");
  const [isSavingZone, setIsSavingZone] = useState(false);

  // Delete Confirmation State
  const [deletingZone, setDeletingZone] = useState<FarmZone | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Open Edit Profile
  const openEditProfile = () => {
    setProfileName(farm.name);
    setProfileDistrict(farm.district);
    setProfileSoil(farm.primarySoil);
    setProfileError("");
    setEditingProfile(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError("Farm title cannot be empty.");
      return;
    }
    if (!profileDistrict.trim()) {
      setProfileError("District / Location cannot be empty.");
      return;
    }
    updateProfile(profileName, profileDistrict, profileSoil);
    setEditingProfile(false);
  };

  // Open Add Zone (unit aware)
  const openAddZone = () => {
    setZoneModalMode("add");
    setTargetZoneId(null);
    setZoneName("");
    setZoneArea(settings.unitSystem === "Imperial" ? "8.6" : "3.5");
    setZoneCrop("Wheat");
    setZoneSoil("Clay Loam");
    setZoneIrrigation("Drip");
    setZoneStatus("Active Cultivation");
    setZoneFormError("");
  };

  // Open Edit Zone (unit aware)
  const openEditZone = (zone: FarmZone) => {
    setZoneModalMode("edit");
    setTargetZoneId(zone.id);
    setZoneName(zone.name);
    const displayArea =
      settings.unitSystem === "Imperial"
        ? (Math.round(zone.areaHa * 2.47105 * 10) / 10).toString()
        : zone.areaHa.toString();
    setZoneArea(displayArea);
    setZoneCrop(zone.crop);
    setZoneSoil(zone.soilType);
    setZoneIrrigation(zone.irrigation);
    setZoneStatus(zone.status);
    setZoneFormError("");
  };

  // Save Zone Form (unit aware with real backend PATCH)
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setZoneFormError("");

    if (!zoneName.trim()) {
      setZoneFormError("Parcel / Zone name is required.");
      return;
    }
    const parsedArea = parseFloat(zoneArea);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      setZoneFormError("Please enter a valid positive area number.");
      return;
    }

    // Convert to hectares for underlying storage if in Imperial mode
    const areaHa =
      settings.unitSystem === "Imperial"
        ? Math.round((parsedArea / 2.47105) * 100) / 100
        : parsedArea;

    if (zoneModalMode === "add") {
      const res = addZone({
        name: zoneName,
        areaHa,
        crop: zoneCrop,
        soilType: zoneSoil,
        irrigation: zoneIrrigation,
        status: zoneStatus,
      });
      if (!res.success) {
        setZoneFormError(res.error || "Failed to create zone.");
        return;
      }
      setSuccessNotification(`Field zone "${zoneName.trim()}" added successfully.`);
      setTimeout(() => setSuccessNotification(null), 4000);
    } else if (zoneModalMode === "edit" && targetZoneId) {
      // If this zone is backed by the real FastAPI backend, call PATCH /zones/{zone_id}
      if (selectedFarm && backendZones.some((bz) => bz.id === targetZoneId)) {
        setIsSavingZone(true);
        const res = await updateBackendZone(targetZoneId, {
          name: zoneName.trim(),
          area: areaHa,
          crop: zoneCrop.trim(),
          status:
            zoneStatus === "Active Cultivation"
              ? "active"
              : zoneStatus === "Fallow / Resting"
              ? "fallow"
              : "quarantine",
        });
        setIsSavingZone(false);
        if (!res.success) {
          setZoneFormError(res.error || "Failed to update zone on backend.");
          return;
        }
        setSuccessNotification(`Zone "${zoneName.trim()}" updated successfully via backend API.`);
        setTimeout(() => setSuccessNotification(null), 4000);
        setZoneModalMode(null);
        return;
      }

      const res = updateZone(targetZoneId, {
        name: zoneName,
        areaHa,
        crop: zoneCrop,
        soilType: zoneSoil,
        irrigation: zoneIrrigation,
        status: zoneStatus,
      });
      if (!res.success) {
        setZoneFormError(res.error || "Failed to update zone.");
        return;
      }
      setSuccessNotification(`Zone "${zoneName.trim()}" updated.`);
      setTimeout(() => setSuccessNotification(null), 3000);
    }

    setZoneModalMode(null);
  };

  // Confirm Delete Zone
  const handleConfirmDelete = () => {
    if (deletingZone) {
      deleteZone(deletingZone.id);
      setDeletingZone(null);
      setSuccessNotification(`Zone "${deletingZone.name}" deleted.`);
      setTimeout(() => setSuccessNotification(null), 3000);
    }
  };

  return (
    <AppShell title="My Farm">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Farm Hierarchy & Land Registry
            </span>
            {currentUser && selectedFarm ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                {selectedFarm.is_demo ? "Demo Farm (Backend)" : "Live Backend Farm"}
              </span>
            ) : farm.isDemoData ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Seeded Demo Profile
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                User Configured (Local)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">
              {selectedFarm ? selectedFarm.name : farm.name}
            </h1>

            {/* Farm Selector if user has multiple backend farms */}
            {backendFarms.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <Building2 size={15} className="text-forest-600" />
                <select
                  id="farm-select-dropdown"
                  value={selectedFarmId || ""}
                  onChange={(e) => selectFarm(e.target.value)}
                  className="rounded-xl border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs focus:border-forest-600 focus:outline-none"
                >
                  {backendFarms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.location ? `(${f.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-forest-600" />
              {selectedFarm?.location || farm.district}
            </span>
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-forest-600" />
              Soil: {(selectedFarm?.crop_profile?.primary_soil as string) || farm.primarySoil}
            </span>
            {selectedFarm?.timezone && (
              <span className="text-slate-400">
                Timezone: {selectedFarm.timezone}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!currentUser && (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-forest-300 bg-forest-50 px-3.5 py-2 text-xs font-semibold text-forest-800 shadow-2xs hover:bg-forest-100"
            >
              Sign In (Connect Live Backend)
            </button>
          )}
          <button
            type="button"
            onClick={openEditProfile}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Edit2 size={14} />
            Edit Farm Details
          </button>
          <button
            type="button"
            onClick={openAddZone}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800"
          >
            <Plus size={14} />
            Add Field Zone
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successNotification && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}

      {/* Loading Banner */}
      {(isLoadingFarms || isLoadingFarm || isLoadingZones) && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50/70 p-3 text-xs font-medium text-forest-800">
          <Loader2 size={16} className="animate-spin text-forest-700 shrink-0" />
          <span>Syncing authoritative farm and zone data with FastAPI backend...</span>
        </div>
      )}

      {/* Error Handling Banner */}
      {farmError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-bold">
                {farmError instanceof ApiClientError && farmError.status === 401
                  ? "Authentication Required"
                  : farmError instanceof ApiClientError && farmError.status === 403
                  ? "Access Forbidden"
                  : farmError instanceof ApiClientError && farmError.status === 404
                  ? "Farm Not Found"
                  : farmError instanceof ApiClientError && farmError.status === 422
                  ? "Validation Error"
                  : "Backend Service Notice"}
              </p>
              <p className="mt-1 leading-relaxed">
                {farmError instanceof ApiClientError && farmError.status === 401
                  ? "Your session has expired or you are unauthenticated. Sign in with Supabase to access live backend farms."
                  : farmError instanceof ApiClientError && farmError.status === 403
                  ? "You do not have sufficient permissions to access this farm resource."
                  : farmError instanceof ApiClientError && farmError.status === 404
                  ? "The requested farm could not be found."
                  : farmError instanceof ApiClientError && farmError.status === 422
                  ? "The request payload failed backend validation constraints."
                  : farmError.message}
              </p>
              {farmError instanceof ApiClientError && farmError.status === 401 && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                >
                  Sign In to Backend
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistence and Data Scope Banner */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="font-semibold">
              {currentUser && selectedFarm
                ? "Live Backend Synchronization Active"
                : "Local Persistence & Demonstration Notice"}
            </p>
            <p className="leading-relaxed text-blue-900">
              {currentUser && selectedFarm
                ? `Operational farm "${selectedFarm.name}" (ID: ${selectedFarm.id}) is connected to the FastAPI backend. Zone modifications are recorded to the backend database with audit tracking.`
                : "You are exploring in local demonstration mode. Edits are stored locally. Connect Supabase credentials above to load your live farms from the FastAPI backend."}
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate Metrics Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Farm Area
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink">
              {formatArea(totalAreaHa)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sum of {farm.zones.length} configured parcel records
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Cultivation
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-forest-700">
              {activeZoneCount}
            </span>
            <span className="text-xs text-slate-500">
              / {farm.zones.length} parcels
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Parcels currently under active crop cycles
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Fallow & Resting
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-700">
              {farm.zones.filter((z) => z.status === "Fallow / Resting").length}
            </span>
            <span className="text-xs text-slate-500">parcels</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Resting or conservation buffer blocks
          </p>
        </Card>

        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Irrigation Coverage
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-700">
              {farm.zones.filter((z) => z.irrigation === "Drip" || z.irrigation === "Sprinkler").length}
            </span>
            <span className="text-xs text-slate-500">pressurized zones</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Manual scheduling via Advisory review
          </p>
        </Card>
      </div>

      {/* Field Parcels Table / Grid */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink sm:text-lg">Registered Field Zones</h2>
            <p className="text-xs text-slate-500">
              Individual management units with distinct crop, soil, and irrigation methods.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!selectedFarm && (
              farm.zones.length === 0 ? (
                <button
                  type="button"
                  onClick={loadDemoFarm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe6dd] bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-slate-50"
                >
                  <RefreshCw size={13} />
                  Load Demo Parcels
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-rose-700 hover:underline"
                >
                  Clear All Parcels
                </button>
              )
            )}
          </div>
        </div>

        {isLoadingFarm || isLoadingZones ? (
          <Card className="p-12 text-center">
            <Loader2 size={32} className="mx-auto text-forest-600 animate-spin" />
            <h3 className="mt-3 text-sm font-bold text-ink">Loading Field Zones...</h3>
            <p className="mt-1 text-xs text-slate-500">
              Retrieving authoritative zone configurations from FastAPI backend.
            </p>
          </Card>
        ) : farm.zones.length === 0 ? (
          <Card className="p-12 text-center">
            <Sprout size={36} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-ink">
              {selectedFarm ? "No Field Zones Registered" : "No Field Zones Configured"}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              {selectedFarm
                ? `No field zones are currently registered for "${selectedFarm.name}". You can add management parcels to begin monitoring.`
                : "You have cleared all parcel records. Click \"Add Field Zone\" to define your parcels or restore the standard demo farm."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAddZone}
                className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
              >
                <Plus size={14} />
                Add First Zone
              </button>
              {!selectedFarm && (
                <button
                  type="button"
                  onClick={loadDemoFarm}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw size={14} />
                  Restore Demo Data
                </button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
            {farm.zones.map((zone) => (
              <Card key={zone.id} className="p-5 flex flex-col justify-between border-[#dfe6dd]">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink text-sm sm:text-base">{zone.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            zone.status === "Active Cultivation"
                              ? "bg-emerald-100 text-emerald-800"
                              : zone.status === "Soil Preparation"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {zone.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-forest-700">{zone.crop}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditZone(zone)}
                        aria-label={`Edit ${zone.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingZone(zone)}
                        aria-label={`Delete ${zone.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-[#edf0eb] pt-3">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Parcel Area:</span>
                      <strong className="text-ink font-mono">{formatArea(zone.areaHa)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Soil Classification:</span>
                      <span className="text-ink font-medium">{zone.soilType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Irrigation Method:</span>
                      <span className="text-ink font-medium">{zone.irrigation}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Management Status:</span>
                      <span className="text-ink font-medium">{zone.status}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#edf0eb] pt-3 text-[11px] text-slate-500">
                  <span className="font-mono text-slate-400">{zone.id}</span>
                  <span className="italic">Manual verification required</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Connected Devices & Sensors (Real FastAPI backend integration) */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink sm:text-lg">
              Connected Devices & Edge Sensors
            </h2>
            <p className="text-xs text-slate-500">
              Hardware probes, weather stations, and IoT telemetry gateways registered to {selectedFarm?.name || "this farm"}.
            </p>
          </div>
          {selectedFarmId && (
            <button
              type="button"
              onClick={() => refreshDevices()}
              disabled={isLoadingDevices}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe6dd] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoadingDevices ? "animate-spin text-forest-700" : "text-slate-500"} />
              <span>Refresh Devices</span>
            </button>
          )}
        </div>

        {devicesError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <p>Unable to retrieve device hardware status from backend.</p>
          </div>
        )}

        {isLoadingDevices && devices.length === 0 ? (
          <Card className="p-8 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-forest-700" />
            <p className="mt-2 text-xs text-slate-500">Loading registered devices from backend...</p>
          </Card>
        ) : devices.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Cpu size={32} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-ink">No Hardware Devices Registered</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              {selectedFarmId
                ? "No edge sensors or telemetry probes are currently bound to this farm. Register devices via backend or ingest sensor events to auto-register."
                : "Select a connected backend farm to view its registered sensor nodes and gateways."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => {
              const assignedZone = backendZones.find((z) => z.id === device.zone_id);
              const formattedType = device.device_type.replace(/_/g, " ").toUpperCase();
              const lastSeen = device.last_seen_at
                ? new Date(device.last_seen_at).toLocaleString()
                : "No telemetry received";

              return (
                <Card key={device.id} className="p-5 border-[#dfe6dd] flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                          <Cpu size={18} />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-ink font-mono">{device.id}</h3>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {formattedType}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          device.enabled
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {device.enabled ? "Online / Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-xs border-t border-[#edf0eb] pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Assigned Zone:</span>
                        <span className="font-medium text-ink">
                          {assignedZone ? assignedZone.name : device.zone_id ? device.zone_id : "Unassigned"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Seen:</span>
                        <span className="font-medium text-ink text-[11px]">{lastSeen}</span>
                      </div>
                      {device.credential_reference && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Hardware Ref:</span>
                          <span className="font-mono text-slate-600 text-[11px]">
                            {device.credential_reference}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#edf0eb] pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{device.is_demo ? "Demo Node" : "Physical Node"}</span>
                    <span>Created {new Date(device.created_at).toLocaleDateString()}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="profile-modal-title" className="text-base font-bold text-ink">
                Edit Farm Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              {profileError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle size={15} />
                  {profileError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Farm / Enterprise Title *
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Sahyadri Agro Parcel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  District / Geographic Location *
                </label>
                <input
                  type="text"
                  value={profileDistrict}
                  onChange={(e) => setProfileDistrict(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Nashik, Maharashtra"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Soil Classification
                </label>
                <input
                  type="text"
                  value={profileSoil}
                  onChange={(e) => setProfileSoil(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Medium Black Clayey Loam"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700 block mb-0.5">Note on Total Area:</span>
                Total area is automatically calculated from registered parcel records ({formatArea(totalAreaHa)}).
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Zone Modal */}
      {zoneModalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="zone-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="zone-modal-title" className="text-base font-bold text-ink">
                {zoneModalMode === "add" ? "Add Field Zone / Parcel" : "Edit Field Zone"}
              </h3>
              <button
                type="button"
                onClick={() => setZoneModalMode(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="mt-4 space-y-4">
              {zoneFormError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle size={15} />
                  {zoneFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parcel Name / Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                    placeholder="e.g. West Ridge Parcel"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Area (in {settings.unitSystem === "Imperial" ? "Acres" : "Hectares"}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={zoneArea}
                    onChange={(e) => setZoneArea(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink font-mono focus:border-forest-600 focus:outline-hidden"
                    placeholder={settings.unitSystem === "Imperial" ? "e.g. 8.6" : "e.g. 3.5"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Crop Cultivated
                  </label>
                  <input
                    type="text"
                    value={zoneCrop}
                    onChange={(e) => setZoneCrop(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                    placeholder="e.g. Chickpea (Gram)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Soil Texture
                  </label>
                  <input
                    type="text"
                    value={zoneSoil}
                    onChange={(e) => setZoneSoil(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                    placeholder="e.g. Clay Loam"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Irrigation Method
                  </label>
                  <select
                    value={zoneIrrigation}
                    onChange={(e) => setZoneIrrigation(e.target.value as FarmZone["irrigation"])}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:border-forest-600 focus:outline-hidden"
                  >
                    <option value="Drip">Drip</option>
                    <option value="Sprinkler">Sprinkler</option>
                    <option value="Flood / Furrow">Flood / Furrow</option>
                    <option value="Rainfed">Rainfed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parcel Status
                  </label>
                  <select
                    value={zoneStatus}
                    onChange={(e) => setZoneStatus(e.target.value as FarmZone["status"])}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:border-forest-600 focus:outline-hidden"
                  >
                    <option value="Active Cultivation">Active Cultivation</option>
                    <option value="Soil Preparation">Soil Preparation</option>
                    <option value="Fallow / Resting">Fallow / Resting</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  onClick={() => setZoneModalMode(null)}
                  disabled={isSavingZone}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingZone}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
                >
                  {isSavingZone ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Saving to backend...
                    </>
                  ) : (
                    zoneModalMode === "add" ? "Create Zone" : "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingZone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 id="delete-modal-title" className="text-base font-bold text-ink">
                Confirm Parcel Deletion
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete parcel <strong>{deletingZone.name}</strong> ({formatArea(deletingZone.areaHa)})? This will remove the parcel from local storage and recalculate the total farm area immediately.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingZone(null)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Parcel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 id="clear-modal-title" className="text-base font-bold text-ink">
                Clear All Parcels?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              This will remove all {farm.zones.length} parcels from your local farm configuration. You can restore the demo dataset anytime.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearFarm();
                  setShowClearConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </AppShell>
  );
}
