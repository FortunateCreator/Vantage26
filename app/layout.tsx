import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vantage 26 — FIFA World Cup Luxury Concierge',
  description:
    'Private concierge for the FIFA World Cup 2026. Hospitality packages, private aviation, Rolls-Royce transfers.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
