import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuthGuard, type AuthenticatedRequest } from "../identity/auth.guard";
import { tenantContextFromRequest } from "../identity/tenant-context.util";
import { CsvUploadDto } from "./dto/csv-upload.dto";
import { CsvIngestionQueue } from "./csv-ingestion.queue";

export interface CsvUploadResponse {
  data_source_id: string;
  status: "processing";
}

@Controller("data-sources")
@UseGuards(AuthGuard)
export class CsvUploadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: CsvIngestionQueue,
  ) {}

  @Post("csv-upload")
  @HttpCode(202)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CsvUploadDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CsvUploadResponse> {
    const context = tenantContextFromRequest(req);
    if (!context.tenantId) {
      throw new ForbiddenException("Requires a tenant-scoped session");
    }
    if (!file) {
      throw new ForbiddenException("A CSV file is required");
    }
    const tenantId = context.tenantId;

    const dataSource = await this.prisma.withTenantContext(context, (tx) =>
      tx.dataSource.create({
        data: { tenantId, type: "csv_upload", status: "active" },
      }),
    );

    await this.queue.enqueue({
      dataSourceId: dataSource.id,
      tenantId,
      dataType: dto.data_type,
      csvContent: file.buffer.toString("utf-8"),
    });

    return { data_source_id: dataSource.id, status: "processing" };
  }
}
