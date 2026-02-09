import NextAuth from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import CredentialsProvider from "next-auth/providers/credentials"

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
  ],
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
