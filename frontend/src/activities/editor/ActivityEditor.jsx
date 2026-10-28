import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { ConfirmButton } from '../../components/teacher/TeacherUI'
import { useActivityItems } from '../useActivityItems'
import { CHOICE_TYPES, TEMPLATE_TYPES, ITEM_TYPES } from '../types'
import ChoiceEditor, { newChoiceDraft, validateChoiceDraft } from './ChoiceEditor'
import TemplateEditor, { newTemplateDraft, validateTemplateDraft } from './TemplateEditor'

/**
 * ActivityEditor - teacher authoring for one activity (a resources row).
 * Add a new task type by adding a branch in renderBody()/validate()/newDraft().
 */

function toDraft(item) {
  const base = {
    id: item.id, type: item.type, prompt: item.prompt,
    explanation: item.explanation ?? '', points: item.points ?? 1,
  }
  if (TEMPLATE_TYPES.includes(item.type)) {
    return { ...base, config: { template: '', ...(item.config ?? {}) } }
  }
  return { ...base, options: item.mc_options.map(o => ({ option_text: o.option_text, is_correct: o.is_correct })) }
}

function newDraft(type) {
  if (CHOICE_TYPES.includes(type)) return newChoiceDraft(type)
  if (TEMPLATE_TYPES.includes(type)) return newTemplateDraft(type)
  throw new Error(`Unknown type ${type}`)
}

function validate(d) {
  if (CHOICE_TYPES.includes(d.type)) return validateChoiceDraft(d)
  if (TEMPLATE_TYPES.includes(d.type)) return validateTemplateDraft(d)
  return ['Unsupported type']
}

function ItemCard({ draft, index, count, errors, saving, dirty, onChange, onSave, onDelete, onMove }) {
  return (
    <div className="act-item">
      <div className="act-item-head">
        <span className="act-item-num">{index + 1}.</span>
        <span className="t-resource-type-pill">{ITEM_TYPES[draft.type]?.label}</span>
        {!draft.id && <span className="t-resource-type-pill">unsaved</span>}
        {draft.id && dirty && <span className="t-resource-type-pill">edited</span>}
        <span className="act-item-spacer" />
        <button className="t-order-btn" disabled={index === 0 || !draft.id} onClick={() => onMove(-1)} title="Move up">↑</button>
        <button className="t-order-btn" disabled={index === count - 1 || !draft.id} onClick={() => onMove(1)} title="Move down">↓</button>
        <button className="t-btn t-btn-primary" onClick={onSave} disabled={saving || (draft.id && !dirty)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <ConfirmButton className="t-btn t-btn-danger-ghost" onConfirm={onDelete}>Delete</ConfirmButton>
      </div>
      {CHOICE_TYPES.includes(draft.type) && (
        <ChoiceEditor draft={draft} onChange={onChange} errors={errors} />
      )}
      {TEMPLATE_TYPES.includes(draft.type) && (
        <TemplateEditor draft={draft} onChange={onChange} errors={errors} />
      )}
    </div>
  )
}

export default function ActivityEditor({ resourceId, onStatus }) {
  const { items, error, reload } = useActivityItems(resourceId)
  const [drafts, setDrafts]   = useState([])   // working copies, same order as items + unsaved
  const [original, setOriginal] = useState({}) // id -> JSON string for dirty check
  const [errors, setErrors]   = useState({})   // key -> string[]
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    if (!items) return
    const d = items.map(toDraft)
    setDrafts(d.map((x, i) => ({ ...x, _key: x.id })))
    setOriginal(Object.fromEntries(d.map(x => [x.id, JSON.stringify(x)])))
    setErrors({})
  }, [items])

  function isDirty(d) {
    if (!d.id) return true
    const { _key, ...rest } = d
    return JSON.stringify(rest) !== original[d.id]
  }

  function updateDraft(key, next) {
    setDrafts(ds => ds.map(d => (d._key === key ? { ...next, _key: key } : d)))
  }

  function addItem(type) {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDrafts(ds => [...ds, { ...newDraft(type), _key: key }])
  }

  async function saveDraft(d) {
    const errs = validate(d)
    if (errs.length) { setErrors(e => ({ ...e, [d._key]: errs })); return }
    setErrors(e => ({ ...e, [d._key]: [] }))
    setSavingKey(d._key)
    try {
      let itemId = d.id
      const row = {
        resource_id: resourceId, type: d.type, prompt: d.prompt.trim(),
        explanation: d.explanation?.trim() || null, points: d.points ?? 1,
      }
      // Only template types send config, so choice-task saves never depend on the config column
      if (TEMPLATE_TYPES.includes(d.type)) row.config = d.config
      if (itemId) {
        const { error } = await supabase.from('activity_items').update(row).eq('id', itemId)
        if (error) throw error
        const { error: delErr } = await supabase.from('mc_options').delete().eq('activity_item_id', itemId)
        if (delErr) throw delErr
      } else {
        const order = drafts.filter(x => x.id).length
        const { data, error } = await supabase.from('activity_items')
          .insert({ ...row, order_index: order }).select('id').single()
        if (error) throw error
        itemId = data.id
      }
      if (CHOICE_TYPES.includes(d.type)) {
        const { error: optErr } = await supabase.from('mc_options').insert(
          d.options.map((o, i) => ({
            activity_item_id: itemId, option_text: o.option_text.trim(),
            is_correct: o.is_correct, order_index: i,
          }))
        )
        if (optErr) throw optErr
      }
      onStatus?.({ type: 'success', msg: 'Task saved.' })
      await reload()
    } catch (e) {
      onStatus?.({ type: 'error', msg: e.message ?? String(e) })
    } finally {
      setSavingKey(null)
    }
  }

  async function deleteDraft(d) {
    if (!d.id) { setDrafts(ds => ds.filter(x => x._key !== d._key)); return }
    const { error } = await supabase.from('activity_items').delete().eq('id', d.id)
    if (error) { onStatus?.({ type: 'error', msg: error.message }); return }
    // close the gap in order_index
    const remaining = drafts.filter(x => x.id && x.id !== d.id)
    await Promise.all(remaining.map((x, i) =>
      supabase.from('activity_items').update({ order_index: i }).eq('id', x.id)))
    await reload()
  }

  async function moveDraft(d, dir) {
    const saved = drafts.filter(x => x.id)
    const i = saved.findIndex(x => x.id === d.id)
    const j = i + dir
    if (j < 0 || j >= saved.length) return
    const a = saved[i], b = saved[j]
    const [r1, r2] = await Promise.all([
      supabase.from('activity_items').update({ order_index: j }).eq('id', a.id),
      supabase.from('activity_items').update({ order_index: i }).eq('id', b.id),
    ])
    if (r1.error || r2.error) { onStatus?.({ type: 'error', msg: (r1.error || r2.error).message }); return }
    await reload()
  }

  if (error) return <p className="page-error">Could not load tasks: {error}</p>
  if (!items) return <div className="loading-pulse">Loading tasks…</div>

  return (
    <div className="act-editor">
      {drafts.length === 0 && <p className="t-empty">No tasks yet. Add one below.</p>}
      {drafts.map((d, i) => (
        <ItemCard
          key={d._key}
          draft={d} index={i} count={drafts.length}
          errors={errors[d._key]}
          saving={savingKey === d._key}
          dirty={isDirty(d)}
          onChange={next => updateDraft(d._key, next)}
          onSave={() => saveDraft(d)}
          onDelete={() => deleteDraft(d)}
          onMove={dir => moveDraft(d, dir)}
        />
      ))}
      <div className="act-add-row">
        {Object.entries(ITEM_TYPES).map(([type, meta]) => (
          <button key={type} className="t-btn t-btn-secondary" onClick={() => addItem(type)} title={meta.hint}>
            + {meta.label}
          </button>
        ))}
      </div>
    </div>
  )
}
