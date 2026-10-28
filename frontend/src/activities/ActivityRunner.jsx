import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import ChoiceItem from './items/ChoiceItem'
import TemplateItem from './items/TemplateItem'
import MatchItem from './items/MatchItem'
import OrderItem from './items/OrderItem'
import CategoriseItem from './items/CategoriseItem'
import ImageClickItem from './items/ImageClickItem'
import ImageLabelItem from './items/ImageLabelItem'
import ImageFindItem from './items/ImageFindItem'
import { IMAGE_TYPES } from './types'
import { labelPool } from './image'
import { CHOICE_TYPES, TEMPLATE_TYPES, ARRANGE_TYPES, ITEM_TYPES } from './types'
import { shuffle, shuffleDifferent, matchPool, categoriseItems } from './arrange'
import { parseTemplate } from './template'
import { isItemCorrect, hasAnswer, describeAnswer, scoreRun } from './scoring'

/**
 * ActivityRunner - student-facing player for activity-backed quizzes.
 * Same contract as QuizRunner: title, onComplete(result), onExit().
 * result = { score, total, percent, responses }
 *
 * Behaviour matches the original quiz runner where task types overlap:
 *  - single / tf : click an answer -> instant feedback -> auto-advance
 *                  (waits for "Next" instead if the task has an explanation)
 *  - multi       : select options -> "Check answer" -> feedback -> "Next"
 *  - settings    : shuffle question order, hide feedback (speed mode)
 * Task-type players live in ./items; add a case in renderItem() for new types.
 */

const AUTO_ADVANCE_MS = 900

function buildOrders(items) {
  const orders = {}
  items.forEach(it => {
    if (it.type === 'dropdown') {
      // one shuffled option list per blank, so the correct answer isn't always first
      orders[it.id] = parseTemplate(it.config?.template, 'dropdown').blanks.map(b => shuffle(b.options))
      return
    }
    if (TEMPLATE_TYPES.includes(it.type)) { orders[it.id] = null; return }
    if (it.type === 'match') { orders[it.id] = shuffle(matchPool(it.config)); return }
    if (it.type === 'categorise') { orders[it.id] = shuffle(categoriseItems(it.config).map((_, i) => i)); return }
    if (it.type === 'imagefind') { orders[it.id] = shuffle((it.config?.regions ?? []).map((_, i) => i)); return }
    if (it.type === 'imageclick') { orders[it.id] = null; return }
    if (it.type === 'imagelabel') { orders[it.id] = it.config?.mode === 'type' ? null : shuffle(labelPool(it.config)); return }
    if (it.type === 'order') { orders[it.id] = shuffleDifferent(it.config?.items ?? []); return }
    const ids = it.mc_options.map(o => o.id)
    // Keep true/false in authored order (True, then False); shuffle the rest
    orders[it.id] = it.type === 'tf' ? ids : shuffle(ids)
  })
  return orders
}

// Types that are checked the moment an answer is clicked
const INSTANT_TYPES = ['single', 'tf']

export default function ActivityRunner({ items, title, onComplete, onExit }) {
  const [run, setRun] = useState(0) // bump to restart
  const [shuffleQ, setShuffleQ] = useState(false)
  const [hideFeedback, setHideFeedback] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const orders = useMemo(() => buildOrders(items), [items, run]) // eslint-disable-line react-hooks/exhaustive-deps
  const seq = useMemo(() => (shuffleQ ? shuffle(items) : items), [items, shuffleQ, run]) // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex]     = useState(0)
  const [answers, setAnswers] = useState({})   // item.id -> response
  const [checked, setChecked] = useState(false)
  const [result, setResult]   = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const total = seq.length
  const item  = seq[index]
  const response = answers[item?.id] ?? []

  const restart = useCallback(() => {
    clearTimeout(timer.current)
    setRun(r => r + 1); setIndex(0); setAnswers({}); setChecked(false); setResult(null)
  }, [])

  // Move on from the current task. nextAnswers is passed in so the final
  // score never reads a stale state value.
  function advance(nextAnswers) {
    if (index + 1 >= total) {
      const r = scoreRun(items, nextAnswers)
      setResult(r)
      onComplete?.(r)
    } else {
      setIndex(i => i + 1)
      setChecked(false)
    }
  }

  function handleChange(val) {
    const next = { ...answers, [item.id]: val }
    setAnswers(next)
    if (!INSTANT_TYPES.includes(item.type)) return // multi waits for "Check answer"

    if (hideFeedback) { advance(next); return }
    setChecked(true)
    if (!item.explanation) {
      timer.current = setTimeout(() => advance(next), AUTO_ADVANCE_MS)
    }
  }

  function handleCheck() {
    // An untouched ordering task is answered by the shuffled list on screen - commit it.
    const resp = item.type === 'order' && !response.length ? orders[item.id] : response
    const next = { ...answers, [item.id]: resp }
    setAnswers(next)
    if (hideFeedback) { advance(next); return }
    setChecked(true)
  }

  function handleSubmit() {
    if (!checked && hasAnswer(item, response)) handleCheck()
  }

  function renderItem() {
    if (item.type === 'imagefind') {
      return <ImageFindItem key={item.id} item={item} order={orders[item.id]} selected={response} checked={checked} onChange={handleChange} />
    }
    if (item.type === 'imageclick') {
      return <ImageClickItem key={item.id} item={item} selected={response} checked={checked} onChange={handleChange} />
    }
    if (item.type === 'imagelabel') {
      return <ImageLabelItem key={item.id} item={item} pool={orders[item.id]} selected={response} checked={checked} onChange={handleChange} onSubmit={handleSubmit} />
    }
    if (item.type === 'match') {
      return <MatchItem key={item.id} item={item} pool={orders[item.id]} selected={response} checked={checked} onChange={handleChange} />
    }
    if (item.type === 'categorise') {
      return <CategoriseItem key={item.id} item={item} order={orders[item.id]} selected={response} checked={checked} onChange={handleChange} />
    }
    if (item.type === 'order') {
      return <OrderItem key={item.id} item={item} initial={orders[item.id]} selected={response} checked={checked} onChange={handleChange} />
    }
    if (TEMPLATE_TYPES.includes(item.type)) {
      return (
        <TemplateItem
          key={item.id}
          item={item}
          orders={orders[item.id]}
          selected={response}
          checked={checked}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      )
    }
    if (CHOICE_TYPES.includes(item.type)) {
      return (
        <ChoiceItem
          item={item}
          optionOrder={orders[item.id]}
          selected={response}
          checked={checked}
          onChange={handleChange}
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
              const { yours, correct } = describeAnswer(it, r.response)
              const heading = it.prompt || ITEM_TYPES[it.type]?.label || ''
              return (
                <div key={it.id} className={`qr-summary-item ${r.is_correct ? 'qr-correct' : 'qr-incorrect'}`}>
                  <div className="qr-summary-q"><span className="qr-summary-num">{i + 1}</span>{heading}</div>
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
  const instant = INSTANT_TYPES.includes(item.type)
  const canCheck = hasAnswer(item, response)
  const isTemplate = TEMPLATE_TYPES.includes(item.type)
  const isArrange = ARRANGE_TYPES.includes(item.type) || IMAGE_TYPES.includes(item.type)
  const autoAdvancing = checked && instant && !item.explanation

  return (
    <div className="qr-shell">
      <div className="qr-header">
        <span className="qr-title">{title}</span>
        <div className="qr-header-right">
          <span className="qr-pill">Q {index + 1} / {total}</span>
          <button className="qr-settings-btn" onClick={() => setSettingsOpen(o => !o)} aria-label="Quiz settings">⚙</button>
        </div>
      </div>

      {settingsOpen && (
        <div className="qr-settings-panel">
          <label className="qr-toggle-label">
            <input type="checkbox" checked={shuffleQ}
              onChange={e => { setShuffleQ(e.target.checked); restart() }} />
            Shuffle question order
          </label>
          <label className="qr-toggle-label">
            <input type="checkbox" checked={hideFeedback}
              onChange={e => setHideFeedback(e.target.checked)} />
            Hide feedback (speed mode)
          </label>
        </div>
      )}

      <div className="qr-progress">
        <div className="qr-progress-fill" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <div className="qr-body">
        {item.type !== 'single' && <span className="act-type-tag">{ITEM_TYPES[item.type]?.label}</span>}
        {item.prompt && <p className="qr-question">{item.prompt}</p>}

        {renderItem()}

        {checked && (
          <div className={`qr-feedback ${correct ? 'qr-feedback-correct' : 'qr-feedback-incorrect'}`}>
            {correct
              ? 'Correct!'
              : isTemplate || isArrange
                ? 'Incorrect — the right answers are shown above.'
                : 'Incorrect — the correct answer is highlighted above.'}
            {item.explanation && <div className="act-explanation">{item.explanation}</div>}
          </div>
        )}

        <div className="qr-actions">
          <button className="qr-btn qr-btn-ghost" onClick={onExit}>Exit</button>
          {!checked && (
            <button className="qr-btn qr-btn-secondary" onClick={() => advance(answers)}>Skip</button>
          )}
          {!checked && !instant && (
            <button className="qr-btn qr-btn-primary" onClick={handleCheck} disabled={!canCheck}
              style={{ opacity: canCheck ? 1 : 0.5 }}>
              Check answer
            </button>
          )}
          {checked && !autoAdvancing && (
            <button className="qr-btn qr-btn-primary" onClick={() => advance(answers)}>
              {index + 1 >= total ? 'Finish' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
