import { NextRequest, NextResponse } from "next/server"

const ALLOWED_DOMAINS = [
  "public-rf-song-cover.minhawebradio.net",
  "public-rf-upload.minhawebradio.net",
]

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  try {
    const parsedUrl = new URL(url)
    
    // Validate domain
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return new NextResponse("Domain not allowed", { status: 403 })
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://public-player-widget.webradiosite.com/",
        "Origin": "https://public-player-widget.webradiosite.com",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    })

    if (!response.ok) {
      return new NextResponse("Failed to fetch image", { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Image proxy error:", error)
    return new NextResponse("Failed to proxy image", { status: 500 })
  }
}
