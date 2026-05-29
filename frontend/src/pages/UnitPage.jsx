import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import FlashcardTabContent from '../components/FlashcardTabContent'
import TimelineTabContent from '../components/TimelineTabContent'
import SourceTabContent from '../components/SourceTabContent'

export default function UnitPage() {
  const { moduleId } = useParams()
  const [module, setModule]     = useState(null)
  const [course, setCourse]     = useState(null)
  const [units, setUnits]       = useState([])
  const [chunkCounts, setChunkCounts] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeTab, setActiveTab] = useState('units')

  // Lazy-loaded chunk IDs for the flashcards tab
  const [moduleChunkIds, setModuleChunkIds] = useState(null)
  const [loadingChunkIds, setLoadingChunkIds] = useState(false)

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
        .from('units').select('*').eq('module_id', moduleId).order('order_index')
      if (unitsError) { setError(unitsError.message); setLoading(false); return }
      setUnits(unitsData)

      if (unitsData.length > 0) {
        const { data: countData } = await supabase
          .from('chunks').select('unit_id').in('unit_id', unitsData.map(u => u.id))
        if (countData) {
          const counts = {}
          countData.forEach(row => { counts[row.unit_id] = (counts[row.unit_id] || 0) + 1 })
          setChunkCounts(counts)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [moduleId])

  // Load chunk IDs for the flashcard tab when it's first opened
  async function handleFlashcardTabOpen(tab = 'flashcards') {
    setActiveTab(tab)
    if (moduleChunkIds !== null) return
    setLoadingChunkIds(true)
    const { data } = await supabase
      .from('chunks').select('id').in('unit_id', units.map(u => u.id))
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
          <span className="meta-badge">{units.length} {units.length === 1 ? 'unit' : 'units'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        <button className={`page-tab ${activeTab === 'units' ? 'page-tab-active' : ''}`} onClick={() => setActiveTab('units')}>
          📄 Units
        </button>
        <button className={`page-tab ${activeTab === 'flashcards' ? 'page-tab-active' : ''}`} onClick={handleFlashcardTabOpen}>
          🃏 Flashcards
        </button>
        <button className={`page-tab ${activeTab === 'timelines' ? 'page-tab-active' : ''}`} onClick={handleFlashcardTabOpen.bind(null,'timelines')}>
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
            />
      )}

      {activeTab === 'sources' && (
        loadingChunkIds
          ? <div className="loading-pulse">Loading sources…</div>
          : <SourceTabContent chunkIds={moduleChunkIds ?? []} />
      )}
    </div>
  )
}
