import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

export default function TeacherTimelinesPage() {
  const [timelines, setTimelines] = useState([])
  const [expanded, setExpanded]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [status, setStatus]       = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAttach, setShowAttach] = useState(null)
  const [hierarchy, setHierarchy] = useState([])

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: tlData }, { data: evData }, { data: courseData }] = await Promise.all([
      supabase.from('timelines').select('id, title, description').order('created_at'),
      supabase.from('timeline_events').select('id, timeline_id, label, date, glossary_id').order('order_index'),
      supabase.from('courses').select('id, title, modules(id, title, order_index, units(id, title, order_index, chunks(id, title, order_index)))').order('title'),
    ])
    setTimelines((tlData ?? []).map(tl => ({ ...tl, events: (evData ?? []).filter(e => e.timeline_id === tl.id) })))
    setHierarchy(courseData ?? [])
    setLoading(false)
  }

  async function handleCreate({ title, description }) {
    const { data, error } = await supabase.from('timelines').insert({ title, description }).select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTimelines(prev => [...prev, { ...data, events: [] }])
    setShowCreate(false); setExpanded(data.id)
    setStatus({ type: 'success', msg: 'Timeline created.' })
  }

  async function handleDeleteTimeline(id) {
    const { error } = await supabase.from('timelines').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTimelines(prev => prev.filter(t => t.id !== id))
    if (expanded === id) setExpanded(null)
    setStatus({ type: 'success', msg: 'Timeline deleted.' })
  }

  async function handleAddEvent(timelineId, { label, date, addToGlossary }) {
    let glossaryId = null
    if (addToGlossary) {
      const { data: gt } = await supabase.from('glossary_terms').insert({ term: label, definition: '', category: 'event', date }).select().single()
      if (gt) glossaryId = gt.id
    }
    const nextIdx = (timelines.find(t => t.id === timelineId)?.events.length) ?? 0
    const { data, error } = await supabase.from('timeline_events').insert({ timeline_id: timelineId, label, date, glossary_id: glossaryId, order_index: nextIdx }).select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, events: [...t.events, data] } : t))
  }

  async function handleDeleteEvent(timelineId, eventId) {
    const { error } = await supabase.from('timeline_events').delete().eq('id', eventId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, events: t.events.filter(e => e.id !== eventId) } : t))
  }

  async function handleAttach(timelineId, { level, parentId }) {
    const tableMap = { module: 'module_timelines', unit: 'unit_timelines', chunk: 'chunk_timelines' }
    const keyMap   = { module: 'module_id', unit: 'unit_id', chunk: 'chunk_id' }
    const { error } = await supabase.from(tableMap[level]).insert({ [keyMap[level]]: parentId, timeline_id: timelineId })
    if (error && !error.message.includes('unique')) { setStatus({ type: 'error', msg: error.message }); return }
    setStatus({ type: 'success', msg: 'Timeline attached.' })
    setShowAttach(null)
  }

  return (
    <TeacherLayout title="Timelines" actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>+ New timeline</button>}>
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>
      {loading ? <div className="loading-pulse">Loading…</div> : timelines.length === 0 ? (
        <div className="t-empty"><p>No custom timelines yet.</p><button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>Create first timeline</button></div>
      ) : (
        <div className="t-chunk-list">
          {timelines.map(tl => (
            <TimelineEditor key={tl.id} timeline={tl} isExpanded={expanded === tl.id}
              onToggle={() => setExpanded(prev => prev === tl.id ? null : tl.id)}
              onDelete={() => handleDeleteTimeline(tl.id)}
              onAddEvent={form => handleAddEvent(tl.id, form)}
              onDeleteEvent={evId => handleDeleteEvent(tl.id, evId)}
              onAttach={() => setShowAttach(tl.id)} />
          ))}
        </div>
      )}
      {showCreate && <CreateTimelineModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      {showAttach && <AttachTimelineModal hierarchy={hierarchy} onAttach={form => handleAttach(showAttach, form)} onClose={() => setShowAttach(null)} />}
    </TeacherLayout>
  )
}

function TimelineEditor({ timeline, isExpanded, onToggle, onDelete, onAddEvent, onDeleteEvent, onAttach }) {
  const [newLabel, setNewLabel] = useState('')
  const [newDate, setNewDate]   = useState('')
  const [addGlossary, setAdd]   = useState(false)

  function handleAdd() {
    if (!newLabel.trim() || !newDate.trim()) return
    onAddEvent({ label: newLabel.trim(), date: newDate.trim(), addToGlossary: addGlossary })
    setNewLabel(''); setNewDate(''); setAdd(false)
  }

  return (
    <div className="t-chunk-row">
      <div className="t-chunk-row-top">
        <button className="t-btn t-btn-ghost" style={{ fontSize: 13 }} onClick={onToggle}>{isExpanded ? '▾' : '▸'}</button>
        <div className="t-chunk-row-title">
          <span className="t-list-title">{timeline.title}</span>
          <span className="t-list-meta" style={{ marginLeft: 8 }}>{timeline.events.length} events</span>
        </div>
        <div className="t-list-row-actions">
          <button className="t-btn t-btn-secondary" onClick={onAttach}>Attach to…</button>
          <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={onDelete} confirmLabel="Delete?">Delete</ConfirmButton>
        </div>
      </div>
      {isExpanded && (
        <div className="rr-teacher-cards">
          {timeline.events.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic', margin: 0 }}>No events yet. Add one below.</p>
          ) : timeline.events.map(ev => (
            <div key={ev.id} className="tl-teacher-event-row">
              <span className="tl-teacher-event-date">{ev.date}</span>
              <span className="tl-teacher-event-label">{ev.label}</span>
              {ev.glossary_id && <span className="t-resource-type-pill">glossary</span>}
              <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => onDeleteEvent(ev.id)} confirmLabel="Delete?">✕</ConfirmButton>
            </div>
          ))}
          <div className="tl-teacher-add-event">
            <input className="t-input" placeholder="Date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: 110, flexShrink: 0 }} />
            <input className="t-input" placeholder="Event label" value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} style={{ flex: 1 }} />
            <button className="t-btn t-btn-primary" onClick={handleAdd}>Add</button>
          </div>
          <label className="tl-teacher-glossary-check">
            <input type="checkbox" checked={addGlossary} onChange={e => setAdd(e.target.checked)} />
            Also add to Glossary
          </label>
        </div>
      )}
    </div>
  )
}

function CreateTimelineModal({ onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc]   = useState('')
  return (
    <Modal title="New timeline" onClose={onClose}>
      <div className="t-form">
        <FormField label="Title"><input className="t-input" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Persian Wars Chronology" onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onSave({ title, description: desc }) }} /></FormField>
        <FormField label="Description"><input className="t-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" /></FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={() => title.trim() && onSave({ title, description: desc })} disabled={!title.trim()}>Create</button>
        </div>
      </div>
    </Modal>
  )
}

function AttachTimelineModal({ hierarchy, onAttach, onClose }) {
  const [level, setLevel]     = useState('module')
  const [modFilter, setMod]   = useState('')
  const [unitFilter, setUnit] = useState('')
  const [parentId, setParent] = useState('')

  const allModules = hierarchy.flatMap(c => (c.modules ?? []).map(m => ({ ...m, courseName: c.title })))
  const allUnits   = allModules.flatMap(m => (m.units ?? []).map(u => ({ ...u, module_id: m.id, moduleName: m.title })))
  const allChunks  = allUnits.flatMap(u => (u.chunks ?? []).map(c => ({ ...c, unit_id: u.id, unitName: u.title })))

  const fUnits  = modFilter   ? allUnits.filter(u => u.module_id === modFilter)   : allUnits
  const fChunks = unitFilter  ? allChunks.filter(c => c.unit_id  === unitFilter)  : allChunks

  function changeLevel(l) { setLevel(l); setParent(''); setMod(''); setUnit('') }

  return (
    <Modal title="Attach timeline to…" onClose={onClose} width={520}>
      <div className="t-form">
        <FormField label="Level">
          <div className="rr-attach-options">
            {['module','unit','chunk'].map(l => (
              <label key={l} className="rr-attach-option"><input type="radio" name="level" checked={level === l} onChange={() => changeLevel(l)} /><span>{l.charAt(0).toUpperCase() + l.slice(1)}</span></label>
            ))}
          </div>
        </FormField>

        {level === 'module' && (
          <FormField label="Module">
            <select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}>
              <option value="">Select…</option>
              {allModules.map(m => <option key={m.id} value={m.id}>{m.title} ({m.courseName})</option>)}
            </select>
          </FormField>
        )}

        {level === 'unit' && (<>
          <FormField label="1. Module"><select className="t-input" value={modFilter} onChange={e => { setMod(e.target.value); setParent('') }}><option value="">Select…</option>{allModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></FormField>
          {modFilter && <FormField label="2. Unit"><select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}><option value="">Select…</option>{fUnits.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></FormField>}
        </>)}

        {level === 'chunk' && (<>
          <FormField label="1. Module"><select className="t-input" value={modFilter} onChange={e => { setMod(e.target.value); setUnit(''); setParent('') }}><option value="">Select…</option>{allModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></FormField>
          {modFilter && <FormField label="2. Unit"><select className="t-input" value={unitFilter} onChange={e => { setUnit(e.target.value); setParent('') }}><option value="">Select…</option>{fUnits.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></FormField>}
          {unitFilter && <FormField label="3. Chunk"><select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}><option value="">Select…</option>{fChunks.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></FormField>}
        </>)}

        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={() => onAttach({ level, parentId })} disabled={!parentId}>Attach</button>
        </div>
      </div>
    </Modal>
  )
}