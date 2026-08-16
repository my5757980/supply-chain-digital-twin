const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error: { message?: string } }).error.message
        : res.statusText;
    throw new ApiError(res.status, message ?? "Request failed");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface Tenant {
  id: string;
  business_name: string;
  sector: string;
  country: string;
  onboarding_status: string;
  owner_user_id: string;
}

export function createTenant(input: {
  business_name: string;
  sector: string;
  owner_email_or_phone: string;
}): Promise<Tenant> {
  return request<Tenant>("/tenants", { method: "POST", body: JSON.stringify(input) });
}

export interface SessionUser {
  id: string;
  tenantId: string | null;
  role: "owner" | "staff" | "platform_admin";
}

export function devLogin(userId: string): Promise<SessionUser> {
  return request<SessionUser>("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function getSession(): Promise<SessionUser> {
  return request<SessionUser>("/auth/me");
}

export interface AiConsent {
  tenant_id: string;
  onboarding_status: string;
  ai_processing_consent_at: string | null;
}

/** Constitution Principle V — until this is granted, no prediction or
 * recommendation will be produced for the business. */
export function grantAiConsent(): Promise<AiConsent> {
  return request<AiConsent>("/tenants/me/ai-consent", { method: "POST" });
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity_on_hand: number;
  reorder_threshold: number | null;
  data_source_id: string | null;
  updated_at: string;
}

export function createInventoryItem(input: {
  sku: string;
  name: string;
  quantity_on_hand: number;
  reorder_threshold?: number;
}): Promise<InventoryItem> {
  return request<InventoryItem>("/inventory-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Supplier {
  id: string;
  name: string;
  kind: "primary" | "backup";
  status: string;
  typical_lead_time_days: number | null;
  location: string | null;
}

export function createSupplier(input: {
  name: string;
  kind: "primary" | "backup";
  typical_lead_time_days?: number;
  location?: string;
}): Promise<Supplier> {
  return request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(input) });
}

export function listSuppliers(): Promise<Supplier[]> {
  return request<Supplier[]>("/suppliers");
}

export function uploadCsv(
  file: File,
  dataType: "inventory" | "orders" | "suppliers",
): Promise<{ data_source_id: string; status: "processing" }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("data_type", dataType);
  return request("/data-sources/csv-upload", { method: "POST", body: formData });
}

export interface TwinSnapshot {
  tenant_id: string;
  computed_at: string;
  inventory_summary: InventoryItem[];
  suppliers: Supplier[];
  open_orders_count: number;
  stale_data_warnings: Array<{ data_source_id: string; affected_area: string }>;
}

export function getTwin(): Promise<TwinSnapshot> {
  return request<TwinSnapshot>("/twin");
}

export function twinEventsUrl(): string {
  return `${API_URL}/events/stream`;
}

export interface Alert {
  id: string;
  disruption_prediction_id: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "acknowledged" | "acted_on" | "dismissed" | "escalated" | "expired";
  channels_sent: string[];
  title: string;
  summary: string;
  created_at: string;
  escalated_at: string | null;
}

export interface DisruptionPrediction {
  id: string;
  type: "supplier_delay" | "port_congestion" | "demand_spike";
  affected_supplier_id: string | null;
  affected_inventory_item_ids: string[];
  confidence_score: number;
  predicted_impact_at: string;
  status: "active" | "resolved_true_positive" | "resolved_false_positive" | "expired";
  created_by_agent: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  alert_id: string;
  steps: string[];
  recommended_supplier_id: string | null;
  recommended_directory_entry_id: string | null;
  owner_decision: "pending" | "accepted" | "modified" | "dismissed";
  auto_triggered: boolean;
}

/** Only GET /alerts/{id} includes the denormalized names. */
export interface RecommendationDetail extends Recommendation {
  recommended_supplier_name: string | null;
  recommended_directory_entry_name: string | null;
}

export interface AlertDetail extends Alert {
  prediction: DisruptionPrediction;
  recommendation: RecommendationDetail | null;
}

export function decideOnAlert(
  alertId: string,
  input: { decision: "accepted" | "modified" | "dismissed"; modification_notes?: string },
): Promise<Recommendation> {
  return request<Recommendation>(`/alerts/${alertId}/decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AutoTriggerRule {
  id: string;
  scope_supplier_id: string | null;
  enabled: boolean;
  conditions: { min_confidence?: number } & Record<string, unknown>;
  created_by_user_id: string;
}

export function listAutoTriggerRules(): Promise<AutoTriggerRule[]> {
  return request<AutoTriggerRule[]>("/auto-trigger-rules");
}

export function createAutoTriggerRule(input: {
  scope_supplier_id?: string;
  enabled: boolean;
  conditions?: Record<string, unknown>;
}): Promise<AutoTriggerRule> {
  return request<AutoTriggerRule>("/auto-trigger-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAlerts(): Promise<Alert[]> {
  return request<Alert[]>("/alerts");
}

export function getAlert(id: string): Promise<AlertDetail> {
  return request<AlertDetail>(`/alerts/${id}`);
}

export function listPredictions(): Promise<DisruptionPrediction[]> {
  return request<DisruptionPrediction[]>("/predictions");
}
