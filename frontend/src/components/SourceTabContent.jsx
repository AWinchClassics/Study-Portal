import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// ── Helpers ──────────────────────────────────────────────────────
export function formatRef(s) {
  const parts = []
  if (s.book)    parts.push(String(s.book).trim())
  if (s.chapter) parts.push(String(s.chapter).trim())
  if (s.section) parts.push(String(s.section).trim())
  return parts.join('.')
}

function parseRefNums(s) {
  return [
    parseInt(String(s.book    || 0)),
    parseInt(String(s.chapter || 0)),
    parseInt(String(s.section || '0').match(/\d+/)?.[0] || 0),
  ]
}

function groupByAuthorTitle(sources) {
  const map = {}
  sources.forEach(s => {
    const author = s.author?.trim() || ''
    const title  = s.title?.trim()  || ''
    const key    = `${author}|||${title}`
    if (!map[key]) map[key] = { key, author, title, sources: [] }
    map[key].sources.push(s)
  })
  return Object.values(map)
    .sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    .map(group => ({
      ...group,
      sources: [...group.sources].sort((a, b) => {
        const [ab, ac, as_] = parseRefNums(a)
        const [bb, bc, bs]  = parseRefNums(b)
        return ab - bb || ac - bc || as_ - bs
      }),
    }))
}

// ── Image slideshow ──────────────────────────────────────────────
function ImageSlideshow({ images }) {
  const [idx, setIdx] = useState(0)
  if (images.length === 0) return null
  if (images.length === 1) {
    return (
      <div className="src-image-wrap">
        <img src={images[0]} alt="" className="src-image" />
      </div>
    )
  }
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length)
  const next = () => setIdx(i => (i + 1) % images.length)
  return (
    <div className="src-slideshow">
      <img src={images[idx]} alt={`Image ${idx + 1} of ${images.length}`} className="src-image" />
      <div className="src-slideshow-controls">
        <button className="src-slideshow-btn" onClick={prev}>‹</button>
        <div className="src-slideshow-dots">
          {images.map((_, i) => (
            <button key={i} className={`src-slideshow-dot ${i === idx ? 'src-slideshow-dot-active' : ''}`}
              onClick={() => setIdx(i)} />
          ))}
        </div>
        <button className="src-slideshow-btn" onClick={next}>›</button>
      </div>
      <p className="src-slideshow-counter">{idx + 1} / {images.length}</p>
    </div>
  )
}

// ── Single source expand/collapse ────────────────────────────────
function SourceItem({ source, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const ref = formatRef(source)

  const images = (() => {
    const sorted = (source.source_images ?? [])
      .slice().sort((a, b) => a.order_index - b.order_index)
      .map(si => si.image_url)
    if (source.image_url && !sorted.includes(source.image_url))
      return [source.image_url, ...sorted]
    return sorted
  })()

  const hasImages = images.length > 0
  const hasText   = !!source.content?.trim()

  const preview = hasImages && !hasText
    ? `🖼 ${images.length > 1 ? images.length + ' images' : 'Visual source'}`
    : (source.content?.slice(0, 120) + (source.content?.length > 120 ? '…' : ''))

  return (
    <div className={`src-item ${open ? 'src-item-open' : ''}`}>
      <button className="src-item-row" onClick={() => setOpen(o => !o)}>
        {ref && <span className="src-ref">{ref}</span>}
        <span className={`src-preview ${hasImages && !hasText ? 'src-preview-image' : ''}`}>
          {preview}
        </span>
        <span className="src-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="src-content">
          {hasImages && <ImageSlideshow images={images} />}
          {hasText && (
            <p className={`src-full-text ${hasImages ? 'src-image-caption' : ''}`}>
              {source.content}
            </p>
          )}
          <div className="src-footer">
            {source.copyright && <span className="src-copyright">{source.copyright}</span>}
            {source.source_url && (
              <a href={source.source_url} target="_blank" rel="noreferrer" className="src-link">
                View source ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group (author + title) ────────────────────────────────────────
function SourceGroup({ group, defaultOpen = false }) {
  const isSingle    = group.sources.length === 1
  const imageCount  = group.sources.filter(s => s.image_url).length
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="src-group">
      <button className="src-group-header" onClick={() => setOpen(o => !o)}>
        <span className="src-group-chevron">{open ? '▾' : '▸'}</span>
        <span className="src-group-author">{group.author}</span>
        {(group.author && group.title) && <span className="src-group-dot">·</span>}
        <span className="src-group-title">{group.title}</span>
        {imageCount > 0 && (
          <span className="src-group-img-badge" title={`${imageCount} visual source${imageCount > 1 ? 's' : ''}`}>
            🖼 {imageCount}
          </span>
        )}
        <span className="src-group-count">{group.sources.length}</span>
      </button>
      {open && (
        <div className="src-group-items">
          {group.sources.map(s => <SourceItem key={s.id} source={s} defaultOpen={isSingle} />)}
        </div>
      )}
    </div>
  )
}

/**
 * SourceTabContent
 *
 * Two modes:
 *   moduleId  — full module bank (UnitPage / module-level tab)
 *   chunkIds  — only sources attached to those chunks (unit/chunk-level tabs)
 */
export default function SourceTabContent({ chunkIds = [], moduleId = null }) {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)

  const key = moduleId ?? chunkIds.slice().sort().join(',')

  useEffect(() => {
    setLoading(true)

    if (moduleId) {
      supabase
        .from('sources')
        .select('*, source_images(id, image_url, order_index)')
        .eq('module_id', moduleId)
        .order('author')
        .then(({ data }) => {
          setGroups(groupByAuthorTitle(data ?? []))
          setLoading(false)
        })
      return
    }

    if (chunkIds.length === 0) { setGroups([]); setLoading(false); return }

    supabase
      .from('chunk_sources')
      .select('source_id, sources(*, source_images(id, image_url, order_index))')
      .in('chunk_id', chunkIds)
      .then(({ data }) => {
        const seen = new Set()
        const unique = []
        ;(data ?? []).forEach(row => {
          if (row.sources && !seen.has(row.sources.id)) {
            seen.add(row.sources.id)
            unique.push(row.sources)
          }
        })
        setGroups(groupByAuthorTitle(unique))
        setLoading(false)
      })
  }, [key])

  if (loading) return <div className="loading-pulse" style={{ padding: '24px 0' }}>Loading sources…</div>

  if (groups.length === 0) return (
    <div className="src-empty">
      <span className="src-empty-icon">📜</span>
      <p>No sources have been attached to this content yet.</p>
    </div>
  )

  return (
    <div className="src-list">
      {groups.map(g => <SourceGroup key={g.key} group={g} defaultOpen={groups.length === 1} />)}
    </div>
  )
}

export { SourceGroup, SourceItem, groupByAuthorTitle }
