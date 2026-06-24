import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import { useMastery, MasteryPipRow, getMasteryClass } from '../hooks/useMastery'
import { useAuth } from '../context/AuthContext'
import FlashcardTabContent from '../components/FlashcardTabContent'
import TimelineTabContent from '../components/TimelineTabContent'
import SourceTabContent from '../components/SourceTabContent'

/**
 * MasteryStats
 * Shows "X/Y attempted · Z% avg" with colour coding on the percentage.
 */
function MasteryStats({ attempted, total, avg }) {
  if (total === 0) return null
  const cls = attempted > 0 ? getMasteryClass(avg) : ''
  return (
    <div className="card-mastery-stats">
      <span className="mastery-stats-count">
        {attempted}/{total} attempted
      </span>
      {attempted > 0 && (
        <span className={`mastery-stats-avg mastery-${cls}`}>
          {avg}% avg
        </span>
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

  // Lazy-loaded chunk IDs for the flashcards/timelines tabs
  const [moduleChunkIds, setModuleChunkIds] = useState(null)
  const [loadingChunkIds, setLoadingChunkIds] = useState(false)

  // Quiz resource data: { unitId -> [{ chunkId, resourceId }] }
  const [unitQuizMap, setUnitQuizMap] = useState({})

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

        // Chunk counts
        const { data: countData } = await supabase
          .from('chunks').select('unit_id').eq('archived', false).in('unit_id', unitIds)
        if (countData) {
          const counts = {}
          countData.forEach(row => { counts[row.unit_id] = (counts[row.unit_id] || 0) + 1 })
          setChunkCounts(counts)
        }

        // Fetch all chunks + quiz resources for all units in one pass
        const { data: chunksData } = await supabase
          .from('chunks').select('id, unit_id, order_index').eq('archived', false).in('unit_id', unitIds).order('order_index')

        if (chunksData && chunksData.length > 0) {
          const chunkIds = chunksData.map(c => c.id)
          const { data: crData } = await supabase
            .from('chunk_resources')
            .select('chunk_id, resources(id, type)')
            .in('chunk_id', chunkIds)

          // Build unitId -> [resourceId] map for quiz resources
          const chunkToUnit = {}
          const chunkOrderMap = {}
          chunksData.forEach(c => { chunkToUnit[c.id] = c.unit_id; chunkOrderMap[c.id] = c.order_index ?? 0 })

          const quizMap = {}
          unitsData.forEach(u => { quizMap[u.id] = [] })
          ;(crData ?? []).forEach(row => {
            if (row.resources?.type?.toLowerCase() === 'quiz') {
              const unitId = chunkToUnit[row.chunk_id]
              if (unitId) quizMap[unitId].push({
                chunkId:    row.chunk_id,
                chunkOrder: chunkOrderMap[row.chunk_id] ?? 0,
                resourceId: row.resources.id,
              })
            }
          })
          setUnitQuizMap(quizMap)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [moduleId])

  // Mastery: collect all quiz resource IDs and unit master timeline keys
  const allQuizIds = Object.values(unitQuizMap).flat().map(q => q.resourceId)
  const unitMasterKeys = units.map(u => `unit:${u.id}`)

  const { quizBest, timelineBest } = useMastery({
    resourceIds:        user && allQuizIds.length > 0 ? allQuizIds : [],
    masterTimelineKeys: user && unitMasterKeys.length > 0 ? unitMasterKeys : [],
  })

  // Load chunk IDs for the flashcard/timeline tabs when first opened
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

      {/* Tabs */}
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

              // Quiz mastery stats for this unit
              const quizEntries  = unitQuizMap[unit.id] ?? []
              const totalQuizzes = quizEntries.length
              const attempted    = quizEntries.filter(q => quizBest?.[q.resourceId] != null).length
              const scores       = quizEntries.map(q => quizBest?.[q.resourceId]?.bestPercent).filter(p => p != null)
              const avgScore     = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

              // Per-chunk pip: best quiz score across all quizzes in that chunk, sorted by order_index
              const chunkIds = [...new Map(quizEntries.map(q => [q.chunkId, q.chunkOrder])).entries()]
                .sort((a, b) => a[1] - b[1]).map(([id]) => id)
              const chunkPips = chunkIds.map(cid => {
                const chunkScores = quizEntries
                  .filter(q => q.chunkId === cid)
                  .map(q => quizBest?.[q.resourceId]?.bestPercent)
                  .filter(p => p != null)
                const pct = chunkScores.length > 0
                  ? Math.round(chunkScores.reduce((a, b) => a + b, 0) / chunkScores.length)
                  : null
                return { id: cid, label: 'Chunk', percent: pct }
              })

              // Timeline mastery
              const tlModes = timelineBest?.[unitKey]
              const tlPct   = tlModes ? Math.max(...Object.values(tlModes).filter(v => v != null)) : null

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

                    {user && (totalQuizzes > 0 || tlPct != null) && (
                      <div className="card-mastery">
                        {totalQuizzes > 0 && (
                          <>
                            <MasteryPipRow label="Quizzes" items={chunkPips} />
                            <MasteryStats attempted={attempted} total={totalQuizzes} avg={avgScore} />
                          </>
                        )}
                        {tlPct != null && (
                          <MasteryPipRow label="Timelines" items={[{ id: unitKey, label: 'Timeline', percent: tlPct }]} />
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
