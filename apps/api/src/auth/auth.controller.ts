import { Controller, Get, Req } from '@nestjs/common'
import type { CurrentUser } from './auth.types'

@Controller('v1/auth')
export class AuthController {
  @Get('whoami')
  whoami(@Req() req: { user?: CurrentUser }) {
    // JwtStrategy populates req.user when token is valid.
    // Global JwtAuthGuard ensures this route is protected (not @Public).
    return {
      authenticated: true,
      user: req.user ?? null,
    }
  }
}
