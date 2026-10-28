import { regionCentre } from '../image'

/**
 * The image with a percentage-coordinate overlay on top. Children are absolutely
 * positioned elements (pins) using left/top in %. The SVG layer draws regions
 * (viewBox 0-100 stretched over the image, so shapes follow the image at any size).
 *
 * Props: image {url,w,h,alt}, stageRef, shapes (svg children), onPointerDown, className, children
 */
export default function ImageStage({ image, stageRef, shapes, children, className = '', ...rest }) {
  const ratio = image?.w && image?.h ? `${image.w} / ${image.h}` : undefined
  return (
    <div className={`act-img-stage ${className}`} ref={stageRef} style={{ aspectRatio: ratio }} {...rest}>
      <img src={image?.url} alt={image?.alt || ''} draggable={false} className="act-img" />
      <svg className="act-img-svg" viewBox="0 0 100 100" preserveAspectRatio="none">{shapes}</svg>
      {children}
    </div>
  )
}

/** One region as an SVG element. */
export function RegionShape({ r, className = '', ...rest }) {
  const common = { className: `act-region ${className}`, vectorEffect: 'non-scaling-stroke', ...rest }
  if (r.shape === 'rect') return <rect x={r.x} y={r.y} width={r.w} height={r.h} {...common} />
  if (r.shape === 'circle') return <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} {...common} />
  return <polygon points={(r.points ?? []).map(p => p.join(',')).join(' ')} {...common} />
}

/** A small name badge sitting at a region's centre. */
export function RegionBadge({ r, text, className = '' }) {
  const [x, y] = regionCentre(r)
  return <span className={`act-region-badge ${className}`} style={{ left: `${x}%`, top: `${y}%` }}>{text}</span>
}

/** Pointer position inside the stage as % of width/height. */
export function pctFromEvent(stageEl, e) {
  const b = stageEl.getBoundingClientRect()
  return [((e.clientX - b.left) / b.width) * 100, ((e.clientY - b.top) / b.height) * 100]
}
