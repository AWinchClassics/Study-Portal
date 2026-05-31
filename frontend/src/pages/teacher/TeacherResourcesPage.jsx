import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

const MEDIA_BUCKETS = { video: 'resource-videos', pdf: 'resource-pdfs' }

async function uploadMedia(file, type) {
  const bucket = MEDIA_BUCKETS[type] ?? 'resource-videos'
  const ext    = file.name.split('.').pop().toLowerCase()
  const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return publicUrl
}

const RESOURCE_TYPES = ['video', 'quiz', 'pdf', 'text', 'audio', 'worksheet', 'task', 'flashcards', 'source']
const TYPE_ICONS = {
  video: '▶', quiz: '❓', pdf: '📄', text: '📝',
  audio: '🎧', worksheet: '📋', task: '✅', flashcards: '🃏', source: '📜',
}

async function fetchHierarchy(moduleId) {
  const { data } = await supabase
    .from('units')
    .select(`
      id, title, order_index,
      chunks(
        id, title, order_index,
        chunk_resources( resources(id, title, type, url, description) )
      )
    `)
    .eq('module_id', moduleId)
    .order('order_index')

  return (data ?? []).map(unit => ({
    ...unit,
    chunks: (unit.chunks ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(chunk => ({
        ...chunk,
        resources: (chunk.chunk_resources ?? []).map(cr => cr.resources).filter(Boolean),
      })),
  }))
}

export default function TeacherResourcesPage() {
  const [modules, setModules]         = useState([])
  const [moduleId, setModuleId]       = useState('all')
  const [units, setUnits]             = useState([])
  const [allResources, setAllResources] = useState([])
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setTypeFilter]   = useState('all')
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState(null)
  const [editingResource, setEditingResource] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('modules').select('id, title, order_index').order('order_index'),
      supabase.from('resources').select('*').order('title'),
    ]).then(([{ data: mods }, { data: res }]) => {
      setModules(mods ?? [])
      setAllResources(res ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (moduleId === 'all') { setUnits([]); return }
    setLoading(true)
    fetchHierarchy(moduleId).then(data => { setUnits(data); setLoading(false) })
  }, [moduleId])

  async function handleCreate(form, videoFile) {
    let url = form.url.trim() || null
    const isUploadable = form.type === 'video' || form.type === 'pdf'
    if (videoFile && isUploadable) {
      try { url = await uploadMedia(videoFile, form.type) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { data, error } = await supabase.from('resources')
      .insert({ title: form.title.trim(), type: form.type, url, description: form.description.trim() || null })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAllResources(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)))
    if (moduleId !== 'all') fetchHierarchy(moduleId).then(setUnits)
    setShowCreateModal(false)
    setStatus({ type: 'success', msg: 'Resource created.' })
  }

  async function handleUpdate(id, form, videoFile) {
    let url = form.url.trim() || null
    const isUploadable = form.type === 'video' || form.type === 'pdf'
    if (videoFile && isUploadable) {
      try { url = await uploadMedia(videoFile, form.type) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { error } = await supabase.from('resources')
      .update({ title: form.title.trim(), type: form.type, url, description: form.description?.trim() || null })
      .eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAllResources(prev => prev.map(r => r.id === id ? { ...r, ...form, url } : r))
    if (moduleId !== 'all') fetchHierarchy(moduleId).then(setUnits)
    setEditingResource(null)
    setStatus({ type: 'success', msg: 'Resource updated.' })
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('resources').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setAllResources(prev => prev.filter(r => r.id !== id))
    if (moduleId !== 'all') fetchHierarchy(moduleId).then(setUnits)
    setStatus({ type: 'success', msg: 'Resource deleted.' })
  }

  const isHierarchyMode = moduleId !== 'all'

  const availableTypes = useMemo(() => {
    const pool = isHierarchyMode
      ? units.flatMap(u => u.chunks.flatMap(c => c.resources))
      : allResources
    const seen = new Set(pool.map(r => r.type?.toLowerCase()).filter(Boolean))
    return ['all', ...RESOURCE_TYPES.filter(t => seen.has(t))]
  }, [units, allResources, isHierarchyMode])

  const filteredUnits = useMemo(() => {
    if (!isHierarchyMode || typeFilter === 'all') return units
    return units.map(u => ({
      ...u,
      chunks: u.chunks.map(c => ({
        ...c,
        resources: c.resources.filter(r => r.type?.toLowerCase() === typeFilter),
      })),
    }))
  }, [units, typeFilter, isHierarchyMode])

  const filteredBank = useMemo(() => allResources.filter(r => {
    const matchType   = typeFilter === 'all' || r.type?.toLowerCase() === typeFilter
    const matchSearch = !search.trim() || r.title.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  }), [allResources, typeFilter, search])

  function countType(t) {
    const pool = isHierarchyMode
      ? units.flatMap(u => u.chunks.flatMap(c => c.resources))
      : allResources
    return pool.filter(r => r.type?.toLowerCase() === t).length
  }

  return (
    <TeacherLayout
      title="Resources"
      actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreateModal(true)}>+ Add resource</button>}
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="t-input" style={{ maxWidth: 320 }} value={moduleId}
          onChange={e => { setModuleId(e.target.value); setTypeFilter('all'); setSearch('') }}>
          <option value="all">All modules (resource bank)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        {!isHierarchyMode && (
          <input className="t-search-input" placeholder="Search…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        )}
      </div>

      {availableTypes.length > 2 && (
        <div className="rp-type-pills" style={{ marginBottom: 16 }}>
          {availableTypes.map(t => (
            <button key={t} className={`rp-type-pill ${typeFilter === t ? 'rp-type-active' : ''}`}
              onClick={() => setTypeFilter(t)}>
              {t === 'all' ? 'All types' : <>{TYPE_ICONS[t]} {t}</>}
              {t !== 'all' && <span className="rp-pill-count">{countType(t)}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="loading-pulse">Loading…</div>
        : isHierarchyMode
          ? <HierarchyView units={filteredUnits} onEdit={setEditingResource} onDelete={handleDelete} />
          : <BankView resources={filteredBank} onEdit={setEditingResource} onDelete={handleDelete} />
      }

      {showCreateModal && <ResourceFormModal title="Add resource" onSave={handleCreate} onClose={() => setShowCreateModal(false)} />}
      {editingResource && <ResourceFormModal title="Edit resource" initial={editingResource}
        onSave={(form, file) => handleUpdate(editingResource.id, form, file)} onClose={() => setEditingResource(null)} />}
    </TeacherLayout>
  )
}

function HierarchyView({ units, onEdit, onDelete }) {
  const total = units.reduce((n, u) => n + u.chunks.reduce((m, c) => m + c.resources.length, 0), 0)
  if (total === 0) return <div className="rp-empty"><span>📦</span><p>No resources match the current filter.</p></div>
  return (
    <div className="rp-units">
      {units.map(unit => {
        const n = unit.chunks.reduce((m, c) => m + c.resources.length, 0)
        if (n === 0) return null
        return <TeacherUnitSection key={unit.id} unit={unit} onEdit={onEdit} onDelete={onDelete} />
      })}
    </div>
  )
}

function TeacherUnitSection({ unit, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(true)
  const total = unit.chunks.reduce((n, c) => n + c.resources.length, 0)
  return (
    <div className="rp-unit-section">
      <button className="rp-unit-header" onClick={() => setExpanded(o => !o)}>
        <span className="rp-unit-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="rp-unit-title">{unit.title}</span>
        <span className="rp-unit-count">{total}</span>
      </button>
      {expanded && (
        <div className="rp-unit-body">
          {unit.chunks.map(chunk => chunk.resources.length > 0 && (
            <div key={chunk.id} className="rp-chunk-section">
              <p className="rp-chunk-label">{chunk.title}</p>
              <div className="rp-chunk-resources">
                {chunk.resources.map(r => (
                  <div key={`${chunk.id}-${r.id}`} className="rp-resource-card">
                    <div className="rp-resource-header">
                      <span className="rp-resource-icon">{TYPE_ICONS[r.type?.toLowerCase()] ?? '📎'}</span>
                      <div className="rp-resource-info">
                        <span className="rp-resource-title">{r.title}</span>
                        {r.description && <span className="rp-resource-desc">{r.description}</span>}
                      </div>
                      <span className="rp-resource-type-pill">{r.type}</span>
                      <div className="rp-teacher-controls">
                        <button className="t-btn t-btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }} onClick={() => onEdit(r)}>Edit</button>
                        <ConfirmButton className="t-btn t-btn-danger-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
                          onConfirm={() => onDelete(r.id)} confirmLabel="Delete?">Delete</ConfirmButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BankView({ resources, onEdit, onDelete }) {
  if (resources.length === 0) return <div className="rp-empty"><span>📦</span><p>No resources found.</p></div>
  return (
    <div className="t-list">
      {resources.map(r => (
        <div key={r.id} className="t-list-row">
          <div className="t-list-row-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{TYPE_ICONS[r.type?.toLowerCase()] ?? '📎'}</span>
              <span className="t-list-title">{r.title}</span>
              <span className="rp-resource-type-pill">{r.type}</span>
            </div>
            {r.description && <p className="t-list-meta" style={{ marginTop: 2 }}>{r.description}</p>}
          </div>
          <div className="t-list-row-actions">
            <button className="t-btn t-btn-ghost" onClick={() => onEdit(r)}>Edit</button>
            <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => onDelete(r.id)} confirmLabel="Delete?">Delete</ConfirmButton>
          </div>
        </div>
      ))}
    </div>
  )
}

function ResourceFormModal({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title: initial?.title ?? '', type: initial?.type ?? 'video',
    url: initial?.url ?? '', description: initial?.description ?? '',
  })
  const [errors, setErrors]       = useState({})
  const [videoMode, setVideoMode] = useState('url')
  const [videoFile, setVideoFile] = useState(null)
  const [saving, setSaving]       = useState(false)

  function set(field, value) { setForm(p => ({ ...p, [field]: value })); setErrors(p => ({ ...p, [field]: null })) }
  function handleFileChange(e) { const f = e.target.files[0]; if (!f) return; setVideoFile(f); set('url', '') }

  const isUploadable = form.type === 'video' || form.type === 'pdf'

  async function handleSubmit() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (isUploadable && videoMode === 'url'    && !form.url.trim()) e.url = 'Enter a URL or upload a file'
    if (isUploadable && videoMode === 'upload' && !videoFile)       e.url = 'Choose a file to upload'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await onSave(form, isUploadable && videoMode === 'upload' ? videoFile : null)
    setSaving(false)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="t-form">
        <FormField label="Title" error={errors.title}>
          <input className="t-input" value={form.title} autoFocus onChange={e => set('title', e.target.value)} />
        </FormField>
        <FormField label="Type">
          <select className="t-input" value={form.type} onChange={e => { set('type', e.target.value); setVideoFile(null) }}>
            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        {isUploadable ? (
          <FormField label={form.type === 'pdf' ? 'PDF source' : 'Video source'} error={errors.url}>
            <div className="vp-teacher-toggle">
              <button type="button" className={`vp-toggle-btn ${videoMode === 'url' ? 'vp-toggle-active' : ''}`}
                onClick={() => { setVideoMode('url'); setVideoFile(null) }}>
                {form.type === 'pdf' ? '🔗 Link (URL)' : '🔗 Link (YouTube / Vimeo / URL)'}
              </button>
              <button type="button" className={`vp-toggle-btn ${videoMode === 'upload' ? 'vp-toggle-active' : ''}`}
                onClick={() => { setVideoMode('upload'); set('url', '') }}>
                📁 Upload file
              </button>
            </div>
            {videoMode === 'url' ? (
              <input className="t-input" style={{ marginTop: 8 }}
                placeholder={form.type === 'pdf' ? 'https://example.com/document.pdf' : 'https://youtube.com/watch?v=…'}
                value={form.url} onChange={e => set('url', e.target.value)} />
            ) : (
              <label className="src-form-upload-label" style={{ marginTop: 8 }}>
                <input type="file" accept={form.type === 'pdf' ? 'application/pdf' : 'video/*'}
                  style={{ display: 'none' }} onChange={handleFileChange} />
                <span className="src-form-upload-btn t-btn t-btn-secondary">
                  {videoFile ? `✓ ${videoFile.name}` : form.type === 'pdf' ? '📁 Choose PDF…' : '📁 Choose video…'}
                </span>
                <span className="src-form-upload-hint">{form.type === 'pdf' ? 'PDF only' : 'MP4, WebM, MOV'}</span>
              </label>
            )}
          </FormField>
        ) : (
          <FormField label="URL / path">
            <input className="t-input" placeholder="https://…" value={form.url} onChange={e => set('url', e.target.value)} />
          </FormField>
        )}
        <FormField label="Description">
          <input className="t-input" placeholder="Optional" value={form.description} onChange={e => set('description', e.target.value)} />
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create resource'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
