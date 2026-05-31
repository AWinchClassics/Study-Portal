import { useState } from 'react'

// ── URL detection ─────────────────────────────────────────────────
function detectVideo(url) {
  if (!url) return null

  // YouTube — watch URLs and short youtu.be links
  const yt = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([^&\s?#]+)/)
  if (yt) return { type: 'youtube', id: yt[1] }

  // Vimeo
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return { type: 'vimeo', id: vi[1] }

  // Everything else treated as a direct video file (uploaded Supabase URL, .mp4, etc.)
  return { type: 'direct' }
}

// ── Player ────────────────────────────────────────────────────────
export default function VideoPlayer({ url, title }) {
  const video = detectVideo(url)
  if (!video) return null

  if (video.type === 'youtube') {
    return (
      <div className="vp-wrap">
        <iframe
          className="vp-iframe"
          src={`https://www.youtube.com/embed/${video.id}`}
          title={title || 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (video.type === 'vimeo') {
    return (
      <div className="vp-wrap">
        <iframe
          className="vp-iframe"
          src={`https://player.vimeo.com/video/${video.id}`}
          title={title || 'Video'}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // Direct / uploaded
  return (
    <div className="vp-direct-wrap">
      <video
        className="vp-direct"
        controls
        src={url}
        title={title || 'Video'}
      >
        Your browser does not support video playback.
      </video>
    </div>
  )
}
