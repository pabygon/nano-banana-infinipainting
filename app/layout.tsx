import type { Metadata } from 'next'
import './globals.css'
import { ClientProvider } from '@/components/ClientProvider'

export const metadata: Metadata = {
  title: 'Endless Cubism',
  description: 'Generative, collaborative, infinite cubism drawing',
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