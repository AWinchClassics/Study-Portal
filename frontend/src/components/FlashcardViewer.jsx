import { useState, useEffect, useCallback, useRef } from 'react'

const PRIORITIES = ['all', 'core', 'useful', 'stretch']

const CATEGORY_COLOURS = {
  person:  '#7c3aed',
  event:   '#0ea5e9',
  concept: '#16a34a',
  source:  '#d97706',
  place:   '#db2777',
  other:   '#6b7280',
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FlashcardViewer({ cards = [] }) {
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [shuffled, setShuffled]             = useState(false)
  const [deck, setDeck]                     = useState([])
  const [index, setIndex]                   = useState(0)
  const [flipped, setFlipped]               = useState(false)
  const [knownIds, setKnownIds]             = useState(new Set())
  const [hideKnown, setHideKnown]           = useState(false)
  const [finished, setFinished]             = useState(false)
  const cardRef = useRef(null)

  // Rebuild deck whenever filter/shuffle/hideKnown changes
  useEffect(() => {
    let filtered = priorityFilter === 'all'
      ? [...cards]
      : cards.filter(c => c.priority === priorityFilter)

    if (hideKnown) filtered = filtered.filter(c => !knownIds.has(c.id))
    const ordered = shuffled ? shuffleArray(filtered) : filtered

    setDeck(ordered)
    setIndex(0)
    setFlipped(false)
    setFinished(false)
  }, [cards, priorityFilter, shuffled, hideKnown, knownIds])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped(f => !f)
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, deck])

  const goNext = useCallback(() => {
    if (index < deck.length - 1) {
      setIndex(i => i + 1)
      setFlipped(false)
    } else {
      setFinished(true)
    }
  }, [index, deck.length])

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(i => i - 1)
      setFlipped(false)
    }
  }, [index])

  function markKnown() {
    if (!deck[index]) return
    setKnownIds(prev => {
      const next = new Set(prev)
      next.add(deck[index].id)
      return next
    })
    goNext()
  }

  function restart(onlyUnknown = false) {
    if (onlyUnknown) {
      setHideKnown(true)
    } else {
      setKnownIds(new Set())
      setHideKnown(false)
    }
    setIndex(0)
    setFlipped(false)
    setFinished(false)
  }

  if (cards.length === 0) {
    return (
      <div className="fc-empty">
        <span className="fc-empty-icon">🃏</span>
        <p>No flashcards have been added to this content yet.</p>
      </div>
    )
  }

  // ── End screen ──────────────────────────────────────────────────
  if (finished) {
    const knownCount = deck.filter(c => knownIds.has(c.id)).length
    const unknownCount = deck.length - knownCount
    return (
      <div className="fc-shell">
        <div className="fc-end-screen">
          <span className="fc-end-icon">🎉</span>
          <h2 className="fc-end-title">Deck complete</h2>
          <p className="fc-end-sub">
            {knownCount > 0
              ? `You marked ${knownCount} of ${deck.length} cards as known.`
              : `You went through all ${deck.length} cards.`}
          </p>
          <div className="fc-end-actions">
            <button className="fc-btn fc-btn-primary" onClick={() => restart(false)}>
              Restart with all cards
            </button>
            {unknownCount > 0 && (
              <button className="fc-btn fc-btn-secondary" onClick={() => restart(true)}>
                Practice {unknownCount} unmarked card{unknownCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const card = deck[index]
  const isKnown = card && knownIds.has(card.id)
  const catColour = CATEGORY_COLOURS[card?.category] ?? CATEGORY_COLOURS.other
  const progress = deck.length > 0 ? ((index + 1) / deck.length) * 100 : 0

  // Available priorities in current cards
  const availablePriorities = PRIORITIES.filter(p =>
    p === 'all' || cards.some(c => c.priority === p)
  )

  return (
    <div className="fc-shell">
      {/* Priority filter + controls */}
      <div className="fc-toolbar">
        <div className="fc-priority-pills">
          {availablePriorities.map(p => (
            <button
              key={p}
              className={`fc-priority-pill ${priorityFilter === p ? 'fc-priority-active' : ''}`}
              onClick={() => setPriorityFilter(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
              {p !== 'all' && (
                <span className="fc-pill-count">
                  {cards.filter(c => c.priority === p).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="fc-toolbar-right">
          <label className="fc-toggle-label">
            <input
              type="checkbox"
              checked={shuffled}
              onChange={e => setShuffled(e.target.checked)}
            />
            Shuffle
          </label>
          {knownIds.size > 0 && (
            <button
              className="fc-btn fc-btn-ghost"
              onClick={() => { setKnownIds(new Set()); setHideKnown(false) }}
            >
              Reset known ({knownIds.size})
            </button>
          )}
        </div>
      </div>

      {deck.length === 0 ? (
        <div className="fc-empty">
          <p>No cards match the current filter.</p>
        </div>
      ) : (
        <>
          {/* Card */}
          <div className="fc-scene" onClick={() => setFlipped(f => !f)} ref={cardRef}>
            <div className={`fc-card ${flipped ? 'fc-flipped' : ''} ${isKnown ? 'fc-known' : ''}`}>

              {/* Front */}
              <div className="fc-face fc-face-front">
                <span
                  className="fc-category-badge"
                  style={{ background: catColour + '22', color: catColour, borderColor: catColour + '44' }}
                >
                  {card?.category ?? 'term'}
                </span>
                <p className="fc-term">{card?.term}</p>
                <span className="fc-flip-hint">Click to reveal definition ↺</span>
              </div>

              {/* Back */}
              <div className="fc-face fc-face-back">
                <span
                  className="fc-category-badge"
                  style={{ background: catColour + '22', color: catColour, borderColor: catColour + '44' }}
                >
                  {card?.category ?? 'term'}
                </span>
                <p className="fc-term-small">{card?.term}</p>
                <hr className="fc-divider" />
                <p className="fc-definition">{card?.definition}</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="fc-progress-bar">
            <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Navigation */}
          <div className="fc-nav">
            <button
              className="fc-nav-btn"
              onClick={goPrev}
              disabled={index === 0}
            >
              ← Prev
            </button>

            <div className="fc-nav-centre">
              <span className="fc-counter">{index + 1} / {deck.length}</span>
              <button
                className={`fc-known-btn ${isKnown ? 'fc-known-active' : ''}`}
                onClick={markKnown}
              >
                {isKnown ? '✓ Known' : '✓ Mark as known'}
              </button>
            </div>

            <button
              className="fc-nav-btn"
              onClick={goNext}
            >
              {index === deck.length - 1 ? 'Finish →' : 'Next →'}
            </button>
          </div>

          <p className="fc-keyboard-hint">Space / Arrow keys to navigate</p>
        </>
      )}
    </div>
  )
}
