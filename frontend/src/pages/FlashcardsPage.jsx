import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import FlashcardViewer from '../components/FlashcardViewer'

// ── Tree helpers ─────────────────────────────────────────────────
function getAllChunkIds(node) {
  if (node.unit_id)  return [node.id]
  if (node.chunks)   return node.chunks.map(c => c.id)
  if (node.units)    return node.units.flatMap(u => getAllChunkIds(u))
  if (node.modules)  return node.modules.flatMap(m => getAllChunkIds(m))
  return []
}

function countSelected(node, selectedChunks) {
  const ids = getAllChunkIds(node)
  return { selected: ids.filter(id => selectedChunks.has(id)).length, total: ids.length }
}

// ── TreeNode ─────────────────────────────────────────────────────
function TreeNode({ node, level, selectedChunks, onToggle }) {
  const [expanded, setExpanded] = useState(level === 0)
  const checkRef = useRef(null)

  const isLeaf = !!node.unit_id
  const { selected, total } = countSelected(node, selectedChunks)
  const allSelected  = total > 0 && selected === total
  const someSelected = selected > 0 && selected < total

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = someSelected
  }, [someSelected])

  if (isLeaf) {
    return (
      <label className="rr-tree-leaf">
        <input
          type="checkbox"
          checked={selectedChunks.has(node.id)}
          onChange={e => onToggle(node, e.target.checked)}
        />
        <span>{node.title}</span>
      </label>
    )
  }

  const children = node.modules ?? node.units ?? node.chunks ?? []

  return (
    <div className="rr-tree-node">
      <div className="rr-tree-row" onClick={() => setExpanded(e => !e)}>
        <input
          ref={checkRef}
          type="checkbox"
          checked={allSelected}
          onChange={e => { e.stopPropagation(); onToggle(node, !allSelected) }}
          onClick={e => e.stopPropagation()}
        />
        <span className="rr-tree-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="rr-tree-label">{node.title ?? node.name}</span>
        <span className="rr-tree-count">{selected}/{total}</span>
      </div>
      {expanded && (
        <div className="rr-tree-children">
          {children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedChunks={selectedChunks}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const [hierarchy, setHierarchy]       = useState([])
  const [selectedChunks, setSelectedChunks] = useState(new Set())
  const [cards, setCards]               = useState(null) // null = not yet loaded
  const [loadingCards, setLoadingCards] = useState(false)
  const [loadingHierarchy, setLoadingHierarchy] = useState(true)
  const [controlsOpen, setControlsOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('courses')
      .select(`
        id, title,
        modules (
          id, title, order_index,
          units (
            id, title, order_index,
            chunks ( id, title, order_index, unit_id )
          )
        )
      `)
      .order('title')
      .then(({ data }) => {
        if (data) setHierarchy(data)
        setLoadingHierarchy(false)
      })
  }, [])

  const handleToggle = useCallback((node, checked) => {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      const ids = node.unit_id ? [node.id] : getAllChunkIds(node)
      ids.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  function selectAll() {
    setSelectedChunks(new Set(hierarchy.flatMap(c => getAllChunkIds(c))))
  }

  function clearAll() {
    setSelectedChunks(new Set())
    setCards(null)
  }

  async function loadDeck() {
    if (selectedChunks.size === 0) return
    setLoadingCards(true)
    setControlsOpen(false)

    const { data, error } = await supabase
      .from('chunk_glossary')
      .select('priority, glossary_terms(id, term, definition, category)')
      .in('chunk_id', [...selectedChunks])

    if (!error && data) {
      const priorityRank = { core: 0, useful: 1, stretch: 2 }
      const byId = {}
      data.forEach(row => {
        const t = row.glossary_terms
        if (!t) return
        const existing = byId[t.id]
        const rank = priorityRank[row.priority] ?? 99
        if (!existing || rank < (priorityRank[existing.priority] ?? 99)) {
          byId[t.id] = { ...t, priority: row.priority }
        }
      })
      setCards(Object.values(byId))
    }

    setLoadingCards(false)
  }

  const totalChunks = hierarchy.flatMap(c => getAllChunkIds(c)).length

  if (loadingHierarchy) {
    return <div className="rr-wrapper"><div className="rr-loading"><div className="loading-pulse">Loading…</div></div></div>
  }

  return (
    <div className="rr-wrapper">

      {/* ── Controls panel ── */}
      <>
        {controlsOpen && (
          <div className="rr-controls-backdrop" onClick={() => setControlsOpen(false)} />
        )}

        <div className={`rr-controls ${controlsOpen ? 'rr-controls-open' : ''}`}>
          <div className="rr-controls-heading">
            <span>Flashcard Deck</span>
            <button className="rr-controls-close" onClick={() => setControlsOpen(false)}>✕</button>
          </div>

          <div className="rr-ctrl-section">
            <div className="rr-ctrl-section-header">
              <span className="rr-ctrl-section-title">📚 Select topics</span>
              <div className="rr-ctrl-section-actions">
                <button className="rr-ctrl-link" onClick={selectAll}>All ({totalChunks})</button>
                <span className="rr-ctrl-sep">·</span>
                <button className="rr-ctrl-link" onClick={clearAll}>Clear</button>
              </div>
            </div>

            {selectedChunks.size > 0 && (
              <p className="rr-ctrl-count">{selectedChunks.size} topic{selectedChunks.size !== 1 ? 's' : ''} selected</p>
            )}

            <div className="rr-tree">
              {hierarchy.map(course => (
                <TreeNode
                  key={course.id}
                  node={course}
                  level={0}
                  selectedChunks={selectedChunks}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>

          <div className="rr-ctrl-footer">
            <button
              className="rr-generate-btn"
              onClick={loadDeck}
              disabled={selectedChunks.size === 0}
            >
              🃏 Load flashcards
            </button>
          </div>
        </div>
      </>

      {/* ── Main area ── */}
      <div className="rr-main">
        <button className="rr-controls-toggle" onClick={() => setControlsOpen(true)}>
          ⚙ Select topics
        </button>

        {loadingCards ? (
          <div className="fc-empty">
            <div className="loading-pulse">Loading flashcards…</div>
          </div>
        ) : cards === null ? (
          <div className="fc-placeholder">
            <span className="fc-placeholder-icon">🃏</span>
            <p className="fc-placeholder-text">
              Select topics from the panel and click <strong>Load flashcards</strong> to build your deck.
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 640 }}>
            <FlashcardViewer cards={cards} />
          </div>
        )}
      </div>
    </div>
  )
}
