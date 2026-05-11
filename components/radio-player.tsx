"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
  Play,
  Pause,
  Sparkles,
  Palette,
  Mic,
  Timer,
  Settings2,
  X,
  Share2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

interface CurrentProgram {
  name: string
  broadcaster: string
  image: string | null
}

interface StreamMetadata {
  name: string
  description: string
  genre: string
  bitrate: string
  url: string
  contentType: string
  streamUrl: string
  sampleRate?: string
  metaInterval?: string
  server?: string
  currentTrack?: string
  albumArt?: string | null
  isLive?: boolean
  currentProgram?: CurrentProgram | null
  stationLogo?: string | null
}

type LavaIntensity = "off" | "subtle" | "medium" | "high" | "reactive"

const STREAM_URL = "https://servidor36-2.brlogic.com:7064/live"

/** Same cadence as browser webradio `AudioGlobal` — catches silent OS pauses (esp. iOS). */
const WATCHDOG_MS = 8_000

/** Canonical absolute URL — compares safely to `HTMLMediaElement.src` (Firefox resolves aggressively). */
function resolveStreamSrc(url: string): string {
  if (typeof window === "undefined") return url
  try {
    return new URL(url, window.location.href).href
  } catch {
    return url
  }
}

function buildFreshStreamSrc(url: string): string {
  const resolvedUrl = resolveStreamSrc(url)
  try {
    const freshUrl = new URL(resolvedUrl)
    freshUrl.searchParams.set("_fresh", Date.now().toString())
    return freshUrl.href
  } catch {
    const separator = resolvedUrl.includes("?") ? "&" : "?"
    return `${resolvedUrl}${separator}_fresh=${Date.now()}`
  }
}

/** Square brand asset: dark teal field, white ring, red disc — guides light/dark theme accents */
const STATION_LOGO_URL = "/theradio-fm-logo.png"
const DEFAULT_SHARE_IMAGE_URL = "/fallback.png"
const SHARE_URL = "https://theradio.fm"

/** Canonical listen URL — live radio only; no `np=` timestamp so shares stay clean. */
const buildShareUrl = () => SHARE_URL

function isEmbeddedWindow(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Commonly blocked in iframes/sandbox; fall back below.
    }
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.top = "0"
    textarea.style.left = "0"
    textarea.style.opacity = "0"
    textarea.style.pointerEvents = "none"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

const SLEEP_TIMER_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
]

const LAVA_INTENSITY_OPTIONS: { type: LavaIntensity; label: string; description: string }[] = [
  { type: "off", label: "Off", description: "No effects" },
  { type: "subtle", label: "Subtle", description: "Gentle ambient movement" },
  { type: "medium", label: "Medium", description: "Balanced animation" },
  { type: "high", label: "High", description: "Vibrant movement" },
  { type: "reactive", label: "Reactive", description: "Audio-reactive" },
]

// Proxy album art images
const proxyImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  if (url.includes("public-rf-song-cover.minhawebradio.net")) {
    return `/api/image?url=${encodeURIComponent(url)}`
  }
  if (url.includes("public-rf-upload.minhawebradio.net")) {
    return null
  }
  return url
}

// Format time for sleep timer
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

/** Fixed panel above the anchor — portaled to body so ancestors never reflow or grow. */
function fixedMenuStyleAboveAnchor(
  anchor: HTMLElement,
  options?: { maxWidthPx?: number; gapPx?: number }
): CSSProperties {
  const gapPx = options?.gapPx ?? 8
  const maxWidthPx = options?.maxWidthPx ?? 320
  const vw = window.innerWidth
  const margin = 16
  const width = Math.min(maxWidthPx, vw - margin * 2)
  const rect = anchor.getBoundingClientRect()
  let left = rect.right - width
  left = Math.max(margin, Math.min(left, vw - width - margin))
  return {
    position: "fixed",
    left,
    top: rect.top - gapPx,
    width,
    transform: "translateY(-100%)",
    zIndex: 110,
  }
}

type LavaColorMode = "teal" | "midnight"

// Lava Lamp Visualizer — midnight mode: no teal, warmer/brighter blobs scaled by intensity
function LavaLampVisualizer({ 
  analyzerData, 
  isPlaying, 
  intensity,
  colorMode = "teal",
}: { 
  analyzerData: number[]
  isPlaying: boolean
  intensity: LavaIntensity
  colorMode?: LavaColorMode
}) {
  // Calculate audio energy for reactive mode
  const avgEnergy = analyzerData.length > 0 
    ? analyzerData.reduce((a, b) => a + b, 0) / analyzerData.length / 255 
    : 0

  const settingsTeal: Record<
    LavaIntensity,
    { blobCount: number; opacity: number; speed: number; movement: number; blur: string; saturation: number }
  > = {
    off: { blobCount: 0, opacity: 0, speed: 1, movement: 0, blur: "blur-2xl", saturation: 0 },
    subtle: { blobCount: 5, opacity: 0.38, speed: 1.45, movement: 24, blur: "blur-2xl", saturation: 62 },
    medium: { blobCount: 8, opacity: 0.64, speed: 0.9, movement: 46, blur: "blur-xl", saturation: 78 },
    high: { blobCount: 10, opacity: 0.82, speed: 0.62, movement: 72, blur: "blur-lg", saturation: 92 },
    reactive: { blobCount: 12, opacity: 0.9, speed: 0.45, movement: 88, blur: "blur-lg", saturation: 96 },
  }

  /* Brighter, higher-chroma lava on deep black; same relative steps (off → reactive) */
  const settingsMidnight: typeof settingsTeal = {
    off: { blobCount: 0, opacity: 0, speed: 1, movement: 0, blur: "blur-2xl", saturation: 0 },
    subtle: { blobCount: 5, opacity: 0.5, speed: 1.45, movement: 24, blur: "blur-2xl", saturation: 76 },
    medium: { blobCount: 8, opacity: 0.78, speed: 0.9, movement: 46, blur: "blur-xl", saturation: 88 },
    high: { blobCount: 10, opacity: 0.93, speed: 0.62, movement: 72, blur: "blur-lg", saturation: 96 },
    reactive: { blobCount: 12, opacity: 0.98, speed: 0.45, movement: 88, blur: "blur-lg", saturation: 100 },
  }

  const config = (colorMode === "midnight" ? settingsMidnight : settingsTeal)[intensity] || settingsTeal.medium
  const reactiveMultiplier = intensity === "reactive" ? (1 + avgEnergy * 2.2) : 1

  // Use deterministic pseudo-random values based on index to avoid hydration mismatch
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9999) * 10000
    return x - Math.floor(x)
  }

  const blobHue = (i: number) => {
    if (colorMode === "midnight") {
      const warm = [4, 16, 330, 24, 350, 10, 340, 18, 8, 325, 28, 12]
      return warm[i % warm.length] + (i * 4) % 9
    }
    return i % 2 === 0 ? 5 + (i * 5) % 20 : 175 + (i * 5) % 20
  }

  const blobs = useMemo(() => 
    Array.from({ length: config.blobCount }, (_, i) => ({
      id: i,
      x: 4 + (i % 5) * 22 + seededRandom(i + 1) * 18,
      size: 130 + seededRandom(i + 10) * 120,
      hue: blobHue(i),
      speed: 7 + seededRandom(i + 20) * 7,
      delay: i * 0.28,
    })), [config.blobCount, colorMode]
  )

  if (intensity === "off") return null

  return (
    <div className="absolute inset-0 overflow-hidden">
      {blobs.map((blob) => {
        const blobOpacity = config.opacity * (intensity === "reactive" ? (0.65 + avgEnergy * 0.7) : 1)
        const animationSpeed = blob.speed * config.speed / reactiveMultiplier
        
        return (
          <motion.div
            key={blob.id}
            className={`absolute rounded-full ${config.blur}`}
            style={{
              left: `${blob.x}%`,
              width: blob.size * reactiveMultiplier,
              height: blob.size * 1.3 * reactiveMultiplier,
              background: `radial-gradient(ellipse, 
                hsla(${blob.hue}, ${config.saturation}%, 55%, ${blobOpacity}), 
                hsla(${blob.hue + 20}, ${config.saturation}%, 35%, ${blobOpacity * 0.5}), 
                transparent 70%)`,
            }}
            animate={{
              y: ["92%", "58%", "8%", "34%", "92%"],
              x: [
                `${blob.x}%`, 
                `${blob.x + (Math.sin(blob.id) * config.movement)}%`, 
                `${blob.x - (Math.cos(blob.id) * config.movement * 0.5)}%`,
                `${blob.x + (Math.sin(blob.id + 2) * config.movement * 0.7)}%`,
                `${blob.x}%`
              ],
              scale: intensity === "reactive" 
                ? [1, 1.2 + avgEnergy * 0.65, 0.9 + avgEnergy * 0.35, 1.15, 1] 
                : [1, 1.18, 0.92, 1.12, 1],
              borderRadius: [
                "50% 50% 50% 50%", 
                "40% 60% 55% 45%", 
                "55% 45% 40% 60%",
                "35% 65% 45% 55%",
                "50% 50% 50% 50%"
              ],
            }}
            transition={{
              duration: animationSpeed,
              repeat: Infinity,
              ease: "easeInOut",
              delay: blob.delay,
              times: [0, 0.25, 0.55, 0.78, 1],
            }}
          />
        )
      })}
      
      {/* Overlay glow — teal mode uses crimson + teal cast; midnight uses warm red + magenta only */}
      <motion.div 
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            colorMode === "midnight"
              ? `radial-gradient(ellipse at 50% 100%, 
                  hsla(12, 92%, 52%, ${config.opacity * 0.38}), 
                  hsla(305, 62%, 48%, ${config.opacity * 0.24}),
                  transparent 68%)`
              : `radial-gradient(ellipse at 50% 100%, 
                  hsla(10, 85%, 30%, ${config.opacity * 0.28}), 
                  hsla(178, 80%, 24%, ${config.opacity * 0.16}),
                  transparent 68%)`,
        }}
        animate={{
          opacity:
            colorMode === "midnight"
              ? intensity === "reactive"
                ? [0.72, 1 + avgEnergy * 0.28, 0.72]
                : [0.68, 0.94, 0.68]
              : intensity === "reactive"
                ? [0.62, 0.95 + avgEnergy * 0.25, 0.62]
                : [0.58, 0.86, 0.58],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  )
}

export function RadioPlayer() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  /** Base Icecast URL — updated when `/api/metadata` returns `streamUrl` (browser `rawUrlRef`). */
  const rawUrlRef = useRef(STREAM_URL)
  /** True only around deliberate `audio.pause()` from our `isPlaying` sync effect. */
  const userPausedRef = useRef(false)
  /** OS interruption (call, Siri, lock-screen edge cases) — triggers reload on focus like browser. */
  const interruptedRef = useRef(false)
  const isPlayingRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  /** Firefox often fires `waiting` on live Icecast while the decoder catches up — distinct from initial tap load. */
  const [streamBuffering, setStreamBuffering] = useState(false)
  const [metadata, setMetadata] = useState<StreamMetadata | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastTrack, setLastTrack] = useState<string>("")
  
  // Visualizer states
  const [lavaIntensity, setLavaIntensity] = useState<LavaIntensity>("medium")
  const [analyzerData, setAnalyzerData] = useState<number[]>([])
  const [showVisualizerMenu, setShowVisualizerMenu] = useState(false)
  
  // UI states
  const [showSleepTimer, setShowSleepTimer] = useState(false)
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null)
  /** Preset minutes for the running timer — used to highlight the active option (remaining seconds alone is ambiguous). */
  const [sleepTimerPresetMinutes, setSleepTimerPresetMinutes] = useState<number | null>(null)
  const [sleepTimerActive, setSleepTimerActive] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const lavaSettingsBtnRef = useRef<HTMLButtonElement>(null)
  const sleepTimerBtnRef = useRef<HTMLButtonElement>(null)
  const [lavaMenuStyle, setLavaMenuStyle] = useState<CSSProperties>({})
  const [sleepMenuStyle, setSleepMenuStyle] = useState<CSSProperties>({})

  // Initialize audio analyzer
  const initializeAudioAnalyzer = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return

    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new Ctor({ latencyHint: "playback" })
      const analyzer = audioContext.createAnalyser()
      analyzer.fftSize = 256
      analyzer.smoothingTimeConstant = 0.8
      
      const source = audioContext.createMediaElementSource(audioRef.current)
      source.connect(analyzer)
      analyzer.connect(audioContext.destination)
      
      audioContextRef.current = audioContext
      analyzerRef.current = analyzer
      sourceRef.current = source
    } catch {
      // Audio analyzer not available
    }
  }, [])

  useEffect(() => {
    rawUrlRef.current = metadata?.streamUrl || STREAM_URL
  }, [metadata])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  /** Clear decoded buffer then reconnect with `_fresh` — matches browser webradio `reloadAndPlay`. */
  const reloadAndPlayLive = useCallback(
    (audio: HTMLAudioElement, rawBase: string) => {
      if (!rawBase) return
      interruptedRef.current = false
      setIsLoading(true)
      audio.src = ""
      audio.load()
      audio.src = buildFreshStreamSrc(rawBase)
      audio.load()
      audio.volume = 1
      if (!audioContextRef.current) {
        initializeAudioAnalyzer()
      }
      const ctx = audioContextRef.current
      const playPromise = audio.play()
      const resumePromise =
        ctx?.state === "suspended" ? ctx.resume() : Promise.resolve()
      void Promise.all([playPromise, resumePromise]).catch((e) => {
        console.warn("[RadioPlayer] reloadAndPlayLive failed:", e)
        setIsLoading(false)
        setIsPlaying(false)
      })
    },
    [initializeAudioAnalyzer],
  )

  // Drive `<audio>` from `isPlaying` — same model as browser `AudioGlobal` + Zustand `isPlaying` effect.
  useEffect(() => {
    if (!mounted) return
    const audio = audioRef.current
    if (!audio) return
    const raw = rawUrlRef.current
    if (!raw) return

    if (isPlaying && audio.paused) {
      reloadAndPlayLive(audio, raw)
    } else if (!isPlaying && !audio.paused) {
      userPausedRef.current = true
      audio.pause()
      userPausedRef.current = false
    }
  }, [isPlaying, mounted, reloadAndPlayLive])

  useEffect(() => {
    if (!mounted) return
    const id = window.setInterval(() => {
      const audio = audioRef.current
      if (!audio) return
      if (
        isPlayingRef.current &&
        !isLoading &&
        audio.paused &&
        !userPausedRef.current
      ) {
        console.info("[RadioPlayer] Watchdog: should be playing but paused — reloading")
        reloadAndPlayLive(audio, rawUrlRef.current)
      }
    }, WATCHDOG_MS)
    return () => clearInterval(id)
  }, [mounted, isLoading, reloadAndPlayLive])

  useEffect(() => {
    const tryResume = () => {
      if (!interruptedRef.current) return
      if (!isPlayingRef.current) {
        interruptedRef.current = false
        return
      }
      const audio = audioRef.current
      if (!audio || !audio.paused) return
      window.setTimeout(() => {
        const a = audioRef.current
        if (!a || !isPlayingRef.current) return
        console.info("[RadioPlayer] Resuming after interruption — reloading stream")
        interruptedRef.current = false
        reloadAndPlayLive(a, rawUrlRef.current)
      }, 500)
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryResume()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", tryResume)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", tryResume)
    }
  }, [reloadAndPlayLive])

  // Update analyzer data on animation frame
  const updateAnalyzerData = useCallback(() => {
    if (!analyzerRef.current || !isPlaying) {
      setAnalyzerData([])
      return
    }

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount)
    analyzerRef.current.getByteFrequencyData(dataArray)
    setAnalyzerData(Array.from(dataArray))
    
    animationFrameRef.current = requestAnimationFrame(updateAnalyzerData)
  }, [isPlaying])

  // Start/stop animation loop based on playing state and lava intensity
  useEffect(() => {
    if (isPlaying && lavaIntensity === "reactive") {
      updateAnalyzerData()
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      setAnalyzerData([])
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, lavaIntensity, updateAnalyzerData])

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // `<audio>` events — browser `AudioGlobal` pattern: distinguish OS pause vs deliberate pause via `userPausedRef`.
  useEffect(() => {
    if (!mounted) return
    const audio = audioRef.current
    if (!audio) return

    const onWaiting = () => setStreamBuffering(true)
    const onCanPlay = () => setStreamBuffering(false)
    const onPlayingAudio = () => {
      setStreamBuffering(false)
      setIsLoading(false)
      interruptedRef.current = false
      setIsPlaying(true)
      if (audioContextRef.current?.state === "suspended") {
        void audioContextRef.current.resume().catch(() => {})
      }
    }
    const onPauseAudio = () => {
      setStreamBuffering(false)
      if (!userPausedRef.current && isPlayingRef.current) {
        interruptedRef.current = true
      }
      userPausedRef.current = false
    }

    audio.addEventListener("waiting", onWaiting)
    audio.addEventListener("canplay", onCanPlay)
    audio.addEventListener("playing", onPlayingAudio)
    audio.addEventListener("pause", onPauseAudio)

    return () => {
      audio.removeEventListener("waiting", onWaiting)
      audio.removeEventListener("canplay", onCanPlay)
      audio.removeEventListener("playing", onPlayingAudio)
      audio.removeEventListener("pause", onPauseAudio)
    }
  }, [mounted])

  // Portaled menus: keep position synced (opening panels must not affect header layout)
  useLayoutEffect(() => {
    if (!mounted) return
    const sync = () => {
      if (showVisualizerMenu && lavaSettingsBtnRef.current) {
        setLavaMenuStyle(fixedMenuStyleAboveAnchor(lavaSettingsBtnRef.current, { maxWidthPx: 320 }))
      } else {
        setLavaMenuStyle({})
      }
      if (showSleepTimer && sleepTimerBtnRef.current) {
        setSleepMenuStyle(fixedMenuStyleAboveAnchor(sleepTimerBtnRef.current, { maxWidthPx: 288 }))
      } else {
        setSleepMenuStyle({})
      }
    }
    sync()
    if (!showVisualizerMenu && !showSleepTimer) return
    window.addEventListener("resize", sync, { passive: true })
    window.addEventListener("scroll", sync, true)
    return () => {
      window.removeEventListener("resize", sync)
      window.removeEventListener("scroll", sync, true)
    }
  }, [mounted, showVisualizerMenu, showSleepTimer])

  // Keyboard navigation for menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowVisualizerMenu(false)
        setShowSleepTimer(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  

  const lavaColorMode: LavaColorMode =
    mounted && resolvedTheme === "oled" ? "midnight" : "teal"

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "oled" : "dark")
  }

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerActive || sleepTimerSeconds === null) return

    const interval = setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setIsPlaying(false)
          setSleepTimerActive(false)
          setSleepTimerPresetMinutes(null)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [sleepTimerActive, sleepTimerSeconds])

  const startSleepTimer = (minutes: number) => {
    setSleepTimerSeconds(minutes * 60)
    setSleepTimerPresetMinutes(minutes)
    setSleepTimerActive(true)
    setShowSleepTimer(false)
  }

  const cancelSleepTimer = () => {
    setSleepTimerSeconds(null)
    setSleepTimerPresetMinutes(null)
    setSleepTimerActive(false)
  }

  const parseTrackInfo = (track: string | undefined) => {
    if (!track) return { artist: "Unknown Artist", title: "Unknown Track" }
    const parts = track.split(" - ")
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() }
    }
    return { artist: "Unknown Artist", title: track }
  }

  /** Flip intent — actual `<audio>` work runs in the `isPlaying` sync effect (browser webradio pattern). */
  const togglePlay = useCallback(() => {
    setIsPlaying((v) => !v)
  }, [])

  // Media Session: OS controls call `setIsPlaying(true|false)` like Zustand `play`/`pause` in browser webradio.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return
    const ms = navigator.mediaSession

    ms.setActionHandler("play", () => {
      if (typeof window !== "undefined") window.focus()
      setIsPlaying(true)
    })
    ms.setActionHandler("pause", () => {
      if (typeof window !== "undefined") window.focus()
      setIsPlaying(false)
    })
    ms.setActionHandler("stop", () => {
      if (typeof window !== "undefined") window.focus()
      setIsPlaying(false)
    })

    ;(["seekbackward", "seekforward", "previoustrack", "nexttrack"] as const).forEach((action) => {
      try {
        ms.setActionHandler(action, null)
      } catch {
        /* unsupported */
      }
    })

    return () => {
      ;(["play", "pause", "stop", "seekbackward", "seekforward", "previoustrack", "nexttrack"] as const).forEach(
        (action) => {
          try {
            ms.setActionHandler(action, null)
          } catch {
            /* */
          }
        },
      )
    }
  }, [])

  // Media Session: artwork + playback state + live position hint
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return

    const track = parseTrackInfo(metadata?.currentTrack)
    const artSrc = proxyImageUrl(metadata?.albumArt)

    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const absoluteArtSrc = artSrc?.startsWith("/") ? `${origin}${artSrc}` : artSrc
    const defaultShareImageSrc = `${origin}${DEFAULT_SHARE_IMAGE_URL}`

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: metadata?.name || "theradio.fm",
      artwork: absoluteArtSrc
        ? [
            { src: absoluteArtSrc, sizes: "512x512", type: "image/jpeg" },
            { src: absoluteArtSrc, sizes: "256x256", type: "image/jpeg" },
            { src: absoluteArtSrc, sizes: "128x128", type: "image/jpeg" },
          ]
        : [
            { src: defaultShareImageSrc, sizes: "512x512", type: "image/jpeg" },
            { src: defaultShareImageSrc, sizes: "256x256", type: "image/jpeg" },
          ],
    })

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused"

    try {
      if (isPlaying && typeof navigator.mediaSession.setPositionState === "function") {
        navigator.mediaSession.setPositionState({
          duration: Number.POSITIVE_INFINITY,
          playbackRate: 1,
          position: 0,
        })
      } else if (typeof navigator.mediaSession.setPositionState === "function") {
        navigator.mediaSession.setPositionState(null as unknown as MediaPositionState)
      }
    } catch {
      /* Infinity unsupported */
    }
  }, [metadata, isPlaying])

  // Fetch stream metadata
  const fetchMetadata = useCallback(async () => {
    try {
      const response = await fetch("/api/metadata", { cache: "no-store" })
      const data: StreamMetadata = await response.json()
      setMetadata(data)
      setIsConnected(data.isLive !== false)
      
      if (data.currentTrack && data.currentTrack !== lastTrack) {
        setLastTrack(data.currentTrack)
      }
    } catch {
      setIsConnected(false)
    }
  }, [lastTrack])

  useEffect(() => {
    fetchMetadata()
    const metadataInterval = setInterval(fetchMetadata, 5000)
    return () => clearInterval(metadataInterval)
  }, [fetchMetadata])

  const trackInfo = parseTrackInfo(metadata?.currentTrack)
  const albumArtUrl = proxyImageUrl(metadata?.albumArt)

  // Share functionality with current track metadata — iframe-compatible
  const handleShare = async () => {
    const shareTitle = `${trackInfo.title} - ${trackInfo.artist}`
    const shareText = `Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm`
    const shareUrl = buildShareUrl()
    const shareMessage = `${shareText}\n${shareUrl}`
    const shareData = {
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    }

    const embedded = isEmbeddedWindow()
    if (embedded) {
      // In many embeds, Web Share + Clipboard are blocked by Permissions-Policy / sandbox.
      // Always show a manual-share UI in that case.
      setShowShareModal(true)
      void copyTextToClipboard(shareMessage)
      return
    }

    // Try native Web Share API first (mobile & desktop)
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare(shareData))
    ) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        const errorName = (err as Error)?.name
        // User cancelled, don't continue
        if (errorName === "AbortError") {
          return
        }
      }
    }

    const copied = await copyTextToClipboard(shareMessage)
    if (!copied) setShowShareModal(true)
  }

  // Render lava lamp visualizer
  const renderVisualizer = () => {
    return (
      <LavaLampVisualizer 
        analyzerData={analyzerData} 
        isPlaying={isPlaying} 
        intensity={lavaIntensity}
        colorMode={lavaColorMode}
      />
    )
  }

  return (
    <div 
      className="relative min-h-screen w-full overflow-hidden bg-background"
      role="application"
      aria-label="Internet Radio Player"
    >
      {/* Background with album art blur - z-0 */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {albumArtUrl ? (
            <motion.div
              key={albumArtUrl}
              initial={{ opacity: 0, scale: 1.6 }}
              animate={{ opacity: 1, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${albumArtUrl})`,
                filter: "blur(80px) brightness(0.12)",
              }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="app-header relative z-50 m-3 flex min-h-0 items-center justify-between overflow-hidden rounded-2xl p-2.5 md:m-5 md:rounded-3xl md:p-3"
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/30 md:h-11 md:w-11"
          >
            <Image
              src={STATION_LOGO_URL}
              alt={metadata?.name || "Station logo"}
              width={44}
              height={44}
              className="h-full w-full object-cover object-center"
            />
          </motion.div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-white md:text-lg">
              {metadata?.name || "theradio.fm"}
            </h1>
            <div className="flex items-center gap-1.5" role="status" aria-live="polite">
              <motion.span
                animate={{
                  scale: isConnected ? [1, 1.2, 1] : 1,
                  opacity: isConnected ? [1, 0.7, 1] : 0.5,
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-400"}`}
                aria-hidden="true"
              />
              <span className="text-[11px] text-white/75 md:text-xs">
                {!isConnected ? "Offline" : isPlaying && streamBuffering ? "Buffering" : "Live"}
              </span>
              <span className="sr-only">
                {!isConnected
                  ? "Station is currently offline"
                  : isPlaying && streamBuffering
                    ? "Stream is buffering"
                    : "Station is currently live and broadcasting"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 shrink-0 items-center gap-0.5 md:gap-1.5">
          <motion.button
            ref={lavaSettingsBtnRef}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation()
              setShowVisualizerMenu(!showVisualizerMenu)
              setShowSleepTimer(false)
            }}
            className={`app-header__btn rounded-full p-2 md:p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              lavaIntensity !== "off" ? "app-header__btn--active" : ""
            }`}
            aria-label={`Visual effects settings. Current: ${lavaIntensity}`}
            aria-expanded={showVisualizerMenu}
            aria-haspopup="menu"
          >
            <Settings2 className="h-[18px] w-[18px] text-white md:h-5 md:w-5" aria-hidden="true" />
          </motion.button>

          <motion.button
            ref={sleepTimerBtnRef}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation()
              if (sleepTimerActive) {
                cancelSleepTimer()
              } else {
                setShowSleepTimer(!showSleepTimer)
                setShowVisualizerMenu(false)
              }
            }}
            className={`app-header__btn rounded-full p-2 md:p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              sleepTimerActive ? "app-header__btn--active" : ""
            }`}
            aria-label={
              sleepTimerActive
                ? `Sleep timer active. ${sleepTimerSeconds != null ? formatTime(sleepTimerSeconds) : ""} remaining. Click to cancel.`
                : "Set sleep timer"
            }
            aria-expanded={showSleepTimer}
            aria-haspopup="menu"
          >
            <Timer className="h-[18px] w-[18px] text-white md:h-5 md:w-5" aria-hidden="true" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="app-header__btn rounded-full p-2 md:p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label={
              mounted && resolvedTheme === "oled"
                ? "Switch to station teal theme"
                : "Switch to midnight black theme"
            }
          >
            {mounted && resolvedTheme === "oled" ? (
              <Palette className="h-[18px] w-[18px] text-white md:h-5 md:w-5" aria-hidden="true" />
            ) : (
              <Sparkles className="h-[18px] w-[18px] text-white md:h-5 md:w-5" aria-hidden="true" />
            )}
          </motion.button>
        </div>
      </motion.header>

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showVisualizerMenu && (
              <>
                <motion.div
                  key="lava-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100]"
                  onClick={() => setShowVisualizerMenu(false)}
                  aria-hidden="true"
                />
                <motion.div
                  key="lava-panel"
                  style={lavaMenuStyle}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-[min(calc(100vw-2rem),20rem)] min-w-[16rem] overflow-visible rounded-xl border border-border bg-card p-2 text-card-foreground shadow-xl"
                  role="menu"
                  aria-label="Visual effects intensity options"
                >
                  <h3
                    className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    id="visualizer-heading"
                  >
                    Lava lamp
                  </h3>
                  <div
                    role="group"
                    aria-labelledby="visualizer-heading"
                    className="max-h-[min(70vh,22rem)] overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5"
                  >
                    {LAVA_INTENSITY_OPTIONS.map((option, index) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => {
                          setLavaIntensity(option.type)
                          setShowVisualizerMenu(false)
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] touch-manipulation ${
                          lavaIntensity === option.type
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-white/10"
                        }`}
                        role="menuitemradio"
                        aria-checked={lavaIntensity === option.type}
                        tabIndex={index === 0 ? 0 : -1}
                      >
                        <span className="font-medium leading-tight">{option.label}</span>
                        <span
                          className={`text-xs leading-snug ${
                            lavaIntensity === option.type
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          }`}
                        >
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showSleepTimer && (
              <>
                <motion.div
                  key="sleep-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100]"
                  onClick={() => setShowSleepTimer(false)}
                  aria-hidden="true"
                />
                <motion.div
                  key="sleep-panel"
                  style={sleepMenuStyle}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="max-w-[min(calc(100vw-2rem),18rem)] min-w-[16rem] overflow-visible rounded-xl border border-border bg-card p-2 text-card-foreground shadow-xl"
                  role="menu"
                  aria-label="Sleep timer options"
                >
                  <h3
                    className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    id="sleep-timer-heading"
                  >
                    Sleep timer
                  </h3>
                  <div role="group" aria-labelledby="sleep-timer-heading">
                    {SLEEP_TIMER_OPTIONS.map((option, index) => {
                      const isActive = sleepTimerActive && sleepTimerPresetMinutes === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => startSleepTimer(option.value)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] touch-manipulation ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-white/10"
                          }`}
                          role="menuitemradio"
                          aria-checked={isActive}
                          tabIndex={index === 0 ? 0 : -1}
                        >
                          <span className="font-medium leading-tight">{option.label}</span>
                          {isActive && sleepTimerSeconds !== null && (
                            <span className="shrink-0 font-mono text-xs tabular-nums text-primary-foreground/85">
                              {formatTime(sleepTimerSeconds)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {sleepTimerActive && (
                      <button
                        type="button"
                        onClick={() => {
                          cancelSleepTimer()
                          setShowSleepTimer(false)
                        }}
                        className="mt-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive active:scale-[0.98] touch-manipulation"
                        role="menuitem"
                      >
                        Cancel timer
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Active Sleep Timer Display */}
      <AnimatePresence>
        {sleepTimerActive && sleepTimerSeconds !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed left-1/2 top-20 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-lg md:gap-3 md:px-5 md:py-2.5"
          >
            <Timer className="h-3.5 w-3.5 shrink-0 text-primary md:h-4 md:w-4" aria-hidden="true" />
            <span className="font-mono text-base font-semibold tabular-nums tracking-tight text-foreground md:text-lg">
              {formatTime(sleepTimerSeconds)}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={cancelSleepTimer}
              className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive active:scale-90"
              aria-label="Cancel sleep timer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-3 pb-28 pt-5 md:px-4 md:pb-32 md:pt-12">
        {/* Album Art */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative mb-5 aspect-square w-full max-w-[280px] rounded-xl md:mb-7 md:max-w-[360px] md:rounded-2xl lg:max-w-[400px]"
        >
          <motion.div
            aria-hidden="true"
            className="absolute -inset-6 rounded-[2rem] bg-background/45 blur-2xl"
            animate={{
              opacity: isPlaying ? [0.78, 0.94, 0.78] : 0.82,
              scale: isPlaying ? [1, 1.03, 1] : 1,
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{
              boxShadow: isPlaying
                ? [
                    "0 28px 95px rgba(0,0,0,0.78), 0 0 34px rgba(var(--primary), 0.22)",
                    "0 34px 120px rgba(0,0,0,0.88), 0 0 62px rgba(var(--primary), 0.34)",
                    "0 28px 95px rgba(0,0,0,0.78), 0 0 34px rgba(var(--primary), 0.22)",
                  ]
                : "0 26px 86px rgba(0,0,0,0.76)",
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl"
          />
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border">
            <div className="relative z-0 h-full min-h-0 w-full">
              <AnimatePresence mode="wait">
                {albumArtUrl ? (
                  <motion.img
                    key={albumArtUrl}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    src={albumArtUrl}
                    alt="Album artwork"
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative h-full min-h-0 w-full bg-background"
                  >
                    <Image
                      src={STATION_LOGO_URL}
                      alt="theradio.fm station artwork"
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 768px) 320px, 400px"
                      priority
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-background/36 via-transparent to-black/10"
              />
            )}

            <div className="pointer-events-none absolute inset-0 z-[25]">
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleShare()
                }}
                className="pointer-events-auto absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white shadow-lg transition-colors hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-90 touch-manipulation md:right-4 md:top-4 md:h-12 md:w-12"
                aria-label={`Share current track: ${trackInfo.title} by ${trackInfo.artist}`}
                type="button"
              >
                <Share2 className="h-5 w-5 md:h-5 md:w-5" aria-hidden="true" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={togglePlay}
                disabled={isLoading}
                className="pointer-events-auto absolute bottom-4 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-red-700/60 bg-red-600 text-white shadow-2xl shadow-red-950/45 transition-all hover:bg-red-700 disabled:opacity-50 md:bottom-5 md:h-[4.75rem] md:w-[4.75rem] focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-90 touch-manipulation"
                aria-label={
                  isLoading
                    ? "Loading stream"
                    : isPlaying && streamBuffering
                      ? "Stream buffering, pause playback"
                      : isPlaying
                        ? "Pause playback"
                        : "Play stream"
                }
                aria-busy={isLoading}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, rotate: 360 }}
                      exit={{ opacity: 0 }}
                      transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
                      className="h-7 w-7 rounded-full border-[3px] border-white border-t-transparent md:h-8 md:w-8"
                    />
                  ) : isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Pause className="h-7 w-7 md:h-9 md:w-9" strokeWidth={2.25} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Play className="ml-1 h-7 w-7 md:h-9 md:w-9" strokeWidth={2.25} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Track Info */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4 w-full max-w-[400px] rounded-2xl border border-border bg-card px-4 py-4 text-center shadow-md md:mb-5 md:rounded-3xl md:px-5 md:py-5"
          role="region"
          aria-label="Now playing"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-[22rem] flex-col gap-1.5 md:max-w-none md:gap-2">
            <AnimatePresence mode="wait">
              <motion.h2
                key={trackInfo.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-balance text-xl font-bold leading-snug tracking-tight text-foreground md:text-2xl md:leading-[1.15]"
              >
                {trackInfo.title}
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={trackInfo.artist}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-balance text-sm leading-relaxed text-muted-foreground md:text-base"
              >
                {trackInfo.artist}
              </motion.p>
            </AnimatePresence>
          </div>
          <span className="sr-only">
            Now playing: {trackInfo.title} by {trackInfo.artist}
          </span>
        </motion.div>

        {/* Current Program Card */}
        <AnimatePresence>
          {metadata?.currentProgram && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-3 w-full max-w-[400px] rounded-2xl border border-border bg-card px-4 py-3.5 shadow-md md:mb-4 md:px-5 md:py-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-1.5 flex items-center justify-center gap-1.5">
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="shrink-0"
                  >
                    <Mic className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" />
                  </motion.div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[11px]">
                    On Air
                  </span>
                </div>
                <h3 className="text-pretty text-base font-semibold leading-snug text-card-foreground md:text-lg">
                  {metadata.currentProgram.name}
                </h3>
                <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground md:text-sm">
                  {metadata.currentProgram.broadcaster}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Visualizer Overlay - Between background and content */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <AnimatePresence mode="wait">
          <motion.div
            key={lavaIntensity}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            {/* Client-only: Framer Motion + computed blob styles serialize differently SSR vs browser → hydration mismatch */}
            {mounted ? renderVisualizer() : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Share Modal - Fallback for iframe embedding */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/60"
              onClick={() => setShowShareModal(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-[999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl md:p-7"
              role="dialog"
              aria-modal="true"
              aria-label="Share track"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5 pr-2">
                  <h2 className="text-balance text-xl font-bold leading-tight text-foreground">
                    Share track
                  </h2>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    <span className="block font-medium text-foreground/90">{trackInfo.title}</span>
                    <span className="text-muted-foreground"> by {trackInfo.artist}</span>
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowShareModal(false)}
                  className="rounded-full border border-border bg-muted p-1 shadow-sm hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Close share modal"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </motion.button>
              </div>

              <div className="mb-2 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium leading-none text-foreground">
                    Share URL
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <input
                      type="text"
                      readOnly
                      value={buildShareUrl()}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                      className="min-h-[42px] flex-1 rounded-lg border border-input bg-muted px-3 py-2.5 text-sm leading-snug text-foreground shadow-inner"
                      aria-label="Share link"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const url = buildShareUrl()
                        void copyTextToClipboard(url)
                      }}
                      className="shrink-0 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Copy URL
                    </motion.button>
                  </div>
                  <a
                    href={buildShareUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Open link in a new tab
                  </a>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium leading-none text-foreground">
                    Share message
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <textarea
                      readOnly
                      value={`Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm\n${buildShareUrl()}`}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
                      className="min-h-[5.5rem] flex-1 resize-none rounded-lg border border-input bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-inner"
                      rows={3}
                      aria-label="Share message"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const message = `Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm\n${buildShareUrl()}`
                        void copyTextToClipboard(message)
                      }}
                      className="shrink-0 self-start rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-black/20 transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-stretch"
                    >
                      Copy
                    </motion.button>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowShareModal(false)}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-2 font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Close
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Audio Element */}
      <audio
        ref={audioRef}
        preload="none"
        crossOrigin="anonymous"
        playsInline
      />
    </div>
  )
}
