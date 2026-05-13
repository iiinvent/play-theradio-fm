import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/components/theme-provider'
import { TheradioPlayStorageBridge } from '@/components/theradio-storage-bridge'
import { THERADIO_KV_BOOTSTRAP_SCRIPT } from '@/lib/theradio-kv-bootstrap-script'
import { resolveAlbumArtForTrack } from '@/lib/stream-artwork'
import './globals.css'

const APP_URL = 'https://play.theradio.fm'
const SHARE_URL = 'https://theradio.fm'
const DEFAULT_SHARE_IMAGE_URL = `${APP_URL}/fallback.png`
const STATUS_URL = 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7064/c5f885b75a1075c9fba1960e4cf86fe7/SV7BR'

interface StreamStatus {
  currentTrack?: string
}

async function fetchRealtimeCurrentTrack(): Promise<string> {
  const statusResponse = await fetch(STATUS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  })

  if (!statusResponse.ok) return ''

  const status: StreamStatus = await statusResponse.json()
  return status.currentTrack || ''
}

const geistSans = Geist({ 
  subsets: ["latin"],
  variable: "--font-geist-sans"
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

export const dynamic = 'force-dynamic'
export const runtime = 'edge'
export const revalidate = 0

async function getNowPlaying(): Promise<{ currentTrack: string; albumArt: string | null }> {
  try {
    const currentTrack = await fetchRealtimeCurrentTrack()
    const albumArt = await resolveAlbumArtForTrack(currentTrack, { timeoutMs: 3000 })
    return { currentTrack, albumArt }
  } catch {
    return { currentTrack: '', albumArt: null }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { currentTrack, albumArt } = await getNowPlaying()
  const title = currentTrack ? `${currentTrack} on theradio.fm` : 'theradio.fm - Live Internet Radio'
  const description = currentTrack
    ? `Now playing: ${currentTrack} on theradio.fm`
    : 'Listen live to theradio.fm with real-time track info and album artwork'
  const imageUrl = albumArt || DEFAULT_SHARE_IMAGE_URL
  const imageAlt = currentTrack ? `${currentTrack} album art` : 'theradio.fm icon'

  return {
    title,
    description,
    generator: 'v0.app',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'theradio.fm',
    },
    openGraph: {
      title,
      description,
      url: SHARE_URL,
      siteName: 'theradio.fm',
      type: 'music.radio_station',
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: '/icon-512x512.png',
          type: 'image/png',
          sizes: '512x512',
        },
        {
          url: '/icon-192x192.png',
          type: 'image/png',
          sizes: '192x192',
        },
      ],
      apple: [
        {
          url: '/apple-icon.png',
          sizes: '180x180',
          type: 'image/png',
        },
      ],
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: dark)', color: '#123030' },
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
        <Script id="theradio-kv-bootstrap" strategy="beforeInteractive">
          {THERADIO_KV_BOOTSTRAP_SCRIPT}
        </Script>
        <TheradioPlayStorageBridge />
        <ThemeProvider
          attribute="class"
          defaultTheme="oled"
          themes={['dark', 'oled']}
          enableSystem={false}
          storageKey="theradio-player-theme"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
