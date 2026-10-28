import { useRef } from 'react'
import ImageStage, { RegionShape, RegionBadge, pctFromEvent } from './ImageStage'
import { regionAt, gradeImage } from '../image'

/**
 * Player for "find on image" tasks. Each region's name pops up as a prompt, one at a time
 * (random order); the student taps where it is. response = region id tapped per region index.
 * After checking: green = found, red = wrong spot (with the right one dashed).
 */
export default function ImageFindItem({ item, order, selected, checked, onChange }) {
  const cfg = item.config ?? {}
  const regions = cfg.regions ?? []
  const stage = useRef(null)
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
  }
  function undo() {
    if (checked || answered === 0) return
    const last = [...seq].reverse().find(i => value[i])
    const next = [...value]; next[last] = ''
    onChange(next)
  }

  const shapes = regions.map((r, i) => {
    let cls = ''
    if (checked) {
      const pickedHere = Object.values(value).includes(r.id)
      cls = flags[i] ? 'act-region-ok' : 'act-region-missed'
      if (!flags[i] && pickedHere) cls = 'act-region-bad'
    }
    return <RegionShape key={r.id} r={r} className={cls} />
  })
  const nameOf = id => regions.find(r => r.id === id)?.name

  return (
    <div className="act-img-wrap">
      {!checked && (
        <div className="act-find-prompt" aria-live="polite">
          {step >= 0
            ? <><span className="act-find-count">{answered + 1} / {regions.length}</span> Tap: <strong>{regions[seq[step]]?.name}</strong></>
            : <>All placed - press Check answer.</>}
          {answered > 0 && <button type="button" className="qr-btn qr-btn-ghost act-find-undo" onClick={undo}>↶ Undo</button>}
        </div>
      )}
      <ImageStage image={cfg.image} stageRef={stage} shapes={shapes}
        className={checked || step < 0 ? '' : 'act-img-clickable'} onPointerUp={onPointerUp}>
        {!checked && seq.filter(i => value[i] && value[i] !== '-').map(i => {
          const r = regions.find(q => q.id === value[i])
          return r ? <RegionBadge key={i} r={r} text={regions.findIndex(q => q.id === value[i]) >= 0 ? `${seq.indexOf(i) + 1}` : ''} /> : null
        })}
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
