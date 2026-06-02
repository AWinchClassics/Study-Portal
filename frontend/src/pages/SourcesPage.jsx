import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { SourceGroup, groupByAuthorTitle, formatRef } from '../components/SourceTabContent'

// ── Range-aware token matching (shared with AttachSourceModal) ────
function parseRange(token) {
  // "1.4.1-6"  → book=1, chapter=4, sections 1..6
  const m3 = token.match(/^(\d+)\.(\d+)\.(\d+)-(\d+)$/)
  if (m3) {
    const [, book, chapter, s, e] = m3
    const start = parseInt(s), end = parseInt(e)
    if (end > start && end - start <= 30)
      return { book, chapter, sections: Array.from({ length: end - start + 1 }, (_, i) => String(start + i)) }
  }
  // "1.89-91"  → book=1, chapters 89..91
  const m1 = token.match(/^(\d+)\.(\d+)-(\d+)$/)
  if (m1) {
    const [, book, s, e] = m1
    const start = parseInt(s), end = parseInt(e)
    if (end > start && end - start <= 30)
      return { book, chapters: Array.from({ length: end - start + 1 }, (_, i) => String(start + i)) }
  }
  // "30-31"    → no book, chapters 30..31
  const m2 = token.match(/^(\d+)-(\d+)$/)
  if (m2) {
    const [, s, e] = m2
    const start = parseInt(s), end = parseInt(e)
    if (end > start && end - start <= 30)
      return { book: null, chapters: Array.from({ length: end - start + 1 }, (_, i) => String(start + i)) }
  }
  return null
}

function matchToken(source, token) {
  const range = parseRange(token)
  if (range) {
    const srcBook    = String(source.book    || '').trim()
    const srcChapter = String(source.chapter || '').trim()
    const srcSection = String(source.section || '').trim()

    if (range.sections) {
      // Three-part range: book + chapter must both match, then check section
      if (range.book && srcBook !== range.book) return false
      if (srcChapter !== range.chapter) return false
      if (range.sections.includes(srcSection)) return true
      const secStart = srcSection.match(/^(\d+)/)?.[1]
      return !!(secStart && range.sections.includes(secStart))
    }

    // Two-part range: book (optional) + chapter or section
    const bookMatch = !range.book || srcBook === range.book
    if (!bookMatch) return false
    if (srcChapter && range.chapters.includes(srcChapter)) return true
    if (srcSection && range.chapters.includes(srcSection)) return true
    const secStart = srcSection.match(/^(\d+)/)?.[1]
    return !!(secStart && range.chapters.includes(secStart))
  }
  return (
    source.author?.toLowerCase().includes(token) ||
    source.title?.toLowerCase().includes(token) ||
    formatRef(source).toLowerCase().includes(token) ||
    source.content?.toLowerCase().includes(token)
  )
}

export default function SourcesPage() {
  const [modules, setModules]       = useState([])
  const [moduleId, setModuleId]     = useState(null)
  const [sources, setSources]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [authorFilter, setAuthorFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('sources')
      .select('module_id, modules(id, title)')
      .not('module_id', 'is', null)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set()
        const mods = []
        data.forEach(row => {
          if (row.modules && !seen.has(row.module_id)) {
            seen.add(row.module_id)
            mods.push(row.modules)
          }
        })
        setModules(mods)
        if (mods.length > 0) setModuleId(mods[0].id)
      })
  }, [])

  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    setSources([])
    supabase
      .from('sources')
      .select('*, source_images(id, image_url, order_index)')
      .eq('module_id', moduleId)
      .order('author')
      .then(({ data }) => {
        setSources(data ?? [])
        setLoading(false)
      })
  }, [moduleId])

  const authors = useMemo(() => {
    const set = new Set(sources.map(s => s.author?.trim()).filter(Boolean))
    return [...set].sort()
  }, [sources])

  const filtered = useMemo(() => {
    const tokens = search.replace(/,/g, ' ').toLowerCase().split(/\s+/).filter(Boolean)
    return sources.filter(s => {
      const matchAuthor = authorFilter === 'all' || s.author?.trim() === authorFilter
      if (!matchAuthor) return false
      if (tokens.length === 0) return true
      return tokens.every(token => matchToken(s, token))
    })
  }, [sources, search, authorFilter])

  const groups = useMemo(() => groupByAuthorTitle(filtered), [filtered])
  const defaultOpen = search.length > 0

  return (
    <div className="page src-page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1>Sources</h1>
          {modules.length > 1 && (
            <p className="page-subtitle">
              <select
                className="src-module-select"
                value={moduleId ?? ''}
                onChange={e => setModuleId(e.target.value)}
              >
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </p>
          )}
          {modules.length === 1 && modules[0] && (
            <p className="page-subtitle">{modules[0].title}</p>
          )}
        </div>
        {!loading && (
          <div className="page-header-meta">
            <span className="meta-badge">{sources.length} extracts</span>
          </div>
        )}
      </div>

      <input
        className="src-search"
        placeholder="Search — e.g. Herodotus 6.42  ·  Thucydides, 1.89-91  ·  Persian fleet"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {authors.length > 1 && (
        <div className="src-author-pills">
          <button
            className={`src-author-pill ${authorFilter === 'all' ? 'src-author-active' : ''}`}
            onClick={() => setAuthorFilter('all')}
          >
            All authors
          </button>
          {authors.map(a => (
            <button
              key={a}
              className={`src-author-pill ${authorFilter === a ? 'src-author-active' : ''}`}
              onClick={() => setAuthorFilter(a)}
            >
              {a}
              <span className="src-pill-count">
                {sources.filter(s => s.author?.trim() === a).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && (
        <p className="src-results-count">
          {filtered.length === sources.length
            ? `${sources.length} extracts`
            : `${filtered.length} of ${sources.length} extracts`}
        </p>
      )}

      {loading ? (
        <div className="loading-pulse">Loading sources…</div>
      ) : groups.length === 0 ? (
        <div className="src-empty">
          <span className="src-empty-icon">📜</span>
          <p>{search ? 'No sources match your search.' : 'No sources found.'}</p>
        </div>
      ) : (
        <div className="src-list">
          {groups.map(g => (
            <SourceGroup key={g.key} group={g} defaultOpen={defaultOpen || groups.length === 1} />
          ))}
        </div>
      )}
    </div>
  )
}
