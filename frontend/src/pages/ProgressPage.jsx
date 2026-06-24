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

// ── Shared sub-components ─────────────────────────────────────────

function StatCard({ icon, value, label, sub }) {
  return (
    <div className="pd-stat-card">
      <span className="pd-stat-icon">{icon}</span>
      <span className="pd-stat-value">{value ?? '—'}</span>
      <span className="pd-stat-label">{label}</span>
      {sub && <span className="pd-stat-sub">{sub}</span>}
    </div>
  )
}

// Vertical bar chart showing score distribution
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

// A collapsible module section containing rows
function ModuleSection({ module, rows, renderRow }) {
  const [open, setOpen] = useState(true)
  if (!rows.length) return null

  const attempted = rows.filter(r => r.best != null)
  const avgScore  = avg(attempted.map(r => r.best))
  const cls       = getMasteryClass(avgScore)

  return (
    <div className="pd-module-section">
      <button className="pd-module-header" onClick={() => setOpen(o => !o)}>
        <span className="pd-module-chevron">{open ? '▾' : '▸'}</span>
        <span className="pd-module-title">{module.title}</span>
        <span className="pd-module-counts">
          {attempted.length}/{rows.length} attempted
          {avgScore != null && (
            <span className={`pd-module-avg mastery-${cls}`}>{avgScore}% avg</span>
          )}
        </span>
      </button>
      {open && (
        <div className="pd-module-rows">
          {rows.map(row => renderRow(row))}
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

// A single timeline row — shows Date and Match mode scores side by side
function TimelineRow({ row, onNavigate }) {
  const dateBest  = row.modes?.date  ?? null
  const matchBest = row.modes?.match ?? null
  // best = highest of the two modes, used for the score badge colour
  const best = [dateBest, matchBest].filter(v => v != null)
  row.best = best.length ? Math.max(...best) : null
  const cls = getMasteryClass(row.best)

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
        {row.best == null && <span className="pd-item-row-score mastery-">—</span>}
      </div>
    </button>
  )
}

// ── Main page ────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('quizzes')
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState(null)

  // Quiz state
  const [quizAttempts, setQuizAttempts] = useState([])
  const [resourceMeta, setResourceMeta] = useState({})
  const [moduleOrder, setModuleOrder]   = useState([])

  // Timeline state
  const [tlAttempts, setTlAttempts]         = useState([])
  const [tlItemMeta, setTlItemMeta]         = useState({})   // key → { title, sub, moduleId, moduleTitle, unitId }
  const [tlModuleOrder, setTlModuleOrder]   = useState([])

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
      .select('id, title, chunk_resources(chunk_id, chunks(id, title, unit_id, units(id, module_id, modules(id, title, course_id))))')
      .in('id', resourceIds)
    if (rErr) throw rErr

    const meta = {}
    const moduleMap = {}
    ;(resources ?? []).forEach(res => {
      const cr     = res.chunk_resources?.[0]
      const chunk  = cr?.chunks
      const unit   = chunk?.units
      const module = unit?.modules
      meta[res.id] = {
        title:       res.title,
        chunkId:     chunk?.id    ?? null,
        chunkTitle:  chunk?.title ?? null,
        unitId:      unit?.id     ?? null,
        moduleId:    module?.id   ?? null,
        moduleTitle: module?.title ?? 'Unassigned',
        courseId:    module?.course_id ?? null,
      }
      if (module) moduleMap[module.id] = { id: module.id, title: module.title }
    })
    setResourceMeta(meta)

    const moduleIds = Object.keys(moduleMap)
    if (moduleIds.length) {
      const { data: modules } = await supabase
        .from('modules')
        .select('id, title, order_index, course_id')
        .in('id', moduleIds)
        .order('course_id').order('order_index')
      setModuleOrder(modules ?? [])
    }
  }

  // ── Timeline data ─────────────────────────────────────────────
  //
  // Master timeline attempts save ONE ROW PER PARENT LEVEL (chunk + unit + module)
  // for each attempt. We must deduplicate so each real "attempt session" counts once.
  //
  // Strategy: for master timelines, keep only the most specific scope row per
  // attempt group. We identify attempt groups by (parent_id at chunk level) +
  // (mode) + (attempted_at). Since chunk rows are always saved alongside unit/module
  // rows in the same insert, we prefer chunk > unit > module.
  //
  // For display we resolve every distinct (timeline or master-chunk) to a module
  // so we can group by module, matching the quiz tab layout.

  async function loadTimelineData() {
    const { data: attempts, error: aErr } = await supabase
      .from('timeline_attempts')
      .select('timeline_id, parent_type, parent_id, mode, percent, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
    if (aErr) throw aErr

    if (!attempts?.length) { setTlAttempts([]); return }

    // ── 1. Resolve module for each row ────────────────────────────

    // Collect IDs we need to look up
    const customTimelineIds = [...new Set(attempts.filter(a => a.timeline_id).map(a => a.timeline_id))]
    const chunkParentIds    = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'chunk').map(a => a.parent_id))]
    const unitParentIds     = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'unit').map(a => a.parent_id))]
    const moduleParentIds   = [...new Set(attempts.filter(a => !a.timeline_id && a.parent_type === 'module').map(a => a.parent_id))]

    // Fetch in parallel
    const [tlRes, chunkRes, unitRes, moduleRes, ctChunkRes, ctUnitRes, ctModuleRes] = await Promise.all([
      // Custom timeline titles
      customTimelineIds.length
        ? supabase.from('timelines').select('id, title').in('id', customTimelineIds)
        : { data: [] },
      // chunk parent → unit → module
      chunkParentIds.length
        ? supabase.from('chunks').select('id, title, unit_id, units(id, module_id, modules(id, title, course_id))').in('id', chunkParentIds)
        : { data: [] },
      // unit parent → module
      unitParentIds.length
        ? supabase.from('units').select('id, module_id, modules(id, title, course_id)').in('id', unitParentIds)
        : { data: [] },
      // module parent → module title
      moduleParentIds.length
        ? supabase.from('modules').select('id, title, course_id').in('id', moduleParentIds)
        : { data: [] },
      // custom timeline → chunk attachment → chunk → unit → module
      customTimelineIds.length
        ? supabase.from('chunk_timelines')
            .select('timeline_id, chunks(id, title, unit_id, units(id, module_id, modules(id, title, course_id)))')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
      // custom timeline → unit attachment → unit → module
      customTimelineIds.length
        ? supabase.from('unit_timelines')
            .select('timeline_id, units(id, module_id, modules(id, title, course_id))')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
      // custom timeline → module attachment
      customTimelineIds.length
        ? supabase.from('module_timelines')
            .select('timeline_id, modules(id, title, course_id)')
            .in('timeline_id', customTimelineIds)
        : { data: [] },
    ])

    // Build lookup maps
    const tlTitles = {}    // timeline_id → title
    ;(tlRes.data ?? []).forEach(t => { tlTitles[t.id] = t.title })

    const chunkToModule = {}  // chunk_id → { moduleId, moduleTitle, courseId, chunkTitle, unitId }
    ;(chunkRes.data ?? []).forEach(c => {
      const unit = c.units; const mod = unit?.modules
      chunkToModule[c.id] = {
        chunkTitle:  c.title,
        unitId:      unit?.id      ?? null,
        moduleId:    mod?.id       ?? null,
        moduleTitle: mod?.title    ?? 'Unassigned',
        courseId:    mod?.course_id ?? null,
      }
    })

    const unitToModule = {}   // unit_id → { moduleId, moduleTitle, courseId }
    ;(unitRes.data ?? []).forEach(u => {
      const mod = u.modules
      unitToModule[u.id] = {
        moduleId: mod?.id ?? null, moduleTitle: mod?.title ?? 'Unassigned', courseId: mod?.course_id ?? null,
      }
    })

    const moduleInfo = {}  // module_id → { moduleTitle, courseId }
    ;(moduleRes.data ?? []).forEach(m => {
      moduleInfo[m.id] = { moduleId: m.id, moduleTitle: m.title, courseId: m.course_id }
    })

    // For custom timelines: resolve module via attachment tables (prefer chunk > unit > module)
    const tlToModule = {}  // timeline_id → { moduleId, moduleTitle, courseId, sub (chunk/unit title) }
    ;(ctModuleRes.data ?? []).forEach(r => {
      const mod = r.modules
      if (mod && !tlToModule[r.timeline_id]) {
        tlToModule[r.timeline_id] = { moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id, sub: null }
      }
    })
    ;(ctUnitRes.data ?? []).forEach(r => {
      const mod = r.units?.modules
      if (mod) tlToModule[r.timeline_id] = { moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id, sub: null }
    })
    ;(ctChunkRes.data ?? []).forEach(r => {
      const chunk = r.chunks; const mod = chunk?.units?.modules
      if (mod) tlToModule[r.timeline_id] = {
        moduleId: mod.id, moduleTitle: mod.title, courseId: mod.course_id,
        sub: chunk.title,
      }
    })

    // ── 2. Deduplicate master timeline rows ────────────────────────
    // Master attempts are inserted as chunk+unit+module rows simultaneously.
    // We keep only the chunk-level row (most specific) for counting purposes.
    // If no chunk row exists for a given (mode, attempted_at near-group), keep unit, then module.
    // Simple approach: for each attempt row, assign a "canonical key" based on
    // the most specific scope we have for the same session, then deduplicate.
    //
    // We identify session groups by rounding attempted_at to the nearest second
    // (rows inserted together will share the same timestamp in practice).

    const canonicalRows = []   // deduplicated rows for summary
    const masterSeen = new Set()  // "sessionKey" for master dedup

    // Process in order (most recent first from DB). For master attempts, prefer chunk rows.
    // Collect all rows grouped by (parent context) to find sessions.
    // Since rows for the same attempt share the same `attempted_at` value, we use that.
    const masterBySession = {}  // `${mode}|${attempted_at}` → best (most specific) row
    const SCOPE_RANK = { chunk: 0, unit: 1, module: 2 }

    attempts.forEach(a => {
      if (!a.timeline_id && a.parent_type) {
        const sessionKey = `${a.mode}|${a.attempted_at}`
        const existing = masterBySession[sessionKey]
        const myRank = SCOPE_RANK[a.parent_type] ?? 99
        const existingRank = existing ? (SCOPE_RANK[existing.parent_type] ?? 99) : 99
        if (!existing || myRank < existingRank) {
          masterBySession[sessionKey] = a
        }
      }
    })

    // Canonical row list: all custom rows + one master row per session
    const masterSessionRows = Object.values(masterBySession)

    const allCanonical = [
      ...attempts.filter(a => !!a.timeline_id),
      ...masterSessionRows,
    ]

    // ── 3. Build item-level summary ───────────────────────────────
    // Key: for custom = timeline_id; for master = `master:${chunk_id}` (most specific parent_id)
    const itemMeta = {}   // key → { title, sub, moduleId, moduleTitle, courseId, unitId }
    const itemSummary = {} // key → { attempts, modes: {date: best, match: best}, lastAt, moduleId }

    allCanonical.forEach(a => {
      let key, title, sub, modId, modTitle, courseId, unitId

      if (a.timeline_id) {
        key     = `tl:${a.timeline_id}`
        title   = tlTitles[a.timeline_id] ?? 'Timeline'
        const m = tlToModule[a.timeline_id]
        sub     = m?.sub      ?? null
        modId   = m?.moduleId ?? null
        modTitle= m?.moduleTitle ?? 'Unassigned'
        courseId= m?.courseId ?? null
        unitId  = null
      } else {
        // master — use the chunk/unit/module parent to identify this "timeline location"
        key = `master:${a.parent_id}`
        if (a.parent_type === 'chunk') {
          const c = chunkToModule[a.parent_id]
          title   = 'Master timeline'
          sub     = c?.chunkTitle ?? null
          modId   = c?.moduleId   ?? null
          modTitle= c?.moduleTitle ?? 'Unassigned'
          courseId= c?.courseId   ?? null
          unitId  = c?.unitId     ?? null
        } else if (a.parent_type === 'unit') {
          const u = unitToModule[a.parent_id]
          title   = 'Master timeline'
          sub     = null
          modId   = u?.moduleId   ?? null
          modTitle= u?.moduleTitle ?? 'Unassigned'
          courseId= u?.courseId   ?? null
          unitId  = a.parent_id
        } else {
          const m = moduleInfo[a.parent_id]
          title   = 'Master timeline'
          sub     = null
          modId   = m?.moduleId   ?? null
          modTitle= m?.moduleTitle ?? 'Unassigned'
          courseId= m?.courseId   ?? null
          unitId  = null
        }
      }

      // Store meta (idempotent — same for all rows with this key)
      if (!itemMeta[key]) {
        itemMeta[key] = { title, sub, moduleId: modId, moduleTitle: modTitle, courseId, unitId }
      }

      // Accumulate summary
      if (!itemSummary[key]) {
        itemSummary[key] = { attempts: 0, modes: {}, lastAt: a.attempted_at, moduleId: modId }
      }
      itemSummary[key].attempts++
      const prev = itemSummary[key].modes[a.mode]
      if (prev == null || a.percent > prev) itemSummary[key].modes[a.mode] = a.percent
    })

    setTlAttempts(allCanonical)
    setTlItemMeta({ meta: itemMeta, summary: itemSummary })

    // ── 4. Module order for timelines ─────────────────────────────
    const tlModuleIds = [...new Set(Object.values(itemMeta).map(m => m.moduleId).filter(Boolean))]
    if (tlModuleIds.length) {
      const { data: mods } = await supabase
        .from('modules').select('id, title, order_index, course_id')
        .in('id', tlModuleIds).order('course_id').order('order_index')
      setTlModuleOrder(mods ?? [])
    }
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

  const quizRowsByModule = (() => {
    const byModule = {}
    Object.entries(quizSummary).forEach(([resId, stats]) => {
      const meta  = resourceMeta[resId]
      const modId = meta?.moduleId ?? 'unknown'
      if (!byModule[modId]) byModule[modId] = []
      byModule[modId].push({
        resourceId: resId,
        title:      meta?.title      ?? 'Unknown quiz',
        chunkTitle: meta?.chunkTitle ?? null,
        chunkId:    meta?.chunkId,
        unitId:     meta?.unitId,
        ...stats,
      })
    })
    Object.values(byModule).forEach(rows =>
      rows.sort((a, b) => {
        if (a.best == null && b.best == null) return 0
        if (a.best == null) return -1
        if (b.best == null) return 1
        return a.best - b.best
      })
    )
    return byModule
  })()

  const totalQuizzes  = Object.keys(quizSummary).length
  const totalQAttempts = quizAttempts.length
  const allQBests     = Object.values(quizSummary).map(s => s.best).filter(v => v != null)
  const quizAvg       = avg(allQBests)
  const quizHighCount = allQBests.filter(p => p >= 80).length

  // ── Derived: timelines ────────────────────────────────────────

  const { meta: tlMeta = {}, summary: tlSummary = {} } = tlItemMeta

  const tlRowsByModule = (() => {
    const byModule = {}
    Object.entries(tlSummary).forEach(([key, stats]) => {
      const meta  = tlMeta[key]
      const modId = meta?.moduleId ?? 'unknown'
      if (!byModule[modId]) byModule[modId] = []
      const allBests = Object.values(stats.modes).filter(v => v != null)
      byModule[modId].push({
        key,
        title:   meta?.title ?? 'Timeline',
        sub:     meta?.sub   ?? null,
        unitId:  meta?.unitId ?? null,
        modes:   stats.modes,
        best:    allBests.length ? Math.max(...allBests) : null,
        attempts: stats.attempts,
        lastAt:  stats.lastAt,
      })
    })
    Object.values(byModule).forEach(rows =>
      rows.sort((a, b) => {
        if (a.best == null && b.best == null) return 0
        if (a.best == null) return -1
        if (b.best == null) return 1
        return a.best - b.best
      })
    )
    return byModule
  })()

  const totalTlItems   = Object.keys(tlSummary).length
  const totalTlAttempts = tlAttempts.length
  const allTlBests     = Object.values(tlSummary).map(s => {
    const v = Object.values(s.modes).filter(x => x != null)
    return v.length ? Math.max(...v) : null
  }).filter(v => v != null)
  const tlAvg       = avg(allTlBests)
  const tlHighCount = allTlBests.filter(p => p >= 80).length

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
        <StatCard icon="📊" value={tlAvg  != null ? `${tlAvg}%`  : '—'} label="Timeline avg best" />
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
                {(moduleOrder.length > 0 ? moduleOrder : Object.keys(quizRowsByModule).map(id => ({
                  id, title: resourceMeta[quizRowsByModule[id]?.[0]?.resourceId]?.moduleTitle ?? 'Module'
                })))
                  .filter(m => quizRowsByModule[m.id]?.length)
                  .map(m => (
                    <ModuleSection
                      key={m.id}
                      module={m}
                      rows={quizRowsByModule[m.id] ?? []}
                      renderRow={row => (
                        <QuizRow
                          key={row.resourceId}
                          row={row}
                          onNavigate={r => { if (r.unitId) navigate(`/chunks/${r.unitId}`) }}
                        />
                      )}
                    />
                  ))
                }
                {quizRowsByModule['unknown']?.length > 0 && (
                  <ModuleSection
                    module={{ id: 'unknown', title: 'Unassigned' }}
                    rows={quizRowsByModule['unknown']}
                    renderRow={row => (
                      <QuizRow key={row.resourceId} row={row} onNavigate={() => {}} />
                    )}
                  />
                )}
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
                {(tlModuleOrder.length > 0 ? tlModuleOrder : Object.keys(tlRowsByModule).map(id => ({
                  id, title: tlMeta[tlRowsByModule[id]?.[0]?.key]?.moduleTitle ?? 'Module'
                })))
                  .filter(m => tlRowsByModule[m.id]?.length)
                  .map(m => (
                    <ModuleSection
                      key={m.id}
                      module={m}
                      rows={tlRowsByModule[m.id] ?? []}
                      renderRow={row => (
                        <TimelineRow
                          key={row.key}
                          row={row}
                          onNavigate={r => { if (r.unitId) navigate(`/chunks/${r.unitId}`) }}
                        />
                      )}
                    />
                  ))
                }
                {tlRowsByModule['unknown']?.length > 0 && (
                  <ModuleSection
                    module={{ id: 'unknown', title: 'Unassigned' }}
                    rows={tlRowsByModule['unknown']}
                    renderRow={row => (
                      <TimelineRow key={row.key} row={row} onNavigate={() => {}} />
                    )}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
