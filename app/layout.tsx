import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const APP_URL = 'https://play.theradio.fm'
const SHARE_URL = 'https://theradio.fm'
const DEFAULT_SHARE_IMAGE_URL = `${APP_URL}/apple-icon.jpg`
const STATUS_URL = 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7064/c5f885b75a1075c9fba1960e4cf86fe7/SV7BR'
const SONG_COVER_URL = 'https://brlogic-api.minhawebradio.net/api/streaming/song-cover'
const COVER_BASE_URL = 'https://public-rf-song-cover.minhawebradio.net/'

interface StreamStatus {
  currentTrack?: string
}

interface SongCover {
  success?: boolean
  cover?: string
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

async function fetchRealtimeSongCover(currentTrack: string): Promise<string | null> {
  if (!currentTrack) return null

  const today = new Date().toISOString().split('T')[0]
  const coverResponse = await fetch(
    `${SONG_COVER_URL}?q=${encodeURIComponent(currentTrack)}&base-date=${today}&hash=d58c50320d789f14c139cae9bfadc9a430a9f6fa`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    }
  )

  if (!coverResponse.ok) return null

  const cover: SongCover = await coverResponse.json()
  return cover.success && cover.cover ? `${COVER_BASE_URL}${cover.cover}` : null
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
export const revalidate = 0

async function getNowPlaying(): Promise<{ currentTrack: string; albumArt: string | null }> {
  try {
    const currentTrack = await fetchRealtimeCurrentTrack()
    const albumArt = await fetchRealtimeSongCover(currentTrack)
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
          url: '/icon.jpg',
          type: 'image/jpeg',
          sizes: '512x512',
        },
        {
          url: '/icon-192x192.jpg',
          type: 'image/jpeg',
          sizes: '192x192',
        },
      ],
      apple: '/apple-icon.jpg',
    },
  }
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
