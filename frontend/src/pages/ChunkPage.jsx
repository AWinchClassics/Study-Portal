import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'
import ChunkRandomiser from '../components/ChunkRandomiser'
import SourceTabContent from '../components/SourceTabContent'
import VideoPlayer from '../components/VideoPlayer'
import PdfViewer from '../components/PdfViewer'
import FlashcardTabContent from '../components/FlashcardTabContent'
import TimelineTabContent from '../components/TimelineTabContent'

const SECTIONS = [
  { key: 'core',      label: 'Core Content',  icon: '📖' },
  { key: 'homework',  label: 'Homework',       icon: '✏️' },
  { key: 'revision',  label: 'Revision',       icon: '🔁' },
  { key: 'extension', label: 'Extension',      icon: '⭐' },
]

const TYPE_ICONS = {
  video: '▶', quiz: '❓', pdf: '📄', text: '📝',
  audio: '🎧', worksheet: '📋', task: '✅', flashcards: '🃏', source: '📜',
}

function ResourceItem({ resource, navContext }) {
  const navigate = useNavigate()
  const [videoOpen, setVideoOpen] = useState(false)
  const [pdfOpen,   setPdfOpen]   = useState(false)
  const type    = resource.type?.toLowerCase()
  const icon    = TYPE_ICONS[type] ?? '📎'
  const isQuiz  = type === 'quiz'
  const isVideo = type === 'video' && !!resource.url
  const isPdf   = type === 'pdf'   && !!resource.url
  const hasExternalLink = resource.url?.startsWith('http') && !isQuiz && !isVideo && !isPdf

  // Video resource — collapsible inline player
  if (isVideo) {
    return (
      <div className={`resource-item resource-item-video ${videoOpen ? 'resource-video-open' : ''}`}>
        <button className="resource-video-header" onClick={() => setVideoOpen(o => !o)}>
          <span className="resource-icon">▶</span>
          <div className="resource-info">
            <span className="resource-title">{resource.title}</span>
            {resource.description && <span className="resource-desc">{resource.description}</span>}
          </div>
          <span className="resource-type-pill">video</span>
          <span className="resource-open-arrow">{videoOpen ? '▾' : '▸'}</span>
        </button>
        {videoOpen && (
          <div className="resource-video-player">
            <VideoPlayer url={resource.url} title={resource.title} />
          </div>
        )}
      </div>
    )
  }

  // PDF resource — collapsible inline viewer
  if (isPdf) {
    return (
      <div className={`resource-item resource-item-video ${pdfOpen ? 'resource-video-open' : ''}`}>
        <button className="resource-video-header" onClick={() => setPdfOpen(o => !o)}>
          <span className="resource-icon">📄</span>
          <div className="resource-info">
            <span className="resource-title">{resource.title}</span>
            {resource.description && <span className="resource-desc">{resource.description}</span>}
          </div>
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="resource-open-arrow"
            onClick={e => e.stopPropagation()}
            title="Open in new tab"
          >
            ↗
          </a>
          <span className="resource-type-pill">pdf</span>
          <span className="resource-open-arrow">{pdfOpen ? '▾' : '▸'}</span>
        </button>
        {pdfOpen && (
          <div className="resource-video-player">
            <PdfViewer url={resource.url} title={resource.title} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="resource-item">
      <span className="resource-icon">{icon}</span>
      <div className="resource-info">
        <span className="resource-title">{resource.title}</span>
        {resource.description && <span className="resource-desc">{resource.description}</span>}
      </div>
      <span className="resource-type-pill">{resource.type}</span>
      {isQuiz && (
        <button className="resource-quiz-btn" onClick={() => navigate(`/quiz/${resource.id}`, { state: navContext })}>
          Start quiz →
        </button>
      )}
      {hasExternalLink && (
        <a href={resource.url} target="_blank" rel="noreferrer" className="resource-open-arrow">↗</a>
      )}
    </div>
  )
}

function ChunkCard({ chunk, resources, navContext }) {
  const [collapsed, setCollapsed] = useState(true)
  const [chunkTab, setChunkTab]   = useState('resources')

  const byPurpose = {}
  resources.forEach(r => {
    const key = r.purpose ?? 'core'
    if (!byPurpose[key]) byPurpose[key] = []
    byPurpose[key].push(r)
  })
  const activeSections = SECTIONS.filter(s => byPurpose[s.key]?.length > 0)

  return (
    <div className={`chunk-card ${collapsed ? 'chunk-card-collapsed' : ''}`}>
      {/* Header — click anywhere to expand/collapse */}
      <div className="chunk-card-header" onClick={() => setCollapsed(o => !o)}>
        <h2 className="chunk-title">{chunk.title}</h2>
        <div className="chunk-header-right">
          {chunk.estimated_time && <span className="chunk-time">⏱ {chunk.estimated_time} min</span>}
          <span className="chunk-chevron">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {chunk.description && <p className="chunk-description">{chunk.description}</p>}

          {/* Per-chunk tabs */}
      <div className="chunk-tabs">
        <button
          className={`chunk-tab ${chunkTab === 'resources' ? 'chunk-tab-active' : ''}`}
          onClick={() => setChunkTab('resources')}
        >
          📖 Resources
        </button>
        <button
          className={`chunk-tab ${chunkTab === 'flashcards' ? 'chunk-tab-active' : ''}`}
          onClick={() => setChunkTab('flashcards')}
        >
          🃏 Flashcards
        </button>
        <button
          className={`chunk-tab ${chunkTab === 'timelines' ? 'chunk-tab-active' : ''}`}
          onClick={() => setChunkTab('timelines')}
        >
          📅 Timelines
        </button>
        <button
          className={`chunk-tab ${chunkTab === 'sources' ? 'chunk-tab-active' : ''}`}
          onClick={() => setChunkTab('sources')}
        >
          📜 Sources
        </button>
      </div>

      {/* Resources tab */}
      {chunkTab === 'resources' && (
        resources.length === 0 ? (
          <p className="chunk-empty">No resources attached to this chunk yet.</p>
        ) : activeSections.length > 0 ? (
          <div className="chunk-sections">
            {activeSections.map(section => (
              <div key={section.key} className="chunk-section">
                <div className="chunk-section-header">
                  <span className="chunk-section-icon">{section.icon}</span>
                  <span className="chunk-section-label">{section.label}</span>
                  <span className="chunk-section-count">{byPurpose[section.key].length}</span>
                </div>
                <ul className="chunk-resource-list">
                  {byPurpose[section.key].map(r => (
                    <li key={r.id}><ResourceItem resource={r} navContext={navContext} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="chunk-resource-list">
            {resources.map(r => <li key={r.id}><ResourceItem resource={r} navContext={navContext} /></li>)}
          </ul>
        )
      )}

      {/* Flashcards tab — chunk level only */}
      {chunkTab === 'flashcards' && (
        <FlashcardTabContent chunkIds={[chunk.id]} />
      )}

      {/* Timelines tab — chunk level only */}
      {chunkTab === 'timelines' && (
        <TimelineTabContent chunkIds={[chunk.id]} />
      )}

      {/* Sources tab — chunk level only */}
      {chunkTab === 'sources' && (
        <SourceTabContent chunkIds={[chunk.id]} />
      )}

          {/* Randomiser */}
          <div className="chunk-randomiser-wrapper">
            <ChunkRandomiser chunkTitle={chunk.title} />
          </div>
        </>
      )}
    </div>
  )
}

export default function ChunkPage() {
  const { unitId } = useParams()
  const [unit, setUnit]         = useState(null)
  const [module, setModule]     = useState(null)
  const [course, setCourse]     = useState(null)
  const [chunks, setChunks]     = useState([])
  const [resourcesByChunk, setResourcesByChunk] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [activeTab, setActiveTab] = useState('content')

  useEffect(() => {
    async function fetchData() {
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('id, title, module_id, modules(id, title, course_id, courses(id, title))')
        .eq('id', unitId)
        .single()

      if (unitError) { setError(unitError.message); setLoading(false); return }
      setUnit(unitData)
      setModule(unitData.modules)
      setCourse(unitData.modules?.courses)

      const { data: chunksData, error: chunksError } = await supabase
        .from('chunks').select('*').eq('unit_id', unitId).order('order_index')
      if (chunksError) { setError(chunksError.message); setLoading(false); return }
      setChunks(chunksData)

      if (chunksData.length > 0) {
        const { data: crData } = await supabase
          .from('chunk_resources')
          .select('chunk_id, purpose, order_index, resources(*)')
          .in('chunk_id', chunksData.map(c => c.id))
          .order('order_index')
        if (crData) {
          const grouped = {}
          crData.forEach(row => {
            if (!grouped[row.chunk_id]) grouped[row.chunk_id] = []
            grouped[row.chunk_id].push({ ...row.resources, purpose: row.purpose })
          })
          setResourcesByChunk(grouped)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [unitId])

  if (loading) return <div className="page"><div className="loading-pulse">Loading chunks…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  const totalResources = Object.values(resourcesByChunk).flat().length
  const navContext = {
    unitId, unitTitle: unit?.title,
    moduleId: module?.id, moduleTitle: module?.title,
    courseId: course?.id, courseTitle: course?.title,
  }

  return (
    <div className="page">
      <Breadcrumb items={[
        { label: 'Courses', to: '/' },
        { label: course?.title ?? 'Course', to: `/modules/${course?.id}` },
        { label: module?.title ?? 'Module', to: `/units/${module?.id}` },
        { label: unit?.title ?? 'Unit' },
      ]} />

      <div className="page-header">
        <div>
          <div className="page-level-label">Unit</div>
          <h1>{unit?.title}</h1>
          <p className="page-subtitle">Part of <strong>{module?.title}</strong></p>
        </div>
        <div className="page-header-meta">
          <span className="meta-badge">{chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}</span>
          {totalResources > 0 && <span className="meta-badge">{totalResources} {totalResources === 1 ? 'resource' : 'resources'}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        <button
          className={`page-tab ${activeTab === 'content' ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          📖 Resources
        </button>
        <button
          className={`page-tab ${activeTab === 'flashcards' ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('flashcards')}
        >
          🃏 Flashcards
        </button>
        <button
          className={`page-tab ${activeTab === 'timelines' ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('timelines')}
        >
          📅 Timelines
        </button>
        <button
          className={`page-tab ${activeTab === 'sources' ? 'page-tab-active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          📜 Sources
        </button>
      </div>

      {activeTab === 'content' && (
        chunks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧩</div>
            <p>No chunks have been added to this unit yet.</p>
          </div>
        ) : (
          <div className="chunk-list">
            {chunks.map(chunk => (
              <ChunkCard
                key={chunk.id}
                chunk={chunk}
                resources={resourcesByChunk[chunk.id] ?? []}
                navContext={navContext}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'flashcards' && (
        <FlashcardTabContent
          chunkIds={chunks.map(c => c.id)}
          unitIds={[unitId]}
        />
      )}

      {activeTab === 'timelines' && (
        <TimelineTabContent
          chunkIds={chunks.map(c => c.id)}
          unitIds={[unitId]}
        />
      )}

      {activeTab === 'sources' && (
        <SourceTabContent chunkIds={chunks.map(c => c.id)} />
      )}
    </div>
  )
}
