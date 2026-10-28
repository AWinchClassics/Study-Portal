import { useState } from 'react'
import { ITEM_TYPES } from '../types'

/** Blank draft for a new task of the given type. */
export function newChoiceDraft(type) {
  if (type === 'tf') {
    return {
      type, prompt: '', explanation: '', points: 1,
      options: [
        { option_text: 'True',  is_correct: true },
        { option_text: 'False', is_correct: false },
      ],
    }
  }
  return {
    type, prompt: '', explanation: '', points: 1,
    options: [1, 2, 3, 4].map((n, i) => ({ option_text: '', is_correct: i === 0 })),
  }
}

/** Returns an array of problems (empty = valid). */
export function validateChoiceDraft(d) {
  const errs = []
  if (!d.prompt.trim()) errs.push('Enter the question text.')
  const opts = d.options
  if (opts.some(o => !o.option_text.trim())) errs.push('Every option needs text (remove blank ones).')
  if (opts.length < 2) errs.push('Add at least two options.')
  const nCorrect = opts.filter(o => o.is_correct).length
  if (nCorrect === 0) errs.push('Mark at least one option as correct.')
  if (d.type !== 'multi' && nCorrect > 1) errs.push('Only one option can be correct for this type.')
  return errs
}

/**
 * Editor for one single / multi / tf task.
 * Props: draft, onChange(draft), errors (string[])
 */
export default function ChoiceEditor({ draft, onChange, errors }) {
  const isMulti = draft.type === 'multi'
  const isTF    = draft.type === 'tf'

  function setOpt(i, patch) {
    const options = draft.options.map((o, j) => (j === i ? { ...o, ...patch } : o))
    onChange({ ...draft, options })
  }
  function setCorrect(i, val) {
    if (isMulti) return setOpt(i, { is_correct: val })
    onChange({ ...draft, options: draft.options.map((o, j) => ({ ...o, is_correct: j === i })) })
  }
  function addOpt() {
    onChange({ ...draft, options: [...draft.options, { option_text: '', is_correct: false }] })
  }
  function removeOpt(i) {
    onChange({ ...draft, options: draft.options.filter((_, j) => j !== i) })
  }

  return (
    <>
      <textarea
        className="t-input act-textarea"
        placeholder={isTF ? 'Statement to judge as true or false…' : 'Question…'}
        value={draft.prompt}
        onChange={e => onChange({ ...draft, prompt: e.target.value })}
      />

      <div className="act-options">
        {draft.options.map((o, i) => (
          <div className="act-opt-row" key={i}>
            <input
              className="t-input"
              placeholder={`Option ${i + 1}`}
              value={o.option_text}
              readOnly={isTF}
              onChange={e => setOpt(i, { option_text: e.target.value })}
            />
            <label className="act-opt-correct">
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={`correct-${draft.id ?? 'new'}`}
                checked={o.is_correct}
                onChange={e => setCorrect(i, e.target.checked)}
              />
              Correct
            </label>
            {!isTF && draft.options.length > 2 && (
              <button type="button" className="t-btn t-btn-danger-ghost" onClick={() => removeOpt(i)} title="Remove option">✕</button>
            )}
          </div>
        ))}
        {!isTF && (
          <div>
            <button type="button" className="t-btn t-btn-ghost" onClick={addOpt}>+ Add option</button>
          </div>
        )}
      </div>

      <textarea
        className="t-input act-textarea"
        placeholder="Explanation shown after answering (optional)…"
        value={draft.explanation ?? ''}
        onChange={e => onChange({ ...draft, explanation: e.target.value })}
      />

      {errors?.length > 0 && (
        <ul className="act-errors">{errors.map(e => <li key={e}>{e}</li>)}</ul>
      )}
    </>
  )
}

export { ITEM_TYPES }
