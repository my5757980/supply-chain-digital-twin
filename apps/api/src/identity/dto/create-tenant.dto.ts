import { IsNotEmpty, IsString } from "class-validator";

/** Field names match `contracts/api.yaml`'s `POST /tenants` request body exactly. */
export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  business_name!: string;

  @IsString()
  @IsNotEmpty()
  sector!: string;

  @IsString()
  @IsNotEmpty()
  owner_email_or_phone!: string;
}
