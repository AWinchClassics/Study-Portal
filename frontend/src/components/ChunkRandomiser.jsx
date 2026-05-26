import { useState, useRef } from 'react'
import { supabase } from '../supabase'

export default function ChunkRandomiser({ chunkTitle }) {
  const cardsRef  = useRef([])     // General Instructions cards, loaded once
  const loadedRef = useRef(false)
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [animKey, setAnimKey]     = useState(0)

  async function handleGenerate() {
    // Load General Instructions cards on first click only
    if (!loadedRef.current) {
      setLoading(true)

      const { data: group } = await supabase
        .from('randomiser_function_groups')
        .select('id')
        .eq('name', 'General Instructions')
        .single()

      if (group) {
        const { data: cards } = await supabase
          .from('randomiser_function_cards')
          .select('text')
          .eq('group_id', group.id)

        cardsRef.current = (cards ?? []).map(c => c.text)
      }

      loadedRef.current = true
      setLoading(false)
    }

    const pool = cardsRef.current
    if (!pool.length) return

    const instruction = pool[Math.floor(Math.random() * pool.length)]
    setResult(instruction)
    setAnimKey(k => k + 1)
  }

  return (
    <div className="chunk-randomiser">
      {/* Top bar — always the same height */}
      <div className="chunk-randomiser-bar">
        <span className="chunk-randomiser-label">🎲 Random Activity</span>
        <button
          className="chunk-randomiser-btn"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? '…' : result ? '↻ New' : 'Generate'}
        </button>
      </div>

      {/* Body — fixed height, never reflows */}
      <div className="chunk-randomiser-body">
        {result ? (
          <div key={animKey} className="chunk-randomiser-result-inner">
            <span className="chunk-randomiser-for">
              For <strong>{chunkTitle}</strong>:
            </span>
            <span className="chunk-randomiser-text">{result}</span>
          </div>
        ) : (
          <span className="chunk-randomiser-placeholder">
            Click Generate for a random revision activity.
          </span>
        )}
      </div>
    </div>
  )
}
