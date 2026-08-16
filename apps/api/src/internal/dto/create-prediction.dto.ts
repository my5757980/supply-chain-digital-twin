import { IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

/** Field names match what `apps/ai-service`'s callback sends. */
export class CreatePredictionDto {
  @IsUUID()
  tenant_id!: string;

  @IsIn(["supplier_delay", "port_congestion", "demand_spike"])
  type!: "supplier_delay" | "port_congestion" | "demand_spike";

  @IsOptional()
  @IsUUID()
  affected_supplier_id?: string;

  @IsArray()
  @IsString({ each: true })
  affected_inventory_item_ids!: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence_score!: number;

  @IsISO8601()
  predicted_impact_at!: string;

  @IsString()
  created_by_agent!: string;

  @IsString()
  rationale!: string;
}
