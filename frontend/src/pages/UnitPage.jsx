import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'

export default function UnitPage() {
  const { moduleId } = useParams()
  const [module, setModule] = useState(null)
  const [course, setCourse] = useState(null)
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      // Fetch the parent module, and its parent course in one query
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('id, title, course_id, courses(id, title)')
        .eq('id', moduleId)
        .single()

      if (moduleError) {
        setError(moduleError.message)
        setLoading(false)
        return
      }

      setModule(moduleData)
      setCourse(moduleData.courses)

      // Fetch units for this module
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index')

      if (unitsError) {
        setError(unitsError.message)
      } else {
        setUnits(unitsData)
      }

      setLoading(false)
    }

    fetchData()
  }, [moduleId])

  if (loading) return <p className="page-status">Loading units…</p>
  if (error)   return <p className="page-status page-error">Error: {error}</p>

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Courses', to: '/' },
          { label: course?.title ?? 'Course', to: `/modules/${course?.id}` },
          { label: module?.title ?? 'Module' },
        ]}
      />

      <h1>{module?.title}</h1>

      {units.length === 0 ? (
        <p className="page-status">No units found for this module.</p>
      ) : (
        <ul className="card-list">
          {units.map(unit => (
            <li key={unit.id}>
              <button
                className="card"
                onClick={() => navigate(`/chunks/${unit.id}`)}
              >
                <span className="card-title">{unit.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
