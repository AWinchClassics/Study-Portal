import { useState } from 'react'
import { gradeCategorise, categoriseItems } from '../arrange'
import { beginDrag, categoryDropTarget } from '../dragKit'

/**
 * Player UI for categorise tasks: sort items into labelled boxes.
 * Works by tap AND drag (mouse, pen and touch):
 *   - tap an item, then tap a category box to place it
 *   - or tap a category box first ("armed"), then tap items to drop each into it
 *   - tap a placed item to send it back to the pool
 *   - or drag items between the pool and the boxes
 *
 * Props:
 *   item      - activity_items row (config.categories)
 *   order     - array of item indexes (into categoriseItems(config)) in display order
 *   selected  - array aligned to categoriseItems(config): the category NAME placed in, or ''
 *   checked   - locks the task and shows right/wrong
 *   onChange  - function(newArray)
 */
export default function CategoriseItem({ item, order, selected, checked, onChange }) {
  const cats = item.config?.categories ?? []
  const all = categoriseItems(item.config)
  const value = all.map((_, i) => selected[i] ?? '')
  const [chip, setChip] = useState(null)       // picked item index, waiting for a box
  const [armed, setArmed] = useState(null)     // category index waiting for items
  const [hover, setHover] = useState(null)     // category index or 'pool' under the drag
  const [dragging, setDragging] = useState(null)

  const flags = checked ? gradeCategorise(item, value).flags : []

  function put(idx, catIdx) {
    const next = [...value]
    next[idx] = cats[catIdx].name
    onChange(next)
    setChip(null)
  }
  function unplace(idx) {
    const next = [...value]
    next[idx] = ''
    onChange(next)
    setChip(null)
  }

  function clickPoolChip(idx) {
    if (checked) return
    if (armed !== null) return put(idx, armed)
    setChip(c => (c === idx ? null : idx))
  }
  function clickPlacedChip(e, idx) {
    e.stopPropagation() // don't also trigger the box underneath
    if (checked) return
    // an item is picked up: tapping a placed item means "into this item's box"
    if (chip !== null) return put(chip, cats.findIndex(c => c.name === value[idx]))
    // armed on a different category: move it there; otherwise a tap sends it back to the pool
    if (armed !== null && value[idx] !== cats[armed].name) return put(idx, armed)
    unplace(idx)
  }
  function clickBox(ci) {
    if (checked) return
    if (chip !== null) return put(chip, ci)
    setArmed(a => (a === ci ? null : ci))
  }

  const startDrag = idx => e => {
    if (checked) return
    beginDrag(e, {
      label: all[idx].text,
      onStart: () => { setChip(null); setArmed(null); setDragging(idx) },
      onMove: (_x, _y, el) => setHover(categoryDropTarget(el)),
      onEnd: ({ target, cancelled }) => {
        setDragging(null); setHover(null)
        if (cancelled) return
        const dst = categoryDropTarget(target)
        if (dst === 'pool') unplace(idx)
        else if (typeof dst === 'number') put(idx, dst)
      },
    })
  }
  const noMenu = e => e.preventDefault()

  // a plain render helper (NOT a component): a component defined here would remount on every
  // render and break an in-progress drag
  function renderChip(idx, placed) {
    let cls = 'act-pool-chip'
    if (chip === idx) cls += ' act-pool-chip-picked'
    if (dragging === idx) cls += ' act-dim'
    if (checked) cls += flags[idx] ? ' act-chip-ok' : ' act-chip-bad'
    return (
      <button
        key={idx}
        type="button"
        className={cls}
        disabled={checked}
        onPointerDown={startDrag(idx)}
        onContextMenu={noMenu}
        onClick={placed ? e => clickPlacedChip(e, idx) : () => clickPoolChip(idx)}
      >
        {all[idx].text}
        {checked && !flags[idx] && <span className="act-cat-fix"> → {all[idx].cat}</span>}
      </button>
    )
  }

  const free = order.filter(idx => !value[idx])

  return (
    <div className="act-cat">
      {armed !== null && !checked && (
        <p className="act-hint act-cat-armed-hint">
          Adding to <strong>{cats[armed].name}</strong> — tap items to add them.{' '}
          <button type="button" className="t-btn t-btn-ghost act-cat-done" onClick={() => setArmed(null)}>Done</button>
        </p>
      )}
      <div className="act-cat-grid">
        {cats.map((c, ci) => {
          const here = order.filter(idx => value[idx] === c.name)
          let cls = 'act-cat-box'
          if (armed === ci) cls += ' act-cat-armed'
          if (hover === ci) cls += ' act-cat-over'
          return (
            <div
              key={ci}
              className={cls}
              data-cat={ci}
              role="group"
              aria-label={c.name}
              tabIndex={checked ? -1 : 0}
              onClick={() => clickBox(ci)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickBox(ci) } }}
            >
              <div className="act-cat-title">{c.name}</div>
              <div className="act-cat-zone">
                {here.length === 0
                  ? <span className="act-slot-empty">{armed === ci ? 'Tap items to add them' : 'Tap or drop here'}</span>
                  : here.map(idx => renderChip(idx, true))}
              </div>
            </div>
          )
        })}
      </div>

      <div className={`act-pool ${hover === 'pool' ? 'act-pool-over' : ''}`} data-pool>
        {free.length === 0
          ? <span className="act-pool-empty">{checked ? '' : 'All items sorted'}</span>
          : free.map(idx => renderChip(idx, false))}
      </div>
    </div>
  )
}
