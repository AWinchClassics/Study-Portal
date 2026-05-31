import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import VideoPlayer from '../components/VideoPlayer'
import PdfViewer from '../components/PdfViewer'

const TYPE_ICONS = {
  video: '▶', quiz: '❓', pdf: '📄', text: '📝',
  audio: '🎧', worksheet: '📋', task: '✅', flashcards: '🃏', source: '📜',
}

// ── Fetch helper ──────────────────────────────────────────────────
async function fetchHierarchy(moduleId) {
  const { data } = await supabase
    .from('units')
    .select(`
      id, title, order_index,
      chunks(
        id, title, order_index,
        chunk_resources(
          resources(id, title, type, url, description)
        )
      )
    `)
    .eq('module_id', moduleId)
    .order('order_index')

  return (data ?? []).map(unit => ({
    ...unit,
    chunks: (unit.chunks ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(chunk => ({
        ...chunk,
        resources: (chunk.chunk_resources ?? [])
          .map(cr => cr.resources)
          .filter(Boolean),
      })),
  }))
}

// ── Resource card ─────────────────────────────────────────────────
function ResourceCard({ resource }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const type    = resource.type?.toLowerCase()
  const isQuiz  = type === 'quiz'
  const isVideo = type === 'video' && !!resource.url
  const isPdf   = type === 'pdf'   && !!resource.url
  const hasLink = !!resource.url && !isQuiz && !isVideo && !isPdf

  return (
    <div className={`rp-resource-card ${open ? 'rp-card-open' : ''}`}>
      <div className="rp-resource-header">
        <span className="rp-resource-icon">{TYPE_ICONS[type] ?? '📎'}</span>
        <div className="rp-resource-info">
          <span className="rp-resource-title">{resource.title}</span>
          {resource.description && <span className="rp-resource-desc">{resource.description}</span>}
        </div>
        <span className="rp-resource-type-pill">{resource.type}</span>
        {isQuiz && (
          <button className="rp-quiz-btn" onClick={() => navigate(`/quiz/${resource.id}`)}>
            Start quiz →
          </button>
        )}
        {hasLink && (
          <a href={resource.url} target="_blank" rel="noreferrer" className="rp-link-arrow">↗</a>
        )}
        {(isVideo || isPdf) && (
          <button className="rp-expand-btn" onClick={() => setOpen(o => !o)} title={open ? 'Close' : 'Open'}>
            {open ? '▾' : '▸'}
          </button>
        )}
      </div>
      {open && isVideo && (
        <div className="rp-media">
          <VideoPlayer url={resource.url} title={resource.title} />
        </div>
      )}
      {open && isPdf && (
        <div className="rp-media">
          <PdfViewer url={resource.url} title={resource.title} />
          <a href={resource.url} target="_blank" rel="noreferrer" className="pdf-open-tab-link">
            Open in new tab ↗
          </a>
        </div>
      )}
    </div>
  )
}

// ── Unit section ──────────────────────────────────────────────────
function UnitSection({ unit }) {
  const [expanded, setExpanded] = useState(true)
  const total = unit.chunks.reduce((n, c) => n + c.resources.length, 0)
  if (total === 0) return null

  return (
    <div className="rp-unit-section">
      <button className="rp-unit-header" onClick={() => setExpanded(o => !o)}>
        <span className="rp-unit-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="rp-unit-title">{unit.title}</span>
        <span className="rp-unit-count">{total}</span>
      </button>
      {expanded && (
        <div className="rp-unit-body">
          {unit.chunks.map(chunk =>
            chunk.resources.length > 0 && (
              <div key={chunk.id} className="rp-chunk-section">
                <p className="rp-chunk-label">{chunk.title}</p>
                <div className="rp-chunk-resources">
                  {chunk.resources.map(r => (
                    <ResourceCard key={`${chunk.id}-${r.id}`} resource={r} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function ResourcesPage() {
  const [modules, setModules]       = useState([])
  const [moduleId, setModuleId]     = useState(null)
  const [units, setUnits]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    supabase.from('modules').select('id, title, order_index')
      .order('order_index')
      .then(({ data }) => {
        setModules(data ?? [])
        if (data?.length) setModuleId(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (!moduleId) return
    setLoading(true)
    setTypeFilter('all')
    fetchHierarchy(moduleId).then(data => {
      setUnits(data)
      setLoading(false)
    })
  }, [moduleId])

  // All resource types present in this module
  const availableTypes = useMemo(() => {
    const seen = new Set()
    units.forEach(u => u.chunks.forEach(c => c.resources.forEach(r => {
      if (r.type) seen.add(r.type.toLowerCase())
    })))
    return ['all', ...Object.keys(TYPE_ICONS).filter(t => seen.has(t))]
  }, [units])

  // Apply type filter
  const filtered = useMemo(() => {
    if (typeFilter === 'all') return units
    return units.map(u => ({
      ...u,
      chunks: u.chunks.map(c => ({
        ...c,
        resources: c.resources.filter(r => r.type?.toLowerCase() === typeFilter),
      })),
    }))
  }, [units, typeFilter])

  function countForType(t) {
    return units.reduce((n, u) => n + u.chunks.reduce((m, c) =>
      m + c.resources.filter(r => r.type?.toLowerCase() === t).length, 0), 0)
  }

  const totalVisible = filtered.reduce((n, u) => n + u.chunks.reduce((m, c) => m + c.resources.length, 0), 0)

  return (
    <div className="page rp-page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1>Resources</h1>
          {modules.length > 1 && (
            <p className="page-subtitle">
              <select
                className="rp-module-select"
                value={moduleId ?? ''}
                onChange={e => setModuleId(e.target.value)}
              >
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </p>
          )}
          {modules.length === 1 && <p className="page-subtitle">{modules[0]?.title}</p>}
        </div>
        {!loading && <div className="page-header-meta"><span className="meta-badge">{totalVisible} resources</span></div>}
      </div>

      {/* Type filter pills */}
      {availableTypes.length > 2 && (
        <div className="rp-type-pills">
          {availableTypes.map(t => (
            <button
              key={t}
              className={`rp-type-pill ${typeFilter === t ? 'rp-type-active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All types' : <>{TYPE_ICONS[t]} {t}</>}
              {t !== 'all' && <span className="rp-pill-count">{countForType(t)}</span>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-pulse">Loading resources…</div>
      ) : totalVisible === 0 ? (
        <div className="rp-empty">
          <span>📦</span>
          <p>{units.length === 0
            ? 'No resources have been assigned in this module yet.'
            : 'No resources match the selected type.'}</p>
        </div>
      ) : (
        <div className="rp-units">
          {filtered.map(u => <UnitSection key={u.id} unit={u} />)}
        </div>
      )}
    </div>
  )
}
