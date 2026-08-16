import { IsIn } from "class-validator";

export class CsvUploadDto {
  @IsIn(["inventory", "orders", "suppliers"])
  data_type!: "inventory" | "orders" | "suppliers";
}
