/**
 * Pointer-based drag for mouse, pen AND touch.
 *
 * The browser's built-in HTML5 drag-and-drop does not fire on touch screens, so the
 * matching and ordering players use this instead. A press that moves less than a few
 * pixels stays an ordinary click/tap, so tap-to-place keeps working alongside dragging.
 *
 * Usage (inside a pointerdown handler):
 *   beginDrag(e, {
 *     label: 'text shown on the floating copy',
 *     onStart: () => {},                      // drag actually began (moved past threshold)
 *     onMove:  (x, y, elementUnderPointer) => {},
 *     onEnd:   ({ x, y, target, cancelled }) => {},
 *   })
 *
 * The dragged element needs CSS `touch-action: none`, otherwise touch browsers
 * take over the gesture to scroll the page.
 */

const THRESHOLD = 6          // px of movement before a press becomes a drag
const EDGE = 70              // px from the screen edge where auto-scroll kicks in
const SCROLL_SPEED = 14

export function beginDrag(e, { label = '', onStart, onMove, onEnd }) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const id = e.pointerId
  const startX = e.clientX
  const startY = e.clientY
  let x = startX
  let y = startY
  let dragging = false
  let ghost = null
  let raf = null

  function under() {
    return document.elementFromPoint(x, y) // the ghost has pointer-events: none
  }

  function place() {
    if (!ghost) return
    ghost.style.left = `${x}px`
    ghost.style.top = `${y}px`
  }

  function loop() {
    // keep the page scrolling while a finger/cursor is held near the top or bottom edge
    if (y < EDGE) window.scrollBy(0, -SCROLL_SPEED)
    else if (y > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_SPEED)
    onMove?.(x, y, under())
    raf = requestAnimationFrame(loop)
  }

  function move(ev) {
    if (ev.pointerId !== id) return
    x = ev.clientX
    y = ev.clientY
    if (!dragging) {
      if (Math.hypot(x - startX, y - startY) < THRESHOLD) return
      dragging = true
      ghost = document.createElement('div')
      ghost.className = 'act-drag-ghost'
      ghost.textContent = label
      document.body.appendChild(ghost)
      document.body.classList.add('act-dragging')
      onStart?.()
      raf = requestAnimationFrame(loop)
    }
    place()
    ev.preventDefault()
  }

  function finish(ev, cancelled) {
    if (ev.pointerId !== id) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    cancelAnimationFrame(raf)
    if (!dragging) return // it was just a tap/click - let the click handlers run
    const target = under()
    ghost?.remove()
    document.body.classList.remove('act-dragging')
    swallowNextClick(e.pointerType)
    onEnd?.({ x, y, target, cancelled })
  }
  const up = ev => finish(ev, false)
  const cancel = ev => finish(ev, true)

  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
}

// After a real mouse/pen drag the browser may still fire a click on the element we let go
// over; swallow that one click so a drop never also counts as a tap. Touch fires no click
// after movement, so it is left alone - and the window is short so a quick follow-up tap
// is never eaten.
function swallowNextClick(pointerType) {
  if (pointerType === 'touch') return
  const stop = ev => { ev.stopPropagation(); ev.preventDefault() }
  window.addEventListener('click', stop, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 80)
}

/** Which drop target is this element in? Returns slot index, 'pool', or null. */
export function matchDropTarget(el) {
  const s = el?.closest?.('[data-slot]')
  if (s) return Number(s.dataset.slot)
  if (el?.closest?.('[data-pool]')) return 'pool'
  return null
}

/** Category drop target: category index, 'pool', or null. */
export function categoryDropTarget(el) {
  const c = el?.closest?.('[data-cat]')
  if (c) return Number(c.dataset.cat)
  if (el?.closest?.('[data-pool]')) return 'pool'
  return null
}
