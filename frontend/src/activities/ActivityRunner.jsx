import { useState, useMemo, useCallback } from 'react'
import ChoiceItem from './items/ChoiceItem'
import { CHOICE_TYPES, ITEM_TYPES } from './types'
import { isItemCorrect, scoreRun } from './scoring'

/**
 * ActivityRunner - student-facing player for activity-backed quizzes.
 * Same contract as QuizRunner: title, onComplete(result), onExit().
 * result = { score, total, percent, responses }
 *
 * Flow per task: answer -> "Check answer" -> feedback (+ explanation) -> "Next".
 * Task-type players live in ./items; add a case in renderItem() for new types.
 */

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildOrders(items) {
  const orders = {}
  items.forEach(it => {
    const ids = it.mc_options.map(o => o.id)
    // Keep true/false in authored order (True, then False); shuffle the rest
    orders[it.id] = it.type === 'tf' ? ids : shuffle(ids)
  })
  return orders
}

export default function ActivityRunner({ items, title, onComplete, onExit }) {
  const [run, setRun] = useState(0) // bump to restart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orders = useMemo(() => buildOrders(items), [items, run])

  const [index, setIndex]       = useState(0)
  const [answers, setAnswers]   = useState({})   // item.id -> response
  const [checked, setChecked]   = useState(false)
  const [result, setResult]     = useState(null)

  const total = items.length
  const item  = items[index]
  const response = answers[item?.id] ?? []

  const restart = useCallback(() => {
    setRun(r => r + 1); setIndex(0); setAnswers({}); setChecked(false); setResult(null)
  }, [])

  function setResponse(val) {
    setAnswers(a => ({ ...a, [item.id]: val }))
  }

  function handleNext() {
    if (index + 1 >= total) {
      const r = scoreRun(items, answers)
      setResult(r)
      onComplete?.(r)
    } else {
      setIndex(i => i + 1)
      setChecked(false)
    }
  }

  function renderItem() {
    if (CHOICE_TYPES.includes(item.type)) {
      return (
        <ChoiceItem
          item={item}
          optionOrder={orders[item.id]}
          selected={response}
          checked={checked}
          onChange={setResponse}
        />
      )
    }
    return <p className="page-error">Unsupported task type: {item.type}</p>
  }

  // ── Results ────────────────────────────────────────────────
  if (result) {
    const grade = result.percent >= 80 ? 'high' : result.percent >= 50 ? 'mid' : 'low'
    return (
      <div className="qr-shell">
        <div className="qr-header">
          <span className="qr-title">{title}</span>
          <span className="qr-pill">Complete</span>
        </div>
        <div className="qr-progress"><div className="qr-progress-fill" style={{ width: '100%' }} /></div>
        <div className="qr-results">
          <div className={`qr-score-display qr-score-${grade}`}>
            <span className="qr-score-number">{result.score}<span className="qr-score-total">/{result.total}</span></span>
            <span className="qr-score-percent">{result.percent}%</span>
          </div>
          <div className="qr-result-actions">
            <button className="qr-btn qr-btn-primary" onClick={restart}>Retake quiz</button>
            <button className="qr-btn qr-btn-secondary" onClick={onExit}>Back to chunk</button>
          </div>
          <div className="qr-summary">
            <h3 className="qr-summary-heading">Answer review</h3>
            {items.map((it, i) => {
              const r = result.responses[i]
              const byId = Object.fromEntries(it.mc_options.map(o => [o.id, o.option_text]))
              const yours = r.response.length ? r.response.map(id => byId[id]).join(', ') : 'Skipped'
              const correct = it.mc_options.filter(o => o.is_correct).map(o => o.option_text).join(', ')
              return (
                <div key={it.id} className={`qr-summary-item ${r.is_correct ? 'qr-correct' : 'qr-incorrect'}`}>
                  <div className="qr-summary-q"><span className="qr-summary-num">{i + 1}</span>{it.prompt}</div>
                  <div className="qr-summary-answers">
                    <div className="qr-summary-row">
                      <span className="qr-summary-label">Your answer</span>
                      <span className={`qr-summary-val ${r.is_correct ? 'qr-val-correct' : 'qr-val-incorrect'}`}>{yours}</span>
                    </div>
                    {!r.is_correct && (
                      <div className="qr-summary-row">
                        <span className="qr-summary-label">Correct answer</span>
                        <span className="qr-summary-val qr-val-correct">{correct}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Question ───────────────────────────────────────────────
  const correct = checked && isItemCorrect(item, response)
  const canCheck = response.length > 0

  return (
    <div className="qr-shell">
      <div className="qr-header">
        <span className="qr-title">{title}</span>
        <div className="qr-header-right">
          <span className="qr-pill">Q {index + 1} / {total}</span>
        </div>
      </div>
      <div className="qr-progress">
        <div className="qr-progress-fill" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <div className="qr-body">
        <span className="act-type-tag">{ITEM_TYPES[item.type]?.label}</span>
        <p className="qr-question">{item.prompt}</p>

        {renderItem()}

        {checked && (
          <div className={`qr-feedback ${correct ? 'qr-feedback-correct' : 'qr-feedback-incorrect'}`}>
            {correct ? 'Correct!' : 'Not quite — the correct answer is highlighted above.'}
            {item.explanation && <div className="act-explanation">{item.explanation}</div>}
          </div>
        )}

        <div className="qr-actions">
          <button className="qr-btn qr-btn-ghost" onClick={onExit}>Exit</button>
          {!checked && (
            <>
              <button className="qr-btn qr-btn-secondary" onClick={() => { setChecked(true) }} disabled={!canCheck}
                style={{ opacity: canCheck ? 1 : 0.5 }}>
                Check answer
              </button>
              <button className="qr-btn qr-btn-ghost" onClick={handleNext}>Skip</button>
            </>
          )}
          {checked && (
            <button className="qr-btn qr-btn-primary" onClick={handleNext}>
              {index + 1 >= total ? 'Finish' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
