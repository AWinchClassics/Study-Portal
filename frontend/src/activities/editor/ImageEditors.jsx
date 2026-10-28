import { useRef, useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import ImageStage, { RegionShape, pctFromEvent } from '../items/ImageStage'
import { defaultImageConfig, validateImageConfig, newId, round, IMAGE_BUCKET } from '../image'

/* ── drafts / validation (used by ActivityEditor) ───────────── */
export function newImageDraft(type) {
  return { type, prompt: '', explanation: '', points: 1, config: defaultImageConfig(type) }
}
export function validateImageDraft(d) { return validateImageConfig(d.type, d.config) }

const MAX_SIDE = 1800
const MAX_BYTES = 8 * 1024 * 1024
const clamp = v => Math.min(100, Math.max(0, v))

/** Track a pointer (mouse/touch/pen) until release. Calls onMove(pctX, pctY). */
function track(e, stageEl, onMove, onEnd) {
  e.preventDefault(); e.stopPropagation()
  const id = e.pointerId
  const pt = ev => { const [x, y] = pctFromEvent(stageEl, ev); return [clamp(x), clamp(y)] }
  const move = ev => { if (ev.pointerId === id) { ev.preventDefault(); onMove(...pt(ev)) } }
  const up = ev => {
    if (ev.pointerId !== id) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onEnd?.(...pt(ev))
  }
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** Resize big photos in the browser so pages stay quick; returns { blob, w, h, ext }. */
async function prepareImage(file) {
  const bitmapUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file could not be read as an image.')); i.src = bitmapUrl
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
    if (scale === 1 && /^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      return { blob: file, w, h, ext: file.type.split('/')[1].replace('jpeg', 'jpg') }
    }
    const png = file.type === 'image/png'
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    const blob = await new Promise(r => canvas.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88))
    return { blob, w, h, ext: png ? 'png' : 'jpg' }
  } finally { URL.revokeObjectURL(bitmapUrl) }
}

/** Upload / replace the task image. Changing the image keeps regions & pins (positions are %). */
function ImageUpload({ image, onChange, onStatus }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (PNG, JPG, WebP or GIF).'); return }
    if (file.size > MAX_BYTES) { setErr('That image is over 8 MB - please use a smaller one.'); return }
    setBusy(true)
    try {
      const { blob, w, h, ext } = await prepareImage(file)
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type || `image/${ext}`, cacheControl: '31536000' })
      if (error) throw error
      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
      onChange({ url: data.publicUrl, w, h, alt: image?.alt ?? '' })
    } catch (ex) {
      setErr(`Upload failed: ${ex.message ?? ex}. (Has 05_activities_step5.sql been run?)`)
      onStatus?.({ type: 'error', msg: 'Image upload failed.' })
    } finally { setBusy(false) }
  }
  return (
    <div className="act-img-upload">
      <label className="t-btn t-btn-secondary act-file-btn">
        {busy ? 'Uploading…' : image ? 'Replace image' : 'Upload image'}
        <input type="file" accept="image/*" onChange={pick} disabled={busy} hidden />
      </label>
      {image && (
        <input className="t-input" placeholder="Describe the image for screen readers (optional)"
          value={image.alt ?? ''} onChange={e => onChange({ ...image, alt: e.target.value })} />
      )}
      {err && <p className="page-error act-img-err">{err}</p>}
    </div>
  )
}

function Frame({ draft, onChange, errors, placeholder, children }) {
  const cfg = draft.config
  return (
    <>
      <input className="t-input" placeholder={placeholder} value={draft.prompt}
        onChange={e => onChange({ ...draft, prompt: e.target.value })} />
      <ImageUpload image={cfg.image} onChange={image => onChange({ ...draft, config: { ...cfg, image } })} />
      {cfg.image && children}
      <textarea className="t-input act-textarea" placeholder="Explanation shown after answering (optional)…"
        value={draft.explanation ?? ''} onChange={e => onChange({ ...draft, explanation: e.target.value })} />
      {errors?.length > 0 && <ul className="act-errors">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
    </>
  )
}

/* ── click-to-identify editor ───────────────────────────────── */
const TOOLS = [
  ['select', '☝ Select / move'], ['rect', '▭ Rectangle'], ['circle', '◯ Circle'], ['poly', '⬠ Polygon'],
]

export function ImageClickEditor({ draft, onChange, errors }) {
  const cfg = draft.config
  const regions = cfg.regions ?? []
  const stage = useRef(null)
  const [tool, setTool] = useState('select')
  const [sel, setSel] = useState(null)
  const [preview, setPreview] = useState(null)     // region being drawn
  const [poly, setPoly] = useState(null)           // { points, cursor } while building a polygon
  const find = draft.type === 'imagefind'
  const cfgRef = useRef(cfg); cfgRef.current = cfg
  const draftRef = useRef(draft); draftRef.current = draft

  const setRegions = next => onChange({ ...draftRef.current, config: { ...cfgRef.current, regions: next } })
  const patchRegion = (id, patch) => setRegions(cfgRef.current.regions.map(r => (r.id === id ? { ...r, ...patch } : r)))

  useEffect(() => {
    if (!poly) return
    const key = e => { if (e.key === 'Escape') setPoly(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [poly])

  function addRegion(shape) {
    const n = cfgRef.current.regions.length
    const r = { id: newId(), name: `Area ${n + 1}`, correct: n === 0, ...shape }
    setRegions([...cfgRef.current.regions, r])
    setSel(r.id); setTool('select')
  }

  function finishPoly() {
    if (poly && poly.points.length >= 3) addRegion({ shape: 'poly', points: poly.points })
    setPoly(null)
  }

  function stageDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = stage.current
    const [x0, y0] = pctFromEvent(el, e).map(clamp)
    if (tool === 'select') { setSel(null); return }
    if (tool === 'poly') {
      e.preventDefault()
      const pts = poly?.points ?? []
      const first = pts[0]
      const b = el.getBoundingClientRect()
      const near = first && Math.hypot((first[0] - x0) * b.width / 100, (first[1] - y0) * b.height / 100) < 14
      if (near && pts.length >= 3) return finishPoly()
      setPoly({ points: [...pts, [x0, y0]], cursor: [x0, y0] })
      return
    }
    const b = el.getBoundingClientRect()
    track(e, el, (x, y) => {
      if (tool === 'rect') setPreview({ shape: 'rect', x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) })
      else {
        const rpx = Math.hypot((x - x0) * b.width / 100, (y - y0) * b.height / 100)
        setPreview({ shape: 'circle', cx: x0, cy: y0, rx: rpx / b.width * 100, ry: rpx / b.height * 100 })
      }
    }, (x, y) => {
      setPreview(null)
      if (tool === 'rect') {
        const w = Math.abs(x - x0), h = Math.abs(y - y0)
        if (w > 1 && h > 1) addRegion({ shape: 'rect', x: Math.min(x0, x), y: Math.min(y0, y), w, h })
      } else {
        const rpx = Math.hypot((x - x0) * b.width / 100, (y - y0) * b.height / 100)
        if (rpx > 6) addRegion({ shape: 'circle', cx: x0, cy: y0, rx: rpx / b.width * 100, ry: rpx / b.height * 100 })
      }
    })
  }

  function stageMove(e) {
    if (tool !== 'poly' || !poly) return
    const [x, y] = pctFromEvent(stage.current, e).map(clamp)
    setPoly(p => (p ? { ...p, cursor: [x, y] } : p))
  }

  // Move a whole region by dragging its body
  function bodyDown(r) {
    return e => {
      if (tool !== 'select' || (e.pointerType === 'mouse' && e.button !== 0)) return
      setSel(r.id)
      const [sx, sy] = pctFromEvent(stage.current, e)
      const orig = r
      track(e, stage.current, (x, y) => {
        const dx = x - sx, dy = y - sy
        if (orig.shape === 'rect') patchRegion(r.id, { x: clamp(orig.x + dx), y: clamp(orig.y + dy) })
        else if (orig.shape === 'circle') patchRegion(r.id, { cx: clamp(orig.cx + dx), cy: clamp(orig.cy + dy) })
        else patchRegion(r.id, { points: orig.points.map(p => [clamp(p[0] + dx), clamp(p[1] + dy)]) })
      })
    }
  }

  // Handles for the selected region
  function handles(r) {
    const H = []
    const mk = (key, x, y, onDrag) => H.push(
      <span key={key} className="act-handle" style={{ left: `${x}%`, top: `${y}%` }}
        onPointerDown={e => track(e, stage.current, onDrag)} />)
    if (r.shape === 'rect') {
      const corners = [[r.x, r.y, r.x + r.w, r.y + r.h], [r.x + r.w, r.y, r.x, r.y + r.h], [r.x, r.y + r.h, r.x + r.w, r.y], [r.x + r.w, r.y + r.h, r.x, r.y]]
      corners.forEach(([cx, cy, fx, fy], i) => mk(i, cx, cy, (x, y) =>
        patchRegion(r.id, { x: Math.min(fx, x), y: Math.min(fy, y), w: Math.abs(x - fx), h: Math.abs(y - fy) })))
    } else if (r.shape === 'circle') {
      mk('c', r.cx + r.rx, r.cy, x => {
        const b = stage.current.getBoundingClientRect()
        const rpx = Math.abs(x - r.cx) * b.width / 100
        patchRegion(r.id, { rx: rpx / b.width * 100, ry: rpx / b.height * 100 })
      })
    } else {
      r.points.forEach((p, i) => mk(i, p[0], p[1], (x, y) =>
        patchRegion(r.id, { points: cfgRef.current.regions.find(q => q.id === r.id).points.map((q, j) => (j === i ? [x, y] : q)) })))
    }
    return H
  }

  const selected = regions.find(r => r.id === sel)
  const drawing = tool !== 'select'
  const shapes = [
    ...regions.map(r => (
      <RegionShape key={r.id} r={r}
        className={`act-region-edit ${r.correct ? 'act-region-isok' : ''} ${r.id === sel ? 'act-region-sel' : ''}`}
        onPointerDown={bodyDown(r)} />
    )),
    preview && <RegionShape key="pv" r={preview} className="act-region-draw" />,
    poly && poly.points.length > 0 && (
      <polyline key="pp" className="act-region act-region-draw" vectorEffect="non-scaling-stroke"
        points={[...poly.points, poly.cursor].map(p => p.join(',')).join(' ')} />
    ),
  ]

  return (
    <Frame draft={draft} onChange={onChange} errors={errors}
      placeholder={find ? 'Instruction, e.g. Tap where each place is on the map.' : 'Instruction, e.g. Click on the Acropolis.'}>
      <div className="act-tools">
        {TOOLS.map(([t, label]) => (
          <button key={t} type="button" className={`t-btn ${tool === t ? 't-btn-primary' : 't-btn-secondary'}`}
            onClick={() => { setTool(t); setPoly(null) }}>{label}</button>
        ))}
        {poly && (
          <>
            <button type="button" className="t-btn t-btn-primary" disabled={poly.points.length < 3} onClick={finishPoly}>Finish shape</button>
            <button type="button" className="t-btn t-btn-secondary" onClick={() => setPoly(null)}>Cancel</button>
          </>
        )}
      </div>
      <p className="act-img-hint">
        {tool === 'select' && (regions.length ? 'Tap a region to select it, drag to move, drag the dots to resize.' : 'Choose a shape tool, then draw on the image.')}
        {tool === 'rect' && 'Press and drag to draw a rectangle.'}
        {tool === 'circle' && 'Press at the centre and drag outwards.'}
        {tool === 'poly' && 'Tap to add corners. Tap the first dot (or press Finish shape) to close it.'}
      </p>
      <ImageStage image={cfg.image} stageRef={stage} shapes={shapes}
        className={`act-img-edit ${drawing ? 'act-img-draw' : ''}`}
        onPointerDown={stageDown} onPointerMove={stageMove} onDoubleClick={() => tool === 'poly' && finishPoly()}>
        {selected && tool === 'select' && handles(selected)}
        {poly?.points[0] && <span className="act-handle act-handle-start" style={{ left: `${poly.points[0][0]}%`, top: `${poly.points[0][1]}%` }} />}
      </ImageStage>

      {regions.length > 0 && (
        <div className="act-region-list">
          {regions.map((r, i) => (
            <div key={r.id} className={`act-region-row ${r.id === sel ? 'act-region-row-sel' : ''}`} onClick={() => { setSel(r.id); setTool('select') }}>
              <span className="act-pin-num">{i + 1}</span>
              <input className="t-input" value={r.name} placeholder="Region name"
                onChange={e => patchRegion(r.id, { name: e.target.value })} />
              {!find && (
                <label className="act-correct-toggle">
                  <input type="checkbox" checked={!!r.correct} onChange={e => patchRegion(r.id, { correct: e.target.checked })} /> Correct
                </label>
              )}
              <button type="button" className="t-btn t-btn-danger-ghost" title="Delete region"
                onClick={ev => { ev.stopPropagation(); setRegions(regions.filter(x => x.id !== r.id)); if (sel === r.id) setSel(null) }}>✕</button>
            </div>
          ))}
          <p className="act-img-hint">{find ? 'Each region name pops up as a prompt (in random order); students tap where it is. Name regions exactly as you want them shown.' : ''}{!find && 'Tick “Correct” on every region students should select. Untick regions are decoys — students lose the mark if they pick one.'}</p>
        </div>
      )}
    </Frame>
  )
}

/* ── labelling editor ───────────────────────────────────────── */
export function ImageLabelEditor({ draft, onChange, errors }) {
  const cfg = draft.config
  const pins = cfg.pins ?? []
  const stage = useRef(null)
  const [adding, setAdding] = useState(true)
  const isType = cfg.mode === 'type'
  const cfgRef = useRef(cfg); cfgRef.current = cfg
  const draftRef = useRef(draft); draftRef.current = draft
  const setCfg = patch => onChange({ ...draftRef.current, config: { ...cfgRef.current, ...patch } })
  const setPin = (id, patch) => setCfg({ pins: cfgRef.current.pins.map(p => (p.id === id ? { ...p, ...patch } : p)) })

  function stageDown(e) {
    if (!adding || (e.pointerType === 'mouse' && e.button !== 0)) return
    const [x, y] = pctFromEvent(stage.current, e).map(clamp)
    setCfg({ pins: [...pins, { id: newId(), x: round(x), y: round(y), answer: '' }] })
  }
  function pinDown(p) {
    return e => track(e, stage.current, (x, y) => setPin(p.id, { x, y }))
  }

  return (
    <Frame draft={draft} onChange={onChange} errors={errors}
      placeholder="Instruction, e.g. Label the parts of the Athenian Agora.">
      <div className="act-tools">
        <button type="button" className={`t-btn ${!isType ? 't-btn-primary' : 't-btn-secondary'}`} onClick={() => setCfg({ mode: 'drag' })}>Drag labels onto pins</button>
        <button type="button" className={`t-btn ${isType ? 't-btn-primary' : 't-btn-secondary'}`} onClick={() => setCfg({ mode: 'type' })}>Type the label</button>
      </div>
      <div className="act-tools">
        <button type="button" className={`t-btn ${adding ? 't-btn-primary' : 't-btn-secondary'}`} onClick={() => setAdding(a => !a)}>
          {adding ? '📍 Adding pins - tap the image' : '📍 Add pins'}
        </button>
        <span className="act-img-hint" style={{ margin: 0 }}>Drag a pin to move it. Pins are numbered in the order added.</span>
      </div>
      <ImageStage image={cfg.image} stageRef={stage} className={`act-img-edit ${adding ? 'act-img-draw' : ''}`} onPointerDown={stageDown}>
        {pins.map((p, i) => (
          <button key={p.id} type="button" className="act-pin act-pin-edit" style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onPointerDown={pinDown(p)} aria-label={`Pin ${i + 1}`}>{i + 1}</button>
        ))}
      </ImageStage>

      {pins.length > 0 && (
        <div className="act-region-list">
          {pins.map((p, i) => (
            <div key={p.id} className="act-region-row">
              <span className="act-pin-num">{i + 1}</span>
              <input className="t-input" value={p.answer}
                placeholder={isType ? 'Accepted answer(s), separate alternatives with |' : 'Label text'}
                onChange={e => setPin(p.id, { answer: e.target.value })} />
              <button type="button" className="t-btn t-btn-danger-ghost" title="Delete pin"
                onClick={() => setCfg({ pins: pins.filter(x => x.id !== p.id) })}>✕</button>
            </div>
          ))}
        </div>
      )}

      {isType ? (
        <div className="act-tools">
          <label className="act-correct-toggle"><input type="checkbox" checked={cfg.typo !== false} onChange={e => setCfg({ typo: e.target.checked })} /> Allow one small typo (answers of 5+ letters)</label>
          <label className="act-correct-toggle"><input type="checkbox" checked={!!cfg.caseSensitive} onChange={e => setCfg({ caseSensitive: e.target.checked })} /> Capital letters must match</label>
        </div>
      ) : (
        <textarea className="t-input act-textarea" placeholder="Extra wrong labels (optional) - one per line"
          value={(cfg.distractors ?? []).join('\n')} onChange={e => setCfg({ distractors: e.target.value.split('\n') })} />
      )}
    </Frame>
  )
}
