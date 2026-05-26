import { useState, useCallback } from 'react'
import { supabase } from '../supabase'

export default function ChunkRandomiser({ chunkTitle }) {
  const [open, setOpen]           = useState(false)
  const [groups, setGroups]       = useState([])     // [{id, name, cards:[]}]
  const [loaded, setLoaded]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [result, setResult]       = useState(null)
  const [animating, setAnimating] = useState(false)

  // Lazy-load function cards on first open
  async function handleOpen() {
    setOpen(true)
    if (loaded) return
    setLoading(true)

    const { data: groupData } = await supabase
      .from('randomiser_function_groups')
      .select('id, name, order_index')
      .order('order_index')

    if (groupData && groupData.length > 0) {
      const { data: cardData } = await supabase
        .from('randomiser_function_cards')
        .select('id, group_id, text')
        .in('group_id', groupData.map(g => g.id))

      const grouped = groupData.map(g => ({
        ...g,
        cards: (cardData ?? []).filter(c => c.group_id === g.id),
      }))
      setGroups(grouped)
    }

    setLoaded(true)
    setLoading(false)
  }

  const generate = useCallback(() => {
    // Build pool based on selected group
    const pool = selectedGroup === 'all'
      ? groups.flatMap(g => g.cards.map(c => c.text))
      : (groups.find(g => g.id === selectedGroup)?.cards.map(c => c.text) ?? [])

    if (!pool.length) return

    const instruction = pool[Math.floor(Math.random() * pool.length)]
    setAnimating(true)
    setResult(instruction)
    setTimeout(() => setAnimating(false), 300)
  }, [groups, selectedGroup])

  if (!open) {
    return (
      <button className="chunk-randomiser-trigger" onClick={handleOpen}>
        <span className="chunk-randomiser-trigger-icon">🎲</span>
        Random activity
      </button>
    )
  }

  return (
    <div className="chunk-randomiser">
      <div className="chunk-randomiser-header">
        <span className="chunk-randomiser-title">🎲 Random Activity</span>
        <button
          className="chunk-randomiser-close"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="loading-pulse" style={{ padding: '12px 0' }}>Loading…</div>
      ) : (
        <>
          <div className="chunk-randomiser-controls">
            <select
              className="t-purpose-select"
              value={selectedGroup}
              onChange={e => { setSelectedGroup(e.target.value); setResult(null) }}
            >
              <option value="all">All categories</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button className="qr-btn qr-btn-primary" onClick={generate}>
              Generate
            </button>
          </div>

          {result && (
            <div className={`chunk-randomiser-result ${animating ? 'chunk-randomiser-result-in' : ''}`}>
              <p className="chunk-randomiser-content-label">
                For <strong>{chunkTitle}</strong>:
              </p>
              <p className="chunk-randomiser-instruction">{result}</p>
              <button
                className="qr-btn qr-btn-ghost chunk-randomiser-regen"
                onClick={generate}
              >
                ↻ Regenerate
              </button>
            </div>
          )}

          {!result && (
            <p className="chunk-randomiser-hint">
              Select a category and click Generate to get a random activity.
            </p>
          )}
        </>
      )}
    </div>
  )
}
