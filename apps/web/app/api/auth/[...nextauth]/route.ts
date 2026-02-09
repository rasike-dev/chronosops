import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import CredentialsProvider from "next-auth/providers/credentials"

// Keycloak configuration (optional - can use credentials provider instead)
const keycloakIssuer = process.env.KEYCLOAK_ISSUER
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID
const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET

const providers: any[] = [
  // Credentials provider (always available for dev access)
  CredentialsProvider({
    id: "credentials",
    name: "Credentials",
    credentials: {
      username: { label: "Username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      // Dev credentials for quick access
      if (
        credentials?.username === "dev-admin" &&
        credentials?.password === "devpass"
      ) {
        // Return a user object that matches the expected format
        return {
          id: "dev-admin",
          email: "dev-admin@chronosops.local",
          name: "Dev Admin",
          sub: "dev-admin",
          // Add default admin roles
          roles: ["CHRONOSOPS_ADMIN", "CHRONOSOPS_ANALYST", "CHRONOSOPS_VIEWER"],
        } as any
      }
      return null
    },
  }),
]

// Add Keycloak provider only if all required variables are configured
if (keycloakIssuer && keycloakClientId && keycloakClientSecret) {
  const issuerUrl = keycloakIssuer.startsWith('http') 
    ? keycloakIssuer 
    : `http://${keycloakIssuer}`
  
  providers.push(
    KeycloakProvider({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: issuerUrl,
    })
  )
} else {
  // Log warning but don't fail - credentials provider will work
  console.warn('[NextAuth] Keycloak not configured - using credentials provider only')
}

const handler = NextAuth({
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    // Persist Keycloak tokens into the NextAuth JWT
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.expiresAt = account.expires_at
      }
      // For credentials provider, persist user info
      if (user) {
        token.sub = user.sub || user.id
        token.email = user.email
        token.name = user.name
        token.roles = (user as any).roles || []
      }
      return token
    },
    // Expose access token to the client session (so UI/proxy can use it)
    async session({ session, token }) {
      ;(session as any).accessToken = (token as any).accessToken
      // For credentials-based auth, we don't have a real access token
      // The API will need to handle this case
      if (token.sub) {
        session.user = {
          ...session.user,
          sub: token.sub as string,
          email: (token.email as string) || undefined,
          name: (token.name as string) || undefined,
          roles: ((token as any).roles || []) as string[],
        }
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }
