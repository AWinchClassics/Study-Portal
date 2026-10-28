import { useState } from 'react'
import { gradeMatch } from '../arrange'
import { beginDrag, matchDropTarget } from '../dragKit'

/**
 * Player UI for matching tasks: place each right-hand item against its left-hand item.
 * Works by tap/click AND drag (mouse, pen and touch, via dragKit):
 *   - tap a chip, then tap a slot (or a slot, then a chip) to place it
 *   - tap a filled slot to send its chip back to the pool
 *   - or drag a chip onto a slot (or back to the pool)
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
  const [hover, setHover] = useState(null) // slot index (or 'pool') being dragged over
  const [dragging, setDragging] = useState(null) // text of the chip being dragged

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

  // Press-and-drag a chip (from the pool or from a slot) onto a slot or back to the pool
  const startDrag = text => e => {
    if (checked) return
    beginDrag(e, {
      label: text,
      onStart: () => { setChip(null); setSlot(null); setDragging(text) },
      onMove: (_x, _y, el) => setHover(matchDropTarget(el)),
      onEnd: ({ target, cancelled }) => {
        setDragging(null); setHover(null)
        if (cancelled) return
        const dst = matchDropTarget(target)
        if (dst === 'pool') returnToPool(text)
        else if (typeof dst === 'number') place(dst, text)
      },
    })
  }
  const noMenu = e => e.preventDefault() // long-press on touch would open a context menu

  return (
    <div className="act-match">
      <div className="act-match-rows">
        {pairs.map((p, i) => {
          const filled = value[i]
          let cls = 'act-slot'
          if (filled) cls += ' act-slot-filled'
          if (slot === i || hover === i) cls += ' act-slot-active'
          if (filled && dragging === filled) cls += ' act-dim'
          if (checked) cls += flags[i] ? ' act-slot-correct' : ' act-slot-wrong'
          return (
            <div className="act-match-row" key={i}>
              <span className="act-match-left">{p.left}</span>
              <div className="act-slot-wrap">
                <button
                  type="button"
                  className={cls}
                  disabled={checked}
                  data-slot={i}
                  onClick={() => clickSlot(i)}
                  onPointerDown={filled ? startDrag(filled) : undefined}
                  onContextMenu={noMenu}
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

      <div className={`act-pool ${hover === 'pool' ? 'act-pool-over' : ''}`} data-pool>
        {free.length === 0
          ? <span className="act-pool-empty">{checked ? '' : 'All items placed'}</span>
          : free.map(t => (
              <button
                key={t}
                type="button"
                className={`act-pool-chip ${chip === t ? 'act-pool-chip-picked' : ''} ${dragging === t ? 'act-dim' : ''}`}
                disabled={checked}
                onPointerDown={startDrag(t)}
                onContextMenu={noMenu}
                onClick={() => clickChip(t)}
              >
                {t}
              </button>
            ))}
      </div>
    </div>
  )
}
