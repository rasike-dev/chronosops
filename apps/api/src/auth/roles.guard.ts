import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
import type { CurrentUser } from './auth.types'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // No RBAC metadata => allow (auth guard already ran)
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user as CurrentUser | undefined

    const userRoles = Array.isArray(user?.roles) ? user!.roles : []
    const ok = required.some((r) => userRoles.includes(r))

    if (!ok) {
      throw new ForbiddenException({
        message: 'Forbidden: missing required role',
        requiredRoles: required,
      })
    }

    return true
  }
}
