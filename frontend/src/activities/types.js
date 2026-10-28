/**
 * Activity task-type registry.
 *
 * To add a new task type later: add an entry here, a player in items/,
 * an editor in editor/, grading in scoring.js, and extend the CHECK
 * constraint on activity_items.type.
 */
import { TEMPLATE_TYPES } from './template'
import { ARRANGE_TYPES } from './arrange'
import { IMAGE_TYPES } from './image'

export const CHOICE_TYPES = ['single', 'multi', 'tf']
export { TEMPLATE_TYPES, ARRANGE_TYPES, IMAGE_TYPES }

/** Types whose content lives in activity_items.config (not mc_options). */
export const CONFIG_TYPES = [...TEMPLATE_TYPES, ...ARRANGE_TYPES, ...IMAGE_TYPES]

export const ITEM_TYPES = {
  single:   { label: 'Single choice',     icon: '◉', hint: 'Pick one correct answer' },
  multi:    { label: 'Multi-select',      icon: '☑', hint: 'Pick all correct answers' },
  tf:       { label: 'True / False',      icon: '⇄', hint: 'Decide if a statement is true' },
  cloze:    { label: 'Fill in the blank', icon: '▭', hint: 'Type the missing words' },
  dropdown: { label: 'Dropdown in text',  icon: '▾', hint: 'Choose the missing words from lists' },
  match:    { label: 'Matching',          icon: '⇌', hint: 'Match items from two lists' },
  order:    { label: 'Put in order',      icon: '↕', hint: 'Arrange items in the correct order' },
  categorise: { label: 'Categorise',      icon: '▤', hint: 'Sort items into categories' },
  imageclick: { label: 'Click on image',  icon: '⌖', hint: 'Click the correct part of an image or map' },
  imagefind:  { label: 'Find on image',   icon: '🔎', hint: 'Labels pop up one by one - tap where each is' },
  imagelabel: { label: 'Label image',     icon: '📍', hint: 'Label parts of an image (drag or type)' },
}

/** Marker stored in resources.url for activity-backed quizzes. */
export const ACTIVITY_URL = 'activity'

export function isActivityResource(resource) {
  return !resource?.url || resource.url === ACTIVITY_URL
}
