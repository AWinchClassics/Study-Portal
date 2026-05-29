import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase'
import { SourceGroup, groupByAuthorTitle, formatRef } from '../components/SourceTabContent'

export default function SourcesPage() {
  const [modules, setModules]       = useState([])
  const [moduleId, setModuleId]     = useState(null)
  const [sources, setSources]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [authorFilter, setAuthorFilter] = useState('all')

  // Load modules that have sources
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

  // Load sources for selected module
  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    setSources([])
    supabase
      .from('sources')
      .select('*')
      .eq('module_id', moduleId)
      .order('author')
      .then(({ data }) => {
        setSources(data ?? [])
        setLoading(false)
      })
  }, [moduleId])

  // Unique authors for filter pills
  const authors = useMemo(() => {
    const set = new Set(sources.map(s => s.author?.trim()).filter(Boolean))
    return [...set].sort()
  }, [sources])

  const filtered = useMemo(() => {
    // Split query into tokens — all tokens must match somewhere in the source
    // e.g. "Herodotus 6.42" → token "herodotus" in author AND "6.42" in reference
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
    return sources.filter(s => {
      const matchAuthor = authorFilter === 'all' || s.author?.trim() === authorFilter
      if (!matchAuthor) return false
      if (tokens.length === 0) return true
      return tokens.every(token =>
        s.author?.toLowerCase().includes(token) ||
        s.title?.toLowerCase().includes(token) ||
        s.content?.toLowerCase().includes(token) ||
        formatRef(s).toLowerCase().includes(token)
      )
    })
  }, [sources, search, authorFilter])

  const groups = useMemo(() => groupByAuthorTitle(filtered), [filtered])

  // Auto-expand groups when searching
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

      {/* Search */}
      <input
        className="src-search"
        placeholder="Search by author, title, reference, or content…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Author filter pills */}
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

      {/* Count */}
      {!loading && (
        <p className="src-results-count">
          {filtered.length === sources.length
            ? `${sources.length} extracts`
            : `${filtered.length} of ${sources.length} extracts`}
        </p>
      )}

      {/* Source list */}
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
