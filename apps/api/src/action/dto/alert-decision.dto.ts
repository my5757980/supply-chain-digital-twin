import { IsIn, IsString, ValidateIf } from "class-validator";

export class AlertDecisionDto {
  @IsIn(["accepted", "modified", "dismissed"])
  decision!: "accepted" | "modified" | "dismissed";

  @ValidateIf((dto: AlertDecisionDto) => dto.decision === "modified")
  @IsString()
  modification_notes?: string;
}
