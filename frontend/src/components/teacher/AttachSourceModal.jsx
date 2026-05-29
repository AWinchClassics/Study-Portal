import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Modal, FormField } from './TeacherUI'
import { formatRef } from '../SourceTabContent'

/**
 * AttachSourceModal
 *
 * Two-step source attachment:
 *   1. Search by author/title → shows list of matching works
 *   2. Type a reference (e.g. "6.42") → filters to exact extract
 *   3. Confirm to attach
 *
 * Props:
 *   moduleId   — the module to search sources within
 *   excludeIds — source IDs already attached to this chunk
 *   onAttach   — (sourceId) => void
 *   onClose    — () => void
 */
export default function AttachSourceModal({ moduleId, excludeIds = [], onAttach, onClose }) {
  const [allSources, setAllSources]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [titleSearch, setTitleSearch] = useState('')  // step 1: filter by author/title
  const [refQuery, setRefQuery]       = useState('')   // step 2: exact reference
  const [selected, setSelected]       = useState(null) // confirmed source

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

  // Step 1: filter by author/title text
  const titleFiltered = allSources.filter(s => {
    const q = titleSearch.toLowerCase()
    return !q ||
      s.author?.toLowerCase().includes(q) ||
      s.title?.toLowerCase().includes(q)
  })

  // Step 2: filter by exact reference (Book.Chapter)
  function matchesRef(s, query) {
    const q = query.trim()
    if (!q) return true
    const parts = q.split('.')
    if (parts.length >= 2) {
      return String(s.book || '').trim() === parts[0].trim() &&
             String(s.chapter || '').trim() === parts[1].trim()
    }
    // Single value — match chapter or section
    return String(s.chapter || '').trim() === q ||
           String(s.section  || '').trim() === q
  }

  const refFiltered = titleFiltered.filter(s => matchesRef(s, refQuery))

  // Group by author+title for display in step 1
  function uniqueWorks() {
    const seen = new Set()
    return titleFiltered.filter(s => {
      const k = `${s.author?.trim()}|||${s.title?.trim()}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const showResults = refQuery.trim().length > 0 ? refFiltered : []
  const works = uniqueWorks()

  return (
    <Modal title="Attach a source" onClose={onClose} width={640}>
      {loading ? (
        <div className="loading-pulse">Loading sources…</div>
      ) : (
        <div>
          <FormField label="1. Search by author or title">
            <input
              className="t-input"
              autoFocus
              placeholder="e.g. Herodotus, Thucydides, Histories…"
              value={titleSearch}
              onChange={e => { setTitleSearch(e.target.value); setRefQuery(''); setSelected(null) }}
            />
          </FormField>

          {/* Show matched works as reference guide */}
          {titleSearch && works.length > 0 && (
            <div className="src-attach-works">
              {works.slice(0, 6).map(s => (
                <span key={`${s.author}${s.title}`} className="src-attach-work-pill">
                  {s.author?.trim()} · {s.title?.trim()}
                </span>
              ))}
              {works.length > 6 && <span className="src-attach-work-pill">+{works.length - 6} more</span>}
            </div>
          )}

          <FormField label="2. Enter reference (e.g. 6.42 for Book 6, Chapter 42)">
            <input
              className="t-input"
              placeholder="e.g. 6.42 or 61-71"
              value={refQuery}
              onChange={e => { setRefQuery(e.target.value); setSelected(null) }}
            />
          </FormField>

          {/* Results */}
          {refQuery.trim() && (
            <div className="src-attach-results">
              {showResults.length === 0 ? (
                <p className="src-attach-no-match">
                  No source matches <strong>{refQuery}</strong>
                  {titleSearch ? ` in "${titleSearch}"` : ''}.
                </p>
              ) : (
                <>
                  <p className="src-attach-match-label">
                    {showResults.length} match{showResults.length !== 1 ? 'es' : ''}
                  </p>
                  {showResults.map(s => (
                    <button
                      key={s.id}
                      className={`src-attach-result-row ${selected?.id === s.id ? 'src-attach-selected' : ''}`}
                      onClick={() => setSelected(s)}
                    >
                      <div className="src-attach-result-header">
                        <span className="src-attach-result-author">{s.author}</span>
                        <span className="src-attach-result-title">{s.title}</span>
                        <span className="src-ref">{formatRef(s)}</span>
                      </div>
                      <p className="src-attach-result-preview">
                        {s.content?.slice(0, 150)}{s.content?.length > 150 ? '…' : ''}
                      </p>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="t-modal-footer">
            <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="t-btn t-btn-primary"
              onClick={() => selected && onAttach(selected.id)}
              disabled={!selected}
            >
              Attach {selected ? `"${formatRef(selected) || selected.title}"` : ''}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
