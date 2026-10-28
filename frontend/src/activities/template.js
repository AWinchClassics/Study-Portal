/**
 * Template parsing + grading for the two "text with blanks" task types.
 *
 *   cloze     "The [[boule|council of 500]] prepared business for the [[ekklesia]]."
 *             -> students TYPE the missing words. `|` separates accepted answers.
 *
 *   dropdown  "The [[Pericles*|Cleon|Alcibiades]] delivered the funeral oration."
 *             -> students PICK from a list. `*` marks the correct option.
 *
 * The raw template string is what is stored (activity_items.config.template);
 * everything else is derived here, so the editor and player always agree.
 */

export const TEMPLATE_TYPES = ['cloze', 'dropdown']

const BLANK_RE = /\[\[([\s\S]*?)\]\]/g

/** Parse a template. Returns { parts, blanks, errors }. */
export function parseTemplate(template, kind) {
  const src = template ?? ''
  const parts = []
  const errors = []
  let last = 0
  let index = 0
  let m
  const re = new RegExp(BLANK_RE.source, 'g')

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: src.slice(last, m.index) })
    const raw = m[1].split('|').map(s => s.trim()).filter(Boolean)
    const n = index + 1

    if (kind === 'dropdown') {
      const options = raw.map(s => (s.endsWith('*') ? s.slice(0, -1).trim() : s))
      const correct = raw.filter(s => s.endsWith('*')).map(s => s.slice(0, -1).trim())
      if (options.length < 2) errors.push(`Blank ${n}: add at least two options.`)
      if (correct.length === 0) errors.push(`Blank ${n}: mark the correct option with * (e.g. Pericles*).`)
      if (correct.length > 1) errors.push(`Blank ${n}: only one option can be marked correct.`)
      if (new Set(options).size !== options.length) errors.push(`Blank ${n}: options must be different from each other.`)
      parts.push({ type: 'blank', index, kind, options, correct: correct[0] ?? null })
    } else {
      if (raw.length === 0) errors.push(`Blank ${n} is empty.`)
      parts.push({ type: 'blank', index, kind, answers: raw })
    }
    index++
    last = re.lastIndex
  }
  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) })

  const leftover = parts.filter(p => p.type === 'text').map(p => p.value).join('')
  if (leftover.includes('[[') || leftover.includes(']]')) {
    errors.push('There is an unmatched [[ or ]] — every blank needs both.')
  }
  if (index === 0) errors.push('Add at least one blank using [[ ]].')

  return { parts, blanks: parts.filter(p => p.type === 'blank'), errors }
}

/** Lower-case, strip accents/macrons, collapse spaces, trim edge punctuation. */
export function normalise(s, caseSensitive = false) {
  const t = String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.,;:!?'"“”‘’()]+|[.,;:!?'"“”‘’()]+$/g, '')
    .trim()
  return caseSensitive ? t : t.toLowerCase()
}

export function editDistance(a, b) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Is one blank answered correctly?
 * cfg: { typo (default true), caseSensitive (default false) } - cloze only.
 * Typo tolerance allows ONE slip, and only for answers of 5+ characters,
 * so short answers and dates ("413") must be exact.
 */
export function isBlankCorrect(blank, value, cfg = {}) {
  if (blank.kind === 'dropdown') return !!value && value === blank.correct
  const cs = !!cfg.caseSensitive
  const v = normalise(value, cs)
  if (!v) return false
  return blank.answers.some(ans => {
    const a = normalise(ans, cs)
    if (v === a) return true
    if (cs && v.toLowerCase() === a.toLowerCase()) return false // capitals required: a case slip is not a typo
    return cfg.typo !== false && a.length >= 5 && Math.abs(v.length - a.length) <= 1 && editDistance(v, a) <= 1
  })
}

/** Grade a template task. response = array of strings, one per blank. */
export function gradeTemplate(item, response) {
  const { blanks, errors } = parseTemplate(item.config?.template, item.type)
  const flags = blanks.map((b, i) => isBlankCorrect(b, (response ?? [])[i], item.config))
  return {
    blanks: flags,
    allCorrect: errors.length === 0 && flags.length > 0 && flags.every(Boolean),
  }
}

/** The template with each blank replaced by a supplied string. */
export function fillTemplate(item, valueFor) {
  const { parts } = parseTemplate(item.config?.template, item.type)
  return parts.map(p => (p.type === 'text' ? p.value : valueFor(p))).join('')
}
