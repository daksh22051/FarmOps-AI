/**
 * FarmOps AI — Frontend TypeScript Types & Interfaces (v1.0.0)
 * 
 * Auto-aligned with backend Pydantic v2 schemas located under app/schemas/
 * and authoritative contract at backend/docs/frontend-types.ts.
 */

// ==========================================
// 1. GENERIC API RESPONSE ENVELOPES & ERRORS
// ==========================================

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface APIResponse<T> {
  success: boolean;
  message?: string | null;
  data: T | null;
  error?: APIError | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy" | string;
  version: string;
  database: "connected" | "disconnected" | string;
  environment: "development" | "staging" | "production" | string;
  mqtt?: {
    running: boolean;
    broker: string;
    connected: boolean;
  } | null;
  timestamp: string; // ISO-8601
}

// ==========================================
// 2. AUTHENTICATION & USER PROFILE
// ==========================================

export interface UserProfile {
  id: string; // User UUID from Supabase Auth
  email?: string | null;
  role: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}

export interface TokenClaims {
  sub: string;
  email?: string | null;
  role?: string | null;
  exp?: number | null;
}

// ==========================================
// 3. FARMS, ZONES & MEMBERSHIPS
// ==========================================

export type AreaUnit = "hectare" | "hectares" | "acre" | "acres" | "sq_meter" | "sq_meters" | "sq_km" | "mu" | "sqm";

export type CropStage =
  | "seedling"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "maturity"
  | "harvested"
  | "dormant"
  | "fallow"
  | "ripening";

export type ZoneStatus = "active" | "fallow" | "quarantine" | "harvested" | "inactive" | "maintenance";

export type FarmRole = "owner" | "manager" | "agronomist" | "operator" | "viewer";

export interface GeoJSONGeometry {
  type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection" | "Feature" | "FeatureCollection";
  coordinates?: unknown;
  features?: unknown[];
  geometries?: unknown[];
}

export interface Zone {
  id: string;
  farm_id: string;
  name: string;
  area?: number | null;
  area_unit: AreaUnit | string;
  geometry?: GeoJSONGeometry | null;
  crop?: string | null;
  crop_stage?: CropStage | string | null;
  soil_type?: string | null;
  status: ZoneStatus | string;
  is_demo: boolean;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

export interface ZoneCreate {
  name: string;
  area?: number | null;
  area_unit?: AreaUnit | string;
  geometry?: GeoJSONGeometry | null;
  crop?: string | null;
  crop_stage?: CropStage | string | null;
  soil_type?: string | null;
  status?: ZoneStatus | string;
  is_demo?: boolean;
}

export interface ZoneUpdate {
  name?: string;
  area?: number | null;
  area_unit?: AreaUnit | string;
  geometry?: GeoJSONGeometry | null;
  crop?: string | null;
  crop_stage?: CropStage | string | null;
  soil_type?: string | null;
  status?: ZoneStatus | string;
  is_demo?: boolean;
}

export interface Farm {
  id: string;
  owner_id: string;
  name: string;
  location?: string | null;
  address?: string | null;
  timezone: string;
  total_area?: number | null;
  area_unit: AreaUnit | string;
  boundary_geometry?: GeoJSONGeometry | null;
  crop_profile?: Record<string, unknown> | null;
  policies?: Record<string, unknown> | null;
  is_demo: boolean;
  zones?: Zone[];
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

export interface FarmCreate {
  name: string;
  location?: string | null;
  address?: string | null;
  timezone?: string;
  total_area?: number | null;
  area_unit?: AreaUnit | string;
  boundary_geometry?: GeoJSONGeometry | null;
  crop_profile?: Record<string, unknown> | null;
  policies?: Record<string, unknown> | null;
  is_demo?: boolean;
}

export interface FarmUpdate {
  name?: string;
  location?: string | null;
  address?: string | null;
  timezone?: string;
  total_area?: number | null;
  area_unit?: AreaUnit | string;
  boundary_geometry?: GeoJSONGeometry | null;
  crop_profile?: Record<string, unknown> | null;
  policies?: Record<string, unknown> | null;
  is_demo?: boolean;
}

export interface FarmMembership {
  id: string;
  farm_id: string;
  user_id: string;
  role: FarmRole | string;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

// ==========================================
// 4. DEVICES & HARDWARE SENSORS
// ==========================================

export type DeviceType =
  | "soil_moisture"
  | "soil_sensor"
  | "soil_probe"
  | "weather"
  | "weather_station"
  | "npk"
  | "ph"
  | "temperature"
  | "humidity"
  | "multi_sensor"
  | "multispectral_camera"
  | "gateway"
  | "drone_gateway"
  | "generic_iot"
  | "actuator"
  | "irrigation_controller"
  | "valve"
  | "valve_actuator"
  | "other";

export interface Device {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  device_type: DeviceType | string;
  calibration?: Record<string, unknown> | null;
  credential_reference?: string | null;
  enabled: boolean;
  is_demo: boolean;
  last_seen_at?: string | null; // ISO-8601
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

export interface DeviceCreate {
  zone_id?: string | null;
  device_type: DeviceType | string;
  calibration?: Record<string, unknown> | null;
  credential_reference?: string | null;
  enabled?: boolean;
  is_demo?: boolean;
}

export interface DeviceUpdate {
  zone_id?: string | null;
  device_type?: DeviceType | string;
  calibration?: Record<string, unknown> | null;
  credential_reference?: string | null;
  enabled?: boolean;
  is_demo?: boolean;
}

// ==========================================
// 5. TELEMETRY & SENSOR MEASUREMENTS
// ==========================================

export interface TelemetryMeasurements {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  battery_level?: number;
  [key: string]: number | undefined;
}

export interface TelemetryEventCreate {
  device_id: string;
  sequence: number;
  event_timestamp: string; // ISO-8601
  measurements: Record<string, number>;
  unit_system?: "metric" | "si" | "default" | string;
  metadata?: Record<string, unknown> | null;
}

export interface TelemetryEvent {
  id: string;
  device_id: string;
  farm_id?: string | null;
  zone_id?: string | null;
  sequence: number;
  event_timestamp: string; // ISO-8601
  received_at?: string | null; // ISO-8601
  measurements: Record<string, number>;
  unit_system: string;
  duplicate: boolean;
  status: "accepted" | "duplicate" | string;
  metadata?: Record<string, unknown> | null;
}

export interface TelemetryEventResponse {
  id: string;
  device_id: string;
  farm_id?: string | null;
  zone_id?: string | null;
  sequence: number;
  event_timestamp: string; // ISO-8601
  received_at?: string | null; // ISO-8601
  measurements: Record<string, number>;
  unit_system: string;
  duplicate: boolean;
  status: "accepted" | "duplicate" | string;
  metadata?: Record<string, unknown> | null;
}

export interface SensorEventResponse {
  id: string;
  device_id: string;
  farm_id: string;
  zone_id?: string | null;
  metric: string;
  value: number;
  unit: string;
  event_at: string; // ISO-8601
  received_at: string; // ISO-8601
  sequence: number;
  quality: string;
  source: string;
  correlation_id?: string | null;
  schema_version: string;
  is_duplicate: boolean;
  is_delayed: boolean;
  // Optional flattened canonical measurements if present
  soil_moisture?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  rainfall?: number | null;
  ph?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  battery_level?: number | null;
  raw_payload?: Record<string, unknown> | null;
}

// ==========================================
// 6. EXTERNAL OBSERVATIONS
// ==========================================

export type ObservationSource = "weather" | "openmeteo" | "sentinel_2" | "market" | "drone" | string;

export type ObservationType =
  | "rainfall_forecast"
  | "weather_current"
  | "satellite_ndvi"
  | "soil_survey"
  | "market_price"
  | string;

export interface ExternalObservationCreate {
  farm_id: string;
  zone_id?: string | null;
  source: ObservationSource;
  observation_type: ObservationType;
  observed_at?: string; // ISO-8601
  payload: Record<string, unknown>;
  source_reference?: string | null;
  valid_from?: string | null; // ISO-8601
  valid_until?: string | null; // ISO-8601
  freshness?: "fresh" | "stale" | "expired" | string;
}

export interface ExternalObservation {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  source: ObservationSource;
  observation_type: ObservationType;
  observed_at: string; // ISO-8601
  payload: Record<string, unknown>;
  source_reference?: string | null;
  freshness: "fresh" | "stale" | "expired" | string;
  status: "active" | "archived" | string;
  fetched_at: string; // ISO-8601
  valid_from?: string | null;
  valid_until?: string | null;
  created_at: string; // ISO-8601
  duplicate: boolean;
}

// ==========================================
// 7. RISK DETECTION & RISK ASSESSMENTS
// ==========================================

export type RiskType =
  | "water_stress"
  | "pest_disease"
  | "nutrient_deficiency"
  | "heat_stress"
  | "frost"
  | "market_exposure"
  | string;

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface RiskSignalEvidence {
  name: string;
  value: unknown;
  unit?: string;
  observed_at?: string | null;
}

export interface RiskEvidence {
  signals: RiskSignalEvidence[];
  rules_triggered: string[];
  freshness: "fresh" | "stale" | "very_stale" | string;
  explanation?: string | null;
  context?: Record<string, unknown>;
}

export interface RiskAssessment {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  risk_type: RiskType;
  severity: RiskSeverity;
  score: number;
  confidence: number;
  evidence?: RiskEvidence | Record<string, unknown> | null;
  missing_information?: string[] | null;
  status: RiskStatus;
  agent: string;
  agent_version: string;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

// ==========================================
// 8. AI PROPOSALS & SAFETY EVALUATIONS
// ==========================================

export type AgentTypeEnum =
  | "WATER_AGENT"
  | "PEST_DISEASE_AGENT"
  | "NUTRIENT_AGENT"
  | "MARKET_CONTEXT_AGENT"
  | "ORCHESTRATOR";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type PolicyDecision = "allow" | "approval_required" | "rejected" | "escalate" | "ALLOW" | "APPROVAL_REQUIRED" | "REJECT" | "ESCALATE";

export interface AIProposal {
  agent_type: AgentTypeEnum | string;
  risk_type: string;
  recommendation: string;
  rationale: string;
  confidence: number;
  urgency: UrgencyLevel;
  evidence_refs: string[];
  assumptions: string[];
  uncertainty?: string;
  requires_human_review: boolean;
  safety_notes?: string | null;
}

export interface AISafetyDecision {
  decision: "approved" | "requires_review" | "rejected" | "escalate" | "allow" | "approval_required" | string;
  approval_required: boolean;
  safety_flags: string[];
  rationale: string;
  requires_escalation: boolean;
}

export interface AIEvaluationRequest {
  risk_id: string;
}

export interface AIEvaluationResponse {
  risk: Record<string, unknown>;
  proposal: AIProposal;
  safety: AISafetyDecision;
}

export interface FarmPhotoInspectionRequest {
  image_base64: string;
  mime_type?: string;
}

export interface FarmVisionInspectionResult {
  is_valid_farm: boolean;
  category: string;
  confidence: number;
  rejection_reason?: string | null;
  detected_crop?: string | null;
  vegetation_health?: string | null;
  soil_condition?: string | null;
  canopy_cover_pct?: number | null;
  agronomic_advice?: string | null;
}

// ==========================================
// 9. ACTION PLANS & HUMAN APPROVALS
// ==========================================

export type ActionPlanStatusEnum =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "cancelled";

export interface ActionPlanStep {
  step_number: number;
  title: string;
  description?: string | null;
  action_type?: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped" | string;
  notes?: string | null;
}

export interface ActionPlan {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  risk_id?: string | null;
  source_risk_ids?: string[] | null;
  title?: string | null;
  objective?: string | null;
  action_type: string;
  action_summary: string;
  earliest_at?: string | null;
  latest_at?: string | null;
  priority: string;
  confidence: number;
  evidence?: Record<string, unknown> | null;
  estimated_cost?: number | null;
  estimated_duration_minutes?: number | null;
  safety_flags?: string[] | null;
  approval_required: boolean;
  requires_human_approval?: boolean | null;
  approval_state: ActionPlanStatusEnum | string;
  status?: string | null;
  policy_decision: string;
  safety_status?: string | null;
  safety_notes?: string | null;
  steps?: ActionPlanStep[] | Record<string, unknown>[] | null;
  source?: string | null;
  rationale?: string | null;
  version: number;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

export interface ActionPlanCreate {
  farm_id?: string | null;
  zone_id?: string | null;
  risk_id?: string | null;
  source_risk_ids?: string[] | null;
  title?: string | null;
  objective?: string | null;
  action_type?: string | null;
  action_summary?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | string;
  confidence?: number;
  rationale?: string | null;
  estimated_cost?: number | null;
  estimated_duration_minutes?: number | null;
  steps?: ActionPlanStep[] | null;
  evidence?: Record<string, unknown> | null;
  source?: string | null;
  ai_proposal?: AIProposal | null;
}

// ==========================================
// 10. FIELD TASKS & OPERATIONAL LIFECYCLE
// ==========================================

export type TaskStatusEnum =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "blocked";

export interface Task {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  plan_id?: string | null;
  action_plan_id?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status: TaskStatusEnum | string;
  assignee_id?: string | null;
  due_from?: string | null;
  due_until?: string | null;
  checklist?: Record<string, unknown>[] | null;
  notes?: string | null;
  evidence?: Record<string, unknown> | null;
  source?: string | null;
  completion_notes?: string | null;
  completed_by?: string | null;
  started_at?: string | null; // ISO-8601
  completed_at?: string | null; // ISO-8601
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

export interface TaskCreate {
  farm_id: string;
  zone_id?: string | null;
  plan_id?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | string;
  status?: TaskStatusEnum | string;
  due_from?: string | null;
  due_until?: string | null;
  checklist?: Record<string, unknown>[] | null;
  notes?: string | null;
  evidence?: Record<string, unknown> | null;
  source?: string;
}

export interface TaskUpdate {
  assignee_id?: string | null;
  status?: TaskStatusEnum | string;
  checklist?: Record<string, unknown>[] | null;
  notes?: string | null;
  evidence?: Record<string, unknown> | null;
  started_at?: string | null;
  completed_at?: string | null;
}

// ==========================================
// 11. ALERTS & NOTIFICATIONS
// ==========================================

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  risk_id?: string | null;
  severity: AlertSeverity | string;
  channel: string;
  message: string;
  delivery_status: "pending" | "delivered" | "failed" | string;
  acknowledged_at?: string | null; // ISO-8601
  dedupe_key: string;
  created_at: string; // ISO-8601
}

export interface AlertAcknowledgeRequest {
  acknowledged_by?: string;
}

// ==========================================
// 12. ESCALATIONS & EXPERT REVIEW
// ==========================================

export type EscalationStatus = "open" | "in_review" | "resolved" | "rejected";

export interface EscalationCreate {
  farm_id: string;
  zone_id?: string | null;
  risk_id?: string | null;
  plan_id?: string | null;
  reason: string;
}

export interface EscalationReviewRequest {
  assigned_expert_id?: string | null;
  review_notes: string;
  review_outcome: string;
  status?: "resolved" | "rejected" | "in_review" | string;
}

export interface Escalation {
  id: string;
  farm_id: string;
  zone_id?: string | null;
  risk_id?: string | null;
  plan_id?: string | null;
  reason: string;
  status: EscalationStatus | string;
  assigned_expert_id?: string | null;
  review_notes?: string | null;
  review_outcome?: string | null;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
}

// ==========================================
// 13. AUDIT TIMELINE & OBSERVABILITY
// ==========================================

export interface AuditEvent {
  id: string;
  farm_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  actor_id?: string | null;
  event_type: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  correlation_id?: string | null;
  timestamp: string; // ISO-8601
  source: string;
  model_version?: string | null;
  policy_version?: string | null;
}

// ==========================================
// 14. END-TO-END DEMO PIPELINE
// ==========================================

export type DemoScenario =
  | "water_stress"
  | "pest_disease"
  | "nutrient_deficiency"
  | "chemical_approval"
  | "prohibited_actuator";

export interface DemoRunResult {
  demo_run_id: string;
  scenario: string;
  success: boolean;
  farm_id: string;
  zone_id: string;
  device_id: string;
  telemetry_event_id: string;
  telemetry_measurements: Record<string, unknown>;
  risk_id?: string | null;
  risk_type?: string | null;
  risk_severity?: string | null;
  risk_score?: number | null;
  ai_proposal?: Record<string, unknown> | null;
  safety_decision?: PolicyDecision | string | null;
  action_plan_id?: string | null;
  approval_state?: string | null;
  task_id?: string | null;
  task_status?: string | null;
  audit_event_ids: string[];
  alert_ids: string[];
  reassessment_requested: boolean;
  execution_log: string[];
  error_message?: string | null;
}

export interface DemoStatusResponse {
  status: "ready" | string;
  available_scenarios: string[];
  supported_providers: string[];
  deterministic_mode: boolean;
}
