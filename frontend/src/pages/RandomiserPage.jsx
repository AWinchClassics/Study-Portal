import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

// ── Tree helpers ─────────────────────────────────────────────────
function getAllChunkIds(node) {
  if (node.unit_id)  return [node.id]               // chunk (leaf)
  if (node.chunks)   return node.chunks.map(c => c.id)
  if (node.units)    return node.units.flatMap(u => getAllChunkIds(u))
  if (node.modules)  return node.modules.flatMap(m => getAllChunkIds(m))
  return []
}

function countSelected(node, selected) {
  const ids = getAllChunkIds(node)
  return { selected: ids.filter(id => selected.has(id)).length, total: ids.length }
}

// ── TreeNode ─────────────────────────────────────────────────────
function TreeNode({ node, level, selectedChunks, onToggle }) {
  // Courses (level 0) start expanded so modules are visible.
  // Everything else starts collapsed.
  const [expanded, setExpanded] = useState(level === 0)

  const isLeaf = !!node.unit_id
  const { selected, total } = countSelected(node, selectedChunks)
  const allSelected  = total > 0 && selected === total
  const someSelected = selected > 0 && selected < total

  const checkRef = useRef(null)
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

// ── Result card ──────────────────────────────────────────────────
function ResultCard({ result, onRegenerate }) {
  return (
    <div className="rr-card rr-card-filled">
      <div className="rr-card-topic-section">
        <span className="rr-card-eyebrow">Topic</span>
        <p className="rr-card-topic">{result.content}</p>
      </div>
      <div className="rr-card-divider" />
      <div className="rr-card-activity-section">
        <span className="rr-card-eyebrow">Activity</span>
        <p className="rr-card-activity">{result.instruction}</p>
      </div>
      <button className="rr-card-regen" onClick={onRegenerate}>
        ↻ New task
      </button>
    </div>
  )
}

function PlaceholderCard() {
  return (
    <div className="rr-card rr-card-empty">
      <span className="rr-card-empty-icon">🎲</span>
      <p className="rr-card-empty-text">
        Select topics in the panel and click <strong>Generate</strong> to get your first revision task.
      </p>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function RandomiserPage() {
  const [hierarchy, setHierarchy]         = useState([])
  const [customGroups, setCustomGroups]   = useState([])
  const [funcGroups, setFuncGroups]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [controlsOpen, setControlsOpen]   = useState(false) // mobile drawer

  const [selectedChunks, setSelectedChunks]           = useState(new Set())
  const [selectedCustomCards, setSelectedCustomCards] = useState(new Set())
  const [selectedFuncGroups, setSelectedFuncGroups]   = useState(new Set())

  const [result, setResult]   = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError]     = useState('')
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    async function load() {
      const [
        { data: courses },
        { data: customGroupData },
        { data: customCardData },
        { data: funcGroupData },
        { data: funcCardData },
      ] = await Promise.all([
        supabase.from('courses').select(`
          id, title,
          modules (
            id, title, order_index,
            units (
              id, title, order_index,
              chunks ( id, title, order_index, unit_id )
            )
          )
        `).order('title'),
        supabase.from('randomiser_content_groups').select('id, name, order_index').order('order_index'),
        supabase.from('randomiser_content_cards').select('id, group_id, text').order('order_index'),
        supabase.from('randomiser_function_groups').select('id, name, order_index').order('order_index'),
        supabase.from('randomiser_function_cards').select('id, group_id, text').order('order_index'),
      ])

      if (courses) setHierarchy(courses)

      if (customGroupData) {
        setCustomGroups(customGroupData.map(g => ({
          ...g,
          cards: (customCardData ?? []).filter(c => c.group_id === g.id),
        })))
      }

      if (funcGroupData) {
        const groups = funcGroupData.map(g => ({
          ...g,
          cards: (funcCardData ?? []).filter(c => c.group_id === g.id),
        }))
        setFuncGroups(groups)

        // Default: only General Instructions selected
        const generalGroup = groups.find(g => g.name === 'General Instructions')
        if (generalGroup) setSelectedFuncGroups(new Set([generalGroup.id]))
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleToggleNode = useCallback((node, checked) => {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      const ids = node.unit_id ? [node.id] : getAllChunkIds(node)
      ids.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  function toggleFuncGroup(groupId, checked) {
    setSelectedFuncGroups(prev => {
      const next = new Set(prev)
      checked ? next.add(groupId) : next.delete(groupId)
      return next
    })
  }

  function selectAllChunks() {
    setSelectedChunks(new Set(hierarchy.flatMap(c => getAllChunkIds(c))))
  }

  function clearAll() {
    setSelectedChunks(new Set())
    setSelectedCustomCards(new Set())
  }

  const generate = useCallback(() => {
    setError('')

    // Build content pool
    const contentPool = []
    hierarchy.forEach(course =>
      course.modules?.forEach(mod =>
        mod.units?.forEach(unit =>
          unit.chunks?.forEach(chunk => {
            if (selectedChunks.has(chunk.id)) contentPool.push(chunk.title)
          })
        )
      )
    )
    customGroups.forEach(g =>
      g.cards.forEach(card => {
        if (selectedCustomCards.has(card.id)) contentPool.push(card.text)
      })
    )

    // Build instruction pool
    const instructionPool = []
    funcGroups.forEach(g => {
      if (selectedFuncGroups.has(g.id))
        g.cards.forEach(c => instructionPool.push(c.text))
    })

    if (!contentPool.length) {
      setError('Select at least one topic from the content list.')
      return
    }
    if (!instructionPool.length) {
      setError('Select at least one activity type.')
      return
    }

    const content     = contentPool[Math.floor(Math.random() * contentPool.length)]
    const instruction = instructionPool[Math.floor(Math.random() * instructionPool.length)]
    const newResult   = { content, instruction, id: Date.now() }

    setResult(newResult)
    setAnimKey(k => k + 1)
    setHistory(prev => [newResult, ...prev].slice(0, 5))
    setControlsOpen(false) // close mobile drawer after generating
  }, [hierarchy, customGroups, funcGroups, selectedChunks, selectedCustomCards, selectedFuncGroups])

  const totalSelected = selectedChunks.size + selectedCustomCards.size
  const totalChunks   = hierarchy.flatMap(c => getAllChunkIds(c)).length

  if (loading) {
    return (
      <div className="rr-wrapper">
        <div className="rr-loading">
          <div className="loading-pulse">Loading randomiser…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="rr-wrapper">

      {/* ── Controls panel ── */}
      <>
        {/* Mobile backdrop */}
        {controlsOpen && (
          <div
            className="rr-controls-backdrop"
            onClick={() => setControlsOpen(false)}
          />
        )}

        <div className={`rr-controls ${controlsOpen ? 'rr-controls-open' : ''}`}>

          <div className="rr-controls-heading">
            <span>Revision Randomiser</span>
            <button
              className="rr-controls-close"
              onClick={() => setControlsOpen(false)}
            >✕</button>
          </div>

          {/* Content */}
          <div className="rr-ctrl-section">
            <div className="rr-ctrl-section-header">
              <span className="rr-ctrl-section-title">📚 Content</span>
              <div className="rr-ctrl-section-actions">
                <button className="rr-ctrl-link" onClick={selectAllChunks}>
                  All ({totalChunks})
                </button>
                <span className="rr-ctrl-sep">·</span>
                <button className="rr-ctrl-link" onClick={clearAll}>Clear</button>
              </div>
            </div>

            {totalSelected > 0 && (
              <p className="rr-ctrl-count">{totalSelected} topic{totalSelected !== 1 ? 's' : ''} selected</p>
            )}

            <div className="rr-tree">
              {hierarchy.map(course => (
                <TreeNode
                  key={course.id}
                  node={course}
                  level={0}
                  selectedChunks={selectedChunks}
                  onToggle={handleToggleNode}
                />
              ))}

              {customGroups.filter(g => g.cards.length > 0).map(group => (
                <div key={group.id} className="rr-tree-custom-group">
                  <p className="rr-tree-custom-label">{group.name}</p>
                  {group.cards.map(card => (
                    <label key={card.id} className="rr-tree-leaf">
                      <input
                        type="checkbox"
                        checked={selectedCustomCards.has(card.id)}
                        onChange={e => {
                          setSelectedCustomCards(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(card.id) : next.delete(card.id)
                            return next
                          })
                        }}
                      />
                      <span>{card.text}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Activity types */}
          <div className="rr-ctrl-section">
            <div className="rr-ctrl-section-header">
              <span className="rr-ctrl-section-title">⚡ Activity types</span>
            </div>
            <div className="rr-func-list">
              {funcGroups.map(group => (
                <label key={group.id} className="rr-func-row">
                  <input
                    type="checkbox"
                    checked={selectedFuncGroups.has(group.id)}
                    onChange={e => toggleFuncGroup(group.id, e.target.checked)}
                  />
                  <span className="rr-func-name">{group.name}</span>
                  <span className="rr-func-count">{group.cards.length}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Generate */}
          <div className="rr-ctrl-footer">
            {error && <p className="rr-ctrl-error">{error}</p>}
            <button className="rr-generate-btn" onClick={generate}>
              🎲 Generate task
            </button>
          </div>

        </div>
      </>

      {/* ── Main result area ── */}
      <div className="rr-main">

        {/* Mobile controls toggle */}
        <button
          className="rr-controls-toggle"
          onClick={() => setControlsOpen(true)}
        >
          ⚙ Select topics & activity types
        </button>

        {/* Result / placeholder card */}
        <div key={animKey} className="rr-card-wrapper">
          {result
            ? <ResultCard result={result} onRegenerate={generate} />
            : <PlaceholderCard />
          }
        </div>

        {/* History */}
        {history.length > 1 && (
          <div className="rr-history">
            <p className="rr-history-heading">Recent</p>
            <div className="rr-history-list">
              {history.slice(1).map(r => (
                <div key={r.id} className="rr-history-item">
                  <span className="rr-history-topic">{r.content}</span>
                  <span className="rr-history-arrow">→</span>
                  <span className="rr-history-instruction">{r.instruction}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
