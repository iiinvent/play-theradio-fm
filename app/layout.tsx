import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geistSans = Geist({ 
  subsets: ["latin"],
  variable: "--font-geist-sans"
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

export const metadata: Metadata = {
  title: 'theradio.fm - Live Internet Radio',
  description: 'Listen to theradio.fm - A modern fullscreen internet radio player with live streaming, track info, and album artwork',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'theradio.fm',
  },
  openGraph: {
    title: 'theradio.fm - Live Internet Radio',
    description: 'Listen live to theradio.fm with real-time track info and album artwork',
    url: 'https://play.theradio.fm',
    siteName: 'theradio.fm',
    type: 'music.radio_station',
    images: [
      {
        url: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/theradio-fm-logo-riP2RHcCrwTnJDqhSbaT3uXluubSLi.jpg',
        width: 512,
        height: 512,
        alt: 'theradio.fm logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'theradio.fm - Live Internet Radio',
    description: 'Listen live to theradio.fm with real-time track info and album artwork',
    images: ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/theradio-fm-logo-riP2RHcCrwTnJDqhSbaT3uXluubSLi.jpg'],
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1a4a4a' },
    { media: '(prefers-color-scheme: dark)', color: '#0f2929' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
