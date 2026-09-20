import { apiClient, type RequestOptions } from "./client";
import type {
  UserProfile,
  Farm,
  FarmCreate,
  FarmUpdate,
  Zone,
  ZoneCreate,
  ZoneUpdate,
  Device,
  DeviceCreate,
  DeviceUpdate,
  TelemetryEventCreate,
  TelemetryEventResponse,
  SensorEventResponse,
  ExternalObservation,
  RiskAssessment,
  ActionPlan,
  ActionPlanCreate,
  Task,
  TaskCreate,
  TaskUpdate,
  Alert,
  AlertAcknowledgeRequest,
  Escalation,
  EscalationCreate,
  EscalationReviewRequest,
  AuditEvent,
  DemoRunResult,
  DemoStatusResponse,
  HealthResponse,
  APIResponse,
  AIEvaluationRequest,
  AIEvaluationResponse,
  DemoScenario,
  FarmVisionInspectionResult,
  FarmPhotoInspectionRequest,
} from "../../types/api";

// ==========================================
// 1. AUTHENTICATION
// ==========================================

export async function getCurrentUser(options?: RequestOptions): Promise<APIResponse<UserProfile>> {
  return apiClient.get<UserProfile>("/auth/me", options);
}

// ==========================================
// 2. FARMS
// ==========================================

export async function getFarms(options?: RequestOptions): Promise<APIResponse<Farm[]>> {
  return apiClient.get<Farm[]>("/farms", options);
}

export async function getFarm(farmId: string, options?: RequestOptions): Promise<APIResponse<Farm>> {
  return apiClient.get<Farm>(`/farms/${farmId}`, options);
}

export async function createFarm(data: FarmCreate, options?: RequestOptions): Promise<APIResponse<Farm>> {
  return apiClient.post<Farm>("/farms", data, options);
}

export async function updateFarm(farmId: string, data: FarmUpdate, options?: RequestOptions): Promise<APIResponse<Farm>> {
  return apiClient.patch<Farm>(`/farms/${farmId}`, data, options);
}

export async function deleteFarm(farmId: string, options?: RequestOptions): Promise<APIResponse<null>> {
  return apiClient.delete<null>(`/farms/${farmId}`, options);
}

// ==========================================
// 3. ZONES
// ==========================================

export async function getZones(farmId: string, options?: RequestOptions): Promise<APIResponse<Zone[]>> {
  return apiClient.get<Zone[]>(`/farms/${farmId}/zones`, options);
}

export async function createZone(farmId: string, data: ZoneCreate, options?: RequestOptions): Promise<APIResponse<Zone>> {
  return apiClient.post<Zone>(`/farms/${farmId}/zones`, data, options);
}

export async function getZone(zoneId: string, options?: RequestOptions): Promise<APIResponse<Zone>> {
  return apiClient.get<Zone>(`/zones/${zoneId}`, options);
}

export async function updateZone(zoneId: string, data: ZoneUpdate, options?: RequestOptions): Promise<APIResponse<Zone>> {
  return apiClient.patch<Zone>(`/zones/${zoneId}`, data, options);
}

export async function deleteZone(zoneId: string, options?: RequestOptions): Promise<APIResponse<boolean>> {
  return apiClient.delete<boolean>(`/zones/${zoneId}`, options);
}

// ==========================================
// 4. DEVICES
// ==========================================

export async function getDevices(farmId: string, options?: RequestOptions): Promise<APIResponse<Device[]>> {
  return apiClient.get<Device[]>(`/farms/${farmId}/devices`, options);
}

export async function createDevice(farmId: string, data: DeviceCreate, options?: RequestOptions): Promise<APIResponse<Device>> {
  return apiClient.post<Device>(`/farms/${farmId}/devices`, data, options);
}

export async function getDevice(deviceId: string, options?: RequestOptions): Promise<APIResponse<Device>> {
  return apiClient.get<Device>(`/devices/${deviceId}`, options);
}

export async function updateDevice(deviceId: string, data: DeviceUpdate, options?: RequestOptions): Promise<APIResponse<Device>> {
  return apiClient.patch<Device>(`/devices/${deviceId}`, data, options);
}

export async function deleteDevice(deviceId: string, options?: RequestOptions): Promise<APIResponse<boolean>> {
  return apiClient.delete<boolean>(`/devices/${deviceId}`, options);
}

// ==========================================
// 5. TELEMETRY & SENSOR READINGS
// ==========================================

export async function getTelemetryEvents(
  farmId: string,
  params?: {
    zone_id?: string;
    device_id?: string;
    metric?: string;
    start_time?: string;
    end_time?: string;
    limit?: number;
    offset?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<SensorEventResponse[]>> {
  return apiClient.get<SensorEventResponse[]>(`/telemetry/${farmId}/events`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function createTelemetryEvent(
  data: TelemetryEventCreate,
  options?: RequestOptions
): Promise<APIResponse<TelemetryEventResponse>> {
  return apiClient.post<TelemetryEventResponse>("/telemetry/events", data, options);
}

export async function simulateFarmTelemetry(
  farmId: string,
  seedHistory: boolean = false,
  options?: RequestOptions
): Promise<APIResponse<{ farm_id: string; events_generated: number; timestamp: string }>> {
  return apiClient.post<{ farm_id: string; events_generated: number; timestamp: string }>(
    `/telemetry/${farmId}/simulate?seed_history=${seedHistory}`,
    {},
    options
  );
}

export async function simulateAllTelemetry(
  options?: RequestOptions
): Promise<APIResponse<Record<string, number>>> {
  return apiClient.post<Record<string, number>>("/telemetry/simulate-all", {}, options);
}

// ==========================================
// 6. EXTERNAL OBSERVATIONS
// ==========================================

export async function getObservations(farmId: string, options?: RequestOptions): Promise<APIResponse<ExternalObservation[]>> {
  return apiClient.get<ExternalObservation[]>(`/observations/farm/${farmId}`, options);
}

// ==========================================
// 7. RISKS & RISK DETECTION
// ==========================================

export async function getRisks(
  farmId: string,
  params?: {
    zone_id?: string;
    risk_type?: string;
    severity?: string;
    status?: string;
    page?: number;
    page_size?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<RiskAssessment[]>> {
  return apiClient.get<RiskAssessment[]>(`/farms/${farmId}/risks`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function detectRisks(
  data: { farm_id: string; zone_id?: string | null; telemetry_override?: Record<string, unknown> | null },
  options?: RequestOptions
): Promise<APIResponse<RiskAssessment[]>> {
  return apiClient.post<RiskAssessment[]>("/risks/detect", data, options);
}

export async function getRiskDetail(riskId: string, options?: RequestOptions): Promise<APIResponse<RiskAssessment>> {
  return apiClient.get<RiskAssessment>(`/risks/${riskId}`, options);
}

export async function evaluateRisks(
  data: { farm_id: string; zone_id?: string | null; telemetry_override?: Record<string, unknown> | null },
  options?: RequestOptions
): Promise<APIResponse<RiskAssessment[]>> {
  return apiClient.post<RiskAssessment[]>("/risks/evaluate", data, options);
}

// ==========================================
// 8. AI EVALUATION
// ==========================================

export async function evaluateRiskWithAI(
  data: AIEvaluationRequest,
  options?: RequestOptions
): Promise<APIResponse<AIEvaluationResponse>> {
  return apiClient.post<AIEvaluationResponse>("/ai/evaluate-risk", data, options);
}

export async function inspectFarmPhoto(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  options?: RequestOptions
): Promise<APIResponse<FarmVisionInspectionResult>> {
  return apiClient.post<FarmVisionInspectionResult>(
    "/ai/inspect-farm-photo",
    { image_base64: imageBase64, mime_type: mimeType },
    options
  );
}

// ==========================================
// 9. ACTION PLANS
// ==========================================

export async function getActionPlans(
  farmId: string,
  params?: {
    status?: string;
    approval_state?: string;
    policy_decision?: string;
    zone_id?: string;
    limit?: number;
    page?: number;
    page_size?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<ActionPlan[]>> {
  return apiClient.get<ActionPlan[]>(`/farms/${farmId}/action-plans`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function getActionPlan(actionPlanId: string, options?: RequestOptions): Promise<APIResponse<ActionPlan>> {
  return apiClient.get<ActionPlan>(`/action-plans/${actionPlanId}`, options);
}

export async function createActionPlan(
  data: ActionPlanCreate,
  options?: RequestOptions
): Promise<APIResponse<ActionPlan>> {
  return apiClient.post<ActionPlan>("/action-plans", data, options);
}

/**
 * The farmer's decision on a proposed plan. `reschedule` returns the plan to
 * `pending_approval` with a new execution window and a bumped version, so the
 * earlier proposal stays in the audit trail rather than being overwritten.
 */
export type PlanDecision = {
  decision: "approve" | "reject" | "reschedule";
  reason?: string | null;
  /** Required for `reschedule`; ignored otherwise. */
  earliest_at?: string | null;
  latest_at?: string | null;
};

export async function decideActionPlan(
  planId: string,
  data: PlanDecision,
  options?: RequestOptions
): Promise<APIResponse<ActionPlan>> {
  return apiClient.post<ActionPlan>(`/plans/${planId}/decision`, data, options);
}

export async function approveActionPlan(
  actionPlanId: string,
  data?: { review_notes?: string | null; notes?: string | null },
  options?: RequestOptions
): Promise<APIResponse<ActionPlan>> {
  return decideActionPlan(
    actionPlanId,
    { decision: "approve", reason: data?.review_notes ?? data?.notes ?? null },
    options
  );
}

export async function rejectActionPlan(
  actionPlanId: string,
  data?: { review_notes?: string | null; notes?: string | null },
  options?: RequestOptions
): Promise<APIResponse<ActionPlan>> {
  return decideActionPlan(
    actionPlanId,
    { decision: "reject", reason: data?.review_notes ?? data?.notes ?? null },
    options
  );
}

export async function rescheduleActionPlan(
  actionPlanId: string,
  data: { earliest_at: string; latest_at: string; review_notes?: string | null },
  options?: RequestOptions
): Promise<APIResponse<ActionPlan>> {
  return decideActionPlan(
    actionPlanId,
    {
      decision: "reschedule",
      earliest_at: data.earliest_at,
      latest_at: data.latest_at,
      reason: data.review_notes ?? null,
    },
    options
  );
}

// ==========================================
// 10. FIELD TASKS
// ==========================================

export async function getTasks(
  farmId: string,
  params?: {
    status?: string;
    zone_id?: string;
    limit?: number;
    page?: number;
    page_size?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<Task[]>> {
  return apiClient.get<Task[]>(`/farms/${farmId}/tasks`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function getTaskDetail(taskId: string, options?: RequestOptions): Promise<APIResponse<Task>> {
  return apiClient.get<Task>(`/tasks/detail/${taskId}`, options);
}

export async function getTask(taskId: string, options?: RequestOptions): Promise<APIResponse<Task>> {
  return apiClient.get<Task>(`/tasks/${taskId}`, options);
}

export async function createTask(
  data: TaskCreate,
  options?: RequestOptions
): Promise<APIResponse<Task>> {
  return apiClient.post<Task>("/tasks", data, options);
}

export async function startTask(
  taskId: string,
  data?: { notes?: string | null },
  options?: RequestOptions
): Promise<APIResponse<Task>> {
  return apiClient.post<Task>(`/tasks/${taskId}/start`, data || {}, options);
}

export async function completeTask(
  taskId: string,
  data?: { completion_notes?: string | null; completed_by?: string | null },
  options?: RequestOptions
): Promise<APIResponse<Task>> {
  return apiClient.post<Task>(`/tasks/${taskId}/complete`, data || {}, options);
}

export async function cancelTask(
  taskId: string,
  data?: { reason?: string | null },
  options?: RequestOptions
): Promise<APIResponse<Task>> {
  return apiClient.post<Task>(`/tasks/${taskId}/cancel`, data || {}, options);
}

export async function updateTask(
  taskId: string,
  data: TaskUpdate,
  options?: RequestOptions
): Promise<APIResponse<Task>> {
  return apiClient.patch<Task>(`/tasks/${taskId}`, data, options);
}

// ==========================================
// 11. ALERTS
// ==========================================

export async function getAlerts(
  farmId: string,
  params?: {
    zone_id?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<Alert[]>> {
  return apiClient.get<Alert[]>(`/alerts/${farmId}`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function acknowledgeAlert(
  alertId: string,
  data?: AlertAcknowledgeRequest,
  options?: RequestOptions
): Promise<APIResponse<Alert>> {
  return apiClient.post<Alert>(`/alerts/${alertId}/acknowledge`, data || {}, options);
}

// ==========================================
// 12. ESCALATIONS & EXPERT REVIEW
// ==========================================

export async function getEscalations(
  farmId: string,
  params?: {
    status?: string;
    limit?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<Escalation[]>> {
  return apiClient.get<Escalation[]>(`/escalations/${farmId}`, {
    ...options,
    params: params as Record<string, string | number | boolean | undefined | null>,
  });
}

export async function createEscalation(
  data: EscalationCreate,
  options?: RequestOptions
): Promise<APIResponse<Escalation>> {
  return apiClient.post<Escalation>("/escalations", data, options);
}

export async function reviewEscalation(
  escalationId: string,
  data: EscalationReviewRequest,
  options?: RequestOptions
): Promise<APIResponse<Escalation>> {
  return apiClient.post<Escalation>(`/escalations/${escalationId}/review`, data, options);
}

// ==========================================
// 13. AUDIT TIMELINE
// ==========================================

export async function getAuditEvents(
  farmId?: string,
  params?: {
    limit?: number;
    offset?: number;
  },
  options?: RequestOptions
): Promise<APIResponse<AuditEvent[]>> {
  return apiClient.get<AuditEvent[]>("/audit", {
    ...options,
    params: { ...(farmId ? { farm_id: farmId } : {}), ...(params || {}) },
  });
}

// ==========================================
// 13. ONE-CLICK DEMO PIPELINE
// ==========================================

export async function runDemo(
  scenario: DemoScenario | string = "water_stress",
  options?: {
    auto_approve?: boolean;
    force_approval_required?: boolean;
    farm_name?: string;
    zone_name?: string;
    telemetry_override?: Record<string, unknown> | null;
  },
  requestOptions?: RequestOptions
): Promise<APIResponse<DemoRunResult>> {
  return apiClient.post<DemoRunResult>("/demo/run", { scenario, ...(options || {}) }, requestOptions);
}

export async function getDemoStatus(options?: RequestOptions): Promise<APIResponse<DemoStatusResponse>> {
  return apiClient.get<DemoStatusResponse>("/demo/status", options);
}

export interface SimulatorStatus {
  enabled: boolean;
  environment: string;
  label: string;
}

export interface SimulatorEmitResult {
  farm_id: string;
  events_emitted: number;
  history_events_seeded: number;
  source: string;
  simulated: boolean;
}

/** Whether simulator controls are available in this deployment. Disabled in production. */
export async function getSimulatorStatus(
  options?: RequestOptions
): Promise<APIResponse<SimulatorStatus>> {
  return apiClient.get<SimulatorStatus>("/demo/simulator/status", options);
}

/**
 * Emit one round of clearly-labelled simulated readings for a farm.
 * Every event is stored with source="simulator" and is never presented as live data.
 */
export async function emitSimulatedReadings(
  farmId: string,
  seedHistory = false,
  options?: RequestOptions
): Promise<APIResponse<SimulatorEmitResult>> {
  return apiClient.post<SimulatorEmitResult>(
    `/demo/simulator/emit?farm_id=${encodeURIComponent(farmId)}&seed_history=${seedHistory}`,
    {},
    options
  );
}

// ==========================================
// 14. HEALTH CHECKS
// ==========================================

export async function getHealth(options?: RequestOptions): Promise<APIResponse<HealthResponse>> {
  return apiClient.get<HealthResponse>("/health", options);
}

export async function getDbHealth(options?: RequestOptions): Promise<APIResponse<Record<string, unknown>>> {
  return apiClient.get<Record<string, unknown>>("/health/db", options);
}
