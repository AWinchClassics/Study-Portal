import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { ConfirmButton, StatusMessage, Modal, FormField } from '../../components/teacher/TeacherUI'

// ── Reusable card list editor ──────────────────────────────────
function CardGroupEditor({ group, onAddCard, onDeleteCard, onDeleteGroup, onRenameGroup }) {
  const [expanded, setExpanded] = useState(false)
  const [newCard, setNewCard]   = useState('')

  function handleAddCard() {
    const text = newCard.trim()
    if (!text) return
    onAddCard(group.id, text)
    setNewCard('')
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
          <span className="t-list-meta" style={{ marginLeft: 8 }}>
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
            <p className="t-empty" style={{ padding: '8px 0', border: 'none' }}>
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

// ── Main page ──────────────────────────────────────────────────
export default function TeacherRandomiserPage() {
  const [tab, setTab]             = useState('function') // 'function' | 'content'
  const [funcGroups, setFuncGroups] = useState([])
  const [contentGroups, setContentGroups] = useState([])
  const [loading, setLoading]     = useState(true)
  const [status, setStatus]       = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { data: fg }, { data: fc },
      { data: cg }, { data: cc },
    ] = await Promise.all([
      supabase.from('randomiser_function_groups').select('id, name, order_index').order('order_index'),
      supabase.from('randomiser_function_cards').select('id, group_id, text, order_index').order('order_index'),
      supabase.from('randomiser_content_groups').select('id, name, order_index').order('order_index'),
      supabase.from('randomiser_content_cards').select('id, group_id, text, order_index').order('order_index'),
    ])

    setFuncGroups((fg ?? []).map(g => ({
      ...g, cards: (fc ?? []).filter(c => c.group_id === g.id)
    })))
    setContentGroups((cg ?? []).map(g => ({
      ...g, cards: (cc ?? []).filter(c => c.group_id === g.id)
    })))
    setLoading(false)
  }

  // ── Group operations ──
  async function handleAddGroup(name) {
    const table = tab === 'function' ? 'randomiser_function_groups' : 'randomiser_content_groups'
    const currentGroups = tab === 'function' ? funcGroups : contentGroups
    const { data, error } = await supabase
      .from(table)
      .insert({ name: name.trim(), order_index: currentGroups.length })
      .select().single()
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

  // ── Card operations ──
  async function handleAddCard(groupId, text) {
    const table = tab === 'function' ? 'randomiser_function_cards' : 'randomiser_content_cards'
    const groups = tab === 'function' ? funcGroups : contentGroups
    const group  = groups.find(g => g.id === groupId)
    const { data, error } = await supabase
      .from(table)
      .insert({ group_id: groupId, text, order_index: group?.cards.length ?? 0 })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }

    const updater = groups => groups.map(g =>
      g.id === groupId ? { ...g, cards: [...g.cards, data] } : g
    )
    if (tab === 'function') setFuncGroups(updater)
    else setContentGroups(updater)
  }

  async function handleDeleteCard(cardId, groupId) {
    const table = tab === 'function' ? 'randomiser_function_cards' : 'randomiser_content_cards'
    const { error } = await supabase.from(table).delete().eq('id', cardId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }

    const updater = groups => groups.map(g =>
      g.id === groupId ? { ...g, cards: g.cards.filter(c => c.id !== cardId) } : g
    )
    if (tab === 'function') setFuncGroups(updater)
    else setContentGroups(updater)
  }

  const activeGroups = tab === 'function' ? funcGroups : contentGroups

  return (
    <TeacherLayout
      title="Randomiser Cards"
      actions={
        <button className="t-btn t-btn-primary" onClick={() => setShowAddGroup(true)}>
          + New group
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      {/* Tabs */}
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
          ? 'These instruction cards appear in the chunk randomiser and full randomiser. Students select which categories to include.'
          : 'These extra content cards appear alongside chunk topics in the full randomiser. Useful for adding sources, themes, or cross-topic items.'}
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
            <CardGroupEditor
              key={group.id}
              group={group}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onDeleteGroup={handleDeleteGroup}
              onRenameGroup={() => {}}
            />
          ))}
        </div>
      )}

      {/* Add group modal */}
      {showAddGroup && (
        <AddGroupModal
          onSave={handleAddGroup}
          onClose={() => setShowAddGroup(false)}
          label={tab === 'function' ? 'instruction group' : 'content group'}
        />
      )}
    </TeacherLayout>
  )
}

function AddGroupModal({ onSave, onClose, label }) {
  const [name, setName] = useState('')
  return (
    <Modal title={`New ${label}`} onClose={onClose}>
      <div className="t-form">
        <FormField label="Group name">
          <input
            className="t-input"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name) }}
            placeholder={`e.g. ${label === 'instruction group' ? 'Interpretations' : 'Key Figures'}`}
          />
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="t-btn t-btn-primary"
            onClick={() => name.trim() && onSave(name)}
          >
            Create group
          </button>
        </div>
      </div>
    </Modal>
  )
}
