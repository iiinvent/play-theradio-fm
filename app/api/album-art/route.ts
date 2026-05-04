import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const artist = searchParams.get("artist") || ""
  const track = searchParams.get("track") || ""

  if (!artist && !track) {
    return NextResponse.json({ artworkUrl: null })
  }

  try {
    // Search iTunes API for album artwork
    const searchQuery = encodeURIComponent(`${artist} ${track}`.trim())
    const response = await fetch(
      `https://itunes.apple.com/search?term=${searchQuery}&media=music&limit=1`
    )

    if (!response.ok) {
      return NextResponse.json({ artworkUrl: null })
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      // Get higher resolution artwork (replace 100x100 with 600x600)
      const artworkUrl = data.results[0].artworkUrl100?.replace(
        "100x100bb",
        "600x600bb"
      )
      return NextResponse.json({
        artworkUrl,
        artistName: data.results[0].artistName,
        trackName: data.results[0].trackName,
        collectionName: data.results[0].collectionName,
      })
    }

    return NextResponse.json({ artworkUrl: null })
  } catch (error) {
    console.error("Error fetching album art:", error)
    return NextResponse.json({ artworkUrl: null })
  }
}
