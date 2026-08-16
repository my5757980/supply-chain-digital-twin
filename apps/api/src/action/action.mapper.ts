import type { Alert, AutoTriggerRule, DisruptionPrediction, Prisma, Recommendation } from "@prisma/client";

/** Matches `contracts/api.yaml`'s `DisruptionPrediction` schema. */
export interface DisruptionPredictionResponse {
  id: string;
  type: string;
  affected_supplier_id: string | null;
  affected_inventory_item_ids: string[];
  confidence_score: number;
  predicted_impact_at: string;
  status: string;
  created_by_agent: string;
  created_at: string;
}

export function toDisruptionPredictionResponse(
  prediction: DisruptionPrediction,
): DisruptionPredictionResponse {
  return {
    id: prediction.id,
    type: prediction.type,
    affected_supplier_id: prediction.affectedSupplierId,
    affected_inventory_item_ids: prediction.affectedInventoryItemIds,
    confidence_score: prediction.confidenceScore,
    predicted_impact_at: prediction.predictedImpactAt.toISOString(),
    status: prediction.status,
    created_by_agent: prediction.createdByAgent,
    created_at: prediction.createdAt.toISOString(),
  };
}

/** Matches `contracts/api.yaml`'s `Alert` schema. */
export interface AlertResponse {
  id: string;
  disruption_prediction_id: string;
  severity: string;
  status: string;
  channels_sent: string[];
  title: string;
  summary: string;
  created_at: string;
  escalated_at: string | null;
}

export function toAlertResponse(alert: Alert): AlertResponse {
  return {
    id: alert.id,
    disruption_prediction_id: alert.disruptionPredictionId,
    severity: alert.severity,
    status: alert.status,
    channels_sent: alert.channelsSent,
    title: alert.title,
    summary: alert.summary,
    created_at: alert.createdAt.toISOString(),
    escalated_at: alert.escalatedAt ? alert.escalatedAt.toISOString() : null,
  };
}

/** Matches `contracts/api.yaml`'s `Recommendation` schema. */
export interface RecommendationResponse {
  id: string;
  alert_id: string;
  steps: string[];
  recommended_supplier_id: string | null;
  recommended_directory_entry_id: string | null;
  owner_decision: string;
  auto_triggered: boolean;
}

export function toRecommendationResponse(recommendation: Recommendation): RecommendationResponse {
  return {
    id: recommendation.id,
    alert_id: recommendation.alertId,
    steps: recommendation.steps as Prisma.JsonArray as string[],
    recommended_supplier_id: recommendation.recommendedSupplierId,
    recommended_directory_entry_id: recommendation.recommendedDirectoryEntryId,
    owner_decision: recommendation.ownerDecision,
    auto_triggered: recommendation.autoTriggered,
  };
}

/** Matches `contracts/api.yaml`'s `AutoTriggerRule` schema. */
export interface AutoTriggerRuleResponse {
  id: string;
  scope_supplier_id: string | null;
  enabled: boolean;
  conditions: Prisma.JsonValue;
  created_by_user_id: string;
}

export function toAutoTriggerRuleResponse(rule: AutoTriggerRule): AutoTriggerRuleResponse {
  return {
    id: rule.id,
    scope_supplier_id: rule.scopeSupplierId,
    enabled: rule.enabled,
    conditions: rule.conditions,
    created_by_user_id: rule.createdByUserId,
  };
}
