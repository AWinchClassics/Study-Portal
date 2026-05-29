import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../supabase'
import { Modal } from './TeacherUI'
import { formatRef } from '../SourceTabContent'

/**
 * AttachSourceModal
 *
 * Single search bar — same token-based AND matching as the student Sources page.
 * e.g. "Herodotus 6.42", "Thucydides 1.70", "Persian fleet"
 */
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
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return allSources.filter(s =>
      tokens.every(token =>
        s.author?.toLowerCase().includes(token) ||
        s.title?.toLowerCase().includes(token) ||
        s.content?.toLowerCase().includes(token) ||
        formatRef(s).toLowerCase().includes(token)
      )
    )
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
            placeholder="Search — e.g. Herodotus 6.42, Persian fleet, Thucydides…"
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
            <div className="src-attach-results" style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}>
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
