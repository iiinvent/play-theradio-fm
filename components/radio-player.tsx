"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
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
  if (intensity === "off") return null
  
  // Calculate audio energy for reactive mode
  const avgEnergy = analyzerData.length > 0 
    ? analyzerData.reduce((a, b) => a + b, 0) / analyzerData.length / 255 
    : 0

  // Intensity settings
  const settings = {
    subtle: { blobCount: 4, opacity: 0.3, speed: 1.8, movement: 15, blur: "blur-2xl", saturation: 50 },
    medium: { blobCount: 6, opacity: 0.5, speed: 1.2, movement: 25, blur: "blur-xl", saturation: 65 },
    high: { blobCount: 8, opacity: 0.7, speed: 0.8, movement: 40, blur: "blur-lg", saturation: 80 },
    reactive: { blobCount: 8, opacity: 0.8, speed: 0.6, movement: 50, blur: "blur-lg", saturation: 85 },
  }

  const config = settings[intensity] || settings.medium
  const reactiveMultiplier = intensity === "reactive" ? (1 + avgEnergy * 1.5) : 1

  // Use deterministic pseudo-random values based on index to avoid hydration mismatch
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9999) * 10000
    return x - Math.floor(x)
  }

  const blobs = useMemo(() => 
    Array.from({ length: config.blobCount }, (_, i) => ({
      id: i,
      x: 10 + (i % 4) * 22 + seededRandom(i + 1) * 15,
      size: 100 + seededRandom(i + 10) * 80,
      // Alternate between crimson red (0-20) and teal (170-190) from logo
      hue: i % 2 === 0 ? 5 + (i * 5) % 20 : 175 + (i * 5) % 20,
      speed: 10 + seededRandom(i + 20) * 8,
      delay: i * 0.5,
    })), [config.blobCount]
  )

  return (
    <div className="absolute inset-0 overflow-hidden">
      {blobs.map((blob) => {
        const blobOpacity = config.opacity * (intensity === "reactive" ? (0.5 + avgEnergy * 0.5) : 1)
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
              y: ["85%", "5%", "85%"],
              x: [
                `${blob.x}%`, 
                `${blob.x + (Math.sin(blob.id) * config.movement)}%`, 
                `${blob.x - (Math.cos(blob.id) * config.movement * 0.5)}%`,
                `${blob.x}%`
              ],
              scale: intensity === "reactive" 
                ? [1, 1.1 + avgEnergy * 0.4, 1.05, 1] 
                : [1, 1.1, 1.05, 1],
              borderRadius: [
                "50% 50% 50% 50%", 
                "40% 60% 55% 45%", 
                "55% 45% 40% 60%",
                "50% 50% 50% 50%"
              ],
            }}
            transition={{
              duration: animationSpeed,
              repeat: Infinity,
              ease: "easeInOut",
              delay: blob.delay,
              times: [0, 0.4, 0.7, 1],
            }}
          />
        )
      })}
      
      {/* Overlay glow for depth */}
      <motion.div 
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, 
            hsla(10, 70%, 35%, ${config.opacity * 0.15}), 
            transparent 60%)`,
        }}
        animate={{
          opacity: intensity === "reactive" ? [0.5, 0.8 + avgEnergy * 0.2, 0.5] : [0.5, 0.7, 0.5],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
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

  // Fetch stream metadata
  const fetchMetadata = useCallback(async () => {
    try {
      const response = await fetch("/api/metadata")
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
    const metadataInterval = setInterval(fetchMetadata, 10000)
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
        
        audioRef.current.src = STREAM_URL
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
        className="relative z-10 flex items-center justify-between p-4 md:p-6"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-primary/30 shadow-md"
          >
            <img
              src={STATION_LOGO_URL}
              alt={metadata?.name || "Station logo"}
              className="h-full w-full object-cover object-center"
            />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {metadata?.name || "RadioStream"}
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
              className={`rounded-full p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lavaIntensity !== "off" ? "bg-primary/20 text-primary" : "hover:bg-secondary"}`}
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
            className={`rounded-full p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${sleepTimerActive ? "bg-primary/20 text-primary" : "hover:bg-secondary"}`}
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
            className="rounded-full p-3 transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed right-4 top-20 z-[999] rounded-xl bg-card p-4 shadow-2xl md:right-6"
              role="menu"
              aria-label="Sleep timer options"
            >
              <h3 className="mb-3 text-sm font-semibold text-foreground" id="sleep-timer-heading">Sleep Timer</h3>
              <div className="flex flex-col gap-2" role="group" aria-labelledby="sleep-timer-heading">
                {SLEEP_TIMER_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => startSleepTimer(option.value)}
                    className="rounded-lg bg-secondary/50 px-4 py-3 text-sm text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                    role="menuitem"
                    tabIndex={index === 0 ? 0 : -1}
                  >
                    {option.label}
                  </button>
                ))}
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
            className="fixed left-1/2 top-20 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full bg-card/90 px-4 py-2 shadow-lg backdrop-blur-md"
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
          className="relative mb-8 aspect-square w-full max-w-[320px] md:max-w-[400px]"
        >
          <motion.div
            animate={{
              boxShadow: isPlaying
                ? [
                    "0 0 20px rgba(var(--primary), 0.3)",
                    "0 0 60px rgba(var(--primary), 0.2)",
                    "0 0 20px rgba(var(--primary), 0.3)",
                  ]
                : "0 0 20px rgba(0,0,0,0.1)",
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl"
          />
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-secondary/80 shadow-2xl backdrop-blur-sm">
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
                className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent"
              />
            )}
          </div>
        </motion.div>

        {/* Track Info */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 w-full max-w-[400px] text-center"
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

        {/* Playback Controls */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="mb-8 flex items-center justify-center gap-6"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            disabled={isLoading}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg transition-all disabled:opacity-50 md:h-24 md:w-24 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90 touch-manipulation"
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
                  className="h-8 w-8 rounded-full border-4 border-primary-foreground border-t-transparent"
                />
              ) : isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Pause className="h-8 w-8 text-primary-foreground md:h-10 md:w-10" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Play className="ml-1 h-8 w-8 text-primary-foreground md:h-10 md:w-10" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Current Program Card */}
        <AnimatePresence>
          {metadata?.currentProgram && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 w-full max-w-[400px] rounded-2xl bg-card/80 p-4 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10"
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
          className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-card/80 shadow-lg backdrop-blur-md"
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
              className="fixed right-4 top-20 z-[999] w-48 rounded-xl bg-card p-2 shadow-2xl md:right-6"
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
                        : "text-foreground hover:bg-secondary"
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

      {/* Audio Element */}
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
    </div>
  )
}
