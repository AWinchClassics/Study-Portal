import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

// ── Tree helpers ────────────────────────────────────────────────
function getAllChunkIds(node) {
  if (node.chunks) return node.chunks.map(c => c.id)
  if (node.units)  return node.units.flatMap(u => getAllChunkIds(u))
  if (node.modules) return node.modules.flatMap(m => getAllChunkIds(m))
  return []
}

function countSelected(node, selected) {
  const ids = getAllChunkIds(node)
  const n = ids.filter(id => selected.has(id)).length
  return { selected: n, total: ids.length }
}

// ── TreeNode ────────────────────────────────────────────────────
function TreeNode({ node, level, selectedChunks, onToggle }) {
  const [expanded, setExpanded] = useState(level < 2)

  const isLeaf = !!node.unit_id  // chunk
  const { selected, total } = countSelected(node, selectedChunks)
  const allSelected  = total > 0 && selected === total
  const someSelected = selected > 0 && selected < total

  function handleCheck(e) {
    e.stopPropagation()
    onToggle(node, !allSelected)
  }

  if (isLeaf) {
    return (
      <label className="tree-leaf">
        <input
          type="checkbox"
          checked={selectedChunks.has(node.id)}
          onChange={e => onToggle(node, e.target.checked)}
        />
        <span className="tree-leaf-text">{node.title}</span>
      </label>
    )
  }

  const children = node.modules ?? node.units ?? node.chunks ?? []
  const childLevel = level + 1
  const childKey = node.modules ? 'modules' : node.units ? 'units' : 'chunks'

  return (
    <div className="tree-node">
      <div
        className="tree-node-row"
        onClick={() => setExpanded(e => !e)}
      >
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected }}
          onChange={handleCheck}
          onClick={e => e.stopPropagation()}
        />
        <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="tree-node-label">{node.title ?? node.name}</span>
        <span className="tree-node-count">{selected}/{total}</span>
      </div>

      {expanded && (
        <div className="tree-children">
          {children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={childLevel}
              selectedChunks={selectedChunks}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ResultCard ─────────────────────────────────────────────────
function ResultCard({ result, isLatest }) {
  return (
    <div className={`rr-result-card ${isLatest ? 'rr-result-latest' : 'rr-result-history'}`}>
      <p className="rr-result-content">{result.content}</p>
      <p className="rr-result-instruction">{result.instruction}</p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function RandomiserPage() {
  const [hierarchy, setHierarchy]       = useState([])
  const [customGroups, setCustomGroups] = useState([])
  const [funcGroups, setFuncGroups]     = useState([])
  const [loading, setLoading]           = useState(true)

  // Selection state
  const [selectedChunks, setSelectedChunks]       = useState(new Set())
  const [selectedCustomCards, setSelectedCustomCards] = useState(new Set())
  const [selectedFuncGroups, setSelectedFuncGroups]   = useState(new Set())

  // Results
  const [result, setResult]   = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError]     = useState('')

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
        supabase.from('randomiser_content_cards').select('id, group_id, text, order_index').order('order_index'),
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
        // Select all function groups by default
        setSelectedFuncGroups(new Set(groups.map(g => g.id)))
      }

      setLoading(false)
    }
    load()
  }, [])

  // Toggle a node (course/module/unit/chunk) on or off
  const handleToggleNode = useCallback((node, checked) => {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      const ids = node.unit_id ? [node.id] : getAllChunkIds(node)
      ids.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  function toggleCustomCard(cardId, checked) {
    setSelectedCustomCards(prev => {
      const next = new Set(prev)
      checked ? next.add(cardId) : next.delete(cardId)
      return next
    })
  }

  function toggleFuncGroup(groupId, checked) {
    setSelectedFuncGroups(prev => {
      const next = new Set(prev)
      checked ? next.add(groupId) : next.delete(groupId)
      return next
    })
  }

  function selectAllChunks() {
    const all = hierarchy.flatMap(c => getAllChunkIds(c))
    setSelectedChunks(new Set(all))
  }

  function clearAllChunks() {
    setSelectedChunks(new Set())
    setSelectedCustomCards(new Set())
  }

  function generate() {
    setError('')

    // Build content pool
    const contentPool = []
    hierarchy.forEach(course => {
      course.modules?.forEach(mod => {
        mod.units?.forEach(unit => {
          unit.chunks?.forEach(chunk => {
            if (selectedChunks.has(chunk.id)) contentPool.push(chunk.title)
          })
        })
      })
    })
    customGroups.forEach(g => {
      g.cards.forEach(card => {
        if (selectedCustomCards.has(card.id)) contentPool.push(card.text)
      })
    })

    // Build instruction pool
    const instructionPool = []
    funcGroups.forEach(g => {
      if (selectedFuncGroups.has(g.id)) {
        g.cards.forEach(c => instructionPool.push(c.text))
      }
    })

    if (!contentPool.length) { setError('Select at least one topic from the content panel.'); return }
    if (!instructionPool.length) { setError('Select at least one instruction category.'); return }

    const content     = contentPool[Math.floor(Math.random() * contentPool.length)]
    const instruction = instructionPool[Math.floor(Math.random() * instructionPool.length)]
    const newResult   = { content, instruction, id: Date.now() }

    setResult(newResult)
    setHistory(prev => [newResult, ...prev].slice(0, 4))
  }

  const totalSelected   = selectedChunks.size + selectedCustomCards.size
  const totalChunks     = hierarchy.flatMap(c => getAllChunkIds(c)).length

  if (loading) return <div className="page"><div className="loading-pulse">Loading randomiser…</div></div>

  return (
    <div className="page rr-page">
      <div className="page-header">
        <div>
          <h1>Revision Randomiser</h1>
          <p className="page-subtitle">Select topics and activity types, then generate a random revision task.</p>
        </div>
      </div>

      <div className="rr-layout">

        {/* ── Left panel: content selection ── */}
        <div className="rr-panel rr-panel-content">
          <div className="rr-panel-header">
            <span className="rr-panel-title">📚 Content</span>
            <span className="rr-selected-count">{totalSelected} selected</span>
          </div>

          <div className="rr-panel-actions">
            <button className="t-btn t-btn-secondary" onClick={selectAllChunks}>
              Select all ({totalChunks})
            </button>
            <button className="t-btn t-btn-ghost" onClick={clearAllChunks}>
              Clear
            </button>
          </div>

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
          </div>

          {/* Custom content cards */}
          {customGroups.length > 0 && (
            <div className="rr-custom-section">
              <p className="rr-section-label">Custom cards</p>
              {customGroups.map(group => (
                <div key={group.id} className="rr-custom-group">
                  <p className="rr-custom-group-name">{group.name}</p>
                  {group.cards.map(card => (
                    <label key={card.id} className="tree-leaf">
                      <input
                        type="checkbox"
                        checked={selectedCustomCards.has(card.id)}
                        onChange={e => toggleCustomCard(card.id, e.target.checked)}
                      />
                      <span className="tree-leaf-text">{card.text}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: instruction types + generate ── */}
        <div className="rr-panel rr-panel-right">

          <div className="rr-panel-header">
            <span className="rr-panel-title">⚡ Activity types</span>
          </div>

          <div className="rr-func-groups">
            {funcGroups.map(group => (
              <label key={group.id} className="rr-func-group-label">
                <input
                  type="checkbox"
                  checked={selectedFuncGroups.has(group.id)}
                  onChange={e => toggleFuncGroup(group.id, e.target.checked)}
                />
                <span className="rr-func-group-name">{group.name}</span>
                <span className="rr-func-group-count">{group.cards.length}</span>
              </label>
            ))}
          </div>

          <button className="rr-generate-btn" onClick={generate}>
            🎲 Generate task
          </button>

          {error && <p className="rr-error">{error}</p>}

          {/* Latest result */}
          {result && (
            <div className="rr-results">
              <ResultCard result={result} isLatest />

              {history.length > 1 && (
                <>
                  <p className="rr-history-label">Previous</p>
                  {history.slice(1).map(r => (
                    <ResultCard key={r.id} result={r} isLatest={false} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
