import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

const MEDIA_BUCKETS = {
  video: 'resource-videos',
  pdf:   'resource-pdfs',
}

async function uploadMedia(file, type) {
  const bucket = MEDIA_BUCKETS[type] ?? 'resource-videos'
  const ext    = file.name.split('.').pop().toLowerCase()
  const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path)
  return publicUrl
}

const RESOURCE_TYPES = ['video', 'quiz', 'pdf', 'text', 'audio', 'worksheet', 'task', 'flashcards', 'source']

const TYPE_ICONS = {
  video: '▶', quiz: '❓', pdf: '📄', text: '📝',
  audio: '🎧', worksheet: '📋', task: '✅', flashcards: '🃏', source: '📜',
}

export default function TeacherResourcesPage() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [status, setStatus] = useState(null)
  const [editingResource, setEditingResource] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => { fetchResources() }, [])

  async function fetchResources() {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('title')
    if (!error) setResources(data)
    setLoading(false)
  }

  async function handleCreate(form, videoFile) {
    let url = form.url.trim() || null
    if (videoFile) {
      try { url = await uploadMedia(videoFile, form.type) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { data, error } = await supabase
      .from('resources')
      .insert({ title: form.title.trim(), type: form.type, url, description: form.description.trim() || null })
      .select()
      .single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setResources(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)))
    setShowCreateModal(false)
    setStatus({ type: 'success', msg: 'Resource created.' })
  }

  async function handleUpdate(id, form, videoFile) {
    let url = form.url.trim() || null
    if (videoFile) {
      try { url = await uploadMedia(videoFile, form.type) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { error } = await supabase
      .from('resources')
      .update({ title: form.title.trim(), type: form.type, url, description: form.description?.trim() || null })
      .eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setResources(prev => prev.map(r => r.id === id ? { ...r, ...form } : r))
    setEditingResource(null)
    setStatus({ type: 'success', msg: 'Resource updated.' })
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('resources').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setResources(prev => prev.filter(r => r.id !== id))
    setStatus({ type: 'success', msg: 'Resource deleted.' })
  }

  const filtered = resources.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || r.type === filterType
    return matchSearch && matchType
  })

  return (
    <TeacherLayout
      title="Resource library"
      actions={
        <button className="t-btn t-btn-primary" onClick={() => setShowCreateModal(true)}>
          + New resource
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      {/* Filters */}
      <div className="t-filter-bar">
        <input
          className="t-search-input"
          placeholder="Search resources…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="t-filter-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="t-filter-count">
          {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
        </span>
      </div>

      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="t-empty">
          <p>{search || filterType !== 'all' ? 'No resources match your search.' : 'No resources yet.'}</p>
        </div>
      ) : (
        <div className="t-list">
          {filtered.map(resource => (
            <div key={resource.id} className="t-list-row">
              <div className="t-list-row-main">
                <span className="t-resource-icon">{TYPE_ICONS[resource.type] ?? '📎'}</span>
                <div className="t-resource-info">
                  <span className="t-list-title">{resource.title}</span>
                  {resource.url && (
                    <span className="t-resource-url">{resource.url}</span>
                  )}
                  {resource.description && (
                    <span className="t-list-meta">{resource.description}</span>
                  )}
                </div>
                <span className="t-resource-type-pill">{resource.type}</span>
              </div>
              <div className="t-list-row-actions">
                <button
                  className="t-btn t-btn-ghost"
                  onClick={() => setEditingResource(resource)}
                >
                  Edit
                </button>
                <ConfirmButton
                  className="t-btn t-btn-danger-ghost"
                  onConfirm={() => handleDelete(resource.id)}
                  confirmLabel="Delete?"
                >
                  Delete
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <ResourceFormModal
          title="New resource"
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingResource && (
        <ResourceFormModal
          title="Edit resource"
          initial={editingResource}
          onSave={(form, videoFile) => handleUpdate(editingResource.id, form, videoFile)}
          onClose={() => setEditingResource(null)}
        />
      )}
    </TeacherLayout>
  )
}

function ResourceFormModal({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title:       initial?.title       ?? '',
    type:        initial?.type        ?? 'video',
    url:         initial?.url         ?? '',
    description: initial?.description ?? '',
  })
  const [errors, setErrors]     = useState({})
  const [videoMode, setVideoMode] = useState('url')   // 'url' | 'upload'
  const [videoFile, setVideoFile] = useState(null)
  const [saving, setSaving]       = useState(false)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: null }))
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setVideoFile(file)
    set('url', '')
  }

  const isVideo      = form.type === 'video'
  const isUploadable = form.type === 'video' || form.type === 'pdf'

  async function handleSubmit() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (isUploadable && videoMode === 'url' && !form.url.trim()) e.url = 'Enter a URL or upload a file'
    if (isUploadable && videoMode === 'upload' && !videoFile) e.url = 'Choose a file to upload'
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
              <button type="button"
                className={`vp-toggle-btn ${videoMode === 'url' ? 'vp-toggle-active' : ''}`}
                onClick={() => { setVideoMode('url'); setVideoFile(null) }}>
                {form.type === 'pdf' ? '🔗 Link (URL)' : '🔗 Link (YouTube / Vimeo / URL)'}
              </button>
              <button type="button"
                className={`vp-toggle-btn ${videoMode === 'upload' ? 'vp-toggle-active' : ''}`}
                onClick={() => { setVideoMode('upload'); set('url', '') }}>
                📁 Upload file
              </button>
            </div>
            {videoMode === 'url' ? (
              <input className="t-input" style={{ marginTop: 8 }}
                placeholder={form.type === 'pdf' ? 'https://example.com/document.pdf' : 'https://youtube.com/watch?v=… or https://vimeo.com/…'}
                value={form.url}
                onChange={e => set('url', e.target.value)} />
            ) : (
              <label className="src-form-upload-label" style={{ marginTop: 8 }}>
                <input
                type="file"
                accept={form.type === 'pdf' ? 'application/pdf' : 'video/*'}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
                <span className="src-form-upload-btn t-btn t-btn-secondary">
                  {videoFile ? `✓ ${videoFile.name}` : form.type === 'pdf' ? '📁 Choose PDF file…' : '📁 Choose video file…'}
                </span>
                <span className="src-form-upload-hint">{form.type === 'pdf' ? 'PDF files only' : 'MP4, WebM, MOV'}</span>
              </label>
            )}
          </FormField>
        ) : (
          <FormField label="URL / path">
            <input className="t-input" placeholder="https://… or /quizzes/…"
              value={form.url} onChange={e => set('url', e.target.value)} />
          </FormField>
        )}

        <FormField label="Description">
          <input className="t-input" placeholder="Optional"
            value={form.description} onChange={e => set('description', e.target.value)} />
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
