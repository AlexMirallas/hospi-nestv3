import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum'
import { ROLES_KEY } from '../decorators/roles.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // No specific roles required, allow access
    }
    const { user } = context.switchToHttp().getRequest();

    // Ensure user object and roles exist (populated by JwtAuthGuard)
    if (!user || !user.roles) {
        return false;
    }

    // Check if user has at least one of the required roles
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}