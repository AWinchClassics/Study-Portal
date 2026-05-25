import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import Breadcrumb from '../components/Breadcrumb'

export default function ChunkPage() {
  const { unitId } = useParams()
  const [unit, setUnit] = useState(null)
  const [module, setModule] = useState(null)
  const [course, setCourse] = useState(null)
  const [chunks, setChunks] = useState([])
  const [resourcesByChunk, setResourcesByChunk] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      // Fetch unit → module → course in one query
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('id, title, module_id, modules(id, title, course_id, courses(id, title))')
        .eq('id', unitId)
        .single()

      if (unitError) {
        setError(unitError.message)
        setLoading(false)
        return
      }

      setUnit(unitData)
      setModule(unitData.modules)
      setCourse(unitData.modules?.courses)

      // Fetch chunks for this unit
      const { data: chunksData, error: chunksError } = await supabase
        .from('chunks')
        .select('*')
        .eq('unit_id', unitId)
        .order('order_index')

      if (chunksError) {
        setError(chunksError.message)
        setLoading(false)
        return
      }

      setChunks(chunksData)

      // Fetch all resources for every chunk in this unit in one query
      if (chunksData.length > 0) {
        const chunkIds = chunksData.map(c => c.id)

        const { data: crData, error: crError } = await supabase
          .from('chunk_resources')
          .select('chunk_id, purpose, order_index, resources(*)')
          .in('chunk_id', chunkIds)
          .order('order_index')

        if (!crError && crData) {
          // Group resources by chunk_id
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

  if (loading) return <p className="page-status">Loading chunks…</p>
  if (error)   return <p className="page-status page-error">Error: {error}</p>

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: 'Courses', to: '/' },
          { label: course?.title ?? 'Course', to: `/modules/${course?.id}` },
          { label: module?.title ?? 'Module', to: `/units/${module?.id}` },
          { label: unit?.title ?? 'Unit' },
        ]}
      />

      <h1>{unit?.title}</h1>

      {chunks.length === 0 ? (
        <p className="page-status">No chunks found for this unit.</p>
      ) : (
        <ul className="chunk-list">
          {chunks.map(chunk => {
            const resources = resourcesByChunk[chunk.id] ?? []
            return (
              <li key={chunk.id} className="chunk-card">
                <h2>{chunk.title}</h2>
                {chunk.description && (
                  <p className="chunk-description">{chunk.description}</p>
                )}

                {resources.length === 0 ? (
                  <p className="page-status">No resources attached yet.</p>
                ) : (
                  <ul className="resource-list">
                    {resources.map(r => (
                      <li key={r.id} className="resource-item">
                        <span className="resource-type">{r.type}</span>
                        <span className="resource-title">{r.title}</span>
                        {r.purpose && (
                          <span className="resource-purpose">{r.purpose}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
