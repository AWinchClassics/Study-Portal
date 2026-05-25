import { useState, useEffect, useCallback } from 'react'

/**
 * QuizRunner
 *
 * Props:
 *   questions   - array of { question, options[], correctIndex }
 *   title       - string shown at the top
 *   onComplete  - function(score, total, answers) called when quiz finishes
 *   onExit      - function() called when user clicks Exit at any point
 */

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Build initial state for a fresh attempt
function buildInitialState(questions, shuffle) {
  const order = shuffle
    ? shuffleArray(questions.map((_, i) => i))
    : questions.map((_, i) => i)
  return {
    questionOrder: order,
    currentIndex: 0,
    score: 0,
    answers: [],        // { questionIndex, selected, correctIndex, isCorrect }
    phase: 'question',  // 'question' | 'feedback' | 'results'
    selectedOption: null,
    optionOrder: shuffleArray(questions[order[0]].options.map((_, i) => i)),
  }
}

export default function QuizRunner({ questions, title, onComplete, onExit }) {
  const [shuffle, setShuffle] = useState(false)
  const [hideFeedback, setHideFeedback] = useState(false)
  const [state, setState] = useState(() => buildInitialState(questions, false))
  const [settingsOpen, setSettingsOpen] = useState(false)

  // When shuffle setting changes, restart with new order
  useEffect(() => {
    setState(buildInitialState(questions, shuffle))
  }, [shuffle, questions])

  const total = questions.length
  const { questionOrder, currentIndex, score, answers, phase, selectedOption, optionOrder } = state

  const currentQuestionIndex = questionOrder[currentIndex]
  const currentQuestion = questions[currentQuestionIndex]

  // ── Answer selection ──────────────────────────────────────────
  const handleSelect = useCallback((optionIndex) => {
    if (phase !== 'question' || selectedOption !== null) return

    const isCorrect = optionIndex === currentQuestion.correctIndex

    const newAnswer = {
      questionIndex: currentQuestionIndex,
      selected: optionIndex,
      correctIndex: currentQuestion.correctIndex,
      isCorrect,
    }

    setState(s => ({
      ...s,
      selectedOption: optionIndex,
      score: isCorrect ? s.score + 1 : s.score,
      answers: [...s.answers, newAnswer],
      phase: hideFeedback ? 'question' : 'feedback',
    }))

    // Auto-advance after feedback delay (or immediately if feedback hidden)
    const delay = hideFeedback ? 0 : 900
    setTimeout(() => {
      setState(s => {
        if (s.selectedOption !== optionIndex) return s // stale closure guard
        const nextIndex = s.currentIndex + 1
        if (nextIndex >= total) {
          const finalAnswers = [...s.answers]
          onComplete?.(s.score, total, finalAnswers)
          return { ...s, phase: 'results' }
        }
        const nextQIdx = s.questionOrder[nextIndex]
        return {
          ...s,
          currentIndex: nextIndex,
          selectedOption: null,
          phase: 'question',
          optionOrder: shuffleArray(questions[nextQIdx].options.map((_, i) => i)),
        }
      })
    }, delay)
  }, [phase, selectedOption, currentQuestion, currentQuestionIndex, hideFeedback, total, onComplete, questions])

  // ── Skip ─────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (phase !== 'question') return

    const skippedAnswer = {
      questionIndex: currentQuestionIndex,
      selected: null,
      correctIndex: currentQuestion.correctIndex,
      isCorrect: false,
    }

    setState(s => {
      const nextIndex = s.currentIndex + 1
      if (nextIndex >= total) {
        const finalAnswers = [...s.answers, skippedAnswer]
        onComplete?.(s.score, total, finalAnswers)
        return { ...s, answers: finalAnswers, phase: 'results' }
      }
      const nextQIdx = s.questionOrder[nextIndex]
      return {
        ...s,
        currentIndex: nextIndex,
        answers: [...s.answers, skippedAnswer],
        selectedOption: null,
        phase: 'question',
        optionOrder: shuffleArray(questions[nextQIdx].options.map((_, i) => i)),
      }
    })
  }, [phase, currentQuestionIndex, currentQuestion, total, onComplete, questions])

  // ── Restart ───────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setState(buildInitialState(questions, shuffle))
  }, [questions, shuffle])

  // ── Progress bar ──────────────────────────────────────────────
  const progressPercent = phase === 'results' ? 100 : (currentIndex / total) * 100

  // ── Results screen ────────────────────────────────────────────
  if (phase === 'results') {
    const finalScore = state.score
    const percent = Math.round((finalScore / total) * 100)
    const grade = percent >= 80 ? 'high' : percent >= 50 ? 'mid' : 'low'

    return (
      <div className="qr-shell">
        <div className="qr-header">
          <span className="qr-title">{title}</span>
          <span className="qr-pill">Complete</span>
        </div>

        <div className="qr-progress">
          <div className="qr-progress-fill" style={{ width: '100%' }} />
        </div>

        <div className="qr-results">
          <div className={`qr-score-display qr-score-${grade}`}>
            <span className="qr-score-number">{finalScore}<span className="qr-score-total">/{total}</span></span>
            <span className="qr-score-percent">{percent}%</span>
          </div>

          <div className="qr-result-actions">
            <button className="qr-btn qr-btn-primary" onClick={handleRestart}>
              Retake quiz
            </button>
            <button className="qr-btn qr-btn-secondary" onClick={onExit}>
              Back to chunk
            </button>
          </div>

          <div className="qr-summary">
            <h3 className="qr-summary-heading">Answer review</h3>
            {state.answers.map((ans, i) => {
              const q = questions[ans.questionIndex]
              const userAnswer = ans.selected === null ? 'Skipped' : q.options[ans.selected]
              const correctAnswer = q.options[ans.correctIndex]
              return (
                <div key={i} className={`qr-summary-item ${ans.isCorrect ? 'qr-correct' : 'qr-incorrect'}`}>
                  <div className="qr-summary-q">
                    <span className="qr-summary-num">{i + 1}</span>
                    {q.question}
                  </div>
                  <div className="qr-summary-answers">
                    <div className="qr-summary-row">
                      <span className="qr-summary-label">Your answer</span>
                      <span className={`qr-summary-val ${ans.isCorrect ? 'qr-val-correct' : 'qr-val-incorrect'}`}>
                        {userAnswer}
                      </span>
                    </div>
                    {!ans.isCorrect && (
                      <div className="qr-summary-row">
                        <span className="qr-summary-label">Correct answer</span>
                        <span className="qr-summary-val qr-val-correct">{correctAnswer}</span>
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

  // ── Question screen ───────────────────────────────────────────
  const isAnswered = selectedOption !== null

  return (
    <div className="qr-shell">

      {/* Header */}
      <div className="qr-header">
        <span className="qr-title">{title}</span>
        <div className="qr-header-right">
          <span className="qr-pill">Q {currentIndex + 1} / {total}</span>
          <button
            className="qr-settings-btn"
            onClick={() => setSettingsOpen(o => !o)}
            aria-label="Quiz settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="qr-settings-panel">
          <label className="qr-toggle-label">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={e => setShuffle(e.target.checked)}
            />
            Shuffle question order
          </label>
          <label className="qr-toggle-label">
            <input
              type="checkbox"
              checked={hideFeedback}
              onChange={e => setHideFeedback(e.target.checked)}
            />
            Hide feedback (speed mode)
          </label>
        </div>
      )}

      {/* Progress bar */}
      <div className="qr-progress">
        <div className="qr-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Question */}
      <div className="qr-body">
        <p className="qr-question">{currentQuestion.question}</p>

        <div className="qr-options">
          {optionOrder.map((optIdx, displayIdx) => {
            const option = currentQuestion.options[optIdx]
            const isSelected = selectedOption === optIdx
            const isCorrect = optIdx === currentQuestion.correctIndex
            const showCorrect = isAnswered && isCorrect && !hideFeedback
            const showWrong   = isAnswered && isSelected && !isCorrect && !hideFeedback

            let cls = 'qr-option'
            if (showCorrect) cls += ' qr-option-correct'
            else if (showWrong) cls += ' qr-option-incorrect'
            else if (isSelected) cls += ' qr-option-selected'

            return (
              <button
                key={optIdx}
                className={cls}
                onClick={() => handleSelect(optIdx)}
                disabled={isAnswered}
              >
                <span className="qr-option-letter">
                  {String.fromCharCode(65 + displayIdx)}
                </span>
                <span className="qr-option-text">{option}</span>
                {showCorrect && <span className="qr-option-icon">✓</span>}
                {showWrong   && <span className="qr-option-icon">✗</span>}
              </button>
            )
          })}
        </div>

        {/* Inline feedback */}
        {isAnswered && !hideFeedback && (
          <div className={`qr-feedback ${selectedOption === currentQuestion.correctIndex ? 'qr-feedback-correct' : 'qr-feedback-incorrect'}`}>
            {selectedOption === currentQuestion.correctIndex
              ? 'Correct!'
              : 'Incorrect — the correct answer is highlighted above.'}
          </div>
        )}

        <div className="qr-actions">
          <button className="qr-btn qr-btn-ghost" onClick={onExit}>
            Exit
          </button>
          {!isAnswered && (
            <button className="qr-btn qr-btn-secondary" onClick={handleSkip}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
