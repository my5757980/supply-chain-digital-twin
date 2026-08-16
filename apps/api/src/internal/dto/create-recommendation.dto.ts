import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from "class-validator";

/** Field names match what `apps/ai-service`'s recommendation callback sends. */
export class CreateRecommendationDto {
  @IsUUID()
  tenant_id!: string;

  @IsUUID()
  alert_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  steps!: string[];

  @IsOptional()
  @IsUUID()
  recommended_supplier_id?: string;

  @IsOptional()
  @IsUUID()
  recommended_directory_entry_id?: string;
}
