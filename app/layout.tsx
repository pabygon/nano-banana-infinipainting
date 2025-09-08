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
      <head>
        <script
          defer
          data-website-id="68be878a04eb7cc891f51612"
          data-domain="endlesscubism.com"
          src="https://datafa.st/js/script.js">
        </script>
      </head>
      <body>
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  )
}