"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Play,
  Pause,
  Radio,
  Sun,
  Moon,
  Wifi,
  Music2,
  Disc3,
  Mic,
  ChevronDown,
  Timer,
  Droplets,
  Settings2,
  X,
  Activity,
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
const STATION_LOGO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/theradio-fm-logo-riP2RHcCrwTnJDqhSbaT3uXluubSLi.jpg"
const DEFAULT_SHARE_IMAGE_URL = "/apple-icon.jpg"
const SHARE_URL = "https://theradio.fm"

const buildRealtimeShareUrl = () => `${SHARE_URL}?np=${Date.now()}`

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

// Lava Lamp Visualizer Component with intensity settings
function LavaLampVisualizer({ 
  analyzerData, 
  isPlaying, 
  intensity 
}: { 
  analyzerData: number[]
  isPlaying: boolean
  intensity: LavaIntensity 
}) {
  // Calculate audio energy for reactive mode
  const avgEnergy = analyzerData.length > 0 
    ? analyzerData.reduce((a, b) => a + b, 0) / analyzerData.length / 255 
    : 0

  // Intensity settings
  const settings = {
    off: { blobCount: 0, opacity: 0, speed: 1, movement: 0, blur: "blur-2xl", saturation: 0 },
    subtle: { blobCount: 5, opacity: 0.38, speed: 1.45, movement: 24, blur: "blur-2xl", saturation: 62 },
    medium: { blobCount: 8, opacity: 0.64, speed: 0.9, movement: 46, blur: "blur-xl", saturation: 78 },
    high: { blobCount: 10, opacity: 0.82, speed: 0.62, movement: 72, blur: "blur-lg", saturation: 92 },
    reactive: { blobCount: 12, opacity: 0.9, speed: 0.45, movement: 88, blur: "blur-lg", saturation: 96 },
  }

  const config = settings[intensity] || settings.medium
  const reactiveMultiplier = intensity === "reactive" ? (1 + avgEnergy * 2.2) : 1

  // Use deterministic pseudo-random values based on index to avoid hydration mismatch
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9999) * 10000
    return x - Math.floor(x)
  }

  const blobs = useMemo(() => 
    Array.from({ length: config.blobCount }, (_, i) => ({
      id: i,
      x: 4 + (i % 5) * 22 + seededRandom(i + 1) * 18,
      size: 130 + seededRandom(i + 10) * 120,
      // Alternate between crimson red (0-20) and teal (170-190) from logo
      hue: i % 2 === 0 ? 5 + (i * 5) % 20 : 175 + (i * 5) % 20,
      speed: 7 + seededRandom(i + 20) * 7,
      delay: i * 0.28,
    })), [config.blobCount]
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
      
      {/* Overlay glow for depth */}
      <motion.div 
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, 
            hsla(10, 85%, 30%, ${config.opacity * 0.28}), 
            hsla(178, 80%, 24%, ${config.opacity * 0.16}),
            transparent 68%)`,
        }}
        animate={{
          opacity: intensity === "reactive" ? [0.62, 0.95 + avgEnergy * 0.25, 0.62] : [0.58, 0.86, 0.58],
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
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [metadata, setMetadata] = useState<StreamMetadata | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastTrack, setLastTrack] = useState<string>("")
  
  // Visualizer states
  const [lavaIntensity, setLavaIntensity] = useState<LavaIntensity>("medium")
  const [analyzerData, setAnalyzerData] = useState<number[]>([])
  const [showVisualizerMenu, setShowVisualizerMenu] = useState(false)
  
  // UI states
  const [isStreamInfoExpanded, setIsStreamInfoExpanded] = useState(false)
  const [showSleepTimer, setShowSleepTimer] = useState(false)
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null)
  const [sleepTimerActive, setSleepTimerActive] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  // Initialize audio analyzer
  const initializeAudioAnalyzer = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return

    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
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

  

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerActive || sleepTimerSeconds === null) return

    const interval = setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (audioRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
          }
          setSleepTimerActive(false)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [sleepTimerActive, sleepTimerSeconds])

  const startSleepTimer = (minutes: number) => {
    setSleepTimerSeconds(minutes * 60)
    setSleepTimerActive(true)
    setShowSleepTimer(false)
  }

  const cancelSleepTimer = () => {
    setSleepTimerSeconds(null)
    setSleepTimerActive(false)
  }

  // Media Session API — updates OS/browser media controls
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return

    const track = parseTrackInfo(metadata?.currentTrack)
    const artSrc = proxyImageUrl(metadata?.albumArt)

    // Build an absolute URL for artwork (Media Session requires absolute URLs in some browsers)
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

    navigator.mediaSession.setActionHandler("play", () => {
      // Focus window when media control is clicked
      if (typeof window !== "undefined") window.focus()
      togglePlay()
    })
    navigator.mediaSession.setActionHandler("pause", () => {
      // Focus window when media control is clicked
      if (typeof window !== "undefined") window.focus()
      togglePlay()
    })
    navigator.mediaSession.setActionHandler("stop", () => {
      // Focus window when media control is clicked
      if (typeof window !== "undefined") window.focus()
      if (audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    })

    // Clear seek/track handlers — live stream has no seeking or tracks
    navigator.mediaSession.setActionHandler("seekbackward", null)
    navigator.mediaSession.setActionHandler("seekforward", null)
    navigator.mediaSession.setActionHandler("previoustrack", null)
    navigator.mediaSession.setActionHandler("nexttrack", null)
  }, [metadata, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Audio controls
  const togglePlay = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      setIsLoading(true)
      try {
        // Initialize audio analyzer on first play
        if (!audioContextRef.current) {
          initializeAudioAnalyzer()
        }
        
        // Resume audio context if suspended
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }

        const streamUrl = metadata?.streamUrl || STREAM_URL
        if (audioRef.current.src !== streamUrl) {
          audioRef.current.pause()
          audioRef.current.src = streamUrl
          audioRef.current.load()
        }
        audioRef.current.volume = 1
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.error("Playback error:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const parseTrackInfo = (track: string | undefined) => {
    if (!track) return { artist: "Unknown Artist", title: "Unknown Track" }
    const parts = track.split(" - ")
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() }
    }
    return { artist: "Unknown Artist", title: track }
  }

  const trackInfo = parseTrackInfo(metadata?.currentTrack)
  const albumArtUrl = proxyImageUrl(metadata?.albumArt)

  // Share functionality with current track metadata — iframe-compatible
  const handleShare = async () => {
    console.log("[v0] Share button clicked")
    const shareTitle = `${trackInfo.title} - ${trackInfo.artist}`
    const shareText = `Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm`
    const shareUrl = buildRealtimeShareUrl()
    const shareMessage = `${shareText}\n${shareUrl}`
    const shareData = {
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    }

    // Check if we're in an iframe
    const isInIframe = typeof window !== "undefined" && window.self !== window.top
    console.log("[v0] Is in iframe:", isInIframe)

    // Try native Web Share API first (mobile & desktop)
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare(shareData))
    ) {
      try {
        console.log("[v0] Attempting native share API")
        await navigator.share(shareData)
        console.log("[v0] Native share succeeded")
        return
      } catch (err) {
        const errorName = (err as Error)?.name
        console.log("[v0] Native share error:", errorName)
        // User cancelled, don't continue
        if (errorName === "AbortError") {
          console.log("[v0] Share cancelled by user")
          return
        }
        // Share API failed, continue to clipboard fallback
      }
    }

    // Fallback 1: Copy to clipboard (works in iframes if allowed)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        console.log("[v0] Attempting clipboard copy")
        await navigator.clipboard.writeText(shareMessage)
        console.log("[v0] Clipboard copy succeeded")
        return
      } catch (err) {
        console.log("[v0] Clipboard copy failed:", (err as Error).message)
        // Clipboard access denied (common in iframes) — try alternative method
      }
    }

    // Fallback 2: Use legacy execCommand for maximum compatibility
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        console.log("[v0] Attempting execCommand fallback")
        // Create a temporary textarea element
        const textarea = document.createElement("textarea")
        textarea.value = shareMessage
        textarea.style.position = "fixed"
        textarea.style.top = "0"
        textarea.style.left = "0"
        textarea.style.opacity = "0"
        textarea.style.pointerEvents = "none"
        document.body.appendChild(textarea)
        
        // Select and copy
        textarea.select()
        textarea.setSelectionRange(0, 99999) // For mobile
        
        const success = document.execCommand("copy")
        document.body.removeChild(textarea)
        
        if (success) {
          console.log("[v0] execCommand copy succeeded")
          return
        }
      } catch (err) {
        console.log("[v0] execCommand failed:", (err as Error).message)
      }
    }

    // Fallback 3: Show share modal dialog for iframe embedding
    console.log("[v0] Showing share modal as final fallback")
    setShowShareModal(true)
  }

  // Render lava lamp visualizer
  const renderVisualizer = () => {
    return (
      <LavaLampVisualizer 
        analyzerData={analyzerData} 
        isPlaying={isPlaying} 
        intensity={lavaIntensity} 
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
        className="liquid-glass relative z-10 m-4 flex items-center justify-between rounded-3xl p-3 md:m-6 md:p-4"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="liquid-glass-sm relative h-12 w-12 overflow-hidden rounded-full"
          >
            <Image
              src={STATION_LOGO_URL}
              alt={metadata?.name || "Station logo"}
              width={48}
              height={48}
              className="h-full w-full object-cover object-center"
            />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {metadata?.name || "theradio.fm"}
            </h1>
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <motion.span
                animate={{
                  scale: isConnected ? [1, 1.2, 1] : 1,
                  opacity: isConnected ? [1, 0.7, 1] : 0.5,
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? "Live" : "Offline"}
              </span>
              <span className="sr-only">
                {isConnected ? "Station is currently live and broadcasting" : "Station is currently offline"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Visualizer Selector */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation()
                setShowVisualizerMenu(!showVisualizerMenu)
                setShowSleepTimer(false)
              }}
              className={`liquid-glass-sm rounded-full p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lavaIntensity !== "off" ? "text-primary ring-1 ring-primary/30" : "hover:bg-white/10"}`}
              aria-label={`Visual effects settings. Current: ${lavaIntensity}`}
              aria-expanded={showVisualizerMenu}
              aria-haspopup="menu"
            >
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </motion.button>
          </div>

          {/* Sleep Timer Button */}
          <motion.button
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
            className={`liquid-glass-sm rounded-full p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${sleepTimerActive ? "text-primary ring-1 ring-primary/30" : "hover:bg-white/10"}`}
            aria-label={sleepTimerActive ? `Sleep timer active. ${sleepTimerSeconds ? formatTime(sleepTimerSeconds) : ''} remaining. Click to cancel.` : "Set sleep timer"}
            aria-expanded={showSleepTimer}
            aria-haspopup="menu"
          >
            <Timer className="h-5 w-5" aria-hidden="true" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="liquid-glass-sm rounded-full p-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={mounted && resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5 text-foreground" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5 text-foreground" aria-hidden="true" />
            )}
          </motion.button>
        </div>
      </motion.header>

      {/* Sleep Timer Dropdown */}
      <AnimatePresence>
        {showSleepTimer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998]"
              onClick={() => setShowSleepTimer(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="liquid-glass fixed right-4 top-20 z-[999] w-56 rounded-xl p-2 md:right-6"
              role="menu"
              aria-label="Sleep timer options"
            >
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground" id="sleep-timer-heading">
                Sleep Timer
              </h3>
              <div role="group" aria-labelledby="sleep-timer-heading">
                {SLEEP_TIMER_OPTIONS.map((option, index) => {
                  const isActive = sleepTimerActive && sleepTimerSeconds !== null && Math.ceil(sleepTimerSeconds / 60) === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => startSleepTimer(option.value)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 touch-manipulation ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-white/10"
                      }`}
                      role="menuitemradio"
                      aria-checked={isActive}
                      tabIndex={index === 0 ? 0 : -1}
                    >
                      <span className="font-medium">{option.label}</span>
                      {isActive && sleepTimerSeconds !== null && (
                        <span className="font-mono text-xs text-primary-foreground/80">
                          {formatTime(sleepTimerSeconds)}
                        </span>
                      )}
                    </button>
                  )
                })}
                {sleepTimerActive && (
                  <button
                    onClick={() => {
                      cancelSleepTimer()
                      setShowSleepTimer(false)
                    }}
                    className="mt-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive active:scale-95 touch-manipulation"
                    role="menuitem"
                  >
                    Cancel timer
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Active Sleep Timer Display */}
      <AnimatePresence>
        {sleepTimerActive && sleepTimerSeconds !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="liquid-glass-sm fixed left-1/2 top-20 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2"
          >
            <Timer className="h-4 w-4 text-primary" />
            <span className="font-mono text-lg font-bold text-foreground">
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
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-32 pt-8 md:pt-16">
        {/* Album Art */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="relative mb-8 aspect-square w-full max-w-[320px] rounded-2xl md:max-w-[400px]"
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
          <div className="liquid-glass relative h-full w-full overflow-hidden rounded-2xl">
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
                  className="h-full w-full object-cover"
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-secondary to-muted"
                >
                  <motion.div
                    animate={{ rotate: isPlaying ? 360 : 0 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Disc3 className="h-32 w-32 text-muted-foreground" />
                  </motion.div>
                  <Music2 className="mt-4 h-8 w-8 text-muted-foreground/50" />
                </motion.div>
              )}
            </AnimatePresence>

            {isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gradient-to-t from-background/36 via-transparent to-black/10"
              />
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 md:p-5">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log("[v0] Share button onClick triggered")
                  handleShare()
                }}
                className="liquid-glass-sm flex h-12 w-12 items-center justify-center rounded-full text-foreground transition-all hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90 touch-manipulation md:h-14 md:w-14"
                aria-label={`Share current track: ${trackInfo.title} by ${trackInfo.artist}`}
                type="button"
              >
                <Share2 className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlay}
                disabled={isLoading}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-primary/85 shadow-2xl shadow-black/30 backdrop-blur-2xl transition-all disabled:opacity-50 md:h-20 md:w-20 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90 touch-manipulation"
                aria-label={isLoading ? "Loading stream" : isPlaying ? "Pause playback" : "Play stream"}
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
                      className="h-7 w-7 rounded-full border-4 border-primary-foreground border-t-transparent md:h-8 md:w-8"
                    />
                  ) : isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Pause className="h-7 w-7 text-primary-foreground md:h-9 md:w-9" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Play className="ml-1 h-7 w-7 text-primary-foreground md:h-9 md:w-9" />
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
          className="liquid-glass mb-8 w-full max-w-[400px] rounded-3xl p-5 text-center"
          role="region"
          aria-label="Now playing"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            <motion.h2
              key={trackInfo.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-2 truncate text-2xl font-bold text-foreground md:text-3xl"
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
              className="mb-1 truncate text-lg text-muted-foreground"
            >
              {trackInfo.artist}
            </motion.p>
          </AnimatePresence>
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
              className="liquid-glass mb-4 w-full max-w-[400px] rounded-2xl p-4"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-primary/15 shadow-inner backdrop-blur-xl"
                >
                  <Mic className="h-8 w-8 text-primary" />
                </motion.div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Mic className="h-4 w-4 text-primary" />
                    </motion.div>
                    <span className="text-xs text-muted-foreground">On Air</span>
                  </div>
                  <h3 className="font-semibold text-card-foreground">
                    {metadata.currentProgram.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {metadata.currentProgram.broadcaster}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stream Info Card - Collapsible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="liquid-glass w-full max-w-[400px] overflow-hidden rounded-2xl"
        >
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => setIsStreamInfoExpanded(!isStreamInfoExpanded)}
            className="flex w-full items-center justify-between p-4 md:p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary touch-manipulation"
            aria-expanded={isStreamInfoExpanded}
            aria-controls="stream-info-content"
          >
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-card-foreground">
                Stream Information
              </h3>
            </div>
            <motion.div
              animate={{ rotate: isStreamInfoExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {isStreamInfoExpanded && (
              <motion.div
                id="stream-info-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 px-4 pb-4 text-sm md:px-6 md:pb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Station</span>
                    <span className="font-medium text-card-foreground">
                      {metadata?.name || "Loading..."}
                    </span>
                  </div>

                  {metadata?.genre && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Genre</span>
                      <span className="font-medium text-card-foreground">
                        {metadata.genre}
                      </span>
                    </div>
                  )}

                  {metadata?.bitrate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bitrate</span>
                      <span className="font-medium text-card-foreground">
                        {metadata.bitrate} kbps
                      </span>
                    </div>
                  )}

                  {metadata?.contentType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Format</span>
                      <span className="font-medium text-card-foreground">
                        {metadata.contentType}
                      </span>
                    </div>
                  )}

                  {metadata?.server && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <span className="font-medium text-card-foreground">
                        {metadata.server}
                      </span>
                    </div>
                  )}

                  {metadata?.metaInterval && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Meta Interval</span>
                      <span className="font-medium text-card-foreground">
                        {metadata.metaInterval} bytes
                      </span>
                    </div>
                  )}

                  {metadata?.currentTrack && (
                    <div className="border-t border-border pt-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        Now Playing
                      </span>
                      <p className="mt-1 font-medium text-card-foreground">
                        {metadata.currentTrack}
                      </p>
                    </div>
                  )}

                  {metadata?.description && (
                    <div className="border-t border-border pt-3">
                      <span className="text-muted-foreground">Description</span>
                      <p className="mt-1 text-card-foreground">
                        {metadata.description}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
            {renderVisualizer()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Visualizer Menu - Rendered at root level with highest z-index */}
      <AnimatePresence>
        {showVisualizerMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998]"
              onClick={() => setShowVisualizerMenu(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="liquid-glass fixed right-4 top-20 z-[999] w-48 rounded-xl p-2 md:right-6"
              role="menu"
              aria-label="Visual effects intensity options"
            >
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground" id="visualizer-heading">
                Lava Lamp Intensity
              </h3>
              <div role="group" aria-labelledby="visualizer-heading">
                {LAVA_INTENSITY_OPTIONS.map((option, index) => (
                  <button
                    key={option.type}
                    onClick={() => {
                      setLavaIntensity(option.type)
                      setShowVisualizerMenu(false)
                    }}
                    className={`flex w-full flex-col items-start rounded-lg px-3 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 touch-manipulation ${
                      lavaIntensity === option.type
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-white/10"
                    }`}
                    role="menuitemradio"
                    aria-checked={lavaIntensity === option.type}
                    tabIndex={index === 0 ? 0 : -1}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className={`text-xs ${lavaIntensity === option.type ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Modal - Fallback for iframe embedding */}
      <AnimatePresence>
        {showShareModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[998] bg-black/55 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="liquid-glass fixed left-1/2 top-1/2 z-[999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Share track"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Share Track</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {trackInfo.title} by {trackInfo.artist}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowShareModal(false)}
                  className="rounded-full border border-white/10 bg-white/10 p-1 shadow-sm backdrop-blur-xl hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Close share modal"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </motion.button>
              </div>

              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Share URL
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={buildRealtimeShareUrl()}
                      className="flex-1 rounded-lg border border-white/10 bg-background/35 px-3 py-2 text-sm text-foreground shadow-inner backdrop-blur-xl"
                      aria-label="Share link"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const url = buildRealtimeShareUrl()
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(url)
                        }
                      }}
                      className="rounded-lg border border-white/10 bg-primary/85 px-4 py-2 font-medium text-primary-foreground shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Copy URL
                    </motion.button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Share Message
                  </label>
                  <div className="mt-2 flex gap-2">
                    <textarea
                      readOnly
                      value={`Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm\n${buildRealtimeShareUrl()}`}
                      className="flex-1 rounded-lg border border-white/10 bg-background/35 px-3 py-2 text-sm text-foreground shadow-inner backdrop-blur-xl"
                      rows={3}
                      aria-label="Share message"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const message = `Listening to "${trackInfo.title}" by ${trackInfo.artist} on theradio.fm\n${buildRealtimeShareUrl()}`
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(message)
                        }
                      }}
                      className="rounded-lg border border-white/10 bg-primary/85 px-4 py-2 font-medium text-primary-foreground shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 font-medium text-foreground shadow-sm backdrop-blur-xl transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Close
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Audio Element */}
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
    </div>
  )
}
