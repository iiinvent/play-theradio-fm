/**
 * Cross-subdomain settings for *.theradio.fm via cookies (Domain=.theradio.fm).
 * Mirrors values to localStorage when active so existing code keeps working.
 */

const COOKIE_BASE = 'tr_kv_v1'
const DOMAIN = '.theradio.fm'
const MAX_AGE_SEC = 400 * 24 * 60 * 60
const CHUNK = 3500
const MAX_COOKIE_CHUNKS = 96

export function isTheradioFmHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'theradio.fm' || /\.theradio\.fm$/i.test(h)
}

function getCookieMap(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof document === 'undefined' || !document.cookie) return out
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    try {
      out[k] = decodeURIComponent(v.replace(/\+/g, ' '))
    } catch {
      out[k] = v
    }
  }
  return out
}

function readChunks(): string {
  const map = getCookieMap()
  if (map[COOKIE_BASE] !== undefined) return map[COOKIE_BASE]

  const parts: string[] = []
  for (let n = 0; n < MAX_COOKIE_CHUNKS; n++) {
    const key = `${COOKIE_BASE}_${n}`
    if (!(key in map)) break
    parts.push(map[key])
  }
  return parts.length ? parts.join('') : ''
}

function parseBag(raw: string): Record<string, string> {
  if (!raw) return {}
  try {
    const o = JSON.parse(raw) as unknown
    if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
      return o as Record<string, string>
    }
  } catch {
    /* ignore */
  }
  return {}
}

function loadBag(): Record<string, string> {
  return parseBag(readChunks())
}

function clearOldChunks(map: Record<string, string>): void {
  for (const k of Object.keys(map)) {
    if (k.startsWith(COOKIE_BASE)) {
      document.cookie = `${k}=; Max-Age=0; domain=${DOMAIN}; path=/; Secure; SameSite=Lax`
    }
  }
}

function writeBag(bag: Record<string, string>): void {
  if (typeof document === 'undefined') return
  const json = JSON.stringify(bag)
  const map = getCookieMap()
  clearOldChunks(map)

  if (json.length <= CHUNK) {
    document.cookie = `${COOKIE_BASE}=${encodeURIComponent(json)}; domain=${DOMAIN}; path=/; Max-Age=${MAX_AGE_SEC}; Secure; SameSite=Lax`
    return
  }

  const chunks: string[] = []
  for (let i = 0; i < json.length; i += CHUNK) {
    chunks.push(json.slice(i, i + CHUNK))
  }
  chunks.forEach((chunk, idx) => {
    document.cookie = `${COOKIE_BASE}_${idx}=${encodeURIComponent(chunk)}; domain=${DOMAIN}; path=/; Max-Age=${MAX_AGE_SEC}; Secure; SameSite=Lax`
  })
}

function mirrorLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** Single key read/write backed by shared cookie bag + localStorage mirror */
export function theradioGetItem(key: string): string | null {
  if (!isTheradioFmHost()) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const bag = loadBag()
  if (Object.prototype.hasOwnProperty.call(bag, key) && bag[key] !== undefined) {
    return bag[key]
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function theradioSetItem(key: string, value: string): void {
  if (!isTheradioFmHost()) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
    return
  }
  const bag = loadBag()
  bag[key] = value
  bag._u = Date.now().toString(36)
  writeBag(bag)
  mirrorLocal(key, value)
}

export function theradioRemoveItem(key: string): void {
  if (!isTheradioFmHost()) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return
  }
  const bag = loadBag()
  delete bag[key]
  bag._u = Date.now().toString(36)
  writeBag(bag)
  mirrorLocal(key, null)
}
