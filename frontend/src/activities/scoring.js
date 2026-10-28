/**
 * Pure scoring helpers. Each task type provides its own grading.
 * A response is whatever shape that type needs:
 *   single / multi / tf  -> array of selected option ids
 *   cloze / dropdown     -> array of strings, one per blank
 */
import { TEMPLATE_TYPES, gradeTemplate, fillTemplate } from './template'

const CHOICE = ['single', 'multi', 'tf']

export function isItemCorrect(item, response) {
  if (CHOICE.includes(item.type)) {
    const correct = (item.mc_options ?? []).filter(o => o.is_correct).map(o => o.id).sort()
    const chosen  = [...(response ?? [])].sort()
    return correct.length > 0
      && correct.length === chosen.length
      && correct.every((id, i) => id === chosen[i])
  }
  if (TEMPLATE_TYPES.includes(item.type)) return gradeTemplate(item, response).allCorrect
  return false
}

/** Has the student entered anything for this task yet? */
export function hasAnswer(item, response) {
  if (TEMPLATE_TYPES.includes(item.type)) return (response ?? []).some(v => String(v ?? '').trim() !== '')
  return (response ?? []).length > 0
}

/** Human-readable { yours, correct } strings for the results review. */
export function describeAnswer(item, response) {
  if (TEMPLATE_TYPES.includes(item.type)) {
    const filled = hasAnswer(item, response)
    return {
      yours: filled ? fillTemplate(item, b => `[${(response ?? [])[b.index]?.toString().trim() || '—'}]`) : 'Skipped',
      correct: fillTemplate(item, b => `[${b.kind === 'dropdown' ? b.correct : b.answers[0]}]`),
    }
  }
  const byId = Object.fromEntries((item.mc_options ?? []).map(o => [o.id, o.option_text]))
  return {
    yours: (response ?? []).length ? response.map(id => byId[id]).join(', ') : 'Skipped',
    correct: (item.mc_options ?? []).filter(o => o.is_correct).map(o => o.option_text).join(', '),
  }
}

/** Returns { score, total, percent, responses } for a finished run. */
export function scoreRun(items, responsesById) {
  let score = 0
  let total = 0
  const responses = items.map(item => {
    const pts = item.points ?? 1
    const response = responsesById[item.id] ?? []
    const correct = isItemCorrect(item, response)
    total += pts
    if (correct) score += pts
    const row = { item_id: item.id, type: item.type, response, is_correct: correct }
    if (TEMPLATE_TYPES.includes(item.type)) row.blanks = gradeTemplate(item, response).blanks
    return row
  })
  const percent = total > 0 ? Math.round((score / total) * 100) : 0
  return { score, total, percent, responses }
}
