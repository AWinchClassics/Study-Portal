import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { ConfirmButton, Modal, FormField } from './TeacherUI'

const PRIORITIES = ['core', 'useful', 'stretch']
const CATEGORIES = ['person', 'event', 'concept', 'source', 'place', 'other']

/**
 * TeacherGlossarySection
 *
 * A reusable glossary management section for teacher pages.
 * Handles attaching/detaching/creating glossary terms at any hierarchy level.
 *
 * Props:
 *   table      — 'chunk_glossary' | 'unit_glossary' | 'module_glossary'
 *   parentId   — the chunk/unit/module UUID
 *   parentKey  — the FK column name: 'chunk_id' | 'unit_id' | 'module_id'
 *   onStatus   — callback(type, msg) for parent status messages
 */
export default function TeacherGlossarySection({ table, parentId, parentKey, onStatus }) {
  const [attached, setAttached]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showAttach, setShowAttach]       = useState(false)
  const [showCreate, setShowCreate]       = useState(false)

  useEffect(() => {
    if (!parentId) return
    supabase
      .from(table)
      .select('id, priority, glossary_id, glossary_terms(id, term, definition, category, date)')
      .eq(parentKey, parentId)
      .then(({ data }) => {
        setAttached(data ?? [])
        setLoading(false)
      })
  }, [table, parentId, parentKey])

  async function handleAttach(glossaryId, priority) {
    if (attached.find(a => a.glossary_id === glossaryId)) {
      onStatus('error', 'Term already attached.'); return
    }
    const { data, error } = await supabase
      .from(table)
      .insert({ [parentKey]: parentId, glossary_id: glossaryId, priority })
      .select('id, priority, glossary_id, glossary_terms(id, term, definition, category, date)')
      .single()
    if (error) { onStatus('error', error.message); return }
    setAttached(prev => [...prev, data])
    setShowAttach(false)
    onStatus('success', 'Term attached.')
  }

  async function handleCreate(form) {
    const { data: newTerm, error: e1 } = await supabase
      .from('glossary_terms')
      .insert({ term: form.term, definition: form.definition, category: form.category })
      .select().single()
    if (e1) { onStatus('error', e1.message); return }
    await handleAttach(newTerm.id, form.priority ?? 'core')
    setShowCreate(false)
  }

  async function handleChangePriority(rowId, priority) {
    await supabase.from(table).update({ priority }).eq('id', rowId)
    setAttached(prev => prev.map(a => a.id === rowId ? { ...a, priority } : a))
  }

  async function handleDetach(rowId) {
    const { error } = await supabase.from(table).delete().eq('id', rowId)
    if (error) { onStatus('error', error.message); return }
    setAttached(prev => prev.filter(a => a.id !== rowId))
  }

  if (loading) return <div className="loading-pulse" style={{ padding: '8px 0' }}>Loading…</div>

  return (
    <>
      <div className="t-section-header" style={{ marginBottom: 12 }}>
        <h2 className="t-section-title" style={{ margin: 0 }}>Glossary terms</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="t-btn t-btn-secondary" onClick={() => setShowAttach(true)}>
            Attach existing
          </button>
          <button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>
            + Create new
          </button>
        </div>
      </div>

      {attached.length === 0 ? (
        <div className="t-empty"><p>No glossary terms attached yet.</p></div>
      ) : (
        <div className="t-attached-list">
          {attached.map(a => (
            <div key={a.id} className="t-attached-row">
              <div className="t-attached-info">
                <span className="t-attached-title">{a.glossary_terms?.term}</span>
                <span className="t-resource-type-pill">{a.glossary_terms?.category}</span>
                {a.glossary_terms?.date && (
                  <span className="t-list-meta">{a.glossary_terms.date}</span>
                )}
                {a.glossary_terms?.definition && (
                  <span className="t-attached-url">
                    {a.glossary_terms.definition.length > 70
                      ? a.glossary_terms.definition.slice(0, 70) + '…'
                      : a.glossary_terms.definition}
                  </span>
                )}
              </div>
              <div className="t-attached-controls">
                <select
                  className="t-purpose-select"
                  value={a.priority ?? 'core'}
                  onChange={e => handleChangePriority(a.id, e.target.value)}
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ConfirmButton
                  className="t-btn t-btn-danger-ghost"
                  onConfirm={() => handleDetach(a.id)}
                  confirmLabel="Remove?"
                >
                  Remove
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAttach && (
        <AttachTermModal
          excludeIds={attached.map(a => a.glossary_id)}
          onAttach={handleAttach}
          onClose={() => setShowAttach(false)}
        />
      )}
      {showCreate && (
        <CreateTermModal
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}

// ── Attach existing term modal ────────────────────────────────────
function AttachTermModal({ excludeIds, onAttach, onClose }) {
  const [terms, setTerms]       = useState([])
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [priority, setPriority] = useState('core')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('glossary_terms').select('id, term, definition, category, date').order('term')
      .then(({ data }) => {
        setTerms((data ?? []).filter(t => !excludeIds.includes(t.id)))
        setLoading(false)
      })
  }, [])

  const filtered = terms.filter(t =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.definition.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal title="Attach a glossary term" onClose={onClose} width={620}>
      <input
        className="t-search-input"
        placeholder="Search terms…"
        value={search}
        autoFocus
        onChange={e => setSearch(e.target.value)}
      />
      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <p className="t-modal-empty">No terms found.</p>
      ) : (
        <div className="t-resource-picker">
          {filtered.map(t => (
            <button
              key={t.id}
              className={`t-resource-pick-row ${selected?.id === t.id ? 't-resource-pick-selected' : ''}`}
              onClick={() => setSelected(t)}
            >
              <span className="t-resource-type-pill">{t.category}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="t-resource-pick-title">
                  {t.term}
                  {t.date && <span style={{ fontWeight: 400, color: 'var(--text)', marginLeft: 6 }}>{t.date}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>
                  {t.definition.length > 80 ? t.definition.slice(0, 80) + '…' : t.definition}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="t-modal-footer">
          <select className="t-purpose-select" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="t-btn t-btn-primary" onClick={() => onAttach(selected.id, priority)}>
            Attach "{selected.term}"
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── Create new term modal ─────────────────────────────────────────
function CreateTermModal({ onSave, onClose }) {
  const [form, setForm]     = useState({ term: '', definition: '', category: 'concept', priority: 'core' })
  const [errors, setErrors] = useState({})

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: null })) }

  function handleSave() {
    const e = {}
    if (!form.term.trim())       e.term       = 'Required'
    if (!form.definition.trim()) e.definition = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...form, term: form.term.trim(), definition: form.definition.trim() })
  }

  return (
    <Modal title="Create new glossary term" onClose={onClose}>
      <div className="t-form">
        <FormField label="Term" error={errors.term}>
          <input className="t-input" autoFocus value={form.term}
            onChange={e => set('term', e.target.value)}
            placeholder="e.g. Cleisthenes" />
        </FormField>
        <FormField label="Definition" error={errors.definition}>
          <textarea className="t-input gl-textarea" rows={3} value={form.definition}
            onChange={e => set('definition', e.target.value)}
            placeholder="The definition…" />
        </FormField>
        <FormField label="Category">
          <select className="t-input" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select className="t-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSave}>Create & attach</button>
        </div>
      </div>
    </Modal>
  )
}
