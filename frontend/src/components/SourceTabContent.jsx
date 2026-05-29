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

function groupByAuthorTitle(sources) {
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

// ── Single source expand/collapse ────────────────────────────────
function SourceItem({ source }) {
  const [open, setOpen] = useState(false)
  const ref = formatRef(source)
  const preview = source.content?.slice(0, 120) + (source.content?.length > 120 ? '…' : '')

  return (
    <div className={`src-item ${open ? 'src-item-open' : ''}`}>
      <button className="src-item-row" onClick={() => setOpen(o => !o)}>
        {ref && <span className="src-ref">{ref}</span>}
        <span className="src-preview">{preview}</span>
        <span className="src-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="src-content">
          <p className="src-full-text">{source.content}</p>
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
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="src-group">
      <button className="src-group-header" onClick={() => setOpen(o => !o)}>
        <span className="src-group-chevron">{open ? '▾' : '▸'}</span>
        <span className="src-group-author">{group.author}</span>
        <span className="src-group-dot">·</span>
        <span className="src-group-title">{group.title}</span>
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

/**
 * SourceTabContent
 *
 * Fetches sources attached to the given chunk IDs and renders
 * a grouped, expandable list.
 *
 * Props: chunkIds — array of chunk UUIDs
 */
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

export { SourceGroup, SourceItem, groupByAuthorTitle }
