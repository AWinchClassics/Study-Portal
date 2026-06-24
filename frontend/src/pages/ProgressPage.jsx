import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { getMasteryClass } from '../hooks/useMastery'
import '../progress.css'

// ── Helpers ──────────────────────────────────────────────────────

function masteryLabel(pct) {
  if (pct == null) return 'Not attempted'
  if (pct >= 80) return 'High'
  if (pct >= 50) return 'Mid'
  return 'Low'
}

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

// ── Sub-components ───────────────────────────────────────────────

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

function MasteryBar({ pct }) {
  if (pct == null) return <span className="pd-no-data">—</span>
  const cls = getMasteryClass(pct)
  return (
    <div className="pd-bar-wrap">
      <div className="pd-bar-track">
        <div className={`pd-bar-fill pd-bar-${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`pd-bar-label mastery-${cls}`}>{pct}%</span>
    </div>
  )
}

// A row for one quiz resource showing name, attempts, best score
function QuizRow({ title, chunkTitle, attempts, best, lastAt, onClick }) {
  const cls = getMasteryClass(best)
  return (
    <button className="pd-quiz-row" onClick={onClick}>
      <div className="pd-quiz-row-info">
        <span className="pd-quiz-row-title">{title}</span>
        {chunkTitle && <span className="pd-quiz-row-chunk">{chunkTitle}</span>}
      </div>
      <div className="pd-quiz-row-meta">
        <span className="pd-quiz-row-attempts">{attempts} {attempts === 1 ? 'attempt' : 'attempts'}</span>
        <span className="pd-quiz-row-date">{formatDate(lastAt)}</span>
      </div>
      <div className={`pd-quiz-row-score mastery-${cls}`}>
        {best != null ? `${best}%` : '—'}
      </div>
    </button>
  )
}

// A module section with its quiz rows
function ModuleSection({ module, quizRows, onNavigate }) {
  const [open, setOpen] = useState(true)
  if (!quizRows.length) return null

  const attempted = quizRows.filter(r => r.best != null)
  const avgScore  = avg(attempted.map(r => r.best))
  const cls       = getMasteryClass(avgScore)

  return (
    <div className="pd-module-section">
      <button className="pd-module-header" onClick={() => setOpen(o => !o)}>
        <span className="pd-module-chevron">{open ? '▾' : '▸'}</span>
        <span className="pd-module-title">{module.title}</span>
        <span className="pd-module-counts">
          {attempted.length}/{quizRows.length} attempted
          {avgScore != null && (
            <span className={`pd-module-avg mastery-${cls}`}>{avgScore}% avg</span>
          )}
        </span>
      </button>

      {open && (
        <div className="pd-module-rows">
          {quizRows.map(row => (
            <QuizRow
              key={row.resourceId}
              title={row.title}
              chunkTitle={row.chunkTitle}
              attempts={row.attempts}
              best={row.best}
              lastAt={row.lastAt}
              onClick={() => onNavigate(row)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────

export default function ProgressPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]     = useState('quizzes')
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError]             = useState(null)

  // Quiz data
  const [quizAttempts, setQuizAttempts]   = useState([])   // raw rows
  const [resourceMeta, setResourceMeta]   = useState({})   // resourceId → { title, chunkId, chunkTitle, unitId, moduleId, moduleTitle }
  const [moduleOrder, setModuleOrder]     = useState([])   // [{ id, title }] ordered

  // Timeline data
  const [timelineAttempts, setTimelineAttempts] = useState([])  // raw rows
  const [timelineMeta, setTimelineMeta]         = useState({})  // id → { title }

  useEffect(() => {
    if (authLoading) return
    if (!user)       { setLoadingData(false); return }
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

  async function loadQuizData() {
    // 1. All quiz attempts for this user
    const { data: attempts, error: aErr } = await supabase
      .from('quiz_attempts')
      .select('resource_id, score, total, percent, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
    if (aErr) throw aErr

    setQuizAttempts(attempts ?? [])
    if (!attempts?.length) return

    // 2. Resource + chunk + unit + module metadata
    const resourceIds = [...new Set(attempts.map(a => a.resource_id))]
    const { data: resources, error: rErr } = await supabase
      .from('resources')
      .select('id, title, chunk_resources(chunk_id, chunks(id, title, unit_id, units(id, module_id, modules(id, title, course_id))))')
      .in('id', resourceIds)
    if (rErr) throw rErr

    const meta = {}
    const moduleMap = {}
    ;(resources ?? []).forEach(res => {
      // A resource can be linked to multiple chunks; take the first
      const cr = res.chunk_resources?.[0]
      const chunk  = cr?.chunks
      const unit   = chunk?.units
      const module = unit?.modules

      meta[res.id] = {
        title:       res.title,
        chunkId:     chunk?.id   ?? null,
        chunkTitle:  chunk?.title ?? null,
        unitId:      unit?.id    ?? null,
        moduleId:    module?.id  ?? null,
        moduleTitle: module?.title ?? 'Unassigned',
        courseId:    module?.course_id ?? null,
      }
      if (module) moduleMap[module.id] = { id: module.id, title: module.title }
    })
    setResourceMeta(meta)

    // 3. Module order (by course then module order_index)
    const moduleIds = Object.keys(moduleMap)
    if (moduleIds.length) {
      const { data: modules } = await supabase
        .from('modules')
        .select('id, title, order_index, course_id')
        .in('id', moduleIds)
        .order('course_id')
        .order('order_index')
      setModuleOrder(modules ?? [])
    }
  }

  async function loadTimelineData() {
    const { data: attempts, error: aErr } = await supabase
      .from('timeline_attempts')
      .select('timeline_id, parent_type, parent_id, mode, percent, attempted_at')
      .eq('user_id', user.id)
      .order('attempted_at', { ascending: false })
    if (aErr) throw aErr

    setTimelineAttempts(attempts ?? [])
    if (!attempts?.length) return

    // Fetch titles for custom timelines
    const customIds = [...new Set(
      attempts.filter(a => a.timeline_id).map(a => a.timeline_id)
    )]
    if (customIds.length) {
      const { data: timelines } = await supabase
        .from('timelines')
        .select('id, title')
        .in('id', customIds)
      const meta = {}
      ;(timelines ?? []).forEach(t => { meta[t.id] = { title: t.title } })
      setTimelineMeta(meta)
    }
  }

  // ── Derived data: quizzes ──────────────────────────────────────

  // Build per-resource best/attempts/last
  const quizSummary = (() => {
    const map = {}  // resourceId → { attempts, best, lastAt }
    quizAttempts.forEach(a => {
      const prev = map[a.resource_id]
      if (!prev) {
        map[a.resource_id] = { attempts: 1, best: a.percent, lastAt: a.attempted_at }
      } else {
        prev.attempts++
        if (a.percent > prev.best) prev.best = a.percent
        // lastAt is already the most recent since we ordered desc
      }
    })
    return map
  })()

  // Group quiz rows by module
  const quizRowsByModule = (() => {
    const byModule = {}
    Object.entries(quizSummary).forEach(([resId, stats]) => {
      const meta   = resourceMeta[resId]
      const modId  = meta?.moduleId ?? 'unknown'
      if (!byModule[modId]) byModule[modId] = []
      byModule[modId].push({
        resourceId: resId,
        title:      meta?.title ?? 'Unknown quiz',
        chunkTitle: meta?.chunkTitle ?? null,
        chunkId:    meta?.chunkId,
        unitId:     meta?.unitId,
        ...stats,
      })
    })
    // Sort each module's rows: not-yet-attempted first, then by score asc (weakest first)
    Object.values(byModule).forEach(rows => {
      rows.sort((a, b) => {
        if (a.best == null && b.best == null) return 0
        if (a.best == null) return -1
        if (b.best == null) return 1
        return a.best - b.best
      })
    })
    return byModule
  })()

  // Overall quiz stats
  const totalQuizzes  = Object.keys(quizSummary).length
  const totalAttempts = quizAttempts.length
  const allBests      = Object.values(quizSummary).map(s => s.best).filter(v => v != null)
  const overallAvg    = avg(allBests)
  const highCount     = allBests.filter(p => p >= 80).length

  // ── Derived data: timelines ────────────────────────────────────

  const timelineSummary = (() => {
    const map = {}  // key → { title, mode→best, attempts, lastAt }
    timelineAttempts.forEach(a => {
      const key = a.timeline_id
        ? `custom:${a.timeline_id}`
        : `${a.parent_type}:${a.parent_id}`
      if (!map[key]) {
        const title = a.timeline_id
          ? (timelineMeta[a.timeline_id]?.title ?? 'Timeline')
          : `${a.parent_type?.charAt(0).toUpperCase()}${a.parent_type?.slice(1) ?? ''} timeline`
        map[key] = { title, attempts: 0, modes: {}, lastAt: a.attempted_at }
      }
      map[key].attempts++
      const prev = map[key].modes[a.mode]
      if (prev == null || a.percent > prev) map[key].modes[a.mode] = a.percent
    })
    return map
  })()

  const totalTimelineAttempts = timelineAttempts.length
  const allTimelineBests = Object.values(timelineSummary).flatMap(s =>
    Object.values(s.modes)
  )
  const timelineAvg = avg(allTimelineBests)

  // ── Not logged in ──────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────

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

      {/* ── Summary stat strip ── */}
      <div className="pd-stat-strip">
        <StatCard icon="❓" value={totalQuizzes}  label="Quizzes attempted" />
        <StatCard icon="🔁" value={totalAttempts} label="Total quiz attempts" />
        <StatCard
          icon="📊"
          value={overallAvg != null ? `${overallAvg}%` : '—'}
          label="Average best score"
        />
        <StatCard icon="🏆" value={highCount} label="Scored 80%+" />
        <StatCard
          icon="📅"
          value={totalTimelineAttempts}
          label="Timeline attempts"
          sub={timelineAvg != null ? `${timelineAvg}% avg` : null}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="page-tabs">
        <button
          className={`page-tab ${activeTab === 'quizzes' ? 'page-tab-active' : ''}`}
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
              {/* Score distribution bar */}
              <div className="pd-distribution">
                <h2 className="pd-section-title">Score distribution</h2>
                <div className="pd-dist-bars">
                  {[
                    { label: '80–100%', cls: 'high', count: allBests.filter(p => p >= 80).length },
                    { label: '50–79%',  cls: 'mid',  count: allBests.filter(p => p >= 50 && p < 80).length },
                    { label: '0–49%',   cls: 'low',  count: allBests.filter(p => p < 50).length },
                    { label: 'Not yet', cls: 'none', count: totalQuizzes - allBests.length },
                  ].map(band => (
                    <div key={band.label} className="pd-dist-band">
                      <div className="pd-dist-bar-wrap">
                        <div
                          className={`pd-dist-bar pd-dist-bar-${band.cls}`}
                          style={{ height: `${totalQuizzes > 0 ? Math.round((band.count / totalQuizzes) * 100) : 0}%` }}
                        />
                      </div>
                      <span className={`pd-dist-count pd-dist-count-${band.cls}`}>{band.count}</span>
                      <span className="pd-dist-label">{band.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-module quiz breakdown */}
              <div className="pd-modules">
                <h2 className="pd-section-title">By module</h2>
                {moduleOrder.length > 0
                  ? moduleOrder
                      .filter(m => quizRowsByModule[m.id]?.length)
                      .map(m => (
                        <ModuleSection
                          key={m.id}
                          module={m}
                          quizRows={quizRowsByModule[m.id] ?? []}
                          onNavigate={row => {
                            if (row.chunkId) navigate(`/chunks/${row.unitId}`)
                          }}
                        />
                      ))
                  : Object.entries(quizRowsByModule).map(([modId, rows]) => (
                      <ModuleSection
                        key={modId}
                        module={{ id: modId, title: resourceMeta[rows[0]?.resourceId]?.moduleTitle ?? 'Module' }}
                        quizRows={rows}
                        onNavigate={row => {
                          if (row.chunkId) navigate(`/chunks/${row.unitId}`)
                        }}
                      />
                    ))
                }
                {/* Unassigned */}
                {quizRowsByModule['unknown']?.length > 0 && (
                  <ModuleSection
                    module={{ id: 'unknown', title: 'Unassigned' }}
                    quizRows={quizRowsByModule['unknown']}
                    onNavigate={() => {}}
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
          {totalTimelineAttempts === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p>You haven't attempted any timelines yet.</p>
            </div>
          ) : (
            <div className="pd-timeline-list">
              <h2 className="pd-section-title">Timeline scores</h2>
              {Object.entries(timelineSummary).map(([key, s]) => {
                const dateBest  = s.modes['date']  ?? null
                const matchBest = s.modes['match'] ?? null
                const bestOverall = [dateBest, matchBest].filter(v => v != null)
                const top = bestOverall.length ? Math.max(...bestOverall) : null
                return (
                  <div key={key} className="pd-timeline-row">
                    <div className="pd-timeline-row-info">
                      <span className="pd-timeline-row-title">{s.title}</span>
                      <span className="pd-timeline-row-attempts">
                        {s.attempts} {s.attempts === 1 ? 'attempt' : 'attempts'} · last {formatDate(s.lastAt)}
                      </span>
                    </div>
                    <div className="pd-timeline-row-scores">
                      {dateBest != null && (
                        <div className="pd-timeline-mode">
                          <span className="pd-timeline-mode-label">Date</span>
                          <MasteryBar pct={dateBest} />
                        </div>
                      )}
                      {matchBest != null && (
                        <div className="pd-timeline-mode">
                          <span className="pd-timeline-mode-label">Match</span>
                          <MasteryBar pct={matchBest} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
