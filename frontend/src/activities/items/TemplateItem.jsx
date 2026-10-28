import { useMemo } from 'react'
import { parseTemplate, gradeTemplate } from '../template'

/**
 * Player UI for cloze (typed) and dropdown (picked) tasks.
 *
 * Props:
 *   item      - activity_items row (config.template holds the text)
 *   orders    - dropdown only: array (per blank) of option strings in display order
 *   selected  - array of strings, one per blank
 *   checked   - true once checked (locks inputs, shows right/wrong)
 *   onChange  - function(newArrayOfStrings)
 *   onSubmit  - function() called on Enter in the last typed blank
 */
export default function TemplateItem({ item, orders, selected, checked, onChange, onSubmit }) {
  const { parts, blanks, errors } = useMemo(
    () => parseTemplate(item.config?.template, item.type), [item.config?.template, item.type])
  const flags = checked ? gradeTemplate(item, selected).blanks : []

  if (errors.length) return <p className="page-error">This task is set up incorrectly: {errors[0]}</p>

  function setValue(i, v) {
    const next = blanks.map((_, k) => selected[k] ?? '')
    next[i] = v
    onChange(next)
  }

  function onKey(e, i) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (i < blanks.length - 1) {
      const inputs = e.currentTarget.closest('.act-template').querySelectorAll('input')
      inputs[i + 1]?.focus()
    } else {
      onSubmit?.()
    }
  }

  return (
    <div className="act-template">
      {parts.map((p, k) => {
        if (p.type === 'text') return <span key={k}>{p.value}</span>
        const i = p.index
        const state = checked ? (flags[i] ? 'act-blank-correct' : 'act-blank-wrong') : ''
        const showFix = checked && !flags[i]

        if (p.kind === 'dropdown') {
          return (
            <span key={k} className="act-blank-wrap">
              <select
                className={`act-blank act-blank-select ${state}`}
                value={selected[i] ?? ''}
                disabled={checked}
                onChange={e => setValue(i, e.target.value)}
                aria-label={`Blank ${i + 1}`}
              >
                <option value="">Select…</option>
                {(orders?.[i] ?? p.options).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {showFix && <span className="act-blank-fix">{p.correct}</span>}
            </span>
          )
        }

        const longest = Math.max(...p.answers.map(a => a.length), 4)
        return (
          <span key={k} className="act-blank-wrap">
            <input
              className={`act-blank ${state}`}
              style={{ width: `${Math.min(longest + 3, 28)}ch` }}
              value={selected[i] ?? ''}
              disabled={checked}
              autoFocus={i === 0}
              autoComplete="off" autoCapitalize="off" spellCheck={false}
              onChange={e => setValue(i, e.target.value)}
              onKeyDown={e => onKey(e, i)}
              aria-label={`Blank ${i + 1}`}
            />
            {showFix && <span className="act-blank-fix">{p.answers[0]}</span>}
          </span>
        )
      })}
    </div>
  )
}
