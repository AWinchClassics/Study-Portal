import { useRef } from 'react'
import ImageStage, { RegionShape, RegionBadge, pctFromEvent } from './ImageStage'
import { regionAt, gradeImage } from '../image'

/**
 * Player for click-to-identify tasks: tap the correct part(s) of the image.
 * response = array of selected region ids.
 * Regions are invisible until chosen; after checking, correct ones go green,
 * missed ones are outlined, wrong picks go red.
 */
export default function ImageClickItem({ item, selected, checked, onChange }) {
  const cfg = item.config ?? {}
  const regions = cfg.regions ?? []
  const stage = useRef(null)
  const nCorrect = regions.filter(r => r.correct).length
  const single = nCorrect === 1
  const chosen = new Set(selected ?? [])
  const flags = checked ? gradeImage(item, selected).flags : []

  function onPointerUp(e) {
    if (checked || (e.pointerType === 'mouse' && e.button !== 0)) return
    const [x, y] = pctFromEvent(stage.current, e)
    const r = regionAt(regions, x, y)
    if (!r) return
    if (single) onChange(chosen.has(r.id) ? [] : [r.id])
    else onChange(chosen.has(r.id) ? [...chosen].filter(id => id !== r.id) : [...chosen, r.id])
  }

  const shapes = regions.map((r, i) => {
    let cls = chosen.has(r.id) ? 'act-region-picked' : ''
    if (checked) {
      if (chosen.has(r.id)) cls = r.correct ? 'act-region-ok' : 'act-region-bad'
      else if (r.correct) cls = 'act-region-missed'
      else cls = 'act-region-off'
    }
    return <RegionShape key={r.id} r={r} className={cls} data-flag={flags[i]} />
  })

  return (
    <div className="act-img-wrap">
      <p className="act-img-hint">
        {checked ? 'Green = correct, red = wrong pick, dashed = missed.'
          : single ? 'Tap the correct area on the image.'
          : `Tap every correct area on the image (${nCorrect}).`}
      </p>
      <ImageStage image={cfg.image} stageRef={stage} shapes={shapes} className={checked ? '' : 'act-img-clickable'}
        onPointerUp={onPointerUp}>
        {checked && regions.filter(r => r.correct || chosen.has(r.id)).map(r => (
          <RegionBadge key={r.id} r={r} text={r.name} className={r.correct ? 'act-badge-ok' : 'act-badge-bad'} />
        ))}
      </ImageStage>
    </div>
  )
}
