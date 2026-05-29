import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'
import { formatRef } from '../../components/SourceTabContent'

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

  async function handleCreate(form) {
    const { data, error } = await supabase.from('sources')
      .insert({ ...form, module_id: moduleId }).select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => [...prev, data].sort((a, b) => a.author.localeCompare(b.author)))
    setShowCreate(false)
    setStatus({ type: 'success', msg: 'Source created.' })
  }

  async function handleUpdate(id, form) {
    const { error } = await supabase.from('sources').update(form).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...form } : s))
    setEditSource(null)
    setStatus({ type: 'success', msg: 'Source updated.' })
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('sources').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setSources(prev => prev.filter(s => s.id !== id))
    setStatus({ type: 'success', msg: 'Source deleted.' })
  }

  const authors = [...new Set(sources.map(s => s.author?.trim()).filter(Boolean))].sort()

  const filtered = sources.filter(s => {
    const matchAuthor = authorFilter === 'all' || s.author?.trim() === authorFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      s.author?.toLowerCase().includes(q) ||
      s.title?.toLowerCase().includes(q) ||
      formatRef(s).toLowerCase().includes(q)
    return matchAuthor && matchSearch
  })

  return (
    <TeacherLayout
      title="Sources"
      actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>+ Add source</button>}
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>

      {/* Module selector */}
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
                <div>
                  <span className="t-list-title">{s.author}</span>
                  <span className="t-list-meta" style={{ marginLeft: 8 }}>{s.title}</span>
                  {formatRef(s) && <span className="t-resource-type-pill" style={{ marginLeft: 8 }}>{formatRef(s)}</span>}
                </div>
                <p className="t-list-meta" style={{ marginTop: 2 }}>
                  {s.content?.slice(0, 100)}{s.content?.length > 100 ? '…' : ''}
                </p>
              </div>
              <div className="t-list-row-actions">
                <button className="t-btn t-btn-ghost" onClick={() => setEditSource(s)}>Edit</button>
                <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => handleDelete(s.id)} confirmLabel="Delete?">Delete</ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <SourceFormModal title="Add source" moduleId={moduleId} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editSource && (
        <SourceFormModal title="Edit source" initial={editSource} moduleId={moduleId} onSave={form => handleUpdate(editSource.id, form)} onClose={() => setEditSource(null)} />
      )}
    </TeacherLayout>
  )
}

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
  })

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  return (
    <Modal title={title} onClose={onClose} width={640}>
      <div className="t-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Author"><input className="t-input" value={form.author} onChange={e => set('author', e.target.value)} autoFocus /></FormField>
          <FormField label="Title"><input className="t-input" value={form.title} onChange={e => set('title', e.target.value)} /></FormField>
          <FormField label="Book"><input className="t-input" placeholder="e.g. 6" value={form.book} onChange={e => set('book', e.target.value)} /></FormField>
          <FormField label="Chapter"><input className="t-input" placeholder="e.g. 42" value={form.chapter} onChange={e => set('chapter', e.target.value)} /></FormField>
          <FormField label="Section"><input className="t-input" placeholder="e.g. 61-71" value={form.section} onChange={e => set('section', e.target.value)} /></FormField>
          <FormField label="Copyright"><input className="t-input" placeholder="e.g. Public domain" value={form.copyright} onChange={e => set('copyright', e.target.value)} /></FormField>
        </div>
        <FormField label="Source URL"><input className="t-input" value={form.source_url} onChange={e => set('source_url', e.target.value)} /></FormField>
        <FormField label="Content (extract text)">
          <textarea className="t-input" rows={8} value={form.content} onChange={e => set('content', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--sans)' }} />
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={() => form.content.trim() && onSave(form)} disabled={!form.content.trim()}>
            {initial ? 'Save changes' : 'Create source'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
