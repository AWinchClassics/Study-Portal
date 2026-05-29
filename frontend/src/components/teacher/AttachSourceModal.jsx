import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../supabase'
import { Modal } from './TeacherUI'
import { formatRef } from '../SourceTabContent'

// ── Range-aware token matching ────────────────────────────────────
// Parses "1.89-91" into { book: "1", chapters: ["89","90","91"] }
// Returns null for plain tokens
function parseRange(token) {
  const m = token.match(/^(\d+)\.(\d+)-(\d+)$/)
  if (!m) return null
  const [, book, s, e] = m
  const start = parseInt(s), end = parseInt(e)
  // Only expand genuinely sequential ranges (same-century chapters, max 30 at once)
  if (end <= start || end - start > 30) return null
  const chapters = Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
  return { book, chapters }
}

function matchToken(source, token) {
  const range = parseRange(token)
  if (range) {
    return String(source.book    || '').trim() === range.book &&
           range.chapters.includes(String(source.chapter || '').trim())
  }
  return (
    source.author?.toLowerCase().includes(token) ||
    source.title?.toLowerCase().includes(token) ||
    formatRef(source).toLowerCase().includes(token) ||
    source.content?.toLowerCase().includes(token)
  )
}

export default function AttachSourceModal({ moduleId, excludeIds = [], onAttach, onClose }) {
  const [allSources, setAllSources] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)

  useEffect(() => {
    if (!moduleId) return
    supabase.from('sources').select('*')
      .eq('module_id', moduleId)
      .order('author')
      .then(({ data }) => {
        setAllSources((data ?? []).filter(s => !excludeIds.includes(s.id)))
        setLoading(false)
      })
  }, [moduleId])

  const results = useMemo(() => {
    // Strip commas ("Thucydides, 1.89-91" → ["thucydides", "1.89-91"])
    const tokens = search.replace(/,/g, ' ').toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return allSources.filter(s => tokens.every(token => matchToken(s, token)))
  }, [allSources, search])

  return (
    <Modal title="Attach a source" onClose={onClose} width={600}>
      {loading ? (
        <div className="loading-pulse">Loading sources…</div>
      ) : (
        <div>
          <input
            className="t-input"
            autoFocus
            placeholder="e.g. Herodotus 6.42  ·  Thucydides, 1.89-91  ·  Persian fleet"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
            style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
          />

          {search.trim() && results.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic', margin: '0 0 12px' }}>
              No sources match — try a different term or reference.
            </p>
          )}

          {results.length > 0 && (
            <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map(s => {
                const ref = formatRef(s)
                const isSelected = selected?.id === s.id
                return (
                  <button
                    key={s.id}
                    className={`src-attach-result-row ${isSelected ? 'src-attach-selected' : ''}`}
                    onClick={() => setSelected(isSelected ? null : s)}
                  >
                    <div className="src-attach-result-header">
                      <span className="src-attach-result-author">{s.author}</span>
                      <span className="src-attach-result-title">{s.title}</span>
                      {ref && <span className="src-ref">{ref}</span>}
                    </div>
                    <p className="src-attach-result-preview">
                      {s.content?.slice(0, 160)}{s.content?.length > 160 ? '…' : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          <div className="t-modal-footer">
            <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="t-btn t-btn-primary"
              onClick={() => selected && onAttach(selected.id)}
              disabled={!selected}
            >
              {selected
                ? `Attach "${formatRef(selected) || selected.title || selected.author}"`
                : 'Select a source above'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
