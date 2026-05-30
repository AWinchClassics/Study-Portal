import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'
import { formatRef } from '../../components/SourceTabContent'

const BUCKET = 'source-images'

async function uploadImage(file) {
  const ext  = file.name.split('.').pop().toLowerCase()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path)
  return publicUrl
}

async function deleteImage(url) {
  // Extract path from full public URL
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}

export default function TeacherSourcesPage() {
  const [modules, setModules]       = useState([])
  const [moduleId, setModuleId]     = useState(null)
  const [sources, setSources]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [status, setStatus]         = useState(null)
  const [search, setSearch]         = useState('')
  const [authorFilter, setAuthorFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editSource, setEditSource] = useState(null)

  useEffect(() => {
    supabase.from('modules').select('id, title').order('title').then(({ data }) => {
      setModules(data ?? [])
      if (data?.length > 0) setModuleId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    supabase.from('sources').select('*').eq('module_id', moduleId).order('author').then(({ data }) => {
      setSources(data ?? [])
      setLoading(false)
    })
  }, [moduleId])

  async function handleCreate(form, imageFile) {
    let imageUrl = form.image_url || null
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { data, error } = await supabase.from('sources')
      .insert({ ...form, image_url: imageUrl, module_id: moduleId })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => [...prev, data].sort((a, b) => a.author.localeCompare(b.author)))
    setShowCreate(false)
    setStatus({ type: 'success', msg: 'Source created.' })
  }

  async function handleUpdate(id, form, imageFile, removeImage) {
    let imageUrl = form.image_url || null
    // Remove existing image from storage
    if (removeImage && form.image_url) {
      await deleteImage(form.image_url)
      imageUrl = null
    }
    // Upload new image
    if (imageFile) {
      if (form.image_url && !removeImage) await deleteImage(form.image_url)
      try { imageUrl = await uploadImage(imageFile) }
      catch (e) { setStatus({ type: 'error', msg: e.message }); return }
    }
    const { error } = await supabase.from('sources')
      .update({ ...form, image_url: imageUrl })
      .eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...form, image_url: imageUrl } : s))
    setEditSource(null)
    setStatus({ type: 'success', msg: 'Source updated.' })
  }

  async function handleDelete(source) {
    if (source.image_url) await deleteImage(source.image_url)
    const { error } = await supabase.from('sources').delete().eq('id', source.id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => prev.filter(s => s.id !== source.id))
    setStatus({ type: 'success', msg: 'Source deleted.' })
  }

  const authors  = [...new Set(sources.map(s => s.author?.trim()).filter(Boolean))].sort()
  const filtered = sources.filter(s => {
    const matchAuthor = authorFilter === 'all' || s.author?.trim() === authorFilter
    const q = search.toLowerCase()
    return matchAuthor && (!q ||
      s.author?.toLowerCase().includes(q) ||
      s.title?.toLowerCase().includes(q) ||
      formatRef(s).toLowerCase().includes(q))
  })

  return (
    <TeacherLayout
      title="Sources"
      actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>+ Add source</button>}
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>

      <div className="t-filter-bar" style={{ marginBottom: 16 }}>
        <select className="t-input" style={{ maxWidth: 360 }} value={moduleId ?? ''} onChange={e => setModuleId(e.target.value)}>
          {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <input className="t-search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="t-filter-select" value={authorFilter} onChange={e => setAuthorFilter(e.target.value)}>
          <option value="all">All authors</option>
          {authors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="t-filter-count">{filtered.length} extracts</span>
      </div>

      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="t-empty"><p>No sources found.</p></div>
      ) : (
        <div className="t-list">
          {filtered.map(s => (
            <div key={s.id} className="t-list-row">
              <div className="t-list-row-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="t-list-title">{s.author}</span>
                  <span className="t-list-meta" style={{ fontStyle: 'italic' }}>{s.title}</span>
                  {formatRef(s) && <span className="t-resource-type-pill">{formatRef(s)}</span>}
                  {s.image_url && <span className="t-resource-type-pill src-type-image">🖼 Image</span>}
                </div>
                <p className="t-list-meta" style={{ marginTop: 2 }}>
                  {s.image_url && !s.content ? 'Visual source' : s.content?.slice(0, 100) + (s.content?.length > 100 ? '…' : '')}
                </p>
              </div>
              <div className="t-list-row-actions">
                <button className="t-btn t-btn-ghost" onClick={() => setEditSource(s)}>Edit</button>
                <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => handleDelete(s)} confirmLabel="Delete?">Delete</ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <SourceFormModal
          title="Add source"
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editSource && (
        <SourceFormModal
          title="Edit source"
          initial={editSource}
          onSave={(form, file, remove) => handleUpdate(editSource.id, form, file, remove)}
          onClose={() => setEditSource(null)}
        />
      )}
    </TeacherLayout>
  )
}

// ── Source form modal ─────────────────────────────────────────────
function SourceFormModal({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    author:     initial?.author     ?? '',
    title:      initial?.title      ?? '',
    book:       initial?.book       ?? '',
    chapter:    initial?.chapter    ?? '',
    section:    initial?.section    ?? '',
    content:    initial?.content    ?? '',
    copyright:  initial?.copyright  ?? '',
    source_url: initial?.source_url ?? '',
    image_url:  initial?.image_url  ?? '',
  })
  const [imageFile, setImageFile]     = useState(null)     // new File to upload
  const [imagePreview, setImagePreview] = useState(initial?.image_url ?? null) // local preview URL
  const [removeImage, setRemoveImage] = useState(false)    // flag to delete existing
  const [saving, setSaving]           = useState(false)

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setRemoveImage(false)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
    set('image_url', '')
  }

  async function handleSave() {
    setSaving(true)
    await onSave(form, imageFile, removeImage)
    setSaving(false)
  }

  const hasImage = imagePreview && !removeImage
  const canSave  = form.content.trim() || hasImage

  return (
    <Modal title={title} onClose={onClose} width={660}>
      <div className="t-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Author">
            <input className="t-input" value={form.author} onChange={e => set('author', e.target.value)} autoFocus />
          </FormField>
          <FormField label="Title">
            <input className="t-input" value={form.title} onChange={e => set('title', e.target.value)} />
          </FormField>
          <FormField label="Book">
            <input className="t-input" placeholder="e.g. 6" value={form.book} onChange={e => set('book', e.target.value)} />
          </FormField>
          <FormField label="Chapter">
            <input className="t-input" placeholder="e.g. 42" value={form.chapter} onChange={e => set('chapter', e.target.value)} />
          </FormField>
          <FormField label="Section">
            <input className="t-input" placeholder="e.g. 61-71" value={form.section} onChange={e => set('section', e.target.value)} />
          </FormField>
          <FormField label="Copyright">
            <input className="t-input" placeholder="e.g. Public domain" value={form.copyright} onChange={e => set('copyright', e.target.value)} />
          </FormField>
        </div>

        <FormField label="Source URL">
          <input className="t-input" value={form.source_url} onChange={e => set('source_url', e.target.value)} />
        </FormField>

        {/* Image upload section */}
        <FormField label="Image (optional)">
          {hasImage ? (
            <div className="src-form-image-wrap">
              <img src={imagePreview} alt="Preview" className="src-form-image-preview" />
              <button type="button" className="t-btn t-btn-danger-ghost src-form-remove-img" onClick={handleRemoveImage}>
                Remove image
              </button>
            </div>
          ) : (
            <label className="src-form-upload-label">
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <span className="src-form-upload-btn t-btn t-btn-secondary">
                📁 Choose image…
              </span>
              <span className="src-form-upload-hint">PNG, JPG, GIF, WebP, SVG</span>
            </label>
          )}
        </FormField>

        {/* Text content — labelled as caption if image is present */}
        <FormField label={hasImage ? 'Caption / description (optional)' : 'Extract text'}>
          <textarea
            className="t-input"
            rows={hasImage ? 3 : 7}
            value={form.content}
            onChange={e => set('content', e.target.value)}
            placeholder={hasImage ? 'Optional caption or contextual note…' : 'Paste the source extract here…'}
            style={{ resize: 'vertical', fontFamily: 'var(--sans)' }}
          />
        </FormField>

        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create source'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
