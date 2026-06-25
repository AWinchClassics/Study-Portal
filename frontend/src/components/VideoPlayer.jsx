import { useState, useEffect, useRef } from 'react'

// ── URL detection ─────────────────────────────────────────────────
function detectVideo(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([^&\s?#]+)/)
  if (yt) return { type: 'youtube', id: yt[1] }
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return { type: 'vimeo', id: vi[1] }
  return { type: 'direct' }
}

/**
 * VideoPlayer
 *
 * Props:
 *   url          — video URL
 *   title        — display title
 *   resourceId   — uuid, used to report completion
 *   isCompleted  — boolean, whether already marked complete
 *   onComplete   — () => void, called when auto-detected as watched (≥80%)
 */
export default function VideoPlayer({ url, title, resourceId, isCompleted, onComplete }) {
  const video    = detectVideo(url)
  const iframeRef = useRef(null)
  const playerRef = useRef(null)
  const reportedRef = useRef(false) // only fire onComplete once per mount

  // ── YouTube API auto-tracking ──────────────────────────────────
  useEffect(() => {
    if (video?.type !== 'youtube' || !resourceId || isCompleted) return

    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    let player
    let pollInterval

    function initPlayer() {
      if (!iframeRef.current) return
      player = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event) => {
            // State 1 = playing — start polling progress
            if (event.data === 1) {
              pollInterval = setInterval(() => {
                if (!player || reportedRef.current) { clearInterval(pollInterval); return }
                try {
                  const duration = player.getDuration()
                  const current  = player.getCurrentTime()
                  if (duration > 0 && current / duration >= 0.8) {
                    reportedRef.current = true
                    clearInterval(pollInterval)
                    onComplete?.()
                  }
                } catch (_) {}
              }, 5000)
            } else {
              clearInterval(pollInterval)
            }
          },
        },
      })
      playerRef.current = player
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        initPlayer()
      }
    }

    return () => {
      clearInterval(pollInterval)
      try { player?.destroy() } catch (_) {}
    }
  }, [video?.id, resourceId, isCompleted])

  if (!video) return null

  // ── YouTube ────────────────────────────────────────────────────
  if (video.type === 'youtube') {
    return (
      <div className="vp-wrap">
        <iframe
          ref={iframeRef}
          className="vp-iframe"
          src={`https://www.youtube.com/embed/${video.id}?enablejsapi=1`}
          title={title || 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // ── Vimeo ──────────────────────────────────────────────────────
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

  // ── Direct / uploaded ──────────────────────────────────────────
  return (
    <div className="vp-direct-wrap">
      <video
        className="vp-direct"
        controls
        src={url}
        title={title || 'Video'}
        onTimeUpdate={(e) => {
          if (reportedRef.current || isCompleted || !resourceId) return
          const { currentTime, duration } = e.target
          if (duration > 0 && currentTime / duration >= 0.8) {
            reportedRef.current = true
            onComplete?.()
          }
        }}
      >
        Your browser does not support video playback.
      </video>
    </div>
  )
}
