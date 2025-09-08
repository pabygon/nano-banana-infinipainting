import type { Metadata } from 'next'
import Script from 'next/script'
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
        <Script
          src="https://datafa.st/js/script.js"
          data-website-id="68be878a04eb7cc891f51612"
          data-domain="endlesscubism.com"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <div
          className="sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-base-100/70"
          role="region"
          aria-label="Project disclaimer"
          tabIndex={0}
        >
          <div className="bg-gradient-to-r from-primary/15 via-secondary/15 to-accent/15 border-b border-base-300 shadow-sm">
            <div className="max-w-screen-xl mx-auto px-4">
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4 text-primary"
                    aria-hidden="true"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>made by</span>
                  <a
                    href="https://x.com/pabygon"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-hover underline-offset-4"
                    aria-label="Visit Pabygon on X"
                  >
                    Pabygon
                  </a>
                </span>

                <span className="opacity-60">•</span>

                <span className="inline-flex items-center gap-1">
                  <span>based on</span>
                  <a
                    href="https://x.com/seezatnap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-hover underline-offset-4"
                    aria-label="Visit seezatnap on X"
                  >
                    seezatnap
                  </a>
                  <span>'s open source project</span>
                </span>

                <a
                  href="https://github.com/seezatnap/nano-banana-infinimap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-ghost no-animation normal-case gap-1"
                  aria-label="Open the nano-banana-infinimap repository on GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.86-.01-1.69-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.64-1.37-2.22-.26-4.55-1.13-4.55-5 0-1.11.39-2.02 1.03-2.73-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.04A9.24 9.24 0 0 1 12 6.84c.85 0 1.7.12 2.5.35 1.9-1.31 2.74-1.04 2.74-1.04.55 1.4.2 2.44.1 2.7.64.71 1.03 1.62 1.03 2.73 0 3.88-2.34 4.74-4.57 4.99.36.32.69.94.69 1.9 0 1.37-.01 2.48-.01 2.82 0 .26.18.59.69.48A10.07 10.07 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" clipRule="evenodd" />
                  </svg>
                  <span className="hidden sm:inline">GitHub</span>
                  <span className="sm:hidden">Repo</span>
                </a>
              </div>
            </div>
          </div>
        </div>
        <ClientProvider>
          {children}
        </ClientProvider>
      </body>
    </html>
  )
}