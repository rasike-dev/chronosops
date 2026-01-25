import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import jwksRsa from 'jwks-rsa'
import { loadAuthConfig } from '../config/auth.config'
import type { CurrentUser } from './auth.types'

type JwtPayload = Record<string, any>

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const cfg = loadAuthConfig()

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: cfg.issuerUrl,
      audience: cfg.audience,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: cfg.jwksUri,
      }) as any,
    })
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const sub = String(payload.sub ?? '')
    const email = payload.email ? String(payload.email) : undefined
    const name =
      payload.name ? String(payload.name) :
      payload.preferred_username ? String(payload.preferred_username) :
      undefined

    // Keycloak often: realm_access.roles or resource_access[clientId].roles
    const realmRoles = Array.isArray(payload?.realm_access?.roles) ? payload.realm_access.roles : []
    const roles = realmRoles.map(String)

    return {
      sub,
      email,
      name,
      roles,
      raw: payload,
    }
  }
}
