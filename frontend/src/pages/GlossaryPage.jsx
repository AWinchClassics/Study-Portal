import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// ── Fetch helper (same logic as FlashcardTabContent) ─────────────
async function fetchTerms(chunkIds, unitIds, moduleIds) {
  const [{ data: chunkCG }, { data: unitCG }, { data: moduleCG }] = await Promise.all([
    chunkIds.length > 0
      ? supabase.from('chunk_glossary')
          .select('priority, glossary_terms(id, term, definition, category, date)')
          .in('chunk_id', chunkIds)
      : Promise.resolve({ data: [] }),
    unitIds.length > 0
      ? supabase.from('unit_glossary')
          .select('priority, glossary_terms(id, term, definition, category, date)')
          .in('unit_id', unitIds)
      : Promise.resolve({ data: [] }),
    moduleIds.length > 0
      ? supabase.from('module_glossary')
          .select('priority, glossary_terms(id, term, definition, category, date)')
          .in('module_id', moduleIds)
      : Promise.resolve({ data: [] }),
  ])

  const priorityRank = { core: 0, useful: 1, stretch: 2 }
  const byId = {}
  const allRows = [...(moduleCG ?? []), ...(unitCG ?? []), ...(chunkCG ?? [])]
  allRows.forEach(row => {
    const t = row.glossary_terms
    if (!t) return
    const existing = byId[t.id]
    const rank = priorityRank[row.priority] ?? 99
    if (!existing || rank < (priorityRank[existing.priority] ?? 99)) {
      byId[t.id] = { ...t, priority: row.priority }
    }
  })
  return Object.values(byId).sort((a, b) => a.term.localeCompare(b.term))
}

// ── Category colours ─────────────────────────────────────────────
const CATEGORY_COLOURS = {
  person:  '#7c3aed', event:   '#0ea5e9',
  concept: '#16a34a', source:  '#d97706',
  place:   '#db2777', other:   '#6b7280',
  building:            '#c2410c',
  god:                 '#ca8a04',
  'character/setting': '#0891b2',
}

// ── Glossary table view ──────────────────────────────────────────
function GlossaryTableView({ selection }) {
  const [allTerms, setAllTerms]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const key = [
    (selection.chunkIds ?? []).join(','),
    (selection.unitIds  ?? []).join(','),
    (selection.moduleIds ?? []).join(','),
  ].join('|')

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setPriorityFilter('all')
    setCategoryFilter('all')
    fetchTerms(
      selection.chunkIds  ?? [],
      selection.unitIds   ?? [],
      selection.moduleIds ?? [],
    ).then(terms => {
      setAllTerms(terms)
      setLoading(false)
    })
  }, [key])

  // Available filter options for this term set
  const availablePriorities = ['all', 'core', 'useful', 'stretch'].filter(p =>
    p === 'all' || allTerms.some(t => t.priority === p)
  )
  const availableCategories = ['all', ...Object.keys(CATEGORY_COLOURS)].filter(cat =>
    cat === 'all' || allTerms.some(t => t.category === cat)
  )
  const hasAnyDates = allTerms.some(t => t.date)

  // Apply filters
  const filtered = allTerms.filter(term => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      term.term.toLowerCase().includes(q) ||
      term.definition.toLowerCase().includes(q) ||
      (term.date && term.date.toLowerCase().includes(q))
    const matchPriority = priorityFilter === 'all' || term.priority === priorityFilter
    const matchCategory = categoryFilter === 'all' || term.category === categoryFilter
    return matchSearch && matchPriority && matchCategory
  })

  if (loading) return <div className="loading-pulse" style={{ padding: '24px 0' }}>Loading terms…</div>

  if (allTerms.length === 0) return (
    <div className="fc-empty">
      <span className="fc-empty-icon">📖</span>
      <p>No glossary terms have been added to this content yet.</p>
    </div>
  )

  return (
    <div className="gl-table-view">

      {/* Search */}
      <input
        className="gl-table-search"
        placeholder="Search terms or definitions…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Priority filter */}
      {availablePriorities.length > 2 && (
        <div className="fc-priority-pills" style={{ marginBottom: 8 }}>
          {availablePriorities.map(p => (
            <button
              key={p}
              className={`fc-priority-pill ${priorityFilter === p ? 'fc-priority-active' : ''}`}
              onClick={() => setPriorityFilter(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
              {p !== 'all' && (
                <span className="fc-pill-count">
                  {allTerms.filter(t => t.priority === p).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Category filter */}
      {availableCategories.length > 2 && (
        <div className="fc-category-bar" style={{ marginBottom: 12 }}>
          {availableCategories.map(cat => {
            const colour  = CATEGORY_COLOURS[cat]
            const isActive = categoryFilter === cat
            return (
              <button
                key={cat}
                className={`fc-category-pill ${isActive ? 'fc-category-active' : ''}`}
                style={isActive && colour
                  ? { background: colour + '22', color: colour, borderColor: colour + '66' }
                  : {}
                }
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'all' ? 'All types' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                {cat !== 'all' && (
                  <span className="fc-pill-count">
                    {allTerms.filter(t => t.category === cat).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Count */}
      <p className="gl-table-count">
        {filtered.length === allTerms.length
          ? `${allTerms.length} term${allTerms.length !== 1 ? 's' : ''}`
          : `Showing ${filtered.length} of ${allTerms.length} terms`}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="gl-table-empty">No terms match your search.</p>
      ) : (
        <div className="gl-table-scroll">
          <table className="gl-table">
            <thead>
              <tr>
                <th className="gl-th gl-th-term">Term</th>
                {hasAnyDates && <th className="gl-th gl-th-date">Date</th>}
                <th className="gl-th gl-th-definition">Definition</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(term => {
                const colour = CATEGORY_COLOURS[term.category]
                return (
                  <tr key={term.id} className="gl-tr">
                    <td className="gl-td gl-td-term">
                      <div className="gl-term-cell">
                        <span className="gl-term-text">{term.term}</span>
                        <span
                          className="gl-cat-dot"
                          style={{ background: colour }}
                          title={term.category}
                        />
                      </div>
                    </td>
                    {hasAnyDates && (
                      <td className="gl-td gl-td-date">
                        {term.date ?? <span className="gl-empty-cell">—</span>}
                      </td>
                    )}
                    <td className="gl-td gl-td-definition">{term.definition}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Level labels ─────────────────────────────────────────────────
const LEVEL_LABELS = { module: 'Module', unit: 'Unit', chunk: 'Chunk' }
const LEVEL_HINTS  = {
  module: 'Includes terms from this module, its units, and their chunks.',
  unit:   'Includes terms from this unit and its chunks.',
  chunk:  'Includes terms assigned to this chunk only.',
}

// ── Main page ────────────────────────────────────────────────────
export default function GlossaryPage() {
  const [hierarchy, setHierarchy]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [selection, setSelection]       = useState(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState(new Set())
  const [expandedUnits, setExpandedUnits]     = useState(new Set())

  useEffect(() => {
    supabase
      .from('courses')
      .select(`
        id, title,
        modules (
          id, title, order_index,
          units (
            id, title, order_index,
            chunks ( id, title, order_index )
          )
        )
      `)
      .order('title')
      .then(({ data }) => {
        if (data) {
          setHierarchy(data)
          setExpandedModules(new Set(data.flatMap(c => (c.modules ?? []).map(m => m.id))))
        }
        setLoading(false)
      })
  }, [])

  function selectModule(course, mod) {
    const unitIds  = (mod.units ?? []).map(u => u.id)
    const chunkIds = (mod.units ?? []).flatMap(u => (u.chunks ?? []).map(c => c.id))
    setSelection({ level: 'module', id: mod.id, title: mod.title, subtitle: course.title, chunkIds, unitIds, moduleIds: [mod.id] })
    setControlsOpen(false)
  }

  function selectUnit(mod, unit) {
    const chunkIds = (unit.chunks ?? []).map(c => c.id)
    setSelection({ level: 'unit', id: unit.id, title: unit.title, subtitle: mod.title, chunkIds, unitIds: [unit.id], moduleIds: [] })
    setControlsOpen(false)
  }

  function selectChunk(unit, chunk) {
    setSelection({ level: 'chunk', id: chunk.id, title: chunk.title, subtitle: unit.title, chunkIds: [chunk.id], unitIds: [], moduleIds: [] })
    setControlsOpen(false)
  }

  function toggleModule(id) {
    setExpandedModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleUnit(id) {
    setExpandedUnits(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (loading) return (
    <div className="rr-wrapper">
      <div className="rr-loading"><div className="loading-pulse">Loading glossary…</div></div>
    </div>
  )

  return (
    <div className="rr-wrapper">

      {/* ── Nav panel ── */}
      <>
        {controlsOpen && (
          <div className="rr-controls-backdrop" onClick={() => setControlsOpen(false)} />
        )}

        <div className={`rr-controls gl-nav ${controlsOpen ? 'rr-controls-open' : ''}`}>
          <div className="rr-controls-heading">
            <span>Glossary</span>
            <button className="rr-controls-close" onClick={() => setControlsOpen(false)}>✕</button>
          </div>

          <div className="gl-nav-tree">
            {hierarchy.map(course => (
              <div key={course.id} className="gl-course-group">
                {hierarchy.length > 1 && (
                  <p className="gl-course-label">{course.title}</p>
                )}
                {(course.modules ?? []).map(mod => {
                  const modExpanded = expandedModules.has(mod.id)
                  const modSelected = selection?.id === mod.id && selection?.level === 'module'
                  return (
                    <div key={mod.id} className="gl-module-group">
                      <div className={`gl-nav-row gl-nav-module ${modSelected ? 'gl-nav-selected' : ''}`}>
                        <button className="gl-expand-btn" onClick={() => toggleModule(mod.id)}>
                          {modExpanded ? '▾' : '▸'}
                        </button>
                        <button className="gl-nav-label-btn" onClick={() => selectModule(course, mod)}>
                          {mod.title}
                        </button>
                      </div>

                      {modExpanded && (mod.units ?? []).map(unit => {
                        const unitExpanded = expandedUnits.has(unit.id)
                        const unitSelected = selection?.id === unit.id && selection?.level === 'unit'
                        return (
                          <div key={unit.id} className="gl-unit-group">
                            <div className={`gl-nav-row gl-nav-unit ${unitSelected ? 'gl-nav-selected' : ''}`}>
                              <button className="gl-expand-btn" onClick={() => toggleUnit(unit.id)}>
                                {unitExpanded ? '▾' : '▸'}
                              </button>
                              <button className="gl-nav-label-btn" onClick={() => selectUnit(mod, unit)}>
                                {unit.title}
                              </button>
                            </div>

                            {unitExpanded && (unit.chunks ?? []).map(chunk => {
                              const chunkSelected = selection?.id === chunk.id && selection?.level === 'chunk'
                              return (
                                <div key={chunk.id} className="gl-chunk-group">
                                  <div className={`gl-nav-row gl-nav-chunk ${chunkSelected ? 'gl-nav-selected' : ''}`}>
                                    <span className="gl-chunk-dot">·</span>
                                    <button className="gl-nav-label-btn" onClick={() => selectChunk(unit, chunk)}>
                                      {chunk.title}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </>

      {/* ── Main area ── */}
      <div className="rr-main gl-main">
        <button className="rr-controls-toggle" onClick={() => setControlsOpen(true)}>
          📖 Browse glossary
        </button>

        {selection ? (
          <div className="gl-viewer-area">
            <div className="gl-selection-header">
              <span className="gl-level-badge">{LEVEL_LABELS[selection.level]}</span>
              <h2 className="gl-selection-title">{selection.title}</h2>
              <p className="gl-selection-subtitle">{selection.subtitle}</p>
              <p className="gl-level-hint">{LEVEL_HINTS[selection.level]}</p>
            </div>

            <GlossaryTableView key={selection.id} selection={selection} />
          </div>
        ) : (
          <div className="fc-placeholder">
            <span className="fc-placeholder-icon">📖</span>
            <p className="fc-placeholder-text">
              Select a <strong>module</strong>, <strong>unit</strong>, or <strong>chunk</strong> from the panel to browse its glossary terms.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
