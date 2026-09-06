import { NextRequest, NextResponse } from "next/server"
import {
  parseArtistTitleFromTrack,
  resolveAlbumArtForTrack,
  upscaleItunesArtworkUrl,
} from "@/lib/stream-artwork"

export const dynamic = "force-dynamic"
export const runtime = "edge"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  let artist = searchParams.get("artist") || ""
  let track = searchParams.get("track") || ""
  const q = searchParams.get("q") || ""

  if (q && !artist && !track) {
    const parsed = parseArtistTitleFromTrack(q)
    artist = parsed.artist
    track = parsed.title
  }

  if (!artist && !track) {
    return NextResponse.json({ artworkUrl: null })
  }

  try {
    const combined =
      artist && track && artist !== "Unknown Artist"
        ? `${artist} - ${track}`
        : `${artist} ${track}`.trim()

    const artworkUrl =
      (await resolveAlbumArtForTrack(combined, { timeoutMs: 5000 })) ||
      (await resolveFromItunesDirect(artist, track))

    return NextResponse.json({
      artworkUrl,
      artistName: artist || null,
      trackName: track || null,
    })
  } catch (error) {
    console.error("Error fetching album art:", error)
    return NextResponse.json({ artworkUrl: null })
  }
}

async function resolveFromItunesDirect(
  artist: string,
  track: string
): Promise<string | null> {
  const term = `${artist} ${track}`.trim()
  if (!term) return null
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )
  if (!response.ok) return null
  const data = (await response.json()) as { results?: { artworkUrl100?: string }[] }
  const raw = data.results?.[0]?.artworkUrl100
  return raw ? upscaleItunesArtworkUrl(raw) : null
}
