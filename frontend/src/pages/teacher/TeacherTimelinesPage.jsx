import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'
import { sortByDate } from '../../components/TimelineShell'

// ── Timeline event editor (single timeline) ───────────────────────
function TimelineEditor({ timeline, isExpanded, onToggle, onDelete, onAddEvent, onDeleteEvent, onAttach }) {
  const [newLabel, setNewLabel]       = useState('')
  const [newDate, setNewDate]         = useState('')
  const [addGlossary, setAddGlossary] = useState(false)
  const [suggestions, setSuggestions] = useState([]) // glossary matches for entered date

  // Fetch glossary suggestions when date changes
  useEffect(() => {
    const trimmed = newDate.trim()
    if (!trimmed) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('glossary_terms')
        .select('id, term, date')
        .eq('date', trimmed)
        .eq('category', 'event')
        .limit(5)
      setSuggestions(data ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [newDate])

  function handleAdd() {
    if (!newLabel.trim() || !newDate.trim()) return
    onAddEvent({ label: newLabel.trim(), date: newDate.trim(), addToGlossary: addGlossary })
    setNewLabel(''); setNewDate(''); setAddGlossary(false); setSuggestions([])
  }

  function handleSuggestionClick(suggestion) {
    setNewLabel(suggestion.term)
    setSuggestions([])
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
            <p style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic', margin: 0 }}>No events yet.</p>
          ) : timeline.events.map(ev => (
            <div key={ev.id} className="tl-teacher-event-row">
              <span className="tl-teacher-event-date">{ev.date}</span>
              <span className="tl-teacher-event-label">{ev.label}</span>
              {ev.glossary_id && <span className="t-resource-type-pill">glossary</span>}
              <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={() => onDeleteEvent(ev.id)} confirmLabel="Delete?">✕</ConfirmButton>
            </div>
          ))}

          {/* Add event form */}
          <div className="tl-teacher-add-event" style={{ position: 'relative' }}>
            <input className="t-input" placeholder="Date (e.g. 490)" value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ width: 110, flexShrink: 0 }} />
            <div style={{ flex: 1, position: 'relative' }}>
              <input className="t-input" placeholder="Event label" value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                style={{ width: '100%' }} />
              {/* Glossary suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="tl-teacher-suggestions">
                  <p className="tl-teacher-suggestions-label">Glossary matches:</p>
                  {suggestions.map(s => (
                    <button key={s.id} className="tl-teacher-suggestion-item"
                      onClick={() => handleSuggestionClick(s)}>
                      {s.term} <span style={{ color: 'var(--text)', fontWeight: 400 }}>· {s.date}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="t-btn t-btn-primary" onClick={handleAdd}>Add</button>
          </div>
          <label className="tl-teacher-glossary-check">
            <input type="checkbox" checked={addGlossary} onChange={e => setAddGlossary(e.target.checked)} />
            Also add to Glossary
          </label>
        </div>
      )}
    </div>
  )
}

// ── Master Timeline Ordering section ─────────────────────────────
function MasterTimelineEditor({ hierarchy }) {
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [events, setEvents]                 = useState([])
  const [loading, setLoading]               = useState(false)

  const allUnits = hierarchy.flatMap(c =>
    (c.modules ?? []).flatMap(m =>
      (m.units ?? []).map(u => ({ id: u.id, title: u.title, moduleName: m.title }))
    )
  )

  async function loadEvents(unitId) {
    setSelectedUnitId(unitId)
    if (!unitId) { setEvents([]); return }
    setLoading(true)

    const { data: ugData } = await supabase.from('unit_glossary')
      .select('glossary_terms(id, term, date, sort_order)')
      .eq('unit_id', unitId)

    const { data: chunks } = await supabase.from('chunks').select('id').eq('unit_id', unitId)
    const chunkIds = (chunks ?? []).map(c => c.id)

    const { data: cgData } = chunkIds.length > 0
      ? await supabase.from('chunk_glossary').select('glossary_terms(id, term, date, sort_order)').in('chunk_id', chunkIds)
      : { data: [] }

    const seen = new Set()
    const all = []
    ;[...(ugData ?? []), ...(cgData ?? [])].forEach(row => {
      const t = row.glossary_terms
      if (!t || !t.date || seen.has(t.id)) return
      seen.add(t.id)
      all.push({ id: t.id, label: t.term, date: t.date, sort_order: t.sort_order ?? 0 })
    })

    setEvents(sortByDate(all))
    setLoading(false)
  }

  async function moveEvent(eventId, direction, dateGroup) {
    const idx = dateGroup.findIndex(e => e.id === eventId)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= dateGroup.length) return

    const a = dateGroup[idx]
    const b = dateGroup[swapIdx]

    // Swap sort_order values
    const aOrder = a.sort_order
    const bOrder = b.sort_order === aOrder ? aOrder + direction : b.sort_order

    await Promise.all([
      supabase.from('glossary_terms').update({ sort_order: bOrder }).eq('id', a.id),
      supabase.from('glossary_terms').update({ sort_order: aOrder }).eq('id', b.id),
    ])

    setEvents(prev => {
      const updated = prev.map(e => {
        if (e.id === a.id) return { ...e, sort_order: bOrder }
        if (e.id === b.id) return { ...e, sort_order: aOrder }
        return e
      })
      return sortByDate(updated)
    })
  }

  // Group events by date for display
  const dateGroups = events.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})

  const sortedDates = Object.keys(dateGroups).sort((a, b) => {
    const na = parseInt(String(a).match(/\d+/)?.[0] || '0')
    const nb = parseInt(String(b).match(/\d+/)?.[0] || '0')
    return nb - na // descending = oldest BC first
  })

  return (
    <div className="t-section">
      <h2 className="t-section-title" style={{ marginBottom: 12 }}>Master Timeline Ordering</h2>
      <p className="t-chunk-desc" style={{ marginBottom: 12 }}>
        When multiple events share a date, use the arrows to set their display order.
      </p>

      <FormField label="Select a unit">
        <select className="t-input" style={{ maxWidth: 480 }} value={selectedUnitId} onChange={e => loadEvents(e.target.value)}>
          <option value="">Select a unit…</option>
          {allUnits.map(u => <option key={u.id} value={u.id}>{u.title} ({u.moduleName})</option>)}
        </select>
      </FormField>

      {loading && <div className="loading-pulse">Loading…</div>}

      {selectedUnitId && !loading && events.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>No dated events found for this unit.</p>
      )}

      {sortedDates.map(date => {
        const group = dateGroups[date]
        return (
          <div key={date} className="tl-teacher-date-group">
            <p className="tl-teacher-date-group-label">{date}</p>
            {group.map((ev, idx) => (
              <div key={ev.id} className="tl-teacher-event-row">
                <div className="t-list-row-order">
                  <button className="t-order-btn" onClick={() => moveEvent(ev.id, -1, group)} disabled={idx === 0}>↑</button>
                  <button className="t-order-btn" onClick={() => moveEvent(ev.id,  1, group)} disabled={idx === group.length - 1}>↓</button>
                </div>
                <span className="tl-teacher-event-label">{ev.label}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

// ── Master Timeline Visibility ────────────────────────────────────
function MasterTimelineVisibility({ hierarchy }) {
  const [level, setLevel]         = useState('module')
  const [modFilter, setModFilter] = useState('')
  const [unitFilter, setUnit]     = useState('')
  const [parentId, setParent]     = useState('')
  const [hidden, setHidden]       = useState([])   // [{id, level, parent_id, label}]
  const [saving, setSaving]       = useState(false)

  const allModules = hierarchy.flatMap(c => (c.modules ?? []).map(m => ({ ...m, courseName: c.title })))
  const allUnits   = allModules.flatMap(m => (m.units ?? []).map(u => ({ ...u, module_id: m.id, moduleName: m.title })))
  const allChunks  = allUnits.flatMap(u  => (u.chunks ?? []).map(c => ({ ...c, unit_id: u.id, unitName: u.title })))
  const fUnits  = modFilter   ? allUnits.filter(u  => u.module_id === modFilter)  : allUnits
  const fChunks = unitFilter  ? allChunks.filter(c => c.unit_id  === unitFilter)  : allChunks

  // Load existing hidden entries on mount
  useEffect(() => {
    supabase.from('hidden_master_timelines').select('*').then(({ data }) => {
      if (!data) return
      // Enrich with labels from hierarchy
      const enriched = data.map(row => {
        let label = row.parent_id
        if (row.level === 'module') {
          const m = allModules.find(m => m.id === row.parent_id)
          label = m ? m.title : row.parent_id
        } else if (row.level === 'unit') {
          const u = allUnits.find(u => u.id === row.parent_id)
          label = u ? `${u.moduleName} › ${u.title}` : row.parent_id
        } else if (row.level === 'chunk') {
          const c = allChunks.find(c => c.id === row.parent_id)
          label = c ? `${c.unitName} › ${c.title}` : row.parent_id
        }
        return { ...row, label }
      })
      setHidden(enriched)
    })
  }, [hierarchy])

  function changeLevel(l) { setLevel(l); setParent(''); setModFilter(''); setUnit('') }

  async function handleHide() {
    if (!parentId) return
    setSaving(true)
    const { data, error } = await supabase.from('hidden_master_timelines')
      .insert({ level, parent_id: parentId })
      .select().single()
    setSaving(false)
    if (error) return
    // Build label
    let label = parentId
    if (level === 'module')      label = allModules.find(m => m.id === parentId)?.title ?? parentId
    else if (level === 'unit')   { const u = allUnits.find(u => u.id === parentId); label = u ? `${u.moduleName} › ${u.title}` : parentId }
    else if (level === 'chunk')  { const c = allChunks.find(c => c.id === parentId); label = c ? `${c.unitName} › ${c.title}` : parentId }
    setHidden(prev => [...prev, { ...data, label }])
    setParent('')
  }

  async function handleShow(id) {
    await supabase.from('hidden_master_timelines').delete().eq('id', id)
    setHidden(prev => prev.filter(h => h.id !== id))
  }

  const LEVEL_LABELS = { module: 'Module', unit: 'Unit', chunk: 'Chunk' }

  return (
    <div className="t-section" style={{ marginTop: 32 }}>
      <h2 className="t-section-title" style={{ marginBottom: 4 }}>Master Timeline Visibility</h2>
      <p className="t-chunk-desc" style={{ marginBottom: 16 }}>
        Hide the auto-generated master timeline for a specific module, unit or chunk.
      </p>

      {/* Currently hidden list */}
      {hidden.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 6 }}>
            Currently hidden
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hidden.map(h => (
              <div key={h.id} className="tl-teacher-event-row">
                <span className="t-resource-type-pill">{LEVEL_LABELS[h.level]}</span>
                <span className="tl-teacher-event-label">{h.label}</span>
                <button className="t-btn t-btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}
                  onClick={() => handleShow(h.id)}>
                  Show
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hide a new level */}
      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FormField label="Level to hide">
          <div className="rr-attach-options">
            {['module','unit','chunk'].map(l => (
              <label key={l} className="rr-attach-option">
                <input type="radio" name="vis-level" checked={level === l} onChange={() => changeLevel(l)} />
                <span>{LEVEL_LABELS[l]}</span>
              </label>
            ))}
          </div>
        </FormField>

        {level === 'module' && (
          <FormField label="Select module">
            <select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}>
              <option value="">Select…</option>
              {allModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </FormField>
        )}

        {level === 'unit' && (<>
          <FormField label="1. Module">
            <select className="t-input" value={modFilter} onChange={e => { setModFilter(e.target.value); setParent('') }}>
              <option value="">Select…</option>
              {allModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </FormField>
          {modFilter && (
            <FormField label="2. Unit">
              <select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}>
                <option value="">Select…</option>
                {fUnits.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </FormField>
          )}
        </>)}

        {level === 'chunk' && (<>
          <FormField label="1. Module">
            <select className="t-input" value={modFilter} onChange={e => { setModFilter(e.target.value); setUnit(''); setParent('') }}>
              <option value="">Select…</option>
              {allModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </FormField>
          {modFilter && (
            <FormField label="2. Unit">
              <select className="t-input" value={unitFilter} onChange={e => { setUnit(e.target.value); setParent('') }}>
                <option value="">Select…</option>
                {fUnits.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </FormField>
          )}
          {unitFilter && (
            <FormField label="3. Chunk">
              <select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}>
                <option value="">Select…</option>
                {fChunks.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </FormField>
          )}
        </>)}

        <button
          className="t-btn t-btn-primary"
          style={{ alignSelf: 'flex-start' }}
          onClick={handleHide}
          disabled={!parentId || saving}
        >
          {saving ? 'Saving…' : 'Hide master timeline'}
        </button>
      </div>
    </div>
  )
}

export default function TeacherTimelinesPage() {
  const [timelines, setTimelines]   = useState([])
  const [expanded, setExpanded]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [status, setStatus]         = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAttach, setShowAttach] = useState(null)
  const [hierarchy, setHierarchy]   = useState([])

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
    const keyMap   = { module: 'module_id',        unit: 'unit_id',        chunk: 'chunk_id' }
    const { error } = await supabase.from(tableMap[level]).insert({ [keyMap[level]]: parentId, timeline_id: timelineId })
    if (error && !error.message.includes('unique')) { setStatus({ type: 'error', msg: error.message }); return }
    setStatus({ type: 'success', msg: 'Timeline attached.' })
    setShowAttach(null)
  }

  return (
    <TeacherLayout title="Timelines" actions={<button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>+ New timeline</button>}>
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>{status?.msg}</StatusMessage>

      {loading ? <div className="loading-pulse">Loading…</div> : (
        <>
          {timelines.length === 0 ? (
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

          {/* Master timeline ordering */}
          {hierarchy.length > 0 && <MasterTimelineEditor hierarchy={hierarchy} />}
          {hierarchy.length > 0 && <MasterTimelineVisibility hierarchy={hierarchy} />}
        </>
      )}

      {showCreate && <CreateTimelineModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      {showAttach && <AttachTimelineModal hierarchy={hierarchy} onAttach={form => handleAttach(showAttach, form)} onClose={() => setShowAttach(null)} />}
    </TeacherLayout>
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
  const [level, setLevel]       = useState('module')
  const [modFilter, setMod]     = useState('')
  const [unitFilter, setUnit]   = useState('')
  const [parentId, setParent]   = useState('')

  const allModules = hierarchy.flatMap(c => (c.modules ?? []).map(m => ({ ...m, courseName: c.title })))
  const allUnits   = allModules.flatMap(m => (m.units ?? []).map(u => ({ ...u, module_id: m.id, moduleName: m.title })))
  const allChunks  = allUnits.flatMap(u => (u.chunks ?? []).map(c => ({ ...c, unit_id: u.id, unitName: u.title })))
  const fUnits  = modFilter  ? allUnits.filter(u => u.module_id === modFilter)  : allUnits
  const fChunks = unitFilter ? allChunks.filter(c => c.unit_id === unitFilter)  : allChunks

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
        {level === 'module' && <FormField label="Module"><select className="t-input" value={parentId} onChange={e => setParent(e.target.value)}><option value="">Select…</option>{allModules.map(m => <option key={m.id} value={m.id}>{m.title} ({m.courseName})</option>)}</select></FormField>}
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