import { useState } from 'react'
import { gradeOrder } from '../arrange'

/**
 * Player UI for ordering tasks.
 * Drag rows to reorder (desktop) or use the ↑ / ↓ buttons (touch, keyboard).
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
  const flags = checked ? gradeOrder(item, list).flags : []
  const allRight = flags.length > 0 && flags.every(Boolean)

  function move(from, to) {
    if (checked || from === to || to < 0 || to >= list.length) return
    const next = [...list]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }

  return (
    <div className="act-order">
      {!checked && <p className="act-hint">Drag to reorder, or use the arrows.</p>}
      <ol className="act-order-list">
        {list.map((text, i) => {
          let cls = 'act-order-row'
          if (checked) cls += flags[i] ? ' act-order-correct' : ' act-order-wrong'
          if (overIdx === i && dragFrom !== null && dragFrom !== i) cls += ' act-order-over'
          if (dragFrom === i) cls += ' act-order-dragging'
          return (
            <li
              key={text}
              className={cls}
              draggable={!checked}
              onDragStart={e => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', text) }}
              onDragOver={e => { if (!checked && dragFrom !== null) { e.preventDefault(); setOverIdx(i) } }}
              onDrop={e => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setOverIdx(null) }}
              onDragEnd={() => { setDragFrom(null); setOverIdx(null) }}
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
