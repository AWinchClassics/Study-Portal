import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function CoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('title')

      if (error) {
        setError(error.message)
      } else {
        setCourses(data)
      }
      setLoading(false)
    }

    fetchCourses()
  }, [])

  if (loading) return <p className="page-status">Loading courses…</p>
  if (error)   return <p className="page-status page-error">Error: {error}</p>

  return (
    <div className="page">
      <h1>Courses</h1>

      {courses.length === 0 ? (
        <p className="page-status">No courses found.</p>
      ) : (
        <ul className="card-list">
          {courses.map(course => (
            <li key={course.id}>
              <button
                className="card"
                onClick={() => navigate(`/modules/${course.id}`)}
              >
                <span className="card-title">{course.title}</span>
                {course.description && (
                  <span className="card-description">{course.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
