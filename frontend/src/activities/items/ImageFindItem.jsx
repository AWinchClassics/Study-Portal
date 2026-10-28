import { useRef, useState, useEffect } from 'react'
import ImageStage, { RegionShape, RegionBadge, pctFromEvent } from './ImageStage'
import { regionAt, gradeImage } from '../image'

/**
 * Player for "find on image" tasks. Each region's name pops up as a prompt, one at a time
 * (random order); the student taps where it is. response = region id tapped per region index.
 * Feedback is instant: green = found, red = wrong spot (the right one dashed). Answers are locked once tapped; red fades after ~1s; green and the dashed correct area stay.
 */
export default function ImageFindItem({ item, order, selected, checked, onChange }) {
  const cfg = item.config ?? {}
  const regions = cfg.regions ?? []
  const stage = useRef(null)
  const [flash, setFlash] = useState(null)   // { idx } of the last wrong answer, shown briefly
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const value = regions.map((_, i) => selected?.[i] ?? '')
  const seq = order ?? regions.map((_, i) => i)
  const step = seq.findIndex(i => !value[i])          // -1 once everything is answered
  const flags = checked ? gradeImage(item, value).flags : []
  const answered = seq.filter(i => value[i]).length

  function onPointerUp(e) {
    if (checked || step < 0 || (e.pointerType === 'mouse' && e.button !== 0)) return
    const [x, y] = pctFromEvent(stage.current, e)
    const r = regionAt(regions, x, y)
    // tapping empty space still counts as an answer (a miss) so students can't probe for hits
    const next = [...value]; next[seq[step]] = r ? r.id : '-'
    onChange(next)
    if (!r || r.id !== regions[seq[step]].id) {
      setFlash({ idx: seq[step] })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setFlash(null), 1200)
    } else setFlash(null)
  }

  // Instant feedback: every answered prompt is coloured straight away
  const rank = { 'act-region-missed': 1, 'act-region-bad': 2, 'act-region-ok': 3 }
  const cls = {}
  const mark = (id, c) => { if (!cls[id] || rank[c] > rank[cls[id]]) cls[id] = c }
  regions.forEach((r, i) => {
    if (!value[i]) return
    // while playing, the wrong tap is red only briefly (so it never looks like a no-go area); the dashed target stays
    if (value[i] === r.id) mark(r.id, 'act-region-ok')
    else { mark(r.id, 'act-region-missed'); if (value[i] !== '-' && (checked || flash?.idx === i)) mark(value[i], 'act-region-bad') }
  })
  const shapes = regions.map(r => <RegionShape key={r.id} r={r} className={cls[r.id] ?? ''} />)
  const lastIdx = [...seq].reverse().find(i => value[i])
  const lastOk = lastIdx !== undefined && value[lastIdx] === regions[lastIdx]?.id
  const showLast = lastIdx !== undefined && (lastOk || flash?.idx === lastIdx)

  const nameOf = id => regions.find(r => r.id === id)?.name

  return (
    <div className="act-img-wrap">
      {!checked && (
        <div className="act-find-prompt" aria-live="polite">
          {step >= 0
            ? <><span className="act-find-count">{answered + 1} / {regions.length}</span> Tap: <strong>{regions[seq[step]]?.name}</strong></>
            : <>All placed - press Check answer.</>}
          {showLast && (
            <span className={`act-find-last ${lastOk ? 'act-find-ok' : 'act-find-bad'}`}>
              {lastOk ? '✓ Correct' : `✗ ${regions[lastIdx].name} is the dashed area`}
            </span>
          )}
        </div>
      )}
      <ImageStage image={cfg.image} stageRef={stage} shapes={shapes}
        className={checked || step < 0 ? '' : 'act-img-clickable'} onPointerUp={onPointerUp}>
        {checked && regions.map((r, i) => <RegionBadge key={r.id} r={r} text={r.name} className={flags[i] ? 'act-badge-ok' : 'act-badge-bad'} />)}
      </ImageStage>
      {checked && (
        <ul className="act-find-results">
          {regions.map((r, i) => (
            <li key={r.id} className={flags[i] ? 'act-find-ok' : 'act-find-bad'}>
              {flags[i] ? '✓' : '✗'} {r.name}{!flags[i] && <> - you tapped {value[i] && value[i] !== '-' ? nameOf(value[i]) : 'empty space'}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
