import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

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

  async function handleCreate(form) {
    const { data, error } = await supabase
      .from('resources')
      .insert({ title: form.title.trim(), type: form.type, url: form.url.trim() || null, description: form.description.trim() || null })
      .select()
      .single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setResources(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)))
    setShowCreateModal(false)
    setStatus({ type: 'success', msg: 'Resource created.' })
  }

  async function handleUpdate(id, form) {
    const { error } = await supabase
      .from('resources')
      .update({ title: form.title.trim(), type: form.type, url: form.url.trim() || null, description: form.description?.trim() || null })
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
          onSave={form => handleUpdate(editingResource.id, form)}
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
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: null }))
  }

  function handleSubmit() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (Object.keys(e).length) { setErrors(e); return }
    onSave(form)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="t-form">
        <FormField label="Title" error={errors.title}>
          <input
            className="t-input"
            value={form.title}
            autoFocus
            onChange={e => set('title', e.target.value)}
          />
        </FormField>

        <FormField label="Type">
          <select className="t-input" value={form.type} onChange={e => set('type', e.target.value)}>
            {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>

        <FormField label="URL / path">
          <input
            className="t-input"
            placeholder="https://… or /quizzes/…"
            value={form.url}
            onChange={e => set('url', e.target.value)}
          />
        </FormField>

        <FormField label="Description">
          <input
            className="t-input"
            placeholder="Optional"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </FormField>

        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSubmit}>
            {initial ? 'Save changes' : 'Create resource'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
