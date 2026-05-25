import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [chunks, setChunks] = useState([])
  const [selectedChunk, setSelectedChunk] = useState(null)
  const [resources, setResources] = useState([])

  // Load chunks
  useEffect(() => {
    async function fetchChunks() {
      const { data } = await supabase
        .from('chunks')
        .select('*')
      setChunks(data)
    }

    fetchChunks()
  }, [])

  // Load resources when a chunk is selected
  useEffect(() => {
    if (!selectedChunk) return

    async function fetchResources() {
      const { data } = await supabase
        .from('chunk_resources')
        .select(`
          resources (*)
        `)
        .eq('chunk_id', selectedChunk.id)

      // flatten result
      const resourceList = data.map(r => r.resources)
      setResources(resourceList)
    }

    fetchResources()
  }, [selectedChunk])

  return (
    <div>
      <h1>Learning App Demo</h1>

      <h2>Chunks</h2>
      <ul>
        {chunks.map(chunk => (
          <li key={chunk.id}>
            <button onClick={() => setSelectedChunk(chunk)}>
              {chunk.title}
            </button>
          </li>
        ))}
      </ul>

      {selectedChunk && (
        <div>
          <h2>Resources for: {selectedChunk.title}</h2>

          {resources.length === 0 ? (
            <p>No resources yet</p>
          ) : (
            <ul>
              {resources.map(r => (
                <li key={r.id}>{r.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default App