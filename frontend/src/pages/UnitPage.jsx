import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import { useMastery, MasteryPip, getMasteryClass } from '../hooks/useMastery'
import { useAuth } from '../context/AuthContext'
import { useResourceProgress } from '../hooks/useResourceProgress'
import FlashcardTabContent from '../components/FlashcardTabContent'
import TimelineTabContent from '../components/TimelineTabContent'
import SourceTabContent from '../components/SourceTabContent'

/**
 * WeightedProgressPip
 * A single pip with a tooltip explaining the weighted score breakdown.
 */
function WeightedProgressPip({ score, contentPct, quizPct, timelinePct, hasTimeline }) {
  const [hover, setHover] = useState(false)

  // Grey if nothing attempted at all; colour only once there's real activity
  const hasActivity = contentPct != null || quizPct != null || (hasTimeline && timelinePct != null)
  const cls = !hasActivity || score == null ? 'unattempted'
    : score >= 80 ? 'high'
    : score >= 40 ? 'mid'
    : 'low'

  const lines = []
  if (contentPct  != null)               lines.push(`Content: ${contentPct}%`)
  if (quizPct     != null)               lines.push(`Quizzes: ${quizPct}%`)
  if (hasTimeline && timelinePct != null) lines.push(`Timeline: ${timelinePct}%`)
  if (hasActivity && score != null)      lines.push(`Overall: ${score}%`)

  return (
    <span
      className="weighted-pip-wrap"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className={`mastery-pip mastery-pip-${cls}`} />
      {hover && (
        <span className="pip-tooltip pip-tooltip-stacked">
          {lines.length > 0
            ? lines.map((l, i) => <span key={i} className="pip-tooltip-line">{l}</span>)
            : <span className="pip-tooltip-line">Not started</span>
          }
        </span>
      )}
    </span>
  )
}

/**
 * ProgressLegend — explains weighted pip colours
 */
function ProgressLegend() {
  const [hover, setHover] = useState(false)
  return (
    <span
      className="engagement-legend-trigger"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      ⓘ
      {hover && (
        <span className="pip-tooltip pip-tooltip-legend">
          <span className="pip-legend-title">Progress pips (per chunk)</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-high" />≥80% weighted score</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-mid" />40–79% weighted score</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-low" />&lt;40% weighted score</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-unattempted" />Not started</span>
        </span>
      )}
    </span>
  )
}

/**
 * MasteryStats — "X/Y quizzes · Z% avg"
 */
function MasteryStats({ attempted, total, avg }) {
  if (total === 0) return null
  const cls = attempted > 0 ? getMasteryClass(avg) : ''
  return (
    <div className="card-mastery-stats">
      <span className="mastery-stats-count">{attempted}/{total} quizzes</span>
      {attempted > 0 && (
        <span className={`mastery-stats-avg mastery-${cls}`}>{avg}% avg</span>
      )}
    </div>
  )
}

export default function UnitPage() {
  const { moduleId } = useParams()
  const [module, setModule]     = useState(null)
  const [course, setCourse]     = useState(null)
  const [units, setUnits]       = useState([])
  const [chunkCounts, setChunkCounts] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeTab, setActiveTab] = useState('units')

  const [moduleChunkIds, setModuleChunkIds] = useState(null)
  const [loadingChunkIds, setLoadingChunkIds] = useState(false)

  // { unitId -> [{ chunkId, chunkOrder, resourceId, resourceType }] }
  const [unitResourceMap, setUnitResourceMap] = useState({})
  // Set of chunk IDs that have timeline content
  const [chunkTimelineSet, setChunkTimelineSet] = useState(new Set())

  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('id, title, course_id, courses(id, title, description)')
        .eq('id', moduleId)
        .single()
      if (moduleError) { setError(moduleError.message); setLoading(false); return }
      setModule(moduleData)
      setCourse(moduleData.courses)

      const { data: unitsData, error: unitsError } = await supabase
        .from('units').select('*').eq('module_id', moduleId).eq('archived', false).order('order_index')
      if (unitsError) { setError(unitsError.message); setLoading(false); return }
      setUnits(unitsData)

      if (unitsData.length > 0) {
        const unitIds = unitsData.map(u => u.id)

        const { data: countData } = await supabase
          .from('chunks').select('unit_id').eq('archived', false).in('unit_id', unitIds)
        if (countData) {
          const counts = {}
          countData.forEach(row => { counts[row.unit_id] = (counts[row.unit_id] || 0) + 1 })
          setChunkCounts(counts)
        }

        const { data: chunksData } = await supabase
          .from('chunks').select('id, unit_id, order_index').eq('archived', false).in('unit_id', unitIds).order('order_index')

        if (chunksData && chunksData.length > 0) {
          const chunkIds = chunksData.map(c => c.id)

          const [{ data: crData }, { data: ctData }, { data: cgData }] = await Promise.all([
            supabase.from('chunk_resources').select('chunk_id, resources(id, type)').in('chunk_id', chunkIds),
            supabase.from('chunk_timelines').select('chunk_id').in('chunk_id', chunkIds),
            supabase.from('chunk_glossary').select('chunk_id, glossary_terms(date)').in('chunk_id', chunkIds),
          ])

          const chunkToUnit = {}
          const chunkOrderMap = {}
          chunksData.forEach(c => { chunkToUnit[c.id] = c.unit_id; chunkOrderMap[c.id] = c.order_index ?? 0 })

          // Build resource map: quiz + trackable (video/pdf)
          const resMap = {}
          unitsData.forEach(u => { resMap[u.id] = [] })
          ;(crData ?? []).forEach(row => {
            const t = row.resources?.type?.toLowerCase()
            if (t === 'quiz' || t === 'video' || t === 'pdf') {
              const unitId = chunkToUnit[row.chunk_id]
              if (unitId) resMap[unitId].push({
                chunkId:      row.chunk_id,
                chunkOrder:   chunkOrderMap[row.chunk_id] ?? 0,
                resourceId:   row.resources.id,
                resourceType: t,
              })
            }
          })
          setUnitResourceMap(resMap)

          // Timeline presence
          const withTimelines = new Set([
            ...(ctData ?? []).map(r => r.chunk_id),
            ...(cgData ?? []).filter(r => r.glossary_terms?.date).map(r => r.chunk_id),
          ])
          setChunkTimelineSet(withTimelines)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [moduleId])

  // All resource IDs for progress tracking
  const allResourceIds = Object.values(unitResourceMap).flat().map(r => r.resourceId)
  const { completed: completedResources } = useResourceProgress(user ? allResourceIds : [])

  // Mastery: quiz scores + unit timeline keys
  const allQuizIds     = Object.values(unitResourceMap).flat().filter(r => r.resourceType === 'quiz').map(r => r.resourceId)
  const unitMasterKeys = units.map(u => `unit:${u.id}`)
  // Also fetch chunk-level timeline keys so per-chunk tooltip shows timeline %
  const allChunkIds    = Object.values(unitResourceMap).flat().map(r => r.chunkId)
  const chunkMasterKeys = [...new Set(allChunkIds)].map(id => `chunk:${id}`)
  const allTimelineKeys = [...unitMasterKeys, ...chunkMasterKeys]
  const { quizBest, timelineBest } = useMastery({
    resourceIds:        user && allQuizIds.length > 0 ? allQuizIds : [],
    masterTimelineKeys: user && allTimelineKeys.length > 0 ? allTimelineKeys : [],
  })

  async function handleFlashcardTabOpen(tab = 'flashcards') {
    setActiveTab(tab)
    if (moduleChunkIds !== null) return
    setLoadingChunkIds(true)
    const { data } = await supabase
      .from('chunks').select('id').eq('archived', false).in('unit_id', units.map(u => u.id))
    setModuleChunkIds((data ?? []).map(c => c.id))
    setLoadingChunkIds(false)
  }

  if (loading) return <div className="page"><div className="loading-pulse">Loading units…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  return (
    <div className="page">
      <Breadcrumb items={[
        { label: 'Courses', to: '/' },
        { label: course?.title ?? 'Course', to: `/modules/${course?.id}` },
        { label: module?.title ?? 'Module' },
      ]} />

      <div className="page-header">
        <div>
          <div className="page-level-label">Module</div>
          <h1>{module?.title}</h1>
          <p className="page-subtitle">Part of <strong>{course?.title}</strong></p>
        </div>
        <div className="page-header-meta">
          <div className="page-header-meta-badges">
            <span className="meta-badge">{units.length} {units.length === 1 ? 'unit' : 'units'}</span>
          </div>
        </div>
      </div>

      <div className="page-tabs">
        <button className={`page-tab ${activeTab === 'units' ? 'page-tab-active' : ''}`} onClick={() => setActiveTab('units')}>
          📄 Units
        </button>
        <button className={`page-tab ${activeTab === 'flashcards' ? 'page-tab-active' : ''}`} onClick={() => handleFlashcardTabOpen()}>
          🃏 Flashcards
        </button>
        <button className={`page-tab ${activeTab === 'timelines' ? 'page-tab-active' : ''}`} onClick={() => handleFlashcardTabOpen('timelines')}>
          📅 Timelines
        </button>
        <button className={`page-tab ${activeTab === 'sources' ? 'page-tab-active' : ''}`} onClick={() => setActiveTab('sources')}>
          📜 Sources
        </button>
      </div>

      {activeTab === 'units' && (
        units.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p>No units have been added to this module yet.</p>
          </div>
        ) : (
          <ul className="card-grid">
            {units.map((unit, index) => {
              const chunkCount = chunkCounts[unit.id] ?? 0
              const unitKey    = `unit:${unit.id}`
              const entries    = unitResourceMap[unit.id] ?? []

              // Separate by type
              const quizEntries     = entries.filter(r => r.resourceType === 'quiz')
              const contentEntries  = entries.filter(r => r.resourceType === 'video' || r.resourceType === 'pdf')

              // Quiz stats
              const totalQuizzes = quizEntries.length
              const attempted    = quizEntries.filter(q => quizBest?.[q.resourceId] != null).length
              const scores       = quizEntries.map(q => quizBest?.[q.resourceId]?.bestPercent).filter(p => p != null)
              const avgScore     = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

              // Timeline mastery
              const tlModes = timelineBest?.[unitKey]
              const tlPct   = tlModes ? Math.max(...Object.values(tlModes).filter(v => v != null)) : null

              // Per-chunk weighted progress pip (Option B)
              const chunkIds = [...new Map(entries.map(q => [q.chunkId, q.chunkOrder])).entries()]
                .sort((a, b) => a[1] - b[1]).map(([id]) => id)

              const chunkPips = chunkIds.map(cid => {
                const hasTimeline = chunkTimelineSet.has(cid)
                const chunkQuizzes  = quizEntries.filter(r => r.chunkId === cid)
                const chunkContent  = contentEntries.filter(r => r.chunkId === cid)

                // Content %
                const contentDone = chunkContent.filter(r => completedResources?.[r.resourceId]).length
                const contentPct  = chunkContent.length > 0 ? Math.round((contentDone / chunkContent.length) * 100) : null

                // Quiz %: average best score
                const quizScores = chunkQuizzes.map(r => quizBest?.[r.resourceId]?.bestPercent).filter(p => p != null)
                const quizPct    = quizScores.length > 0 ? Math.round(quizScores.reduce((a,b) => a+b,0) / quizScores.length) : null

                // Timeline %: prefer chunk-level attempts, fall back to unit-level
                const chunkTlModes = timelineBest?.[`chunk:${cid}`]
                const chunkTlPct   = chunkTlModes ? Math.max(...Object.values(chunkTlModes).filter(v => v != null)) : null
                const timelinePct  = chunkTlPct ?? tlPct

                // Weighted score — only weight dimensions that exist for this chunk
                const dimensions = []
                if (chunkContent.length > 0) dimensions.push({ pct: contentPct ?? 0, weight: 1 })
                if (chunkQuizzes.length > 0)  dimensions.push({ pct: quizPct    ?? 0, weight: 1 })
                if (hasTimeline)               dimensions.push({ pct: timelinePct ?? 0, weight: 1 })

                const hasAny = contentPct != null || quizPct != null || (hasTimeline && timelinePct != null)
                const score  = dimensions.length > 0 && hasAny
                  ? Math.round(dimensions.reduce((s, d) => s + d.pct, 0) / dimensions.length)
                  : null

                return { id: cid, score, contentPct, quizPct, timelinePct: hasTimeline ? timelinePct : null, hasTimeline }
              })

              const hasProgress = chunkPips.some(p => p.score != null)

              return (
                <li key={unit.id}>
                  <button
                    className="hierarchy-card unit-card"
                    style={{ '--card-index': index }}
                    onClick={() => navigate(`/chunks/${unit.id}`)}
                  >
                    <div className="card-index-number">{String(index + 1).padStart(2, '0')}</div>
                    <div className="card-level-tag">Unit</div>
                    <h2 className="card-title">{unit.title}</h2>

                    {user && (hasProgress || totalQuizzes > 0) && (
                      <div className="card-mastery">
                        {chunkPips.length > 0 && (
                          <div className="mastery-pip-row">
                            <span className="mastery-pip-label">Progress</span>
                            <div className="mastery-pips">
                              {chunkPips.map(p => (
                                <WeightedProgressPip
                                  key={p.id}
                                  score={p.score}
                                  contentPct={p.contentPct}
                                  quizPct={p.quizPct}
                                  timelinePct={p.timelinePct}
                                  hasTimeline={p.hasTimeline}
                                />
                              ))}
                            </div>
                            <ProgressLegend />
                          </div>
                        )}
                        {totalQuizzes > 0 && (
                          <MasteryStats attempted={attempted} total={totalQuizzes} avg={avgScore} />
                        )}
                      </div>
                    )}

                    <div className="card-footer">
                      <span className="card-count">{chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}</span>
                      <span className="card-arrow">→</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )
      )}

      {activeTab === 'flashcards' && (
        loadingChunkIds
          ? <div className="loading-pulse">Loading flashcards…</div>
          : <FlashcardTabContent
              chunkIds={moduleChunkIds ?? []}
              unitIds={units.map(u => u.id)}
              moduleIds={module ? [module.id] : []}
            />
      )}

      {activeTab === 'timelines' && (
        loadingChunkIds
          ? <div className="loading-pulse">Loading timeline…</div>
          : <TimelineTabContent
              chunkIds={moduleChunkIds ?? []}
              unitIds={units.map(u => u.id)}
              moduleIds={module ? [module.id] : []}
              parentType="module"
              parentId={module?.id}
              allParents={[
                ...(moduleChunkIds ?? []).map(id => ({ type: 'chunk', id })),
                ...units.map(u => ({ type: 'unit', id: u.id })),
                ...(module ? [{ type: 'module', id: module.id }] : []),
              ]}
            />
      )}

      {activeTab === 'sources' && (
        <SourceTabContent moduleId={moduleId} />
      )}
    </div>
  )
}
