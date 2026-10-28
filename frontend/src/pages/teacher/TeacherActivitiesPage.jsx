import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'
import ActivityEditor from '../../activities/editor/ActivityEditor'
import { ACTIVITY_URL } from '../../activities/types'

/**
 * Teacher > Activities
 * Lists activity-backed quizzes (resources with type 'quiz' and url 'activity'),
 * lets you create new ones and edit their tasks.
 * Attach an activity to a chunk with the existing "Attach resource" flow on the chunk page.
 */
export default function TeacherActivitiesPage() {
  const [list, setList]         = useState([])
  const [counts, setCounts]     = useState({})
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [status, setStatus]     = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch]     = useState('')

  async function load() {
    const { data: res } = await supabase
      .from('resources')
      .select('id, title, description, url')
      .eq('type', 'quiz').eq('url', ACTIVITY_URL).order('title')
    setList(res ?? [])
    const ids = (res ?? []).map(r => r.id)
    if (ids.length) {
      const { data: its } = await supabase.from('activity_items')
        .select('resource_id').in('resource_id', ids).range(0, 9999)
      const c = {}
      ;(its ?? []).forEach(i => { c[i.resource_id] = (c[i.resource_id] ?? 0) + 1 })
      setCounts(c)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleCreate(title, description) {
    const { data, error } = await supabase.from('resources')
      .insert({ title, type: 'quiz', url: ACTIVITY_URL, description: description || null })
      .select('id').single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setShowCreate(false)
    await load()
    setSelectedId(data.id)
    setStatus({ type: 'success', msg: 'Activity created. Add tasks, then attach it to a chunk from the chunk page.' })
  }

  const selected = list.find(r => r.id === selectedId)
  const filtered = list.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <TeacherLayout
      title="Activities"
      actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>+ New activity</button>}
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>

      {selected ? (
        <div className="t-section">
          <div className="t-section-header">
            <button className="t-btn t-btn-ghost" onClick={() => { setSelectedId(null); load() }}>← All activities</button>
            <h2 className="t-section-title">{selected.title}</h2>
            <Link className="act-preview-link" to={`/quiz/${selected.id}`} target="_blank">Preview as student ↗</Link>
          </div>
          <ActivityEditor resourceId={selected.id} onStatus={setStatus} />
        </div>
      ) : (
        <div className="t-section">
          <div className="t-filter-bar">
            <input className="t-search-input" placeholder="Search activities…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? <div className="loading-pulse">Loading…</div> :
            filtered.length === 0 ? (
              <p className="t-empty">
                {list.length === 0
                  ? 'No activities yet. Create one, or import your existing quizzes (see sql/import).'
                  : 'No matches.'}
              </p>
            ) : (
              <ul className="t-list">
                {filtered.map(r => (
                  <li key={r.id} className="t-list-row t-list-row-nav" onClick={() => setSelectedId(r.id)}>
                    <div className="t-list-row-main">
                      <span className="t-list-title">{r.title}</span>
                      <span className="t-list-meta">{counts[r.id] ?? 0} tasks</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      {showCreate && <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </TeacherLayout>
  )
}

function CreateModal({ onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc]   = useState('')
  const [err, setErr]     = useState(null)
  function submit() {
    if (!title.trim()) { setErr('Title is required'); return }
    onSave(title.trim(), desc.trim())
  }
  return (
    <Modal title="New activity" onClose={onClose}>
      <div className="t-form">
        <FormField label="Title" error={err}>
          <input className="t-input" autoFocus value={title} onChange={e => { setTitle(e.target.value); setErr(null) }} />
        </FormField>
        <FormField label="Description">
          <input className="t-input" value={desc} onChange={e => setDesc(e.target.value)} />
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={submit}>Create</button>
        </div>
      </div>
    </Modal>
  )
}
