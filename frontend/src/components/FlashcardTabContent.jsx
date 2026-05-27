import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import FlashcardViewer from './FlashcardViewer'

/**
 * FlashcardTabContent
 *
 * Fetches glossary terms for a given set of chunk IDs and renders
 * the FlashcardViewer. Used for embedded flashcard tabs on
 * ChunkPage, UnitPage, and ModulePage.
 *
 * Props:
 *   chunkIds  - array of chunk UUIDs to load terms for
 */
export default function FlashcardTabContent({ chunkIds = [] }) {
  const [cards, setCards]   = useState([])
  const [loading, setLoading] = useState(true)

  const key = chunkIds.slice().sort().join(',')

  useEffect(() => {
    if (chunkIds.length === 0) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    supabase
      .from('chunk_glossary')
      .select('priority, glossary_terms(id, term, definition, category, date)')
      .in('chunk_id', chunkIds)
      .then(({ data, error }) => {
        if (!error && data) {
          // Deduplicate by glossary term ID
          // If the same term appears in multiple chunks, keep the highest priority
          const priorityRank = { core: 0, useful: 1, stretch: 2 }
          const byId = {}
          data.forEach(row => {
            const t = row.glossary_terms
            if (!t) return
            const existing = byId[t.id]
            const rank = priorityRank[row.priority] ?? 99
            if (!existing || rank < (priorityRank[existing.priority] ?? 99)) {
              byId[t.id] = { ...t, priority: row.priority }
            }
          })
          setCards(Object.values(byId))
        }
        setLoading(false)
      })
  }, [key])

  if (loading) return <div className="loading-pulse" style={{ padding: '32px 0' }}>Loading flashcards…</div>

  return <FlashcardViewer cards={cards} />
}
