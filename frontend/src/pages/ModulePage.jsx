import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import { useMastery, MasteryPipRow, getMasteryClass } from '../hooks/useMastery'
import { useAuth } from '../context/AuthContext'

/**
 * MasteryStats — "X/Y attempted · Z% avg"
 */
function MasteryStats({ attempted, total, avg }) {
  if (total === 0) return null
  const cls = attempted > 0 ? getMasteryClass(avg) : ''
  return (
    <div className="card-mastery-stats">
      <span className="mastery-stats-count">{attempted}/{total} attempted</span>
      {attempted > 0 && (
        <span className={`mastery-stats-avg mastery-${cls}`}>{avg}% avg</span>
      )}
    </div>
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

  // Quiz resource data: { moduleId -> [{ unitId, chunkId, resourceId }] }
  const [moduleQuizMap, setModuleQuizMap] = useState({})

  useEffect(() => {
    async function fetchData() {
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id, title, description')
        .eq('archived', false)
        .eq('id', courseId)
        .single()
      if (courseError) { setError(courseError.message); setLoading(false); return }
      setCourse(courseData)

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules').select('*').eq('course_id', courseId).order('order_index')
      if (modulesError) { setError(modulesError.message); setLoading(false); return }
      setModules(modulesData)

      if (modulesData.length > 0) {
        const moduleIds = modulesData.map(m => m.id)

        // Unit counts
        const { data: unitCountData } = await supabase
          .from('units').select('module_id').eq('archived', false).in('module_id', moduleIds)
        if (unitCountData) {
          const counts = {}
          unitCountData.forEach(row => { counts[row.module_id] = (counts[row.module_id] || 0) + 1 })
          setUnitCounts(counts)
        }

        // Fetch all units -> chunks -> quiz resources in one pass
        const { data: unitsData } = await supabase
          .from('units').select('id, module_id, order_index').eq('archived', false).in('module_id', moduleIds).order('order_index')

        if (unitsData && unitsData.length > 0) {
          const unitIds = unitsData.map(u => u.id)
          const { data: chunksData } = await supabase
            .from('chunks').select('id, unit_id, order_index').eq('archived', false).in('unit_id', unitIds).order('order_index')

          if (chunksData && chunksData.length > 0) {
            const chunkIds = chunksData.map(c => c.id)
            const { data: crData } = await supabase
              .from('chunk_resources')
              .select('chunk_id, resources(id, type)')
              .in('chunk_id', chunkIds)

            // Build lookup maps
            const chunkToUnit = {}
            chunksData.forEach(c => { chunkToUnit[c.id] = c.unit_id })
            const unitToModule = {}
            const unitOrderMap = {}
            unitsData.forEach(u => { unitToModule[u.id] = u.module_id; unitOrderMap[u.id] = u.order_index ?? 0 })

            const quizMap = {}
            modulesData.forEach(m => { quizMap[m.id] = [] })
            ;(crData ?? []).forEach(row => {
              if (row.resources?.type?.toLowerCase() === 'quiz') {
                const unitId   = chunkToUnit[row.chunk_id]
                const moduleId = unitToModule[unitId]
                if (moduleId) quizMap[moduleId].push({
                  unitId,
                  unitOrder:  unitOrderMap[unitId] ?? 0,
                  chunkId:    row.chunk_id,
                  resourceId: row.resources.id,
                })
              }
            })
            setModuleQuizMap(quizMap)
          }
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [courseId])

  // Mastery: all quiz resource IDs + module-level timeline keys
  const allQuizIds      = Object.values(moduleQuizMap).flat().map(q => q.resourceId)
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

            // Quiz mastery stats for this module
            const quizEntries  = moduleQuizMap[mod.id] ?? []
            const totalQuizzes = quizEntries.length
            const attempted    = quizEntries.filter(q => quizBest?.[q.resourceId] != null).length
            const scores       = quizEntries.map(q => quizBest?.[q.resourceId]?.bestPercent).filter(p => p != null)
            const avgScore     = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

            // Per-unit pip: average best quiz score across all quizzes in that unit
            const unitIds = [...new Map(quizEntries.map(q => [q.unitId, q.unitOrder])).entries()]
              .sort((a, b) => a[1] - b[1]).map(([id]) => id)
            const unitPips = unitIds.map(uid => {
              const unitScores = quizEntries
                .filter(q => q.unitId === uid)
                .map(q => quizBest?.[q.resourceId]?.bestPercent)
                .filter(p => p != null)
              const pct = unitScores.length > 0
                ? Math.round(unitScores.reduce((a, b) => a + b, 0) / unitScores.length)
                : null
              return { id: uid, label: 'Unit', percent: pct }
            })

            // Timeline mastery
            const tlModes = timelineBest?.[modKey]
            const tlPct   = tlModes ? Math.max(...Object.values(tlModes).filter(v => v != null)) : null

            return (
              <li key={mod.id}>
                <button
                  className="hierarchy-card module-card"
                  style={{ '--card-index': index }}
                  onClick={() => navigate(`/units/${mod.id}`)}
                >
                  <div className="card-level-tag">Module</div>
                  <h2 className="card-title">{mod.title}</h2>

                  {user && (totalQuizzes > 0 || tlPct != null) && (
                    <div className="card-mastery">
                      {totalQuizzes > 0 && (
                        <>
                          <MasteryPipRow label="Quizzes" items={unitPips} />
                          <MasteryStats attempted={attempted} total={totalQuizzes} avg={avgScore} />
                        </>
                      )}
                      {tlPct != null && (
                        <MasteryPipRow label="Timelines" items={[{ id: modKey, label: 'Timeline', percent: tlPct }]} />
                      )}
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
