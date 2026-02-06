import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"

// Validate required environment variables
const keycloakIssuer = process.env.KEYCLOAK_ISSUER
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID
const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET

if (!keycloakIssuer || !keycloakClientId || !keycloakClientSecret) {
  throw new Error(
    `Missing required Keycloak environment variables. ` +
    `KEYCLOAK_ISSUER: ${keycloakIssuer ? 'set' : 'missing'}, ` +
    `KEYCLOAK_CLIENT_ID: ${keycloakClientId ? 'set' : 'missing'}, ` +
    `KEYCLOAK_CLIENT_SECRET: ${keycloakClientSecret ? 'set' : 'missing'}`
  )
}

// Ensure issuer URL is absolute
const issuerUrl = keycloakIssuer.startsWith('http') 
  ? keycloakIssuer 
  : `http://${keycloakIssuer}`

const handler = NextAuth({
  providers: [
    KeycloakProvider({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: issuerUrl,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // Persist Keycloak tokens into the NextAuth JWT
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.idToken = account.id_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    // Expose access token to the client session (so UI/proxy can use it)
    async session({ session, token }) {
      ;(session as any).accessToken = (token as any).accessToken
      return session
    },
  },
})

export { handler as GET, handler as POST }
