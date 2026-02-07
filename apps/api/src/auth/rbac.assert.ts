import { ForbiddenException } from "@nestjs/common";

/**
 * RBAC assertion helpers for non-bypassable role checks
 */

export function assertCanInvestigate(user?: { roles?: string[] }): void {
  if (!user || !user.roles) {
    throw new ForbiddenException("Authentication required to start investigations");
  }

  const ok = user.roles.includes("CHRONOSOPS_ANALYST") || user.roles.includes("CHRONOSOPS_ADMIN");
  if (!ok) {
    throw new ForbiddenException("FORBIDDEN_INVESTIGATION: Only Analyst and Admin roles can start investigations");
  }
}

export function assertIsAdmin(user?: { roles?: string[] }): void {
  if (!user || !user.roles) {
    throw new ForbiddenException("Authentication required");
  }

  if (!user.roles.includes("CHRONOSOPS_ADMIN")) {
    throw new ForbiddenException("FORBIDDEN: Admin role required");
  }
}

export function assertCanViewSensitiveData(user?: { roles?: string[] }): void {
  if (!user || !user.roles) {
    throw new ForbiddenException("Authentication required");
  }

  // Only Admin can view sensitive data (prompt traces, raw payloads)
  if (!user.roles.includes("CHRONOSOPS_ADMIN")) {
    throw new ForbiddenException("FORBIDDEN: Admin role required to view sensitive data");
  }
}
