import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'

export default function UnitPage() {
  const { moduleId } = useParams()
  const [module, setModule] = useState(null)
  const [course, setCourse] = useState(null)
  const [units, setUnits] = useState([])
  const [chunkCounts, setChunkCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('id, title, course_id, courses(id, title, description)')
        .eq('id', moduleId)
        .single()

      if (moduleError) {
        setError(moduleError.message)
        setLoading(false)
        return
      }

      setModule(moduleData)
      setCourse(moduleData.courses)

      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index')

      if (unitsError) {
        setError(unitsError.message)
        setLoading(false)
        return
      }

      setUnits(unitsData)

      // Fetch chunk counts per unit
      if (unitsData.length > 0) {
        const { data: countData } = await supabase
          .from('chunks')
          .select('unit_id')
          .in('unit_id', unitsData.map(u => u.id))

        if (countData) {
          const counts = {}
          countData.forEach(row => {
            counts[row.unit_id] = (counts[row.unit_id] || 0) + 1
          })
          setChunkCounts(counts)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [moduleId])

  if (loading) return <div className="page"><div className="loading-pulse">Loading units…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Courses', to: '/' },
          { label: course?.title ?? 'Course', to: `/modules/${course?.id}` },
          { label: module?.title ?? 'Module' },
        ]}
      />

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

      {units.length === 0 ? (
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
                    <span className="card-count">
                      {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}
                    </span>
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
