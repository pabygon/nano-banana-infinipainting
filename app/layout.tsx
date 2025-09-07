import type { Metadata } from 'next'
import './globals.css'
import { ClientProvider } from '@/components/ClientProvider'

export const metadata: Metadata = {
  title: 'Infinimap',
  description: 'Generative, neighbor-aware slippy map',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  )
}