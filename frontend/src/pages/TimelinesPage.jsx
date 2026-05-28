import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import TimelineTabContent from '../components/TimelineTabContent'

export default function TimelinesPage() {
  const [hierarchy, setHierarchy]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [selection, setSelection]       = useState(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState(new Set())
  const [expandedUnits, setExpandedUnits]     = useState(new Set())

  useEffect(() => {
    supabase.from('courses').select(`id, title, modules ( id, title, order_index, units ( id, title, order_index, chunks ( id, title, order_index ) ) )`).order('title').then(({ data }) => {
      if (data) { setHierarchy(data); setExpandedModules(new Set(data.flatMap(c => (c.modules ?? []).map(m => m.id)))) }
      setLoading(false)
    })
  }, [])

  function sel(id, level, title, subtitle, chunkIds, unitIds, moduleIds) {
    setSelection({ id, level, title, subtitle, chunkIds, unitIds, moduleIds })
    setControlsOpen(false)
  }

  function toggle(set, setFn, id) {
    setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const LEVEL_LABELS = { module: 'Module', unit: 'Unit', chunk: 'Chunk' }

  if (loading) return <div className="rr-wrapper"><div className="rr-loading"><div className="loading-pulse">Loading…</div></div></div>

  return (
    <div className="rr-wrapper">
      <>
        {controlsOpen && <div className="rr-controls-backdrop" onClick={() => setControlsOpen(false)} />}
        <div className={`rr-controls gl-nav ${controlsOpen ? 'rr-controls-open' : ''}`}>
          <div className="rr-controls-heading">
            <span>Timelines</span>
            <button className="rr-controls-close" onClick={() => setControlsOpen(false)}>✕</button>
          </div>
          <div className="gl-nav-tree">
            {hierarchy.map(course => (
              <div key={course.id} className="gl-course-group">
                {hierarchy.length > 1 && <p className="gl-course-label">{course.title}</p>}
                {(course.modules ?? []).map(mod => (
                  <div key={mod.id} className="gl-module-group">
                    <div className={`gl-nav-row gl-nav-module ${selection?.id === mod.id && selection?.level === 'module' ? 'gl-nav-selected' : ''}`}>
                      <button className="gl-expand-btn" onClick={() => toggle(expandedModules, setExpandedModules, mod.id)}>{expandedModules.has(mod.id) ? '▾' : '▸'}</button>
                      <button className="gl-nav-label-btn" onClick={() => sel(mod.id, 'module', mod.title, course.title, (mod.units ?? []).flatMap(u => (u.chunks ?? []).map(c => c.id)), (mod.units ?? []).map(u => u.id), [mod.id])}>{mod.title}</button>
                    </div>
                    {expandedModules.has(mod.id) && (mod.units ?? []).map(unit => (
                      <div key={unit.id} className="gl-unit-group">
                        <div className={`gl-nav-row gl-nav-unit ${selection?.id === unit.id && selection?.level === 'unit' ? 'gl-nav-selected' : ''}`}>
                          <button className="gl-expand-btn" onClick={() => toggle(expandedUnits, setExpandedUnits, unit.id)}>{expandedUnits.has(unit.id) ? '▾' : '▸'}</button>
                          <button className="gl-nav-label-btn" onClick={() => sel(unit.id, 'unit', unit.title, mod.title, (unit.chunks ?? []).map(c => c.id), [unit.id], [])}>{unit.title}</button>
                        </div>
                        {expandedUnits.has(unit.id) && (unit.chunks ?? []).map(chunk => (
                          <div key={chunk.id} className="gl-chunk-group">
                            <div className={`gl-nav-row gl-nav-chunk ${selection?.id === chunk.id && selection?.level === 'chunk' ? 'gl-nav-selected' : ''}`}>
                              <span className="gl-chunk-dot">·</span>
                              <button className="gl-nav-label-btn" onClick={() => sel(chunk.id, 'chunk', chunk.title, unit.title, [chunk.id], [], [])}>{chunk.title}</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </>
      <div className="rr-main gl-main">
        <button className="rr-controls-toggle" onClick={() => setControlsOpen(true)}>📅 Select content</button>
        {selection ? (
          <div className="gl-viewer-area" style={{ maxWidth: 780 }}>
            <div className="gl-selection-header">
              <span className="gl-level-badge">{LEVEL_LABELS[selection.level]}</span>
              <h2 className="gl-selection-title">{selection.title}</h2>
              <p className="gl-selection-subtitle">{selection.subtitle}</p>
            </div>
            <TimelineTabContent key={selection.id} chunkIds={selection.chunkIds} unitIds={selection.unitIds} moduleIds={selection.moduleIds} />
          </div>
        ) : (
          <div className="fc-placeholder">
            <span className="fc-placeholder-icon">📅</span>
            <p className="fc-placeholder-text">Select a <strong>module</strong>, <strong>unit</strong>, or <strong>chunk</strong> from the panel to view its timeline.</p>
          </div>
        )}
      </div>
    </div>
  )
}
