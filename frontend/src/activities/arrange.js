/**
 * Matching + ordering task types: config shapes, validation and grading.
 *
 *   match  config: { pairs: [{ left, right }, ...], distractors: ["extra wrong right-hand items"] }
 *          response: array (one entry per pair, in pair order) of the right-hand text the
 *          student placed against that left item, or '' if empty.
 *
 *   order  config: { items: ["first", "second", ...] }   <- stored in the CORRECT order
 *          response: array of item texts in the order the student arranged them.
 *
 *   categorise  config: { categories: [{ name, items: ["item", ...] }, ...] }
 *          response: array aligned to categoriseItems(config) (categories in order, items in order)
 *          holding the category NAME the student put each item in, or '' if unplaced.
 *
 * All are all-or-nothing per task; per-row/per-position flags are returned so the
 * player can show which parts were right and attempts can record them.
 */

export const ARRANGE_TYPES = ['match', 'order', 'categorise']

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffle, but never hand back the original order (when there is more than one item). */
export function shuffleDifferent(arr) {
  if (arr.length < 2) return [...arr]
  let out = shuffle(arr)
  for (let tries = 0; tries < 10 && out.every((v, i) => v === arr[i]); tries++) out = shuffle(arr)
  if (out.every((v, i) => v === arr[i])) out = [...arr.slice(1), arr[0]]
  return out
}

const clean = s => String(s ?? '').trim()

export function defaultArrangeConfig(type) {
  if (type === 'match') return { pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }], distractors: [] }
  if (type === 'categorise') return { categories: [{ name: '', items: ['', ''] }, { name: '', items: ['', ''] }] }
  return { items: ['', '', ''] }
}

/** Flat list of every item with its correct category: [{ text, cat, catIndex }], in authored order. */
export function categoriseItems(cfg) {
  return (cfg?.categories ?? []).flatMap((c, catIndex) =>
    (c.items ?? []).filter(t => String(t ?? '').trim() !== '').map(text => ({ text: String(text).trim(), cat: c.name, catIndex })))
}

/** Trim everything and drop empty distractors, ready to save. */
export function cleanArrangeConfig(type, cfg) {
  if (type === 'match') {
    return {
      pairs: (cfg?.pairs ?? []).map(p => ({ left: clean(p.left), right: clean(p.right) })),
      distractors: (cfg?.distractors ?? []).map(clean).filter(Boolean),
    }
  }
  if (type === 'categorise') {
    return {
      categories: (cfg?.categories ?? []).map(c => ({
        name: clean(c.name),
        items: (c.items ?? []).map(clean).filter(Boolean),
      })),
    }
  }
  return { items: (cfg?.items ?? []).map(clean) }
}

/** Returns an array of problems (empty = valid). */
export function validateArrangeConfig(type, rawCfg) {
  const errs = []
  const cfg = cleanArrangeConfig(type, rawCfg)
  const dupes = list => new Set(list).size !== list.length

  if (type === 'match') {
    const { pairs, distractors } = cfg
    if (pairs.length < 2) errs.push('Add at least two pairs.')
    if (pairs.some(p => !p.left || !p.right)) errs.push('Every pair needs both a left and a right item.')
    if (dupes(pairs.map(p => p.left))) errs.push('Left-hand items must all be different.')
    const rights = pairs.map(p => p.right)
    if (dupes(rights)) errs.push('Right-hand items must all be different (students place each one once).')
    if (distractors.some(d => rights.includes(d)) || dupes(distractors)) {
      errs.push('Extra options must be different from the right-hand items and from each other.')
    }
  } else if (type === 'categorise') {
    const { categories } = cfg
    if (categories.length < 2) errs.push('Add at least two categories.')
    if (categories.some(c => !c.name)) errs.push('Every category needs a name.')
    if (dupes(categories.map(c => c.name))) errs.push('Category names must all be different.')
    if (categories.some(c => c.items.length === 0)) errs.push('Every category needs at least one item.')
    if (dupes(categories.flatMap(c => c.items))) errs.push('Each item can only appear once, in a single category.')
  } else {
    const { items } = cfg
    if (items.length < 2) errs.push('Add at least two items.')
    if (items.some(i => !i)) errs.push('Every item needs text (remove blank rows).')
    if (dupes(items)) errs.push('Items must all be different.')
  }
  return errs
}

export function gradeMatch(item, response) {
  const pairs = item.config?.pairs ?? []
  const flags = pairs.map((p, i) => !!(response ?? [])[i] && (response ?? [])[i] === p.right)
  return { flags, allCorrect: flags.length > 0 && flags.every(Boolean) }
}

export function gradeOrder(item, response) {
  const items = item.config?.items ?? []
  const r = response ?? []
  const flags = items.map((t, i) => r[i] === t)
  return { flags, allCorrect: r.length === items.length && items.length > 0 && flags.every(Boolean) }
}

export function gradeCategorise(item, response) {
  const all = categoriseItems(item.config)
  const flags = all.map((it, i) => (response ?? [])[i] === it.cat)
  return { flags, allCorrect: flags.length > 0 && flags.every(Boolean) }
}

export function gradeArrange(item, response) {
  if (item.type === 'match') return gradeMatch(item, response)
  if (item.type === 'categorise') return gradeCategorise(item, response)
  return gradeOrder(item, response)
}

/** Items shown in the pool for a match task: every right-hand text plus distractors. */
export function matchPool(cfg) {
  return [...(cfg?.pairs ?? []).map(p => p.right), ...(cfg?.distractors ?? [])]
}
