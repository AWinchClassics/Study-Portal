/**
 * Activity task-type registry.
 *
 * To add a new task type later: add an entry here, a player in items/,
 * an editor in editor/, grading in scoring.js, and extend the CHECK
 * constraint on activity_items.type.
 */
import { TEMPLATE_TYPES } from './template'

export const CHOICE_TYPES = ['single', 'multi', 'tf']
export { TEMPLATE_TYPES }

export const ITEM_TYPES = {
  single:   { label: 'Single choice',     icon: '◉', hint: 'Pick one correct answer' },
  multi:    { label: 'Multi-select',      icon: '☑', hint: 'Pick all correct answers' },
  tf:       { label: 'True / False',      icon: '⇄', hint: 'Decide if a statement is true' },
  cloze:    { label: 'Fill in the blank', icon: '▭', hint: 'Type the missing words' },
  dropdown: { label: 'Dropdown in text',  icon: '▾', hint: 'Choose the missing words from lists' },
}

/** Marker stored in resources.url for activity-backed quizzes. */
export const ACTIVITY_URL = 'activity'

export function isActivityResource(resource) {
  return !resource?.url || resource.url === ACTIVITY_URL
}
