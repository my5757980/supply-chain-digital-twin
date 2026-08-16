import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

const HEADER = "x-correlation-id";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(HEADER);
    const correlationId = incoming && incoming.length > 0 ? incoming : uuid();
    (req as RequestWithCorrelationId).correlationId = correlationId;
    res.setHeader(HEADER, correlationId);
    next();
  }
}
