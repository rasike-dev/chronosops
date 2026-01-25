export type AuthConfig = {
  required: boolean
  issuerUrl: string
  audience: string
  jwksUri: string
}

function mustGet(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[Config] Missing required env var: ${name}`)
  return v
}

export function loadAuthConfig(): AuthConfig {
  const required = (process.env.AUTH_REQUIRED ?? 'true').toLowerCase() === 'true'
  return {
    required,
    issuerUrl: mustGet('OIDC_ISSUER_URL'),
    audience: mustGet('OIDC_AUDIENCE'),
    jwksUri: mustGet('OIDC_JWKS_URI'),
  }
}
