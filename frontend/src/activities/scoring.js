/**
 * Pure scoring helpers. Each task type provides its own isCorrect().
 * A response is whatever shape that type needs; for choice types it is
 * an array of selected option ids.
 */

export function isItemCorrect(item, response) {
  switch (item.type) {
    case 'single':
    case 'tf':
    case 'multi': {
      const correct = (item.mc_options ?? []).filter(o => o.is_correct).map(o => o.id).sort()
      const chosen  = [...(response ?? [])].sort()
      return correct.length > 0
        && correct.length === chosen.length
        && correct.every((id, i) => id === chosen[i])
    }
    default:
      return false
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
    return { item_id: item.id, type: item.type, response, is_correct: correct }
  })
  const percent = total > 0 ? Math.round((score / total) * 100) : 0
  return { score, total, percent, responses }
}
