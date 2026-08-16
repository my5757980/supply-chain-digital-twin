import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  quantity_on_hand!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorder_threshold?: number;
}
