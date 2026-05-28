import { useState, useCallback } from 'react'

// ── Helpers ──────────────────────────────────────────────────────
function parseDateNum(str) {
  const m = String(str || '').match(/(\d+)/)
  return m ? parseInt(m[1]) : 0
}

// Sort oldest-first for BC dates (higher number = older)
function sortByDate(events) {
  return [...events].sort((a, b) => parseDateNum(b.date) - parseDateNum(a.date))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom(arr, n) {
  return shuffleArray(arr).slice(0, n)
}

// ── Vertical timeline view ───────────────────────────────────────
function TimelineView({ events }) {
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
            {ev.definition && (
              <p className="tl-definition">{ev.definition}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Session size picker ──────────────────────────────────────────
const SESSION_SIZES = [5, 10, 15, 20]

function SessionPicker({ total, onStart }) {
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
function DateTest({ events, allEvents, onRetry }) {
  const [index, setIndex]   = useState(0)
  const [score, setScore]   = useState(0)
  const [chosen, setChosen] = useState(null) // chosen date string
  const [finished, setFinished] = useState(false)

  const current = events[index]

  // Build 4 options: 1 correct + 3 wrong from allEvents pool
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
      if (index < events.length - 1) {
        setIndex(i => i + 1)
        setChosen(null)
      } else {
        setFinished(true)
      }
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
        <div className="tl-progress-fill" style={{ width: `${((index) / events.length) * 100}%` }} />
      </div>

      <p className="tl-test-prompt">When did this event occur?</p>
      <p className="tl-test-question">{current.label}</p>

      <div className="tl-date-options">
        {currentOptions.map(date => {
          let cls = 'tl-date-option'
          if (chosen !== null) {
            if (date === current.date) cls += ' tl-opt-correct'
            else if (date === chosen)  cls += ' tl-opt-incorrect'
            else                       cls += ' tl-opt-dim'
          }
          return (
            <button key={date} className={cls} onClick={() => handleChoose(date)}>
              {date}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Match Test ───────────────────────────────────────────────────
// Ensures unique dates for clean matching
function buildMatchSession(events, size) {
  const seen = new Set()
  const unique = events.filter(e => { if (seen.has(e.date)) return false; seen.add(e.date); return true })
  return pickRandom(unique, Math.min(size, unique.length))
}

function MatchTest({ events, allEvents, onRetry }) {
  const [session]   = useState(() => buildMatchSession(events, events.length))
  const [dates]     = useState(() => shuffleArray(session.map(e => e.date)))
  const [selected, setSelected] = useState(null)   // selected event id
  const [matched, setMatched]   = useState({})      // eventId → date
  const [flash, setFlash]       = useState(null)    // {eventId, dateStr, result}
  const [finished, setFinished] = useState(false)

  function handleEventClick(eventId) {
    if (matched[eventId]) return
    setSelected(prev => prev === eventId ? null : eventId)
    setFlash(null)
  }

  function handleDateClick(dateStr) {
    if (!selected) return
    const ev = session.find(e => e.id === selected)
    if (!ev) return

    if (ev.date === dateStr) {
      const newMatched = { ...matched, [ev.id]: dateStr }
      setMatched(newMatched)
      setSelected(null)
      setFlash(null)
      if (Object.keys(newMatched).length === session.length) setFinished(true)
    } else {
      setFlash({ eventId: ev.id, dateStr })
      setTimeout(() => { setFlash(null); setSelected(null) }, 700)
    }
  }

  function isDateMatched(dateStr) {
    return Object.values(matched).includes(dateStr)
  }

  if (finished) {
    return (
      <div className="tl-result">
        <span className="tl-result-icon">🎉</span>
        <p className="tl-result-heading">All matched!</p>
        <p className="tl-result-sub">{session.length} events matched correctly.</p>
        <button className="tl-btn tl-btn-primary" onClick={onRetry}>Try again</button>
      </div>
    )
  }

  const matchedCount = Object.keys(matched).length

  return (
    <div className="tl-match-test">
      <div className="tl-test-progress">
        <span>Matched: {matchedCount} / {session.length}</span>
      </div>
      <div className="tl-progress-bar">
        <div className="tl-progress-fill" style={{ width: `${(matchedCount / session.length) * 100}%` }} />
      </div>

      <p className="tl-match-hint">Select an event, then click its date to match them.</p>

      <div className="tl-match-grid">
        {/* Events column */}
        <div className="tl-match-col">
          <p className="tl-match-col-header">Events</p>
          {session.map(ev => {
            const isMatched   = !!matched[ev.id]
            const isSelected  = selected === ev.id
            const isFlashing  = flash?.eventId === ev.id
            let cls = 'tl-match-item'
            if (isMatched)  cls += ' tl-match-correct'
            else if (isSelected)  cls += ' tl-match-selected'
            else if (isFlashing)  cls += ' tl-match-wrong'
            return (
              <button key={ev.id} className={cls} onClick={() => handleEventClick(ev.id)}>
                {isMatched && <span className="tl-match-check">✓</span>}
                {ev.label}
              </button>
            )
          })}
        </div>

        {/* Dates column */}
        <div className="tl-match-col">
          <p className="tl-match-col-header">Dates</p>
          {dates.map(date => {
            const isMatched  = isDateMatched(date)
            const isFlashing = flash?.dateStr === date
            let cls = 'tl-match-item tl-match-date'
            if (isMatched)  cls += ' tl-match-correct'
            else if (isFlashing) cls += ' tl-match-wrong'
            else if (selected)   cls += ' tl-match-date-active'
            return (
              <button key={date} className={cls} onClick={() => handleDateClick(date)} disabled={isMatched}>
                {isMatched && <span className="tl-match-check">✓</span>}
                {date}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main shell ───────────────────────────────────────────────────
/**
 * TimelineShell
 *
 * Props:
 *   events  — array of {id, label, date, definition?}
 *   title   — string shown above the mode bar
 */
export default function TimelineShell({ events = [], title }) {
  const [mode, setMode] = useState('view')
  const [session, setSession] = useState(null) // array of picked events for test

  if (events.length === 0) {
    return (
      <div className="tl-empty">
        <span className="tl-empty-icon">📅</span>
        <p>No dated events found for this selection.</p>
      </div>
    )
  }

  function startSession(size) {
    const sorted = sortByDate(events)
    setSession(pickRandom(sorted, size))
  }

  function resetSession() {
    setSession(null)
  }

  function changeMode(newMode) {
    setMode(newMode)
    setSession(null)
  }

  return (
    <div className="tl-shell">
      {/* Mode selector */}
      <div className="tl-mode-bar">
        <button className={`tl-mode-btn ${mode === 'view'       ? 'tl-mode-active' : ''}`} onClick={() => changeMode('view')}>
          📅 Timeline
        </button>
        <button className={`tl-mode-btn ${mode === 'date-test'  ? 'tl-mode-active' : ''}`} onClick={() => changeMode('date-test')}>
          🎯 Date Test
        </button>
        <button className={`tl-mode-btn ${mode === 'match-test' ? 'tl-mode-active' : ''}`} onClick={() => changeMode('match-test')}>
          🔗 Match Test
        </button>
        <span className="tl-event-count">{events.length} events</span>
      </div>

      {/* View mode */}
      {mode === 'view' && <TimelineView events={events} />}

      {/* Test modes — session picker or active test */}
      {(mode === 'date-test' || mode === 'match-test') && !session && (
        <SessionPicker total={events.length} onStart={startSession} />
      )}

      {mode === 'date-test' && session && (
        <DateTest
          key={session.map(e => e.id).join('-')}
          events={session}
          allEvents={events}
          onRetry={resetSession}
        />
      )}

      {mode === 'match-test' && session && (
        <MatchTest
          key={session.map(e => e.id).join('-')}
          events={session}
          allEvents={events}
          onRetry={resetSession}
        />
      )}
    </div>
  )
}
