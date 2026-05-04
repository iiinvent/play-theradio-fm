import { NextResponse } from "next/server"

const STREAM_URL = "https://servidor36-2.brlogic.com:7064/live"

// BRLogic/WebRadioSite API endpoints (from the embed widget)
const PLAYER_INFO_URL = "https://public-player-widget.webradiosite.com/app/player/info/253448?hash=563c560d12bc696e95ec8acf1afcd60a810016ab"
const STATUS_URL = "https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7064/c5f885b75a1075c9fba1960e4cf86fe7/SV7BR"
const SONG_COVER_URL = "https://brlogic-api.minhawebradio.net/api/streaming/song-cover"
const COVER_BASE_URL = "https://public-rf-song-cover.minhawebradio.net/"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PlayerInfo {
  radioName?: string
  customerUrl?: string
  customerLogo?: string
  streamingUrl?: string
  nextSchedules?: Record<string, {
    id: string
    start: number
    end: number
    program_info?: {
      program_id: string
      program_name: string
      program_image: string
      broadcaster_id: string
      broadcaster_name: string
      broadcaster_image: string
      start_time: string
      end_time: string
    }
  }>
  assetUrls?: {
    upload?: string
    cover?: string
  }
}

interface StreamStatus {
  isMobile?: boolean
  streamingStatus?: number
  streamingType?: string
  currentTrack?: string
}

interface SongCover {
  success?: boolean
  cover?: string
}

async function fetchPlayerInfo(): Promise<PlayerInfo | null> {
  try {
    const response = await fetch(PLAYER_INFO_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    
    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Fallback
  }
  return null
}

async function fetchStreamStatus(): Promise<StreamStatus | null> {
  try {
    const response = await fetch(STATUS_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    
    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Fallback
  }
  return null
}

async function fetchSongCover(trackName: string): Promise<string | null> {
  if (!trackName) return null
  
  try {
    const today = new Date().toISOString().split("T")[0]
    const url = `${SONG_COVER_URL}?q=${encodeURIComponent(trackName)}&base-date=${today}&hash=d58c50320d789f14c139cae9bfadc9a430a9f6fa`
    
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    })
    
    if (response.ok) {
      const data: SongCover = await response.json()
      if (data.success && data.cover) {
        return `${COVER_BASE_URL}${data.cover}`
      }
    }
  } catch {
    // Fallback silently
  }
  return null
}

function getCurrentProgram(schedules: PlayerInfo["nextSchedules"]): {
  name: string
  broadcaster: string
  image: string
} | null {
  if (!schedules) return null
  
  const now = new Date()
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  
  for (const schedule of Object.values(schedules)) {
    if (schedule.start <= secondsSinceMidnight && schedule.end >= secondsSinceMidnight) {
      if (schedule.program_info) {
        return {
          name: schedule.program_info.program_name,
          broadcaster: schedule.program_info.broadcaster_name,
          image: schedule.program_info.program_image,
        }
      }
    }
  }
  
  return null
}

export async function GET() {
  try {
    // Fetch player info and stream status in parallel
    const [playerInfo, streamStatus] = await Promise.all([
      fetchPlayerInfo(),
      fetchStreamStatus(),
    ])

    const currentTrack = streamStatus?.currentTrack || ""
    
    // Fetch song cover if we have a track name
    const songCover = await fetchSongCover(currentTrack)
    
    // Get current program from schedule
    const currentProgram = getCurrentProgram(playerInfo?.nextSchedules)

    // Also fetch ICY headers for additional info
    let icyData: Record<string, string> = {}
    try {
      const streamResponse = await fetch(STREAM_URL, {
        headers: {
          "Icy-MetaData": "1",
          "User-Agent": "Mozilla/5.0",
        },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      })
      
      streamResponse.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith("icy-") || key.toLowerCase() === "content-type" || key.toLowerCase() === "server") {
          icyData[key.toLowerCase()] = value
        }
      })
    } catch {
      // ICY headers are supplementary
    }

    return NextResponse.json({
      // Station info
      name: playerInfo?.radioName || icyData["icy-name"] || "Internet Radio",
      description: icyData["icy-description"] || "",
      genre: icyData["icy-genre"] || "Various",
      url: playerInfo?.customerUrl || icyData["icy-url"] || "",
      
      // Stream info
      streamUrl: playerInfo?.streamingUrl || STREAM_URL,
      contentType: streamStatus?.streamingType || icyData["content-type"] || "audio/mpeg",
      bitrate: icyData["icy-br"] || "128",
      sampleRate: icyData["icy-sr"] || "",
      metaInterval: icyData["icy-metaint"] || "",
      server: icyData["server"] || "",
      
      // Current playback
      currentTrack,
      albumArt: songCover,
      isLive: streamStatus?.streamingStatus === 1,
      
      // Current program
      currentProgram: currentProgram ? {
        name: currentProgram.name,
        broadcaster: currentProgram.broadcaster,
        image: currentProgram.image ? `${playerInfo?.assetUrls?.upload || ""}${currentProgram.image}` : null,
      } : null,
      
      // Station branding
      stationLogo: playerInfo?.customerLogo
        ? `${playerInfo?.assetUrls?.upload || ""}${playerInfo.customerLogo}`
        : null,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    })
  } catch (error) {
    console.error("Error fetching metadata:", error)
    return NextResponse.json(
      {
        name: "theradio.fm",
        description: "Live streaming radio",
        genre: "Various",
        bitrate: "128",
        contentType: "audio/mpeg",
        streamUrl: STREAM_URL,
        currentTrack: "",
        albumArt: null,
        isLive: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    )
  }
}
