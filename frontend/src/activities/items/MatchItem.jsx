import { useState } from 'react'
import { gradeMatch } from '../arrange'

/**
 * Player UI for matching tasks: place each right-hand item against its left-hand item.
 * Works by tap/click AND drag-and-drop:
 *   - tap a chip, then tap a slot (or a slot, then a chip) to place it
 *   - tap a filled slot to send its chip back to the pool
 *   - on desktop, drag chips onto slots (or back to the pool)
 *
 * Props:
 *   item      - activity_items row (config.pairs, config.distractors)
 *   pool      - array of chip texts in display order
 *   selected  - array (one per pair) of placed texts, '' when empty
 *   checked   - locks the task and shows right/wrong
 *   onChange  - function(newArray)
 */
export default function MatchItem({ item, pool, selected, checked, onChange }) {
  const pairs = item.config?.pairs ?? []
  const value = pairs.map((_, i) => selected[i] ?? '')
  const [chip, setChip] = useState(null)   // chip picked up, waiting for a slot
  const [slot, setSlot] = useState(null)   // slot picked, waiting for a chip
  const [hover, setHover] = useState(null) // slot being dragged over

  const flags = checked ? gradeMatch(item, value).flags : []
  const placed = new Set(value.filter(Boolean))
  const free = pool.filter(t => !placed.has(t))

  function place(i, text) {
    const next = value.map(v => (v === text ? '' : v)) // a chip can only sit in one slot
    next[i] = text
    onChange(next)
    setChip(null); setSlot(null); setHover(null)
  }
  function returnToPool(text) {
    onChange(value.map(v => (v === text ? '' : v)))
    setChip(null); setSlot(null)
  }

  function clickChip(text) {
    if (checked) return
    if (slot !== null) return place(slot, text)
    setChip(c => (c === text ? null : text))
  }
  function clickSlot(i) {
    if (checked) return
    if (chip !== null) return place(i, chip)
    if (value[i]) return returnToPool(value[i])
    setSlot(s => (s === i ? null : i))
  }

  const dragStart = text => e => { e.dataTransfer.setData('text/plain', text); e.dataTransfer.effectAllowed = 'move' }

  return (
    <div className="act-match">
      <div className="act-match-rows">
        {pairs.map((p, i) => {
          const filled = value[i]
          let cls = 'act-slot'
          if (filled) cls += ' act-slot-filled'
          if (slot === i || hover === i) cls += ' act-slot-active'
          if (checked) cls += flags[i] ? ' act-slot-correct' : ' act-slot-wrong'
          return (
            <div className="act-match-row" key={i}>
              <span className="act-match-left">{p.left}</span>
              <div className="act-slot-wrap">
                <button
                  type="button"
                  className={cls}
                  disabled={checked}
                  onClick={() => clickSlot(i)}
                  onDragOver={e => { if (!checked) { e.preventDefault(); setHover(i) } }}
                  onDragLeave={() => setHover(h => (h === i ? null : h))}
                  onDrop={e => { e.preventDefault(); const t = e.dataTransfer.getData('text/plain'); if (t) place(i, t) }}
                  draggable={!!filled && !checked}
                  onDragStart={filled ? dragStart(filled) : undefined}
                  aria-label={filled ? `${p.left}: ${filled}. Tap to remove.` : `Place an item for ${p.left}`}
                >
                  {filled || <span className="act-slot-empty">Tap or drop here</span>}
                </button>
                {checked && !flags[i] && <span className="act-blank-fix">{p.right}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="act-pool"
        onDragOver={e => { if (!checked) e.preventDefault() }}
        onDrop={e => { e.preventDefault(); const t = e.dataTransfer.getData('text/plain'); if (t) returnToPool(t) }}
      >
        {free.length === 0
          ? <span className="act-pool-empty">{checked ? '' : 'All items placed'}</span>
          : free.map(t => (
              <button
                key={t}
                type="button"
                className={`act-pool-chip ${chip === t ? 'act-pool-chip-picked' : ''}`}
                disabled={checked}
                draggable={!checked}
                onDragStart={dragStart(t)}
                onClick={() => clickChip(t)}
              >
                {t}
              </button>
            ))}
      </div>
    </div>
  )
}
