import { useState, useCallback } from 'react'

// ── Helpers ──────────────────────────────────────────────────────

// Convert a date string to a signed integer for chronological sorting.
// BCE / BC  → negative  (e.g. "31 BCE" → -31)
// CE  / AD  → positive  (e.g. "9 CE"   →  +9)
// No suffix → assumed BCE, negated (e.g. "490" → -490)
// This gives a single ascending scale: most negative = oldest.
export function parseDateToSort(str) {
  if (!str) return 0
  const s     = String(str).trim().toUpperCase()
  const match = s.match(/(\d+)/)
  if (!match) return 0
  const n = parseInt(match[1])
  if (s.includes('CE') || s.includes('AD')) return n    // CE / AD → positive
  return -n                                              // BCE / BC / bare → negative
}

// Keep parseDateNum as an alias so TeacherTimelinesPage (which imports it)
// continues to work — it only uses it for secondary sort within same-year groups,
// where the old behaviour is still fine.
export function parseDateNum(str) {
  const m = String(str || '').match(/(\d+)/)
  return m ? parseInt(m[1]) : 0
}

// Sort events oldest-first using the signed BCE/CE scale.
export function sortByDate(events) {
  return [...events].sort((a, b) => {
    const d = parseDateToSort(a.date) - parseDateToSort(b.date)  // ascending = oldest first
    if (d !== 0) return d
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickRandom(arr, n) {
  return shuffleArray(arr).slice(0, n)
}

// ── Vertical timeline view ───────────────────────────────────────
export function TimelineView({ events }) {
  const sorted = sortByDate(events)
  return (
    <div className="tl-view">
      {sorted.map((ev, i) => (
        <div key={ev.id} className="tl-event">
          <div className="tl-date-col">
            <span className="tl-date">{ev.date}</span>
          </div>
          <div className="tl-spine-col">
            <div className="tl-dot" />
            {i < sorted.length - 1 && <div className="tl-connector" />}
          </div>
          <div className="tl-content-col">
            <p className="tl-label">{ev.label}</p>
            {ev.definition && <p className="tl-definition">{ev.definition}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Session size picker ──────────────────────────────────────────
const SESSION_SIZES = [5, 10, 15, 20]

export function SessionPicker({ total, onStart }) {
  const options = SESSION_SIZES.filter(n => n <= total)
  return (
    <div className="tl-session-picker">
      <p className="tl-session-heading">How many events?</p>
      <p className="tl-session-sub">{total} events available</p>
      <div className="tl-session-options">
        {options.map(n => (
          <button key={n} className="tl-session-btn" onClick={() => onStart(n)}>{n}</button>
        ))}
        <button className="tl-session-btn tl-session-all" onClick={() => onStart(total)}>
          All {total}
        </button>
      </div>
    </div>
  )
}

// ── Date Test ────────────────────────────────────────────────────
export function DateTest({ events, allEvents, onRetry }) {
  const [index, setIndex]   = useState(0)
  const [score, setScore]   = useState(0)
  const [chosen, setChosen] = useState(null)
  const [finished, setFinished] = useState(false)

  const current = events[index]

  const buildOptions = useCallback((ev) => {
    const wrong = allEvents
      .filter(e => e.id !== ev.id && e.date !== ev.date)
      .map(e => e.date)
    const wrongPick = pickRandom([...new Set(wrong)], 3)
    return shuffleArray([ev.date, ...wrongPick])
  }, [allEvents])

  const [options] = useState(() => events.map(buildOptions))

  function handleChoose(date) {
    if (chosen !== null) return
    const correct = date === current.date
    setChosen(date)
    if (correct) setScore(s => s + 1)
    setTimeout(() => {
      if (index < events.length - 1) { setIndex(i => i + 1); setChosen(null) }
      else setFinished(true)
    }, 900)
  }

  if (finished) {
    const pct = Math.round((score / events.length) * 100)
    const grade = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'
    return (
      <div className="tl-result">
        <div className={`tl-result-score tl-score-${grade}`}>
          <span className="tl-score-num">{score}<span className="tl-score-denom">/{events.length}</span></span>
          <span className="tl-score-pct">{pct}%</span>
        </div>
        <button className="tl-btn tl-btn-primary" onClick={onRetry}>Try again</button>
      </div>
    )
  }

  const currentOptions = options[index]

  return (
    <div className="tl-date-test">
      <div className="tl-test-progress">
        <span>{index + 1} / {events.length}</span>
        <span className="tl-test-score">Score: {score}</span>
      </div>
      <div className="tl-progress-bar">
        <div className="tl-progress-fill" style={{ width: `${(index / events.length) * 100}%` }} />
      </div>
      <p className="tl-test-prompt">When did this event occur?</p>
      <p className="tl-test-question">{current.label}</p>
      <div className="tl-date-options">
        {currentOptions.map(date => {
          let cls = 'tl-date-option'
          if (chosen !== null) {
            if (date === current.date) cls += ' tl-opt-correct'
            else if (date === chosen) cls += ' tl-opt-incorrect'
            else cls += ' tl-opt-dim'
          }
          return <button key={date} className={cls} onClick={() => handleChoose(date)}>{date}</button>
        })}
      </div>
    </div>
  )
}

// ── Match Test ───────────────────────────────────────────────────
// Dates column: sorted chronologically, unique dates, showing count for duplicates.
// Multiple events can share the same date — all are included and can be matched.
export function MatchTest({ events, onRetry }) {
  // Events shown shuffled in the left column
  const [shuffledEvents] = useState(() => shuffleArray(events))

  // Dates column: sorted unique dates (oldest BC first = highest number first)
  const sortedUniqueDates = [...new Set(events.map(e => e.date))]
    .sort((a, b) => parseDateToSort(a) - parseDateToSort(b))

  const [selectedEventId, setSelectedEventId] = useState(null)
  const [matched, setMatched] = useState(new Set()) // event IDs that are matched
  const [flash, setFlash]     = useState(null)       // {eventId, date}
  const [finished, setFinished] = useState(false)

  function handleEventClick(eventId) {
    if (matched.has(eventId)) return
    setSelectedEventId(prev => prev === eventId ? null : eventId)
    setFlash(null)
  }

  function handleDateClick(date) {
    if (!selectedEventId) return
    const ev = events.find(e => e.id === selectedEventId)
    if (!ev) return

    if (ev.date === date) {
      const newMatched = new Set([...matched, ev.id])
      setMatched(newMatched)
      setSelectedEventId(null)
      setFlash(null)
      if (newMatched.size === events.length) setFinished(true)
    } else {
      setFlash({ eventId: ev.id, date })
      setTimeout(() => { setFlash(null); setSelectedEventId(null) }, 700)
    }
  }

  // How many events with this date, how many are matched
  function dateInfo(date) {
    const total = events.filter(e => e.date === date).length
    const done  = events.filter(e => e.date === date && matched.has(e.id)).length
    return { total, done, complete: done === total }
  }

  if (finished) {
    return (
      <div className="tl-result">
        <span className="tl-result-icon">🎉</span>
        <p className="tl-result-heading">All matched!</p>
        <p className="tl-result-sub">{events.length} events matched correctly.</p>
        <button className="tl-btn tl-btn-primary" onClick={onRetry}>Try again</button>
      </div>
    )
  }

  const matchedCount = matched.size

  return (
    <div className="tl-match-test">
      <div className="tl-test-progress">
        <span>Matched: {matchedCount} / {events.length}</span>
      </div>
      <div className="tl-progress-bar">
        <div className="tl-progress-fill" style={{ width: `${(matchedCount / events.length) * 100}%` }} />
      </div>
      <p className="tl-match-hint">Select an event, then click its date.</p>

      <div className="tl-match-grid">
        {/* Events column — shuffled */}
        <div className="tl-match-col">
          <p className="tl-match-col-header">Events</p>
          {shuffledEvents.map(ev => {
            const isMatched  = matched.has(ev.id)
            const isSelected = selectedEventId === ev.id
            const isFlashing = flash?.eventId === ev.id
            let cls = 'tl-match-item'
            if (isMatched)  cls += ' tl-match-correct'
            else if (isSelected) cls += ' tl-match-selected'
            else if (isFlashing) cls += ' tl-match-wrong'
            return (
              <button key={ev.id} className={cls} onClick={() => handleEventClick(ev.id)}>
                {isMatched && <span className="tl-match-check">✓</span>}
                {ev.label}
              </button>
            )
          })}
        </div>

        {/* Dates column — sorted chronologically, unique dates */}
        <div className="tl-match-col">
          <p className="tl-match-col-header">Dates</p>
          {sortedUniqueDates.map(date => {
            const { total, done, complete } = dateInfo(date)
            const isFlashing = flash?.date === date
            let cls = 'tl-match-item tl-match-date'
            if (complete)        cls += ' tl-match-correct'
            else if (isFlashing) cls += ' tl-match-wrong'
            else if (selectedEventId) cls += ' tl-match-date-active'
            return (
              <button key={date} className={cls}
                onClick={() => handleDateClick(date)}
                disabled={complete}
              >
                {complete && <span className="tl-match-check">✓</span>}
                <span>{date}</span>
                {/* Show count badge only when there are multiple events for this date */}
                {total > 1 && (
                  <span className="tl-date-multi-badge">
                    {complete ? total : `${done}/${total}`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Shell — pure content renderer, no mode bar ───────────────────
/**
 * TimelineShell receives mode + session state from parent (TimelineTabContent).
 * This keeps the mode selector above the timeline switcher at all times.
 *
 * Props:
 *   events          — full event array
 *   mode            — 'view' | 'date-test' | 'match-test'
 *   session         — picked events for test, or null (shows session picker)
 *   onStartSession  — (size) => void
 *   onResetSession  — () => void
 */
export default function TimelineShell({ events = [], mode, session, onStartSession, onResetSession }) {
  if (events.length === 0) {
    return (
      <div className="tl-empty">
        <span className="tl-empty-icon">📅</span>
        <p>No dated events found for this selection.</p>
      </div>
    )
  }

  if (mode === 'view') return <TimelineView events={events} />

  // Test modes
  if (!session) return <SessionPicker total={events.length} onStart={onStartSession} />

  if (mode === 'date-test') {
    return (
      <DateTest
        key={session.map(e => e.id).join('-')}
        events={session}
        allEvents={events}
        onRetry={onResetSession}
      />
    )
  }

  if (mode === 'match-test') {
    return (
      <MatchTest
        key={session.map(e => e.id).join('-')}
        events={session}
        onRetry={onResetSession}
      />
    )
  }

  return null
}
