import { useState, useRef } from 'react'
import ImageStage from './ImageStage'
import { gradeImage, acceptedAnswers } from '../image'
import { beginDrag, pinDropTarget } from '../dragKit'

/**
 * Player for labelling tasks.
 *  mode 'drag': drag a label from the pool onto a numbered pin (or its row below), or tap a
 *               label then tap a pin / row. Tap a filled row to send the label back.
 *  mode 'type': numbered pins on the image, numbered answer boxes in a list below.
 * response = array (one per pin) of label text / typed text, '' when empty.
 */
export default function ImageLabelItem({ item, pool, selected, checked, onChange, onSubmit }) {
  const cfg = item.config ?? {}
  const pins = cfg.pins ?? []
  const isType = cfg.mode === 'type'
  const value = pins.map((_, i) => selected?.[i] ?? '')
  const flags = checked ? gradeImage(item, value).flags : []

  const [chip, setChip] = useState(null)      // label picked, waiting for a pin
  const [slot, setSlot] = useState(null)      // pin picked, waiting for a label
  const [hover, setHover] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [focus, setFocus] = useState(null)    // type mode: active box
  const inputs = useRef([])

  const placed = new Set(value.filter(Boolean))
  const free = (pool ?? []).filter(t => !placed.has(t))

  function place(i, text) {
    const next = value.map(v => (v === text ? '' : v))
    next[i] = text
    onChange(next)
    setChip(null); setSlot(null); setHover(null)
  }
  function back(text) { onChange(value.map(v => (v === text ? '' : v))); setChip(null); setSlot(null) }

  function tapTarget(i) {          // pin or row, drag mode
    if (checked) return
    if (chip !== null) return place(i, chip)
    if (value[i]) return back(value[i])
    setSlot(s => (s === i ? null : i))
  }
  function tapChip(text) {
    if (checked) return
    if (slot !== null) return place(slot, text)
    setChip(c => (c === text ? null : text))
  }
  const startDrag = text => e => {
    if (checked) return
    beginDrag(e, {
      label: text,
      onStart: () => { setChip(null); setSlot(null); setDragging(text) },
      onMove: (_x, _y, el) => setHover(pinDropTarget(el)),
      onEnd: ({ target, cancelled }) => {
        const t = cancelled ? null : pinDropTarget(target)
        if (t === 'pool') back(text)
        else if (t !== null) place(t, text)
        setDragging(null); setHover(null)
      },
    })
  }

  function setTyped(i, v) { const next = [...value]; next[i] = v; onChange(next) }
  function pinTap(i) {
    if (isType) { if (!checked) inputs.current[i]?.focus() } else tapTarget(i)
  }
  function onKey(i, e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i + 1 < pins.length) inputs.current[i + 1]?.focus()
    else onSubmit?.()
  }

  const pinState = i => checked ? (flags[i] ? 'act-pin-ok' : 'act-pin-bad')
    : (isType ? (focus === i ? 'act-pin-active' : (value[i].trim() ? 'act-pin-filled' : ''))
      : (value[i] ? 'act-pin-filled' : slot === i ? 'act-pin-active' : hover === i ? 'act-pin-over' : ''))

  const chipBtn = (text, extra = '') => (
    <button key={text} type="button" disabled={checked}
      className={`act-pool-chip ${chip === text ? 'act-pool-chip-picked' : ''} ${dragging === text ? 'act-dim' : ''} ${extra}`}
      onPointerDown={startDrag(text)} onContextMenu={e => e.preventDefault()} onClick={() => tapChip(text)}>{text}</button>
  )

  return (
    <div className="act-img-wrap">
      <ImageStage image={cfg.image}>
        {pins.map((p, i) => (
          <button key={p.id} type="button" data-pin={isType ? undefined : i}
            className={`act-pin ${pinState(i)}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={`Pin ${i + 1}`} onClick={() => pinTap(i)}>{i + 1}</button>
        ))}
      </ImageStage>

      {isType ? (
        <ol className="act-pin-list">
          {pins.map((p, i) => (
            <li key={p.id} className="act-pin-row">
              <span className={`act-pin-num ${pinState(i)}`}>{i + 1}</span>
              <input ref={el => { inputs.current[i] = el }} className={`act-blank act-pin-input ${checked ? (flags[i] ? 'act-blank-correct' : 'act-blank-wrong') : ''}`}
                value={value[i]} disabled={checked} placeholder="Type your answer"
                autoCapitalize="off" autoComplete="off" spellCheck={false}
                onFocus={() => setFocus(i)} onBlur={() => setFocus(f => (f === i ? null : f))}
                onChange={e => setTyped(i, e.target.value)} onKeyDown={e => onKey(i, e)} />
              {checked && !flags[i] && <span className="act-blank-fix">{acceptedAnswers(p)[0]}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <>
          <ol className="act-pin-list">
            {pins.map((p, i) => (
              <li key={p.id} className="act-pin-row">
                <span className={`act-pin-num ${pinState(i)}`}>{i + 1}</span>
                <div data-pin={i} role="button" tabIndex={0}
                  className={`act-slot ${value[i] ? 'act-slot-filled' : ''} ${slot === i ? 'act-slot-active' : ''} ${hover === i ? 'act-pool-over' : ''} ${checked ? (flags[i] ? 'act-slot-correct' : 'act-slot-wrong') : ''}`}
                  onPointerDown={value[i] ? startDrag(value[i]) : undefined}
                  onClick={() => tapTarget(i)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapTarget(i) } }}>
                  {value[i] || <span className="act-slot-empty">drop label here</span>}
                </div>
                {checked && !flags[i] && <span className="act-blank-fix">{p.answer}</span>}
              </li>
            ))}
          </ol>
          <div data-pool className={`act-pool ${hover === 'pool' ? 'act-pool-over' : ''}`}>
            {free.length ? free.map(t => chipBtn(t)) : <span className="act-slot-empty">All labels placed</span>}
          </div>
        </>
      )}
    </div>
  )
}
