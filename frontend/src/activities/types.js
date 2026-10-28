/**
 * Activity task-type registry.
 *
 * To add a new task type later: add an entry here, a player in items/,
 * an editor in editor/, and extend the CHECK constraint on
 * activity_items.type. Nothing else in the app needs to change.
 */

export const CHOICE_TYPES = ['single', 'multi', 'tf']

export const ITEM_TYPES = {
  single: { label: 'Single choice',  icon: '◉', hint: 'Pick one correct answer' },
  multi:  { label: 'Multi-select',   icon: '☑', hint: 'Pick all correct answers' },
  tf:     { label: 'True / False',   icon: '⇄', hint: 'Decide if a statement is true' },
}

/** Marker stored in resources.url for activity-backed quizzes. */
export const ACTIVITY_URL = 'activity'

export function isActivityResource(resource) {
  return !resource?.url || resource.url === ACTIVITY_URL
}
