/**
 * Album art for the stream: BRLogic catalog first, then iTunes search as fallback.
 * iTunes artwork URLs are upscaled to the largest commonly supported mzstatic size.
 */

const SONG_COVER_URL = "https://brlogic-api.minhawebradio.net/api/streaming/song-cover"
const COVER_BASE_URL = "https://public-rf-song-cover.minhawebradio.net/"
const ITUNES_SEARCH = "https://itunes.apple.com/search"

interface SongCoverJson {
  success?: boolean
  /** API may return a relative path string, or `false` when no artwork exists */
  cover?: string | false
}

/** Replace mzstatic dimension token with a large square (Apple caps at source resolution). */
export function upscaleItunesArtworkUrl(url: string): string {
  return url.replace(/\d+x\d+bb/g, "3000x3000bb")
}

export function parseArtistTitleFromTrack(currentTrack: string): {
  artist: string
  title: string
} {
  const t = currentTrack?.trim() ?? ""
  if (!t) return { artist: "Unknown Artist", title: "Unknown Track" }
  const parts = t.split(" - ")
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim(),
    }
  }
  return { artist: "Unknown Artist", title: t }
}

async function fetchBrlogicSongCover(
  currentTrack: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  if (!currentTrack.trim()) return null

  const timeoutMs = options?.timeoutMs ?? 5000
  try {
    const today = new Date().toISOString().split("T")[0]
    const url = `${SONG_COVER_URL}?q=${encodeURIComponent(currentTrack)}&base-date=${today}&hash=d58c50320d789f14c139cae9bfadc9a430a9f6fa`

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })

    if (!response.ok) return null

    const data: SongCoverJson = await response.json()
    if (data.success && typeof data.cover === "string" && data.cover.length > 0) {
      return `${COVER_BASE_URL}${data.cover}`
    }
  } catch {
    // ignore
  }
  return null
}

async function fetchItunesArtwork(
  artist: string,
  title: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 5000
  const q = `${artist} ${title}`.trim()
  if (!q) return null

  try {
    const response = await fetch(
      `${ITUNES_SEARCH}?term=${encodeURIComponent(q)}&media=music&limit=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      }
    )

    if (!response.ok) return null

    const data = (await response.json()) as {
      results?: { artworkUrl100?: string }[]
    }

    const raw = data.results?.[0]?.artworkUrl100
    if (!raw) return null

    return upscaleItunesArtworkUrl(raw)
  } catch {
    return null
  }
}

/** Avoid re-fetching BRLogic + iTunes on every metadata poll (client hits ~5s). */
const resolveCache = new Map<string, { value: string | null; at: number }>()
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * BRLogic cover when available; otherwise iTunes hi-res artwork from parsed artist/title.
 */
export async function resolveAlbumArtForTrack(
  currentTrack: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const trimmed = currentTrack?.trim() ?? ""
  if (!trimmed) return null

  const now = Date.now()
  const cached = resolveCache.get(trimmed)
  if (cached && now - cached.at < RESOLVE_CACHE_TTL_MS) {
    return cached.value
  }

  const br = await fetchBrlogicSongCover(trimmed, options)
  if (br) {
    resolveCache.set(trimmed, { value: br, at: now })
    return br
  }

  const { artist, title } = parseArtistTitleFromTrack(trimmed)
  const it = await fetchItunesArtwork(artist, title, options)
  resolveCache.set(trimmed, { value: it, at: now })
  return it
}
