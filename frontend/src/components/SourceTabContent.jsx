import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// ── Helpers ──────────────────────────────────────────────────────
export function formatRef(s) {
  const parts = []
  if (s.book)    parts.push(String(s.book))
  if (s.chapter) parts.push(String(s.chapter))
  const base = parts.join('.')
  if (s.section) return base ? `${base} (§${s.section})` : s.section
  return base
}

export function groupByAuthorTitle(sources) {
  const map = {}
  sources.forEach(s => {
    const author = s.author?.trim() || 'Unknown'
    const title  = s.title?.trim()  || 'Untitled'
    const key    = `${author}|||${title}`
    if (!map[key]) map[key] = { key, author, title, sources: [] }
    map[key].sources.push(s)
  })
  return Object.values(map).sort((a, b) => a.author.localeCompare(b.author))
}

// ── Single source item ────────────────────────────────────────────
function SourceItem({ source }) {
  const [open, setOpen] = useState(false)
  const ref     = formatRef(source)
  const isImage = !!source.image_url
  const hasText = !!source.content?.trim()

  // Preview: image icon or first 120 chars of text
  const preview = isImage && !hasText
    ? '🖼 Visual source'
    : (source.content?.slice(0, 120) + (source.content?.length > 120 ? '…' : ''))

  return (
    <div className={`src-item ${open ? 'src-item-open' : ''}`}>
      <button className="src-item-row" onClick={() => setOpen(o => !o)}>
        {ref && <span className="src-ref">{ref}</span>}
        <span className={`src-preview ${isImage && !hasText ? 'src-preview-image' : ''}`}>
          {preview}
        </span>
        <span className="src-chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="src-content">
          {/* Image — shown first if present */}
          {isImage && (
            <div className="src-image-wrap">
              <img
                src={source.image_url}
                alt={source.title || 'Source image'}
                className="src-image"
              />
            </div>
          )}

          {/* Text — shown as caption below image, or standalone */}
          {hasText && (
            <p className={`src-full-text ${isImage ? 'src-image-caption' : ''}`}>
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

// ── Source group (author + title) ─────────────────────────────────
export function SourceGroup({ group, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const imageCount = group.sources.filter(s => s.image_url).length
  return (
    <div className="src-group">
      <button className="src-group-header" onClick={() => setOpen(o => !o)}>
        <span className="src-group-chevron">{open ? '▾' : '▸'}</span>
        <span className="src-group-author">{group.author}</span>
        <span className="src-group-dot">·</span>
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
          {group.sources.map(s => <SourceItem key={s.id} source={s} />)}
        </div>
      )}
    </div>
  )
}

// ── Embedded tab ──────────────────────────────────────────────────
export default function SourceTabContent({ chunkIds = [] }) {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const key = chunkIds.slice().sort().join(',')

  useEffect(() => {
    if (chunkIds.length === 0) { setGroups([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('chunk_sources')
      .select('source_id, sources(*)')
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
