import { IsBoolean, IsObject, IsOptional, IsUUID } from "class-validator";

export class CreateAutoTriggerRuleDto {
  @IsOptional()
  @IsUUID()
  scope_supplier_id?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;
}
