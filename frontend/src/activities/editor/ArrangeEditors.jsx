import { useState } from 'react'
import { defaultArrangeConfig, validateArrangeConfig } from '../arrange'

/** Blank draft for a new match / order task. */
export function newArrangeDraft(type) {
  return { type, prompt: '', explanation: '', points: 1, config: defaultArrangeConfig(type) }
}

/** Returns an array of problems (empty = valid). */
export function validateArrangeDraft(d) {
  const errs = validateArrangeConfig(d.type, d.config)
  if (!d.prompt.trim()) errs.unshift('Enter the instruction (e.g. "Match each event to its date").')
  return errs
}

/** Paste-in box: one entry per line. onAdd receives the array of non-empty lines. */
function BulkAdd({ label, placeholder, onAdd }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) {
    return <button type="button" className="t-btn t-btn-ghost" onClick={() => setOpen(true)}>{label}</button>
  }
  return (
    <div className="act-bulk">
      <textarea className="t-input act-textarea" placeholder={placeholder} value={text} autoFocus
        onChange={e => setText(e.target.value)} />
      <div className="act-add-row">
        <button type="button" className="t-btn t-btn-secondary"
          onClick={() => { onAdd(text.split('\n').map(l => l.trim()).filter(Boolean)); setText(''); setOpen(false) }}>
          Add
        </button>
        <button type="button" className="t-btn t-btn-ghost" onClick={() => { setText(''); setOpen(false) }}>Cancel</button>
      </div>
    </div>
  )
}

function Shell({ draft, onChange, errors, children }) {
  return (
    <>
      <input
        className="t-input"
        placeholder={{ match: 'Instruction, e.g. Match each event to its date.', order: 'Instruction, e.g. Put these events in chronological order.', categorise: 'Instruction, e.g. Sort each cause into the correct category.' }[draft.type]}
        value={draft.prompt}
        onChange={e => onChange({ ...draft, prompt: e.target.value })}
      />
      {children}
      <textarea
        className="t-input act-textarea"
        placeholder="Explanation shown after answering (optional)…"
        value={draft.explanation ?? ''}
        onChange={e => onChange({ ...draft, explanation: e.target.value })}
      />
      {errors?.length > 0 && <ul className="act-errors">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
    </>
  )
}

export function MatchEditor({ draft, onChange, errors }) {
  const cfg = draft.config
  const setCfg = patch => onChange({ ...draft, config: { ...cfg, ...patch } })
  const setPair = (i, patch) => setCfg({ pairs: cfg.pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

  // Bulk lines look like "431 BCE | Outbreak of the war" or tab-separated (paste from a spreadsheet)
  function addBulk(lines) {
    const added = lines.map(l => {
      const parts = l.includes('\t') ? l.split('\t') : l.split('|')
      return { left: (parts[0] ?? '').trim(), right: parts.slice(1).join(' ').trim() }
    })
    const kept = cfg.pairs.filter(p => p.left || p.right) // drop untouched blank rows
    setCfg({ pairs: [...kept, ...added] })
  }

  return (
    <Shell draft={draft} onChange={onChange} errors={errors}>
      <div className="act-options">
        <div className="act-pair-head"><span>Left (fixed)</span><span>Right (students place these)</span></div>
        {cfg.pairs.map((p, i) => (
          <div className="act-opt-row" key={i}>
            <input className="t-input" placeholder={`Left ${i + 1}`} value={p.left} onChange={e => setPair(i, { left: e.target.value })} />
            <span className="act-arrow">⇌</span>
            <input className="t-input" placeholder={`Right ${i + 1}`} value={p.right} onChange={e => setPair(i, { right: e.target.value })} />
            {cfg.pairs.length > 2 && (
              <button type="button" className="t-btn t-btn-danger-ghost" title="Remove pair"
                onClick={() => setCfg({ pairs: cfg.pairs.filter((_, j) => j !== i) })}>✕</button>
            )}
          </div>
        ))}
        <div className="act-add-row">
          <button type="button" className="t-btn t-btn-ghost" onClick={() => setCfg({ pairs: [...cfg.pairs, { left: '', right: '' }] })}>+ Add pair</button>
          <BulkAdd label="Paste pairs…" placeholder={'One pair per line:\n431 BCE | Outbreak of the Peloponnesian War\n404 BCE | Fall of Athens'} onAdd={addBulk} />
        </div>
      </div>

      <label className="act-field-label">Extra wrong options (optional, one per line)</label>
      <textarea
        className="t-input act-textarea"
        placeholder="Right-hand items that match nothing, to make it harder."
        value={(cfg.distractors ?? []).join('\n')}
        onChange={e => setCfg({ distractors: e.target.value.split('\n') })}
      />
    </Shell>
  )
}

export function OrderEditor({ draft, onChange, errors }) {
  const cfg = draft.config
  const setItems = items => onChange({ ...draft, config: { ...cfg, items } })
  const move = (i, to) => {
    if (to < 0 || to >= cfg.items.length) return
    const next = [...cfg.items]
    const [x] = next.splice(i, 1)
    next.splice(to, 0, x)
    setItems(next)
  }

  return (
    <Shell draft={draft} onChange={onChange} errors={errors}>
      <p className="act-hint">Enter the items in the <strong>correct</strong> order — students see them shuffled.</p>
      <div className="act-options">
        {cfg.items.map((t, i) => (
          <div className="act-opt-row" key={i}>
            <span className="act-order-num">{i + 1}</span>
            <input className="t-input" placeholder={`Item ${i + 1}`} value={t}
              onChange={e => setItems(cfg.items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="t-order-btn" disabled={i === 0} onClick={() => move(i, i - 1)} title="Move up">↑</button>
            <button type="button" className="t-order-btn" disabled={i === cfg.items.length - 1} onClick={() => move(i, i + 1)} title="Move down">↓</button>
            {cfg.items.length > 2 && (
              <button type="button" className="t-btn t-btn-danger-ghost" title="Remove item"
                onClick={() => setItems(cfg.items.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <div className="act-add-row">
          <button type="button" className="t-btn t-btn-ghost" onClick={() => setItems([...cfg.items, ''])}>+ Add item</button>
          <BulkAdd label="Paste list…" placeholder={'One item per line, in the correct order:\nBattle of Marathon\nBattle of Thermopylae\nBattle of Salamis'}
            onAdd={lines => setItems([...cfg.items.filter(x => x.trim()), ...lines])} />
        </div>
      </div>
    </Shell>
  )
}

export function CategoriseEditor({ draft, onChange, errors }) {
  const cfg = draft.config
  const setCats = categories => onChange({ ...draft, config: { ...cfg, categories } })
  const setCat = (i, patch) => setCats(cfg.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <Shell draft={draft} onChange={onChange} errors={errors}>
      <p className="act-hint">Name each category and list its items, one per line. Students see all items shuffled together.</p>
      <div className="act-cat-edit-grid">
        {cfg.categories.map((c, i) => (
          <div className="act-cat-edit" key={i}>
            <div className="act-opt-row">
              <input className="t-input" placeholder={`Category ${i + 1} name`} value={c.name}
                onChange={e => setCat(i, { name: e.target.value })} />
              {cfg.categories.length > 2 && (
                <button type="button" className="t-btn t-btn-danger-ghost" title="Remove category"
                  onClick={() => setCats(cfg.categories.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
            <textarea
              className="t-input act-textarea"
              placeholder={'One item per line'}
              value={(c.items ?? []).join('\n')}
              onChange={e => setCat(i, { items: e.target.value.split('\n') })}
            />
          </div>
        ))}
      </div>
      <div className="act-add-row">
        <button type="button" className="t-btn t-btn-ghost"
          onClick={() => setCats([...cfg.categories, { name: '', items: [''] }])}>+ Add category</button>
      </div>
    </Shell>
  )
}
