import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import FlashcardTabContent from '../components/FlashcardTabContent'

// ── Level badges ─────────────────────────────────────────────────
const LEVEL_LABELS = { module: 'Module', unit: 'Unit', chunk: 'Chunk' }

const LEVEL_HINTS = {
  module: 'Showing terms assigned to this module, its units, and their chunks.',
  unit:   'Showing terms assigned to this unit and its chunks.',
  chunk:  'Showing terms assigned to this chunk only.',
}

export default function GlossaryPage() {
  const [hierarchy, setHierarchy]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [selection, setSelection]         = useState(null)
  const [controlsOpen, setControlsOpen]   = useState(false)

  // Which modules / units are expanded in the nav
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
          // Modules start expanded so units are visible immediately
          setExpandedModules(new Set(data.flatMap(c => (c.modules ?? []).map(m => m.id))))
        }
        setLoading(false)
      })
  }, [])

  // ── Selection handlers ──────────────────────────────────────────

  function selectModule(course, mod) {
    const unitIds  = (mod.units ?? []).map(u => u.id)
    const chunkIds = (mod.units ?? []).flatMap(u => (u.chunks ?? []).map(c => c.id))
    setSelection({
      level: 'module', id: mod.id,
      title: mod.title, subtitle: course.title,
      chunkIds, unitIds, moduleIds: [mod.id],
    })
    setControlsOpen(false)
  }

  function selectUnit(mod, unit) {
    const chunkIds = (unit.chunks ?? []).map(c => c.id)
    setSelection({
      level: 'unit', id: unit.id,
      title: unit.title, subtitle: mod.title,
      chunkIds, unitIds: [unit.id], moduleIds: [],
    })
    setControlsOpen(false)
  }

  function selectChunk(unit, chunk) {
    setSelection({
      level: 'chunk', id: chunk.id,
      title: chunk.title, subtitle: unit.title,
      chunkIds: [chunk.id], unitIds: [], moduleIds: [],
    })
    setControlsOpen(false)
  }

  function toggleModule(id) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleUnit(id) {
    setExpandedUnits(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
                      {/* Module row */}
                      <div className={`gl-nav-row gl-nav-module ${modSelected ? 'gl-nav-selected' : ''}`}>
                        <button
                          className="gl-expand-btn"
                          onClick={() => toggleModule(mod.id)}
                          aria-label={modExpanded ? 'Collapse' : 'Expand'}
                        >
                          {modExpanded ? '▾' : '▸'}
                        </button>
                        <button
                          className="gl-nav-label-btn"
                          onClick={() => selectModule(course, mod)}
                        >
                          {mod.title}
                        </button>
                      </div>

                      {/* Units */}
                      {modExpanded && (mod.units ?? []).map(unit => {
                        const unitExpanded = expandedUnits.has(unit.id)
                        const unitSelected = selection?.id === unit.id && selection?.level === 'unit'

                        return (
                          <div key={unit.id} className="gl-unit-group">
                            {/* Unit row */}
                            <div className={`gl-nav-row gl-nav-unit ${unitSelected ? 'gl-nav-selected' : ''}`}>
                              <button
                                className="gl-expand-btn"
                                onClick={() => toggleUnit(unit.id)}
                                aria-label={unitExpanded ? 'Collapse' : 'Expand'}
                              >
                                {unitExpanded ? '▾' : '▸'}
                              </button>
                              <button
                                className="gl-nav-label-btn"
                                onClick={() => selectUnit(mod, unit)}
                              >
                                {unit.title}
                              </button>
                            </div>

                            {/* Chunks */}
                            {unitExpanded && (unit.chunks ?? []).map(chunk => {
                              const chunkSelected = selection?.id === chunk.id && selection?.level === 'chunk'
                              return (
                                <div key={chunk.id} className="gl-chunk-group">
                                  <div className={`gl-nav-row gl-nav-chunk ${chunkSelected ? 'gl-nav-selected' : ''}`}>
                                    <span className="gl-chunk-dot">·</span>
                                    <button
                                      className="gl-nav-label-btn"
                                      onClick={() => selectChunk(unit, chunk)}
                                    >
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
      <div className="rr-main">
        {/* Mobile toggle */}
        <button className="rr-controls-toggle" onClick={() => setControlsOpen(true)}>
          📖 Browse glossary
        </button>

        {selection ? (
          <div className="gl-viewer-area">
            {/* Selection header */}
            <div className="gl-selection-header">
              <span className="gl-level-badge">{LEVEL_LABELS[selection.level]}</span>
              <h2 className="gl-selection-title">{selection.title}</h2>
              <p className="gl-selection-subtitle">{selection.subtitle}</p>
              <p className="gl-level-hint">{LEVEL_HINTS[selection.level]}</p>
            </div>

            {/* Flashcard viewer — remounts when selection changes */}
            <FlashcardTabContent
              key={selection.id}
              chunkIds={selection.chunkIds}
              unitIds={selection.unitIds}
              moduleIds={selection.moduleIds}
            />
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
