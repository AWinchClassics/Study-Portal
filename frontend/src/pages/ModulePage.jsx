import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'

export default function ModulePage() {
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [unitCounts, setUnitCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id, title, description')
        .eq('id', courseId)
        .single()

      if (courseError) {
        setError(courseError.message)
        setLoading(false)
        return
      }

      setCourse(courseData)

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index')

      if (modulesError) {
        setError(modulesError.message)
        setLoading(false)
        return
      }

      setModules(modulesData)

      // Fetch unit counts per module for the card metadata
      if (modulesData.length > 0) {
        const { data: countData } = await supabase
          .from('units')
          .select('module_id')
          .in('module_id', modulesData.map(m => m.id))

        if (countData) {
          const counts = {}
          countData.forEach(row => {
            counts[row.module_id] = (counts[row.module_id] || 0) + 1
          })
          setUnitCounts(counts)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [courseId])

  if (loading) return <div className="page"><div className="loading-pulse">Loading modules…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Courses', to: '/' },
          { label: course?.title ?? 'Course' },
        ]}
      />

      <div className="page-header">
        <div>
          <div className="page-level-label">Course</div>
          <h1>{course?.title}</h1>
          {course?.description && (
            <p className="page-subtitle">{course.description}</p>
          )}
        </div>
        <div className="page-header-meta">
          <span className="meta-badge">{modules.length} {modules.length === 1 ? 'module' : 'modules'}</span>
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
            return (
              <li key={mod.id}>
                <button
                  className="hierarchy-card module-card"
                  style={{ '--card-index': index }}
                  onClick={() => navigate(`/units/${mod.id}`)}
                >
                  <div className="card-level-tag">Module</div>
                  <h2 className="card-title">{mod.title}</h2>
                  <div className="card-footer">
                    <span className="card-count">
                      {unitCount} {unitCount === 1 ? 'unit' : 'units'}
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
