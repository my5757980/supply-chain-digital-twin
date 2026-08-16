import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { RequestWithCorrelationId } from "./correlation-id.middleware";

interface ErrorBody {
  error: {
    code: number;
    message: string;
    correlationId: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelationId>();
    const correlationId = request.correlationId ?? "unknown";

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : "Internal server error";

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${correlationId}] ${request.method} ${request.url} -> ${status} ${message}`);
    }

    const body: ErrorBody = { error: { code: status, message, correlationId } };
    response.status(status).json(body);
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === "string") {
      return response;
    }
    if (typeof response === "object" && response !== null && "message" in response) {
      const msg = (response as { message: unknown }).message;
      return Array.isArray(msg) ? msg.join("; ") : String(msg);
    }
    return exception.message;
  }
}
