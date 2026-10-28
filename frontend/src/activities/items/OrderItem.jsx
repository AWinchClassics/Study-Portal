import { useState, useRef } from 'react'
import { gradeOrder } from '../arrange'
import { beginDrag } from '../dragKit'

/**
 * Player UI for ordering tasks.
 * Drag rows to reorder (mouse, pen or touch - on touch, grab the ⋮⋮ handle so the page
 * can still scroll), or use the ↑ / ↓ buttons.
 *
 * Props:
 *   item      - activity_items row (config.items holds the CORRECT order)
 *   initial   - the shuffled starting order shown before the student moves anything
 *   selected  - the student's order so far ([] until they move something)
 *   checked   - locks the task and shows right/wrong
 *   onChange  - function(newOrderArray)
 */
export default function OrderItem({ item, initial, selected, checked, onChange }) {
  const list = selected.length ? selected : initial
  const [dragFrom, setDragFrom] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const rows = useRef([])
  const flags = checked ? gradeOrder(item, list).flags : []
  const allRight = flags.length > 0 && flags.every(Boolean)

  function move(from, to) {
    if (checked || from === to || to < 0 || to >= list.length) return
    const next = [...list]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }

  // Which row is the pointer over? (clamped to the first/last row when above/below the list)
  function rowAt(y) {
    const rects = rows.current.map(el => el?.getBoundingClientRect())
    if (!rects.length || !rects[0]) return 0
    if (y <= rects[0].top) return 0
    const hit = rects.findIndex(r => r && y >= r.top && y <= r.bottom)
    return hit === -1 ? rects.length - 1 : hit
  }

  const startDrag = (i, text) => e => {
    if (checked) return
    if (e.target.closest('.act-order-btn')) return                       // let the arrow buttons work
    if (e.pointerType === 'touch' && !e.target.closest('.act-order-grip')) return // touch: handle only, so the page scrolls
    beginDrag(e, {
      label: text,
      onStart: () => setDragFrom(i),
      onMove: (_x, y) => setOverIdx(rowAt(y)),
      onEnd: ({ y, cancelled }) => {
        const to = rowAt(y)
        setDragFrom(null); setOverIdx(null)
        if (!cancelled) move(i, to)
      },
    })
  }

  return (
    <div className="act-order">
      {!checked && <p className="act-hint">Drag the rows (or use the arrows) to put them in order.</p>}
      <ol className="act-order-list">
        {list.map((text, i) => {
          let cls = 'act-order-row'
          if (checked) cls += flags[i] ? ' act-order-correct' : ' act-order-wrong'
          if (overIdx === i && dragFrom !== null && dragFrom !== i) cls += ' act-order-over'
          if (dragFrom === i) cls += ' act-order-dragging'
          return (
            <li
              key={text}
              ref={el => { rows.current[i] = el }}
              className={cls}
              onPointerDown={startDrag(i, text)}
              onContextMenu={e => e.preventDefault()}
            >
              <span className="act-order-grip" aria-hidden="true">⋮⋮</span>
              <span className="act-order-num">{i + 1}</span>
              <span className="act-order-text">{text}</span>
              {!checked && (
                <span className="act-order-btns">
                  <button type="button" className="act-order-btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${text} up`}>↑</button>
                  <button type="button" className="act-order-btn" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`Move ${text} down`}>↓</button>
                </span>
              )}
              {checked && <span className="qr-option-icon">{flags[i] ? '✓' : '✗'}</span>}
            </li>
          )
        })}
      </ol>
      {checked && !allRight && (
        <div className="act-order-answer">
          <span className="act-preview-label">Correct order</span>
          <ol>{(item.config?.items ?? []).map(t => <li key={t}>{t}</li>)}</ol>
        </div>
      )}
    </div>
  )
}
