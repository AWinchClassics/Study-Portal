import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

const PURPOSES = ['core', 'homework', 'revision', 'extension']
const RESOURCE_TYPES = ['video', 'quiz', 'pdf', 'text', 'audio', 'worksheet', 'task', 'flashcards', 'source']

export default function TeacherChunkPage() {
  const { chunkId } = useParams()
  const navigate = useNavigate()

  const [chunk, setChunk] = useState(null)
  const [unit, setUnit] = useState(null)
  const [attached, setAttached] = useState([])   // chunk_resources rows with resources joined
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => { fetchData() }, [chunkId])

  async function fetchData() {
    const { data: chunkData } = await supabase
      .from('chunks')
      .select('*, units(id, title, module_id, modules(id, title))')
      .eq('id', chunkId)
      .single()

    if (chunkData) {
      setChunk(chunkData)
      setUnit(chunkData.units)
    }

    const { data: crData } = await supabase
      .from('chunk_resources')
      .select('id, purpose, order_index, resource_id, resources(*)')
      .eq('chunk_id', chunkId)
      .order('order_index')

    if (crData) setAttached(crData)
    setLoading(false)
  }

  async function handleDetach(crId) {
    const { error } = await supabase.from('chunk_resources').delete().eq('id', crId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttached(prev => prev.filter(r => r.id !== crId))
  }

  async function handleChangePurpose(crId, purpose) {
    const { error } = await supabase.from('chunk_resources').update({ purpose }).eq('id', crId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttached(prev => prev.map(r => r.id === crId ? { ...r, purpose } : r))
  }

  async function handleMoveAttached(crId, direction) {
    const idx = attached.findIndex(r => r.id === crId)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= attached.length) return
    const updated = [...attached]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    updated.forEach((r, i) => { r.order_index = i })
    setAttached(updated)
    await Promise.all(
      updated.map(r => supabase.from('chunk_resources').update({ order_index: r.order_index }).eq('id', r.id))
    )
  }

  async function handleAttach(resourceId, purpose) {
    // Prevent duplicates
    if (attached.find(r => r.resource_id === resourceId)) {
      setStatus({ type: 'error', msg: 'This resource is already attached to this chunk.' })
      return
    }
    const { data, error } = await supabase
      .from('chunk_resources')
      .insert({ chunk_id: chunkId, resource_id: resourceId, purpose, order_index: attached.length })
      .select('id, purpose, order_index, resource_id, resources(*)')
      .single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAttached(prev => [...prev, data])
    setShowAttachModal(false)
    setStatus({ type: 'success', msg: 'Resource attached.' })
  }

  async function handleCreateAndAttach(resource) {
    const { data: newResource, error: resError } = await supabase
      .from('resources')
      .insert(resource)
      .select()
      .single()
    if (resError) { setStatus({ type: 'error', msg: resError.message }); return }
    await handleAttach(newResource.id, resource.purpose ?? 'core')
    setShowCreateModal(false)
    setStatus({ type: 'success', msg: 'Resource created and attached.' })
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
        <p className="t-chunk-path">
          {unit?.modules?.title} › {unit?.title} › {chunk?.title}
        </p>
        {chunk?.description && <p className="t-chunk-desc">{chunk.description}</p>}
      </div>

      <div className="t-section">
        <div className="t-section-header">
          <h2 className="t-section-title">Attached resources</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="t-btn t-btn-secondary" onClick={() => setShowAttachModal(true)}>
              Attach existing
            </button>
            <button className="t-btn t-btn-primary" onClick={() => setShowCreateModal(true)}>
              + Create new
            </button>
          </div>
        </div>

        {attached.length === 0 ? (
          <div className="t-empty">
            <p>No resources attached yet.</p>
          </div>
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
                  {cr.resources?.url && (
                    <span className="t-attached-url" title={cr.resources.url}>
                      {cr.resources.url.length > 50
                        ? cr.resources.url.slice(0, 50) + '…'
                        : cr.resources.url}
                    </span>
                  )}
                </div>

                <div className="t-attached-controls">
                  <select
                    className="t-purpose-select"
                    value={cr.purpose ?? 'core'}
                    onChange={e => handleChangePurpose(cr.id, e.target.value)}
                  >
                    {PURPOSES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>

                  <ConfirmButton
                    className="t-btn t-btn-danger-ghost"
                    onConfirm={() => handleDetach(cr.id)}
                    confirmLabel="Remove?"
                  >
                    Remove
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attach existing resource modal */}
      {showAttachModal && (
        <AttachResourceModal
          excludeIds={attached.map(r => r.resource_id)}
          onAttach={handleAttach}
          onClose={() => setShowAttachModal(false)}
        />
      )}

      {/* Create new resource modal */}
      {showCreateModal && (
        <CreateResourceModal
          onSave={handleCreateAndAttach}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </TeacherLayout>
  )
}

/* ─────────────────────────────────────────
   Attach existing resource modal
───────────────────────────────────────── */
function AttachResourceModal({ excludeIds, onAttach, onClose }) {
  const [resources, setResources] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [purpose, setPurpose] = useState('core')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('resources')
      .select('id, title, type, url')
      .order('title')
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
      <input
        className="t-search-input"
        placeholder="Search by title or type…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      {loading ? (
        <div className="loading-pulse">Loading resources…</div>
      ) : filtered.length === 0 ? (
        <p className="t-modal-empty">No matching resources found.</p>
      ) : (
        <div className="t-resource-picker">
          {filtered.map(r => (
            <button
              key={r.id}
              className={`t-resource-pick-row ${selected?.id === r.id ? 't-resource-pick-selected' : ''}`}
              onClick={() => setSelected(r)}
            >
              <span className="t-resource-type-pill">{r.type}</span>
              <span className="t-resource-pick-title">{r.title}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="t-modal-footer">
          <select
            className="t-purpose-select"
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
          >
            {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            className="t-btn t-btn-primary"
            onClick={() => onAttach(selected.id, purpose)}
          >
            Attach "{selected.title}"
          </button>
        </div>
      )}
    </Modal>
  )
}

/* ─────────────────────────────────────────
   Create new resource modal
───────────────────────────────────────── */
function CreateResourceModal({ onSave, onClose }) {
  const [form, setForm] = useState({ title: '', type: 'video', url: '', description: '', purpose: 'core' })
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: null }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.type) e.type = 'Type is required'
    return e
  }

  function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...form, title: form.title.trim(), url: form.url.trim() || null })
  }

  return (
    <Modal title="Create new resource" onClose={onClose} width={560}>
      <div className="t-form">
        <FormField label="Title" error={errors.title}>
          <input
            className="t-input"
            placeholder="e.g. Athens and Attica Quiz"
            value={form.title}
            autoFocus
            onChange={e => set('title', e.target.value)}
          />
        </FormField>

        <FormField label="Type" error={errors.type}>
          <select className="t-input" value={form.type} onChange={e => set('type', e.target.value)}>
            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>

        <FormField label="URL / path" error={errors.url}>
          <input
            className="t-input"
            placeholder="https://… or /quizzes/athens/…"
            value={form.url}
            onChange={e => set('url', e.target.value)}
          />
        </FormField>

        <FormField label="Description">
          <input
            className="t-input"
            placeholder="Optional short description"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
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
