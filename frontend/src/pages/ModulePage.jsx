import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'

export default function ModulePage() {
  const { courseId } = useParams()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      // Fetch the parent course so we can show it in the breadcrumb
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .single()

      if (courseError) {
        setError(courseError.message)
        setLoading(false)
        return
      }

      setCourse(courseData)

      // Fetch modules for this course, ordered by their position
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index')

      if (modulesError) {
        setError(modulesError.message)
      } else {
        setModules(modulesData)
      }

      setLoading(false)
    }

    fetchData()
  }, [courseId])

  if (loading) return <p className="page-status">Loading modules…</p>
  if (error)   return <p className="page-status page-error">Error: {error}</p>

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Courses', to: '/' },
          { label: course?.title ?? 'Course' },
        ]}
      />

      <h1>{course?.title}</h1>

      {modules.length === 0 ? (
        <p className="page-status">No modules found for this course.</p>
      ) : (
        <ul className="card-list">
          {modules.map(mod => (
            <li key={mod.id}>
              <button
                className="card"
                onClick={() => navigate(`/units/${mod.id}`)}
              >
                <span className="card-title">{mod.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
