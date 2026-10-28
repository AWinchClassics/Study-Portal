/**
 * Image task types: config shapes, hit-testing, validation and grading.
 * All coordinates are PERCENTAGES (0-100) of the image width / height, so tasks
 * look right at any screen size.
 *
 *   imageclick  config: { image:{url,w,h,alt}, regions:[{ id, name, correct, shape,
 *                 rect:   x, y, w, h
 *                 circle: cx, cy, rx, ry   (ellipse; a circle when drawn)
 *                 poly:   points:[[x,y],...] }] }
 *               response: array of selected region ids. Correct = exactly the correct set.
 *
 *   imagefind   config: same regions as imageclick (correct flag ignored). Each region's NAME is
 *               shown as a prompt; the student taps where it is. Every region is a target.
 *               response: array aligned to regions: the region id tapped for each prompt, '' if none.
 *
 *   imagelabel  config: { image, mode:'drag'|'type', pins:[{ id, x, y, answer }],
 *                 distractors:[] (drag only), typo, caseSensitive (type only) }
 *               drag: answer = the label text.  type: answer = accepted answers, "a|b".
 *               response: array (one per pin) of the label placed / text typed, '' if empty.
 */
import { isBlankCorrect } from './template'

export const IMAGE_TYPES = ['imageclick', 'imagelabel', 'imagefind']
export const IMAGE_BUCKET = 'activity-images'

const clean = s => String(s ?? '').trim()
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))
export const round = v => Math.round(v * 100) / 100
let seq = 0
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function defaultImageConfig(type) {
  return type === 'imageclick' || type === 'imagefind'
    ? { image: null, regions: [] }
    : { image: null, mode: 'drag', pins: [], distractors: [], typo: true, caseSensitive: false }
}

/** Does point (px,py) (in %, using the image's aspect for circles) fall inside the region? */
export function hitRegion(r, px, py) {
  if (r.shape === 'rect') return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
  if (r.shape === 'circle') {
    const dx = (px - r.cx) / (r.rx || 1), dy = (py - r.cy) / (r.ry || 1)
    return dx * dx + dy * dy <= 1
  }
  if (r.shape === 'poly') {
    const pts = r.points ?? []
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  return false
}

/** Topmost (last-drawn, smallest wins) region under a point, or null. */
export function regionAt(regions, px, py) {
  const hits = (regions ?? []).filter(r => hitRegion(r, px, py))
  return hits.length ? hits[hits.length - 1] : null
}

/** Centre of a region in %, for placing a badge. */
export function regionCentre(r) {
  if (r.shape === 'rect') return [r.x + r.w / 2, r.y + r.h / 2]
  if (r.shape === 'circle') return [r.cx, r.cy]
  const pts = r.points ?? []
  if (!pts.length) return [50, 50]
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
}

export function cleanImageConfig(type, cfg) {
  const image = cfg?.image ? { url: cfg.image.url, w: cfg.image.w, h: cfg.image.h, alt: clean(cfg.image.alt) } : null
  if (type === 'imageclick' || type === 'imagefind') {
    return {
      image,
      regions: (cfg?.regions ?? []).map(r => {
        const base = { id: r.id, name: clean(r.name), correct: !!r.correct, shape: r.shape }
        if (r.shape === 'rect') return { ...base, x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }
        if (r.shape === 'circle') return { ...base, cx: round(r.cx), cy: round(r.cy), rx: round(r.rx), ry: round(r.ry) }
        return { ...base, points: (r.points ?? []).map(p => [round(clamp(p[0])), round(clamp(p[1]))]) }
      }),
    }
  }
  return {
    image,
    mode: cfg?.mode === 'type' ? 'type' : 'drag',
    pins: (cfg?.pins ?? []).map(p => ({ id: p.id, x: round(clamp(p.x)), y: round(clamp(p.y)), answer: clean(p.answer) })),
    distractors: (cfg?.distractors ?? []).map(clean).filter(Boolean),
    typo: cfg?.typo !== false,
    caseSensitive: !!cfg?.caseSensitive,
  }
}

export function validateImageConfig(type, raw) {
  const errs = []
  const cfg = cleanImageConfig(type, raw)
  if (!cfg.image?.url) { errs.push('Upload an image first.'); return errs }
  if (type === 'imagefind') {
    const names = cfg.regions.map(r => r.name)
    if (cfg.regions.length < 2) errs.push('Draw at least two regions to find.')
    if (names.some(n => !n)) errs.push('Give every region a name - it is the prompt students see.')
    if (new Set(names).size !== names.length) errs.push('Region names must all be different.')
  }
  if (type === 'imageclick') {
    const { regions } = cfg
    if (!regions.length) errs.push('Draw at least one region on the image.')
    if (!regions.some(r => r.correct)) errs.push('Mark at least one region as correct.')
    if (regions.some(r => !r.name)) errs.push('Give every region a name (shown in the answer review).')
  }
  if (type !== 'imagelabel') {
    const regions = cfg.regions
    const bad = regions.some(r =>
      (r.shape === 'rect' && (r.w < 0.5 || r.h < 0.5)) ||
      (r.shape === 'circle' && (r.rx < 0.3 || r.ry < 0.3)) ||
      (r.shape === 'poly' && r.points.length < 3))
    if (bad) errs.push('One of the regions is too small - redraw or delete it.')
  }
  if (type === 'imagelabel') {
    const { pins, distractors, mode } = cfg
    if (pins.length < 1) errs.push('Place at least one pin on the image.')
    if (pins.some(p => !p.answer)) errs.push('Every pin needs an answer.')
    if (mode === 'drag') {
      const answers = pins.map(p => p.answer)
      if (new Set(answers).size !== answers.length) errs.push('Drag labels must all be different (students place each label once).')
      if (distractors.some(d => answers.includes(d)) || new Set(distractors).size !== distractors.length) {
        errs.push('Extra labels must differ from the pin answers and from each other.')
      }
    }
  }
  return errs
}

export const acceptedAnswers = pin => String(pin.answer ?? '').split('|').map(clean).filter(Boolean)

/** Per-part grading. */
export function gradeImage(item, response) {
  const cfg = item.config ?? {}
  if (item.type === 'imagefind') {
    const regions = cfg.regions ?? []
    const flags = regions.map((r, i) => (response ?? [])[i] === r.id)
    return { flags, allCorrect: regions.length > 0 && flags.every(Boolean) }
  }
  if (item.type === 'imageclick') {
    const chosen = new Set(response ?? [])
    const regions = cfg.regions ?? []
    const flags = regions.map(r => chosen.has(r.id) === !!r.correct)
    return { flags, allCorrect: regions.some(r => r.correct) && flags.every(Boolean) }
  }
  const pins = cfg.pins ?? []
  const flags = pins.map((p, i) => {
    const v = (response ?? [])[i]
    if (cfg.mode === 'type') return isBlankCorrect({ kind: 'cloze', answers: acceptedAnswers(p) }, v, cfg)
    return !!v && v === p.answer
  })
  return { flags, allCorrect: pins.length > 0 && flags.every(Boolean) }
}

/** Labels offered in the pool for a drag-label task. */
export const labelPool = cfg => [...(cfg?.pins ?? []).map(p => p.answer), ...(cfg?.distractors ?? [])]
