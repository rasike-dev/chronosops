import React from 'react'
import '../src/app/globals.css'
import Providers from '../src/app/providers'
import AuthProvider from '../src/app/auth-provider'
import { ConditionalAppShell } from '@/components/ConditionalAppShell'

export const metadata = {
  title: "ChronosOps — Enterprise Autonomous SRE",
  description: "Evidence-first incident investigation with explainable AI reasoning",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Providers>
            <ConditionalAppShell>{children}</ConditionalAppShell>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  )
}
  