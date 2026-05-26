import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

// ── Tree helpers ─────────────────────────────────────────────────
function getAllChunkIds(node) {
  if (node.unit_id)   return [node.id]
  if (node.chunks)    return node.chunks.map(c => c.id)
  if (node.units)     return node.units.flatMap(u => getAllChunkIds(u))
  if (node.modules)   return node.modules.flatMap(m => getAllChunkIds(m))
  return []
}

function countSelected(node, selected) {
  const ids = getAllChunkIds(node)
  return { selected: ids.filter(id => selected.has(id)).length, total: ids.length }
}

// ── CustomGroupNode — collapsible card group inside the tree ─────
function CustomGroupNode({ group, selectedCustomCards, onToggleCard, onToggleGroup }) {
  const [expanded, setExpanded] = useState(false)
  const checkRef = useRef(null)

  const selectedCount = group.cards.filter(c => selectedCustomCards.has(c.id)).length
  const total         = group.cards.length
  const allSelected   = total > 0 && selectedCount === total
  const someSelected  = selectedCount > 0 && selectedCount < total

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = someSelected
  }, [someSelected])

  if (total === 0) return null

  return (
    <div className="rr-tree-node rr-tree-custom-node">
      <div className="rr-tree-row" onClick={() => setExpanded(e => !e)}>
        <input
          ref={checkRef}
          type="checkbox"
          checked={allSelected}
          onChange={e => { e.stopPropagation(); onToggleGroup(group, !allSelected) }}
          onClick={e => e.stopPropagation()}
        />
        <span className="rr-tree-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="rr-tree-label">{group.name}</span>
        <span className="rr-tree-count">{selectedCount}/{total}</span>
        <span className="rr-tree-custom-badge">custom</span>
      </div>
      {expanded && (
        <div className="rr-tree-children">
          {group.cards.map(card => (
            <label key={card.id} className="rr-tree-leaf">
              <input
                type="checkbox"
                checked={selectedCustomCards.has(card.id)}
                onChange={e => onToggleCard(card.id, e.target.checked)}
              />
              <span>{card.text}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TreeNode ─────────────────────────────────────────────────────
function TreeNode({ node, level, selectedChunks, onToggle, customData }) {
  const [expanded, setExpanded] = useState(level === 0)
  const checkRef = useRef(null)

  const isLeaf = !!node.unit_id
  const { selected, total } = countSelected(node, selectedChunks)
  const allSelected  = total > 0 && selected === total
  const someSelected = selected > 0 && selected < total

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = someSelected
  }, [someSelected])

  const { groupsByCourseId = {}, groupsByModuleId = {}, groupsByUnitId = {},
          selectedCustomCards, onToggleCard, onToggleGroup } = customData ?? {}

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

  // Attach custom groups at the right level:
  // course nodes have .modules, module nodes have .units, unit nodes have .chunks
  const attachedGroups =
    node.modules ? (groupsByCourseId[node.id] ?? [])
    : node.units  ? (groupsByModuleId[node.id] ?? [])
    : node.chunks ? (groupsByUnitId[node.id]   ?? [])
    : []

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
              customData={customData}
            />
          ))}

          {/* Custom groups attached to this module or unit */}
          {attachedGroups.map(group => (
            <CustomGroupNode
              key={group.id}
              group={group}
              selectedCustomCards={selectedCustomCards}
              onToggleCard={onToggleCard}
              onToggleGroup={onToggleGroup}
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
  const [funcGroups, setFuncGroups]       = useState([])
  const [groupsByModuleId, setGroupsByModuleId] = useState({})
  const [groupsByUnitId, setGroupsByUnitId]     = useState({})
  const [groupsByCourseId, setGroupsByCourseId] = useState({})
  const [standaloneGroups, setStandaloneGroups] = useState([])
  const [loading, setLoading]             = useState(true)
  const [controlsOpen, setControlsOpen]   = useState(false)

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
        supabase.from('randomiser_content_groups')
          .select('id, name, order_index, module_id, unit_id')
          .order('order_index'),
        supabase.from('randomiser_content_cards')
          .select('id, group_id, text, order_index')
          .order('order_index'),
        supabase.from('randomiser_function_groups')
          .select('id, name, order_index').order('order_index'),
        supabase.from('randomiser_function_cards')
          .select('id, group_id, text').order('order_index'),
      ])

      if (courses) setHierarchy(courses)

      // Build custom group maps
      if (customGroupData) {
        const allGroups = customGroupData.map(g => ({
          ...g,
          cards: (customCardData ?? []).filter(c => c.group_id === g.id),
        }))

        const byModule = {}
        const byUnit   = {}
        const byCourse = {}
        const standalone = []

        allGroups.forEach(g => {
          if (g.course_id) {
            if (!byCourse[g.course_id]) byCourse[g.course_id] = []
            byCourse[g.course_id].push(g)
          } else if (g.module_id) {
            if (!byModule[g.module_id]) byModule[g.module_id] = []
            byModule[g.module_id].push(g)
          } else if (g.unit_id) {
            if (!byUnit[g.unit_id]) byUnit[g.unit_id] = []
            byUnit[g.unit_id].push(g)
          } else {
            standalone.push(g)
          }
        })

        setGroupsByModuleId(byModule)
        setGroupsByUnitId(byUnit)
        setGroupsByCourseId(byCourse)
        setStandaloneGroups(standalone)
      }

      if (funcGroupData) {
        const groups = funcGroupData.map(g => ({
          ...g,
          cards: (funcCardData ?? []).filter(c => c.group_id === g.id),
        }))
        setFuncGroups(groups)
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
      const ids  = node.unit_id ? [node.id] : getAllChunkIds(node)
      ids.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }, [])

  const onToggleCard = useCallback((cardId, checked) => {
    setSelectedCustomCards(prev => {
      const next = new Set(prev)
      checked ? next.add(cardId) : next.delete(cardId)
      return next
    })
  }, [])

  const onToggleGroup = useCallback((group, checked) => {
    setSelectedCustomCards(prev => {
      const next = new Set(prev)
      group.cards.forEach(c => checked ? next.add(c.id) : next.delete(c.id))
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

    const contentPool = []

    // Chunks from hierarchy
    hierarchy.forEach(course =>
      course.modules?.forEach(mod =>
        mod.units?.forEach(unit =>
          unit.chunks?.forEach(chunk => {
            if (selectedChunks.has(chunk.id)) contentPool.push(chunk.title)
          })
        )
      )
    )

    // Selected custom cards
    const allCustomCards = [
      ...Object.values(groupsByCourseId).flat(),
      ...Object.values(groupsByModuleId).flat(),
      ...Object.values(groupsByUnitId).flat(),
      ...standaloneGroups,
    ].flatMap(g => g.cards)

    allCustomCards.forEach(card => {
      if (selectedCustomCards.has(card.id)) contentPool.push(card.text)
    })

    const instructionPool = funcGroups
      .filter(g => selectedFuncGroups.has(g.id))
      .flatMap(g => g.cards.map(c => c.text))

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
    setControlsOpen(false)
  }, [hierarchy, groupsByModuleId, groupsByUnitId, standaloneGroups,
      funcGroups, selectedChunks, selectedCustomCards, selectedFuncGroups])

  const totalSelected  = selectedChunks.size + selectedCustomCards.size
  const totalChunks    = hierarchy.flatMap(c => getAllChunkIds(c)).length

  const customData = {
    groupsByCourseId,
    groupsByModuleId,
    groupsByUnitId,
    selectedCustomCards,
    onToggleCard,
    onToggleGroup,
  }

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
        {controlsOpen && (
          <div className="rr-controls-backdrop" onClick={() => setControlsOpen(false)} />
        )}

        <div className={`rr-controls ${controlsOpen ? 'rr-controls-open' : ''}`}>
          <div className="rr-controls-heading">
            <span>Revision Randomiser</span>
            <button className="rr-controls-close" onClick={() => setControlsOpen(false)}>✕</button>
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
              <p className="rr-ctrl-count">
                {totalSelected} topic{totalSelected !== 1 ? 's' : ''} selected
              </p>
            )}

            <div className="rr-tree">
              {hierarchy.map(course => (
                <TreeNode
                  key={course.id}
                  node={course}
                  level={0}
                  selectedChunks={selectedChunks}
                  onToggle={handleToggleNode}
                  customData={customData}
                />
              ))}

              {/* Standalone custom groups (no module/unit attachment) */}
              {standaloneGroups.filter(g => g.cards.length > 0).map(group => (
                <CustomGroupNode
                  key={group.id}
                  group={group}
                  selectedCustomCards={selectedCustomCards}
                  onToggleCard={onToggleCard}
                  onToggleGroup={onToggleGroup}
                />
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
        <button className="rr-controls-toggle" onClick={() => setControlsOpen(true)}>
          ⚙ Select topics & activity types
        </button>

        <div key={animKey} className="rr-card-wrapper">
          {result
            ? <ResultCard result={result} onRegenerate={generate} />
            : <PlaceholderCard />
          }
        </div>

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
