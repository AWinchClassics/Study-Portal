import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

// ── Card group editor ─────────────────────────────────────────────
function CardGroupEditor({ group, courseMap, moduleMap, unitMap, onAddCard, onDeleteCard, onDeleteGroup }) {
  const [expanded, setExpanded] = useState(false)
  const [newCard, setNewCard]   = useState('')

  function handleAddCard() {
    const text = newCard.trim()
    if (!text) return
    onAddCard(group.id, text)
    setNewCard('')
  }

  // Build attachment label
  let attachmentLabel = 'Standalone'
  if (group.course_id && courseMap[group.course_id]) {
    attachmentLabel = `In course: ${courseMap[group.course_id]}`
  } else if (group.module_id && moduleMap[group.module_id]) {
    attachmentLabel = `In module: ${moduleMap[group.module_id]}`
  } else if (group.unit_id && unitMap[group.unit_id]) {
    attachmentLabel = `In unit: ${unitMap[group.unit_id]}`
  }

  return (
    <div className="t-chunk-row">
      <div className="t-chunk-row-top">
        <button
          className="t-btn t-btn-ghost"
          style={{ fontSize: 13 }}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▾' : '▸'}
        </button>

        <div className="t-chunk-row-title">
          <span className="t-list-title">{group.name}</span>
          <span className="rr-attach-pill">{attachmentLabel}</span>
          <span className="t-list-meta" style={{ marginLeft: 4 }}>
            {group.cards.length} {group.cards.length === 1 ? 'card' : 'cards'}
          </span>
        </div>

        <div className="t-list-row-actions">
          <ConfirmButton
            className="t-btn t-btn-danger-ghost"
            onConfirm={() => onDeleteGroup(group.id)}
            confirmLabel="Delete group?"
          >
            Delete group
          </ConfirmButton>
        </div>
      </div>

      {expanded && (
        <div className="rr-teacher-cards">
          {group.cards.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text)', padding: '4px 0', margin: 0 }}>
              No cards yet.
            </p>
          )}
          {group.cards.map(card => (
            <div key={card.id} className="rr-teacher-card-row">
              <span className="rr-teacher-card-text">{card.text}</span>
              <ConfirmButton
                className="t-btn t-btn-danger-ghost"
                onConfirm={() => onDeleteCard(card.id, group.id)}
                confirmLabel="Delete?"
              >
                ✕
              </ConfirmButton>
            </div>
          ))}

          <div className="rr-teacher-add-card">
            <input
              className="t-input"
              placeholder="Add new card…"
              value={newCard}
              onChange={e => setNewCard(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCard() }}
            />
            <button className="t-btn t-btn-primary" onClick={handleAddCard}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function TeacherRandomiserPage() {
  const [tab, setTab]               = useState('function')
  const [funcGroups, setFuncGroups] = useState([])
  const [contentGroups, setContentGroups] = useState([])

  // Hierarchy for attachment dropdowns
  const [courses, setCourses]       = useState([]) // [{id, title}]
  const [modules, setModules]       = useState([]) // [{id, title, course_title}]
  const [units, setUnits]           = useState([]) // [{id, title, module_title, module_id}]
  const [courseMap, setCourseMap]   = useState({}) // id → title
  const [moduleMap, setModuleMap]   = useState({}) // id → title
  const [unitMap, setUnitMap]       = useState({}) // id → title

  const [loading, setLoading]           = useState(true)
  const [status, setStatus]             = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { data: fg }, { data: fc },
      { data: cg }, { data: cc },
      { data: courseData },
    ] = await Promise.all([
      supabase.from('randomiser_function_groups').select('id, name, order_index').order('order_index'),
      supabase.from('randomiser_function_cards').select('id, group_id, text, order_index').order('order_index'),
      supabase.from('randomiser_content_groups').select('id, name, order_index, module_id, unit_id').order('order_index'),
      supabase.from('randomiser_content_cards').select('id, group_id, text, order_index').order('order_index'),
      supabase.from('courses').select(`
        id, title,
        modules ( id, title, order_index,
          units ( id, title, order_index )
        )
      `).order('title'),
    ])

    setFuncGroups((fg ?? []).map(g => ({
      ...g, cards: (fc ?? []).filter(c => c.group_id === g.id)
    })))

    setContentGroups((cg ?? []).map(g => ({
      ...g, cards: (cc ?? []).filter(c => c.group_id === g.id)
    })))

    // Build flat course, module and unit lists + lookup maps
    if (courseData) {
      const flatCourses = []
      const flatModules = []
      const flatUnits   = []
      const cMap = {}
      const mMap = {}
      const uMap = {}

      courseData.forEach(course => {
        flatCourses.push({ id: course.id, title: course.title })
        cMap[course.id] = course.title
        course.modules?.forEach(mod => {
          flatModules.push({ id: mod.id, title: mod.title, course_title: course.title })
          mMap[mod.id] = `${mod.title} (${course.title})`
          mod.units?.forEach(unit => {
            flatUnits.push({ id: unit.id, title: unit.title, module_title: mod.title, module_id: mod.id })
            uMap[unit.id] = `${unit.title} (${mod.title})`
          })
        })
      })

      setCourses(flatCourses)
      setModules(flatModules)
      setUnits(flatUnits)
      setCourseMap(cMap)
      setModuleMap(mMap)
      setUnitMap(uMap)
    }

    setLoading(false)
  }

  // ── Group CRUD ──
  async function handleAddGroup({ name, course_id, module_id, unit_id }) {
    const table = tab === 'function' ? 'randomiser_function_groups' : 'randomiser_content_groups'
    const currentGroups = tab === 'function' ? funcGroups : contentGroups

    const payload = { name: name.trim(), order_index: currentGroups.length }
    if (tab === 'content') {
      if (course_id) payload.course_id = course_id
      if (module_id) payload.module_id = module_id
      if (unit_id)   payload.unit_id   = unit_id
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }

    const newGroup = { ...data, cards: [] }
    if (tab === 'function') setFuncGroups(p => [...p, newGroup])
    else setContentGroups(p => [...p, newGroup])
    setShowAddGroup(false)
    setStatus({ type: 'success', msg: 'Group added.' })
  }

  async function handleDeleteGroup(groupId) {
    const table = tab === 'function' ? 'randomiser_function_groups' : 'randomiser_content_groups'
    const { error } = await supabase.from(table).delete().eq('id', groupId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    if (tab === 'function') setFuncGroups(p => p.filter(g => g.id !== groupId))
    else setContentGroups(p => p.filter(g => g.id !== groupId))
    setStatus({ type: 'success', msg: 'Group deleted.' })
  }

  // ── Card CRUD ──
  async function handleAddCard(groupId, text) {
    const table  = tab === 'function' ? 'randomiser_function_cards' : 'randomiser_content_cards'
    const groups = tab === 'function' ? funcGroups : contentGroups
    const group  = groups.find(g => g.id === groupId)
    const { data, error } = await supabase
      .from(table)
      .insert({ group_id: groupId, text, order_index: group?.cards.length ?? 0 })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }

    const updater = gs => gs.map(g => g.id === groupId ? { ...g, cards: [...g.cards, data] } : g)
    if (tab === 'function') setFuncGroups(updater)
    else setContentGroups(updater)
  }

  async function handleDeleteCard(cardId, groupId) {
    const table = tab === 'function' ? 'randomiser_function_cards' : 'randomiser_content_cards'
    const { error } = await supabase.from(table).delete().eq('id', cardId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }

    const updater = gs => gs.map(g =>
      g.id === groupId ? { ...g, cards: g.cards.filter(c => c.id !== cardId) } : g
    )
    if (tab === 'function') setFuncGroups(updater)
    else setContentGroups(updater)
  }

  // Quick-add a single card to a unit.
  // Finds an existing group for that unit, or creates one named after the unit.
  async function handleQuickAddCard({ unitId, unitTitle, cardText }) {
    const existing = contentGroups.find(g => g.unit_id === unitId)
    let groupId

    if (existing) {
      groupId = existing.id
    } else {
      const { data: newGroup, error: groupError } = await supabase
        .from('randomiser_content_groups')
        .insert({ name: unitTitle, unit_id: unitId, order_index: contentGroups.length })
        .select().single()
      if (groupError) { setStatus({ type: 'error', msg: groupError.message }); return }
      groupId = newGroup.id
      setContentGroups(prev => [...prev, { ...newGroup, cards: [] }])
    }

    const group = contentGroups.find(g => g.id === groupId)
    const { data: newCard, error: cardError } = await supabase
      .from('randomiser_content_cards')
      .insert({ group_id: groupId, text: cardText.trim(), order_index: group?.cards.length ?? 0 })
      .select().single()
    if (cardError) { setStatus({ type: 'error', msg: cardError.message }); return }

    setContentGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, cards: [...g.cards, newCard] } : g
    ))
    setShowQuickAdd(false)
    setStatus({ type: 'success', msg: `Card added to "${existing?.name ?? unitTitle}".` })
  }

  const activeGroups = tab === 'function' ? funcGroups : contentGroups

  return (
    <TeacherLayout
      title="Randomiser Cards"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'content' && (
            <button className="t-btn t-btn-secondary" onClick={() => setShowQuickAdd(true)}>
              + Quick add card
            </button>
          )}
          <button className="t-btn t-btn-primary" onClick={() => setShowAddGroup(true)}>
            + New group
          </button>
        </div>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      <div className="rr-teacher-tabs">
        <button
          className={`rr-teacher-tab ${tab === 'function' ? 'rr-teacher-tab-active' : ''}`}
          onClick={() => setTab('function')}
        >
          ⚡ Instruction cards
        </button>
        <button
          className={`rr-teacher-tab ${tab === 'content' ? 'rr-teacher-tab-active' : ''}`}
          onClick={() => setTab('content')}
        >
          📚 Custom content cards
        </button>
      </div>

      <p className="t-chunk-desc" style={{ marginBottom: 16 }}>
        {tab === 'function'
          ? 'Instruction cards used in the chunk randomiser and full randomiser.'
          : 'Custom content cards that appear alongside chunk topics in the full randomiser. Groups can be attached to a specific module or unit, or left standalone.'}
      </p>

      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : activeGroups.length === 0 ? (
        <div className="t-empty">
          <p>No groups yet.</p>
          <button className="t-btn t-btn-primary" onClick={() => setShowAddGroup(true)}>
            Add first group
          </button>
        </div>
      ) : (
        <div className="t-chunk-list">
          {activeGroups.map(group => (
            tab === 'function' ? (
              <CardGroupEditor
                key={group.id}
                group={group}
                courseMap={{}}
                moduleMap={{}}
                unitMap={{}}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onDeleteGroup={handleDeleteGroup}
              />
            ) : (
              <CardGroupEditor
                key={group.id}
                group={group}
                courseMap={courseMap}
                moduleMap={moduleMap}
                unitMap={unitMap}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onDeleteGroup={handleDeleteGroup}
              />
            )
          ))}
        </div>
      )}

      {showAddGroup && (
        <AddGroupModal
          tab={tab}
          courses={courses}
          modules={modules}
          units={units}
          onSave={handleAddGroup}
          onClose={() => setShowAddGroup(false)}
        />
      )}

      {showQuickAdd && (
        <QuickAddCardModal
          modules={modules}
          units={units}
          onSave={handleQuickAddCard}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </TeacherLayout>
  )
}

// ── Quick add card modal ──────────────────────────────────────────
// Adds a single card to a unit, creating a default group if needed.
function QuickAddCardModal({ modules, units, onSave, onClose }) {
  const [filterModuleId, setFilterModuleId] = useState('')
  const [unitId, setUnitId]                 = useState('')
  const [unitTitle, setUnitTitle]           = useState('')
  const [cardText, setCardText]             = useState('')

  const filteredUnits = units.filter(u => u.module_id === filterModuleId)

  function handleModuleChange(id) {
    setFilterModuleId(id)
    setUnitId('')
    setUnitTitle('')
  }

  function handleUnitChange(id) {
    setUnitId(id)
    const unit = units.find(u => u.id === id)
    setUnitTitle(unit?.title ?? '')
  }

  const canSave = unitId && cardText.trim()

  return (
    <Modal title="Quick add card to unit" onClose={onClose}>
      <div className="t-form">

        <FormField label="1. Select a module">
          <select
            className="t-input"
            value={filterModuleId}
            autoFocus
            onChange={e => handleModuleChange(e.target.value)}
          >
            <option value="">Select a module…</option>
            {modules.map(m => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.course_title})
              </option>
            ))}
          </select>
        </FormField>

        {filterModuleId && (
          <FormField label="2. Select a unit">
            <select
              className="t-input"
              value={unitId}
              onChange={e => handleUnitChange(e.target.value)}
            >
              <option value="">Select a unit…</option>
              {filteredUnits.map(u => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </select>
          </FormField>
        )}

        {unitId && (
          <FormField label="3. Card text">
            <input
              className="t-input"
              placeholder="e.g. Herodotus"
              value={cardText}
              onChange={e => setCardText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canSave)
                  onSave({ unitId, unitTitle, cardText })
              }}
            />
          </FormField>
        )}

        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="t-btn t-btn-primary"
            onClick={() => onSave({ unitId, unitTitle, cardText })}
            disabled={!canSave}
          >
            Add card
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add group modal ───────────────────────────────────────────────
function AddGroupModal({ tab, courses, modules, units, onSave, onClose }) {
  const [name, setName]             = useState('')
  const [attachment, setAttachment] = useState('standalone')
  const [courseId, setCourseId]     = useState('')
  const [moduleId, setModuleId]     = useState('')

  function handleAttachmentChange(value) {
    setAttachment(value)
    setCourseId('')
    setModuleId('')
  }

  function handleSave() {
    if (!name.trim()) return
    const payload = { name }
    if (tab === 'content') {
      if (attachment === 'course' && courseId) payload.course_id = courseId
      if (attachment === 'module' && moduleId) payload.module_id = moduleId
    }
    onSave(payload)
  }

  const canSave = name.trim() && (
    attachment === 'standalone' ||
    (attachment === 'course' && courseId) ||
    (attachment === 'module' && moduleId)
  )

  return (
    <Modal
      title={tab === 'function' ? 'New instruction group' : 'New content group'}
      onClose={onClose}
    >
      <div className="t-form">
        <FormField label="Group name">
          <input
            className="t-input"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
            placeholder={tab === 'function' ? 'e.g. Interpretations' : 'e.g. Sources'}
          />
        </FormField>

        {tab === 'content' && (
          <FormField label="Attach to">
            <div className="rr-attach-options">

              <label className="rr-attach-option">
                <input
                  type="radio"
                  name="attachment"
                  checked={attachment === 'standalone'}
                  onChange={() => handleAttachmentChange('standalone')}
                />
                <span>Standalone</span>
              </label>

              <label className="rr-attach-option">
                <input
                  type="radio"
                  name="attachment"
                  checked={attachment === 'course'}
                  onChange={() => handleAttachmentChange('course')}
                />
                <span>Within a course</span>
              </label>

              {attachment === 'course' && (
                <select
                  className="t-input rr-attach-select"
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                >
                  <option value="">Select a course…</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}

              <label className="rr-attach-option">
                <input
                  type="radio"
                  name="attachment"
                  checked={attachment === 'module'}
                  onChange={() => handleAttachmentChange('module')}
                />
                <span>Within a module</span>
              </label>

              {attachment === 'module' && (
                <select
                  className="t-input rr-attach-select"
                  value={moduleId}
                  onChange={e => setModuleId(e.target.value)}
                >
                  <option value="">Select a module…</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.course_title})
                    </option>
                  ))}
                </select>
              )}

            </div>
          </FormField>
        )}

        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="t-btn t-btn-primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Create group
          </button>
        </div>
      </div>
    </Modal>
  )
}
