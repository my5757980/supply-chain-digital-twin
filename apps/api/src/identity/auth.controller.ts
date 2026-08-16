import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsUUID } from "class-validator";
import { AuthService } from "./auth.service";
import { AuthGuard, type AuthenticatedRequest } from "./auth.guard";
import type { SessionUser } from "./session.types";

class DevLoginDto {
  @IsUUID()
  userId!: string;
}

/**
 * Real credential verification (managed auth provider — see
 * research.md §6) is deliberately out of scope here; `/auth/dev-login`
 * is a same-process session-issuing shim so every other module can be
 * built and tested against a real session mechanism now. It is disabled
 * whenever NODE_ENV=production.
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("dev-login")
  @HttpCode(200)
  async devLogin(
    @Body() body: DevLoginDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SessionUser> {
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("dev-login is disabled in production");
    }
    const sessionUser = await this.authService.findSessionUserById(body.userId);
    req.session.user = sessionUser;
    return sessionUser;
  }

  @Post("logout")
  @HttpCode(204)
  logout(@Req() req: AuthenticatedRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest): SessionUser {
    // AuthGuard guarantees this is defined.
    return req.session.user as SessionUser;
  }
}
