import AttachSourceModal from '../../components/teacher/AttachSourceModal'
import { formatRef } from '../../components/SourceTabContent'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField, DeleteWarningModal } from '../../components/teacher/TeacherUI'

const PURPOSES   = ['core', 'homework', 'revision', 'extension']
const PRIORITIES = ['core', 'useful', 'stretch']
const RESOURCE_TYPES = ['video','quiz','pdf','text','audio','worksheet','task','flashcards','source']
const CATEGORIES = ['person','event','concept','source','place','other']

// ── Shared section component ─────────────────────────────────────
function SectionHeader({ title, children }) {
  return (
    <div className="t-section-header" style={{ marginBottom: 12 }}>
      <h2 className="t-section-title" style={{ margin: 0 }}>{title}</h2>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  )
}

export default function TeacherChunkPage() {
  const { chunkId } = useParams()
  const navigate = useNavigate()

  const [chunk, setChunk]     = useState(null)
  const [unit, setUnit]       = useState(null)
  const [attached, setAttached]   = useState([]) // chunk_resources
  const [glossary, setGlossary]   = useState([]) // chunk_glossary rows
  const [loading, setLoading]     = useState(true)
  const [status, setStatus]       = useState(null)

  // Resource modals
  const [showAttachModal, setShowAttachModal]   = useState(false)
  const [showCreateModal, setShowCreateModal]   = useState(false)
  // Glossary modals
  const [showAttachTerm, setShowAttachTerm]     = useState(false)
  const [showAttachSource, setShowAttachSource] = useState(false)
  const [attachedSources, setAttachedSources]   = useState([])
  const [showCreateTerm, setShowCreateTerm]     = useState(false)

  useEffect(() => { fetchData() }, [chunkId])

  async function fetchData() {
    const { data: chunkData } = await supabase
      .from('chunks')
      .select('*, units(id, title, module_id, modules(id, title))')
      .eq('id', chunkId)
      .single()

    if (chunkData) { setChunk(chunkData); setUnit(chunkData.units) }

    const [{ data: crData }, { data: cgData }, { data: csData }] = await Promise.all([
      supabase.from('chunk_resources')
        .select('id, purpose, order_index, resource_id, resources(*)')
        .eq('chunk_id', chunkId).order('order_index'),
      supabase.from('chunk_glossary')
        .select('id, priority, glossary_id, glossary_terms(*)')
        .eq('chunk_id', chunkId),
      supabase.from('chunk_sources')
        .select('id, source_id, sources(*)')
        .eq('chunk_id', chunkId),
    ])
    if (csData) setAttachedSources(csData)

    if (crData) setAttached(crData)
    if (cgData) setGlossary(cgData)
    setLoading(false)
  }

  // ── Resource handlers ──
  async function handleDetach(crId) {
    const { error } = await supabase.from('chunk_resources').delete().eq('id', crId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttached(prev => prev.filter(r => r.id !== crId))
  }

  async function handleChangePurpose(crId, purpose) {
    await supabase.from('chunk_resources').update({ purpose }).eq('id', crId)
    setAttached(prev => prev.map(r => r.id === crId ? { ...r, purpose } : r))
  }

  async function handleAttachResource(resourceId, purpose) {
    if (attached.find(r => r.resource_id === resourceId)) {
      setStatus({ type: 'error', msg: 'Already attached.' }); return
    }
    const { data, error } = await supabase.from('chunk_resources')
      .insert({ chunk_id: chunkId, resource_id: resourceId, purpose, order_index: attached.length })
      .select('id, purpose, order_index, resource_id, resources(*)').single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttached(prev => [...prev, data])
    setShowAttachModal(false)
    setStatus({ type: 'success', msg: 'Resource attached.' })
  }

  async function handleCreateResource(form) {
    const { data: newRes, error: e1 } = await supabase.from('resources')
      .insert({ title: form.title, type: form.type, url: form.url || null, description: form.description || null })
      .select().single()
    if (e1) { setStatus({ type: 'error', msg: e1.message }); return }
    await handleAttachResource(newRes.id, form.purpose ?? 'core')
    setShowCreateModal(false)
  }

  async function handleMoveAttached(crId, direction) {
    const idx = attached.findIndex(r => r.id === crId)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= attached.length) return
    const updated = [...attached]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    updated.forEach((r, i) => { r.order_index = i })
    setAttached(updated)
    await Promise.all(updated.map(r =>
      supabase.from('chunk_resources').update({ order_index: r.order_index }).eq('id', r.id)
    ))
  }

  // ── Source handlers ──
  async function handleAttachSource(sourceId) {
    const { data, error } = await supabase.from('chunk_sources')
      .insert({ chunk_id: chunkId, source_id: sourceId })
      .select('id, source_id, sources(*)').single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttachedSources(prev => [...prev, data])
    setShowAttachSource(false)
    setStatus({ type: 'success', msg: 'Source attached.' })
  }

  async function handleDetachSource(csId) {
    const { error } = await supabase.from('chunk_sources').delete().eq('id', csId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttachedSources(prev => prev.filter(s => s.id !== csId))
  }

  // ── Glossary handlers ──
  async function handleAttachTerm(glossaryId, priority) {
    if (glossary.find(g => g.glossary_id === glossaryId)) {
      setStatus({ type: 'error', msg: 'Term already attached.' }); return
    }
    const { data, error } = await supabase.from('chunk_glossary')
      .insert({ chunk_id: chunkId, glossary_id: glossaryId, priority })
      .select('id, priority, glossary_id, glossary_terms(*)').single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setGlossary(prev => [...prev, data])
    setShowAttachTerm(false)
    setStatus({ type: 'success', msg: 'Term attached.' })
  }

  async function handleCreateTerm(form) {
    const { data: newTerm, error } = await supabase.from('glossary_terms')
      .insert({ term: form.term, definition: form.definition, category: form.category })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    await handleAttachTerm(newTerm.id, form.priority ?? 'core')
    setShowCreateTerm(false)
  }

  async function handleDetachTerm(cgId) {
    const { error } = await supabase.from('chunk_glossary').delete().eq('id', cgId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setGlossary(prev => prev.filter(g => g.id !== cgId))
  }

  async function handleChangePriority(cgId, priority) {
    await supabase.from('chunk_glossary').update({ priority }).eq('id', cgId)
    setGlossary(prev => prev.map(g => g.id === cgId ? { ...g, priority } : g))
  }

  if (loading) return <div className="page"><div className="loading-pulse">Loading…</div></div>

  return (
    <TeacherLayout
      title={chunk?.title ?? 'Chunk'}
      actions={
        <button className="t-btn t-btn-ghost" onClick={() => navigate(`/teacher/units/${unit?.id}`)}>
          ← {unit?.title ?? 'Unit'}
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      <div className="t-section">
        <p className="t-chunk-path">{unit?.modules?.title} › {unit?.title} › {chunk?.title}</p>
        {chunk?.description && <p className="t-chunk-desc">{chunk.description}</p>}
      </div>

      {/* ── Resources ── */}
      <div className="t-section">
        <SectionHeader title="Attached resources">
          <button className="t-btn t-btn-secondary" onClick={() => setShowAttachModal(true)}>Attach existing</button>
          <button className="t-btn t-btn-primary"   onClick={() => setShowCreateModal(true)}>+ Create new</button>
        </SectionHeader>

        {attached.length === 0 ? (
          <div className="t-empty"><p>No resources attached yet.</p></div>
        ) : (
          <div className="t-attached-list">
            {attached.map((cr, idx) => (
              <div key={cr.id} className="t-attached-row">
                <div className="t-list-row-order">
                  <button className="t-order-btn" onClick={() => handleMoveAttached(cr.id, -1)} disabled={idx === 0}>↑</button>
                  <button className="t-order-btn" onClick={() => handleMoveAttached(cr.id, 1)} disabled={idx === attached.length - 1}>↓</button>
                </div>
                <div className="t-attached-info">
                  <span className="t-attached-title">{cr.resources?.title}</span>
                  <span className="t-resource-type-pill">{cr.resources?.type}</span>
                  {cr.resources?.url && <span className="t-attached-url">{cr.resources.url.length > 50 ? cr.resources.url.slice(0,50)+'…' : cr.resources.url}</span>}
                </div>
                <div className="t-attached-controls">
                  <select className="t-purpose-select" value={cr.purpose ?? 'core'} onChange={e => handleChangePurpose(cr.id, e.target.value)}>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => handleDetach(cr.id)} confirmLabel="Remove?">Remove</ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Glossary ── */}
      <div className="t-section">
        <SectionHeader title="Glossary terms">
          <button className="t-btn t-btn-secondary" onClick={() => setShowAttachTerm(true)}>Attach existing</button>
          <button className="t-btn t-btn-primary"   onClick={() => setShowCreateTerm(true)}>+ Create new</button>
        </SectionHeader>

        {glossary.length === 0 ? (
          <div className="t-empty"><p>No glossary terms attached yet.</p></div>
        ) : (
          <div className="t-attached-list">
            {glossary.map(cg => (
              <div key={cg.id} className="t-attached-row">
                <div className="t-attached-info">
                  <span className="t-attached-title">{cg.glossary_terms?.term}</span>
                  <span className="t-resource-type-pill">{cg.glossary_terms?.category}</span>
                  {cg.glossary_terms?.definition && (
                    <span className="t-attached-url">
                      {cg.glossary_terms.definition.length > 60
                        ? cg.glossary_terms.definition.slice(0, 60) + '…'
                        : cg.glossary_terms.definition}
                    </span>
                  )}
                </div>
                <div className="t-attached-controls">
                  <select
                    className="t-purpose-select"
                    value={cg.priority ?? 'core'}
                    onChange={e => handleChangePriority(cg.id, e.target.value)}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => handleDetachTerm(cg.id)} confirmLabel="Remove?">Remove</ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sources ── */}
      <div className="t-section">
        <div className="t-section-header" style={{ marginBottom: 12 }}>
          <h2 className="t-section-title" style={{ margin: 0 }}>Source extracts</h2>
          <button className="t-btn t-btn-secondary" onClick={() => setShowAttachSource(true)}>
            Attach source
          </button>
        </div>
        {attachedSources.length === 0 ? (
          <div className="t-empty"><p>No sources attached yet.</p></div>
        ) : (
          <div className="t-attached-list">
            {attachedSources.map(cs => (
              <div key={cs.id} className="t-attached-row">
                <div className="t-attached-info">
                  <span className="t-attached-title">{cs.sources?.author}</span>
                  <span className="t-list-meta" style={{ marginLeft: 6, fontStyle: 'italic' }}>{cs.sources?.title}</span>
                  {formatRef(cs.sources ?? {}) && (
                    <span className="t-resource-type-pill" style={{ marginLeft: 8 }}>{formatRef(cs.sources ?? {})}</span>
                  )}
                  {cs.sources?.content && (
                    <span className="t-attached-url">{cs.sources.content.slice(0, 70)}…</span>
                  )}
                </div>
                <div className="t-attached-controls">
                  <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => handleDetachSource(cs.id)} confirmLabel="Remove?">Remove</ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resource modals */}
      {showAttachModal && (
        <AttachResourceModal
          excludeIds={attached.map(r => r.resource_id)}
          onAttach={handleAttachResource}
          onClose={() => setShowAttachModal(false)}
        />
      )}
      {showCreateModal && (
        <CreateResourceModal onSave={handleCreateResource} onClose={() => setShowCreateModal(false)} />
      )}

      {/* Glossary modals */}
      {showAttachTerm && (
        <AttachTermModal
          excludeIds={glossary.map(g => g.glossary_id)}
          onAttach={handleAttachTerm}
          onClose={() => setShowAttachTerm(false)}
        />
      )}
      {showCreateTerm && (
        <CreateTermModal onSave={handleCreateTerm} onClose={() => setShowCreateTerm(false)} />
      )}

      {showAttachSource && (
        <AttachSourceModal
          moduleId={unit?.modules?.id}
          excludeIds={attachedSources.map(cs => cs.source_id)}
          onAttach={handleAttachSource}
          onClose={() => setShowAttachSource(false)}
        />
      )}
      {showDeleteChunk && (
        <DeleteWarningModal
          itemType="chunk"
          itemName={chunk?.title ?? 'this chunk'}
          onConfirm={handleDeleteChunk}
          onClose={() => setShowDeleteChunk(false)}
        />
      )}
    </TeacherLayout>
  )
}

// ── Attach existing resource modal ───────────────────────────────
function AttachResourceModal({ excludeIds, onAttach, onClose }) {
  const [resources, setResources] = useState([])
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [purpose, setPurpose]     = useState('core')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    supabase.from('resources').select('id, title, type, url').order('title')
      .then(({ data }) => {
        setResources((data ?? []).filter(r => !excludeIds.includes(r.id)))
        setLoading(false)
      })
  }, [])

  const filtered = resources.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Modal title="Attach a resource" onClose={onClose} width={600}>
      <input className="t-search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      {loading ? <div className="loading-pulse">Loading…</div> : (
        <div className="t-resource-picker">
          {filtered.map(r => (
            <button key={r.id} className={`t-resource-pick-row ${selected?.id === r.id ? 't-resource-pick-selected' : ''}`} onClick={() => setSelected(r)}>
              <span className="t-resource-type-pill">{r.type}</span>
              <span className="t-resource-pick-title">{r.title}</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="t-modal-footer">
          <select className="t-purpose-select" value={purpose} onChange={e => setPurpose(e.target.value)}>
            {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="t-btn t-btn-primary" onClick={() => onAttach(selected.id, purpose)}>
            Attach "{selected.title}"
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── Create new resource modal ────────────────────────────────────
function CreateResourceModal({ onSave, onClose }) {
  const [form, setForm] = useState({ title: '', type: 'video', url: '', description: '', purpose: 'core' })
  const [errors, setErrors] = useState({})

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: null })) }

  function handleSubmit() {
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return }
    onSave({ ...form, title: form.title.trim(), url: form.url.trim() || null })
  }

  return (
    <Modal title="Create new resource" onClose={onClose}>
      <div className="t-form">
        <FormField label="Title" error={errors.title}>
          <input className="t-input" value={form.title} autoFocus onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormField label="Type">
          <select className="t-input" value={form.type} onChange={e => set('type', e.target.value)}>
            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="URL / path">
          <input className="t-input" placeholder="https://… or /quizzes/…" value={form.url} onChange={e => set('url', e.target.value)} />
        </FormField>
        <FormField label="Description">
          <input className="t-input" value={form.description} onChange={e => set('description', e.target.value)} />
        </FormField>
        <FormField label="Purpose">
          <select className="t-input" value={form.purpose} onChange={e => set('purpose', e.target.value)}>
            {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSubmit}>Create & attach</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Attach existing glossary term modal ──────────────────────────
function AttachTermModal({ excludeIds, onAttach, onClose }) {
  const [terms, setTerms]     = useState([])
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [priority, setPriority] = useState('core')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('glossary_terms').select('id, term, definition, category').order('term')
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
    <Modal title="Attach a glossary term" onClose={onClose} width={600}>
      <input className="t-search-input" placeholder="Search terms…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
      {loading ? <div className="loading-pulse">Loading…</div> : filtered.length === 0 ? (
        <p className="t-modal-empty">No terms found.</p>
      ) : (
        <div className="t-resource-picker">
          {filtered.map(t => (
            <button key={t.id} className={`t-resource-pick-row ${selected?.id === t.id ? 't-resource-pick-selected' : ''}`} onClick={() => setSelected(t)}>
              <span className="t-resource-type-pill">{t.category}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="t-resource-pick-title">{t.term}</div>
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

// ── Create new glossary term modal ───────────────────────────────
function CreateTermModal({ onSave, onClose }) {
  const [form, setForm] = useState({ term: '', definition: '', category: 'concept', priority: 'core' })
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
          <input className="t-input" autoFocus value={form.term} onChange={e => set('term', e.target.value)} placeholder="e.g. Cleisthenes" />
        </FormField>
        <FormField label="Definition" error={errors.definition}>
          <textarea className="t-input gl-textarea" rows={3} value={form.definition} onChange={e => set('definition', e.target.value)} placeholder="The definition…" />
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
