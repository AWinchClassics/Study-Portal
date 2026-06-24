import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { getMasteryClass } from '../hooks/useMastery'
import '../progress.css'

// ── Helpers ──────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.best == null && b.best == null) return 0
    if (a.best == null) return -1
    if (b.best == null) return 1
    return a.best - b.best
  })
}

// ── Shared sub-components ─────────────────────────────────────────

function StatCard({ icon, value, label }) {
  return (
    <div className="pd-stat-card">
      <span className="pd-stat-icon">{icon}</span>
      <span className="pd-stat-value">{value ?? '—'}</span>
      <span className="pd-stat-label">{label}</span>
    </div>
  )
}

function DistributionChart({ allBests, total }) {
  const bands = [
    { label: '80–100%', cls: 'high', count: allBests.filter(p => p >= 80).length },
    { label: '50–79%',  cls: 'mid',  count: allBests.filter(p => p >= 50 && p < 80).length },
    { label: '0–49%',   cls: 'low',  count: allBests.filter(p => p < 50).length },
    { label: 'Not yet', cls: 'none', count: total - allBests.length },
  ]
  return (
    <div className="pd-distribution">
      <h2 className="pd-section-title">Score distribution</h2>
      <div className="pd-dist-bars">
        {bands.map(band => (
          <div key={band.label} className="pd-dist-band">
            <div className="pd-dist-bar-wrap">
              <div
                className={`pd-dist-bar pd-dist-bar-${band.cls}`}
                style={{ height: `${total > 0 ? Math.round((band.count / total) * 100) : 0}%` }}
              />
            </div>
            <span className={`pd-dist-count pd-dist-count-${band.cls}`}>{band.count}</span>
            <span className="pd-dist-label">{band.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Stats summary used in both module and unit headers
function SectionStats({ rows, isUnit }) {
  const attempted = rows.filter(r => r.best != null)
  const avgScore  = avg(attempted.map(r => r.best))
  const cls       = getMasteryClass(avgScore)
  return (
    <span className={`pd-module-counts ${isUnit ? 'pd-unit-counts' : ''}`}>
      {attempted.length}/{rows.length} attempted
      {avgScore != null && (
        <span className={`pd-module-avg mastery-${cls}`}>{avgScore}% avg</span>
      )}
    </span>
  )
}

// Collapsible unit sub-section (nested inside module)
function UnitSection({ unit, rows, renderRow }) {
  const [open, setOpen] = useState(true)
  if (!rows.length) return null
  return (
    <div className="pd-unit-section">
      <button className="pd-unit-header" onClick={() => setOpen(o => !o)}>
        <span className="pd-unit-chevron">{open ? '▾' : '▸'}</span>
        <span className="pd-unit-title">{unit.title}</span>
        <SectionStats rows={rows} isUnit />
      </button>
      {open && (
        <div className="pd-unit-rows">
          {rows.map(row => renderRow(row))}
        </div>
      )}
    </div>
  )
}

// Collapsible module section — contains UnitSections
function ModuleSection({ module, unitOrder, rowsByUnit, renderRow }) {
  const [open, setOpen] = useState(true)

  // Flatten all rows across all units for module-level stats
  const allRows = Object.values(rowsByUnit).flat()
  if (!allRows.length) return null

  return (
    <div className="pd-module-section">
      <button className="pd-module-header" onClick={() => setOpen(o => !o)}>
        <span className="pd-module-chevron">{open ? '▾' : '▸'}</span>
        <span className="pd-module-title">{module.title}</span>
        <SectionStats rows={allRows} />
      </button>
      {open && (
        <div className="pd-module-rows">
          {unitOrder
            .filter(u => rowsByUnit[u.id]?.length)
            .map(u => (
              <UnitSection
                key={u.id}
                unit={u}
                rows={rowsByUnit[u.id]}
                renderRow={renderRow}
              />
            ))
          }
          {/* Rows with no unit resolved */}
          {rowsByUnit['unknown']?.length > 0 && (
            <UnitSection
              unit={{ id: 'unknown', title: 'Unassigned' }}
              rows={rowsByUnit['unknown']}
              renderRow={renderRow}
            />
          )}
        </div>
      )}
    </div>
  )
}

// A single quiz row
function QuizRow({ row, onNavigate }) {
  const cls = getMasteryClass(row.best)
  return (
    <button className="pd-item-row" onClick={() => onNavigate(row)}>
      <div className="pd-item-row-info">
        <span className="pd-item-row-title">{row.title}</span>
        {row.chunkTitle && <span className="pd-item-row-sub">{row.chunkTitle}</span>}
      </div>
      <div className="pd-item-row-meta">
        <span>{row.attempts} {row.attempts === 1 ? 'attempt' : 'attempts'}</span>
        <span>{formatDate(row.lastAt)}</span>
      </div>
      <div className={`pd-item-row-score mastery-${cls}`}>
        {row.best != null ? `${row.best}%` : '—'}
      </div>
    </button>
  )
}

// A single timeline row
function TimelineRow({ row, onNavigate }) {
  const dateBest  = row.modes?.date  ?? null
  const matchBest = row.modes?.match ?? null
  // row.best is pre-computed in derivation — do not mutate here
  return (
    <button className="pd-item-row pd-item-row-timeline" onClick={() => onNavigate(row)}>
      <div className="pd-item-row-info">
        <span className="pd-item-row-title">{row.title}</span>
        {row.sub && <span className="pd-item-row-sub">{row.sub}</span>}
      </div>
      <div className="pd-item-row-meta">
        <span>{row.attempts} {row.attempts === 1 ? 'attempt' : 'attempts'}</span>
        <span>{formatDate(row.lastAt)}</span>
      </div>
      <div className="pd-tl-mode-scores">
        {dateBest != null && (
          <span className={`pd-tl-mode-pill mastery-${getMasteryClass(dateBest)}`} title="Date mode">
            D {dateBest}%
          </span>
        )}
        {matchBest != null && (
          <span className={`pd-tl-mode-pill mastery-${getMasteryClass(matchBest)}`} title="Match mode">
            M {matchBest}%
          </span>
        )}
        {row.best == null && <span className="pd-item-row-score">—</span>}
      </div>
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]     = useState('quizzes')
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError]             = useState(null)

  // Quiz state
  const [quizAttempts, setQuizAttempts] = useState([])
  const [resourceMeta, setResourceMeta] = useState({})
  const [moduleOrder, setModuleOrder]   = useState([])  // [{ id, title }]
  const [unitOrderMap, setUnitOrderMap] = useState({})  // moduleId → [{ id, title }]

  // Timeline state
  const [tlAttempts, setTlAttempts]       = useState([])
  const [tlItemMeta, setTlItemMeta]       = useState({})
  const [tlModuleOrder, setTlModuleOrder] = useState([])
  const [tlUnitOrderMap, setTlUnitOrderMap] = useState({})  // moduleId → [{ id, title }]

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoadingData(false); return }
    load()
  }, [user, authLoading])

  async function load() {
    setLoadingData(true)
    setError(null)
    try {
      await Promise.all([loadQuizData(), loadTimelineData()])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingData(false)
    }
  }

  // ── Quiz data ─────────────────────────────────────────────────

  async function loadQuizData() {
    const { data: attempts, error: aErr } = await supabase
      .from('quiz_attempts')
      .select('resource_id, score, total, percent, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
    if (aErr) throw aErr

    setQuizAttempts(attempts ?? [])
    if (!attempts?.length) return

    const resourceIds = [...new Set(attempts.map(a => a.resource_id))]
    const { data: resources, error: rErr } = await supabase
      .from('resources')
      .select('id, title, chunk_resources(chunk_id, chunks(id, title, unit_id, units(id, title, order_index, module_id, modules(id, title, course_id))))')
      .in('id', resourceIds)
    if (rErr) throw rErr

    const meta = {}
    const moduleMap = {}
    const unitMap   = {}   // unitId → { id, title, order_index, moduleId }

    ;(resources ?? []).forEach(res => {
      const cr     = res.chunk_resources?.[0]
      const chunk  = cr?.chunks
      const unit   = chunk?.units
      const module = unit?.modules
      meta[res.id] = {
        title:       res.title,
        chunkId:     chunk?.id          ?? null,
        chunkTitle:  chunk?.title       ?? null,
        unitId:      unit?.id           ?? null,
        unitTitle:   unit?.title        ?? null,
        moduleId:    module?.id         ?? null,
        moduleTitle: module?.title      ?? 'Unassigned',
        courseId:    module?.course_id  ?? null,
      }
      if (module) moduleMap[module.id] = { id: module.id, title: module.title }
      if (unit)   unitMap[unit.id]     = { id: unit.id, title: unit.title, order_index: unit.order_index, moduleId: module?.id ?? null }
    })
    setResourceMeta(meta)

    // Fetch ordered modules
    const moduleIds = Object.keys(moduleMap)
    if (!moduleIds.length) return

    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, order_index, course_id')
      .in('id', moduleIds)
      .order('course_id').order('order_index')
    setModuleOrder(modules ?? [])

    // Build unitOrderMap: moduleId → units sorted by order_index
    const unitsByModule = {}
    Object.values(unitMap).forEach(u => {
      if (!u.moduleId) return
      if (!unitsByModule[u.moduleId]) unitsByModule[u.moduleId] = []
      unitsByModule[u.moduleId].push(u)
    })
    Object.values(unitsByModule).forEach(arr => arr.sort((a, b) => a.order_index - b.order_index))
    setUnitOrderMap(unitsByModule)
  }

  // ── Timeline data ─────────────────────────────────────────────

  async function loadTimelineData() {
    const { data: attempts, error: aErr } = await supabase
      .from('timeline_attempts')
      .select('timeline_id, parent_type, parent_id, mode, percent, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
    if (aErr) throw aErr

    if (!attempts?.length) { setTlAttempts([]); return }

    const customTimelineIds = [...new Set(attempts.filter(a => a.timeline_id).map(a => a.timeline_id))]
    const chunkParentIds    = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'chunk').map(a => a.parent_id))]
    const unitParentIds     = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'unit').map(a => a.parent_id))]
    const moduleParentIds   = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'module').map(a => a.parent_id))]

    const [tlRes, chunkRes, unitRes, moduleRes, ctChunkRes, ctUnitRes, ctModuleRes] = await Promise.all([
      customTimelineIds.length
        ? supabase.from('timelines').select('id, title').in('id', customTimelineIds)
        : { data: [] },
      chunkParentIds.length
        ? supabase.from('chunks')
            .select('id, title, unit_id, units(id, title, order_index, module_id, modules(id, title, course_id))')
            .in('id', chunkParentIds)
        : { data: [] },
      unitParentIds.length
        ? supabase.from('units')
            .select('id, title, order_index, module_id, modules(id, title, course_id)')
            .in('id', unitParentIds)
        : { data: [] },
      moduleParentIds.length
        ? supabase.from('modules').select('id, title, course_id').in('id', moduleParentIds)
        : { data: [] },
      customTimelineIds.length
        ? supabase.from('chunk_timelines')
            .select('timeline_id, chunks(id, title, unit_id, units(id, title, order_index, module_id, modules(id, title, course_id)))')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
      customTimelineIds.length
        ? supabase.from('unit_timelines')
            .select('timeline_id, units(id, title, order_index, module_id, modules(id, title, course_id))')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
      customTimelineIds.length
        ? supabase.from('module_timelines')
            .select('timeline_id, modules(id, title, course_id)')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
    ])

    const tlTitles = {}
    ;(tlRes.data ?? []).forEach(t => { tlTitles[t.id] = t.title })

    const chunkToModule = {}
    ;(chunkRes.data ?? []).forEach(c => {
      const unit = c.units; const mod = unit?.modules
      chunkToModule[c.id] = {
        chunkTitle:  c.title,
        unitId:      unit?.id           ?? null,
        unitTitle:   unit?.title        ?? null,
        unitOrder:   unit?.order_index  ?? 0,
        moduleId:    mod?.id            ?? null,
        moduleTitle: mod?.title         ?? 'Unassigned',
        courseId:    mod?.course_id     ?? null,
      }
    })

    const unitToModule = {}
    ;(unitRes.data ?? []).forEach(u => {
      const mod = u.modules
      unitToModule[u.id] = {
        unitTitle:   u.title,
        unitOrder:   u.order_index      ?? 0,
        moduleId:    mod?.id            ?? null,
        moduleTitle: mod?.title         ?? 'Unassigned',
        courseId:    mod?.course_id     ?? null,
      }
    })

    const moduleInfo = {}
    ;(moduleRes.data ?? []).forEach(m => {
      moduleInfo[m.id] = { moduleId: m.id, moduleTitle: m.title, courseId: m.course_id }
    })

    // Custom timeline → module resolution (prefer chunk > unit > module)
    const tlToModule = {}
    ;(ctModuleRes.data ?? []).forEach(r => {
      const mod = r.modules
      if (mod && !tlToModule[r.timeline_id]) {
        tlToModule[r.timeline_id] = { moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id, sub: null, unitId: null, unitTitle: null, unitOrder: 0 }
      }
    })
    ;(ctUnitRes.data ?? []).forEach(r => {
      const unit = r.units; const mod = unit?.modules
      if (mod) tlToModule[r.timeline_id] = {
        moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id,
        sub: null, unitId: unit.id, unitTitle: unit.title, unitOrder: unit.order_index ?? 0,
      }
    })
    ;(ctChunkRes.data ?? []).forEach(r => {
      const chunk = r.chunks; const unit = chunk?.units; const mod = unit?.modules
      if (mod) tlToModule[r.timeline_id] = {
        moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id,
        sub: chunk.title, unitId: unit.id, unitTitle: unit.title, unitOrder: unit.order_index ?? 0,
      }
    })

    // Deduplicate master timeline rows (keep most specific scope per session)
    const SCOPE_RANK = { chunk: 0, unit: 1, module: 2 }
    const masterBySession = {}
    attempts.forEach(a => {
      if (!a.timeline_id && a.parent_type) {
        const sessionKey = `${a.mode}|${a.attempted_at}`
        const existing = masterBySession[sessionKey]
        const myRank = SCOPE_RANK[a.parent_type] ?? 99
        const existingRank = existing ? (SCOPE_RANK[existing.parent_type] ?? 99) : 99
        if (!existing || myRank < existingRank) masterBySession[sessionKey] = a
      }
    })

    const allCanonical = [
      ...attempts.filter(a => !!a.timeline_id),
      ...Object.values(masterBySession),
    ]

    // Build item-level summary with unitId
    const itemMeta    = {}
    const itemSummary = {}

    allCanonical.forEach(a => {
      let key, title, sub, modId, modTitle, courseId, unitId, unitTitle, unitOrder

      if (a.timeline_id) {
        key      = `tl:${a.timeline_id}`
        title    = tlTitles[a.timeline_id] ?? 'Timeline'
        const m  = tlToModule[a.timeline_id]
        sub      = m?.sub        ?? null
        modId    = m?.moduleId   ?? null
        modTitle = m?.moduleTitle ?? 'Unassigned'
        courseId = m?.courseId   ?? null
        unitId   = m?.unitId     ?? null
        unitTitle= m?.unitTitle  ?? null
        unitOrder= m?.unitOrder  ?? 0
      } else {
        key = `master:${a.parent_id}`
        if (a.parent_type === 'chunk') {
          const c  = chunkToModule[a.parent_id]
          title    = c?.chunkTitle  ?? 'Master timeline'
          sub      = c?.chunkTitle  ?? null
          modId    = c?.moduleId    ?? null
          modTitle = c?.moduleTitle ?? 'Unassigned'
          courseId = c?.courseId    ?? null
          unitId   = c?.unitId      ?? null
          unitTitle= c?.unitTitle   ?? null
          unitOrder= c?.unitOrder   ?? 0
        } else if (a.parent_type === 'unit') {
          const u  = unitToModule[a.parent_id]
          title    = 'Master timeline'
          sub      = null
          modId    = u?.moduleId    ?? null
          modTitle = u?.moduleTitle ?? 'Unassigned'
          courseId = u?.courseId    ?? null
          unitId   = a.parent_id
          unitTitle= u?.unitTitle   ?? null
          unitOrder= u?.unitOrder   ?? 0
        } else {
          const m  = moduleInfo[a.parent_id]
          title    = 'Master timeline'
          sub      = null
          modId    = m?.moduleId    ?? null
          modTitle = m?.moduleTitle ?? 'Unassigned'
          courseId = m?.courseId    ?? null
          unitId   = null
          unitTitle= null
          unitOrder= 0
        }
      }

      if (!itemMeta[key]) {
        itemMeta[key] = { title, sub, moduleId: modId, moduleTitle: modTitle, courseId, unitId, unitTitle, unitOrder }
      }
      if (!itemSummary[key]) {
        itemSummary[key] = { attempts: 0, modes: {}, lastAt: a.attempted_at, moduleId: modId, unitId }
      }
      itemSummary[key].attempts++
      const prev = itemSummary[key].modes[a.mode]
      if (prev == null || a.percent > prev) itemSummary[key].modes[a.mode] = a.percent
    })

    setTlAttempts(allCanonical)
    setTlItemMeta({ meta: itemMeta, summary: itemSummary })

    // Module order for timelines
    const tlModuleIds = [...new Set(Object.values(itemMeta).map(m => m.moduleId).filter(Boolean))]
    if (!tlModuleIds.length) return

    const { data: mods } = await supabase
      .from('modules').select('id, title, order_index, course_id')
      .in('id', tlModuleIds).order('course_id').order('order_index')
    setTlModuleOrder(mods ?? [])

    // Unit order for timelines: collect from itemMeta
    const tlUnitsByModule = {}
    Object.values(itemMeta).forEach(m => {
      if (!m.moduleId || !m.unitId) return
      if (!tlUnitsByModule[m.moduleId]) tlUnitsByModule[m.moduleId] = {}
      tlUnitsByModule[m.moduleId][m.unitId] = { id: m.unitId, title: m.unitTitle ?? 'Unit', order_index: m.unitOrder }
    })
    const tlUnitOrderMap = {}
    Object.entries(tlUnitsByModule).forEach(([modId, units]) => {
      tlUnitOrderMap[modId] = Object.values(units).sort((a, b) => a.order_index - b.order_index)
    })
    setTlUnitOrderMap(tlUnitOrderMap)
  }

  // ── Derived: quiz ─────────────────────────────────────────────

  const quizSummary = (() => {
    const map = {}
    quizAttempts.forEach(a => {
      const prev = map[a.resource_id]
      if (!prev) {
        map[a.resource_id] = { attempts: 1, best: a.percent, lastAt: a.attempted_at }
      } else {
        prev.attempts++
        if (a.percent > prev.best) prev.best = a.percent
      }
    })
    return map
  })()

  // Nested: moduleId → unitId → [rows]
  const quizRowsByModuleUnit = (() => {
    const byModule = {}
    Object.entries(quizSummary).forEach(([resId, stats]) => {
      const meta  = resourceMeta[resId]
      const modId = meta?.moduleId ?? 'unknown'
      const unitId= meta?.unitId   ?? 'unknown'
      if (!byModule[modId]) byModule[modId] = {}
      if (!byModule[modId][unitId]) byModule[modId][unitId] = []
      byModule[modId][unitId].push({
        resourceId: resId,
        title:      meta?.title      ?? 'Unknown quiz',
        chunkTitle: meta?.chunkTitle ?? null,
        chunkId:    meta?.chunkId,
        unitId:     meta?.unitId,
        ...stats,
      })
    })
    // Sort each unit's rows: unattempted first, then weakest first
    Object.values(byModule).forEach(byUnit =>
      Object.values(byUnit).forEach(rows => {
        rows.sort((a, b) => {
          if (a.best == null && b.best == null) return 0
          if (a.best == null) return -1
          if (b.best == null) return 1
          return a.best - b.best
        })
      })
    )
    return byModule
  })()

  // All rows flattened per module (for module-level stats in header)
  function allQuizRowsForModule(modId) {
    return Object.values(quizRowsByModuleUnit[modId] ?? {}).flat()
  }

  const totalQuizzes   = Object.keys(quizSummary).length
  const totalQAttempts = quizAttempts.length
  const allQBests      = Object.values(quizSummary).map(s => s.best).filter(v => v != null)
  const quizAvg        = avg(allQBests)

  // ── Derived: timelines ────────────────────────────────────────

  const { meta: tlMeta = {}, summary: tlSummary = {} } = tlItemMeta

  // Nested: moduleId → unitId → [rows]
  const tlRowsByModuleUnit = (() => {
    const byModule = {}
    Object.entries(tlSummary).forEach(([key, stats]) => {
      const meta   = tlMeta[key]
      const modId  = meta?.moduleId ?? 'unknown'
      const unitId = meta?.unitId   ?? 'unknown'
      if (!byModule[modId]) byModule[modId] = {}
      if (!byModule[modId][unitId]) byModule[modId][unitId] = []
      const allBests = Object.values(stats.modes).filter(v => v != null)
      byModule[modId][unitId].push({
        key,
        title:    meta?.title    ?? 'Timeline',
        sub:      meta?.sub      ?? null,
        unitId:   meta?.unitId   ?? null,
        modes:    stats.modes,
        best:     allBests.length ? Math.max(...allBests) : null,
        attempts: stats.attempts,
        lastAt:   stats.lastAt,
      })
    })
    Object.values(byModule).forEach(byUnit =>
      Object.values(byUnit).forEach(rows => {
        rows.sort((a, b) => {
          if (a.best == null && b.best == null) return 0
          if (a.best == null) return -1
          if (b.best == null) return 1
          return a.best - b.best
        })
      })
    )
    return byModule
  })()

  function allTlRowsForModule(modId) {
    return Object.values(tlRowsByModuleUnit[modId] ?? {}).flat()
  }

  const totalTlItems   = Object.keys(tlSummary).length
  const totalTlAttempts = tlAttempts.length
  const allTlBests     = Object.values(tlSummary).map(s => {
    const v = Object.values(s.modes).filter(x => x != null)
    return v.length ? Math.max(...v) : null
  }).filter(v => v != null)
  const tlAvg = avg(allTlBests)

  // ── Not logged in ─────────────────────────────────────────────

  if (!authLoading && !user) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-level-label">Student</div>
            <h1>My Progress</h1>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <p>Sign in to track your progress across quizzes and timelines.</p>
        </div>
      </div>
    )
  }

  if (loadingData) return (
    <div className="page"><div className="loading-pulse">Loading your progress…</div></div>
  )
  if (error) return (
    <div className="page"><p className="page-error">Error: {error}</p></div>
  )

  // Helper: render a module → unit → rows tree
  function renderModuleTree({ moduleOrder, rowsByModuleUnit, allRowsForModule, unitOrderMap, renderRow, unknownModuleTitle }) {
    const modules = moduleOrder.length > 0
      ? moduleOrder
      : Object.keys(rowsByModuleUnit)
          .filter(id => id !== 'unknown')
          .map(id => ({ id, title: unknownModuleTitle(id) }))

    return (
      <>
        {modules
          .filter(m => allRowsForModule(m.id).length > 0)
          .map(m => {
            const byUnit = rowsByModuleUnit[m.id] ?? {}
            const units  = unitOrderMap[m.id] ?? []
            // Collect unitIds present in data that aren't in ordered list
            const knownUnitIds = new Set(units.map(u => u.id))
            const extraUnitIds = Object.keys(byUnit).filter(id => id !== 'unknown' && !knownUnitIds.has(id))
            const fullUnitOrder = [
              ...units,
              ...extraUnitIds.map(id => ({ id, title: 'Unit' })),
            ]
            return (
              <ModuleSection
                key={m.id}
                module={m}
                unitOrder={fullUnitOrder}
                rowsByUnit={byUnit}
                renderRow={renderRow}
              />
            )
          })
        }
        {/* Unknown module */}
        {allRowsForModule('unknown').length > 0 && (
          <ModuleSection
            module={{ id: 'unknown', title: 'Unassigned' }}
            unitOrder={[{ id: 'unknown', title: 'Unassigned' }]}
            rowsByUnit={{ unknown: allRowsForModule('unknown') }}
            renderRow={renderRow}
          />
        )}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-level-label">Student</div>
          <h1>My Progress</h1>
          <p className="page-subtitle">
            Signed in as <strong>{profile?.username ?? user.email}</strong>
          </p>
        </div>
      </div>

      {/* ── Stat strip ── */}
      <div className="pd-stat-strip">
        <StatCard icon="❓" value={totalQuizzes}   label="Quizzes attempted" />
        <StatCard icon="🔁" value={totalQAttempts} label="Total quiz attempts" />
        <StatCard icon="📊" value={quizAvg != null ? `${quizAvg}%` : '—'} label="Quiz avg best" />
        <StatCard icon="📅" value={totalTlItems}   label="Timelines attempted" />
        <StatCard icon="📊" value={tlAvg   != null ? `${tlAvg}%`  : '—'} label="Timeline avg best" />
      </div>

      {/* ── Tabs ── */}
      <div className="page-tabs">
        <button
          className={`page-tab ${activeTab === 'quizzes'   ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('quizzes')}
        >
          Quizzes
        </button>
        <button
          className={`page-tab ${activeTab === 'timelines' ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('timelines')}
        >
          Timelines
        </button>
      </div>

      {/* ── Quizzes tab ── */}
      {activeTab === 'quizzes' && (
        <div className="pd-tab-content">
          {totalQuizzes === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">❓</div>
              <p>You haven't attempted any quizzes yet.</p>
            </div>
          ) : (
            <>
              <DistributionChart allBests={allQBests} total={totalQuizzes} />
              <div className="pd-modules">
                <h2 className="pd-section-title">By module</h2>
                {renderModuleTree({
                  moduleOrder,
                  rowsByModuleUnit: quizRowsByModuleUnit,
                  allRowsForModule: allQuizRowsForModule,
                  unitOrderMap,
                  renderRow: row => (
                    <QuizRow
                      key={row.resourceId}
                      row={row}
                      onNavigate={r => { if (r.unitId) navigate(`/chunks/${r.unitId}`) }}
                    />
                  ),
                  unknownModuleTitle: id => resourceMeta[Object.values(quizRowsByModuleUnit[id] ?? {})?.[0]?.[0]?.resourceId]?.moduleTitle ?? 'Module',
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Timelines tab ── */}
      {activeTab === 'timelines' && (
        <div className="pd-tab-content">
          {totalTlItems === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p>You haven't attempted any timelines yet.</p>
            </div>
          ) : (
            <>
              <DistributionChart allBests={allTlBests} total={totalTlItems} />
              <div className="pd-modules">
                <h2 className="pd-section-title">By module</h2>
                {renderModuleTree({
                  moduleOrder: tlModuleOrder,
                  rowsByModuleUnit: tlRowsByModuleUnit,
                  allRowsForModule: allTlRowsForModule,
                  unitOrderMap: tlUnitOrderMap,
                  renderRow: row => (
                    <TimelineRow
                      key={row.key}
                      row={row}
                      onNavigate={r => { if (r.unitId) navigate(`/chunks/${r.unitId}`) }}
                    />
                  ),
                  unknownModuleTitle: id => tlMeta[Object.values(tlRowsByModuleUnit[id] ?? {})?.[0]?.[0]?.key]?.moduleTitle ?? 'Module',
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
