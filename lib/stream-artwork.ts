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

/** Cloudflare Workers / some edges mishandle AbortSignal.timeout — use AbortController instead. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    ;(id as unknown as { unref?: () => void }).unref?.()
  } catch {
    /* */
  }
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(id)
    },
    { once: true }
  )
  return controller.signal
}

/** Replace mzstatic dimension token with a large square (Apple caps at source resolution). */
export function upscaleItunesArtworkUrl(url: string): string {
  return url.replace(/\d+x\d+bb/g, "3000x3000bb")
}

/** Strip remix / mix suffixes in parentheses for broader iTunes matches. */
export function simplifyTrackTitle(title: string): string {
  return title
    .replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
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

  const timeoutMs = options?.timeoutMs ?? 2500
  try {
    const today = new Date().toISOString().split("T")[0]
    const url = `${SONG_COVER_URL}?q=${encodeURIComponent(currentTrack)}&base-date=${today}&hash=d58c50320d789f14c139cae9bfadc9a430a9f6fa`

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: timeoutSignal(timeoutMs),
      cache: "no-store",
    })

    if (!response.ok) return null

    const data: SongCoverJson = await response.json()
    if (data.success && typeof data.cover === "string" && data.cover.length > 0) {
      return `${COVER_BASE_URL}${data.cover}`
    }
  } catch {
    // ignore timeouts / network errors — fall through to iTunes
  }
  return null
}

async function fetchItunesArtwork(
  artist: string,
  title: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 4000
  const simpleTitle = simplifyTrackTitle(title)
  const queries = [
    `${artist} ${title}`.trim(),
    `${artist} ${simpleTitle}`.trim(),
    simpleTitle,
    title.trim(),
  ].filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i)

  for (const q of queries) {
    try {
      const response = await fetch(
        `${ITUNES_SEARCH}?term=${encodeURIComponent(q)}&media=music&entity=song&limit=5`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            Accept: "application/json",
          },
          signal: timeoutSignal(timeoutMs),
          cache: "no-store",
        }
      )

      if (!response.ok) continue

      const data = (await response.json()) as {
        results?: { artworkUrl100?: string; artistName?: string; trackName?: string }[]
      }

      const results = data.results ?? []
      if (results.length === 0) continue

      const titleLower = simpleTitle.toLowerCase() || title.toLowerCase()
      const artistLower = artist.toLowerCase()
      const matched =
        results.find((r) => {
          const tn = (r.trackName || "").toLowerCase()
          const an = (r.artistName || "").toLowerCase()
          const titleOk = !titleLower || tn.includes(titleLower) || titleLower.includes(tn)
          const artistOk =
            artistLower === "unknown artist" ||
            !artistLower ||
            an.includes(artistLower) ||
            artistLower.includes(an)
          return titleOk && artistOk
        }) || results[0]

      const raw = matched.artworkUrl100
      if (!raw) continue

      return upscaleItunesArtworkUrl(raw)
    } catch {
      // try next query
    }
  }

  return null
}

async function fetchDeezerArtwork(
  artist: string,
  title: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 4000
  const simpleTitle = simplifyTrackTitle(title)
  const queries = [
    `${artist} ${simpleTitle}`.trim(),
    `${artist} ${title}`.trim(),
    simpleTitle,
  ].filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i)

  for (const q of queries) {
    try {
      const response = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`,
        {
          headers: { Accept: "application/json" },
          signal: timeoutSignal(timeoutMs),
          cache: "no-store",
        }
      )
      if (!response.ok) continue

      const data = (await response.json()) as {
        data?: {
          title?: string
          artist?: { name?: string }
          album?: {
            cover_xl?: string
            cover_big?: string
            cover_medium?: string
          }
        }[]
      }

      const results = data.data ?? []
      if (results.length === 0) continue

      const titleLower = (simpleTitle || title).toLowerCase()
      const artistLower = artist.toLowerCase()
      const matched =
        results.find((r) => {
          const tn = (r.title || "").toLowerCase()
          const an = (r.artist?.name || "").toLowerCase()
          const titleOk = !titleLower || tn.includes(titleLower) || titleLower.includes(tn)
          const artistOk =
            artistLower === "unknown artist" ||
            !artistLower ||
            an.includes(artistLower) ||
            artistLower.includes(an)
          return titleOk && artistOk
        }) || results[0]

      const cover =
        matched.album?.cover_xl ||
        matched.album?.cover_big ||
        matched.album?.cover_medium ||
        null
      if (cover) return cover
    } catch {
      // try next query
    }
  }

  return null
}

/** Cache successful artwork URLs only — never cache misses. */
const resolveCache = new Map<string, { value: string; at: number }>()
const HIT_CACHE_TTL_MS = 10 * 60 * 1000

/**
 * Prefer BRLogic cover, then iTunes, then Deezer (Cloudflare edge often gets empty iTunes results).
 * Sources run in parallel so one slow miss cannot block the others.
 */
export async function resolveAlbumArtForTrack(
  currentTrack: string,
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const trimmed = currentTrack?.trim() ?? ""
  if (!trimmed) return null

  const now = Date.now()
  const cached = resolveCache.get(trimmed)
  if (cached && now - cached.at < HIT_CACHE_TTL_MS) {
    return cached.value
  }

  const { artist, title } = parseArtistTitleFromTrack(trimmed)
  const brTimeout = Math.min(options?.timeoutMs ?? 2500, 2500)
  const lookupTimeout = options?.timeoutMs ?? 4000

  const [br, it, dz] = await Promise.all([
    fetchBrlogicSongCover(trimmed, { timeoutMs: brTimeout }),
    fetchItunesArtwork(artist, title, { timeoutMs: lookupTimeout }),
    fetchDeezerArtwork(artist, title, { timeoutMs: lookupTimeout }),
  ])

  const value = br || it || dz
  if (value) {
    resolveCache.set(trimmed, { value, at: Date.now() })
  } else {
    resolveCache.delete(trimmed)
  }
  return value
}
