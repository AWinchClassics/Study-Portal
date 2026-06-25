import { useEffect, useState, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import { useMastery } from '../hooks/useMastery'
import { useAuth } from '../context/AuthContext'
import { useResourceProgress } from '../hooks/useResourceProgress'

/**
 * EngagementPip — Option D: green/amber/grey with tooltip explaining tiers
 */
function EngagementPip({ tier, label }) {
  const [hover, setHover] = useState(false)
  const cls = tier === 'complete' ? 'high' : tier === 'partial' ? 'mid' : 'unattempted'

  // Parse label into lines: "Content: done · Quizzes: incomplete" -> array
  const lines = label.split(' · ')

  return (
    <span
      className="weighted-pip-wrap"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className={`mastery-pip mastery-pip-${cls}`} />
      {hover && (
        <span className="pip-tooltip pip-tooltip-stacked">
          {lines.map((line, i) => <span key={i} className="pip-tooltip-line">{line}</span>)}
        </span>
      )}
    </span>
  )
}

/**
 * EngagementLegend — portal-based tooltip that escapes card stacking contexts
 */
function EngagementLegend() {
  const [rect, setRect] = useState(null)
  const triggerRef = useRef(null)

  function handleEnter() {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }
  function handleLeave() { setRect(null) }

  return (
    <>
      <span
        ref={triggerRef}
        className="engagement-legend-trigger"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >ⓘ</span>
      {rect && ReactDOM.createPortal(
        <span className="pip-tooltip-legend pip-tooltip-portal" style={{
          position: 'fixed',
          top: rect.top - 8,
          left: rect.left,
          transform: 'translateY(-100%)',
        }}>
          <span className="pip-legend-title">Progress pips (per unit)</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-high" />Complete — all content, quizzes &amp; timeline done</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-mid" />In progress — some activity recorded</span>
          <span className="pip-legend-row"><span className="pip-legend-dot mastery-pip mastery-pip-unattempted" />Not started</span>
        </span>,
        document.body
      )}
    </>
  )
}

export default function ModulePage() {
  const { courseId } = useParams()
  const [course, setCourse]   = useState(null)
  const [modules, setModules] = useState([])
  const [unitCounts, setUnitCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  // { moduleId -> [{ unitId, unitOrder, chunkId, resourceId, resourceType }] }
  const [moduleResourceMap, setModuleResourceMap] = useState({})
  // Set of chunk IDs with timeline content
  const [chunkTimelineSet, setChunkTimelineSet] = useState(new Set())
  // { moduleId -> { unitId -> [chunkId] } } — for tier calculation
  const [moduleUnitChunkMap, setModuleUnitChunkMap] = useState({})

  useEffect(() => {
    async function fetchData() {
      const { data: courseData, error: courseError } = await supabase
        .from('courses').select('id, title, description').eq('archived', false).eq('id', courseId).single()
      if (courseError) { setError(courseError.message); setLoading(false); return }
      setCourse(courseData)

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules').select('*').eq('course_id', courseId).order('order_index')
      if (modulesError) { setError(modulesError.message); setLoading(false); return }
      setModules(modulesData)

      if (modulesData.length > 0) {
        const moduleIds = modulesData.map(m => m.id)

        const { data: unitCountData } = await supabase
          .from('units').select('module_id').eq('archived', false).in('module_id', moduleIds)
        if (unitCountData) {
          const counts = {}
          unitCountData.forEach(row => { counts[row.module_id] = (counts[row.module_id] || 0) + 1 })
          setUnitCounts(counts)
        }

        const { data: unitsData } = await supabase
          .from('units').select('id, module_id, order_index').eq('archived', false).in('module_id', moduleIds).order('order_index')

        if (unitsData && unitsData.length > 0) {
          const unitIds = unitsData.map(u => u.id)
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
            chunksData.forEach(c => { chunkToUnit[c.id] = c.unit_id })
            const unitToModule = {}
            const unitOrderMap = {}
            unitsData.forEach(u => { unitToModule[u.id] = u.module_id; unitOrderMap[u.id] = u.order_index ?? 0 })

            // Resource map
            const resMap = {}
            modulesData.forEach(m => { resMap[m.id] = [] })
            ;(crData ?? []).forEach(row => {
              const t = row.resources?.type?.toLowerCase()
              if (t === 'quiz' || t === 'video' || t === 'pdf') {
                const unitId   = chunkToUnit[row.chunk_id]
                const moduleId = unitToModule[unitId]
                if (moduleId) resMap[moduleId].push({
                  unitId, unitOrder: unitOrderMap[unitId] ?? 0,
                  chunkId: row.chunk_id, resourceId: row.resources.id, resourceType: t,
                })
              }
            })
            setModuleResourceMap(resMap)

            // Unit->chunks map per module (for tier calc)
            const ucMap = {}
            modulesData.forEach(m => { ucMap[m.id] = {} })
            chunksData.forEach(c => {
              const uid = c.unit_id
              const mid = unitToModule[uid]
              if (mid) {
                if (!ucMap[mid][uid]) ucMap[mid][uid] = []
                ucMap[mid][uid].push(c.id)
              }
            })
            setModuleUnitChunkMap(ucMap)

            // Timeline presence
            const withTimelines = new Set([
              ...(ctData ?? []).map(r => r.chunk_id),
              ...(cgData ?? []).filter(r => r.glossary_terms?.date).map(r => r.chunk_id),
            ])
            setChunkTimelineSet(withTimelines)
          }
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [courseId])

  const allResourceIds  = Object.values(moduleResourceMap).flat().map(r => r.resourceId)
  const { completed: completedResources } = useResourceProgress(user ? allResourceIds : [])

  const allQuizIds       = Object.values(moduleResourceMap).flat().filter(r => r.resourceType === 'quiz').map(r => r.resourceId)
  const moduleMasterKeys = modules.map(m => `module:${m.id}`)
  const { quizBest, timelineBest } = useMastery({
    resourceIds:        user && allQuizIds.length > 0 ? allQuizIds : [],
    masterTimelineKeys: user && moduleMasterKeys.length > 0 ? moduleMasterKeys : [],
  })

  if (loading) return <div className="page"><div className="loading-pulse">Loading modules…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  return (
    <div className="page">
      <Breadcrumb items={[
        { label: 'Courses', to: '/' },
        { label: course?.title ?? 'Course' },
      ]} />

      <div className="page-header">
        <div>
          <div className="page-level-label">Course</div>
          <h1>{course?.title}</h1>
          {course?.description && <p className="page-subtitle">{course.description}</p>}
        </div>
        <div className="page-header-meta">
          <div className="page-header-meta-badges">
            <span className="meta-badge">{modules.length} {modules.length === 1 ? 'module' : 'modules'}</span>
          </div>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <p>No modules have been added to this course yet.</p>
        </div>
      ) : (
        <ul className="card-grid">
          {modules.map((mod, index) => {
            const unitCount = unitCounts[mod.id] ?? 0
            const modKey    = `module:${mod.id}`
            const entries   = moduleResourceMap[mod.id] ?? []
            const unitChunkMap = moduleUnitChunkMap[mod.id] ?? {}

            // Unit IDs in order
            const unitIds = [...new Map(entries.map(e => [e.unitId, e.unitOrder])).entries()]
              .sort((a, b) => a[1] - b[1]).map(([id]) => id)

            // Timeline mastery (module-level)
            const tlModes = timelineBest?.[modKey]
            const tlPct   = tlModes ? Math.max(...Object.values(tlModes).filter(v => v != null)) : null

            // Option D: engagement tier per unit
            const unitPips = unitIds.map(uid => {
              const chunkIds      = unitChunkMap[uid] ?? []
              const unitEntries   = entries.filter(e => e.unitId === uid)
              const quizEntries   = unitEntries.filter(e => e.resourceType === 'quiz')
              const contentEntries = unitEntries.filter(e => e.resourceType === 'video' || e.resourceType === 'pdf')

              // What signals does this unit have?
              const hasContent  = contentEntries.length > 0
              const hasQuizzes  = quizEntries.length > 0
              const hasTimeline = chunkIds.some(cid => chunkTimelineSet.has(cid))

              // What's done?
              const contentDone   = hasContent  ? contentEntries.every(r => completedResources?.[r.resourceId]) : null
              const quizzesDone   = hasQuizzes  ? quizEntries.every(r => quizBest?.[r.resourceId] != null) : null
              const timelineDone  = hasTimeline ? tlPct != null : null

              // Complete = all present signals are done
              const signals = [contentDone, quizzesDone, timelineDone].filter(s => s !== null)
              const anyDone = signals.some(s => s === true)
              const allDone = signals.length > 0 && signals.every(s => s === true)

              const tier = allDone ? 'complete' : anyDone ? 'partial' : 'untouched'

              // Label for tooltip
              const parts = []
              if (hasContent)  parts.push(`Content: ${contentDone  ? 'done' : 'incomplete'}`)
              if (hasQuizzes)  parts.push(`Quizzes: ${quizzesDone  ? 'done' : 'incomplete'}`)
              if (hasTimeline) parts.push(`Timeline: ${timelineDone ? 'done' : 'incomplete'}`)
              const label = parts.join(' · ') || 'No trackable content'

              return { id: uid, tier, label }
            })

            const hasAnyProgress = unitPips.some(p => p.tier !== 'untouched')
            const showPips = user && unitPips.length > 0

            return (
              <li key={mod.id}>
                <button
                  className="hierarchy-card module-card"
                  style={{ '--card-index': index }}
                  onClick={() => navigate(`/units/${mod.id}`)}
                >
                  <div className="card-level-tag">Module</div>
                  <h2 className="card-title">{mod.title}</h2>

                  {showPips && (
                    <div className="card-mastery">
                      <div className="mastery-pip-row">
                        <span className="mastery-pip-label">Progress</span>
                        <div className="mastery-pips">
                          {unitPips.map(p => (
                            <EngagementPip key={p.id} tier={p.tier} label={p.label} />
                          ))}
                        </div>
                        <EngagementLegend />
                      </div>
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="card-count">{unitCount} {unitCount === 1 ? 'unit' : 'units'}</span>
                    <span className="card-arrow">→</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
