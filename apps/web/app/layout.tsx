import React from 'react'
import '../src/app/globals.css'
import Providers from '../src/app/providers'
import AuthProvider from '../src/app/auth-provider'
import { AppShell } from '@/components/AppShell'

export const metadata = {
  title: "ChronosOps MVP",
  description: "Latency spike after deployment demo",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  )
}
  