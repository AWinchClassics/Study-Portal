import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function CoursesPage() {
  const [courses, setCourses] = useState([])
  const [moduleCounts, setModuleCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('archived', false)
        .order('title')

      if (coursesError) {
        setError(coursesError.message)
        setLoading(false)
        return
      }

      setCourses(coursesData)

      // Fetch module counts per course so we can show them on the cards
      if (coursesData.length > 0) {
        const { data: countData } = await supabase
          .from('modules')
          .select('course_id')
          .in('course_id', coursesData.map(c => c.id))

        if (countData) {
          const counts = {}
          countData.forEach(row => {
            counts[row.course_id] = (counts[row.course_id] || 0) + 1
          })
          setModuleCounts(counts)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <div className="page"><div className="loading-pulse">Loading courses…</div></div>
  if (error)   return <div className="page"><p className="page-error">Error: {error}</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your Courses</h1>
          <p className="page-subtitle">Select a course to begin</p>
        </div>
        <div className="page-header-meta">
          <span className="meta-badge">{courses.length} {courses.length === 1 ? 'course' : 'courses'}</span>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <p>No courses have been added yet.</p>
        </div>
      ) : (
        <ul className="card-grid">
          {courses.map((course, index) => {
            const moduleCount = moduleCounts[course.id] ?? 0
            return (
              <li key={course.id}>
                <button
                  className="hierarchy-card course-card"
                  style={{ '--card-index': index }}
                  onClick={() => navigate(`/modules/${course.id}`)}
                >
                  <div className="card-level-tag">Course</div>
                  <h2 className="card-title">{course.title}</h2>
                  {course.description && (
                    <p className="card-description">{course.description}</p>
                  )}
                  <div className="card-footer">
                    <span className="card-count">
                      {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
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
