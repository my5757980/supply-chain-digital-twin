import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsIn(["primary", "backup"])
  kind!: "primary" | "backup";

  @IsOptional()
  @IsInt()
  @Min(0)
  typical_lead_time_days?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
