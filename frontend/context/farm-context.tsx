"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import {
  getCurrentUser as apiGetCurrentUser,
  getFarms,
  getFarm,
  getZones,
  updateZone as apiUpdateZone,
  getDevices,
  getTelemetryEvents,
} from "../lib/api/farmops";
import { getCurrentSession, signOut as authSignOut } from "../lib/auth/session";
import { createClient } from "../lib/supabase/client";
import { ApiClientError } from "../lib/api/client";
import type { Farm, Zone, ZoneUpdate, UserProfile, Device, SensorEventResponse } from "../types/api";
import { extractLatestMeasurements, type LatestMeasurement } from "../lib/telemetry";

// ==========================================
// DOMAIN TYPES
// ==========================================

export interface FarmZone {
  id: string;
  name: string;
  areaHa: number;
  crop: string;
  soilType: string;
  irrigation: "Drip" | "Sprinkler" | "Flood / Furrow" | "Rainfed";
  status: "Active Cultivation" | "Soil Preparation" | "Fallow / Resting";
}

export interface FarmProfile {
  name: string;
  district: string;
  primarySoil: string;
  zones: FarmZone[];
  isDemoData: boolean;
}

export interface FarmSettings {
  unitSystem: "Metric" | "Imperial";
  locale: "en-US" | "en-IN";
  autoTaskOnAccept: boolean;
  riskSensitivity: "Standard" | "Conservative" | "Aggressive";
  alertDatasetAudits: boolean;
  alertHardwareStatus: boolean;
}

export interface AdvisoryPlan {
  id: string;
  title: string;
  category: "Nutrient Management" | "Irrigation Timing" | "Thermal Protection" | "Canopy Inspection";
  targetParcel: string;
  crop: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending Decision" | "Accepted" | "Rejected";
  rejectionReason?: string;
  acceptedAt?: string;
  associatedTaskId?: string;
  supportingEvidence: {
    datasetSource: string;
    metricsCited: string;
    benchmarkRef: string;
  };
  reasoning: string;
  uncertaintyDisclosure: string;
  recommendedAction: string;
  operationalBoundary: string;
}

export interface FarmTask {
  id: string;
  title: string;
  parcel: string;
  crop: string;
  stage: "Suggested" | "Confirmed" | "In Progress" | "Completed";
  priority: "High" | "Medium" | "Low";
  dueDate: string;
  assignee: string;
  sourceOrigin: string;
  checklist: Array<{ text: string; done: boolean }>;
  notes: string;
  completedAt?: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  category: "Dataset Provenance" | "Hardware Telemetry" | "Agronomic Notice";
  severity: "high" | "medium" | "low" | "info";
  timestamp: string;
  sourceRef: string;
  description: string;
  evidenceNote: string;
  read: boolean;
  isActionable: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "Session Activity" | "Dataset Provenance" | "Seeded Demonstration";
  title: string;
  summary: string;
  category: "Advisory" | "Task" | "Farm Profile" | "Dataset Audit" | "Field Operation";
  actor: "Farmer / Active User" | "FarmOps AI Assistant" | "Kaggle / Research Archive" | "System Precaution";
  refId?: string;
}

// ==========================================
// SEEDED DEMONSTRATION DATA
// ==========================================

export const INITIAL_DEMO_FARM: FarmProfile = {
  name: "Sahyadri Agro Parcel",
  district: "Nashik, Maharashtra",
  primarySoil: "Medium Black Clayey Loam",
  isDemoData: true,
  zones: [
    {
      id: "zone-1",
      name: "North Parcel A-1",
      areaHa: 6.2,
      crop: "Pomegranate (Bhagawa)",
      soilType: "Clay Loam",
      irrigation: "Drip",
      status: "Active Cultivation",
    },
    {
      id: "zone-2",
      name: "Central Block B",
      areaHa: 5.0,
      crop: "Soybean",
      soilType: "Deep Black Soil",
      irrigation: "Rainfed",
      status: "Active Cultivation",
    },
    {
      id: "zone-3",
      name: "South Ridge C",
      areaHa: 4.5,
      crop: "Chickpea (Gram)",
      soilType: "Sandy Clay",
      irrigation: "Sprinkler",
      status: "Soil Preparation",
    },
    {
      id: "zone-4",
      name: "Riparian Buffer D",
      areaHa: 2.8,
      crop: "Cover Grass / Fallow",
      soilType: "Alluvial Silty Loam",
      irrigation: "Rainfed",
      status: "Fallow / Resting",
    },
  ],
};

export const INITIAL_SETTINGS: FarmSettings = {
  unitSystem: "Metric",
  locale: "en-US",
  autoTaskOnAccept: true,
  riskSensitivity: "Standard",
  alertDatasetAudits: true,
  alertHardwareStatus: true,
};

export const INITIAL_ADVISORIES: AdvisoryPlan[] = [
  {
    id: "ADV-101",
    title: "NPK Ratio Calibration for Chickpea Transition",
    category: "Nutrient Management",
    targetParcel: "South Ridge C",
    crop: "Chickpea (Gram)",
    priority: "High",
    status: "Pending Decision",
    supportingEvidence: {
      datasetSource: "Kaggle: Crop Recommendation Dataset (2,200 records)",
      metricsCited: "Chickpea benchmark parameters: N: 20–60, P: 55–80, K: 75–85, pH: 6.0–7.5",
      benchmarkRef: "docs/datasets/README.md#crop-recommendation",
    },
    reasoning:
      "Historical agronomic benchmarks indicate legume crops require moderate basal nitrogen combined with higher phosphorus for root nodule stimulation. Adjusting fertilization avoids vegetative overgrowth and promotes flowering.",
    uncertaintyDisclosure:
      "Benchmark values derive from a curated static Kaggle dataset without documented physical units or geographic coordinates. Physical soil sampling of South Ridge C is essential before bulk application.",
    recommendedAction:
      "Collect 4 composite topsoil cores across South Ridge C for lab nutrient assay prior to top-dressing.",
    operationalBoundary:
      "Advisory only. FarmOps AI does not command fertilizer injection equipment or automated applicators.",
  },
  {
    id: "ADV-102",
    title: "Root-Zone Deep Moisture Conservation Cycle",
    category: "Irrigation Timing",
    targetParcel: "North Parcel A-1",
    crop: "Pomegranate (Bhagawa)",
    priority: "Medium",
    status: "Pending Decision",
    supportingEvidence: {
      datasetSource: "Field-Scale Soil Moisture Sensor Network (Station CAF003)",
      metricsCited: "VW_30cm vs VW_90cm depth variance across 3,346 daily records",
      benchmarkRef: "docs/datasets/README.md#soil-moisture",
    },
    reasoning:
      "Perennial horticultural crops draw from subsoil reserves at 60cm–90cm during fruit expansion. Research moisture data shows surface drying (VW_30cm) often misrepresents root-zone water availability.",
    uncertaintyDisclosure:
      "CAF003 records contain missing values ('NA') and probe calibration is undocumented locally. Weather forecast uncertainty must be factored into irrigation runtimes.",
    recommendedAction:
      "Perform a physical tensiometer check at 60cm depth before scheduling secondary drip irrigation run.",
    operationalBoundary:
      "Manual farmer decision required. Accepting this advisory does NOT activate irrigation pumps or solenoid valves.",
  },
  {
    id: "ADV-103",
    title: "Foliar Stress Visual Inspection Protocol",
    category: "Canopy Inspection",
    targetParcel: "Central Block B",
    crop: "Soybean",
    priority: "Medium",
    status: "Pending Decision",
    supportingEvidence: {
      datasetSource: "Edge Assisted Agricultural Sensor Dataset (2,000 hourly records)",
      metricsCited: "NDVI range 0.20–0.28 correlated with High_Stress categorical records",
      benchmarkRef: "docs/datasets/README.md#edge-sensor",
    },
    reasoning:
      "Sensor telemetry clusters showing NDVI depressions below 0.25 frequently correspond to canopy stress or early leaf yellowing under high solar radiation.",
    uncertaintyDisclosure:
      "Sensor rows are not linked to individual plant images in the dataset repository. Diagnostic validation requires farmer scouting in the field.",
    recommendedAction:
      "Conduct a 15-minute field scouting walk in Central Block B to inspect lower canopy leaves for chlorosis or pest infestation.",
    operationalBoundary:
      "Human scouting required. FarmOps AI cannot dispatch drones or optical scouts.",
  },
];

export const INITIAL_TASKS: FarmTask[] = [
  {
    id: "TSK-201",
    title: "Collect Composite Topsoil Cores for NPK Assay",
    parcel: "South Ridge C",
    crop: "Chickpea (Gram)",
    stage: "Confirmed",
    priority: "High",
    dueDate: "2026-09-21",
    assignee: "Self / Farm Operator",
    sourceOrigin: "Accepted Advisory (ADV-101)",
    checklist: [
      { text: "Sterilize soil auger / core sampler", done: true },
      { text: "Collect 4 randomized samples across parcel at 15cm depth", done: false },
      { text: "Mix composite in clean bucket and bag 500g sample", done: false },
      { text: "Deliver to Krishi Vigyan Kendra (KVK) soil testing lab", done: false },
    ],
    notes: "Recommended before applying basal fertilizer based on Kaggle Crop Recommendation benchmarks.",
  },
  {
    id: "TSK-202",
    title: "Subsoil Tensiometer Physical Inspection (60cm)",
    parcel: "North Parcel A-1",
    crop: "Pomegranate",
    stage: "In Progress",
    priority: "Medium",
    dueDate: "2026-09-22",
    assignee: "Irrigation Technician",
    sourceOrigin: "Accepted Advisory (ADV-102)",
    checklist: [
      { text: "Inspect vacuum gauge on Station CAF003 benchmark zone", done: true },
      { text: "Verify zero air-bubble cavitation in ceramic cup reservoir", done: true },
      { text: "Record barometric reading in field notebook", done: false },
    ],
    notes: "Confirms whether root-zone moisture warrants secondary drip cycle.",
  },
  {
    id: "TSK-203",
    title: "Foliar Stress Visual Inspection & Scouting Walk",
    parcel: "Central Block B",
    crop: "Soybean",
    stage: "Suggested",
    priority: "Medium",
    dueDate: "2026-09-23",
    assignee: "Agronomist / Field Scout",
    sourceOrigin: "Direct Farmer Input",
    checklist: [
      { text: "Walk zig-zag transect across rows 12–35", done: false },
      { text: "Check underside of leaves for early spider mite webbing or rust spots", done: false },
      { text: "Log photographic observations if chlorosis is observed", done: false },
    ],
    notes: "Farmer-initiated routine inspection following high daytime solar irradiance readings.",
  },
];

export const INITIAL_ALERTS: SystemAlert[] = [
  {
    id: "ALT-001",
    title: "Dataset Audit: Station CAF003 Timestamp Duplication",
    category: "Dataset Provenance",
    severity: "medium",
    timestamp: "2026-09-19 08:30",
    sourceRef: "data/raw/soil-moisture/CAF003.csv",
    description:
      "Adapter verification identified 889 duplicate timestamp rows in the raw CSV. Deduplication logic must be maintained when computing volumetric water content statistics.",
    evidenceNote:
      "Physical telemetry audit finding. This does not indicate a physical water emergency on your parcel.",
    read: false,
    isActionable: false,
  },
  {
    id: "ALT-002",
    title: "Dataset Quality: PlantVillage Esca Class Single Image Asymmetry",
    category: "Dataset Provenance",
    severity: "low",
    timestamp: "2026-09-18 14:15",
    sourceRef: "data/raw/grape-plantvillage/Grape___Esca_(Black_Measles)/",
    description:
      "The Grape Esca directory contains only 1 sample image compared to 1,000+ in other classes. Model confidence on Esca symptoms cannot be established without broader training samples.",
    evidenceNote:
      "Research archive limitation. Diagnostic claims for black measles must be verified through laboratory leaf histology.",
    read: false,
    isActionable: false,
  },
  {
    id: "ALT-003",
    title: "Telemetry Notice: Field Sensor Gateway Disconnected",
    category: "Hardware Telemetry",
    severity: "info",
    timestamp: "2026-09-19 06:00",
    sourceRef: "System Configuration",
    description:
      "Live hardware telemetry pipelines (MQTT broker, LoRaWAN gateway, InfluxDB) are intentionally inactive. All advisory scores reflect static research benchmarks only.",
    evidenceNote:
      "System boundary disclosure. No machinery or field valves are connected to this advisory console.",
    read: true,
    isActionable: false,
  },
  {
    id: "ALT-004",
    title: "Research Telemetry Note: Edge Sensor High_Stress Frequency at 34.4%",
    category: "Agronomic Notice",
    severity: "medium",
    timestamp: "2026-09-17 11:00",
    sourceRef: "Edge Assisted Agricultural Sensor Dataset (2,000 rows)",
    description:
      "688 of 2,000 records in the verified edge sensor dataset carry the High_Stress label. Environmental parameters exhibit a mean soil moisture of 24.24 vs 25.44 in Healthy records.",
    evidenceNote:
      "Observed statistical distribution in Kaggle archive. This is not a real-time diagnosis of current farm crops.",
    read: true,
    isActionable: true,
  },
];

export const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: "EVT-001",
    timestamp: "2026-09-19 14:10",
    type: "Session Activity",
    title: "Advisory Console Initialized",
    summary: "Active browser session connected with local demo farm profile 'Sahyadri Agro Parcel'.",
    category: "Farm Profile",
    actor: "Farmer / Active User",
  },
  {
    id: "EVT-002",
    timestamp: "2026-09-19 11:45",
    type: "Seeded Demonstration",
    title: "Soil Moisture Sampling Task Dispatched",
    summary: "Task TSK-201 (NPK Assay) confirmed for South Ridge C following advisory ADV-101 review.",
    category: "Task",
    actor: "Farmer / Active User",
    refId: "TSK-201",
  },
  {
    id: "EVT-003",
    timestamp: "2026-09-18 16:30",
    type: "Dataset Provenance",
    title: "Dataset Registry Structurally Validated",
    summary: "Clean RFC4180 parsing verified for 2,000 Edge Sensor rows and 2,200 Crop Recommendation rows.",
    category: "Dataset Audit",
    actor: "Kaggle / Research Archive",
    refId: "docs/datasets/README.md",
  },
  {
    id: "EVT-004",
    timestamp: "2026-09-18 09:15",
    type: "Seeded Demonstration",
    title: "Advisory ADV-101 Generated",
    summary: "NPK calibration plan compiled based on static legume benchmark parameters.",
    category: "Advisory",
    actor: "FarmOps AI Assistant",
    refId: "ADV-101",
  },
];

// ==========================================
// CONTEXT INTERFACE
// ==========================================

export interface FarmContextType {
  isHydrated: boolean;
  farm: FarmProfile;
  settings: FarmSettings;
  advisories: AdvisoryPlan[];
  tasks: FarmTask[];
  alerts: SystemAlert[];
  timeline: TimelineEvent[];
  
  // Real Backend Data & Auth
  currentUser: UserProfile | null;
  backendFarms: Farm[];
  selectedFarmId: string | null;
  selectedFarm: Farm | null;
  backendZones: Zone[];
  devices: Device[];
  telemetryEvents: SensorEventResponse[];
  latestTelemetry: Record<string, LatestMeasurement>;
  isLoadingFarms: boolean;
  isLoadingFarm: boolean;
  isLoadingZones: boolean;
  isLoadingDevices: boolean;
  isLoadingTelemetry: boolean;
  farmError: ApiClientError | Error | null;
  authError: ApiClientError | Error | null;
  devicesError: ApiClientError | Error | null;
  telemetryError: ApiClientError | Error | null;
  
  // Backend Actions
  selectFarm: (farmId: string) => Promise<void>;
  refreshFarms: () => Promise<void>;
  refreshZones: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  refreshTelemetry: () => Promise<void>;
  updateBackendZone: (zoneId: string, data: ZoneUpdate) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Computed helpers
  totalAreaHa: number;
  activeZoneCount: number;
  unreadAlertCount: number;
  
  // Farm Actions
  updateProfile: (name: string, district: string, primarySoil: string) => void;
  addZone: (zone: Omit<FarmZone, "id">) => { success: boolean; error?: string };
  updateZone: (id: string, zone: Partial<Omit<FarmZone, "id">>) => { success: boolean; error?: string };
  deleteZone: (id: string) => void;
  loadDemoFarm: () => void;
  clearFarm: () => void;

  // Settings Actions
  updateSettings: (newSettings: Partial<FarmSettings>) => void;
  resetSettings: () => void;

  // Advisory Actions
  acceptPlan: (planId: string) => { success: boolean; taskId?: string; message: string };
  rejectPlan: (planId: string, reason: string) => { success: boolean; message: string };
  reconsiderPlan: (planId: string) => void;
  resetPlans: () => void;

  // Task Actions
  createTask: (task: Omit<FarmTask, "id">) => string;
  updateTaskStage: (id: string, stage: FarmTask["stage"]) => { success: boolean; error?: string };
  toggleChecklist: (taskId: string, index: number) => void;
  deleteTask: (id: string) => void;
  resetTasks: () => void;

  // Alert Actions
  toggleAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  deleteAlert: (id: string) => void;
  clearAlerts: () => void;
  restoreDefaultAlerts: () => void;

  // Timeline Actions
  logSessionEvent: (event: Omit<TimelineEvent, "id" | "timestamp" | "type"> & { type?: TimelineEvent["type"] }) => void;

  // Formatting Utilities
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatArea: (areaHa: number) => string;
  formatDate: (dateStr: string) => string;
}

const FarmContext = createContext<FarmContextType | null>(null);

const STORAGE_KEY = "farmops_state_v2";
const SELECTED_FARM_STORAGE_KEY = "farmops_selected_farm_id";

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [farm, setFarm] = useState<FarmProfile>(INITIAL_DEMO_FARM);
  const [settings, setSettings] = useState<FarmSettings>(INITIAL_SETTINGS);
  const [advisories, setAdvisories] = useState<AdvisoryPlan[]>(INITIAL_ADVISORIES);
  const [tasks, setTasks] = useState<FarmTask[]>(INITIAL_TASKS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(INITIAL_TIMELINE);

  // Backend state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [backendFarms, setBackendFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [backendZones, setBackendZones] = useState<Zone[]>([]);
  const [isLoadingFarms, setIsLoadingFarms] = useState(false);
  const [isLoadingFarm, setIsLoadingFarm] = useState(false);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [farmError, setFarmError] = useState<ApiClientError | Error | null>(null);
  const [authError, setAuthError] = useState<ApiClientError | Error | null>(null);

  // Devices & Telemetry state (FastAPI backend integration)
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<SensorEventResponse[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<Record<string, LatestMeasurement>>({});
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [devicesError, setDevicesError] = useState<ApiClientError | Error | null>(null);
  const [telemetryError, setTelemetryError] = useState<ApiClientError | Error | null>(null);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.farm) setFarm(parsed.farm);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.advisories) setAdvisories(parsed.advisories);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.alerts) setAlerts(parsed.alerts);
        if (parsed.timeline) setTimeline(parsed.timeline);
      }
    } catch (e) {
      console.warn("Failed to restore farmops state from localStorage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sync client-only state to localStorage on change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          farm,
          settings,
          advisories,
          tasks,
          alerts,
          timeline,
        })
      );
    } catch (e) {
      console.warn("Failed to save farmops state to localStorage:", e);
    }
  }, [isHydrated, farm, settings, advisories, tasks, alerts, timeline]);

  // Select a specific farm and load its details, zones, devices, and telemetry
  const selectFarm = useCallback(async (farmId: string) => {
    setSelectedFarmId(farmId);
    try {
      localStorage.setItem(SELECTED_FARM_STORAGE_KEY, farmId);
    } catch {}

    // 1. Immediately clear stale telemetry and device state to prevent cross-farm data bleeding
    setDevices([]);
    setTelemetryEvents([]);
    setLatestTelemetry({});
    setDevicesError(null);
    setTelemetryError(null);
    setFarmError(null);

    setIsLoadingFarm(true);
    setIsLoadingZones(true);
    setIsLoadingDevices(true);
    setIsLoadingTelemetry(true);

    try {
      const [farmRes, zonesRes, devicesRes, telemetryRes] = await Promise.allSettled([
        getFarm(farmId),
        getZones(farmId),
        getDevices(farmId),
        getTelemetryEvents(farmId, { limit: 100 }),
      ]);

      if (farmRes.status === "fulfilled" && farmRes.value.data) {
        setSelectedFarm(farmRes.value.data);
      } else if (farmRes.status === "rejected") {
        const err = farmRes.reason;
        setFarmError(err instanceof Error ? err : new Error("Failed to load farm details"));
      }

      if (zonesRes.status === "fulfilled" && zonesRes.value.data) {
        setBackendZones(zonesRes.value.data);
      }

      if (devicesRes.status === "fulfilled" && devicesRes.value.data) {
        setDevices(devicesRes.value.data);
      } else if (devicesRes.status === "rejected") {
        const err = devicesRes.reason;
        setDevicesError(err instanceof Error ? err : new Error("Failed to load farm devices"));
      }

      if (telemetryRes.status === "fulfilled" && telemetryRes.value.data) {
        const events = telemetryRes.value.data;
        setTelemetryEvents(events);
        setLatestTelemetry(extractLatestMeasurements(events));
      } else if (telemetryRes.status === "rejected") {
        const err = telemetryRes.reason;
        setTelemetryError(err instanceof Error ? err : new Error("Failed to load farm telemetry"));
      }
    } catch (err: unknown) {
      console.error("Failed to select farm:", err);
      if (err instanceof ApiClientError) {
        setFarmError(err);
      } else {
        setFarmError(err instanceof Error ? err : new Error("Failed to load farm details"));
      }
    } finally {
      setIsLoadingFarm(false);
      setIsLoadingZones(false);
      setIsLoadingDevices(false);
      setIsLoadingTelemetry(false);
    }
  }, []);

  // Load all farms for authenticated user
  const loadFarms = useCallback(async (preferredFarmId?: string | null) => {
    setIsLoadingFarms(true);
    setFarmError(null);
    setAuthError(null);

    try {
      const session = await getCurrentSession();
      if (!session?.access_token) {
        // No session -> remain in unauthenticated mode
        setCurrentUser(null);
        setBackendFarms([]);
        setSelectedFarm(null);
        setBackendZones([]);
        setDevices([]);
        setTelemetryEvents([]);
        setLatestTelemetry({});
        setIsLoadingFarms(false);
        return;
      }

      // Session exists: call GET /auth/me and GET /farms
      const [userRes, farmsRes] = await Promise.all([
        apiGetCurrentUser().catch((err: unknown) => {
          console.warn("GET /auth/me error:", err);
          return null;
        }),
        getFarms(),
      ]);

      if (userRes && userRes.data) {
        setCurrentUser(userRes.data);
      }

      const farms = farmsRes.data || [];
      setBackendFarms(farms);

      if (farms.length > 0) {
        const storedId = preferredFarmId || (typeof window !== "undefined" ? localStorage.getItem(SELECTED_FARM_STORAGE_KEY) : null);
        const matched = farms.find((f) => f.id === storedId);
        const activeId = matched ? matched.id : farms[0].id;
        await selectFarm(activeId);
      } else {
        setSelectedFarmId(null);
        setSelectedFarm(null);
        setBackendZones([]);
        setDevices([]);
        setTelemetryEvents([]);
        setLatestTelemetry({});
      }
    } catch (err: unknown) {
      console.error("Error loading backend farms:", err);
      if (err instanceof ApiClientError) {
        setFarmError(err);
        if (err.status === 401) {
          setAuthError(err);
        }
      } else {
        setFarmError(err instanceof Error ? err : new Error("Failed to load farms from backend"));
      }
    } finally {
      setIsLoadingFarms(false);
    }
  }, [selectFarm]);

  // Refresh helper
  const refreshFarms = useCallback(async () => {
    await loadFarms(selectedFarmId);
  }, [loadFarms, selectedFarmId]);

  const refreshZones = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoadingZones(true);
    try {
      const res = await getZones(selectedFarmId);
      if (res.data) {
        setBackendZones(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setFarmError(err);
      }
    } finally {
      setIsLoadingZones(false);
    }
  }, [selectedFarmId]);

  const refreshDevices = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoadingDevices(true);
    setDevicesError(null);
    try {
      const res = await getDevices(selectedFarmId);
      if (res.data) {
        setDevices(res.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setDevicesError(err);
      } else {
        setDevicesError(err instanceof Error ? err : new Error("Failed to refresh devices"));
      }
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedFarmId]);

  const refreshTelemetry = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsLoadingTelemetry(true);
    setTelemetryError(null);
    try {
      const res = await getTelemetryEvents(selectedFarmId, { limit: 100 });
      if (res.data) {
        setTelemetryEvents(res.data);
        setLatestTelemetry(extractLatestMeasurements(res.data));
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setTelemetryError(err);
      } else {
        setTelemetryError(err instanceof Error ? err : new Error("Failed to refresh telemetry"));
      }
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, [selectedFarmId]);

  // Update backend zone directly
  const updateBackendZone = useCallback(async (zoneId: string, data: ZoneUpdate): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiUpdateZone(zoneId, data);
      if (res.data) {
        setBackendZones((prev) => prev.map((z) => (z.id === zoneId ? res.data! : z)));
        return { success: true };
      }
      return { success: false, error: res.message || "Failed to update zone" };
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : "Failed to update zone");
      return { success: false, error: msg };
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await authSignOut();
    setCurrentUser(null);
    setBackendFarms([]);
    setSelectedFarm(null);
    setBackendZones([]);
    setSelectedFarmId(null);
    setDevices([]);
    setTelemetryEvents([]);
    setLatestTelemetry({});
    setDevicesError(null);
    setTelemetryError(null);
    setFarmError(null);
    setAuthError(null);
    try {
      localStorage.removeItem(SELECTED_FARM_STORAGE_KEY);
    } catch {}
  }, []);

  // Initialize backend check on mount and listen to Supabase auth events
  useEffect(() => {
    loadFarms();

    const supabase = createClient();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.access_token) {
          await loadFarms();
        }
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setBackendFarms([]);
        setSelectedFarm(null);
        setBackendZones([]);
        setSelectedFarmId(null);
        setDevices([]);
        setTelemetryEvents([]);
        setLatestTelemetry({});
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadFarms]);

  // Effective unified farm data for downstream views
  const effectiveFarm: FarmProfile = useMemo(() => {
    if (selectedFarm) {
      return {
        name: selectedFarm.name,
        district: selectedFarm.location || selectedFarm.address || "Location unassigned",
        primarySoil: (selectedFarm.crop_profile?.primary_soil as string) || (selectedFarm.crop_profile?.soil_type as string) || "Agricultural Loam",
        isDemoData: selectedFarm.is_demo,
        zones: backendZones.map((bz) => ({
          id: bz.id,
          name: bz.name,
          areaHa: bz.area || 0,
          crop: bz.crop || "Unspecified Crop",
          soilType: "Agricultural Loam",
          irrigation: "Drip",
          status: bz.status === "active" ? "Active Cultivation" : bz.status === "fallow" ? "Fallow / Resting" : "Soil Preparation",
        })),
      };
    }
    if (currentUser && backendFarms.length === 0) {
      return {
        name: "No Farm Registered",
        district: "Not configured",
        primarySoil: "Not configured",
        isDemoData: false,
        zones: [],
      };
    }
    return farm;
  }, [selectedFarm, backendZones, currentUser, backendFarms.length, farm]);

  // Derived Values
  const totalAreaHa = useMemo(() => {
    if (selectedFarm) {
      if (selectedFarm.total_area !== undefined && selectedFarm.total_area !== null) {
        return Number(selectedFarm.total_area);
      }
      return backendZones.reduce((sum, z) => sum + (Number(z.area) || 0), 0);
    }
    return effectiveFarm.zones.reduce((sum, z) => sum + (Number(z.areaHa) || 0), 0);
  }, [selectedFarm, backendZones, effectiveFarm.zones]);

  const activeZoneCount = useMemo(() => {
    if (selectedFarm) {
      return backendZones.filter((z) => z.status === "active").length;
    }
    return effectiveFarm.zones.filter((z) => z.status === "Active Cultivation").length;
  }, [selectedFarm, backendZones, effectiveFarm.zones]);

  const unreadAlertCount = useMemo(() => {
    return alerts.filter((a) => {
      if (a.read) return false;
      if (!settings.alertDatasetAudits && a.category === "Dataset Provenance") return false;
      if (!settings.alertHardwareStatus && a.category === "Hardware Telemetry") return false;
      return true;
    }).length;
  }, [alerts, settings.alertDatasetAudits, settings.alertHardwareStatus]);

  // Logging helper
  const logSessionEvent = (
    event: Omit<TimelineEvent, "id" | "timestamp" | "type"> & { type?: TimelineEvent["type"] }
  ) => {
    const now = new Date();
    const ts = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const newEvent: TimelineEvent = {
      id: `EVT-${Date.now()}`,
      timestamp: ts,
      type: event.type || "Session Activity",
      ...event,
    };
    setTimeline((prev) => [newEvent, ...prev]);
  };

  // Farm Actions
  const updateProfile = (name: string, district: string, primarySoil: string) => {
    setFarm((prev) => ({
      ...prev,
      name: name.trim() || prev.name,
      district: district.trim() || prev.district,
      primarySoil: primarySoil.trim() || prev.primarySoil,
      isDemoData: false, // User customized it
    }));
    logSessionEvent({
      category: "Farm Profile",
      title: "Farm Profile Details Updated",
      summary: `Updated farm title to '${name.trim()}' in district '${district.trim()}'.`,
      actor: "Farmer / Active User",
    });
  };

  const addZone = (zoneData: Omit<FarmZone, "id">) => {
    if (!zoneData.name || zoneData.name.trim().length === 0) {
      return { success: false, error: "Zone name is required." };
    }
    const area = Number(zoneData.areaHa);
    if (isNaN(area) || area <= 0) {
      return { success: false, error: "Area must be a positive number." };
    }
    const newZone: FarmZone = {
      id: `zone-${Date.now()}`,
      name: zoneData.name.trim(),
      areaHa: Math.round(area * 100) / 100,
      crop: zoneData.crop.trim() || "Unspecified Crop",
      soilType: zoneData.soilType.trim() || "Unspecified Soil",
      irrigation: zoneData.irrigation,
      status: zoneData.status,
    };
    setFarm((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    logSessionEvent({
      category: "Farm Profile",
      title: `Field Zone Added: ${newZone.name}`,
      summary: `Added parcel ${newZone.name} (${newZone.areaHa} ha, ${newZone.crop}) with ${newZone.status} status.`,
      actor: "Farmer / Active User",
    });
    return { success: true };
  };

  const updateZone = (id: string, zoneData: Partial<Omit<FarmZone, "id">>) => {
    if (zoneData.name !== undefined && zoneData.name.trim().length === 0) {
      return { success: false, error: "Zone name cannot be empty." };
    }
    if (zoneData.areaHa !== undefined) {
      const area = Number(zoneData.areaHa);
      if (isNaN(area) || area <= 0) {
        return { success: false, error: "Area must be a positive number." };
      }
    }

    // If active backend farm has this zone, sync to backend via PATCH /zones/:id
    if (selectedFarm && backendZones.some((bz) => bz.id === id)) {
      const patchPayload: ZoneUpdate = {};
      if (zoneData.name !== undefined) patchPayload.name = zoneData.name.trim();
      if (zoneData.areaHa !== undefined) patchPayload.area = Number(zoneData.areaHa);
      if (zoneData.crop !== undefined) patchPayload.crop = zoneData.crop.trim();
      if (zoneData.status !== undefined) {
        patchPayload.status =
          zoneData.status === "Active Cultivation"
            ? "active"
            : zoneData.status === "Fallow / Resting"
            ? "fallow"
            : "quarantine";
      }
      updateBackendZone(id, patchPayload).catch((e) => {
        console.warn("Backend zone update error:", e);
      });
    }

    let updatedName = "";
    setFarm((prev) => {
      const updated = prev.zones.map((z) => {
        if (z.id === id) {
          updatedName = zoneData.name ? zoneData.name.trim() : z.name;
          return {
            ...z,
            ...zoneData,
            name: zoneData.name !== undefined ? zoneData.name.trim() : z.name,
            areaHa: zoneData.areaHa !== undefined ? Math.round(Number(zoneData.areaHa) * 100) / 100 : z.areaHa,
          };
        }
        return z;
      });
      return { ...prev, zones: updated };
    });
    logSessionEvent({
      category: "Farm Profile",
      title: `Field Zone Modified: ${updatedName || id}`,
      summary: `Saved updated agronomic parameters for parcel ${updatedName || id}.`,
      actor: "Farmer / Active User",
    });
    return { success: true };
  };

  const deleteZone = (id: string) => {
    const target = farm.zones.find((z) => z.id === id);
    setFarm((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== id),
    }));
    logSessionEvent({
      category: "Farm Profile",
      title: `Field Zone Removed: ${target ? target.name : id}`,
      summary: `Removed parcel record from local farm registry. Dependent farm area recalculated.`,
      actor: "Farmer / Active User",
    });
  };

  const loadDemoFarm = () => {
    setFarm(INITIAL_DEMO_FARM);
    logSessionEvent({
      category: "Farm Profile",
      title: "Demonstration Profile Restored",
      summary: "Restored Sahyadri Agro Parcel demonstration profile and 4 sample zones.",
      actor: "Farmer / Active User",
    });
  };

  const clearFarm = () => {
    setFarm({
      name: "Unconfigured Farm",
      district: "Local Workspace",
      primarySoil: "Not Specified",
      isDemoData: false,
      zones: [],
    });
    logSessionEvent({
      category: "Farm Profile",
      title: "Farm Profile Cleared",
      summary: "Reset all parcel records in local memory. Total farm area is now 0 ha.",
      actor: "Farmer / Active User",
    });
  };

  // Settings Actions
  const updateSettings = (newSettings: Partial<FarmSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    logSessionEvent({
      category: "Advisory",
      title: "Application Settings Adjusted",
      summary: `Updated client preferences (Unit: ${newSettings.unitSystem ?? settings.unitSystem}, Auto-task: ${
        newSettings.autoTaskOnAccept !== undefined ? newSettings.autoTaskOnAccept : settings.autoTaskOnAccept
      }).`,
      actor: "Farmer / Active User",
    });
  };

  const resetSettings = () => {
    setSettings(INITIAL_SETTINGS);
    logSessionEvent({
      category: "Advisory",
      title: "Settings Reset to Defaults",
      summary: "Restored default configuration: Metric (ha), en-US locale, auto-task creation enabled.",
      actor: "Farmer / Active User",
    });
  };

  // Advisory Actions
  const acceptPlan = (planId: string) => {
    const plan = advisories.find((p) => p.id === planId);
    if (!plan) return { success: false, message: "Plan not found." };
    if (plan.status === "Accepted") {
      return { success: false, message: "This plan has already been accepted." };
    }

    const now = new Date();
    const ts = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    let createdTaskId: string | undefined = undefined;

    // Check if a task already exists for this advisory to prevent duplicates
    const existingTask = tasks.find(
      (t) => t.sourceOrigin.includes(plan.id) || (plan.associatedTaskId && plan.associatedTaskId === t.id)
    );

    if (settings.autoTaskOnAccept) {
      if (existingTask) {
        createdTaskId = existingTask.id;
      } else {
        createdTaskId = `TSK-${Date.now().toString().slice(-4)}`;
        const newTask: FarmTask = {
          id: createdTaskId,
          title: `Execute: ${plan.title}`,
          parcel: plan.targetParcel,
          crop: plan.crop,
          stage: "Confirmed",
          priority: plan.priority,
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10), // 2 days out
          assignee: "Self / Farm Operator",
          sourceOrigin: `Accepted Advisory (${plan.id})`,
          checklist: [
            { text: `Review agronomic uncertainty disclosure for ${plan.crop}`, done: true },
            { text: plan.recommendedAction, done: false },
            { text: "Record physical field observations upon completion", done: false },
          ],
          notes: `Created from accepted advisory ${plan.id}. Operational boundary: manual crew execution required.`,
        };
        setTasks((prev) => [newTask, ...prev]);
      }
    }

    setAdvisories((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: "Accepted",
              acceptedAt: ts,
              associatedTaskId: createdTaskId || (existingTask ? existingTask.id : undefined),
            }
          : p
      )
    );

    logSessionEvent({
      category: "Advisory",
      title: `Advisory Plan Accepted: ${plan.id}`,
      summary: `Farmer decision: Accepted recommendation for ${plan.targetParcel}.${
        createdTaskId
          ? ` Follow-up task ${createdTaskId} active on task board.`
          : " Automatic task creation was disabled in Settings."
      }`,
      actor: "Farmer / Active User",
      refId: plan.id,
    });

    return {
      success: true,
      taskId: createdTaskId,
      message: createdTaskId
        ? `Advisory accepted. Follow-up task ${createdTaskId} is active on the Tasks board.`
        : "Advisory accepted. No task was created as per Settings preference.",
    };
  };

  const rejectPlan = (planId: string, reason: string) => {
    const plan = advisories.find((p) => p.id === planId);
    if (!plan) return { success: false, message: "Plan not found." };
    if (plan.status === "Rejected") {
      return { success: false, message: "This plan has already been rejected." };
    }

    setAdvisories((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: "Rejected",
              rejectionReason: reason.trim() || "Farmer determined recommendation not applicable to current crop cycle.",
            }
          : p
      )
    );

    logSessionEvent({
      category: "Advisory",
      title: `Advisory Plan Rejected: ${plan.id}`,
      summary: `Farmer decision: Rejected recommendation for ${plan.targetParcel}. Reason: '${
        reason.trim() || "Unspecified"
      }'. No follow-up task was scheduled.`,
      actor: "Farmer / Active User",
      refId: plan.id,
    });

    return {
      success: true,
      message: `Advisory ${plan.id} marked as Rejected. No execution task was created.`,
    };
  };

  const reconsiderPlan = (planId: string) => {
    setAdvisories((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: "Pending Decision",
              rejectionReason: undefined,
              acceptedAt: undefined,
            }
          : p
      )
    );
    logSessionEvent({
      category: "Advisory",
      title: `Advisory Plan Reconsidered: ${planId}`,
      summary: `Reset advisory ${planId} to Pending Decision for farmer re-evaluation.`,
      actor: "Farmer / Active User",
      refId: planId,
    });
  };

  const resetPlans = () => {
    setAdvisories(INITIAL_ADVISORIES);
    logSessionEvent({
      category: "Advisory",
      title: "Advisory Review State Reset",
      summary: "Reset all advisory plans to Pending Decision state.",
      actor: "Farmer / Active User",
    });
  };

  // Task Actions
  const createTask = (taskData: Omit<FarmTask, "id">) => {
    const id = `TSK-${Date.now().toString().slice(-4)}`;
    const newTask: FarmTask = {
      ...taskData,
      id,
    };
    setTasks((prev) => [newTask, ...prev]);
    logSessionEvent({
      category: "Task",
      title: `Field Task Created: ${newTask.title}`,
      summary: `Assigned to ${newTask.assignee} for ${newTask.parcel}. Due: ${newTask.dueDate}.`,
      actor: "Farmer / Active User",
      refId: id,
    });
    return id;
  };

  const updateTaskStage = (id: string, stage: FarmTask["stage"]): { success: boolean; error?: string } => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return { success: false, error: "Task not found." };
    if (task.stage === stage) return { success: true };

    const validTransitions: Record<FarmTask["stage"], FarmTask["stage"][]> = {
      "Suggested": ["Confirmed"],
      "Confirmed": ["In Progress", "Suggested"],
      "In Progress": ["Completed", "Confirmed"],
      "Completed": ["In Progress"],
    };

    if (!validTransitions[task.stage]?.includes(stage)) {
      return {
        success: false,
        error: `Cannot transition task directly from '${task.stage}' to '${stage}'. Follow sequence: Suggested → Confirmed → In Progress → Completed.`,
      };
    }

    const taskTitle = task.title;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            stage,
            completedAt:
              stage === "Completed"
                ? `${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)}`
                : undefined,
          };
        }
        return t;
      })
    );
    logSessionEvent({
      category: "Task",
      title: `Task Stage Updated: ${stage}`,
      summary: `Task '${taskTitle}' transitioned from '${task.stage}' to '${stage}'. Execution remains manual crew work.`,
      actor: "Farmer / Active User",
      refId: id,
    });
    return { success: true };
  };

  const toggleChecklist = (taskId: string, index: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = [...t.checklist];
          if (updated[index]) {
            updated[index] = { ...updated[index], done: !updated[index].done };
          }
          return { ...t, checklist: updated };
        }
        return t;
      })
    );
  };

  const deleteTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    logSessionEvent({
      category: "Task",
      title: `Task Discarded: ${target ? target.title : id}`,
      summary: `Removed task from board.`,
      actor: "Farmer / Active User",
      refId: id,
    });
  };

  const resetTasks = () => {
    setTasks(INITIAL_TASKS);
    logSessionEvent({
      category: "Task",
      title: "Task Board Reset",
      summary: "Restored initial demonstration task board state.",
      actor: "Farmer / Active User",
    });
  };

  // Alert Actions
  const toggleAlertRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: !a.read } : a))
    );
  };

  const markAllAlertsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const deleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAlerts = () => {
    setAlerts([]);
    logSessionEvent({
      category: "Dataset Audit",
      title: "Alert Inbox Cleared",
      summary: "Cleared all dataset and telemetry audit notices from the active inbox.",
      actor: "Farmer / Active User",
    });
  };

  const restoreDefaultAlerts = () => {
    setAlerts(INITIAL_ALERTS);
    logSessionEvent({
      category: "Dataset Audit",
      title: "Default Alerts Restored",
      summary: "Restored verified research dataset audit and telemetry boundary alerts.",
      actor: "Farmer / Active User",
    });
  };

  // Formatting Utilities
  const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(settings.locale, options).format(num);
    } catch {
      return num.toLocaleString();
    }
  };

  const formatArea = (areaHa: number) => {
    if (settings.unitSystem === "Imperial") {
      const acres = Math.round(areaHa * 2.47105 * 10) / 10;
      return `${formatNumber(acres)} acres`;
    }
    return `${formatNumber(Math.round(areaHa * 10) / 10)} ha`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not specified";
    if (dateStr.includes("-") && dateStr.length === 10) {
      try {
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString(settings.locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return dateStr;
      }
    }
    return dateStr;
  };

  return (
    <FarmContext.Provider
      value={{
        isHydrated,
        farm: effectiveFarm,
        settings,
        advisories,
        tasks,
        alerts,
        timeline,
        currentUser,
        backendFarms,
        selectedFarmId,
        selectedFarm,
        backendZones,
        devices,
        telemetryEvents,
        latestTelemetry,
        isLoadingFarms,
        isLoadingFarm,
        isLoadingZones,
        isLoadingDevices,
        isLoadingTelemetry,
        farmError,
        authError,
        devicesError,
        telemetryError,
        selectFarm,
        refreshFarms,
        refreshZones,
        refreshDevices,
        refreshTelemetry,
        updateBackendZone,
        logout,
        totalAreaHa,
        activeZoneCount,
        unreadAlertCount,
        updateProfile,
        addZone,
        updateZone,
        deleteZone,
        loadDemoFarm,
        clearFarm,
        updateSettings,
        resetSettings,
        acceptPlan,
        rejectPlan,
        reconsiderPlan,
        resetPlans,
        createTask,
        updateTaskStage,
        toggleChecklist,
        deleteTask,
        resetTasks,
        toggleAlertRead,
        markAllAlertsRead,
        deleteAlert,
        clearAlerts,
        restoreDefaultAlerts,
        logSessionEvent,
        formatNumber,
        formatArea,
        formatDate,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
}
